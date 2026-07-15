(function () {
  const OPLA_TOPIC = "demo/opla/#";
  const LED_COUNT = 5;
  const LED_COLORS = [
    { r: 0, g: 0, b: 255, label: "Blå" },
    { r: 0, g: 255, b: 0, label: "Grøn" },
    { r: 255, g: 0, b: 0, label: "Rød" },
    { r: 0, g: 255, b: 255, label: "Cyan" },
    { r: 255, g: 255, b: 255, label: "Hvid" },
  ];

  const TOPICS = {
    status: "demo/opla/status",
    temp: "demo/opla/temp",
    humidity: "demo/opla/humidity",
    light: "demo/opla/light",
    button: "demo/opla/button",
    cmdBuzzer: "demo/opla/cmd/buzzer",
    cmdLed: (i) => `demo/opla/cmd/led/${i}`,
    cmdLedAll: "demo/opla/cmd/led",
  };

  const WS_URL = `ws://${location.hostname}:8888`;

  const connectBtn = document.getElementById("connectBtn");
  const subBtn = document.getElementById("subBtn");
  const pubBtn = document.getElementById("pubBtn");
  const statusDot = document.getElementById("statusDot");
  const messageLog = document.getElementById("messageLog");
  const subTopic = document.getElementById("subTopic");
  const pubTopic = document.getElementById("pubTopic");
  const pubPayload = document.getElementById("pubPayload");

  const oplaStatusDot = document.getElementById("oplaStatusDot");
  const oplaStatusText = document.getElementById("oplaStatusText");
  const sensorTemp = document.getElementById("sensorTemp");
  const sensorHumidity = document.getElementById("sensorHumidity");
  const sensorLight = document.getElementById("sensorLight");
  const sensorButton = document.getElementById("sensorButton");
  const lastUpdate = document.getElementById("lastUpdate");
  const ledGrid = document.getElementById("ledGrid");
  const ledAllOffBtn = document.getElementById("ledAllOffBtn");
  const buzzerBtn = document.getElementById("buzzerBtn");

  let client = null;
  const ledState = Array(LED_COUNT).fill(false);

  function log(text, type) {
    const entry = document.createElement("div");
    entry.className = "log-entry" + (type ? " " + type : "");
    const time = new Date().toLocaleTimeString("da-DK");
    entry.innerHTML = `<span class="time">${time}</span>${text}`;
    messageLog.appendChild(entry);
    messageLog.scrollTop = messageLog.scrollHeight;
  }

  function setConnected(connected) {
    statusDot.classList.toggle("connected", connected);
    connectBtn.textContent = connected ? "Afbryd" : "Forbind";
    subBtn.disabled = !connected;
    pubBtn.disabled = !connected;
    ledAllOffBtn.disabled = !connected;
    buzzerBtn.disabled = !connected;
    ledGrid.querySelectorAll("button").forEach((btn) => {
      btn.disabled = !connected;
    });
  }

  function setOplaOnline(online) {
    oplaStatusDot.classList.toggle("connected", online);
    oplaStatusText.textContent = online ? "Online" : "Offline";
    oplaStatusText.classList.toggle("online", online);
    oplaStatusText.classList.toggle("offline", !online);
  }

  function flashSensor(el) {
    el.classList.remove("updated");
    void el.offsetWidth;
    el.classList.add("updated");
  }

  function updateLastSeen() {
    const now = new Date().toLocaleTimeString("da-DK");
    lastUpdate.textContent = "Seneste opdatering: " + now;
  }

  function setLedUi(index, on) {
    ledState[index] = on;
    const item = ledGrid.querySelector(`[data-led="${index}"]`);
    if (!item) return;
    const preview = item.querySelector(".led-preview");
    const toggle = item.querySelector(".led-toggle");
    preview.classList.toggle("active", on);
    toggle.textContent = on ? "Sluk" : "Tænd";
    toggle.classList.toggle("btn-led-on", !on);
    toggle.classList.toggle("btn-outline", on);
  }

  function buildLedGrid() {
    ledGrid.innerHTML = "";
    for (let i = 0; i < LED_COUNT; i++) {
      const color = LED_COLORS[i];
      const item = document.createElement("div");
      item.className = "led-item";
      item.dataset.led = String(i);
      item.innerHTML = `
        <span class="led-preview" style="--led-color: rgb(${color.r},${color.g},${color.b})"></span>
        <div class="led-meta">
          <span class="led-index">LED ${i}</span>
          <span class="led-name">${color.label}</span>
        </div>
        <button class="btn btn-led-on led-toggle" disabled>Tænd</button>
      `;
      item.querySelector(".led-toggle").addEventListener("click", () => {
        const next = !ledState[i];
        publishCmd(TOPICS.cmdLed(i), next ? "on" : "off");
        setLedUi(i, next);
      });
      ledGrid.appendChild(item);
    }
  }

  function handleOplaMessage(topic, payload) {
    const value = payload.toString();

    switch (topic) {
      case TOPICS.status:
        setOplaOnline(value === "online");
        break;
      case TOPICS.temp:
        sensorTemp.textContent = value;
        flashSensor(sensorTemp.closest(".sensor-card"));
        updateLastSeen();
        break;
      case TOPICS.humidity:
        sensorHumidity.textContent = value;
        flashSensor(sensorHumidity.closest(".sensor-card"));
        updateLastSeen();
        break;
      case TOPICS.light:
        sensorLight.textContent = value;
        flashSensor(sensorLight.closest(".sensor-card"));
        updateLastSeen();
        break;
      case TOPICS.button:
        sensorButton.textContent = value;
        flashSensor(sensorButton.closest(".sensor-card"));
        updateLastSeen();
        break;
    }
  }

  function subscribeOpla() {
    if (!client) return;
    client.subscribe(OPLA_TOPIC, (err) => {
      if (err) {
        log("Subscribe fejl: " + err.message, "system");
      } else {
        log("Lytter på <span class='topic'>" + OPLA_TOPIC + "</span>", "system");
      }
    });
  }

  function publishCmd(topic, payload) {
    if (!client || !client.connected) return;
    client.publish(topic, payload, (err) => {
      if (err) {
        log("Publish fejl: " + err.message, "system");
      } else {
        log(
          "Sendt <span class='payload'>" + payload + "</span> → <span class='topic'>" + topic + "</span>",
          "system"
        );
      }
    });
  }

  connectBtn.addEventListener("click", () => {
    if (client && client.connected) {
      client.end();
      return;
    }

    log("Forbinder til " + WS_URL + " …", "system");

    client = mqtt.connect(WS_URL, {
      clientId: "pensum-demo-" + Math.random().toString(16).slice(2, 8),
      clean: true,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      setConnected(true);
      log("Forbundet til broker", "system");
      subscribeOpla();
    });

    client.on("message", (topic, payload) => {
      handleOplaMessage(topic, payload);
      log(
        `<span class="topic">${topic}</span> → <span class="payload">${payload.toString()}</span>`
      );
    });

    client.on("error", (err) => {
      log("Fejl: " + err.message, "system");
    });

    client.on("close", () => {
      setConnected(false);
      setOplaOnline(false);
      log("Forbindelse lukket", "system");
    });
  });

  subBtn.addEventListener("click", () => {
    const topic = subTopic.value.trim();
    if (!topic || !client) return;
    client.subscribe(topic, (err) => {
      if (err) {
        log("Subscribe fejl: " + err.message, "system");
      } else {
        log("Subscribed til <span class='topic'>" + topic + "</span>", "system");
      }
    });
  });

  pubBtn.addEventListener("click", () => {
    const topic = pubTopic.value.trim();
    const payload = pubPayload.value;
    if (!topic || !client) return;
    publishCmd(topic, payload);
  });

  ledAllOffBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdLedAll, "off");
    for (let i = 0; i < LED_COUNT; i++) {
      setLedUi(i, false);
    }
  });

  buzzerBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdBuzzer, "beep");
  });

  buildLedGrid();
})();
