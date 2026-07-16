/*
 * Arduino Opla (MKR WiFi 1010) — MQTT demo-klient
 *
 * Refaktoreret til modulopdelt C++:
 * - OplaGlobals.*  (delt state og konstanter)
 * - OplaDisplay.*  (display/UI)
 * - OplaNet.*      (WiFi)
 * - OplaMqtt.*     (MQTT + callback)
 * - OplaSensors.*  (sensorer + knapper)
 * - OplaLeds.*     (LED-kommandoer)
 */

#include "OplaGlobals.h"
#include "OplaDisplay.h"
#include "OplaNet.h"
#include "OplaMqtt.h"
#include "OplaSensors.h"

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {}

  carrier.noCase();
  if (!carrier.begin()) {
    Serial.println(F("Fejl: MKR IoT Carrier init fejlede"));
    while (true) delay(1000);
  }

  carrier.display.setRotation(2);
  displaySplash();

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(256);

  connectWiFi();
}

void loop() {
  displayTick();

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  } else if (!mqtt.connected()) {
    connectMQTT();
  } else {
    mqtt.loop();

    if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
      lastPublish = millis();
      publishSensorData();
    }

    checkButtons();
  }
}

