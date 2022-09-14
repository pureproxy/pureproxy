/// <reference types="node" />
export class HTTPParserEmitter extends BufferedEmitter {
    constructor(type: any);
    parser: any;
    execute(...args: any[]): void;
}
export class PureProxy extends net.Server {
    constructor(options?: {});
    onHttpConnectionHandler(socket: any): void;
    onConnectionHandler(socket: any): void;
    writeConnectionEstablished(socket: any): void;
    writeInternalServerError(socket: any): void;
    writeBadGateway(socket: any): void;
    writeRequestLine(socket: any, method: any, path: any, versionMajor: any, versionMinor: any): void;
    writeResponseLine(socket: any, versionMajor: any, versionMinor: any, statusCode: any, statusMessage: any): void;
    writeHeaders(socket: any, headers: any): void;
    createHttpRequestParser(): HTTPParserEmitter;
    createHttpResponseParser(): HTTPParserEmitter;
    getHttpHeader(headers: any, name: any): any;
    getClient(hostname: any, port: any): Promise<any>;
    listen(options: any): Promise<any>;
}
export default PureProxy;
import { BufferedEmitter } from "./emitter.js";
import net from "net";
