/// <reference types="node" />
import type perftools from 'pprof/proto/profile';
import 'regenerator-runtime/runtime';
declare type TagList = Record<string, any>;
export interface PyroscopeConfig {
    serverAddress?: string;
    appName: string;
    sourceMapPath?: string[];
    sm?: any;
    tags: TagList;
    authToken?: string;
    basicAuthUser?: string;
    basicAuthPassword?: string;
    tenantID?: string;
    configured: boolean;
}
export declare function init(c?: Partial<PyroscopeConfig>): void;
export declare const processProfile: (profile: perftools.perftools.profiles.IProfile) => perftools.perftools.profiles.IProfile | undefined;
export declare function collectCpu(seconds?: number): Promise<Buffer>;
export declare function collectHeap(): Promise<Buffer>;
export declare function startWallProfiling(): void;
export declare function stopWallProfiling(): void;
export declare function start(): void;
export declare function stop(): void;
export declare function startHeapCollecting(): void;
export declare function startHeapProfiling(): void;
export declare function stopHeapCollecting(): void;
export declare function stopHeapProfiling(): void;
export declare const startCpuProfiling: typeof startWallProfiling;
export declare const stopCpuProfiling: typeof stopWallProfiling;
import expressMiddleware from './express.js';
export { expressMiddleware };
declare const _default: {
    init: typeof init;
    startCpuProfiling: typeof startWallProfiling;
    stopCpuProfiling: typeof stopWallProfiling;
    startWallProfiling: typeof startWallProfiling;
    stopWallProfiling: typeof stopWallProfiling;
    startHeapProfiling: typeof startHeapProfiling;
    stopHeapProfiling: typeof stopHeapProfiling;
    collectCpu: typeof collectCpu;
    collectWall: typeof collectCpu;
    collectHeap: typeof collectHeap;
    startHeapCollecting: typeof startHeapCollecting;
    stopHeapCollecting: typeof stopHeapCollecting;
    start: typeof start;
    stop: typeof stop;
    expressMiddleware: typeof expressMiddleware;
};
export default _default;