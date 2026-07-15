(function () {
  const WS_URL = `ws://${location.hostname}:8888`;
  const connectBtn = document.getElementById("connectBtn");
  const subBtn = document.getElementById("subBtn");
  const pubBtn = document.getElementById("pubBtn");
  const statusDot = document.getElementById("statusDot");
  const messageLog = document.getElementById("messageLog");
  const subTopic = document.getElementById("subTopic");
  const pubTopic = document.getElementById("pubTopic");
  const pubPayload = document.getElementById("pubPayload");

  let client = null;

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
    });

    client.on("message", (topic, payload) => {
      log(
        `<span class="topic">${topic}</span> → <span class="payload">${payload.toString()}</span>`
      );
    });

    client.on("error", (err) => {
      log("Fejl: " + err.message, "system");
    });

    client.on("close", () => {
      setConnected(false);
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
    client.publish(topic, payload, (err) => {
      if (err) {
        log("Publish fejl: " + err.message, "system");
      }
    });
  });
})();
