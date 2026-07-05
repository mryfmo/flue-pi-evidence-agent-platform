import { createRequire } from "node:module";
import { createServer } from "node:http";
import { sqlite } from "@flue/runtime/node";
import { Bash, InMemoryFs, bashFactoryToSessionEnv, configureFlueRuntime, createFlueContext, createNodeAgentCoordinator, createNodeDispatchQueue, generateWorkflowRunId, invokeDirectAttached, invokeWorkflowAttached, resolveModel } from "@flue/runtime/internal";
import { Type, createAgent, defineTool, observe, registerProvider } from "@flue/runtime";
import { appendFile, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { ConnectionConfig, Sandbox } from "@alibaba-group/opensandbox";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { createOpenTelemetryObserver } from "@flue/opentelemetry";
import { flue } from "@flue/runtime/routing";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region \0virtual:flue/packaged-skills
var packagedSkills$1 = /* @__PURE__ */ new Map();
function getPackagedSkills() {
	return Object.fromEntries(packagedSkills$1);
}
//#endregion
//#region node_modules/@hono/node-server/dist/constants-BXAKTxRC.cjs
var require_constants_BXAKTxRC = /* @__PURE__ */ __commonJSMin(((exports) => {
	var X_ALREADY_SENT = "x-hono-already-sent";
	Object.defineProperty(exports, "X_ALREADY_SENT", {
		enumerable: true,
		get: function() {
			return X_ALREADY_SENT;
		}
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/helper/websocket/index.js
var require_websocket = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var websocket_exports = {};
	__export(websocket_exports, {
		WSContext: () => WSContext,
		createWSMessageEvent: () => createWSMessageEvent,
		defineWebSocketHelper: () => defineWebSocketHelper
	});
	module.exports = __toCommonJS(websocket_exports);
	var WSContext = class {
		#init;
		constructor(init) {
			this.#init = init;
			this.raw = init.raw;
			this.url = init.url ? new URL(init.url) : null;
			this.protocol = init.protocol ?? null;
		}
		send(source, options) {
			this.#init.send(source, options ?? {});
		}
		raw;
		binaryType = "arraybuffer";
		get readyState() {
			return this.#init.readyState;
		}
		url;
		protocol;
		close(code, reason) {
			this.#init.close(code, reason);
		}
	};
	var createWSMessageEvent = (source) => {
		return new MessageEvent("message", { data: source });
	};
	var defineWebSocketHelper = (handler) => {
		return ((...args) => {
			if (typeof args[0] === "function") {
				const [createEvents, options] = args;
				return async function upgradeWebSocket(c, next) {
					const result = await handler(c, await createEvents(c), options);
					if (result) return result;
					await next();
				};
			} else {
				const [c, events, options] = args;
				return (async () => {
					const upgraded = await handler(c, events, options);
					if (!upgraded) throw new Error("Failed to upgrade WebSocket");
					return upgraded;
				})();
			}
		});
	};
	0 && (module.exports = {
		WSContext,
		createWSMessageEvent,
		defineWebSocketHelper
	});
}));
//#endregion
//#region src/agents/remediator.ts
var import_dist = (/* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	var require_constants$2 = require_constants_BXAKTxRC();
	var node_http = __require("node:http");
	var node_http2 = __require("node:http2");
	var node_stream = __require("node:stream");
	var hono_ws = require_websocket();
	var RequestError = class extends Error {
		constructor(message, options) {
			super(message, options);
			this.name = "RequestError";
		}
	};
	var reValidRequestUrl = /^\/[!#$&-;=?-\[\]_a-z~]*$/;
	var reDotSegment = /\/\.\.?(?:[/?#]|$)/;
	var reValidHost = /^[a-z0-9._-]+(?::(?:[1-5]\d{3,4}|[6-9]\d{3}))?$/;
	var buildUrl = (scheme, host, incomingUrl) => {
		const url = `${scheme}://${host}${incomingUrl}`;
		if (!reValidHost.test(host)) {
			const urlObj = new URL(url);
			if (urlObj.hostname.length !== host.length && urlObj.hostname !== (host.includes(":") ? host.replace(/:\d+$/, "") : host).toLowerCase()) throw new RequestError("Invalid host header");
			return urlObj.href;
		} else if (incomingUrl.length === 0) return url + "/";
		else {
			if (incomingUrl.charCodeAt(0) !== 47) throw new RequestError("Invalid URL");
			if (!reValidRequestUrl.test(incomingUrl) || reDotSegment.test(incomingUrl)) return new URL(url).href;
			return url;
		}
	};
	var toRequestError = (e) => {
		if (e instanceof RequestError) return e;
		return new RequestError(e.message, { cause: e });
	};
	var GlobalRequest = global.Request;
	var Request$1 = class extends GlobalRequest {
		constructor(input, options) {
			if (typeof input === "object" && getRequestCache in input) {
				const hasReplacementBody = options !== void 0 && "body" in options && options.body != null;
				if (input[bodyConsumedDirectlyKey] && !hasReplacementBody) throw new TypeError("Cannot construct a Request with a Request object that has already been used.");
				input = input[getRequestCache]();
			}
			if (typeof (options?.body)?.getReader !== "undefined") options.duplex ??= "half";
			super(input, options);
		}
	};
	var newHeadersFromIncoming = (incoming) => {
		const headerRecord = [];
		const rawHeaders = incoming.rawHeaders;
		for (let i = 0, len = rawHeaders.length; i < len; i += 2) {
			const key = rawHeaders[i];
			if (key.charCodeAt(0) !== 58) headerRecord.push([key, rawHeaders[i + 1]]);
		}
		return new Headers(headerRecord);
	};
	var wrapBodyStream = Symbol("wrapBodyStream");
	var newRequestFromIncoming = (method, url, headers, incoming, abortController) => {
		const init = {
			method,
			headers,
			signal: abortController.signal
		};
		if (method === "TRACE") {
			init.method = "GET";
			const req = new Request$1(url, init);
			Object.defineProperty(req, "method", { get() {
				return "TRACE";
			} });
			return req;
		}
		if (!(method === "GET" || method === "HEAD")) if ("rawBody" in incoming && incoming.rawBody instanceof Buffer) init.body = new ReadableStream({ start(controller) {
			controller.enqueue(incoming.rawBody);
			controller.close();
		} });
		else if (incoming[wrapBodyStream]) {
			let reader;
			init.body = new ReadableStream({ async pull(controller) {
				try {
					reader ||= node_stream.Readable.toWeb(incoming).getReader();
					const { done, value } = await reader.read();
					if (done) controller.close();
					else controller.enqueue(value);
				} catch (error) {
					controller.error(error);
				}
			} });
		} else init.body = node_stream.Readable.toWeb(incoming);
		return new Request$1(url, init);
	};
	var getRequestCache = Symbol("getRequestCache");
	var requestCache = Symbol("requestCache");
	var incomingKey = Symbol("incomingKey");
	var urlKey = Symbol("urlKey");
	var methodKey = Symbol("methodKey");
	var headersKey = Symbol("headersKey");
	var abortControllerKey = Symbol("abortControllerKey");
	var getAbortController = Symbol("getAbortController");
	var abortRequest = Symbol("abortRequest");
	var bodyBufferKey = Symbol("bodyBuffer");
	var bodyReadPromiseKey = Symbol("bodyReadPromise");
	var bodyConsumedDirectlyKey = Symbol("bodyConsumedDirectly");
	var bodyLockReaderKey = Symbol("bodyLockReader");
	var abortReasonKey = Symbol("abortReason");
	var newBodyUnusableError = () => {
		return /* @__PURE__ */ new TypeError("Body is unusable");
	};
	var rejectBodyUnusable = () => {
		return Promise.reject(newBodyUnusableError());
	};
	var textDecoder = new TextDecoder();
	var consumeBodyDirectOnce = (request) => {
		if (request[bodyConsumedDirectlyKey]) return rejectBodyUnusable();
		request[bodyConsumedDirectlyKey] = true;
	};
	var toArrayBuffer = (buf) => {
		return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	};
	var contentType = (request) => {
		return (request[headersKey] ||= newHeadersFromIncoming(request[incomingKey])).get("content-type") || "";
	};
	var methodTokenRegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
	var normalizeIncomingMethod = (method) => {
		if (typeof method !== "string" || method.length === 0) return "GET";
		switch (method) {
			case "DELETE":
			case "GET":
			case "HEAD":
			case "OPTIONS":
			case "POST":
			case "PUT": return method;
		}
		const upper = method.toUpperCase();
		switch (upper) {
			case "DELETE":
			case "GET":
			case "HEAD":
			case "OPTIONS":
			case "POST":
			case "PUT": return upper;
			default: return method;
		}
	};
	var validateDirectReadMethod = (method) => {
		if (!methodTokenRegExp.test(method)) return /* @__PURE__ */ new TypeError(`'${method}' is not a valid HTTP method.`);
		const normalized = method.toUpperCase();
		if (normalized === "CONNECT" || normalized === "TRACK" || normalized === "TRACE" && method !== "TRACE") return /* @__PURE__ */ new TypeError(`'${method}' HTTP method is unsupported.`);
	};
	var readBodyWithFastPath = (request, method, fromBuffer) => {
		if (request[bodyConsumedDirectlyKey]) return rejectBodyUnusable();
		const methodName = request.method;
		if (methodName === "GET" || methodName === "HEAD") return request[getRequestCache]()[method]();
		const methodValidationError = validateDirectReadMethod(methodName);
		if (methodValidationError) return Promise.reject(methodValidationError);
		if (request[requestCache]) {
			if (methodName !== "TRACE") return request[requestCache][method]();
		}
		const alreadyUsedError = consumeBodyDirectOnce(request);
		if (alreadyUsedError) return alreadyUsedError;
		const raw = readRawBodyIfAvailable(request);
		if (raw) {
			const result = Promise.resolve(fromBuffer(raw, request));
			request[bodyBufferKey] = void 0;
			return result;
		}
		return readBodyDirect(request).then((buf) => {
			const result = fromBuffer(buf, request);
			request[bodyBufferKey] = void 0;
			return result;
		});
	};
	var readRawBodyIfAvailable = (request) => {
		const incoming = request[incomingKey];
		if ("rawBody" in incoming && incoming.rawBody instanceof Buffer) return incoming.rawBody;
	};
	var readBodyDirect = (request) => {
		if (request[bodyBufferKey]) return Promise.resolve(request[bodyBufferKey]);
		if (request[bodyReadPromiseKey]) return request[bodyReadPromiseKey];
		const incoming = request[incomingKey];
		if (node_stream.Readable.isDisturbed(incoming)) return rejectBodyUnusable();
		const promise = new Promise((resolve, reject) => {
			const chunks = [];
			let settled = false;
			const finish = (callback) => {
				if (settled) return;
				settled = true;
				cleanup();
				callback();
			};
			const onData = (chunk) => {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			};
			const onEnd = () => {
				finish(() => {
					const buffer = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
					request[bodyBufferKey] = buffer;
					resolve(buffer);
				});
			};
			const onError = (error) => {
				finish(() => {
					reject(error);
				});
			};
			const onClose = () => {
				if (incoming.readableEnded) {
					onEnd();
					return;
				}
				finish(() => {
					if (incoming.errored) {
						reject(incoming.errored);
						return;
					}
					const reason = request[abortReasonKey];
					if (reason !== void 0) {
						reject(reason instanceof Error ? reason : new Error(String(reason)));
						return;
					}
					reject(/* @__PURE__ */ new Error("Client connection prematurely closed."));
				});
			};
			const cleanup = () => {
				incoming.off("data", onData);
				incoming.off("end", onEnd);
				incoming.off("error", onError);
				incoming.off("close", onClose);
				request[bodyReadPromiseKey] = void 0;
			};
			incoming.on("data", onData);
			incoming.on("end", onEnd);
			incoming.on("error", onError);
			incoming.on("close", onClose);
			queueMicrotask(() => {
				if (settled) return;
				if (incoming.readableEnded) onEnd();
				else if (incoming.errored) onError(incoming.errored);
				else if (incoming.destroyed) onClose();
			});
		});
		request[bodyReadPromiseKey] = promise;
		return promise;
	};
	var requestPrototype = {
		get method() {
			return this[methodKey];
		},
		get url() {
			return this[urlKey];
		},
		get headers() {
			return this[headersKey] ||= newHeadersFromIncoming(this[incomingKey]);
		},
		[abortRequest](reason) {
			if (this[abortReasonKey] === void 0) this[abortReasonKey] = reason;
			const abortController = this[abortControllerKey];
			if (abortController && !abortController.signal.aborted) abortController.abort(reason);
		},
		[getAbortController]() {
			this[abortControllerKey] ||= new AbortController();
			if (this[abortReasonKey] !== void 0 && !this[abortControllerKey].signal.aborted) this[abortControllerKey].abort(this[abortReasonKey]);
			return this[abortControllerKey];
		},
		[getRequestCache]() {
			const abortController = this[getAbortController]();
			if (this[requestCache]) return this[requestCache];
			const method = this.method;
			if (this[bodyConsumedDirectlyKey] && !(method === "GET" || method === "HEAD")) {
				this[bodyBufferKey] = void 0;
				const init = {
					method: method === "TRACE" ? "GET" : method,
					headers: this.headers,
					signal: abortController.signal
				};
				if (method !== "TRACE") {
					init.body = new ReadableStream({ start(c) {
						c.close();
					} });
					init.duplex = "half";
				}
				const req = new Request$1(this[urlKey], init);
				if (method === "TRACE") Object.defineProperty(req, "method", { get() {
					return "TRACE";
				} });
				return this[requestCache] = req;
			}
			return this[requestCache] = newRequestFromIncoming(this.method, this[urlKey], this.headers, this[incomingKey], abortController);
		},
		get body() {
			if (!this[bodyConsumedDirectlyKey]) return this[getRequestCache]().body;
			const request = this[getRequestCache]();
			if (!this[bodyLockReaderKey] && request.body) this[bodyLockReaderKey] = request.body.getReader();
			return request.body;
		},
		get bodyUsed() {
			if (this[bodyConsumedDirectlyKey]) return true;
			if (this[requestCache]) return this[requestCache].bodyUsed;
			return false;
		}
	};
	Object.defineProperty(requestPrototype, "signal", { get() {
		return this[getAbortController]().signal;
	} });
	[
		"cache",
		"credentials",
		"destination",
		"integrity",
		"mode",
		"redirect",
		"referrer",
		"referrerPolicy",
		"keepalive"
	].forEach((k) => {
		Object.defineProperty(requestPrototype, k, { get() {
			return this[getRequestCache]()[k];
		} });
	});
	["clone", "formData"].forEach((k) => {
		Object.defineProperty(requestPrototype, k, { value: function() {
			if (this[bodyConsumedDirectlyKey]) {
				if (k === "clone") throw newBodyUnusableError();
				return rejectBodyUnusable();
			}
			return this[getRequestCache]()[k]();
		} });
	});
	Object.defineProperty(requestPrototype, "text", { value: function() {
		return readBodyWithFastPath(this, "text", (buf) => textDecoder.decode(buf));
	} });
	Object.defineProperty(requestPrototype, "arrayBuffer", { value: function() {
		return readBodyWithFastPath(this, "arrayBuffer", (buf) => toArrayBuffer(buf));
	} });
	Object.defineProperty(requestPrototype, "blob", { value: function() {
		return readBodyWithFastPath(this, "blob", (buf, request) => {
			const type = contentType(request);
			return new Response(buf, type ? { headers: { "content-type": type } } : void 0).blob();
		});
	} });
	Object.defineProperty(requestPrototype, "json", { value: function() {
		if (this[bodyConsumedDirectlyKey]) return rejectBodyUnusable();
		return this.text().then(JSON.parse);
	} });
	Object.defineProperty(requestPrototype, Symbol.for("nodejs.util.inspect.custom"), { value: function(depth, options, inspectFn) {
		return `Request (lightweight) ${inspectFn({
			method: this.method,
			url: this.url,
			headers: this.headers,
			nativeRequest: this[requestCache]
		}, {
			...options,
			depth: depth == null ? null : depth - 1
		})}`;
	} });
	Object.setPrototypeOf(requestPrototype, Request$1.prototype);
	var newRequest = (incoming, defaultHostname) => {
		const req = Object.create(requestPrototype);
		req[incomingKey] = incoming;
		req[methodKey] = normalizeIncomingMethod(incoming.method);
		const incomingUrl = incoming.url || "";
		if (incomingUrl[0] !== "/" && (incomingUrl.startsWith("http://") || incomingUrl.startsWith("https://"))) {
			if (incoming instanceof node_http2.Http2ServerRequest) throw new RequestError("Absolute URL for :path is not allowed in HTTP/2");
			try {
				req[urlKey] = new URL(incomingUrl).href;
			} catch (e) {
				throw new RequestError("Invalid absolute URL", { cause: e });
			}
			return req;
		}
		const host = (incoming instanceof node_http2.Http2ServerRequest ? incoming.authority : incoming.headers.host) || defaultHostname;
		if (!host) throw new RequestError("Missing host header");
		let scheme;
		if (incoming instanceof node_http2.Http2ServerRequest) {
			scheme = incoming.scheme;
			if (!(scheme === "http" || scheme === "https")) throw new RequestError("Unsupported scheme");
		} else scheme = incoming.socket && incoming.socket.encrypted ? "https" : "http";
		try {
			req[urlKey] = buildUrl(scheme, host, incomingUrl);
		} catch (e) {
			if (e instanceof RequestError) throw e;
			else throw new RequestError("Invalid URL", { cause: e });
		}
		return req;
	};
	var defaultContentType = "text/plain; charset=UTF-8";
	var responseCache = Symbol("responseCache");
	var getResponseCache = Symbol("getResponseCache");
	var cacheKey = Symbol("cache");
	var GlobalResponse = global.Response;
	var Response$1 = class Response$1 {
		#body;
		#init;
		[getResponseCache]() {
			const cache = this[cacheKey];
			const liveHeaders = cache && cache[2] instanceof Headers ? cache[2] : void 0;
			delete this[cacheKey];
			return this[responseCache] ||= new GlobalResponse(this.#body, liveHeaders ? {
				status: this.#init?.status,
				statusText: this.#init?.statusText,
				headers: liveHeaders
			} : this.#init);
		}
		constructor(body, init) {
			let headers;
			this.#body = body;
			if (init instanceof Response$1) {
				const cachedGlobalResponse = init[responseCache];
				if (cachedGlobalResponse) {
					this.#init = cachedGlobalResponse;
					this[getResponseCache]();
					return;
				} else {
					this.#init = init.#init;
					headers = new Headers(init.headers);
				}
			} else this.#init = init;
			if (body == null || typeof body === "string" || typeof body?.getReader !== "undefined" || body instanceof Blob || body instanceof Uint8Array) this[cacheKey] = [
				init?.status || 200,
				body ?? null,
				headers || init?.headers
			];
		}
		get headers() {
			const cache = this[cacheKey];
			if (cache) {
				if (!(cache[2] instanceof Headers)) cache[2] = new Headers(cache[2] || (cache[1] === null ? void 0 : { "content-type": defaultContentType }));
				return cache[2];
			}
			return this[getResponseCache]().headers;
		}
		get status() {
			return this[cacheKey]?.[0] ?? this[getResponseCache]().status;
		}
		get ok() {
			const status = this.status;
			return status >= 200 && status < 300;
		}
	};
	[
		"body",
		"bodyUsed",
		"redirected",
		"statusText",
		"trailers",
		"type",
		"url"
	].forEach((k) => {
		Object.defineProperty(Response$1.prototype, k, { get() {
			return this[getResponseCache]()[k];
		} });
	});
	[
		"arrayBuffer",
		"blob",
		"clone",
		"formData",
		"json",
		"text"
	].forEach((k) => {
		Object.defineProperty(Response$1.prototype, k, { value: function() {
			return this[getResponseCache]()[k]();
		} });
	});
	Object.defineProperty(Response$1.prototype, Symbol.for("nodejs.util.inspect.custom"), { value: function(depth, options, inspectFn) {
		return `Response (lightweight) ${inspectFn({
			status: this.status,
			headers: this.headers,
			ok: this.ok,
			nativeResponse: this[responseCache]
		}, {
			...options,
			depth: depth == null ? null : depth - 1
		})}`;
	} });
	Object.setPrototypeOf(Response$1, GlobalResponse);
	Object.setPrototypeOf(Response$1.prototype, GlobalResponse.prototype);
	var validRedirectUrl = /^https?:\/\/[!#-;=?-[\]_a-z~A-Z]+$/;
	var parseRedirectUrl = (url) => {
		if (url instanceof URL) return url.href;
		if (validRedirectUrl.test(url)) return url;
		return new URL(url).href;
	};
	var validRedirectStatuses = /* @__PURE__ */ new Set([
		301,
		302,
		303,
		307,
		308
	]);
	Object.defineProperty(Response$1, "redirect", {
		value: function redirect(url, status = 302) {
			if (!validRedirectStatuses.has(status)) throw new RangeError("Invalid status code");
			return new Response$1(null, {
				status,
				headers: { location: parseRedirectUrl(url) }
			});
		},
		writable: true,
		configurable: true
	});
	Object.defineProperty(Response$1, "json", {
		value: function json(data, init) {
			const body = JSON.stringify(data);
			if (body === void 0) throw new TypeError("The data is not JSON serializable");
			const initHeaders = init?.headers;
			let headers;
			if (initHeaders) {
				headers = new Headers(initHeaders);
				if (!headers.has("content-type")) headers.set("content-type", "application/json");
			} else headers = { "content-type": "application/json" };
			return new Response$1(body, {
				status: init?.status ?? 200,
				statusText: init?.statusText,
				headers
			});
		},
		writable: true,
		configurable: true
	});
	async function readWithoutBlocking(readPromise) {
		return Promise.race([readPromise, Promise.resolve().then(() => Promise.resolve(void 0))]);
	}
	function writeFromReadableStreamDefaultReader(reader, writable, currentReadPromise) {
		const cancel = (error) => {
			reader.cancel(error).catch(() => {});
		};
		writable.on("close", cancel);
		writable.on("error", cancel);
		(currentReadPromise ?? reader.read()).then(flow, handleStreamError);
		return reader.closed.finally(() => {
			writable.off("close", cancel);
			writable.off("error", cancel);
		});
		function handleStreamError(error) {
			if (error) writable.destroy(error);
		}
		function onDrain() {
			reader.read().then(flow, handleStreamError);
		}
		function flow({ done, value }) {
			try {
				if (done) writable.end();
				else if (!writable.write(value)) writable.once("drain", onDrain);
				else return reader.read().then(flow, handleStreamError);
			} catch (e) {
				handleStreamError(e);
			}
		}
	}
	function writeFromReadableStream(stream, writable) {
		if (stream.locked) throw new TypeError("ReadableStream is locked.");
		else if (writable.destroyed) return;
		return writeFromReadableStreamDefaultReader(stream.getReader(), writable);
	}
	var buildOutgoingHttpHeaders = (headers, defaultContentType) => {
		const res = {};
		if (!(headers instanceof Headers)) headers = new Headers(headers ?? void 0);
		if (headers.has("set-cookie")) {
			const cookies = [];
			for (const [k, v] of headers) if (k === "set-cookie") cookies.push(v);
			else res[k] = v;
			if (cookies.length > 0) res["set-cookie"] = cookies;
		} else for (const [k, v] of headers) res[k] = v;
		if (defaultContentType) res["content-type"] ??= defaultContentType;
		return res;
	};
	var outgoingEnded = Symbol("outgoingEnded");
	var incomingDraining = Symbol("incomingDraining");
	var DRAIN_TIMEOUT_MS = 500;
	var MAX_DRAIN_BYTES = 64 * 1024 * 1024;
	var drainIncoming = (incoming) => {
		const incomingWithDrainState = incoming;
		if (incoming.destroyed || incomingWithDrainState[incomingDraining]) return;
		incomingWithDrainState[incomingDraining] = true;
		if (incoming instanceof node_http2.Http2ServerRequest) {
			try {
				incoming.stream?.close?.(node_http2.constants.NGHTTP2_NO_ERROR);
			} catch {}
			return;
		}
		let bytesRead = 0;
		const cleanup = () => {
			clearTimeout(timer);
			incoming.off("data", onData);
			incoming.off("end", cleanup);
			incoming.off("error", cleanup);
		};
		const forceClose = () => {
			cleanup();
			const socket = incoming.socket;
			if (socket && !socket.destroyed) socket.destroySoon();
		};
		const timer = setTimeout(forceClose, DRAIN_TIMEOUT_MS);
		timer.unref?.();
		const onData = (chunk) => {
			bytesRead += chunk.length;
			if (bytesRead > MAX_DRAIN_BYTES) forceClose();
		};
		incoming.on("data", onData);
		incoming.on("end", cleanup);
		incoming.on("error", cleanup);
		incoming.resume();
	};
	var makeCloseHandler = (req, incoming, outgoing, needsBodyCleanup) => () => {
		if (incoming.errored) req[abortRequest](incoming.errored.toString());
		else if (!outgoing.writableFinished) req[abortRequest]("Client connection prematurely closed.");
		if (needsBodyCleanup && !incoming.readableEnded) setTimeout(() => {
			if (!incoming.readableEnded) setTimeout(() => {
				drainIncoming(incoming);
			});
		});
	};
	var isImmediateCacheableResponse = (res) => {
		if (!(cacheKey in res)) return false;
		const body = res[cacheKey][1];
		return body === null || typeof body === "string" || body instanceof Uint8Array;
	};
	var handleRequestError = () => new Response(null, { status: 400 });
	var handleFetchError = (e) => new Response(null, { status: e instanceof Error && (e.name === "TimeoutError" || e.constructor.name === "TimeoutError") ? 504 : 500 });
	var handleResponseError = (e, outgoing) => {
		const err = e instanceof Error ? e : new Error("unknown error", { cause: e });
		if (err.code === "ERR_STREAM_PREMATURE_CLOSE") console.info("The user aborted a request.");
		else {
			console.error(e);
			if (!outgoing.headersSent) outgoing.writeHead(500, { "Content-Type": "text/plain" });
			outgoing.end(`Error: ${err.message}`);
			outgoing.destroy(err);
		}
	};
	var flushHeaders = (outgoing) => {
		if ("flushHeaders" in outgoing && outgoing.writable) outgoing.flushHeaders();
	};
	var responseViaCache = async (res, outgoing) => {
		let [status, body, header] = res[cacheKey];
		if (!header) {
			if (body === null) {
				outgoing.writeHead(status);
				outgoing.end();
			} else if (typeof body === "string") {
				outgoing.writeHead(status, {
					"Content-Type": defaultContentType,
					"Content-Length": Buffer.byteLength(body)
				});
				outgoing.end(body);
			} else if (body instanceof Uint8Array) {
				outgoing.writeHead(status, {
					"Content-Type": defaultContentType,
					"Content-Length": body.byteLength
				});
				outgoing.end(body);
			} else if (body instanceof Blob) {
				outgoing.writeHead(status, {
					"Content-Type": defaultContentType,
					"Content-Length": body.size
				});
				outgoing.end(new Uint8Array(await body.arrayBuffer()));
			} else {
				outgoing.writeHead(status, { "Content-Type": defaultContentType });
				flushHeaders(outgoing);
				await writeFromReadableStream(body, outgoing)?.catch((e) => handleResponseError(e, outgoing));
			}
			outgoing[outgoingEnded]?.();
			return;
		}
		let hasContentLength = false;
		if (header instanceof Headers) {
			hasContentLength = header.has("content-length");
			header = buildOutgoingHttpHeaders(header, body === null ? void 0 : defaultContentType);
		} else if (Array.isArray(header)) {
			const headerObj = new Headers(header);
			hasContentLength = headerObj.has("content-length");
			header = buildOutgoingHttpHeaders(headerObj, body === null ? void 0 : defaultContentType);
		} else for (const key in header) if (key.length === 14 && key.toLowerCase() === "content-length") {
			hasContentLength = true;
			break;
		}
		if (!hasContentLength) {
			if (typeof body === "string") header["Content-Length"] = Buffer.byteLength(body);
			else if (body instanceof Uint8Array) header["Content-Length"] = body.byteLength;
			else if (body instanceof Blob) header["Content-Length"] = body.size;
		}
		outgoing.writeHead(status, header);
		if (body == null) outgoing.end();
		else if (typeof body === "string" || body instanceof Uint8Array) outgoing.end(body);
		else if (body instanceof Blob) outgoing.end(new Uint8Array(await body.arrayBuffer()));
		else {
			flushHeaders(outgoing);
			await writeFromReadableStream(body, outgoing)?.catch((e) => handleResponseError(e, outgoing));
		}
		outgoing[outgoingEnded]?.();
	};
	var isPromise = (res) => typeof res.then === "function";
	var responseViaResponseObject = async (res, outgoing, options = {}) => {
		if (isPromise(res)) if (options.errorHandler) try {
			res = await res;
		} catch (err) {
			const errRes = await options.errorHandler(err);
			if (!errRes) return;
			res = errRes;
		}
		else res = await res.catch(handleFetchError);
		if (cacheKey in res) return responseViaCache(res, outgoing);
		const resHeaderRecord = buildOutgoingHttpHeaders(res.headers, res.body === null ? void 0 : defaultContentType);
		if (res.body) {
			const reader = res.body.getReader();
			const values = [];
			let done = false;
			let currentReadPromise = void 0;
			if (resHeaderRecord["transfer-encoding"] !== "chunked") {
				let maxReadCount = 2;
				for (let i = 0; i < maxReadCount; i++) {
					currentReadPromise ||= reader.read();
					const chunk = await readWithoutBlocking(currentReadPromise).catch((e) => {
						console.error(e);
						done = true;
					});
					if (!chunk) {
						if (i === 1) {
							await new Promise((resolve) => setTimeout(resolve));
							maxReadCount = 3;
							continue;
						}
						break;
					}
					currentReadPromise = void 0;
					if (chunk.value) values.push(chunk.value);
					if (chunk.done) {
						done = true;
						break;
					}
				}
				if (done && !("content-length" in resHeaderRecord)) resHeaderRecord["content-length"] = values.reduce((acc, value) => acc + value.length, 0);
			}
			outgoing.writeHead(res.status, resHeaderRecord);
			values.forEach((value) => {
				outgoing.write(value);
			});
			if (done) outgoing.end();
			else {
				if (values.length === 0) flushHeaders(outgoing);
				await writeFromReadableStreamDefaultReader(reader, outgoing, currentReadPromise);
			}
		} else if (resHeaderRecord[require_constants$2.X_ALREADY_SENT]) {} else {
			outgoing.writeHead(res.status, resHeaderRecord);
			outgoing.end();
		}
		outgoing[outgoingEnded]?.();
	};
	var getRequestListener = (fetchCallback, options = {}) => {
		const autoCleanupIncoming = options.autoCleanupIncoming ?? true;
		if (options.overrideGlobalObjects !== false && global.Request !== Request$1) {
			Object.defineProperty(global, "Request", { value: Request$1 });
			Object.defineProperty(global, "Response", { value: Response$1 });
		}
		return async (incoming, outgoing) => {
			let res, req;
			let needsBodyCleanup = false;
			let closeHandlerAttached = false;
			const ensureCloseHandler = () => {
				if (!req || closeHandlerAttached) return;
				closeHandlerAttached = true;
				outgoing.on("close", makeCloseHandler(req, incoming, outgoing, needsBodyCleanup));
			};
			try {
				req = newRequest(incoming, options.hostname);
				needsBodyCleanup = autoCleanupIncoming && !(incoming.method === "GET" || incoming.method === "HEAD");
				if (needsBodyCleanup) {
					incoming[wrapBodyStream] = true;
					if (incoming instanceof node_http2.Http2ServerRequest) outgoing[outgoingEnded] = () => {
						if (!incoming.readableEnded) setTimeout(() => {
							if (!incoming.readableEnded) setTimeout(() => {
								incoming.destroy();
								outgoing.destroy();
							});
						});
					};
				}
				res = fetchCallback(req, {
					incoming,
					outgoing
				});
				if (!isPromise(res) && isImmediateCacheableResponse(res)) {
					if (needsBodyCleanup && !incoming.readableEnded) outgoing.once("finish", () => {
						if (!incoming.readableEnded) drainIncoming(incoming);
					});
					return responseViaCache(res, outgoing);
				}
				ensureCloseHandler();
			} catch (e) {
				if (!res) if (options.errorHandler) {
					ensureCloseHandler();
					res = await options.errorHandler(req ? e : toRequestError(e));
					if (!res) return;
				} else if (!req) res = handleRequestError();
				else res = handleFetchError(e);
				else return handleResponseError(e, outgoing);
			}
			try {
				return await responseViaResponseObject(res, outgoing, options);
			} catch (e) {
				return handleResponseError(e, outgoing);
			}
		};
	};
	/**
	* @link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
	*/
	var CloseEvent = globalThis.CloseEvent ?? class extends Event {
		#eventInitDict;
		constructor(type, eventInitDict = {}) {
			super(type, eventInitDict);
			this.#eventInitDict = eventInitDict;
		}
		get wasClean() {
			return this.#eventInitDict.wasClean ?? false;
		}
		get code() {
			return this.#eventInitDict.code ?? 0;
		}
		get reason() {
			return this.#eventInitDict.reason ?? "";
		}
	};
	var generateConnectionSymbol = () => Symbol("connection");
	var CONNECTION_SYMBOL_KEY = Symbol("CONNECTION_SYMBOL_KEY");
	var WAIT_FOR_WEBSOCKET_SYMBOL = Symbol("WAIT_FOR_WEBSOCKET_SYMBOL");
	var responseHeadersToSkip = /* @__PURE__ */ new Set([
		"connection",
		"content-length",
		"keep-alive",
		"proxy-authenticate",
		"proxy-authorization",
		"te",
		"trailer",
		"transfer-encoding",
		"upgrade",
		"sec-websocket-accept",
		"sec-websocket-extensions",
		"sec-websocket-protocol"
	]);
	var appendResponseHeaders = (headers, responseHeaders) => {
		if (!responseHeaders) return;
		responseHeaders.forEach((value, key) => {
			if (responseHeadersToSkip.has(key.toLowerCase())) return;
			headers.push(`${key}: ${value}`);
		});
	};
	var rejectUpgradeRequest = (socket, status, responseHeaders) => {
		const responseLines = ["Connection: close", "Content-Length: 0"];
		appendResponseHeaders(responseLines, responseHeaders);
		socket.end(`HTTP/1.1 ${status.toString()} ${node_http.STATUS_CODES[status] ?? ""}\r\n${responseLines.join("\r\n")}\r\n\r
`);
	};
	var createUpgradeRequest = (request) => {
		const protocol = request.socket.encrypted ? "https" : "http";
		const url = new URL(request.url ?? "/", `${protocol}://${request.headers.host ?? "localhost"}`);
		const headers = new Headers();
		for (const key in request.headers) {
			const value = request.headers[key];
			if (!value) continue;
			headers.append(key, Array.isArray(value) ? value[0] : value);
		}
		return new Request(url, { headers });
	};
	var setupWebSocket = (options) => {
		const { server, fetchCallback, wss } = options;
		const waiterMap = /* @__PURE__ */ new Map();
		wss.on("connection", (ws, request) => {
			const waiter = waiterMap.get(request);
			if (waiter) {
				waiter.resolve(ws);
				waiterMap.delete(request);
			}
		});
		const waitForWebSocket = (request, connectionSymbol) => {
			return new Promise((resolve) => {
				waiterMap.set(request, {
					resolve,
					connectionSymbol
				});
			});
		};
		server.on("upgrade", async (request, socket, head) => {
			if (request.headers.upgrade?.toLowerCase() !== "websocket") return;
			const env = {
				incoming: request,
				outgoing: void 0,
				wss,
				[WAIT_FOR_WEBSOCKET_SYMBOL]: waitForWebSocket
			};
			let status = 400;
			let responseHeaders;
			try {
				const response = await fetchCallback(createUpgradeRequest(request), env);
				if (response instanceof Response) {
					status = response.status;
					responseHeaders = response.headers;
				}
			} catch {
				if (server.listenerCount("upgrade") === 1) rejectUpgradeRequest(socket, 500);
				return;
			}
			const waiter = waiterMap.get(request);
			if (!waiter || waiter.connectionSymbol !== env[CONNECTION_SYMBOL_KEY]) {
				waiterMap.delete(request);
				if (server.listenerCount("upgrade") === 1) rejectUpgradeRequest(socket, status, responseHeaders);
				return;
			}
			const addResponseHeaders = (headers) => {
				appendResponseHeaders(headers, responseHeaders);
			};
			wss.on("headers", addResponseHeaders);
			try {
				wss.handleUpgrade(request, socket, head, (ws) => {
					wss.emit("connection", ws, request);
				});
			} finally {
				wss.off("headers", addResponseHeaders);
			}
		});
		server.on("close", () => {
			wss.close();
		});
	};
	var upgradeWebSocket = (0, hono_ws.defineWebSocketHelper)(async (c, events, options) => {
		if (c.req.header("upgrade")?.toLowerCase() !== "websocket") return;
		const env = c.env;
		const waitForWebSocket = env[WAIT_FOR_WEBSOCKET_SYMBOL];
		if (!waitForWebSocket || !env.incoming) return new Response(null, { status: 500 });
		const connectionSymbol = generateConnectionSymbol();
		env[CONNECTION_SYMBOL_KEY] = connectionSymbol;
		(async () => {
			const ws = await waitForWebSocket(env.incoming, connectionSymbol);
			const messagesReceivedInStarting = [];
			const bufferMessage = (data, isBinary) => {
				messagesReceivedInStarting.push([data, isBinary]);
			};
			ws.on("message", bufferMessage);
			const ctx = {
				binaryType: "arraybuffer",
				close(code, reason) {
					ws.close(code, reason);
				},
				protocol: ws.protocol,
				raw: ws,
				get readyState() {
					return ws.readyState;
				},
				send(source, opts) {
					ws.send(source, { compress: opts?.compress });
				},
				url: new URL(c.req.url)
			};
			try {
				events?.onOpen?.(new Event("open"), ctx);
			} catch (e) {
				(options?.onError ?? console.error)(e);
			}
			const handleMessage = (data, isBinary) => {
				const datas = Array.isArray(data) ? data : [data];
				for (const data of datas) try {
					events?.onMessage?.(new MessageEvent("message", { data: isBinary ? data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : typeof data === "string" ? data : Buffer.from(data).toString("utf-8") }), ctx);
				} catch (e) {
					(options?.onError ?? console.error)(e);
				}
			};
			ws.off("message", bufferMessage);
			for (const message of messagesReceivedInStarting) handleMessage(...message);
			ws.on("message", (data, isBinary) => {
				handleMessage(data, isBinary);
			});
			ws.on("close", (code, reason) => {
				try {
					events?.onClose?.(new CloseEvent("close", {
						code,
						reason: reason.toString()
					}), ctx);
				} catch (e) {
					(options?.onError ?? console.error)(e);
				}
			});
			ws.on("error", (error) => {
				try {
					events?.onError?.(new ErrorEvent("error", { error }), ctx);
				} catch (e) {
					(options?.onError ?? console.error)(e);
				}
			});
		})();
		return new Response();
	});
	var createAdaptorServer = (options) => {
		const fetchCallback = options.fetch;
		const requestListener = getRequestListener(fetchCallback, {
			hostname: options.hostname,
			overrideGlobalObjects: options.overrideGlobalObjects,
			autoCleanupIncoming: options.autoCleanupIncoming
		});
		const server = (options.createServer || node_http.createServer)(options.serverOptions || {}, requestListener);
		if (options.websocket && options.websocket.server) {
			if (options.websocket.server.options.noServer !== true) throw new Error("WebSocket server must be created with { noServer: true } option");
			setupWebSocket({
				server,
				fetchCallback,
				wss: options.websocket.server
			});
		}
		return server;
	};
	var serve = (options, listeningListener) => {
		const server = createAdaptorServer(options);
		server.listen(options?.port ?? 3e3, options.hostname, () => {
			const serverInfo = server.address();
			listeningListener && listeningListener(serverInfo);
		});
		return server;
	};
	exports.RequestError = RequestError;
	exports.createAdaptorServer = createAdaptorServer;
	exports.getRequestListener = getRequestListener;
	exports.serve = serve;
	exports.upgradeWebSocket = upgradeWebSocket;
})))();
/** Flue/Pi remediator agent profile. */
var remediator_exports = /* @__PURE__ */ __exportAll({
	default: () => remediator_default,
	explainHypothesis: () => explainHypothesis
});
var explainHypothesis = defineTool({
	name: "explain_hypothesis",
	description: "Explain one evidence hypothesis for a remediation run.",
	parameters: Type.Object({
		id: Type.String(),
		title: Type.String()
	}),
	execute: async ({ id, title }) => `Hypothesis ${id}: ${title}`
});
var remediator_default = createAgent(() => ({
	model: "local-gateway/fixbot",
	instructions: "You are an evidence-driven remediation agent. Summarize only verified facts.",
	tools: [explainHypothesis]
}));
//#endregion
//#region src/lib/audit.ts
/** Append-only JSONL audit logging for validation and trace evidence. */
async function appendAudit(path, event) {
	await mkdir(dirname(path), { recursive: true });
	await appendFile(path, `${JSON.stringify({
		at: (/* @__PURE__ */ new Date()).toISOString(),
		...event
	})}\n`, "utf8");
}
promisify(execFile);
async function readWorkspaceFiles(source) {
	const root = resolve(source);
	const files = [];
	async function walk(relativePath) {
		const absolute = join(root, relativePath);
		const entry = await stat(absolute);
		if (entry.isDirectory()) {
			for (const child of (await readdir(absolute)).sort()) await walk(join(relativePath, child));
			return;
		}
		if (entry.isFile()) files.push({
			path: relativePath,
			content: await readFile(absolute),
			mode: entry.mode
		});
	}
	await walk("");
	return files;
}
function missingZeroGuardDenominator(code) {
	const denominator = code.match(/return \w+ \/ (?<denominator>\w+)/)?.groups?.denominator;
	if (!denominator || code.includes(`if ${denominator} == 0:`)) return;
	return denominator;
}
function missingIntegerValidationArgument(code) {
	const argument = code.match(/return int\((?<argument>\w+)\)/)?.groups?.argument;
	if (!argument || code.includes("normalized.isdigit()")) return;
	return argument;
}
function missingDictKeyGuard(code) {
	const match = code.match(/return (?<name>\w+)\["(?<key>[^"]+)"\]/);
	const key = match?.groups?.key;
	if (!key || code.includes(`.get("${key}"`) || code.includes(`if "${key}" not in`)) return;
	return {
		key,
		expression: match[0]
	};
}
async function findPythonSourceFiles(workspace) {
	const root = resolve(workspace);
	const files = [];
	async function walk(relativePath) {
		const absolute = join(root, relativePath);
		const entry = await stat(absolute);
		if (entry.isDirectory()) {
			if (basename(absolute) === "tests") return;
			for (const child of (await readdir(absolute)).sort()) await walk(join(relativePath, child));
			return;
		}
		if (entry.isFile() && absolute.endsWith(".py")) files.push(absolute);
	}
	await walk("");
	return files.sort();
}
async function scanWorkspace(workspace) {
	const hypotheses = [];
	for (const sourcePath of await findPythonSourceFiles(workspace)) {
		const code = await readFile(sourcePath, "utf8");
		const sourceName = basename(sourcePath);
		const denominator = missingZeroGuardDenominator(code);
		if (denominator) hypotheses.push({
			id: "HYP-DIVIDE-ZERO-001",
			title: "division helper does not reject zero divisor before division",
			affectedFile: sourcePath,
			affectedSymbol: "division helper",
			evidence: [`${sourceName} divides by ${denominator} without a zero-divisor guard`],
			status: "localized",
			severity: "medium",
			requiredChecks: ["pytest", "rescan"]
		});
		const integerArgument = missingIntegerValidationArgument(code);
		if (integerArgument) hypotheses.push({
			id: "HYP-DISCOUNT-VALIDATION-001",
			title: "integer parser accepts invalid strings through raw int()",
			affectedFile: sourcePath,
			affectedSymbol: "integer parser",
			evidence: [`${sourceName} contains \`return int(${integerArgument})\` without explicit input validation`],
			status: "localized",
			severity: "low",
			requiredChecks: ["pytest", "rescan"]
		});
		const dictKey = missingDictKeyGuard(code);
		if (dictKey) hypotheses.push({
			id: "HYP-DICT-KEY-GUARD-001",
			title: "dictionary lookup can raise KeyError for a missing key",
			affectedFile: sourcePath,
			affectedSymbol: "dictionary lookup",
			evidence: [`${sourceName} contains \`${dictKey.expression}\` without a missing-key guard`],
			status: "localized",
			severity: "low",
			requiredChecks: ["pytest", "rescan"]
		});
	}
	return hypotheses;
}
function proposePatchCandidates(hypotheses) {
	return hypotheses.flatMap((hypothesis) => {
		const isDictKey = hypothesis.id === "HYP-DICT-KEY-GUARD-001";
		return [{
			id: `PATCH-${hypothesis.id}-MINIMAL`,
			hypothesisId: hypothesis.id,
			affectedFile: hypothesis.affectedFile,
			strategy: "minimal_guard",
			status: "proposed",
			rationale: isDictKey ? "Use .get() with a safe default for the missing-key case." : "Smallest targeted change that satisfies the failing behavior."
		}, {
			id: `PATCH-${hypothesis.id}-VALIDATION`,
			hypothesisId: hypothesis.id,
			affectedFile: hypothesis.affectedFile,
			strategy: "input_validation",
			status: "proposed",
			rationale: isDictKey ? "Add an explicit guard branch before indexing the dictionary." : "Explicit defensive validation for the affected boundary."
		}];
	});
}
function sourceArtifactPaths(workspace, hypotheses) {
	const root = resolve(workspace);
	return [...new Set(hypotheses.map((hypothesis) => relative(root, hypothesis.affectedFile)))].filter((path) => path && !path.startsWith("..")).sort();
}
async function applySelectedPatches(workspace, candidates) {
	const fileCodes = /* @__PURE__ */ new Map();
	const hypothesesPatched = [];
	const appliedPatchIds = [];
	for (const candidate of candidates) {
		if (candidate.status !== "proposed" || !candidate.id.endsWith("-MINIMAL")) continue;
		const affectedFile = candidate.affectedFile;
		let code = fileCodes.get(affectedFile) ?? await readFile(affectedFile, "utf8");
		if (candidate.hypothesisId === "HYP-DIVIDE-ZERO-001" && missingZeroGuardDenominator(code)) {
			const before = code;
			code = code.replace("def divide(a: float, b: float) -> float:\n    return a / b\n", "def divide(a: float, b: float) -> float:\n    if b == 0:\n        raise ValueError(\"division by zero\")\n    return a / b\n").replace("def average(total: float, count: float) -> float:\n    return total / count\n", "def average(total: float, count: float) -> float:\n    if count == 0:\n        raise ValueError(\"division by zero\")\n    return total / count\n");
			if (code !== before) {
				hypothesesPatched.push(candidate.hypothesisId);
				appliedPatchIds.push(candidate.id);
			}
		}
		if (candidate.hypothesisId === "HYP-DISCOUNT-VALIDATION-001" && missingIntegerValidationArgument(code)) {
			const before = code;
			code = code.replace("def parse_discount(value: str) -> int:\n    return int(value)\n", "def parse_discount(value: str) -> int:\n    normalized = value.strip()\n    if not normalized.isdigit():\n        raise ValueError(\"discount must be a non-negative integer\")\n    return int(normalized)\n").replace("def parse_quantity(raw: str) -> int:\n    return int(raw)\n", "def parse_quantity(raw: str) -> int:\n    normalized = raw.strip()\n    if not normalized.isdigit():\n        raise ValueError(\"quantity must be a non-negative integer\")\n    return int(normalized)\n");
			if (code !== before) {
				hypothesesPatched.push(candidate.hypothesisId);
				appliedPatchIds.push(candidate.id);
			}
		}
		if (candidate.hypothesisId === "HYP-DICT-KEY-GUARD-001" && missingDictKeyGuard(code)) {
			const before = code;
			code = code.replace("def preferred_region(profile: dict[str, str]) -> str:\n    return profile[\"region\"]\n", "def preferred_region(profile: dict[str, str]) -> str:\n    return profile.get(\"region\", \"unknown\")\n").replace("def country_code(account: dict[str, str]) -> str:\n    return account[\"country\"]\n", "def country_code(account: dict[str, str]) -> str:\n    return account.get(\"country\", \"ZZ\")\n");
			if (code !== before) {
				hypothesesPatched.push(candidate.hypothesisId);
				appliedPatchIds.push(candidate.id);
			}
		}
		fileCodes.set(affectedFile, code);
	}
	for (const [filePath, code] of fileCodes) await writeFile(filePath, code, "utf8");
	return {
		hypothesesPatched,
		appliedPatchIds
	};
}
async function verifyWorkspaceWithExecutor(executor, handle) {
	const result = await executor.exec(handle, [
		process.env.EAP_PYTHON ?? resolve(".venv/bin/python"),
		"-m",
		"pytest",
		"-q"
	], {
		timeoutMs: 3e4,
		audit_id: handle.audit_id,
		trace_id: handle.trace_id
	});
	return {
		passed: result.exitCode === 0,
		command: "python -m pytest -q",
		stdout: result.stdout,
		stderr: result.stderr,
		exitCode: result.exitCode
	};
}
//#endregion
//#region src/lib/dataProxy.ts
/** Python OSS data proxy bridge for SQLGlot, DuckDB, and Presidio. */
var execFileAsync$2 = promisify(execFile);
function pythonBinary() {
	if (process.env.EAP_PYTHON) return process.env.EAP_PYTHON;
	if (existsSync(".venv/bin/python")) return ".venv/bin/python";
	return "python";
}
async function metricQuery() {
	const { stdout } = await execFileAsync$2(pythonBinary(), ["scripts/data_guard.py", "metric"], { maxBuffer: 1024 * 1024 });
	return JSON.parse(stdout);
}
//#endregion
//#region src/lib/ledger.ts
/** Durable hypothesis ledger and evidence graph for closure-gated remediation. */
function createLedger(runId) {
	return {
		runId,
		hypotheses: [],
		evidence: [],
		patches: [],
		impactGraph: [],
		verifications: []
	};
}
function addHypotheses(ledger, hypotheses) {
	const known = new Set(ledger.hypotheses.map((item) => item.id));
	return {
		...ledger,
		hypotheses: [...ledger.hypotheses, ...hypotheses.filter((item) => !known.has(item.id))]
	};
}
function addEvidence(ledger, evidence) {
	return {
		...ledger,
		evidence: [...ledger.evidence, evidence]
	};
}
function addPatchCandidate(ledger, patch) {
	return {
		...ledger,
		patches: [...ledger.patches, patch]
	};
}
function markPatchApplied(ledger, patchId) {
	return {
		...ledger,
		patches: ledger.patches.map((patch) => patch.id === patchId ? {
			...patch,
			status: "applied"
		} : patch)
	};
}
function addImpactEdge(ledger, edge) {
	return {
		...ledger,
		impactGraph: [...ledger.impactGraph, edge]
	};
}
function markHypothesesPatched(ledger, hypothesisIds) {
	const ids = new Set(hypothesisIds);
	return {
		...ledger,
		hypotheses: ledger.hypotheses.map((item) => ids.has(item.id) ? {
			...item,
			status: "patched"
		} : item)
	};
}
function markHypothesesVerified(ledger, verification) {
	const verified = verification.passed ? ledger.hypotheses.map((item) => ({
		...item,
		status: "verified"
	})) : ledger.hypotheses;
	return {
		...ledger,
		hypotheses: verified,
		verifications: [...ledger.verifications, verification]
	};
}
function closureGate(ledger) {
	const reasons = [];
	const open = ledger.hypotheses.filter((item) => item.status !== "verified");
	const verified = ledger.hypotheses.filter((item) => item.status === "verified");
	if (ledger.hypotheses.length === 0) reasons.push("no_hypotheses_registered");
	if (open.length > 0) reasons.push(`open_hypotheses:${open.map((h) => h.id).join(",")}`);
	if (!ledger.verifications.some((item) => item.passed)) reasons.push("no_passing_verification");
	if (!ledger.evidence.some((item) => item.kind === "source")) reasons.push("missing_source_evidence");
	if (!ledger.evidence.some((item) => item.kind === "policy")) reasons.push("missing_policy_evidence");
	if (!ledger.evidence.some((item) => item.kind === "verification")) reasons.push("missing_verification_evidence");
	if (!ledger.evidence.some((item) => item.kind === "data")) reasons.push("missing_data_guard_evidence");
	if (ledger.patches.length < ledger.hypotheses.length) reasons.push("not_enough_patch_candidates");
	return {
		closed: reasons.length === 0,
		reasons,
		openHypotheses: open.map((item) => item.id),
		verifiedHypotheses: verified.map((item) => item.id)
	};
}
async function saveLedger(path, ledger) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(ledger, null, 2), "utf8");
}
//#endregion
//#region src/lib/localGateway.ts
/** Local OpenAI-compatible gateway used to exercise Flue/Pi without external LLM calls. */
async function readJson(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function writeSseChunk(res, body) {
	res.write(`data: ${JSON.stringify(body)}\n\n`);
}
async function startLocalGateway(responseText) {
	const requests = [];
	const server = createServer(async (req, res) => {
		try {
			const body = await readJson(req);
			requests.push({
				url: req.url,
				method: req.method,
				body
			});
			if (req.url?.includes("/chat/completions")) {
				if (body.stream) {
					res.writeHead(200, {
						"content-type": "text/event-stream",
						"cache-control": "no-cache",
						connection: "keep-alive"
					});
					const base = {
						id: "chatcmpl-local",
						object: "chat.completion.chunk",
						created: Math.floor(Date.now() / 1e3),
						model: "fixbot"
					};
					writeSseChunk(res, {
						...base,
						choices: [{
							index: 0,
							delta: { role: "assistant" },
							finish_reason: null
						}]
					});
					writeSseChunk(res, {
						...base,
						choices: [{
							index: 0,
							delta: { content: responseText },
							finish_reason: null
						}]
					});
					writeSseChunk(res, {
						...base,
						choices: [{
							index: 0,
							delta: {},
							finish_reason: "stop"
						}],
						usage: {
							prompt_tokens: 1,
							completion_tokens: 1,
							total_tokens: 2
						}
					});
					res.write("data: [DONE]\n\n");
					res.end();
					return;
				}
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify({
					id: "chatcmpl-local",
					object: "chat.completion",
					created: Math.floor(Date.now() / 1e3),
					model: "fixbot",
					choices: [{
						index: 0,
						message: {
							role: "assistant",
							content: responseText
						},
						finish_reason: "stop"
					}],
					usage: {
						prompt_tokens: 1,
						completion_tokens: 1,
						total_tokens: 2
					}
				}));
				return;
			}
			if (req.url?.includes("/models")) {
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify({
					object: "list",
					data: [{
						id: "fixbot",
						object: "model"
					}]
				}));
				return;
			}
			res.writeHead(404, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "not found" }));
		} catch (error) {
			res.writeHead(500, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: String(error) }));
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("gateway did not bind");
	const baseUrl = `http://127.0.0.1:${address.port}/v1`;
	registerProvider("local-gateway", {
		api: "openai-completions",
		baseUrl,
		apiKey: "test-key",
		models: { fixbot: {
			contextWindow: 16e3,
			maxTokens: 4096
		} }
	});
	return {
		baseUrl,
		requests,
		close: () => new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))
	};
}
//#endregion
//#region src/lib/opa.ts
/** OPA-backed policy decision adapter using a real bundled OPA binary. */
var execFileAsync$1 = promisify(execFile);
var opaPackages = {
	"darwin-arm64": "agent-control-specification-opa-darwin-arm64",
	"darwin-x64": "agent-control-specification-opa-darwin-x64",
	"linux-arm64": "agent-control-specification-opa-linux-arm64",
	"linux-x64": "agent-control-specification-opa-linux-x64"
};
function opaBinary() {
	if (process.env.EAP_OPA_BINARY) return process.env.EAP_OPA_BINARY;
	const platformKey = `${process.platform}-${process.arch}`;
	const packageName = opaPackages[platformKey];
	if (!packageName) throw new Error(`No bundled OPA binary for ${platformKey}; supported: ${Object.keys(opaPackages).join(", ")}. Set EAP_OPA_BINARY to override.`);
	const binary = resolve("node_modules", packageName, "bin", "opa");
	if (!existsSync(binary)) throw new Error(`Bundled OPA binary is not installed at ${binary}. Run npm ci without omitting optional dependencies, or set EAP_OPA_BINARY.`);
	return binary;
}
async function evaluatePolicy(input, policyPath = "policy/agent.rego", query = "data.eap.agent", dataPath = "policy/tenants.json") {
	const inputPath = join(await mkdtemp(join(tmpdir(), "eap-opa-")), "input.json");
	await writeFile(inputPath, JSON.stringify(input), "utf8");
	const args = [
		"eval",
		"--format",
		"json",
		"--data",
		policyPath,
		"--data",
		dataPath,
		"--input",
		inputPath,
		query
	];
	try {
		const { stdout } = await execFileAsync$1(opaBinary(), args, {
			cwd: process.cwd(),
			maxBuffer: 1024 * 1024
		});
		const value = JSON.parse(stdout).result?.[0]?.expressions?.[0]?.value;
		if (!value) throw new Error("OPA returned no decision");
		const denyReasons = Array.isArray(value.deny_reason) ? value.deny_reason : [];
		return {
			allow: value.allow === true,
			requires_approval: value.requires_approval === true,
			reasons: denyReasons.length > 0 ? denyReasons : ["ok"]
		};
	} catch (error) {
		return {
			allow: false,
			requires_approval: true,
			reasons: [`policy_unavailable:${String(error)}`]
		};
	}
}
//#endregion
//#region src/lib/sandboxOpenSandbox.ts
var remoteRoot = "/workspace";
var OpenSandboxExecutor = class {
	auditLog;
	connectionConfig;
	sandboxes = /* @__PURE__ */ new Map();
	constructor(options = {}) {
		this.auditLog = options.auditLog ?? "artifacts/audit/remediation.jsonl";
		const endpoint = process.env.EAP_OPENSANDBOX_URL;
		if (!endpoint) throw new SandboxRuntimeError("EAP_OPENSANDBOX_URL is required for opensandbox runtime");
		const url = new URL(endpoint);
		const protocol = url.protocol.replace(":", "");
		const config = {
			domain: url.host,
			protocol,
			requestTimeoutSeconds: 30,
			useServerProxy: true,
			...process.env.EAP_OPENSANDBOX_API_KEY ? { apiKey: process.env.EAP_OPENSANDBOX_API_KEY } : {}
		};
		this.connectionConfig = new ConnectionConfig(config);
	}
	async create(spec) {
		await this.enforcePolicy(spec);
		try {
			const sandbox = await Sandbox.create({
				connectionConfig: this.connectionConfig,
				image: `${spec.image.name}:${spec.image.tag}@${spec.image.digest}`,
				env: spec.env ?? {},
				networkPolicy: toOpenSandboxNetworkPolicy(spec),
				resource: {
					cpu: spec.limits.cpu,
					memory: `${spec.limits.memoryMb}Mi`
				},
				timeoutSeconds: Math.ceil(spec.limits.timeoutMs / 1e3),
				metadata: {
					audit_id: spec.audit_id,
					trace_id: spec.trace_id
				}
			});
			await sandbox.files.createDirectories([{ path: remoteRoot }]);
			this.sandboxes.set(sandbox.id, sandbox);
			const handle = {
				id: sandbox.id,
				runtime: "opensandbox",
				audit_id: spec.audit_id,
				trace_id: spec.trace_id
			};
			await this.audit("sandbox_create", {
				audit_id: spec.audit_id,
				trace_id: spec.trace_id,
				runtime: handle.runtime,
				sandbox_id: sandbox.id,
				image: spec.image,
				limits: spec.limits,
				network: spec.network,
				envKeys: Object.keys(spec.env ?? {}).sort()
			});
			return handle;
		} catch (error) {
			throw new SandboxRuntimeError(`opensandbox create failed: ${errorMessage(error)}`);
		}
	}
	async putFiles(handle, files) {
		const sandbox = this.lookup(handle);
		const directories = [...new Set(files.map((file) => posix.dirname(remotePath(file.path))).filter((path) => path !== remoteRoot))];
		if (directories.length > 0) await sandbox.files.createDirectories(directories.map((path) => ({ path })));
		await sandbox.files.writeFiles(files.map((file) => ({
			path: remotePath(file.path),
			data: file.content,
			...file.mode === void 0 ? {} : { mode: file.mode }
		})));
		await this.audit("sandbox_put_files", {
			audit_id: handle.audit_id,
			trace_id: handle.trace_id,
			sandbox_id: handle.id,
			files: files.map((file) => ({
				path: file.path,
				bytes: typeof file.content === "string" ? Buffer.byteLength(file.content) : file.content.byteLength
			}))
		});
	}
	async exec(handle, argv, options) {
		if (argv.length === 0) throw new SandboxRuntimeError("argv must not be empty");
		const command = argv[0];
		if (!command) throw new SandboxRuntimeError("argv must not be empty");
		const result = toExecResult(await this.lookup(handle).commands.run(shellCommand(argv), {
			workingDirectory: remoteRoot,
			timeoutSeconds: Math.ceil(options.timeoutMs / 1e3)
		}));
		await this.audit("sandbox_exec", {
			audit_id: options.audit_id,
			trace_id: options.trace_id,
			sandbox_id: handle.id,
			command,
			exitCode: result.exitCode
		});
		return result;
	}
	async collectArtifacts(handle, paths, options) {
		const sandbox = this.lookup(handle);
		let totalBytes = 0;
		const files = [];
		for (const path of paths) {
			const content = await sandbox.files.readFile(remotePath(path));
			totalBytes += Buffer.byteLength(content);
			if (totalBytes > options.maxBytes) throw new SandboxRuntimeError("artifact size exceeds maxBytes");
			files.push({
				path,
				content
			});
		}
		await this.audit("sandbox_collect", {
			audit_id: options.audit_id,
			trace_id: options.trace_id,
			sandbox_id: handle.id,
			files: files.map((file) => ({
				path: file.path,
				bytes: typeof file.content === "string" ? Buffer.byteLength(file.content) : file.content.byteLength
			})),
			totalBytes
		});
		return files;
	}
	async destroy(handle) {
		const sandbox = this.sandboxes.get(handle.id);
		if (sandbox) try {
			await sandbox.kill();
		} finally {
			await sandbox.close();
			this.sandboxes.delete(handle.id);
		}
		await this.audit("sandbox_destroy", {
			audit_id: handle.audit_id,
			trace_id: handle.trace_id,
			sandbox_id: handle.id,
			retained: false
		});
	}
	lookup(handle) {
		const sandbox = this.sandboxes.get(handle.id);
		if (!sandbox) throw new SandboxRuntimeError(`unknown opensandbox handle: ${handle.id}`);
		return sandbox;
	}
	async enforcePolicy(spec) {
		const decision = await evaluatePolicy({
			tenant: process.env.EAP_SANDBOX_TENANT ?? "acme",
			image: spec.image,
			egress: spec.network.egress,
			policy_id: spec.network.policyId ?? "",
			env_keys: Object.keys(spec.env ?? {}).sort()
		}, "policy/sandbox.rego", "data.eap.sandbox");
		if (!decision.allow || decision.requires_approval) throw new SandboxRuntimeError(`sandbox policy denied: ${decision.reasons.join(",")}`);
	}
	async audit(type, event) {
		await appendAudit(this.auditLog, {
			type,
			...event
		});
	}
};
function toOpenSandboxNetworkPolicy(spec) {
	return { defaultAction: spec.network.egress === "deny" ? "deny" : "allow" };
}
function remotePath(requested) {
	if (requested.startsWith("/") || requested === ".." || requested.startsWith("../") || requested.includes("/../")) throw new SandboxRuntimeError(`path escapes sandbox: ${requested}`);
	return `${remoteRoot}/${requested}`;
}
function shellCommand(argv) {
	return `/bin/sh -lc ${shellQuote(argv.map(shellQuote).join(" "))}`;
}
function shellQuote(value) {
	return `'${value.replaceAll("'", "'\\''")}'`;
}
function toExecResult(execution) {
	return {
		exitCode: execution.exitCode ?? (execution.error ? 1 : 0),
		stdout: execution.logs.stdout.map(outputText).join(""),
		stderr: [...execution.logs.stderr.map(outputText), ...execution.error ? [`${execution.error.name}: ${execution.error.value}`] : []].join("")
	};
}
function outputText(message) {
	return message.text ?? "";
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region src/lib/sandbox.ts
/** Sandbox execution boundary for remediation workspace operations. */
var execFileAsync = promisify(execFile);
var SandboxRuntimeError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "SandboxRuntimeError";
	}
};
var LocalWorkspaceExecutor = class {
	auditLog;
	constructor(options = {}) {
		this.auditLog = options.auditLog ?? "artifacts/audit/remediation.jsonl";
	}
	async create(spec) {
		const workspace = resolve("artifacts/demo/workspace", `local-${process.pid}-${randomUUID()}`);
		await mkdir(workspace, { recursive: true });
		const handle = {
			id: workspace,
			runtime: "local",
			audit_id: spec.audit_id,
			trace_id: spec.trace_id
		};
		await this.audit("sandbox_create", {
			audit_id: spec.audit_id,
			trace_id: spec.trace_id,
			runtime: handle.runtime,
			workspace,
			image: spec.image,
			limits: spec.limits,
			network: spec.network,
			envKeys: Object.keys(spec.env ?? {}).sort()
		});
		return handle;
	}
	async putFiles(handle, files) {
		const written = [];
		for (const file of files) {
			const target = confinedPath(handle.id, file.path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, file.content, file.mode ? { mode: file.mode } : void 0);
			const bytes = typeof file.content === "string" ? Buffer.byteLength(file.content) : file.content.byteLength;
			written.push({
				path: file.path,
				bytes,
				sha256: digest(file.content)
			});
		}
		await this.audit("sandbox_put_files", {
			audit_id: handle.audit_id,
			trace_id: handle.trace_id,
			sandbox_id: handle.id,
			files: written
		});
	}
	async exec(handle, argv, options) {
		if (argv.length === 0) throw new SandboxRuntimeError("argv must not be empty");
		const command = argv[0];
		if (!command) throw new SandboxRuntimeError("argv must not be empty");
		const args = argv.slice(1);
		try {
			const { stdout, stderr } = await execFileAsync(command, args, {
				cwd: handle.id,
				maxBuffer: 1024 * 1024,
				timeout: options.timeoutMs
			});
			const result = {
				exitCode: 0,
				stdout,
				stderr
			};
			await this.auditExec(handle, argv, options, result);
			return result;
		} catch (error) {
			const err = error;
			const result = {
				exitCode: typeof err.code === "number" ? err.code : 1,
				stdout: err.stdout ?? "",
				stderr: err.stderr ?? ""
			};
			await this.auditExec(handle, argv, options, result);
			return result;
		}
	}
	async collectArtifacts(handle, paths, options) {
		let totalBytes = 0;
		const files = [];
		const auditFiles = [];
		for (const path of paths) {
			const content = await readFile(confinedPath(handle.id, path), "utf8");
			const bytes = Buffer.byteLength(content);
			totalBytes += bytes;
			if (totalBytes > options.maxBytes) throw new SandboxRuntimeError("artifact size exceeds maxBytes");
			files.push({
				path,
				content
			});
			auditFiles.push({
				path,
				bytes,
				sha256: digest(content)
			});
		}
		await this.audit("sandbox_collect", {
			audit_id: options.audit_id,
			trace_id: options.trace_id,
			sandbox_id: handle.id,
			files: auditFiles,
			totalBytes
		});
		return files;
	}
	async destroy(handle) {
		await this.audit("sandbox_destroy", {
			audit_id: handle.audit_id,
			trace_id: handle.trace_id,
			sandbox_id: handle.id,
			retained: true
		});
	}
	async audit(type, event) {
		await appendAudit(this.auditLog, {
			type,
			...event
		});
	}
	async auditExec(handle, argv, options, result) {
		await this.audit("sandbox_exec", {
			audit_id: options.audit_id,
			trace_id: options.trace_id,
			sandbox_id: handle.id,
			argvDigest: digest(argv.join("\0")),
			command: basename(argv[0] ?? "unknown"),
			exitCode: result.exitCode
		});
	}
};
function getSandboxExecutor(options = {}) {
	const runtime = process.env.EAP_SANDBOX_RUNTIME ?? "local";
	if (runtime === "local") return new LocalWorkspaceExecutor(options);
	if (runtime === "opensandbox") return new OpenSandboxExecutor(options);
	throw new SandboxRuntimeError(`Unknown sandbox runtime: ${runtime}`);
}
function confinedPath(root, requested) {
	const target = resolve(root, requested);
	const rel = relative(root, target);
	if (rel.startsWith("..") || rel === "" || rel.startsWith(`..${resolve("/")}`)) throw new SandboxRuntimeError(`path escapes sandbox: ${requested}`);
	return target;
}
function digest(content) {
	return createHash("sha256").update(content).digest("hex");
}
//#endregion
//#region src/lib/telemetry.ts
/** OpenTelemetry file exporter used by release-gated local validation. */
var JsonlSpanExporter = class {
	path;
	constructor(path) {
		this.path = path;
		mkdirSync(dirname(path), { recursive: true });
	}
	export(spans, resultCallback) {
		for (const span of spans) appendFileSync(this.path, `${JSON.stringify({
			name: span.name,
			traceId: span.spanContext().traceId,
			spanId: span.spanContext().spanId,
			attributes: span.attributes,
			status: span.status
		})}\n`, "utf8");
		resultCallback({ code: 0 });
	}
	shutdown() {
		return Promise.resolve();
	}
};
var registered = false;
function configureTelemetry(tracePath) {
	if (!registered) {
		new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(new JsonlSpanExporter(tracePath))] }).register();
		registered = true;
	}
	return tracePath;
}
async function withSpan(name, attributes, body) {
	return trace.getTracer("flue-pi-evidence-platform").startActiveSpan(name, { attributes }, async (span) => {
		try {
			const result = await body();
			span.setStatus({ code: SpanStatusCode.OK });
			return result;
		} catch (error) {
			span.recordException(error);
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: String(error)
			});
			throw error;
		} finally {
			span.end();
		}
	});
}
//#endregion
//#region src/workflows/remediate.ts
var remediate_exports = /* @__PURE__ */ __exportAll({ run: () => run$1 });
async function run$1({ init, log, payload }) {
	const auditLog = "artifacts/audit/remediation.jsonl";
	const ledgerPath = "artifacts/demo/hypothesis-ledger.json";
	const tracePath = configureTelemetry("artifacts/telemetry/traces.jsonl");
	const runId = `run-${Date.now()}`;
	const auditId = runId;
	const traceId = runId;
	const sandboxExecutor = getSandboxExecutor({ auditLog });
	let sandboxHandle;
	const workspaceFiles = await readWorkspaceFiles(payload.workspace);
	const gateway = await startLocalGateway("Verified remediation: all localized hypotheses were patched, tests passed, data path enforced SQL and PII policy.");
	try {
		await appendAudit(auditLog, {
			type: "run_start",
			payload
		});
		const workspace = await withSpan("workspace.prepare", { workspace: payload.workspace }, async () => {
			sandboxHandle = await sandboxExecutor.create({
				image: {
					name: "local-workspace",
					tag: "validate-release",
					digest: "sha256:local"
				},
				limits: {
					cpu: "1",
					memoryMb: 1024,
					timeoutMs: 3e4
				},
				network: { egress: "deny" },
				audit_id: auditId,
				trace_id: traceId
			});
			await sandboxExecutor.putFiles(sandboxHandle, workspaceFiles);
			return sandboxHandle.id;
		});
		let ledger = createLedger(runId);
		const localized = await withSpan("code.localize", { workspace }, () => scanWorkspace(workspace));
		ledger = addHypotheses(ledger, localized);
		ledger = addEvidence(ledger, {
			id: "EV-CODE-SCAN-001",
			kind: "source",
			summary: `Code scan localized ${localized.length} hypotheses.`,
			location: workspace,
			linkedHypotheses: localized.map((item) => item.id)
		});
		const testTargets = workspaceFiles.map((file) => file.path).filter((path) => path.startsWith("tests/") && path.endsWith(".py")).sort();
		const impactTarget = testTargets.length > 0 ? testTargets.join(", ") : "";
		for (const hypothesis of localized) ledger = addImpactEdge(ledger, {
			from: hypothesis.affectedSymbol,
			to: impactTarget,
			reason: "Regression tests exercise the affected public function."
		});
		log.info("Hypotheses localized", { count: localized.length });
		await appendAudit(auditLog, {
			type: "hypotheses_localized",
			hypotheses: localized
		});
		const policyDecision = await withSpan("policy.opa.evaluate", { tool: "apply_patch" }, () => evaluatePolicy({
			user: payload.user,
			tenant: payload.tenant,
			tool: "apply_patch",
			risk: "medium",
			resource: workspace
		}));
		ledger = addEvidence(ledger, {
			id: "EV-OPA-001",
			kind: "policy",
			summary: `OPA decision allow=${policyDecision.allow} approval=${policyDecision.requires_approval}`
		});
		await appendAudit(auditLog, {
			type: "policy_decision",
			policyDecision
		});
		if (!policyDecision.allow || policyDecision.requires_approval) {
			const closure = closureGate(ledger);
			await saveLedger(ledgerPath, ledger);
			return {
				status: "needs_review",
				agentSummary: "Policy prevented automatic remediation.",
				hypotheses: localized,
				closure,
				policyDecision,
				verification: {
					passed: false,
					command: "not executed",
					stdout: "",
					stderr: "policy blocked",
					exitCode: 1
				},
				dataQuery: {
					metric: "not executed",
					rows: [],
					piiDetected: false,
					redactedText: "",
					rejectedUnsafeSql: false,
					rejectedMutationSql: false,
					rejectedMultiStatementSql: false
				},
				auditLog,
				ledgerPath,
				tracePath,
				flueGatewayRequests: gateway.requests.length
			};
		}
		const candidates = proposePatchCandidates(localized);
		for (const candidate of candidates) ledger = addPatchCandidate(ledger, candidate);
		const applied = await withSpan("code.patch.apply", { candidates: candidates.length }, () => applySelectedPatches(workspace, candidates));
		for (const patchId of applied.appliedPatchIds) ledger = markPatchApplied(ledger, patchId);
		ledger = markHypothesesPatched(ledger, applied.hypothesesPatched);
		ledger = addEvidence(ledger, {
			id: "EV-PATCH-FANOUT-001",
			kind: "agent",
			summary: `${candidates.length} patch candidates generated; ${applied.appliedPatchIds.length} selected and applied.`,
			linkedHypotheses: applied.hypothesesPatched
		});
		const verification = await withSpan("verification.pytest", { workspace }, () => verifyWorkspaceWithExecutor(sandboxExecutor, requireSandboxHandle(sandboxHandle)));
		ledger = markHypothesesVerified(ledger, verification);
		ledger = addEvidence(ledger, {
			id: "EV-VERIFY-001",
			kind: "verification",
			summary: `Verifier ${verification.command} passed=${verification.passed}`,
			location: workspace
		});
		const remaining = await withSpan("code.rescan", { workspace }, () => scanWorkspace(workspace));
		await sandboxExecutor.collectArtifacts(requireSandboxHandle(sandboxHandle), sourceArtifactPaths(workspace, localized), {
			maxBytes: 1024 * 1024,
			audit_id: auditId,
			trace_id: traceId
		});
		ledger = addEvidence(ledger, {
			id: "EV-RESCAN-001",
			kind: "impact",
			summary: `Rescan remaining hypotheses=${remaining.length}`,
			location: workspace
		});
		const dataQuery = await withSpan("data.guard.metric_query", { metric: "active_users_by_plan" }, () => metricQuery());
		ledger = addEvidence(ledger, {
			id: "EV-DATA-PROXY-001",
			kind: "data",
			summary: `SQLGlot/DuckDB/Presidio path executed metric=${dataQuery.metric}; PII redacted=${dataQuery.piiDetected}`
		});
		const closure = closureGate(ledger);
		await saveLedger(ledgerPath, ledger);
		const harness = await init(remediator_default);
		await harness.fs.writeFile("evidence.json", JSON.stringify({
			ledger,
			verification,
			dataQuery,
			closure
		}, null, 2));
		const agentResponse = await (await harness.session()).prompt("Summarize the verified remediation from evidence.json.");
		const status = verification.passed && remaining.length === 0 && dataQuery.rejectedUnsafeSql && dataQuery.rejectedMutationSql && dataQuery.rejectedMultiStatementSql && closure.closed ? "passed" : "failed";
		await appendAudit(auditLog, {
			type: "run_end",
			status,
			verification,
			dataQuery,
			closure,
			remaining
		});
		return {
			status,
			agentSummary: agentResponse.text,
			hypotheses: ledger.hypotheses,
			closure,
			policyDecision,
			verification,
			dataQuery,
			auditLog,
			ledgerPath,
			tracePath,
			flueGatewayRequests: gateway.requests.length
		};
	} finally {
		if (sandboxHandle) await sandboxExecutor.destroy(sandboxHandle);
		await gateway.close();
	}
}
function requireSandboxHandle(handle) {
	if (!handle) throw new Error("sandbox handle is unavailable");
	return handle;
}
//#endregion
//#region src/workflows/smoke.ts
/** Flue/Pi smoke workflow that exercises Pi through an OpenAI-compatible local gateway. */
var smoke_exports = /* @__PURE__ */ __exportAll({ run: () => run });
var agent = createAgent(() => ({
	model: "local-gateway/fixbot",
	instructions: "Return concise text."
}));
async function run({ init, payload }) {
	const gateway = await startLocalGateway(`ack:${payload.text}`);
	try {
		return {
			text: (await (await (await init(agent)).session()).prompt(payload.text)).text,
			gatewayRequests: gateway.requests.length
		};
	} finally {
		await gateway.close();
	}
}
//#endregion
//#region node_modules/hono/dist/cjs/compose.js
var require_compose = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var compose_exports = {};
	__export(compose_exports, { compose: () => compose });
	module.exports = __toCommonJS(compose_exports);
	var compose = (middleware, onError, onNotFound) => {
		return (context, next) => {
			let index = -1;
			return dispatch(0);
			async function dispatch(i) {
				if (i <= index) throw new Error("next() called multiple times");
				index = i;
				let res;
				let isError = false;
				let handler;
				if (middleware[i]) {
					handler = middleware[i][0][0];
					context.req.routeIndex = i;
				} else handler = i === middleware.length && next || void 0;
				if (handler) try {
					res = await handler(context, () => dispatch(i + 1));
				} catch (err) {
					if (err instanceof Error && onError) {
						context.error = err;
						res = await onError(err, context);
						isError = true;
					} else throw err;
				}
				else if (context.finalized === false && onNotFound) res = await onNotFound(context);
				if (res && (context.finalized === false || isError)) context.res = res;
				return context;
			}
		};
	};
	0 && (module.exports = { compose });
}));
//#endregion
//#region node_modules/hono/dist/cjs/http-exception.js
var require_http_exception = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var http_exception_exports = {};
	__export(http_exception_exports, { HTTPException: () => HTTPException });
	module.exports = __toCommonJS(http_exception_exports);
	var HTTPException = class extends Error {
		res;
		status;
		/**
		* Creates an instance of `HTTPException`.
		* @param status - HTTP status code for the exception. Defaults to 500.
		* @param options - Additional options for the exception.
		*/
		constructor(status = 500, options) {
			super(options?.message, { cause: options?.cause });
			this.res = options?.res;
			this.status = status;
		}
		/**
		* Returns the response object associated with the exception.
		* If a response object is not provided, a new response is created with the error message and status code.
		* @returns The response object.
		*/
		getResponse() {
			if (this.res) return new Response(this.res.body, {
				status: this.status,
				headers: this.res.headers
			});
			return new Response(this.message, { status: this.status });
		}
	};
	0 && (module.exports = { HTTPException });
}));
//#endregion
//#region node_modules/hono/dist/cjs/request/constants.js
var require_constants$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var constants_exports = {};
	__export(constants_exports, { GET_MATCH_RESULT: () => GET_MATCH_RESULT });
	module.exports = __toCommonJS(constants_exports);
	var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();
	0 && (module.exports = { GET_MATCH_RESULT });
}));
//#endregion
//#region node_modules/hono/dist/cjs/utils/body.js
var require_body = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var body_exports = {};
	__export(body_exports, { parseBody: () => parseBody });
	module.exports = __toCommonJS(body_exports);
	var import_request = require_request();
	var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
		const { all = false, dot = false } = options;
		const contentType = (request instanceof import_request.HonoRequest ? request.raw.headers : request.headers).get("Content-Type");
		if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) return parseFormData(request, {
			all,
			dot
		});
		return {};
	};
	async function parseFormData(request, options) {
		const formData = await request.formData();
		if (formData) return convertFormDataToBodyData(formData, options);
		return {};
	}
	function convertFormDataToBodyData(formData, options) {
		const form = /* @__PURE__ */ Object.create(null);
		formData.forEach((value, key) => {
			if (!(options.all || key.endsWith("[]"))) form[key] = value;
			else handleParsingAllValues(form, key, value);
		});
		if (options.dot) Object.entries(form).forEach(([key, value]) => {
			if (key.includes(".")) {
				handleParsingNestedValues(form, key, value);
				delete form[key];
			}
		});
		return form;
	}
	var handleParsingAllValues = (form, key, value) => {
		if (form[key] !== void 0) if (Array.isArray(form[key])) form[key].push(value);
		else form[key] = [form[key], value];
		else if (!key.endsWith("[]")) form[key] = value;
		else form[key] = [value];
	};
	var handleParsingNestedValues = (form, key, value) => {
		if (/(?:^|\.)__proto__\./.test(key)) return;
		let nestedForm = form;
		const keys = key.split(".");
		keys.forEach((key2, index) => {
			if (index === keys.length - 1) nestedForm[key2] = value;
			else {
				if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) nestedForm[key2] = /* @__PURE__ */ Object.create(null);
				nestedForm = nestedForm[key2];
			}
		});
	};
	0 && (module.exports = { parseBody });
}));
//#endregion
//#region node_modules/hono/dist/cjs/utils/url.js
var require_url = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var url_exports = {};
	__export(url_exports, {
		checkOptionalParameter: () => checkOptionalParameter,
		decodeURIComponent_: () => decodeURIComponent_,
		getPath: () => getPath,
		getPathNoStrict: () => getPathNoStrict,
		getPattern: () => getPattern,
		getQueryParam: () => getQueryParam,
		getQueryParams: () => getQueryParams,
		getQueryStrings: () => getQueryStrings,
		mergePath: () => mergePath,
		splitPath: () => splitPath,
		splitRoutingPath: () => splitRoutingPath,
		tryDecode: () => tryDecode,
		tryDecodeURI: () => tryDecodeURI
	});
	module.exports = __toCommonJS(url_exports);
	var splitPath = (path) => {
		const paths = path.split("/");
		if (paths[0] === "") paths.shift();
		return paths;
	};
	var splitRoutingPath = (routePath) => {
		const { groups, path } = extractGroupsFromPath(routePath);
		return replaceGroupMarks(splitPath(path), groups);
	};
	var extractGroupsFromPath = (path) => {
		const groups = [];
		path = path.replace(/\{[^}]+\}/g, (match, index) => {
			const mark = `@${index}`;
			groups.push([mark, match]);
			return mark;
		});
		return {
			groups,
			path
		};
	};
	var replaceGroupMarks = (paths, groups) => {
		for (let i = groups.length - 1; i >= 0; i--) {
			const [mark] = groups[i];
			for (let j = paths.length - 1; j >= 0; j--) if (paths[j].includes(mark)) {
				paths[j] = paths[j].replace(mark, groups[i][1]);
				break;
			}
		}
		return paths;
	};
	var patternCache = {};
	var getPattern = (label, next) => {
		if (label === "*") return "*";
		const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
		if (match) {
			const cacheKey = `${label}#${next}`;
			if (!patternCache[cacheKey]) if (match[2]) patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [
				cacheKey,
				match[1],
				new RegExp(`^${match[2]}(?=/${next})`)
			] : [
				label,
				match[1],
				new RegExp(`^${match[2]}$`)
			];
			else patternCache[cacheKey] = [
				label,
				match[1],
				true
			];
			return patternCache[cacheKey];
		}
		return null;
	};
	var tryDecode = (str, decoder) => {
		try {
			return decoder(str);
		} catch {
			return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
				try {
					return decoder(match);
				} catch {
					return match;
				}
			});
		}
	};
	var tryDecodeURI = (str) => tryDecode(str, decodeURI);
	var getPath = (request) => {
		const url = request.url;
		const start = url.indexOf("/", url.indexOf(":") + 4);
		let i = start;
		for (; i < url.length; i++) {
			const charCode = url.charCodeAt(i);
			if (charCode === 37) {
				const queryIndex = url.indexOf("?", i);
				const hashIndex = url.indexOf("#", i);
				const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
				const path = url.slice(start, end);
				return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
			} else if (charCode === 63 || charCode === 35) break;
		}
		return url.slice(start, i);
	};
	var getQueryStrings = (url) => {
		const queryIndex = url.indexOf("?", 8);
		return queryIndex === -1 ? "" : "?" + url.slice(queryIndex + 1);
	};
	var getPathNoStrict = (request) => {
		const result = getPath(request);
		return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
	};
	var mergePath = (base, sub, ...rest) => {
		if (rest.length) sub = mergePath(sub, ...rest);
		return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
	};
	var checkOptionalParameter = (path) => {
		if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) return null;
		const segments = path.split("/");
		const results = [];
		let basePath = "";
		segments.forEach((segment) => {
			if (segment !== "" && !/\:/.test(segment)) basePath += "/" + segment;
			else if (/\:/.test(segment)) if (/\?/.test(segment)) {
				if (results.length === 0 && basePath === "") results.push("/");
				else results.push(basePath);
				const optionalSegment = segment.replace("?", "");
				basePath += "/" + optionalSegment;
				results.push(basePath);
			} else basePath += "/" + segment;
		});
		return results.filter((v, i, a) => a.indexOf(v) === i);
	};
	var _decodeURI = (value) => {
		if (!/[%+]/.test(value)) return value;
		if (value.indexOf("+") !== -1) value = value.replace(/\+/g, " ");
		return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
	};
	var _getQueryParam = (url, key, multiple) => {
		let encoded;
		if (!multiple && key && !/[%+]/.test(key)) {
			let keyIndex2 = url.indexOf("?", 8);
			if (keyIndex2 === -1) return;
			if (!url.startsWith(key, keyIndex2 + 1)) keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
			while (keyIndex2 !== -1) {
				const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
				if (trailingKeyCode === 61) {
					const valueIndex = keyIndex2 + key.length + 2;
					const endIndex = url.indexOf("&", valueIndex);
					return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
				} else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) return "";
				keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
			}
			encoded = /[%+]/.test(url);
			if (!encoded) return;
		}
		const results = {};
		encoded ??= /[%+]/.test(url);
		let keyIndex = url.indexOf("?", 8);
		while (keyIndex !== -1) {
			const nextKeyIndex = url.indexOf("&", keyIndex + 1);
			let valueIndex = url.indexOf("=", keyIndex);
			if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) valueIndex = -1;
			let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex);
			if (encoded) name = _decodeURI(name);
			keyIndex = nextKeyIndex;
			if (name === "") continue;
			let value;
			if (valueIndex === -1) value = "";
			else {
				value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
				if (encoded) value = _decodeURI(value);
			}
			if (multiple) {
				if (!(results[name] && Array.isArray(results[name]))) results[name] = [];
				results[name].push(value);
			} else results[name] ??= value;
		}
		return key ? results[key] : results;
	};
	var getQueryParam = _getQueryParam;
	var getQueryParams = (url, key) => {
		return _getQueryParam(url, key, true);
	};
	var decodeURIComponent_ = decodeURIComponent;
	0 && (module.exports = {
		checkOptionalParameter,
		decodeURIComponent_,
		getPath,
		getPathNoStrict,
		getPattern,
		getQueryParam,
		getQueryParams,
		getQueryStrings,
		mergePath,
		splitPath,
		splitRoutingPath,
		tryDecode,
		tryDecodeURI
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/request.js
var require_request = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var request_exports = {};
	__export(request_exports, {
		HonoRequest: () => HonoRequest,
		cloneRawRequest: () => cloneRawRequest
	});
	module.exports = __toCommonJS(request_exports);
	var import_http_exception = require_http_exception();
	var import_constants = require_constants$1();
	var import_body = require_body();
	var import_url = require_url();
	var tryDecodeURIComponent = (str) => (0, import_url.tryDecode)(str, import_url.decodeURIComponent_);
	var HonoRequest = class {
		/**
		* `.raw` can get the raw Request object.
		*
		* @see {@link https://hono.dev/docs/api/request#raw}
		*
		* @example
		* ```ts
		* // For Cloudflare Workers
		* app.post('/', async (c) => {
		*   const metadata = c.req.raw.cf?.hostMetadata?
		*   ...
		* })
		* ```
		*/
		raw;
		#validatedData;
		#matchResult;
		routeIndex = 0;
		/**
		* `.path` can get the pathname of the request.
		*
		* @see {@link https://hono.dev/docs/api/request#path}
		*
		* @example
		* ```ts
		* app.get('/about/me', (c) => {
		*   const pathname = c.req.path // `/about/me`
		* })
		* ```
		*/
		path;
		bodyCache = {};
		constructor(request, path = "/", matchResult = [[]]) {
			this.raw = request;
			this.path = path;
			this.#matchResult = matchResult;
			this.#validatedData = {};
		}
		param(key) {
			return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
		}
		#getDecodedParam(key) {
			const paramKey = this.#matchResult[0][this.routeIndex][1][key];
			const param = this.#getParamValue(paramKey);
			return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
		}
		#getAllDecodedParams() {
			const decoded = {};
			const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
			for (const key of keys) {
				const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
				if (value !== void 0) decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
			}
			return decoded;
		}
		#getParamValue(paramKey) {
			return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
		}
		query(key) {
			return (0, import_url.getQueryParam)(this.url, key);
		}
		queries(key) {
			return (0, import_url.getQueryParams)(this.url, key);
		}
		header(name) {
			if (name) return this.raw.headers.get(name) ?? void 0;
			const headerData = {};
			this.raw.headers.forEach((value, key) => {
				headerData[key] = value;
			});
			return headerData;
		}
		async parseBody(options) {
			return (0, import_body.parseBody)(this, options);
		}
		#cachedBody = (key) => {
			const { bodyCache, raw } = this;
			const cachedBody = bodyCache[key];
			if (cachedBody) return cachedBody;
			const anyCachedKey = Object.keys(bodyCache)[0];
			if (anyCachedKey) return bodyCache[anyCachedKey].then((body) => {
				if (anyCachedKey === "json") body = JSON.stringify(body);
				return new Response(body)[key]();
			});
			return bodyCache[key] = raw[key]();
		};
		/**
		* `.json()` can parse Request body of type `application/json`
		*
		* @see {@link https://hono.dev/docs/api/request#json}
		*
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.json()
		* })
		* ```
		*/
		json() {
			return this.#cachedBody("text").then((text) => JSON.parse(text));
		}
		/**
		* `.text()` can parse Request body of type `text/plain`
		*
		* @see {@link https://hono.dev/docs/api/request#text}
		*
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.text()
		* })
		* ```
		*/
		text() {
			return this.#cachedBody("text");
		}
		/**
		* `.arrayBuffer()` parse Request body as an `ArrayBuffer`
		*
		* @see {@link https://hono.dev/docs/api/request#arraybuffer}
		*
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.arrayBuffer()
		* })
		* ```
		*/
		arrayBuffer() {
			return this.#cachedBody("arrayBuffer");
		}
		/**
		* `.bytes()` parses the request body as a `Uint8Array`.
		*
		* @see {@link https://hono.dev/docs/api/request#bytes}
		*
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.bytes()
		* })
		* ```
		*/
		bytes() {
			return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
		}
		/**
		* Parses the request body as a `Blob`.
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.blob();
		* });
		* ```
		* @see https://hono.dev/docs/api/request#blob
		*/
		blob() {
			return this.#cachedBody("blob");
		}
		/**
		* Parses the request body as `FormData`.
		* @example
		* ```ts
		* app.post('/entry', async (c) => {
		*   const body = await c.req.formData();
		* });
		* ```
		* @see https://hono.dev/docs/api/request#formdata
		*/
		formData() {
			return this.#cachedBody("formData");
		}
		/**
		* Adds validated data to the request.
		*
		* @param target - The target of the validation.
		* @param data - The validated data to add.
		*/
		addValidatedData(target, data) {
			this.#validatedData[target] = data;
		}
		valid(target) {
			return this.#validatedData[target];
		}
		/**
		* `.url()` can get the request url strings.
		*
		* @see {@link https://hono.dev/docs/api/request#url}
		*
		* @example
		* ```ts
		* app.get('/about/me', (c) => {
		*   const url = c.req.url // `http://localhost:8787/about/me`
		*   ...
		* })
		* ```
		*/
		get url() {
			return this.raw.url;
		}
		/**
		* `.method()` can get the method name of the request.
		*
		* @see {@link https://hono.dev/docs/api/request#method}
		*
		* @example
		* ```ts
		* app.get('/about/me', (c) => {
		*   const method = c.req.method // `GET`
		* })
		* ```
		*/
		get method() {
			return this.raw.method;
		}
		get [import_constants.GET_MATCH_RESULT]() {
			return this.#matchResult;
		}
		/**
		* `.matchedRoutes()` can return a matched route in the handler
		*
		* @deprecated
		*
		* Use matchedRoutes helper defined in "hono/route" instead.
		*
		* @see {@link https://hono.dev/docs/api/request#matchedroutes}
		*
		* @example
		* ```ts
		* app.use('*', async function logger(c, next) {
		*   await next()
		*   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
		*     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
		*     console.log(
		*       method,
		*       ' ',
		*       path,
		*       ' '.repeat(Math.max(10 - path.length, 0)),
		*       name,
		*       i === c.req.routeIndex ? '<- respond from here' : ''
		*     )
		*   })
		* })
		* ```
		*/
		get matchedRoutes() {
			return this.#matchResult[0].map(([[, route]]) => route);
		}
		/**
		* `routePath()` can retrieve the path registered within the handler
		*
		* @deprecated
		*
		* Use routePath helper defined in "hono/route" instead.
		*
		* @see {@link https://hono.dev/docs/api/request#routepath}
		*
		* @example
		* ```ts
		* app.get('/posts/:id', (c) => {
		*   return c.json({ path: c.req.routePath })
		* })
		* ```
		*/
		get routePath() {
			return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
		}
	};
	var cloneRawRequest = async (req) => {
		if (!req.raw.bodyUsed) return req.raw.clone();
		const cacheKey = Object.keys(req.bodyCache)[0];
		if (!cacheKey) throw new import_http_exception.HTTPException(500, { message: "Cannot clone request: body was already consumed and not cached. Please use HonoRequest methods (e.g., req.json(), req.text()) instead of consuming req.raw directly." });
		const requestInit = {
			body: await req[cacheKey](),
			cache: req.raw.cache,
			credentials: req.raw.credentials,
			headers: req.header(),
			integrity: req.raw.integrity,
			keepalive: req.raw.keepalive,
			method: req.method,
			mode: req.raw.mode,
			redirect: req.raw.redirect,
			referrer: req.raw.referrer,
			referrerPolicy: req.raw.referrerPolicy,
			signal: req.raw.signal
		};
		return new Request(req.url, requestInit);
	};
	0 && (module.exports = {
		HonoRequest,
		cloneRawRequest
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/utils/html.js
var require_html = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var html_exports = {};
	__export(html_exports, {
		HtmlEscapedCallbackPhase: () => HtmlEscapedCallbackPhase,
		escapeToBuffer: () => escapeToBuffer,
		raw: () => raw,
		resolveCallback: () => resolveCallback,
		resolveCallbackSync: () => resolveCallbackSync,
		stringBufferToString: () => stringBufferToString
	});
	module.exports = __toCommonJS(html_exports);
	var HtmlEscapedCallbackPhase = {
		Stringify: 1,
		BeforeStream: 2,
		Stream: 3
	};
	var raw = (value, callbacks) => {
		const escapedString = new String(value);
		escapedString.isEscaped = true;
		escapedString.callbacks = callbacks;
		return escapedString;
	};
	var escapeRe = /[&<>'"]/;
	var stringBufferToString = async (buffer, callbacks) => {
		let str = "";
		callbacks ||= [];
		const resolvedBuffer = await Promise.all(buffer);
		for (let i = resolvedBuffer.length - 1;; i--) {
			str += resolvedBuffer[i];
			i--;
			if (i < 0) break;
			let r = resolvedBuffer[i];
			if (typeof r === "object") callbacks.push(...r.callbacks || []);
			const isEscaped = r.isEscaped;
			r = await (typeof r === "object" ? r.toString() : r);
			if (typeof r === "object") callbacks.push(...r.callbacks || []);
			if (r.isEscaped ?? isEscaped) str += r;
			else {
				const buf = [str];
				escapeToBuffer(r, buf);
				str = buf[0];
			}
		}
		return raw(str, callbacks);
	};
	var escapeToBuffer = (str, buffer) => {
		const match = str.search(escapeRe);
		if (match === -1) {
			buffer[0] += str;
			return;
		}
		let escape;
		let index;
		let lastIndex = 0;
		for (index = match; index < str.length; index++) {
			switch (str.charCodeAt(index)) {
				case 34:
					escape = "&quot;";
					break;
				case 39:
					escape = "&#39;";
					break;
				case 38:
					escape = "&amp;";
					break;
				case 60:
					escape = "&lt;";
					break;
				case 62:
					escape = "&gt;";
					break;
				default: continue;
			}
			buffer[0] += str.substring(lastIndex, index) + escape;
			lastIndex = index + 1;
		}
		buffer[0] += str.substring(lastIndex, index);
	};
	var resolveCallbackSync = (str) => {
		const callbacks = str.callbacks;
		if (!callbacks?.length) return str;
		const buffer = [str];
		const context = {};
		callbacks.forEach((c) => c({
			phase: HtmlEscapedCallbackPhase.Stringify,
			buffer,
			context
		}));
		return buffer[0];
	};
	var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
		if (typeof str === "object" && !(str instanceof String)) {
			if (!(str instanceof Promise)) str = str.toString();
			if (str instanceof Promise) str = await str;
		}
		const callbacks = str.callbacks;
		if (!callbacks?.length) return Promise.resolve(str);
		if (buffer) buffer[0] += str;
		else buffer = [str];
		const resStr = Promise.all(callbacks.map((c) => c({
			phase,
			buffer,
			context
		}))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
		if (preserveCallbacks) return raw(await resStr, callbacks);
		else return resStr;
	};
	0 && (module.exports = {
		HtmlEscapedCallbackPhase,
		escapeToBuffer,
		raw,
		resolveCallback,
		resolveCallbackSync,
		stringBufferToString
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/context.js
var require_context = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var context_exports = {};
	__export(context_exports, {
		Context: () => Context,
		TEXT_PLAIN: () => TEXT_PLAIN
	});
	module.exports = __toCommonJS(context_exports);
	var import_request = require_request();
	var import_html = require_html();
	var TEXT_PLAIN = "text/plain; charset=UTF-8";
	var setDefaultContentType = (contentType, headers) => {
		return {
			"Content-Type": contentType,
			...headers
		};
	};
	var createResponseInstance = (body, init) => new Response(body, init);
	var Context = class {
		#rawRequest;
		#req;
		/**
		* `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
		*
		* @see {@link https://hono.dev/docs/api/context#env}
		*
		* @example
		* ```ts
		* // Environment object for Cloudflare Workers
		* app.get('*', async c => {
		*   const counter = c.env.COUNTER
		* })
		* ```
		*/
		env = {};
		#var;
		finalized = false;
		/**
		* `.error` can get the error object from the middleware if the Handler throws an error.
		*
		* @see {@link https://hono.dev/docs/api/context#error}
		*
		* @example
		* ```ts
		* app.use('*', async (c, next) => {
		*   await next()
		*   if (c.error) {
		*     // do something...
		*   }
		* })
		* ```
		*/
		error;
		#status;
		#executionCtx;
		#res;
		#layout;
		#renderer;
		#notFoundHandler;
		#preparedHeaders;
		#matchResult;
		#path;
		/**
		* Creates an instance of the Context class.
		*
		* @param req - The Request object.
		* @param options - Optional configuration options for the context.
		*/
		constructor(req, options) {
			this.#rawRequest = req;
			if (options) {
				this.#executionCtx = options.executionCtx;
				this.env = options.env;
				this.#notFoundHandler = options.notFoundHandler;
				this.#path = options.path;
				this.#matchResult = options.matchResult;
			}
		}
		/**
		* `.req` is the instance of {@link HonoRequest}.
		*/
		get req() {
			this.#req ??= new import_request.HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
			return this.#req;
		}
		/**
		* @see {@link https://hono.dev/docs/api/context#event}
		* The FetchEvent associated with the current request.
		*
		* @throws Will throw an error if the context does not have a FetchEvent.
		*/
		get event() {
			if (this.#executionCtx && "respondWith" in this.#executionCtx) return this.#executionCtx;
			else throw Error("This context has no FetchEvent");
		}
		/**
		* @see {@link https://hono.dev/docs/api/context#executionctx}
		* The ExecutionContext associated with the current request.
		*
		* @throws Will throw an error if the context does not have an ExecutionContext.
		*/
		get executionCtx() {
			if (this.#executionCtx) return this.#executionCtx;
			else throw Error("This context has no ExecutionContext");
		}
		/**
		* @see {@link https://hono.dev/docs/api/context#res}
		* The Response object for the current request.
		*/
		get res() {
			return this.#res ||= createResponseInstance(null, { headers: this.#preparedHeaders ??= new Headers() });
		}
		/**
		* Sets the Response object for the current request.
		*
		* @param _res - The Response object to set.
		*/
		set res(_res) {
			if (this.#res && _res) {
				_res = createResponseInstance(_res.body, _res);
				for (const [k, v] of this.#res.headers.entries()) {
					if (k === "content-type") continue;
					if (k === "set-cookie") {
						const cookies = this.#res.headers.getSetCookie();
						_res.headers.delete("set-cookie");
						for (const cookie of cookies) _res.headers.append("set-cookie", cookie);
					} else _res.headers.set(k, v);
				}
			}
			this.#res = _res;
			this.finalized = true;
		}
		/**
		* `.render()` can create a response within a layout.
		*
		* @see {@link https://hono.dev/docs/api/context#render-setrenderer}
		*
		* @example
		* ```ts
		* app.get('/', (c) => {
		*   return c.render('Hello!')
		* })
		* ```
		*/
		render = (...args) => {
			this.#renderer ??= (content) => this.html(content);
			return this.#renderer(...args);
		};
		/**
		* Sets the layout for the response.
		*
		* @param layout - The layout to set.
		* @returns The layout function.
		*/
		setLayout = (layout) => this.#layout = layout;
		/**
		* Gets the current layout for the response.
		*
		* @returns The current layout function.
		*/
		getLayout = () => this.#layout;
		/**
		* `.setRenderer()` can set the layout in the custom middleware.
		*
		* @see {@link https://hono.dev/docs/api/context#render-setrenderer}
		*
		* @example
		* ```tsx
		* app.use('*', async (c, next) => {
		*   c.setRenderer((content) => {
		*     return c.html(
		*       <html>
		*         <body>
		*           <p>{content}</p>
		*         </body>
		*       </html>
		*     )
		*   })
		*   await next()
		* })
		* ```
		*/
		setRenderer = (renderer) => {
			this.#renderer = renderer;
		};
		/**
		* `.header()` can set headers.
		*
		* @see {@link https://hono.dev/docs/api/context#header}
		*
		* @example
		* ```ts
		* app.get('/welcome', (c) => {
		*   // Set headers
		*   c.header('X-Message', 'Hello!')
		*   c.header('Content-Type', 'text/plain')
		*
		*   return c.body('Thank you for coming')
		* })
		* ```
		*/
		header = (name, value, options) => {
			if (this.finalized) this.#res = createResponseInstance(this.#res.body, this.#res);
			const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
			if (value === void 0) headers.delete(name);
			else if (options?.append) headers.append(name, value);
			else headers.set(name, value);
		};
		status = (status) => {
			this.#status = status;
		};
		/**
		* `.set()` can set the value specified by the key.
		*
		* @see {@link https://hono.dev/docs/api/context#set-get}
		*
		* @example
		* ```ts
		* app.use('*', async (c, next) => {
		*   c.set('message', 'Hono is hot!!')
		*   await next()
		* })
		* ```
		*/
		set = (key, value) => {
			this.#var ??= /* @__PURE__ */ new Map();
			this.#var.set(key, value);
		};
		/**
		* `.get()` can use the value specified by the key.
		*
		* @see {@link https://hono.dev/docs/api/context#set-get}
		*
		* @example
		* ```ts
		* app.get('/', (c) => {
		*   const message = c.get('message')
		*   return c.text(`The message is "${message}"`)
		* })
		* ```
		*/
		get = (key) => {
			return this.#var ? this.#var.get(key) : void 0;
		};
		/**
		* `.var` can access the value of a variable.
		*
		* @see {@link https://hono.dev/docs/api/context#var}
		*
		* @example
		* ```ts
		* const result = c.var.client.oneMethod()
		* ```
		*/
		get var() {
			if (!this.#var) return {};
			return Object.fromEntries(this.#var);
		}
		#newResponse(data, arg, headers) {
			const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
			if (typeof arg === "object" && "headers" in arg) {
				const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
				for (const [key, value] of argHeaders) if (key.toLowerCase() === "set-cookie") responseHeaders.append(key, value);
				else responseHeaders.set(key, value);
			}
			if (headers) for (const [k, v] of Object.entries(headers)) if (typeof v === "string") responseHeaders.set(k, v);
			else {
				responseHeaders.delete(k);
				for (const v2 of v) responseHeaders.append(k, v2);
			}
			return createResponseInstance(data, {
				status: typeof arg === "number" ? arg : arg?.status ?? this.#status,
				headers: responseHeaders
			});
		}
		newResponse = (...args) => this.#newResponse(...args);
		/**
		* `.body()` can return the HTTP response.
		* You can set headers with `.header()` and set HTTP status code with `.status`.
		* This can also be set in `.text()`, `.json()` and so on.
		*
		* @see {@link https://hono.dev/docs/api/context#body}
		*
		* @example
		* ```ts
		* app.get('/welcome', (c) => {
		*   // Set headers
		*   c.header('X-Message', 'Hello!')
		*   c.header('Content-Type', 'text/plain')
		*   // Set HTTP status code
		*   c.status(201)
		*
		*   // Return the response body
		*   return c.body('Thank you for coming')
		* })
		* ```
		*/
		body = (data, arg, headers) => this.#newResponse(data, arg, headers);
		/**
		* `.text()` can render text as `Content-Type:text/plain`.
		*
		* @see {@link https://hono.dev/docs/api/context#text}
		*
		* @example
		* ```ts
		* app.get('/say', (c) => {
		*   return c.text('Hello!')
		* })
		* ```
		*/
		text = (text, arg, headers) => {
			return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
		};
		/**
		* `.json()` can render JSON as `Content-Type:application/json`.
		*
		* @see {@link https://hono.dev/docs/api/context#json}
		*
		* @example
		* ```ts
		* app.get('/api', (c) => {
		*   return c.json({ message: 'Hello!' })
		* })
		* ```
		*/
		json = (object, arg, headers) => {
			return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
		};
		html = (html, arg, headers) => {
			const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
			return typeof html === "object" ? (0, import_html.resolveCallback)(html, import_html.HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
		};
		/**
		* `.redirect()` can Redirect, default status code is 302.
		*
		* @see {@link https://hono.dev/docs/api/context#redirect}
		*
		* @example
		* ```ts
		* app.get('/redirect', (c) => {
		*   return c.redirect('/')
		* })
		* app.get('/redirect-permanently', (c) => {
		*   return c.redirect('/', 301)
		* })
		* ```
		*/
		redirect = (location, status) => {
			const locationString = String(location);
			this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
			return this.newResponse(null, status ?? 302);
		};
		/**
		* `.notFound()` can return the Not Found Response.
		*
		* @see {@link https://hono.dev/docs/api/context#notfound}
		*
		* @example
		* ```ts
		* app.get('/notfound', (c) => {
		*   return c.notFound()
		* })
		* ```
		*/
		notFound = () => {
			this.#notFoundHandler ??= () => createResponseInstance();
			return this.#notFoundHandler(this);
		};
	};
	0 && (module.exports = {
		Context,
		TEXT_PLAIN
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/router.js
var require_router$3 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var router_exports = {};
	__export(router_exports, {
		MESSAGE_MATCHER_IS_ALREADY_BUILT: () => MESSAGE_MATCHER_IS_ALREADY_BUILT,
		METHODS: () => METHODS,
		METHOD_NAME_ALL: () => METHOD_NAME_ALL,
		METHOD_NAME_ALL_LOWERCASE: () => METHOD_NAME_ALL_LOWERCASE,
		UnsupportedPathError: () => UnsupportedPathError
	});
	module.exports = __toCommonJS(router_exports);
	var METHOD_NAME_ALL = "ALL";
	var METHOD_NAME_ALL_LOWERCASE = "all";
	var METHODS = [
		"get",
		"post",
		"put",
		"delete",
		"options",
		"patch"
	];
	var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
	var UnsupportedPathError = class extends Error {};
	0 && (module.exports = {
		MESSAGE_MATCHER_IS_ALREADY_BUILT,
		METHODS,
		METHOD_NAME_ALL,
		METHOD_NAME_ALL_LOWERCASE,
		UnsupportedPathError
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/utils/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var constants_exports = {};
	__export(constants_exports, { COMPOSED_HANDLER: () => COMPOSED_HANDLER });
	module.exports = __toCommonJS(constants_exports);
	var COMPOSED_HANDLER = "__COMPOSED_HANDLER";
	0 && (module.exports = { COMPOSED_HANDLER });
}));
//#endregion
//#region node_modules/hono/dist/cjs/hono-base.js
var require_hono_base = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var hono_base_exports = {};
	__export(hono_base_exports, { HonoBase: () => Hono });
	module.exports = __toCommonJS(hono_base_exports);
	var import_compose = require_compose();
	var import_context = require_context();
	var import_router = require_router$3();
	var import_constants = require_constants();
	var import_url = require_url();
	var notFoundHandler = (c) => {
		return c.text("404 Not Found", 404);
	};
	var errorHandler = (err, c) => {
		if ("getResponse" in err) {
			const res = err.getResponse();
			return c.newResponse(res.body, res);
		}
		console.error(err);
		return c.text("Internal Server Error", 500);
	};
	var Hono = class Hono {
		get;
		post;
		put;
		delete;
		options;
		patch;
		all;
		on;
		use;
		router;
		getPath;
		_basePath = "/";
		#path = "/";
		routes = [];
		constructor(options = {}) {
			[...import_router.METHODS, import_router.METHOD_NAME_ALL_LOWERCASE].forEach((method) => {
				this[method] = (args1, ...args) => {
					if (typeof args1 === "string") this.#path = args1;
					else this.#addRoute(method, this.#path, args1);
					args.forEach((handler) => {
						this.#addRoute(method, this.#path, handler);
					});
					return this;
				};
			});
			this.on = (method, path, ...handlers) => {
				for (const p of [path].flat()) {
					this.#path = p;
					for (const m of [method].flat()) handlers.map((handler) => {
						this.#addRoute(m.toUpperCase(), this.#path, handler);
					});
				}
				return this;
			};
			this.use = (arg1, ...handlers) => {
				if (typeof arg1 === "string") this.#path = arg1;
				else {
					this.#path = "*";
					handlers.unshift(arg1);
				}
				handlers.forEach((handler) => {
					this.#addRoute(import_router.METHOD_NAME_ALL, this.#path, handler);
				});
				return this;
			};
			const { strict, ...optionsWithoutStrict } = options;
			Object.assign(this, optionsWithoutStrict);
			this.getPath = strict ?? true ? options.getPath ?? import_url.getPath : import_url.getPathNoStrict;
		}
		#clone() {
			const clone = new Hono({
				router: this.router,
				getPath: this.getPath
			});
			clone.errorHandler = this.errorHandler;
			clone.#notFoundHandler = this.#notFoundHandler;
			clone.routes = this.routes;
			return clone;
		}
		#notFoundHandler = notFoundHandler;
		errorHandler = errorHandler;
		/**
		* `.route()` allows grouping other Hono instance in routes.
		*
		* @see {@link https://hono.dev/docs/api/routing#grouping}
		*
		* @param {string} path - base Path
		* @param {Hono} app - other Hono instance
		* @returns {Hono} routed Hono instance
		*
		* @example
		* ```ts
		* const app = new Hono()
		* const app2 = new Hono()
		*
		* app2.get("/user", (c) => c.text("user"))
		* app.route("/api", app2) // GET /api/user
		* ```
		*/
		route(path, app) {
			const subApp = this.basePath(path);
			app.routes.map((r) => {
				let handler;
				if (app.errorHandler === errorHandler) handler = r.handler;
				else {
					handler = async (c, next) => (await (0, import_compose.compose)([], app.errorHandler)(c, () => r.handler(c, next))).res;
					handler[import_constants.COMPOSED_HANDLER] = r.handler;
				}
				subApp.#addRoute(r.method, r.path, handler, r.basePath);
			});
			return this;
		}
		/**
		* `.basePath()` allows base paths to be specified.
		*
		* @see {@link https://hono.dev/docs/api/routing#base-path}
		*
		* @param {string} path - base Path
		* @returns {Hono} changed Hono instance
		*
		* @example
		* ```ts
		* const api = new Hono().basePath('/api')
		* ```
		*/
		basePath(path) {
			const subApp = this.#clone();
			subApp._basePath = (0, import_url.mergePath)(this._basePath, path);
			return subApp;
		}
		/**
		* `.onError()` handles an error and returns a customized Response.
		*
		* @see {@link https://hono.dev/docs/api/hono#error-handling}
		*
		* @param {ErrorHandler} handler - request Handler for error
		* @returns {Hono} changed Hono instance
		*
		* @example
		* ```ts
		* app.onError((err, c) => {
		*   console.error(`${err}`)
		*   return c.text('Custom Error Message', 500)
		* })
		* ```
		*/
		onError = (handler) => {
			this.errorHandler = handler;
			return this;
		};
		/**
		* `.notFound()` allows you to customize a Not Found Response.
		*
		* @see {@link https://hono.dev/docs/api/hono#not-found}
		*
		* @param {NotFoundHandler} handler - request handler for not-found
		* @returns {Hono} changed Hono instance
		*
		* @example
		* ```ts
		* app.notFound((c) => {
		*   return c.text('Custom 404 Message', 404)
		* })
		* ```
		*/
		notFound = (handler) => {
			this.#notFoundHandler = handler;
			return this;
		};
		/**
		* `.mount()` allows you to mount applications built with other frameworks into your Hono application.
		*
		* @see {@link https://hono.dev/docs/api/hono#mount}
		*
		* @param {string} path - base Path
		* @param {Function} applicationHandler - other Request Handler
		* @param {MountOptions} [options] - options of `.mount()`
		* @returns {Hono} mounted Hono instance
		*
		* @example
		* ```ts
		* import { Router as IttyRouter } from 'itty-router'
		* import { Hono } from 'hono'
		* // Create itty-router application
		* const ittyRouter = IttyRouter()
		* // GET /itty-router/hello
		* ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
		*
		* const app = new Hono()
		* app.mount('/itty-router', ittyRouter.handle)
		* ```
		*
		* @example
		* ```ts
		* const app = new Hono()
		* // Send the request to another application without modification.
		* app.mount('/app', anotherApp, {
		*   replaceRequest: (req) => req,
		* })
		* ```
		*/
		mount(path, applicationHandler, options) {
			let replaceRequest;
			let optionHandler;
			if (options) if (typeof options === "function") optionHandler = options;
			else {
				optionHandler = options.optionHandler;
				if (options.replaceRequest === false) replaceRequest = (request) => request;
				else replaceRequest = options.replaceRequest;
			}
			const getOptions = optionHandler ? (c) => {
				const options2 = optionHandler(c);
				return Array.isArray(options2) ? options2 : [options2];
			} : (c) => {
				let executionContext = void 0;
				try {
					executionContext = c.executionCtx;
				} catch {}
				return [c.env, executionContext];
			};
			replaceRequest ||= (() => {
				const mergedPath = (0, import_url.mergePath)(this._basePath, path);
				const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
				return (request) => {
					const url = new URL(request.url);
					url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
					return new Request(url, request);
				};
			})();
			const handler = async (c, next) => {
				const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
				if (res) return res;
				await next();
			};
			this.#addRoute(import_router.METHOD_NAME_ALL, (0, import_url.mergePath)(path, "*"), handler);
			return this;
		}
		#addRoute(method, path, handler, baseRoutePath) {
			method = method.toUpperCase();
			path = (0, import_url.mergePath)(this._basePath, path);
			const r = {
				basePath: baseRoutePath !== void 0 ? (0, import_url.mergePath)(this._basePath, baseRoutePath) : this._basePath,
				path,
				method,
				handler
			};
			this.router.add(method, path, [handler, r]);
			this.routes.push(r);
		}
		#handleError(err, c) {
			if (err instanceof Error) return this.errorHandler(err, c);
			throw err;
		}
		#dispatch(request, executionCtx, env, method) {
			if (method === "HEAD") return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
			const path = this.getPath(request, { env });
			const matchResult = this.router.match(method, path);
			const c = new import_context.Context(request, {
				path,
				matchResult,
				env,
				executionCtx,
				notFoundHandler: this.#notFoundHandler
			});
			if (matchResult[0].length === 1) {
				let res;
				try {
					res = matchResult[0][0][0][0](c, async () => {
						c.res = await this.#notFoundHandler(c);
					});
				} catch (err) {
					return this.#handleError(err, c);
				}
				return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
			}
			const composed = (0, import_compose.compose)(matchResult[0], this.errorHandler, this.#notFoundHandler);
			return (async () => {
				try {
					const context = await composed(c);
					if (!context.finalized) throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
					return context.res;
				} catch (err) {
					return this.#handleError(err, c);
				}
			})();
		}
		/**
		* `.fetch()` will be entry point of your app.
		*
		* @see {@link https://hono.dev/docs/api/hono#fetch}
		*
		* @param {Request} request - request Object of request
		* @param {Env} Env - env Object
		* @param {ExecutionContext} - context of execution
		* @returns {Response | Promise<Response>} response of request
		*
		*/
		fetch = (request, ...rest) => {
			return this.#dispatch(request, rest[1], rest[0], request.method);
		};
		/**
		* `.request()` is a useful method for testing.
		* You can pass a URL or pathname to send a GET request.
		* app will return a Response object.
		* ```ts
		* test('GET /hello is ok', async () => {
		*   const res = await app.request('/hello')
		*   expect(res.status).toBe(200)
		* })
		* ```
		* @see https://hono.dev/docs/api/hono#request
		*/
		request = (input, requestInit, Env, executionCtx) => {
			if (input instanceof Request) return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
			input = input.toString();
			return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${(0, import_url.mergePath)("/", input)}`, requestInit), Env, executionCtx);
		};
		/**
		* `.fire()` automatically adds a global fetch event listener.
		* This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
		* @deprecated
		* Use `fire` from `hono/service-worker` instead.
		* ```ts
		* import { Hono } from 'hono'
		* import { fire } from 'hono/service-worker'
		*
		* const app = new Hono()
		* // ...
		* fire(app)
		* ```
		* @see https://hono.dev/docs/api/hono#fire
		* @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
		* @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
		*/
		fire = () => {
			addEventListener("fetch", (event) => {
				event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
			});
		};
	};
	0 && (module.exports = { HonoBase });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/matcher.js
var require_matcher = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var matcher_exports = {};
	__export(matcher_exports, {
		emptyParam: () => emptyParam,
		match: () => match
	});
	module.exports = __toCommonJS(matcher_exports);
	var import_router = require_router$3();
	var emptyParam = [];
	function match(method, path) {
		const matchers = this.buildAllMatchers();
		const match2 = ((method2, path2) => {
			const matcher = matchers[method2] || matchers[import_router.METHOD_NAME_ALL];
			const staticMatch = matcher[2][path2];
			if (staticMatch) return staticMatch;
			const match3 = path2.match(matcher[0]);
			if (!match3) return [[], emptyParam];
			const index = match3.indexOf("", 1);
			return [matcher[1][index], match3];
		});
		this.match = match2;
		return match2(method, path);
	}
	0 && (module.exports = {
		emptyParam,
		match
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/node.js
var require_node$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var node_exports = {};
	__export(node_exports, {
		Node: () => Node,
		PATH_ERROR: () => PATH_ERROR
	});
	module.exports = __toCommonJS(node_exports);
	var LABEL_REG_EXP_STR = "[^/]+";
	var ONLY_WILDCARD_REG_EXP_STR = ".*";
	var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
	var PATH_ERROR = /* @__PURE__ */ Symbol();
	var regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
	function compareKey(a, b) {
		if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
		if (b.length === 1) return 1;
		if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) return 1;
		else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) return -1;
		if (a === LABEL_REG_EXP_STR) return 1;
		else if (b === LABEL_REG_EXP_STR) return -1;
		return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
	}
	var Node = class Node {
		#index;
		#varIndex;
		#children = /* @__PURE__ */ Object.create(null);
		insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
			if (tokens.length === 0) {
				if (this.#index !== void 0) throw PATH_ERROR;
				if (pathErrorCheckOnly) return;
				this.#index = index;
				return;
			}
			const [token, ...restTokens] = tokens;
			const pattern = token === "*" ? restTokens.length === 0 ? [
				"",
				"",
				ONLY_WILDCARD_REG_EXP_STR
			] : [
				"",
				"",
				LABEL_REG_EXP_STR
			] : token === "/*" ? [
				"",
				"",
				TAIL_WILDCARD_REG_EXP_STR
			] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
			let node;
			if (pattern) {
				const name = pattern[1];
				let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
				if (name && pattern[2]) {
					if (regexpStr === ".*") throw PATH_ERROR;
					regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
					if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
				}
				node = this.#children[regexpStr];
				if (!node) {
					if (Object.keys(this.#children).some((k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) throw PATH_ERROR;
					if (pathErrorCheckOnly) return;
					node = this.#children[regexpStr] = new Node();
					if (name !== "") node.#varIndex = context.varIndex++;
				}
				if (!pathErrorCheckOnly && name !== "") paramMap.push([name, node.#varIndex]);
			} else {
				node = this.#children[token];
				if (!node) {
					if (Object.keys(this.#children).some((k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) throw PATH_ERROR;
					if (pathErrorCheckOnly) return;
					node = this.#children[token] = new Node();
				}
			}
			node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
		}
		buildRegExpStr() {
			const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
				const c = this.#children[k];
				return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
			});
			if (typeof this.#index === "number") strList.unshift(`#${this.#index}`);
			if (strList.length === 0) return "";
			if (strList.length === 1) return strList[0];
			return "(?:" + strList.join("|") + ")";
		}
	};
	0 && (module.exports = {
		Node,
		PATH_ERROR
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/trie.js
var require_trie = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var trie_exports = {};
	__export(trie_exports, { Trie: () => Trie });
	module.exports = __toCommonJS(trie_exports);
	var import_node = require_node$1();
	var Trie = class {
		#context = { varIndex: 0 };
		#root = new import_node.Node();
		insert(path, index, pathErrorCheckOnly) {
			const paramAssoc = [];
			const groups = [];
			for (let i = 0;;) {
				let replaced = false;
				path = path.replace(/\{[^}]+\}/g, (m) => {
					const mark = `@\\${i}`;
					groups[i] = [mark, m];
					i++;
					replaced = true;
					return mark;
				});
				if (!replaced) break;
			}
			const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
			for (let i = groups.length - 1; i >= 0; i--) {
				const [mark] = groups[i];
				for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
					tokens[j] = tokens[j].replace(mark, groups[i][1]);
					break;
				}
			}
			this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
			return paramAssoc;
		}
		buildRegExp() {
			let regexp = this.#root.buildRegExpStr();
			if (regexp === "") return [
				/^$/,
				[],
				[]
			];
			let captureIndex = 0;
			const indexReplacementMap = [];
			const paramReplacementMap = [];
			regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
				if (handlerIndex !== void 0) {
					indexReplacementMap[++captureIndex] = Number(handlerIndex);
					return "$()";
				}
				if (paramIndex !== void 0) {
					paramReplacementMap[Number(paramIndex)] = ++captureIndex;
					return "";
				}
				return "";
			});
			return [
				new RegExp(`^${regexp}`),
				indexReplacementMap,
				paramReplacementMap
			];
		}
	};
	0 && (module.exports = { Trie });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/router.js
var require_router$2 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var router_exports = {};
	__export(router_exports, { RegExpRouter: () => RegExpRouter });
	module.exports = __toCommonJS(router_exports);
	var import_router = require_router$3();
	var import_url = require_url();
	var import_matcher = require_matcher();
	var import_node = require_node$1();
	var import_trie = require_trie();
	var nullMatcher = [
		/^$/,
		[],
		/* @__PURE__ */ Object.create(null)
	];
	var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
	function buildWildcardRegExp(path) {
		return wildcardRegExpCache[path] ??= new RegExp(path === "*" ? "" : `^${path.replace(/\/\*$|([.\\+*[^\]$()])/g, (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)")}$`);
	}
	function clearWildcardRegExpCache() {
		wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
	}
	function buildMatcherFromPreprocessedRoutes(routes) {
		const trie = new import_trie.Trie();
		const handlerData = [];
		if (routes.length === 0) return nullMatcher;
		const routesWithStaticPathFlag = routes.map((route) => [!/\*|\/:/.test(route[0]), ...route]).sort(([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length);
		const staticMap = /* @__PURE__ */ Object.create(null);
		for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
			const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
			if (pathErrorCheckOnly) staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), import_matcher.emptyParam];
			else j++;
			let paramAssoc;
			try {
				paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
			} catch (e) {
				throw e === import_node.PATH_ERROR ? new import_router.UnsupportedPathError(path) : e;
			}
			if (pathErrorCheckOnly) continue;
			handlerData[j] = handlers.map(([h, paramCount]) => {
				const paramIndexMap = /* @__PURE__ */ Object.create(null);
				paramCount -= 1;
				for (; paramCount >= 0; paramCount--) {
					const [key, value] = paramAssoc[paramCount];
					paramIndexMap[key] = value;
				}
				return [h, paramIndexMap];
			});
		}
		const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
		for (let i = 0, len = handlerData.length; i < len; i++) for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
			const map = handlerData[i][j]?.[1];
			if (!map) continue;
			const keys = Object.keys(map);
			for (let k = 0, len3 = keys.length; k < len3; k++) map[keys[k]] = paramReplacementMap[map[keys[k]]];
		}
		const handlerMap = [];
		for (const i in indexReplacementMap) handlerMap[i] = handlerData[indexReplacementMap[i]];
		return [
			regexp,
			handlerMap,
			staticMap
		];
	}
	function findMiddleware(middleware, path) {
		if (!middleware) return;
		for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
	}
	var RegExpRouter = class {
		name = "RegExpRouter";
		#middleware;
		#routes;
		constructor() {
			this.#middleware = { [import_router.METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
			this.#routes = { [import_router.METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
		}
		add(method, path, handler) {
			const middleware = this.#middleware;
			const routes = this.#routes;
			if (!middleware || !routes) throw new Error(import_router.MESSAGE_MATCHER_IS_ALREADY_BUILT);
			if (!middleware[method]) [middleware, routes].forEach((handlerMap) => {
				handlerMap[method] = /* @__PURE__ */ Object.create(null);
				Object.keys(handlerMap[import_router.METHOD_NAME_ALL]).forEach((p) => {
					handlerMap[method][p] = [...handlerMap[import_router.METHOD_NAME_ALL][p]];
				});
			});
			if (path === "/*") path = "*";
			const paramCount = (path.match(/\/:/g) || []).length;
			if (/\*$/.test(path)) {
				const re = buildWildcardRegExp(path);
				if (method === import_router.METHOD_NAME_ALL) Object.keys(middleware).forEach((m) => {
					middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[import_router.METHOD_NAME_ALL], path) || [];
				});
				else middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[import_router.METHOD_NAME_ALL], path) || [];
				Object.keys(middleware).forEach((m) => {
					if (method === import_router.METHOD_NAME_ALL || method === m) Object.keys(middleware[m]).forEach((p) => {
						re.test(p) && middleware[m][p].push([handler, paramCount]);
					});
				});
				Object.keys(routes).forEach((m) => {
					if (method === import_router.METHOD_NAME_ALL || method === m) Object.keys(routes[m]).forEach((p) => re.test(p) && routes[m][p].push([handler, paramCount]));
				});
				return;
			}
			const paths = (0, import_url.checkOptionalParameter)(path) || [path];
			for (let i = 0, len = paths.length; i < len; i++) {
				const path2 = paths[i];
				Object.keys(routes).forEach((m) => {
					if (method === import_router.METHOD_NAME_ALL || method === m) {
						routes[m][path2] ||= [...findMiddleware(middleware[m], path2) || findMiddleware(middleware[import_router.METHOD_NAME_ALL], path2) || []];
						routes[m][path2].push([handler, paramCount - len + i + 1]);
					}
				});
			}
		}
		match = import_matcher.match;
		buildAllMatchers() {
			const matchers = /* @__PURE__ */ Object.create(null);
			Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
				matchers[method] ||= this.#buildMatcher(method);
			});
			this.#middleware = this.#routes = void 0;
			clearWildcardRegExpCache();
			return matchers;
		}
		#buildMatcher(method) {
			const routes = [];
			let hasOwnRoute = method === import_router.METHOD_NAME_ALL;
			[this.#middleware, this.#routes].forEach((r) => {
				const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
				if (ownRoute.length !== 0) {
					hasOwnRoute ||= true;
					routes.push(...ownRoute);
				} else if (method !== import_router.METHOD_NAME_ALL) routes.push(...Object.keys(r[import_router.METHOD_NAME_ALL]).map((path) => [path, r[import_router.METHOD_NAME_ALL][path]]));
			});
			if (!hasOwnRoute) return null;
			else return buildMatcherFromPreprocessedRoutes(routes);
		}
	};
	0 && (module.exports = { RegExpRouter });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/prepared-router.js
