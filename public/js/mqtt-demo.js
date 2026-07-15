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
    labAlarm: "demo/lab/alarm",
    labRetained: "demo/lab/retained",
    labQos: "demo/lab/qos",
    labWill: "demo/lab/will",
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
  const oplaStatusDotMini = document.getElementById("oplaStatusDotMini");
  const oplaStatusTextMini = document.getElementById("oplaStatusTextMini");
  const sensorTemp = document.getElementById("sensorTemp");
  const sensorHumidity = document.getElementById("sensorHumidity");
  const sensorLight = document.getElementById("sensorLight");
  const sensorButton = document.getElementById("sensorButton");
  const lastUpdate = document.getElementById("lastUpdate");
  const ledGrid = document.getElementById("ledGrid");
  const ledAllOffBtn = document.getElementById("ledAllOffBtn");
  const buzzerBtn = document.getElementById("buzzerBtn");

  const fanoutPubBtn = document.getElementById("fanoutPubBtn");
  const fanoutResult = document.getElementById("fanoutResult");
  const wildcardInbox = document.getElementById("wildcardInbox");
  const retainPayload = document.getElementById("retainPayload");
  const retainSaveBtn = document.getElementById("retainSaveBtn");
  const retainClearBtn = document.getElementById("retainClearBtn");
  const retainLateBtn = document.getElementById("retainLateBtn");
  const retainStored = document.getElementById("retainStored");
  const retainLateValue = document.getElementById("retainLateValue");
  const retainLateMeta = document.getElementById("retainLateMeta");
  const qos0Btn = document.getElementById("qos0Btn");
  const qos1Btn = document.getElementById("qos1Btn");
  const qos2Btn = document.getElementById("qos2Btn");
  const lwtSpawnBtn = document.getElementById("lwtSpawnBtn");
  const lwtKillBtn = document.getElementById("lwtKillBtn");
  const lwtNiceBtn = document.getElementById("lwtNiceBtn");
  const lwtDot = document.getElementById("lwtDot");
  const lwtStatusText = document.getElementById("lwtStatusText");
  const lwtResult = document.getElementById("lwtResult");
  const gotoOplaTab = document.getElementById("gotoOplaTab");

  let client = null;
  let lwtClient = null;
  let currentWildcardFilter = "demo/lab/+/temp";
  let wildcardHits = 0;

  const labButtons = () =>
    document.querySelectorAll(
      "#fanoutPubBtn, [data-wc-pub], #retainSaveBtn, #retainClearBtn, #retainLateBtn, #qos0Btn, #qos1Btn, #qos2Btn, #lwtSpawnBtn"
    );

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function log(text, type) {
    if (!messageLog) return;
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
    labButtons().forEach((btn) => {
      btn.disabled = !connected;
    });
    if (!connected) {
      lwtKillBtn.disabled = true;
      lwtNiceBtn.disabled = true;
    }
  }

  function setOplaOnline(online) {
    oplaStatusDot.classList.toggle("connected", online);
    oplaStatusText.textContent = online ? "Online" : "Offline";
    oplaStatusText.classList.toggle("online", online);
    oplaStatusText.classList.toggle("offline", !online);
    if (oplaStatusDotMini) {
      oplaStatusDotMini.classList.toggle("connected", online);
      oplaStatusTextMini.textContent = online ? "Opla online" : "Opla offline";
    }
  }

  function flashSensor(el) {
    if (!el) return;
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
        publishCmd(TOPICS.cmdLed(i), `${lr},${lg},${lb}`);
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

  /* —— Topic matching (browser-side for wildcard demo UX) —— */
  function topicMatches(filter, topic) {
    const f = filter.split("/");
    const t = topic.split("/");
    for (let i = 0; i < f.length; i++) {
      if (f[i] === "#") return i === f.length - 1;
      if (i >= t.length) return false;
      if (f[i] !== "+" && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
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
      case TOPICS.labWill:
        lwtResult.innerHTML =
          `LWT/status modtaget: <code>${value}</code> på <code>${TOPICS.labWill}</code>`;
        if (value === "offline") {
          lwtDot.classList.remove("connected");
          lwtStatusText.textContent = "Testament udført (offline)";
        } else if (value === "online") {
          lwtDot.classList.add("connected");
          lwtStatusText.textContent = "LWT-klient online";
        }
        break;
      case TOPICS.labRetained:
        retainStored.textContent = value || "(tom)";
        break;
    }

    if (topic.startsWith("demo/lab/") && topicMatches(currentWildcardFilter, topic)) {
      if (wildcardHits === 0) wildcardInbox.innerHTML = "";
      wildcardHits += 1;
      const row = document.createElement("div");
      row.className = "wildcard-hit";
      row.innerHTML = `<span class="topic">${topic}</span> → <span class="payload">${value}</span>`;
      wildcardInbox.prepend(row);
    }
  }

  function subscribeLabs() {
    if (!client) return;
    const topics = [
      OPLA_TOPIC,
      "demo/lab/#",
      TOPICS.labWill,
      TOPICS.labRetained,
    ];
    topics.forEach((t) => {
      client.subscribe(t, (err) => {
        if (err) log("Subscribe fejl (" + t + "): " + err.message, "system");
      });
    });
    log("Lytter på Opla + demo/lab/# (showcase)", "system");
  }

  function publishCmd(topic, payload, opts, done) {
    if (!client || !client.connected) return;
    const options = opts || {};
    client.publish(topic, payload, options, (err) => {
      if (err) {
        log("Publish fejl: " + err.message, "system");
      } else {
        log(
          "Sendt <span class='payload'>" +
            payload +
            "</span> → <span class='topic'>" +
            topic +
            "</span>" +
            (options.qos != null ? " (QoS " + options.qos + ")" : "") +
            (options.retain ? " [retain]" : ""),
          "system"
        );
      }
      if (done) done(err);
    });
  }

  /* —— Fan-out —— */
  fanoutPubBtn.addEventListener("click", () => {
    document.querySelectorAll(".fanout-sub").forEach((el) => el.classList.remove("hit"));
    fanoutResult.textContent = "Publisher…";
    publishCmd(TOPICS.labAlarm, "ALARM " + new Date().toLocaleTimeString("da-DK"), { qos: 0 }, () => {
      // Visuelle "modtagere" — samme besked når deres filter matcher
      const receivers = [
        { id: "dashboard", filter: "demo/lab/#" },
        { id: "phone", filter: "demo/lab/alarm" },
        { id: "logger", filter: "demo/+/alarm" },
      ];
      let count = 0;
      receivers.forEach((r, i) => {
        setTimeout(() => {
          if (topicMatches(r.filter, TOPICS.labAlarm)) {
            const el = document.querySelector(`[data-sub="${r.id}"]`);
            if (el) el.classList.add("hit");
            count += 1;
          }
          if (i === receivers.length - 1) {
            fanoutResult.textContent =
              `1 PUBLISH → ${count} subscribers modtog (decoupling / fan-out)`;
          }
        }, 120 * (i + 1));
      });
    });
  });

  /* —— Wildcards —— */
  document.querySelectorAll('input[name="wcFilter"]').forEach((input) => {
    input.addEventListener("change", () => {
      currentWildcardFilter = input.value;
      wildcardHits = 0;
      wildcardInbox.innerHTML =
        `<div class="wildcard-empty">Filter: <code>${currentWildcardFilter}</code> — publish for at teste</div>`;
    });
  });

  document.querySelectorAll("[data-wc-pub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const topic = btn.getAttribute("data-wc-pub");
      const payload = "ping";
      const matches = topicMatches(currentWildcardFilter, topic);
      publishCmd(topic, payload);
      if (!matches) {
        const miss = document.createElement("div");
        miss.className = "wildcard-miss";
        miss.innerHTML = `<span class="topic">${topic}</span> matchede ikke filteret`;
        if (wildcardHits === 0 && wildcardInbox.querySelector(".wildcard-empty")) {
          wildcardInbox.innerHTML = "";
        }
        wildcardInbox.prepend(miss);
      }
    });
  });

  /* —— Retain —— */
  retainSaveBtn.addEventListener("click", () => {
    const payload = retainPayload.value || " ";
    publishCmd(TOPICS.labRetained, payload, { retain: true, qos: 1 }, () => {
      retainStored.textContent = payload;
      retainLateValue.textContent = "—";
      retainLateMeta.textContent = "klar til sen subscriber";
    });
  });

  retainClearBtn.addEventListener("click", () => {
    publishCmd(TOPICS.labRetained, "", { retain: true, qos: 1 }, () => {
      retainStored.textContent = "(ryddet)";
      retainLateValue.textContent = "—";
      retainLateMeta.textContent = "retained clear (tom payload)";
    });
  });

  retainLateBtn.addEventListener("click", () => {
    retainLateMeta.textContent = "Forbinder ny klient…";
    retainLateValue.textContent = "…";
    const late = mqtt.connect(WS_URL, {
      clientId: "late-sub-" + Math.random().toString(16).slice(2, 8),
      clean: true,
    });
    let got = false;
    late.on("connect", () => {
      late.subscribe(TOPICS.labRetained);
    });
    late.on("message", (topic, payload) => {
      if (topic !== TOPICS.labRetained) return;
      got = true;
      const value = payload.toString();
      retainLateValue.textContent = value || "(tom)";
      retainLateMeta.textContent = "Leveret med det samme ved subscribe (retain)";
      setTimeout(() => late.end(true), 200);
    });
    setTimeout(() => {
      if (!got) {
        retainLateValue.textContent = "(intet retained)";
        retainLateMeta.textContent = "Ingen retained besked på topic";
      }
      if (late.connected) late.end(true);
    }, 1500);
  });

  /* —— QoS —— */
  function runQos(qos) {
    const start = performance.now();
    const payload = `qos-${qos}-${Date.now()}`;
    const textEl = document.querySelector(`.qos-result[data-qos="${qos}"] .qos-result-text`);
    textEl.textContent = "sender…";
    publishCmd(TOPICS.labQos, payload, { qos }, (err) => {
      const ms = Math.round(performance.now() - start);
      if (err) {
        textEl.textContent = "fejl: " + err.message;
        return;
      }
      const label =
        qos === 0
          ? `afsendt ~${ms} ms (ingen ack)`
          : qos === 1
            ? `PUBACK ~${ms} ms (mindst én gang)`
            : `handshake færdig ~${ms} ms (præcis én)`;
      textEl.textContent = label;
    });
  }

  qos0Btn.addEventListener("click", () => runQos(0));
  qos1Btn.addEventListener("click", () => runQos(1));
  qos2Btn.addEventListener("click", () => runQos(2));

  /* —— LWT —— */
  function setLwtControls(spawned) {
    lwtSpawnBtn.disabled = !client || !client.connected || spawned;
    lwtKillBtn.disabled = !spawned;
    lwtNiceBtn.disabled = !spawned;
  }

  lwtSpawnBtn.addEventListener("click", () => {
    if (lwtClient) {
      try {
        lwtClient.end(true);
      } catch (_) {}
    }
    lwtClient = mqtt.connect(WS_URL, {
      clientId: "lwt-demo-" + Math.random().toString(16).slice(2, 8),
      clean: true,
      will: {
        topic: TOPICS.labWill,
        payload: "offline",
        qos: 1,
        retain: true,
      },
    });
    lwtClient.on("connect", () => {
      publishVia(lwtClient, TOPICS.labWill, "online", { retain: true, qos: 1 });
      lwtDot.classList.add("connected");
      lwtStatusText.textContent = "LWT-klient online";
      lwtResult.textContent =
        "Klient kører med will=offline. Kill = abrupt. Pæn DISCONNECT = ingen testament.";
      setLwtControls(true);
    });
  });

  function publishVia(c, topic, payload, opts) {
    c.publish(topic, payload, opts || {});
  }

  lwtKillBtn.addEventListener("click", () => {
    if (!lwtClient) return;
    lwtResult.textContent = "Forbindelse dræbes — broker bør udgive LWT (offline)…";
    // Abrupt close uden MQTT DISCONNECT
    try {
      if (lwtClient.stream && lwtClient.stream.destroy) {
        lwtClient.stream.destroy();
      } else if (lwtClient.conn && lwtClient.conn.close) {
        lwtClient.conn.close();
      } else {
        lwtClient.end(true);
      }
    } catch (_) {
      lwtClient.end(true);
    }
    lwtClient = null;
    setLwtControls(false);
    lwtSpawnBtn.disabled = !(client && client.connected);
  });

  lwtNiceBtn.addEventListener("click", () => {
    if (!lwtClient) return;
    lwtResult.textContent =
      "Pæn DISCONNECT — testament udføres IKKE. Status sættes manuelt til offline.";
    publishVia(lwtClient, TOPICS.labWill, "offline", { retain: true, qos: 1 });
    lwtClient.end(false);
    lwtClient = null;
    lwtDot.classList.remove("connected");
    lwtStatusText.textContent = "Pænt afkoblet";
    setLwtControls(false);
    lwtSpawnBtn.disabled = !(client && client.connected);
  });

  /* —— Tabs —— */
  document.querySelectorAll(".lab-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      document.querySelectorAll(".lab-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".lab-pane").forEach((pane) => {
        const on = pane.id === "tab-" + name;
        pane.classList.toggle("active", on);
        pane.hidden = !on;
      });
    });
  });

  gotoOplaTab.addEventListener("click", () => {
    document.querySelector('.lab-tab[data-tab="opla"]').click();
  });

  /* —— Connect —— */
  connectBtn.addEventListener("click", () => {
    if (client && client.connected) {
      client.end();
      if (lwtClient) {
        try {
          lwtClient.end(true);
        } catch (_) {}
        lwtClient = null;
      }
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
      subscribeLabs();
      setLwtControls(false);
      lwtSpawnBtn.disabled = false;
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
      if (err) log("Subscribe fejl: " + err.message, "system");
      else log("Subscribed til <span class='topic'>" + topic + "</span>", "system");
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
