import stream from 'stream'

import PureProxy from '../lib/index.js'

const server = new (class extends PureProxy {
  async getClient(hostname, port, context) {
    // get the original client

    const client = await super.getClient(hostname, port, context)

    // return a duplex stream (like sockets) to monitor all data in transit

    return new (class extends stream.Duplex {
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
    })()
  }
})()

server
  .listen(8080)
  .then(() => {
    console.log(`Listening on 8080`)
  })
  .catch(console.error)
