import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { blockCrossSiteDEV } from "next/dist/server/lib/router-utils/block-cross-site-dev";
import { devTunnelOrigins } from "../lib/dev-tunnel-origin";

test("development origins accept one exact hostname and never alter production", () => {
  assert.deepEqual(devTunnelOrigins("development", "Tunnel-Fixture.ngrok-free.dev"), ["tunnel-fixture.ngrok-free.dev"]);
  assert.deepEqual(devTunnelOrigins("development", undefined), []);
  assert.deepEqual(devTunnelOrigins("production", "*.ngrok-free.dev"), []);
  for (const bad of ["*.ngrok-free.dev", "**.ngrok-free.dev", "https://fixture.ngrok-free.dev", "fixture.ngrok-free.dev:443",
    "fixture.ngrok-free.dev/path", "a.test,b.test", "a.test b.test", "a.test\n", ".a.test", "a..test"]) {
    assert.throws(() => devTunnelOrigins("development", bad), /one exact hostname/);
  }
});

test("the exact development hostname permits its HMR resource while other origins remain blocked", () => {
  const allowed = devTunnelOrigins("development", "tunnel-fixture.ngrok-free.dev");
  function check(origin: string, origins: string[]) {
    const request = { url: "/_next/hmr", headers: { origin } } as IncomingMessage;
    const response = { statusCode: 200, end() {} } as unknown as ServerResponse;
    return { blocked: blockCrossSiteDEV(request, response, origins, "localhost"), status: response.statusCode };
  }
  assert.deepEqual(check("https://tunnel-fixture.ngrok-free.dev", []), { blocked: true, status: 403 });
  assert.deepEqual(check("https://tunnel-fixture.ngrok-free.dev", allowed), { blocked: false, status: 200 });
  assert.deepEqual(check("https://another.ngrok-free.dev", allowed), { blocked: true, status: 403 });
  assert.deepEqual(check("http://localhost:3000", allowed), { blocked: false, status: 200 });
});
