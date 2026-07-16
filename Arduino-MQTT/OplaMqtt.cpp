#include "OplaMqtt.h"

#include <Arduino.h>
#include <cstring>
#include <cstdio>

#include "OplaGlobals.h"
#include "OplaDisplay.h"
#include "OplaLeds.h"

void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqtt.connected()) return;
  if (millis() - lastMqttRetry < MQTT_RETRY_MS) return;

  lastMqttRetry = millis();

  Serial.print(F("MQTT: forbinder til "));
  Serial.print(MQTT_SERVER);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);

  displayShowPhase("MQTT");

  if (mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr, TOPIC_STATUS, 0, true, "offline")) {
    Serial.println(F("MQTT: forbundet"));
    mqtt.subscribe(TOPIC_CMD);
    mqtt.publish(TOPIC_STATUS, "online", true);
    ui.phase[0] = '\0';

    displayActivity("MQTT OK");
    displayRedrawIfDue(true);
  } else {
    Serial.print(F("MQTT: fejl rc="));
    Serial.println(mqtt.state());
    displayShowPhase("MQTT fejl");
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.print(F("Modtaget ["));
  Serial.print(topic);
  Serial.print(F("]: "));
  Serial.println(message);

  if (strncmp(topic, "demo/opla/cmd/led/", 18) == 0) {
    int index = atoi(topic + 18);
    setLedFromCommand(index, message);
  } else if (strcmp(topic, "demo/opla/cmd/led") == 0) {
    setAllLedsFromCommand(message);
  }

  if (strcmp(topic, "demo/opla/cmd/buzzer") == 0 && strcmp(message, "beep") == 0) {
    carrier.Buzzer.beep(800, 100);
    displayActivity("Buzzer!");
  }
}

