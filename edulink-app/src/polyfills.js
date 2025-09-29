// Browser polyfills for Node.js modules - must run first
(function() {
    // More comprehensive util polyfill
    const util = {
        debuglog: function(section) {
            return function() {
                // In development, log to console, in production be silent
                if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
                    console.log.apply(console, arguments);
                }
            };
        },
        inspect: function(obj, options) {
            if (obj === null) return 'null';
            if (obj === undefined) return 'undefined';
            if (typeof obj === 'string') return JSON.stringify(obj);
            if (typeof obj === 'function') return obj.toString();
            try {
                return JSON.stringify(obj, null, options && options.depth ? 2 : null);
            } catch (e) {
                return '[Circular]';
            }
        },
        format: function() {
            return Array.prototype.slice.call(arguments).join(' ');
        },
        deprecate: function(fn, msg) {
            return function() {
                console.warn('DEPRECATED:', msg);
                return fn.apply(this, arguments);
            };
        }
    };

    // Global polyfills for browser compatibility
    if (typeof globalThis.global === 'undefined') {
        globalThis.global = globalThis;
    }

    if (typeof globalThis.process === 'undefined') {
        globalThis.process = {
            env: { NODE_ENV: 'development' },
            browser: true,
            version: 'v16.0.0',
            versions: { node: '16.0.0' },
            nextTick: function(fn) { setTimeout(fn, 0); },
            platform: 'browser',
            cwd: function() { return '/'; },
            exit: function() {},
            stdout: { write: console.log },
            stderr: { write: console.error }
        };
    }

    // Buffer polyfill for simple-peer
    if (typeof globalThis.Buffer === 'undefined') {
        globalThis.Buffer = {
            isBuffer: (obj) => obj instanceof Uint8Array,
            from: (data, encoding) => {
                if (typeof data === 'string') {
                    return new TextEncoder().encode(data);
                }
                return new Uint8Array(data);
            },
            alloc: (size, fill) => {
                const buf = new Uint8Array(size);
                if (fill !== undefined) buf.fill(fill);
                return buf;
            },
            allocUnsafe: (size) => new Uint8Array(size),
            concat: (buffers, totalLength) => {
                const result = new Uint8Array(totalLength || buffers.reduce((acc, buf) => acc + buf.length, 0));
                let offset = 0;
                for (const buf of buffers) {
                    result.set(buf, offset);
                    offset += buf.length;
                }
                return result;
            }
        };
    }

    // EventEmitter polyfill
    if (typeof globalThis.EventEmitter === 'undefined') {
        class EventEmitter {
            constructor() {
                this._events = {};
                this._maxListeners = 10;
            }
            
            on(event, listener) {
                if (!this._events[event]) this._events[event] = [];
                this._events[event].push(listener);
                return this;
            }
            
            emit(event, ...args) {
                if (!this._events[event]) return false;
                this._events[event].forEach(listener => {
                    try {
                        listener(...args);
                    } catch (error) {
                        console.error('EventEmitter error:', error);
                    }
                });
                return true;
            }
            
            removeListener(event, listener) {
                if (!this._events[event]) return this;
                this._events[event] = this._events[event].filter(l => l !== listener);
                return this;
            }

            removeAllListeners(event) {
                if (event) {
                    delete this._events[event];
                } else {
                    this._events = {};
                }
                return this;
            }
        }
        globalThis.EventEmitter = EventEmitter;
    }

    // Set util polyfill
    globalThis.util = util;

    // Make these available on window as well for compatibility
    if (typeof window !== 'undefined') {
        window.global = globalThis.global;
        window.process = globalThis.process;
        window.Buffer = globalThis.Buffer;
        window.EventEmitter = globalThis.EventEmitter;
        window.util = globalThis.util;
    }
})();