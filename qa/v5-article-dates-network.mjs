// Test-only preload. The following fixture may replace HTTP/fetch with synthetic
// responses, but it never saves or calls a real outbound transport.
import { syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
import net from "node:net";
const deny = () => {
  throw new Error("C14_UNEXPECTED_OUTBOUND_DENIED");
};
globalThis.fetch = async () => deny();
for (const transport of [http, https]) {
  transport.request = deny;
  transport.get = deny;
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0] : args;
  const first = options[0];
  const host =
    typeof first === "object"
      ? first.host || first.hostname
      : typeof options[1] === "string"
        ? options[1]
        : undefined;
  if (host && !["127.0.0.1", "localhost", "::1"].includes(host)) return deny();
  return connect.apply(this, args);
};
syncBuiltinESMExports();
