// ============================================================
// NeoOS Scramjet Proxy Server
// Optimized for Render Free Tier
// ============================================================

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { WebSocketServer } from "ws";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport/path";

import { routeRequest } from "@mercuryworkshop/wisp-js/server";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;

// ─────────────────────────────────────────────
// Create Fastify app
// ─────────────────────────────────────────────
const app = Fastify({
  logger: true,
});

// ─────────────────────────────────────────────
// Serve Scramjet engine
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
});

// ─────────────────────────────────────────────
// Serve BareMux
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: baremuxPath,
  prefix: "/baremux/",
  decorateReply: false,
});

// ─────────────────────────────────────────────
// Serve libcurl transport
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: libcurlPath,
  prefix: "/libcurl/",
  decorateReply: false,
});

// ─────────────────────────────────────────────
// Serve frontend
// ─────────────────────────────────────────────
await app.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/",
  decorateReply: false,
});

// ─────────────────────────────────────────────
// SPA fallback
// ─────────────────────────────────────────────
app.setNotFoundHandler((req, reply) => {
  reply.sendFile("index.html");
});

// ─────────────────────────────────────────────
// Wait for plugins
// ─────────────────────────────────────────────
await app.ready();

// ─────────────────────────────────────────────
// WebSocket server for Wisp
// ─────────────────────────────────────────────
const wss = new WebSocketServer({
  noServer: true,
});

app.server.on("upgrade", (request, socket, head) => {
  try {
    if (request.url.startsWith("/wisp/")) {
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
