import { EventEmitter } from 'events'

export class BufferedEmitter extends EventEmitter {
  constructor() {
    super()

    this.bufferedEvents = []

    this.on('newListener', (event, listener) => {
      let i = 0

      for (; i < this.bufferedEvents.length; i++) {
        const nextEvent = this.bufferedEvents[i]

        if (event === nextEvent.event) {
          listener(...nextEvent.args)
        } else {
          break
        }
      }

      this.bufferedEvents = this.bufferedEvents.slice(i)
    })
  }

  emit(event, ...args) {
    if (this.listenerCount(event) > 0) {
      return super.emit(event, ...args)
    } else {
      this.bufferedEvents.push({ event, args })

      return true
    }
  }
}
