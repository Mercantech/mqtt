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
    mqtt: { tcp: MQTT_PORT, websocket: WS_PORT },
    http: HTTP_PORT,
  });
});

const HOST = "0.0.0.0";

server.listen(HTTP_PORT, HOST, () => {
  console.log(`Pensumserver kører på http://localhost:${HTTP_PORT}`);
});

const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(MQTT_PORT, HOST, () => {
  console.log(`MQTT broker (TCP) kører på mqtt://localhost:${MQTT_PORT}`);
});

const wsServer = new ws.Server({ port: WS_PORT, host: HOST });
wsServer.on("connection", (socket, req) => {
  const stream = ws.createWebSocketStream(socket, { objectMode: false });
  aedes.handle(stream, req);
});
console.log(`MQTT broker (WebSocket) kører på ws://localhost:${WS_PORT}`);

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
