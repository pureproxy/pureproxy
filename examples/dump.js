const stream = require('stream')

const PureProxy = require('../lib/index')

const server = new class extends PureProxy {
    getClient(hostname, port, context) {
        // get the original client

        const client = super.getClient(hostname, port, context)

        // return a duplex stream (like sockets) to monitor all data in transit

        return new class extends stream.Duplex {
            constructor() {
                super()

                client.on('data', (data) => {
                    // log incoming data

                    console.log('<<<', data)

                    this.push(data)
                })
            }

            _write(data, encoding, callback) {
                // log outgoing data

                console.log('>>>', data)

                client.write(data)

                callback()
            }

            _read() {}
        }
    }
}

server.listen(8080)
