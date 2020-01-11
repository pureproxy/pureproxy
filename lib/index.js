const net = require('net')
const url = require('url')

const { BufferedEmitter } = require('./emitter')
const { HTTPParser, methods } = require('./parser')

const kOnHeadersComplete = HTTPParser.kOnHeadersComplete | 0
const kOnBody = HTTPParser.kOnBody | 0
const kOnMessageComplete = HTTPParser.kOnMessageComplete | 0

const connectMethod = methods.indexOf('CONNECT')

class HTTPParserEmitter extends BufferedEmitter {
    constructor(type) {
        super()

        this.parser = new HTTPParser(type)

        this.parser[kOnHeadersComplete] = (...args) => {
            this.emit(kOnHeadersComplete, ...args)
        }

        this.parser[kOnBody] = (...args) => {
            this.emit(kOnBody, ...args)
        }

        this.parser[kOnMessageComplete] = (...args) => {
            this.emit(kOnMessageComplete, ...args)
        }
    }

    execute(...args) {
        this.parser.execute(...args)
    }
}

class PureProxy extends net.Server {
    constructor(options = {}) {
        super(options)

        this.onHttpConnectionHandler = this.onHttpConnectionHandler.bind(this)
        this.onConnectionHandler = this.onConnectionHandler.bind(this)

        this.on('connection', this.onConnectionHandler)
    }

    writeConnectionEstablished(socket) {
        socket.write('HTTP/1.1 200 Connection Established\r\nContent-Length: 0\r\n\r\n')
    }

    writeInternalServerError(socket) {
        socket.write('HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n')
    }

    writeBadGateway(socket) {
        socket.write('HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n')
    }

    writeRequestLine(socket, method, path, versionMajor, versionMinor) {
        socket.write(`${method} ${path} HTTP/${versionMajor}.${versionMinor}\r\n`)
    }

    writeResponseLine(socket, versionMajor, versionMinor, statusCode, statusMessage) {
        socket.write(`HTTP/${versionMajor}.${versionMinor} ${statusCode} ${statusMessage}\r\n`)
    }

    writeHeaders(socket, headers) {
        for (let valueIndex = 1; valueIndex < headers.length; valueIndex += 2) {
            const keyIndex = valueIndex - 1

            socket.write(`${headers[keyIndex]}: ${headers[valueIndex]}\r\n`)
        }

        socket.write('\r\n')
    }

    createHttpRequestParser() {
        return new HTTPParserEmitter(HTTPParser.REQUEST)
    }

    createHttpResponseParser() {
        return new HTTPParserEmitter(HTTPParser.RESPONSE)
    }

    getHttpHeader(headers, name) {
        name = name.toLowerCase()

        const nameIndex = headers.findIndex(h => h.toLowerCase() === name)

        if (nameIndex < 0) {
            return
        }

        const valueIndex = nameIndex + 1

        if (valueIndex >= headers.length) {
            return
        }

        return headers[valueIndex]
    }

    getClient(hostname, port) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket()

            socket.connect(port, hostname)

            function hook() {
                socket.once('error', errorHandler)
                socket.once('timeout', timeoutHandler)
                socket.once('connect', connectHandler)
            }

            function unhook() {
                socket.off('error', errorHandler)
                socket.off('timeout', timeoutHandler)
                socket.off('connect', connectHandler)
            }

            hook()

            function errorHandler(error = new Error('Generic')) {
                unhook()
                reject(error)
            }

            function timeoutHandler(timeout = new Error('Timeout')) {
                unhook()
                reject(timeout)
            }

