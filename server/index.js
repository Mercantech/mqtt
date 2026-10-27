const express = require("express");
const http = require("http");
const path = require("path");
const aedes = require("aedes")();
const ws = require("ws");
const net = require("net");

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const MQTT_PORT = process.env.MQTT_PORT || 1883;
const WS_PORT = process.env.WS_PORT || 8888;

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mqtt: {
      tcp: MQTT_PORT,
      websocketPath: "/mqtt",
      websocketPort: WS_PORT,
    },
    http: HTTP_PORT,
  });
});

const HOST = "0.0.0.0";

/**
 * MQTT over WebSocket på samme HTTP-server (path /mqtt).
 * Så HTTPS-siden kan bruge wss://host/mqtt via Cloudflare/Traefik
 * uden Mixed Content (ws:// på port 8888 blokeres fra HTTPS).
 */
function attachMqttWs(wss, label) {
  wss.on("connection", (socket, req) => {
    const stream = ws.createWebSocketStream(socket, { objectMode: false });
    aedes.handle(stream, req);
  });
  console.log(label);
}

const wsOnHttp = new ws.Server({ server, path: "/mqtt" });
attachMqttWs(
  wsOnHttp,
  `MQTT broker (WebSocket path) wss?://<host>/mqtt  (via HTTP ${HTTP_PORT})`
);

// Ekstra direkte WS-port til lokal HTTP-udvikling / ældre klienter
const wsDirect = new ws.Server({ port: WS_PORT, host: HOST });
attachMqttWs(
  wsDirect,
  `MQTT broker (WebSocket port) ws://localhost:${WS_PORT}`
);

server.listen(HTTP_PORT, HOST, () => {
  console.log(`Pensumserver kører på http://localhost:${HTTP_PORT}`);
});

const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(MQTT_PORT, HOST, () => {
  console.log(`MQTT broker (TCP) kører på mqtt://localhost:${MQTT_PORT}`);
});

aedes.on("client", (client) => {
  console.log(`[MQTT] Klient tilsluttet: ${client ? client.id : "ukendt"}`);
});

aedes.on("clientDisconnect", (client) => {
  console.log(`[MQTT] Klient frakoblet: ${client ? client.id : "ukendt"}`);
});

aedes.on("publish", (packet, client) => {
  if (client) {
    console.log(
      `[MQTT] ${client.id} → ${packet.topic}: ${packet.payload.toString()}`
    );
  }
});
