(function () {
  const OPLA_TOPIC = "demo/opla/#";
  const LED_COUNT = 5;
  const DEFAULT_COLORS = [
    { r: 0, g: 0, b: 255 },
    { r: 0, g: 255, b: 0 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 255 },
    { r: 255, g: 255, b: 255 },
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

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

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
    ledGrid.querySelectorAll("button, input").forEach((el) => {
      el.disabled = !connected;
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

  function updateLedPreview(item, r, g, b, active) {
    const preview = item.querySelector(".led-preview");
    preview.style.setProperty("--led-color", `rgb(${r},${g},${b})`);
    preview.classList.toggle("active", active);
    item.querySelector(".led-rgb-text").textContent = `${r}, ${g}, ${b}`;
  }

  function readLedInputs(item) {
    const r = Math.min(255, Math.max(0, parseInt(item.querySelector(".led-r").value, 10) || 0));
    const g = Math.min(255, Math.max(0, parseInt(item.querySelector(".led-g").value, 10) || 0));
    const b = Math.min(255, Math.max(0, parseInt(item.querySelector(".led-b").value, 10) || 0));
    return { r, g, b };
  }

  function syncInputsFromColor(item, r, g, b) {
    item.querySelector(".led-color-input").value = rgbToHex(r, g, b);
    item.querySelector(".led-r").value = r;
    item.querySelector(".led-g").value = g;
    item.querySelector(".led-b").value = b;
    updateLedPreview(item, r, g, b, r > 0 || g > 0 || b > 0);
  }

  function buildLedGrid() {
    ledGrid.innerHTML = "";

    for (let i = 0; i < LED_COUNT; i++) {
      const { r, g, b } = DEFAULT_COLORS[i];
      const item = document.createElement("div");
      item.className = "led-item";
      item.dataset.led = String(i);
      item.innerHTML = `
        <div class="led-item-header">
          <span class="led-index">LED ${i}</span>
          <span class="led-preview"></span>
        </div>
        <div class="led-picker-row">
          <input type="color" class="led-color-input" value="${rgbToHex(r, g, b)}" disabled>
          <span class="led-rgb-text">${r}, ${g}, ${b}</span>
        </div>
        <div class="led-rgb-inputs">
          <label>R <input type="number" class="led-r" min="0" max="255" value="${r}" disabled></label>
          <label>G <input type="number" class="led-g" min="0" max="255" value="${g}" disabled></label>
          <label>B <input type="number" class="led-b" min="0" max="255" value="${b}" disabled></label>
        </div>
        <div class="led-actions">
          <button class="btn btn-led-on led-apply" disabled>Send farve</button>
          <button class="btn btn-outline led-off" disabled>Sluk</button>
        </div>
      `;

      const colorInput = item.querySelector(".led-color-input");
      const rgbInputs = item.querySelectorAll(".led-r, .led-g, .led-b");

      colorInput.addEventListener("input", () => {
        const rgb = hexToRgb(colorInput.value);
        syncInputsFromColor(item, rgb.r, rgb.g, rgb.b);
      });

      rgbInputs.forEach((input) => {
        input.addEventListener("input", () => {
          const rgb = readLedInputs(item);
          syncInputsFromColor(item, rgb.r, rgb.g, rgb.b);
        });
      });

      item.querySelector(".led-apply").addEventListener("click", () => {
        const { r: lr, g: lg, b: lb } = readLedInputs(item);
        const payload = `${lr},${lg},${lb}`;
        publishCmd(TOPICS.cmdLed(i), payload);
        updateLedPreview(item, lr, lg, lb, lr > 0 || lg > 0 || lb > 0);
      });

      item.querySelector(".led-off").addEventListener("click", () => {
        publishCmd(TOPICS.cmdLed(i), "off");
        const { r: lr, g: lg, b: lb } = readLedInputs(item);
        updateLedPreview(item, lr, lg, lb, false);
      });

      updateLedPreview(item, r, g, b, false);
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
    ledGrid.querySelectorAll(".led-item").forEach((item) => {
      const { r, g, b } = readLedInputs(item);
      updateLedPreview(item, r, g, b, false);
    });
  });

  buzzerBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdBuzzer, "beep");
  });

  buildLedGrid();
})();
