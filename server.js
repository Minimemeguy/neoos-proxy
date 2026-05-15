// ============================================================
// NeoOS Scramjet Proxy Server (Render Fixed + ESM Safe)
// ============================================================

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { WebSocketServer } from "ws";

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { routeRequest } from "@mercuryworkshop/wisp-js/server";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;

// ✅ SAFE package resolution (Render + Node 20 compatible)
const scramjetPath = dirname(
  require.resolve("@mercuryworkshop/scramjet/package.json")
);

const baremuxPath = dirname(
  require.resolve("@mercuryworkshop/bare-mux/package.json")
);

const libcurlPath = dirname(
  require.resolve("@mercuryworkshop/libcurl-transport/package.json")
);

// ─────────────────────────────────────────────
// Fastify app
// ─────────────────────────────────────────────
const app = Fastify({
  logger: true,
});

// ─────────────────────────────────────────────
// Scramjet engine
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
});

// ─────────────────────────────────────────────
// BareMux transport
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: baremuxPath,
  prefix: "/baremux/",
  decorateReply: false,
});

// ─────────────────────────────────────────────
// libcurl transport
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: libcurlPath,
  prefix: "/libcurl/",
  decorateReply: false,
});

// ─────────────────────────────────────────────
// Frontend
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/",
  decorateReply: false,
});

// SPA fallback
app.setNotFoundHandler((_req, reply) => {
  reply.sendFile("index.html");
});

await app.ready();

// ─────────────────────────────────────────────
// Wisp WebSocket server
// ─────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

app.server.on("upgrade", (request, socket, head) => {
  try {
    if (request.url && request.url.startsWith("/wisp/")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        routeRequest(ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch (err) {
    console.error("WebSocket upgrade failed:", err);
    socket.destroy();
  }
});

// ─────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────
try {
  await app.listen({
    port: PORT,
    host: "0.0.0.0",
  });

  console.log(`✅ NeoOS Proxy running on port ${PORT}`);
} catch (err) {
  console.error("Server failed to start:", err);
  process.exit(1);
}
