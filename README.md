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

## Arduino Opla

Sæt `mqtt_server` i Arduino-koden til din PCs lokale IP-adresse (ikke `localhost` — det peger på enheden selv).

```cpp
const char* mqtt_server = "192.168.1.100";
const int   mqtt_port   = 1883;
```

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