var require_prepared_router = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var prepared_router_exports = {};
	__export(prepared_router_exports, {
		PreparedRegExpRouter: () => PreparedRegExpRouter,
		buildInitParams: () => buildInitParams,
		serializeInitParams: () => serializeInitParams
	});
	module.exports = __toCommonJS(prepared_router_exports);
	var import_router = require_router$3();
	var import_matcher = require_matcher();
	var import_router2 = require_router$2();
	var PreparedRegExpRouter = class {
		name = "PreparedRegExpRouter";
		#matchers;
		#relocateMap;
		constructor(matchers, relocateMap) {
			this.#matchers = matchers;
			this.#relocateMap = relocateMap;
		}
		#addWildcard(method, handlerData) {
			const matcher = this.#matchers[method];
			matcher[1].forEach((list) => list && list.push(handlerData));
			Object.values(matcher[2]).forEach((list) => list[0].push(handlerData));
		}
		#addPath(method, path, handler, indexes, map) {
			const matcher = this.#matchers[method];
			if (!map) matcher[2][path][0].push([handler, {}]);
			else indexes.forEach((index) => {
				if (typeof index === "number") matcher[1][index].push([handler, map]);
				else matcher[2][index || path][0].push([handler, map]);
			});
		}
		add(method, path, handler) {
			if (!this.#matchers[method]) {
				const all = this.#matchers[import_router.METHOD_NAME_ALL];
				const staticMap = {};
				for (const key in all[2]) staticMap[key] = [all[2][key][0].slice(), import_matcher.emptyParam];
				this.#matchers[method] = [
					all[0],
					all[1].map((list) => Array.isArray(list) ? list.slice() : 0),
					staticMap
				];
			}
			if (path === "/*" || path === "*") {
				const handlerData = [handler, {}];
				if (method === import_router.METHOD_NAME_ALL) for (const m in this.#matchers) this.#addWildcard(m, handlerData);
				else this.#addWildcard(method, handlerData);
				return;
			}
			const data = this.#relocateMap[path];
			if (!data) throw new Error(`Path ${path} is not registered`);
			for (const [indexes, map] of data) if (method === import_router.METHOD_NAME_ALL) for (const m in this.#matchers) this.#addPath(m, path, handler, indexes, map);
			else this.#addPath(method, path, handler, indexes, map);
		}
		buildAllMatchers() {
			return this.#matchers;
		}
		match = import_matcher.match;
	};
	var buildInitParams = ({ paths }) => {
		const RegExpRouterWithMatcherExport = class extends import_router2.RegExpRouter {
			buildAndExportAllMatchers() {
				return this.buildAllMatchers();
			}
		};
		const router = new RegExpRouterWithMatcherExport();
		for (const path of paths) router.add(import_router.METHOD_NAME_ALL, path, path);
		const matchers = router.buildAndExportAllMatchers();
		const all = matchers[import_router.METHOD_NAME_ALL];
		const relocateMap = {};
		for (const path of paths) {
			if (path === "/*" || path === "*") continue;
			all[1].forEach((list, i) => {
				list.forEach(([p, map]) => {
					if (p === path) {
						if (relocateMap[path]) relocateMap[path][0][1] = {
							...relocateMap[path][0][1],
							...map
						};
						else relocateMap[path] = [[[], map]];
						if (relocateMap[path][0][0].findIndex((j) => j === i) === -1) relocateMap[path][0][0].push(i);
					}
				});
			});
			for (const path2 in all[2]) all[2][path2][0].forEach(([p]) => {
				if (p === path) {
					relocateMap[path] ||= [[[]]];
					const value = path2 === path ? "" : path2;
					if (relocateMap[path][0][0].findIndex((v) => v === value) === -1) relocateMap[path][0][0].push(value);
				}
			});
		}
		for (let i = 0, len = all[1].length; i < len; i++) all[1][i] = all[1][i] ? [] : 0;
		for (const path in all[2]) all[2][path][0] = [];
		return [matchers, relocateMap];
	};
	var serializeInitParams = ([matchers, relocateMap]) => {
		return `[${JSON.stringify(matchers, (_, value) => value instanceof RegExp ? `##${value.toString()}##` : value).replace(/"##(.+?)##"/g, (_, str) => str.replace(/\\\\/g, "\\"))},${JSON.stringify(relocateMap)}]`;
	};
	0 && (module.exports = {
		PreparedRegExpRouter,
		buildInitParams,
		serializeInitParams
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/reg-exp-router/index.js
var require_reg_exp_router = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var reg_exp_router_exports = {};
	__export(reg_exp_router_exports, {
		PreparedRegExpRouter: () => import_prepared_router.PreparedRegExpRouter,
		RegExpRouter: () => import_router.RegExpRouter,
		buildInitParams: () => import_prepared_router.buildInitParams,
		serializeInitParams: () => import_prepared_router.serializeInitParams
	});
	module.exports = __toCommonJS(reg_exp_router_exports);
	var import_router = require_router$2();
	var import_prepared_router = require_prepared_router();
	0 && (module.exports = {
		PreparedRegExpRouter,
		RegExpRouter,
		buildInitParams,
		serializeInitParams
	});
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/smart-router/router.js
var require_router$1 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var router_exports = {};
	__export(router_exports, { SmartRouter: () => SmartRouter });
	module.exports = __toCommonJS(router_exports);
	var import_router = require_router$3();
	var SmartRouter = class {
		name = "SmartRouter";
		#routers = [];
		#routes = [];
		constructor(init) {
			this.#routers = init.routers;
		}
		add(method, path, handler) {
			if (!this.#routes) throw new Error(import_router.MESSAGE_MATCHER_IS_ALREADY_BUILT);
			this.#routes.push([
				method,
				path,
				handler
			]);
		}
		match(method, path) {
			if (!this.#routes) throw new Error("Fatal error");
			const routers = this.#routers;
			const routes = this.#routes;
			const len = routers.length;
			let i = 0;
			let res;
			for (; i < len; i++) {
				const router = routers[i];
				try {
					for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) router.add(...routes[i2]);
					res = router.match(method, path);
				} catch (e) {
					if (e instanceof import_router.UnsupportedPathError) continue;
					throw e;
				}
				this.match = router.match.bind(router);
				this.#routers = [router];
				this.#routes = void 0;
				break;
			}
			if (i === len) throw new Error("Fatal error");
			this.name = `SmartRouter + ${this.activeRouter.name}`;
			return res;
		}
		get activeRouter() {
			if (this.#routes || this.#routers.length !== 1) throw new Error("No active router has been determined yet.");
			return this.#routers[0];
		}
	};
	0 && (module.exports = { SmartRouter });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/smart-router/index.js
var require_smart_router = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var smart_router_exports = {};
	__export(smart_router_exports, { SmartRouter: () => import_router.SmartRouter });
	module.exports = __toCommonJS(smart_router_exports);
	var import_router = require_router$1();
	0 && (module.exports = { SmartRouter });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/trie-router/node.js
var require_node = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var node_exports = {};
	__export(node_exports, { Node: () => Node });
	module.exports = __toCommonJS(node_exports);
	var import_router = require_router$3();
	var import_url = require_url();
	var emptyParams = /* @__PURE__ */ Object.create(null);
	var hasChildren = (children) => {
		for (const _ in children) return true;
		return false;
	};
	var Node = class Node {
		#methods;
		#children;
		#patterns;
		#order = 0;
		#params = emptyParams;
		constructor(method, handler, children) {
			this.#children = children || /* @__PURE__ */ Object.create(null);
			this.#methods = [];
			if (method && handler) {
				const m = /* @__PURE__ */ Object.create(null);
				m[method] = {
					handler,
					possibleKeys: [],
					score: 0
				};
				this.#methods = [m];
			}
			this.#patterns = [];
		}
		insert(method, path, handler) {
			this.#order = ++this.#order;
			let curNode = this;
			const parts = (0, import_url.splitRoutingPath)(path);
			const possibleKeys = [];
			for (let i = 0, len = parts.length; i < len; i++) {
				const p = parts[i];
				const nextP = parts[i + 1];
				const pattern = (0, import_url.getPattern)(p, nextP);
				const key = Array.isArray(pattern) ? pattern[0] : p;
				if (key in curNode.#children) {
					curNode = curNode.#children[key];
					if (pattern) possibleKeys.push(pattern[1]);
					continue;
				}
				curNode.#children[key] = new Node();
				if (pattern) {
					curNode.#patterns.push(pattern);
					possibleKeys.push(pattern[1]);
				}
				curNode = curNode.#children[key];
			}
			curNode.#methods.push({ [method]: {
				handler,
				possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
				score: this.#order
			} });
			return curNode;
		}
		#pushHandlerSets(handlerSets, node, method, nodeParams, params) {
			for (let i = 0, len = node.#methods.length; i < len; i++) {
				const m = node.#methods[i];
				const handlerSet = m[method] || m[import_router.METHOD_NAME_ALL];
				const processedSet = {};
				if (handlerSet !== void 0) {
					handlerSet.params = /* @__PURE__ */ Object.create(null);
					handlerSets.push(handlerSet);
					if (nodeParams !== emptyParams || params && params !== emptyParams) for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
						const key = handlerSet.possibleKeys[i2];
						const processed = processedSet[handlerSet.score];
						handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
						processedSet[handlerSet.score] = true;
					}
				}
			}
		}
		search(method, path) {
			const handlerSets = [];
			this.#params = emptyParams;
			let curNodes = [this];
			const parts = (0, import_url.splitPath)(path);
			const curNodesQueue = [];
			const len = parts.length;
			let partOffsets = null;
			for (let i = 0; i < len; i++) {
				const part = parts[i];
				const isLast = i === len - 1;
				const tempNodes = [];
				for (let j = 0, len2 = curNodes.length; j < len2; j++) {
					const node = curNodes[j];
					const nextNode = node.#children[part];
					if (nextNode) {
						nextNode.#params = node.#params;
						if (isLast) {
							if (nextNode.#children["*"]) this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
							this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
						} else tempNodes.push(nextNode);
					}
					for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
						const pattern = node.#patterns[k];
						const params = node.#params === emptyParams ? {} : { ...node.#params };
						if (pattern === "*") {
							const astNode = node.#children["*"];
							if (astNode) {
								this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
								astNode.#params = params;
								tempNodes.push(astNode);
							}
							continue;
						}
						const [key, name, matcher] = pattern;
						if (!part && !(matcher instanceof RegExp)) continue;
						const child = node.#children[key];
						if (matcher instanceof RegExp) {
							if (partOffsets === null) {
								partOffsets = new Array(len);
								let offset = path[0] === "/" ? 1 : 0;
								for (let p = 0; p < len; p++) {
									partOffsets[p] = offset;
									offset += parts[p].length + 1;
								}
							}
							const restPathString = path.substring(partOffsets[i]);
							const m = matcher.exec(restPathString);
							if (m) {
								params[name] = m[0];
								this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
								if (hasChildren(child.#children)) {
									child.#params = params;
									const componentCount = m[0].match(/\//)?.length ?? 0;
									(curNodesQueue[componentCount] ||= []).push(child);
								}
								continue;
							}
						}
						if (matcher === true || matcher.test(part)) {
							params[name] = part;
							if (isLast) {
								this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
								if (child.#children["*"]) this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
							} else {
								child.#params = params;
								tempNodes.push(child);
							}
						}
					}
				}
				const shifted = curNodesQueue.shift();
				curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
			}
			if (handlerSets.length > 1) handlerSets.sort((a, b) => {
				return a.score - b.score;
			});
			return [handlerSets.map(({ handler, params }) => [handler, params])];
		}
	};
	0 && (module.exports = { Node });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/trie-router/router.js
var require_router = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var router_exports = {};
	__export(router_exports, { TrieRouter: () => TrieRouter });
	module.exports = __toCommonJS(router_exports);
	var import_url = require_url();
	var import_node = require_node();
	var TrieRouter = class {
		name = "TrieRouter";
		#node;
		constructor() {
			this.#node = new import_node.Node();
		}
		add(method, path, handler) {
			const results = (0, import_url.checkOptionalParameter)(path);
			if (results) {
				for (let i = 0, len = results.length; i < len; i++) this.#node.insert(method, results[i], handler);
				return;
			}
			this.#node.insert(method, path, handler);
		}
		match(method, path) {
			return this.#node.search(method, path);
		}
	};
	0 && (module.exports = { TrieRouter });
}));
//#endregion
//#region node_modules/hono/dist/cjs/router/trie-router/index.js
var require_trie_router = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var trie_router_exports = {};
	__export(trie_router_exports, { TrieRouter: () => import_router.TrieRouter });
	module.exports = __toCommonJS(trie_router_exports);
	var import_router = require_router();
	0 && (module.exports = { TrieRouter });
}));
//#endregion
//#region node_modules/hono/dist/cjs/hono.js
var require_hono = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var hono_exports = {};
	__export(hono_exports, { Hono: () => Hono });
	module.exports = __toCommonJS(hono_exports);
	var import_hono_base = require_hono_base();
	var import_reg_exp_router = require_reg_exp_router();
	var import_smart_router = require_smart_router();
	var import_trie_router = require_trie_router();
	var Hono = class extends import_hono_base.HonoBase {
		/**
		* Creates an instance of the Hono class.
		*
		* @param options - Optional configuration options for the Hono instance.
		*/
		constructor(options = {}) {
			super(options);
			this.router = options.router ?? new import_smart_router.SmartRouter({ routers: [new import_reg_exp_router.RegExpRouter(), new import_trie_router.TrieRouter()] });
		}
	};
	0 && (module.exports = { Hono });
}));
//#endregion
//#region src/app.ts
/** Flue application entrypoint with OpenTelemetry observer registration. */
var import_cjs = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __export = (target, all) => {
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") {
			for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: () => from[key],
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	var index_exports = {};
	__export(index_exports, {
		Context: () => import_context.Context,
		Hono: () => import_hono.Hono
	});
	module.exports = __toCommonJS(index_exports);
	var import_hono = require_hono();
	var import_context = require_context();
	0 && (module.exports = {
		Context,
		Hono
	});
})))();
observe(createOpenTelemetryObserver());
var app = new import_cjs.Hono();
app.get("/health", (c) => c.json({ ok: true }));
app.route("/", flue());
//#endregion
//#region dist/_entry_server.ts
var skills = {};
var packagedSkills = getPackagedSkills();
var systemPrompt = "";
function normalizeBuiltModules(agentModules, workflowModules) {
	const manifest = {
		agents: [],
		workflows: []
	};
	const createdAgents = {};
	const dispatchAgentNames = /* @__PURE__ */ new Map();
	const workflowHandlers = {};
	const localWorkflowHandlers = {};
	const agentRouteMiddleware = {};
	const workflowRouteMiddleware = {};
	for (const [name, mod] of Object.entries(agentModules)) {
		if (!mod.default || mod.default.__flueCreatedAgent !== true || typeof mod.default.initialize !== "function") throw new Error("[flue] Agent \"" + name + "\" must default-export createAgent(...).");
		if (mod.route !== void 0 && typeof mod.route !== "function") throw new Error("[flue] Agent \"" + name + "\" route export must be a callable Hono middleware value.");
		const transports = {};
		if (typeof mod.route === "function") transports.http = true;
		manifest.agents.push({
			name,
			transports,
			created: true
		});
		createdAgents[name] = mod.default;
		const previousDispatchName = dispatchAgentNames.get(mod.default);
		if (previousDispatchName !== void 0) throw new Error("[flue] Agents \"" + previousDispatchName + "\" and \"" + name + "\" default-export the same created agent value. Use distinct createAgent(...) values for dispatchable agent modules.");
		dispatchAgentNames.set(mod.default, name);
		if (typeof mod.route === "function") agentRouteMiddleware[name] = mod.route;
	}
	for (const [name, mod] of Object.entries(workflowModules)) {
		if (typeof mod.run !== "function") throw new Error("[flue] Workflow \"" + name + "\" must export a callable run value.");
		if (mod.route !== void 0 && typeof mod.route !== "function") throw new Error("[flue] Workflow \"" + name + "\" route export must be a callable Hono middleware value.");
		const transports = {};
		if (typeof mod.route === "function") transports.http = true;
		manifest.workflows.push({
			name,
			transports
		});
		localWorkflowHandlers[name] = mod.run;
		if (transports.http) workflowHandlers[name] = mod.run;
		if (typeof mod.route === "function") workflowRouteMiddleware[name] = mod.route;
	}
	return {
		manifest,
		createdAgents,
		dispatchAgentNames,
		workflowHandlers,
		localWorkflowHandlers,
		agentRouteMiddleware,
		workflowRouteMiddleware
	};
}
var { manifest, createdAgents, dispatchAgentNames, workflowHandlers, localWorkflowHandlers, agentRouteMiddleware, workflowRouteMiddleware } = normalizeBuiltModules({ "remediator": remediator_exports }, {
	"remediate": remediate_exports,
	"smoke": smoke_exports
});
var isLocalMode = process.env.FLUE_MODE === "local";
var localCliTarget = process.env.FLUE_CLI_TARGET;
var localCliName = process.env.FLUE_CLI_NAME;
var localCliId = process.env.FLUE_CLI_ID;
var isLocalCliMode = localCliTarget !== void 0 || localCliName !== void 0 || localCliId !== void 0;
/**
* Create an empty in-memory sandbox (default).
* Uses InMemoryFs (no real filesystem access) with sensible defaults:
* cwd = /home/user, /tmp exists, /bin and /usr/bin exist.
*/
async function createDefaultEnv() {
	const fs = new InMemoryFs();
	return bashFactoryToSessionEnv(() => new Bash({
		fs,
		network: { dangerouslyAllowFullInternetAccess: true }
	}));
}
var defaultAdapter = sqlite();
if (defaultAdapter.migrate) defaultAdapter.migrate();
var executionStore = defaultAdapter.connect();
var runStore = defaultAdapter.connectRunStore();
var runRegistry = defaultAdapter.connectRunRegistry();
var eventStreamStore = defaultAdapter.connectEventStreamStore();
var persistenceAdapter = defaultAdapter;
var agentCoordinator = createNodeAgentCoordinator({
	submissions: executionStore.submissions,
	agents: createdAgents,
	createContext: createContextForRequest,
	eventStreamStore
});
var dispatchQueue = createNodeDispatchQueue(agentCoordinator);
var createAdmission = Object.fromEntries(Object.keys(createdAgents).map((name) => [name, (instanceId) => agentCoordinator.createAdmission(name, instanceId)]));
function createContextForRequest(id, runId, payload, req, initialEventIndex, dispatchId) {
	return createFlueContext({
		id,
		runId,
		dispatchId,
		payload,
		initialEventIndex,
		env: process.env,
		req,
		agentConfig: {
			systemPrompt,
			skills,
			packagedSkills,
			model: void 0,
			resolveModel
		},
		createDefaultEnv,
		defaultStore: executionStore.sessions,
		submissionStore: executionStore.submissions
	});
}
configureFlueRuntime({
	target: "node",
	devMode: isLocalMode,
	runtimeVersion: "0.11.1",
	manifest,
	createAdmission,
	dispatchQueue,
	resolveDispatchAgentName: (agent) => dispatchAgentNames.get(agent),
	workflowHandlers,
	agentRouteMiddleware,
	workflowRouteMiddleware,
	createContext: createContextForRequest,
	runStore,
	runRegistry,
	eventStreamStore
});
agentCoordinator.reconcileSubmissions().catch((error) => {
	console.error("[flue] Startup submission reconciliation failed:", error);
});
var flueApp = app;
if (!flueApp || typeof flueApp.fetch !== "function") throw new Error("[flue] app.ts default export must be a Hono app or an object with a fetch(request) method.");
function sendLocalMessage(message, done) {
	if (!process.send) throw new Error("[flue] Local CLI execution requires an inherited IPC connection.");
	process.send(message, done);
}
function localRequest() {
	return new Request("https://flue.invalid/_cli", { method: "POST" });
}
function localErrorMessage(reason, requestId) {
	return {
		type: "error",
		requestId,
		error: {
			type: "invalid_request",
			message: reason,
			details: reason
		}
	};
}
function failLocalStartup(reason) {
	sendLocalMessage(localErrorMessage(reason), () => process.exit(1));
}
function parseIpcWorkflowMessage(raw) {
	if (!raw || typeof raw !== "object" || raw.type !== "invoke" || typeof raw.requestId !== "string") throw new Error("IPC workflow messages must have type \"invoke\" and a string requestId.");
	return {
		type: "invoke",
		requestId: raw.requestId,
		payload: raw.payload === void 0 ? {} : raw.payload
	};
}
function parseIpcAgentMessage(raw) {
	if (!raw || typeof raw !== "object" || typeof raw.requestId !== "string") throw new Error("IPC agent messages must have a string requestId.");
	if (raw.type !== "prompt" || typeof raw.message !== "string") throw new Error("IPC agent messages must have type \"prompt\" with a string message.");
	return {
		type: "prompt",
		requestId: raw.requestId,
		message: raw.message
	};
}
function ipcErrorMessage(error, requestId, runId) {
	const publicError = error instanceof Error ? {
		type: "internal_error",
		message: error.message,
		details: error.message
	} : {
		type: "internal_error",
		message: String(error),
		details: String(error)
	};
	return runId === void 0 ? {
		type: "error",
		requestId,
		error: publicError
	} : {
		type: "error",
		requestId,
		runId,
		error: publicError
	};
}
function startLocalWorkflow(name) {
	const handler = localWorkflowHandlers[name];
	if (!handler) {
		failLocalStartup("Unknown workflow: " + name);
		return;
	}
	let invoked = false;
	sendLocalMessage({
		type: "ready",
		target: "workflow",
		name
	});
	process.on("message", (raw) => {
		let message;
		try {
			message = parseIpcWorkflowMessage(raw);
			if (invoked) {
				sendLocalMessage(localErrorMessage("Local workflow execution accepts one invocation only.", message.requestId));
				return;
			}
			invoked = true;
		} catch (error) {
			sendLocalMessage(ipcErrorMessage(error));
			return;
		}
		const runId = generateWorkflowRunId(name);
		sendLocalMessage({
			type: "started",
			requestId: message.requestId,
			runId
		});
		invokeWorkflowAttached({
			owner: {
				kind: "workflow",
				workflowName: name,
				instanceId: runId
			},
			id: runId,
			runId,
			payload: message.payload,
			request: localRequest(),
			handler,
			createContext: createContextForRequest,
			onEvent: (event) => sendLocalMessage({
				type: "event",
				requestId: message.requestId,
				runId,
				event
			}),
			runStore,
			runRegistry,
			eventStreamStore
		}).then((invocation) => sendLocalMessage({
			type: "result",
			requestId: message.requestId,
			runId,
			result: invocation.result ?? null
		}, () => process.exit(0)), (error) => sendLocalMessage(ipcErrorMessage(error, message.requestId, runId), () => process.exit(1)));
	});
}
function startLocalAgent(name, id) {
	if (!id) {
		failLocalStartup("Local agent connection requires an instance id.");
		return;
	}
	if (!createAdmission[name]) {
		failLocalStartup("Unknown agent for admission: " + name);
		return;
	}
	sendLocalMessage({
		type: "ready",
		target: "agent",
		name,
		instanceId: id
	});
	process.on("message", (raw) => {
		let message;
		try {
			message = parseIpcAgentMessage(raw);
		} catch (error) {
			sendLocalMessage(ipcErrorMessage(error));
			return;
		}
		let didStart = false;
		invokeDirectAttached({
			id,
			payload: { message: message.message },
			admitAttachedSubmission: createAdmission[name](id),
			onEvent: (event) => {
				if (!didStart) {
					didStart = true;
					sendLocalMessage({
						type: "started",
						requestId: message.requestId
					});
				}
				sendLocalMessage({
					type: "event",
					requestId: message.requestId,
					event
				});
			}
		}).then((result) => sendLocalMessage({
			type: "result",
			requestId: message.requestId,
			result: result ?? null
		}), (error) => sendLocalMessage(ipcErrorMessage(error, message.requestId)));
	});
}
if (isLocalCliMode) {
	if (typeof process.send !== "function") throw new Error("[flue] Local CLI execution requires an inherited IPC connection.");
	if (!localCliName || localCliTarget !== "workflow" && localCliTarget !== "agent") failLocalStartup("Invalid local CLI target configuration.");
	else if (localCliTarget === "workflow") startLocalWorkflow(localCliName);
	else startLocalAgent(localCliName, localCliId);
	process.on("disconnect", async () => {
		await agentCoordinator.shutdown();
		if (persistenceAdapter.close) await persistenceAdapter.close();
		process.exit(0);
	});
} else {
	const port = parseInt(process.env.PORT || "3000", 10);
	const server = (0, import_dist.serve)({
		fetch: (request, env) => flueApp.fetch(request, env),
		port,
		serverOptions: { requestTimeout: 0 }
	});
	console.log("[flue] Server listening on http://localhost:" + port);
	if (isLocalMode) {
		console.log("[flue] Mode: local");
		console.log("[flue] Agents: remediator");
	} else console.log("[flue] Agents: remediator");
	let shuttingDown = false;
	async function stop(signal, exitCode) {
		if (shuttingDown) return;
		shuttingDown = true;
		console.error("[flue] Received " + signal + ", shutting down...");
		await agentCoordinator.shutdown();
		if (persistenceAdapter.close) await persistenceAdapter.close();
		await new Promise((resolve) => server.close(resolve));
		console.error("[flue] Stopped.");
		process.exit(exitCode);
	}
	process.on("SIGINT", () => {
		stop("SIGINT", 130);
	});
	process.on("SIGTERM", () => {
		stop("SIGTERM", 143);
	});
}
//#endregion
export {};

//# sourceMappingURL=server.mjs.map