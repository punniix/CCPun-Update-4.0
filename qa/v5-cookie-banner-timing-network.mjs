// Node preload for local QA and its tracking child. Allow only loopback HTTP/CDP.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
const loopback = host => ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host);
const local = value => { try { return loopback(new URL(String(value)).hostname); } catch { return false; } };
const deny = () => { throw new Error('C9_NONLOCAL_NETWORK_DENIED'); };
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => local(input?.url || input)
  ? originalFetch(input, { ...options, redirect: 'error' }) : deny();
for (const [transport, protocol] of [[http, 'http:'], [https, 'https:']]) {
  for (const method of ['request', 'get']) {
    const original = transport[method];
    transport[method] = function (input, ...args) {
      const target = typeof input === 'object' && !(input instanceof URL)
        ? `${input.protocol || protocol}//${input.hostname || input.host || 'localhost'}` : input;
      if (!local(target)) return deny();
      const override = args[0];
      if (override && typeof override === 'object') {
        for (const key of ['hostname', 'host']) if (override[key] && !loopback(override[key])) return deny();
      }
      return original.call(this, input, ...args);
    };
  }
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0] : args;
  const first = options[0];
  const host = typeof first === 'object' ? first.host || first.hostname : typeof options[1] === 'string' ? options[1] : undefined;
  if (host && !loopback(host)) return deny();
  return connect.apply(this, args);
};
const OriginalWebSocket = globalThis.WebSocket;
globalThis.WebSocket = class extends OriginalWebSocket {
  constructor(url, ...args) { if (!local(url)) deny(); super(url, ...args); }
};
