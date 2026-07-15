(function () {
  const OPLA_TOPIC = "demo/opla/#";
  const TOPICS = {
    status: "demo/opla/status",
    temp: "demo/opla/temp",
    humidity: "demo/opla/humidity",
    light: "demo/opla/light",
    button: "demo/opla/button",
    cmdLed: "demo/opla/cmd/led",
    cmdBuzzer: "demo/opla/cmd/buzzer",
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
  const ledPreview = document.getElementById("ledPreview");
  const ledOnBtn = document.getElementById("ledOnBtn");
  const ledOffBtn = document.getElementById("ledOffBtn");
  const buzzerBtn = document.getElementById("buzzerBtn");

  let client = null;
  let ledOn = false;

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
    ledOnBtn.disabled = !connected;
    ledOffBtn.disabled = !connected;
    buzzerBtn.disabled = !connected;
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

  function setLedState(on) {
    ledOn = on;
    ledPreview.classList.toggle("active", on);
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

  ledOnBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdLed, "on");
    setLedState(true);
  });

  ledOffBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdLed, "off");
    setLedState(false);
  });

  buzzerBtn.addEventListener("click", () => {
    publishCmd(TOPICS.cmdBuzzer, "beep");
  });
})();
