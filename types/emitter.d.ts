export class BufferedEmitter extends EventEmitter {
    constructor();
    bufferedEvents: any[];
    emit(event: any, ...args: any[]): boolean;
}
import { EventEmitter } from "events";
