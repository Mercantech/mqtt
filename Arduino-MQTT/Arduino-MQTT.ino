/*
 * Arduino Opla (MKR WiFi 1010) — MQTT demo-klient
 *
 * Publiserer sensor-data til demo/opla/* topics på brokeren,
 * så pensumsidens live demo kan subscribe med demo/opla/#
 *
 * Biblioteker (Arduino Library Manager):
 *   - WiFiNINA
 *   - PubSubClient (Nick O'Leary)
 *   - Arduino_MKRIoTCarrier
 *
 * API-reference:
 *   https://docs.arduino.cc/tutorials/mkr-iot-carrier/mkr-iot-carrier-01-technical-reference/
 *
 * Opsætning:
 *   1. Kopiér secrets.h.example → secrets.h
 *   2. Udfyld WiFi og MQTT i secrets.h
 *   3. Upload til MKR WiFi 1010 med Opla carrier
 */

#include <WiFiNINA.h>
#include <PubSubClient.h>
#include <Arduino_MKRIoTCarrier.h>

#include "secrets.h"

const char* TOPIC_STATUS    = "demo/opla/status";
const char* TOPIC_TEMP      = "demo/opla/temp";
const char* TOPIC_HUMIDITY  = "demo/opla/humidity";
const char* TOPIC_LIGHT     = "demo/opla/light";
const char* TOPIC_BUTTON    = "demo/opla/button";
const char* TOPIC_CMD       = "demo/opla/cmd/#";

const unsigned long PUBLISH_INTERVAL_MS = 5000;
const unsigned long WIFI_RETRY_MS       = 5000;
const unsigned long MQTT_RETRY_MS       = 5000;

MKRIoTCarrier carrier;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish   = 0;
unsigned long lastWifiRetry = 0;
unsigned long lastMqttRetry = 0;

void logLine(const __FlashStringHelper* msg) {
  Serial.println(msg);
  carrier.display.fillScreen(ST77XX_BLACK);
  carrier.display.setCursor(0, 0);
  carrier.display.setTextColor(ST77XX_WHITE);
  carrier.display.print(msg);
}

void setAllLeds(uint8_t r, uint8_t g, uint8_t b) {
  for (int i = 0; i < 5; i++) {
    carrier.leds.setPixelColor(i, r, g, b);
  }
  carrier.leds.show();
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiRetry < WIFI_RETRY_MS) return;
  lastWifiRetry = millis();

  Serial.print(F("WiFi: forbinder til "));
  Serial.println(SECRET_SSID);
  logLine(F("WiFi..."));

  WiFi.disconnect();
  WiFi.begin(SECRET_SSID, SECRET_PASS);
}

void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqtt.connected()) return;
  if (millis() - lastMqttRetry < MQTT_RETRY_MS) return;
  lastMqttRetry = millis();

  Serial.print(F("MQTT: forbinder til "));
  Serial.print(MQTT_SERVER);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);
  logLine(F("MQTT..."));

  if (mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr, TOPIC_STATUS, 0, true, "offline")) {
    Serial.println(F("MQTT: forbundet"));
    logLine(F("MQTT OK"));

    mqtt.subscribe(TOPIC_CMD);
    mqtt.publish(TOPIC_STATUS, "online", true);
  } else {
    Serial.print(F("MQTT: fejl rc="));
    Serial.println(mqtt.state());
    logLine(F("MQTT fejl"));
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print(F("Modtaget ["));
  Serial.print(topic);
  Serial.print(F("]: "));

  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.println(message);

  if (strcmp(topic, "demo/opla/cmd/led") == 0) {
    if (strcmp(message, "on") == 0 || strcmp(message, "1") == 0) {
      setAllLeds(0, 255, 0);
    } else {
      setAllLeds(0, 0, 0);
    }
  }

  if (strcmp(topic, "demo/opla/cmd/buzzer") == 0 && strcmp(message, "beep") == 0) {
    carrier.Buzzer.beep(800, 100);
  }
}

void publishSensorData() {
  float temp     = carrier.Env.readTemperature();
  float humidity = carrier.Env.readHumidity();

  int r, g, b, light;
  while (!carrier.Light.colorAvailable()) {
    delay(5);
  }
  carrier.Light.readColor(r, g, b, light);

  char buf[16];

  snprintf(buf, sizeof(buf), "%.1f", temp);
  mqtt.publish(TOPIC_TEMP, buf);
  Serial.print(F("Publiseret temp: "));
  Serial.println(buf);

  snprintf(buf, sizeof(buf), "%.1f", humidity);
  mqtt.publish(TOPIC_HUMIDITY, buf);
  Serial.print(F("Publiseret humidity: "));
  Serial.println(buf);

  snprintf(buf, sizeof(buf), "%d", light);
  mqtt.publish(TOPIC_LIGHT, buf);
  Serial.print(F("Publiseret light: "));
  Serial.println(buf);

  carrier.display.setCursor(0, 20);
  carrier.display.print(F("T:"));
  carrier.display.print(temp, 1);
  carrier.display.print(F(" H:"));
  carrier.display.print(humidity, 0);
  carrier.display.print(F("% L:"));
  carrier.display.print(light);
}

void checkButtons() {
  carrier.Buttons.update();

  if (carrier.Button0.onTouchDown()) publishButton(0);
  if (carrier.Button1.onTouchDown()) publishButton(1);
  if (carrier.Button2.onTouchDown()) publishButton(2);
  if (carrier.Button3.onTouchDown()) publishButton(3);
  if (carrier.Button4.onTouchDown()) publishButton(4);
}

void publishButton(int id) {
  char payload[8];
  snprintf(payload, sizeof(payload), "btn-%d", id);
  mqtt.publish(TOPIC_BUTTON, payload);
  Serial.print(F("Knap trykket: "));
  Serial.println(payload);
  carrier.Buzzer.beep(800, 50);
}

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000) {}

  carrier.noCase();
  if (!carrier.begin()) {
    Serial.println(F("Fejl: MKR IoT Carrier init fejlede"));
    while (true) delay(1000);
  }

  carrier.display.setRotation(2);
  logLine(F("Opla MQTT"));

  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(256);

  connectWiFi();
}

void loop() {
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
