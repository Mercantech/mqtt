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

  // MQTT-klient setup (selve connect sker i loop når WiFi er klar).
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);  // broker fra secrets.h
  mqtt.setCallback(mqttCallback);          // håndter indkommende cmd-topics
  mqtt.setBufferSize(256);                 // plads til topic + payload

  connectWiFi();
}

void loop() {
  displayTick();

  // Tilstands-maskine: WiFi → MQTT → arbejde
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  } else if (!mqtt.connected()) {
    connectMQTT();
  } else {
    // SKAL kaldes ofte: holder keep-alive i live og triggere mqttCallback.
    mqtt.loop();

    // Periodisk publish af sensorer (QoS 0 via PubSubClient default).
    if (millis() - lastPublish >= PUBLISH_INTERVAL_MS) {
      lastPublish = millis();
      publishSensorData();
    }

    checkButtons();  // knaptryk → publish på demo/opla/button
  }
}

