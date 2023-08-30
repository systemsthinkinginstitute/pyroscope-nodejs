"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressMiddleware = exports.stopCpuProfiling = exports.startCpuProfiling = exports.stopHeapProfiling = exports.stopHeapCollecting = exports.startHeapProfiling = exports.startHeapCollecting = exports.stop = exports.start = exports.stopWallProfiling = exports.startWallProfiling = exports.collectHeap = exports.collectCpu = exports.processProfile = exports.init = void 0;
const pprof = __importStar(require("pprof"));
const debug_1 = __importDefault(require("debug"));
const form_data_1 = __importDefault(require("form-data"));
require("regenerator-runtime/runtime");
const log = (0, debug_1.default)('pyroscope');
const cloudHostnameSuffix = 'pyroscope.cloud';
// The Interval in which samples should be collected.
const SAMPLING_INTERVAL_MS = process.env['PYROSCOPE_SAMPLING_INTERVAL'] || 10; // in milliseconds // e.g. 10ms will be equivalent to a frequency of 100Hz
// The Duration for which a sample should be collected.
const SAMPLING_DURATION_MS = process.env['PYROSCOPE_SAMPLING_DURATION'] || 10000; // in milliseconds
const config = {
    serverAddress: process.env['PYROSCOPE_SERVER_ADDRESS'],
    appName: process.env['PYROSCOPE_APPLICATION_NAME'] || '',
    sm: undefined,
    tags: {},
    authToken: process.env['PYROSCOPE_AUTH_TOKEN'],
    basicAuthUser: process.env['PYROSCOPE_BASIC_AUTH_USER'],
    basicAuthPassword: process.env['PYROSCOPE_BASIC_AUTH_PASSWORD'],
    tenantID: process.env['PYROSCOPE_TENANT_ID'],
    configured: false,
};
function init(c = {}) {
    config.serverAddress = c.serverAddress || config.serverAddress;
    const adhocAddress = process.env['PYROSCOPE_ADHOC_SERVER_ADDRESS'] || '';
    if (adhocAddress.length > 0) {
        log(`Overwriting serverAddress with ${adhocAddress}`);
        config.serverAddress = adhocAddress;
    }
    config.appName = c.appName || config.appName;
    config.sourceMapPath = c.sourceMapPath || config.sourceMapPath;
    config.authToken = c.authToken || config.authToken;
    config.basicAuthUser = c.basicAuthUser || config.basicAuthUser;
    config.basicAuthPassword = c.basicAuthPassword || config.basicAuthPassword;
    config.tenantID = c.tenantID || config.tenantID;
    config.tags = c.tags || config.tags;
    if (!!config.sourceMapPath) {
        pprof.SourceMapper.create(config.sourceMapPath)
            .then((sm) => (config.sm = sm))
            .catch((e) => {
            log(e);
        });
    }
    if (config.serverAddress &&
        config.serverAddress?.indexOf(cloudHostnameSuffix) !== -1 &&
        !config.authToken) {
        log('Pyroscope is running on a cloud server, but no authToken was provided. Pyroscope will not be able to ingest data.');
        return;
    }
    config.configured = true;
}
exports.init = init;
function handleError(error) {
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        log('Pyroscope received error while ingesting data to server');
        log(error.response.data);
    }
    else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        log('Error when ingesting data to server:', error.message);
    }
    else {
        // Something happened in setting up the request that triggered an Error
        log('Error', error.message);
    }
}
const processProfile = (profile) => {
    const replacements = {
        objects: 'inuse_objects',
        space: 'inuse_space',
        sample: 'samples',
    };
    // Replace the names of the samples to meet golang naming
    const newStringTable = profile.stringTable
        ?.slice(0, 5)
        .map((s) => (replacements[s] ? replacements[s] : s))
        .concat(profile.stringTable?.slice(5));
    // Inject line numbers and file names into symbols table
    const newProfile = profile.location?.reduce((a, location) => {
        // location -> function -> name
        if (location && location.line && a.stringTable) {
            const functionId = location.line[0]?.functionId;
            // Find the function name
            const functionCtx = a.function?.find((x) => x.id == functionId);
            // Store the new position of injected function name
            const newNameId = a.stringTable.length;
            // Get the function name
            const functionName = a.stringTable[Number(functionCtx?.name)];
            if (functionName.indexOf(':') === -1) {
                // Build a new name by concatenating the file name and line number
                const newName = `${a.stringTable[Number(functionCtx?.filename)]}:${a.stringTable[Number(functionCtx?.name)]}:${location?.line[0].line}`.replace(process.cwd(), '.');
                // Store the new name
                if (functionCtx) {
                    functionCtx.name = newNameId;
                }
                // Update profile string table with the new name and location
                return {
                    ...a,
                    location: [...(a.location || [])],
                    stringTable: [...(a.stringTable || []), newName],
                };
            }
            else {
                return a;
            }
        }
        return {};
    }, {
        ...profile,
        stringTable: newStringTable,
    });
    return newProfile;
};
exports.processProfile = processProfile;
async function uploadProfile(profile) {
    // Apply labels to all samples
    const newProfile = (0, exports.processProfile)(profile);
    if (newProfile) {
        const buf = await pprof.encode(newProfile);
        const formData = new form_data_1.default();
        formData.append('profile', buf, {
            knownLength: buf.byteLength,
            contentType: 'text/json',
            filename: 'profile',
        });
        const tagList = config.tags
            ? Object.keys(config.tags).map((t) => `${encodeURIComponent(t)}=${encodeURIComponent(config.tags[t])}`)
            : '';
        let serverAddress = config.serverAddress;
        if (serverAddress?.endsWith('/')) {
            serverAddress = serverAddress.slice(0, -1);
        }
        const url = `${serverAddress}/ingest?name=${encodeURIComponent(config.appName)}{${tagList}}&sampleRate=${1000 / Number(SAMPLING_INTERVAL_MS)}&spyName=nodespy`; // 1000, because our sample rate is in milliseconds
        log(`Sending data to ${url}`);
        // send data to the server
        const headers = formData.getHeaders();
        if (config.authToken) {
            headers['Authorization'] = `Bearer ${config.authToken}`;
        }
        if (config.tenantID) {
            headers['X-Scope-OrgID'] = config.tenantID;
        }
        if (config.basicAuthUser && config.basicAuthPassword) {
            headers.set('Authorization', 'Basic ' + Buffer.from(config.basicAuthUser + ":" + config.basicAuthPassword).toString('base64'));
        }
        headers['Transfer-Encoding'] = 'chunked';
        return fetch(url, {
            method: 'POST',
            body: formData,
            headers,
        });
    }
}
// Could be false or a function to stop heap profiling
let heapProfilingTimer = undefined;
let isWallProfilingRunning = false;
async function collectCpu(seconds) {
    if (!config.configured) {
        throw 'Pyroscope is not configured. Please call init() first.';
    }
    try {
        const profile = await pprof.time.profile({
            lineNumbers: true,
            sourceMapper: config.sm,
            durationMillis: (seconds || 10) * 1000 || Number(SAMPLING_DURATION_MS),
            intervalMicros: Number(SAMPLING_INTERVAL_MS) * 1000, // https://github.com/google/pprof-nodejs/blob/0eabf2d9a4e13456e642c41786fcb880a9119f28/ts/src/time-profiler.ts#L37-L38
        });
        const newProfile = (0, exports.processProfile)(profile);
        if (newProfile) {
            return pprof.encode(newProfile);
        }
        else {
            return Buffer.from('', 'utf8');
        }
    }
    catch (e) {
        log(e);
        return Buffer.from('', 'utf8');
    }
}
exports.collectCpu = collectCpu;
async function collectHeap() {
    if (!config.configured) {
        throw 'Pyroscope is not configured. Please call init() first.';
    }
    log('Collecting heap...');
    const profile = pprof.heap.profile(undefined, config.sm);
    const newProfile = (0, exports.processProfile)(profile);
    if (newProfile) {
        return pprof.encode(newProfile);
    }
    else {
        return Buffer.from('', 'utf8');
    }
}
exports.collectHeap = collectHeap;
function checkConfigured() {
    if (!config.configured) {
        throw 'Pyroscope is not configured. Please call init() first.';
    }
    if (!config.serverAddress) {
        throw 'Please set the server address in the init()';
    }
    if (!config.appName) {
        throw 'Please define app name in the init()';
    }
}
function startWallProfiling() {
    checkConfigured();
    log('Pyroscope has started CPU Profiling');
    isWallProfilingRunning = true;
    const profilingRound = () => {
        log('Collecting CPU Profile');
        pprof.time
            .profile({
            lineNumbers: true,
            sourceMapper: config.sm,
            durationMillis: Number(SAMPLING_DURATION_MS),
            intervalMicros: Number(SAMPLING_INTERVAL_MS) * 1000,
        })
            .then((profile) => {
            log('CPU Profile collected');
            if (isWallProfilingRunning) {
                setImmediate(profilingRound);
            }
            log('CPU Profile uploading');
            return uploadProfile(profile);
        })
            .then((d) => {
            log('CPU Profile has been uploaded');
        })
            .catch((e) => {
            log(e);
        });
    };
    profilingRound();
}
exports.startWallProfiling = startWallProfiling;
// It doesn't stop it immediately, just wait until it ends
function stopWallProfiling() {
    isWallProfilingRunning = false;
}
exports.stopWallProfiling = stopWallProfiling;
function start() {
    (0, exports.startCpuProfiling)();
    startHeapProfiling();
}
exports.start = start;
function stop() {
    (0, exports.stopCpuProfiling)();
    stopHeapProfiling();
}
exports.stop = stop;
let isHeapCollectingStarted = false;
function startHeapCollecting() {
    if (!config.configured) {
        throw 'Pyroscope is not configured. Please call init() first.';
    }
    if (isHeapCollectingStarted) {
        log('Heap collecting is already started');
        return;
    }
    const intervalBytes = 1024 * 512;
    const stackDepth = 32;
    log('Pyroscope has started heap profiling');
    pprof.heap.start(intervalBytes, stackDepth);
    isHeapCollectingStarted = true;
}
exports.startHeapCollecting = startHeapCollecting;
function startHeapProfiling() {
    checkConfigured();
    if (heapProfilingTimer) {
        log('Pyroscope has already started heap profiling');
        return;
    }
    startHeapCollecting();
    heapProfilingTimer = setInterval(() => {
        log('Collecting heap profile');
        const profile = pprof.heap.profile(undefined, config.sm);
        log('Heap profile collected...');
        uploadProfile(profile).then(() => log('Heap profile uploaded...'));
    }, Number(SAMPLING_DURATION_MS));
}
exports.startHeapProfiling = startHeapProfiling;
function stopHeapCollecting() {
    pprof.heap.stop();
    isHeapCollectingStarted = false;
}
exports.stopHeapCollecting = stopHeapCollecting;
function stopHeapProfiling() {
    if (heapProfilingTimer) {
        log('Stopping heap profiling');
        clearInterval(heapProfilingTimer);
        heapProfilingTimer = undefined;
        stopHeapCollecting();
    }
}
exports.stopHeapProfiling = stopHeapProfiling;
exports.startCpuProfiling = startWallProfiling;
exports.stopCpuProfiling = stopWallProfiling;
const express_js_1 = __importDefault(require("./express.js"));
exports.expressMiddleware = express_js_1.default;
exports.default = {
    init,
    startCpuProfiling: startWallProfiling,
    stopCpuProfiling: stopWallProfiling,
    startWallProfiling,
    stopWallProfiling,
    startHeapProfiling,
    stopHeapProfiling,
    collectCpu,
    collectWall: collectCpu,
    collectHeap,
    startHeapCollecting,
    stopHeapCollecting,
    start,
    stop,
    expressMiddleware: express_js_1.default,
};
