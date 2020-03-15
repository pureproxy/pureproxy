[![Follow on Twitter](https://img.shields.io/twitter/follow/pdp.svg?logo=twitter)](https://twitter.com/pdp)
[![NPM](https://img.shields.io/npm/v/@pureproxy/pureproxy.svg)](https://www.npmjs.com/package/@pureproxy/pureproxy)

# PureProxy

PureProxy is a simple but very flexible, streaming proxy server. The main purpose of this server is to be used as a base building block for other proxy servers, such as [mitmproxy](https://github.com/pureproxy/mitmproxy).

## How To Install

You need to install this library as a dependency like this:

```
$ npm install @pureproxy/pureproxy
```

## How To Use

The following code starts the proxy server as is:

```javascript
const PureProxy = require('@pureproxy/pureproxy')

const server = new PureProxy()

server.listen(8080)
```

Add additional features by extending the ProxyServer class:

```javascript
const stream = require('stream')
const PureProxy = require('@pureproxy/pureproxy')

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
```

## FAQ

**Q: What is the point of this?** - Believe it or not, there is a lack of simple proxy servers for Node. I did look around and either all of them were way too complicated for their own good or they had a number of issues impossible to resolve without some serious time investment.

**Q: Why the weird API?** - The server is based around Node's streaming API. Sockets in Node are Duplex streams. Data is never cached, buffered or transformed as it passes the stream. In order to manipulate or observe the stream we simply need to create Duplex streams hence why the API may look a bit weird.

**Q: How fast is it?** - Have a look at the code. It is as fast as it practically possible. This module has no external dependencies and relies on Node's native bindings. You can easily use the Node's cluster API to scale it to as many CPU cores as you have.

**Q: How stable is it?** - This project is relatively young but so far there are no issues. It is unlikely to see any significant issues due to the size of the library. It is tiny.

**Q: Can I intercept TLS/SSL?** - You can intercept any traffic but it will be encrypted and compressed (i.e. raw). To intercept the traffic in clear text use mitmproxy which is based on this project.
