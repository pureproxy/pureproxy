import PureProxy from '../lib/index.js'

const server = new PureProxy()

server
  .listen(8080)
  .then(() => {
    console.log(`Listening on 8080`)
  })
  .catch(console.error)
