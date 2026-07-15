# mqtt

MQTT pensum og undervisningsserver til **Arduino Opla** og **C#**.

## Indhold

- **Pensumside** — Interaktiv MQTT-teori på dansk (topics, QoS, arkitektur, kodeeksempler)
- **MQTT broker** — Indbygget broker via [Aedes](https://github.com/moscajs/aedes)
- **Live demo** — Publish/subscribe direkte i browseren

## Kom i gang

### Docker (anbefalet)

```bash
docker compose up --build
```

Åbn [http://localhost:3000](http://localhost:3000) i browseren.

Stop med `Ctrl+C` eller kør i baggrunden:

```bash
docker compose up -d --build
docker compose down
```

### Lokal udvikling

```bash
npm install
npm start
```

## Porte

| Tjeneste        | Adresse                  | Formål                          |
|-----------------|--------------------------|---------------------------------|
| Pensum (HTTP)   | `http://localhost:3000`  | Webside med teori og live demo  |
| MQTT (TCP)      | `mqtt://localhost:1883`  | Arduino Opla, C#, andre klienter|
| MQTT (WebSocket)| `ws://localhost:8888`    | Browser-demo på pensumsiden     |

## Arduino Opla (MKR WiFi 1010)

Sketchen ligger i `Arduino-MQTT/` og publicerer til `demo/opla/*` topics på brokeren.

### Opsætning

1. Installer biblioteker i Arduino IDE: **WiFiNINA**, **PubSubClient**, **Arduino_MKRIoTCarrier**
2. Kopiér `Arduino-MQTT/secrets.h.example` → `secrets.h`
3. Udfyld WiFi og MQTT (filen er gitignored)
4. Upload til MKR WiFi 1010 med Opla carrier

### Topics

| Topic | Retning | Beskrivelse |
|-------|---------|-------------|
| `demo/opla/temp` | Publish | Temperatur (°C) |
| `demo/opla/humidity` | Publish | Luftfugtighed (%) |
| `demo/opla/light` | Publish | Lysniveau |
| `demo/opla/button` | Publish | Knap-tryk (`btn-0` … `btn-4`) |
| `demo/opla/status` | Publish | `online` / `offline` (retained) |
| `demo/opla/cmd/led` | Subscribe | `on` / `off` — styr RGB LED |
| `demo/opla/cmd/buzzer` | Subscribe | `beep` — afspil lyd |

Subscribe til `demo/opla/#` i pensum-demoen for at se Opla-data live.

Sæt `mqtt_server` i Arduino-koden til brokerens IP (fx `138.199.155.78`).

## C#

```bash
dotnet add package MQTTnet
```

Se pensumsiden for komplet C#-eksempel der subscriber til `skole/+/temp`.

## Projektstruktur

```
mqtt/
├── server/index.js      # Express + Aedes MQTT broker
├── public/
│   ├── index.html       # Pensumside
│   ├── css/style.css    # MQTT-tema styling
│   └── js/mqtt-demo.js  # Live demo klient
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Miljøvariabler

| Variabel    | Standard | Beskrivelse        |
|-------------|----------|--------------------|
| `HTTP_PORT` | 3000     | Pensumserver       |
| `MQTT_PORT` | 1883     | MQTT TCP broker    |
| `WS_PORT`   | 8888     | MQTT WebSocket     |