            function connectHandler() {
                unhook()
                resolve(socket)
            }
        })
    }

    onHttpConnectionHandler(socket) {
        const requestParser = this.createHttpRequestParser()

        const onSocketData = (data) => {
            requestParser.execute(data)
        }

        requestParser.once(kOnHeadersComplete, async(info) => {
            let { versionMajor, versionMinor, headers, method, url: uri, statusCode, statusMessage, upgrade, shouldKeepAlive } = info

            const context = { versionMajor, versionMinor, headers, method, uri, statusCode, statusMessage, upgrade, shouldKeepAlive }

            if (method === connectMethod) {
                const [hostname, port] = uri.split(':')

                let client = this.getClient(hostname || this.getHttpHeader(headers, 'host'), port ? parseInt(port) : 443, context)

                requestParser.once(kOnMessageComplete, async() => {
                    socket.off('data', onSocketData)

                    try {
                        client = await client
                    }
                    catch (e) {
                        return
                    }

                    client.on('error', () => shouldKeepAlive ? null : socket.end())
                    socket.on('error', () => client.end())

                    this.writeConnectionEstablished(socket)

                    client.pipe(socket, { end: !shouldKeepAlive })
                    socket.pipe(client, { end: true })
                })

                try {
                    client = await client
                }
                catch (e) {
                    this.emit('error', e)

                    return this.writeBadGateway(socket)
                }
            }
            else {
                method = methods[method]

                const { hostname, port, path } = url.parse(uri)

                let client = this.getClient(hostname || this.getHttpHeader(headers, 'host'), port ? parseInt(port) : 80, context)

                requestParser.on(kOnBody, async(buffer, start, len) => {
                    try {
                        client = await client
                    }
                    catch (e) {
                        return
                    }

                    client.write(buffer.slice(start, start + len))
                })

                requestParser.once(kOnMessageComplete, async() => {
                    try {
                        client = await client
                    }
                    catch (e) {
                        return
                    }

                    client.end()
                })

                try {
                    client = await client
                }
                catch (e) {
                    this.emit('error', e)

                    return this.writeBadGateway(socket)
                }

                client.on('error', () => shouldKeepAlive ? null : socket.end())
                socket.on('error', () => client.end())

                this.writeRequestLine(client, method, path || '/', versionMajor, versionMinor)
                this.writeHeaders(client, headers)

                const responseParser = this.createHttpResponseParser()

                const onClientData = (data) => {
                    responseParser.execute(data)
                }

                responseParser.once(kOnHeadersComplete, (info) => {
                    let { versionMajor, versionMinor, headers, method, url: uri, statusCode, statusMessage, upgrade, shouldKeepAlive } = info

                    this.writeResponseLine(socket, versionMajor, versionMinor, statusCode, statusMessage)
                    this.writeHeaders(socket, headers)

                    const isChunked = /chunked/i.test(this.getHttpHeader(headers, 'transfer-encoding'))

                    responseParser.on(kOnBody, (buffer, start, len) => {
                        buffer = buffer.slice(start, start + len)

                        if (isChunked) {
                            socket.write(`${buffer.length.toString(16)}\r\n`)
                            socket.write(buffer)
                            socket.write('\r\n')
                        }
                        else {
                            socket.write(buffer)
                        }
                    })

                    responseParser.once(kOnMessageComplete, () => {
                        client.off('data', onClientData)

                        if (isChunked) {
                            socket.write('0\r\n\r\n')
                        }

                        if (!shouldKeepAlive) {
                            socket.end()
                        }
                    })
                })

                client.on('data', onClientData)
            }
        })

        socket.on('data', onSocketData)

        socket.resume()
    }

    onConnectionHandler(socket) {
        socket.once('data', (sniff) => {
            socket.pause()
            socket.unshift(sniff)

            if (sniff[0] >= 0x41 && sniff[0] <= 0x5a || sniff[0] >= 0x61 && sniff[0] <= 0x7a) {
                this.onHttpConnectionHandler(socket)
            }
            else {
                socket.end()
            }
        })
    }

    listen(options) {
        return new Promise((resolve, reject) => {
            super.listen(options, (err) => {
                if (err) {
                    reject(err)
                }
                else {
                    resolve(this)
                }
            })
        })
    }
}

module.exports = PureProxy
