// ============================================================
//  NeoOS Scramjet Proxy Server
//  Stack: Fastify + wisp-js + libcurl-transport + Scramjet 2.0
//  Based on: github.com/MercuryWorkshop/Scramjet-App
// ============================================================

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { WebSocketServer } from "ws";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport/path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createServer } from "http";

// Wisp protocol server — handles the WebSocket tunnel
// that Scramjet uses to proxy TCP connections
import { routeRequest } from "@mercuryworkshop/wisp-js/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

// ── Create Fastify app ──────────────────────────────────────
const app = Fastify({ logger: false });

// ── Serve Scramjet engine files at /scram/ ──────────────────
// These are the JS/WASM files that power the proxy
await app.register(fastifyStatic, {
  root: scramjetPath,
  prefix: "/scram/",
});

// ── Serve BareMux transport layer at /baremux/ ──────────────
// BareMux multiplexes the HTTP transport
await app.register(fastifyStatic, {
  root: baremuxPath,
  prefix: "/baremux/",
  decorateReply: false,
});

// ── Serve libcurl transport at /libcurl/ ────────────────────
// libcurl-transport sends proxied requests encrypted over Wisp
await app.register(fastifyStatic, {
  root: libcurlPath,
  prefix: "/libcurl/",
  decorateReply: false,
});

// ── Serve the proxy frontend (public folder) at / ───────────
await app.register(fastifyStatic, {
  root: join(__dirname, "public"),
  prefix: "/",
  decorateReply: false,
});

// ── Catch-all: send index.html for any unknown route ────────
app.setNotFoundHandler((_req, reply) => {
  reply.sendFile("index.html");
});

// ── Wait for Fastify to finish loading all plugins ──────────
await app.ready();

// ── Set up WebSocket server for the Wisp tunnel ─────────────
// We use the raw http.Server from Fastify to intercept
// WebSocket upgrade requests before Fastify sees them
const wss = new WebSocketServer({ noServer: true });

app.server.on("upgrade", (request, socket, head) => {
  // Only handle Wisp WebSocket connections at /wisp/
  if (request.url.startsWith("/wisp/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      // Hand the WebSocket connection to wisp-js
      // It will handle all Wisp protocol framing automatically
      routeRequest(ws, request);
    });
  } else {
    // Reject any other WebSocket upgrades
    socket.destroy();
  }
});

// ── Start listening ─────────────────────────────────────────
await app.listen({ port: PORT, host: "0.0.0.0" });

console.log(`
╔══════════════════════════════════════════╗
║     NeoOS Scramjet Proxy Server  🚀      ║
╠══════════════════════════════════════════╣
║  HTTP  → http://localhost:${PORT}           ║
║  Wisp  → ws://localhost:${PORT}/wisp/       ║
╚══════════════════════════════════════════╝
`);
