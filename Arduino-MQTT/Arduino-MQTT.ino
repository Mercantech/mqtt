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
 * Display API (240×240 ST7789 via Adafruit_GFX):
 *   https://docs.arduino.cc/tutorials/mkr-iot-carrier/mkr-iot-carrier-01-technical-reference/
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

const uint8_t LED_COLORS[5][3] = {
  {0, 0, 255},
  {0, 255, 0},
  {255, 0, 0},
  {0, 255, 255},
  {255, 255, 255},
};

const unsigned long PUBLISH_INTERVAL_MS = 5000;
const unsigned long WIFI_RETRY_MS       = 5000;
const unsigned long MQTT_RETRY_MS       = 5000;
const unsigned long DISPLAY_REFRESH_MS  = 1000;
const unsigned long ACTIVITY_SHOW_MS    = 3500;

// Layout til rund 240×240 skærm — hold indhold i sikker zone
const int SAFE_X = 48;
const int SAFE_W = 144;
const int Y_TITLE    = 56;
const int Y_STATUS   = 74;
const int Y_SENSORS  = 92;
const int Y_LEDS     = 132;
const int Y_ACTIVITY = 158;

// RGB565 — MQTT-tema
const uint16_t COLOR_BG     = 0x0841;
const uint16_t COLOR_PANEL  = 0x10A2;
const uint16_t COLOR_ACCENT = 0x07FF;
const uint16_t COLOR_MQTT   = 0x07E0;
const uint16_t COLOR_WIFI   = 0xFD20;
const uint16_t COLOR_TEMP   = 0xFC60;
const uint16_t COLOR_HUM    = 0x5D1F;
const uint16_t COLOR_LUX    = 0xFE19;
const uint16_t COLOR_DIM    = 0x3186;
const uint16_t COLOR_LABEL  = 0x8C71;

MKRIoTCarrier carrier;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish      = 0;
unsigned long lastWifiRetry    = 0;
unsigned long lastMqttRetry    = 0;
unsigned long lastDisplayDraw  = 0;
unsigned long activityUntil    = 0;
unsigned long splashFrame      = 0;

struct UiState {
  float temp     = 0;
  float humidity = 0;
  int light      = 0;
  bool wifiOk    = false;
  bool mqttOk    = false;
  uint8_t ledRgb[5][3] = {{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0}};
  char activity[28];
  char phase[16];
};

UiState ui;

void setLed(int index, uint8_t r, uint8_t g, uint8_t b);
void setLedFromCommand(int index, const char* cmd);
void publishButton(int id);
void displayRedraw();
void displayShowPhase(const char* phase);

void displayActivity(const char* msg) {
  strncpy(ui.activity, msg, sizeof(ui.activity) - 1);
  ui.activity[sizeof(ui.activity) - 1] = '\0';
  activityUntil = millis() + ACTIVITY_SHOW_MS;
  displayRedraw();
}

void drawStatusDot(int x, int y, bool on, uint16_t color) {
  carrier.display.fillCircle(x, y, 4, on ? color : COLOR_DIM);
}

void drawLedDots() {
  int startX = 76;
  for (int i = 0; i < 5; i++) {
    int x = startX + i * 24;
    int y = Y_LEDS;
    uint16_t c = (ui.ledRgb[i][0] || ui.ledRgb[i][1] || ui.ledRgb[i][2])
      ? carrier.leds.Color(ui.ledRgb[i][0], ui.ledRgb[i][1], ui.ledRgb[i][2])
      : COLOR_DIM;
    carrier.display.fillCircle(x, y, 5, c);
  }
}

void drawSensorRow() {
  char buf[8];

  carrier.display.fillRoundRect(SAFE_X, Y_SENSORS, SAFE_W, 36, 6, COLOR_PANEL);

  carrier.display.setTextSize(1);
  carrier.display.setTextColor(COLOR_TEMP, COLOR_PANEL);
  carrier.display.setCursor(SAFE_X + 8, Y_SENSORS + 4);
  carrier.display.print(F("TEMP"));
  carrier.display.setTextColor(COLOR_HUM, COLOR_PANEL);
  carrier.display.setCursor(SAFE_X + 54, Y_SENSORS + 4);
  carrier.display.print(F("FUGT"));
  carrier.display.setTextColor(COLOR_LUX, COLOR_PANEL);
  carrier.display.setCursor(SAFE_X + 100, Y_SENSORS + 4);
  carrier.display.print(F("LYS"));

  carrier.display.setTextSize(2);
  carrier.display.setTextColor(ST77XX_WHITE, COLOR_PANEL);

  snprintf(buf, sizeof(buf), "%.0f", ui.temp);
  carrier.display.setCursor(SAFE_X + 8, Y_SENSORS + 16);
  carrier.display.print(buf);

  snprintf(buf, sizeof(buf), "%.0f", ui.humidity);
  carrier.display.setCursor(SAFE_X + 54, Y_SENSORS + 16);
  carrier.display.print(buf);

  snprintf(buf, sizeof(buf), "%d", ui.light);
  carrier.display.setCursor(SAFE_X + 100, Y_SENSORS + 16);
  carrier.display.print(buf);
}

void drawActivityLine() {
  carrier.display.fillRoundRect(SAFE_X, Y_ACTIVITY, SAFE_W, 22, 5, COLOR_PANEL);

  carrier.display.setTextSize(1);
  carrier.display.setCursor(SAFE_X + 8, Y_ACTIVITY + 7);

  if (millis() < activityUntil && ui.activity[0] != '\0') {
    carrier.display.setTextColor(COLOR_ACCENT, COLOR_PANEL);
    carrier.display.print(F("> "));
    carrier.display.setTextColor(ST77XX_WHITE, COLOR_PANEL);
    carrier.display.print(ui.activity);
  } else if (ui.mqttOk) {
    carrier.display.setTextColor(COLOR_MQTT, COLOR_PANEL);
    carrier.display.print(F("MQTT live"));
  } else {
    carrier.display.setTextColor(COLOR_LABEL, COLOR_PANEL);
    carrier.display.print(F("Venter..."));
  }
}

void drawCenteredTitle(const __FlashStringHelper* line1, const __FlashStringHelper* line2, uint16_t color1) {
  carrier.display.setTextSize(2);
  carrier.display.setTextColor(color1, COLOR_BG);
  carrier.display.setCursor(72, 88);
  carrier.display.print(line1);

  if (line2) {
    carrier.display.setTextSize(1);
    carrier.display.setTextColor(COLOR_LABEL, COLOR_BG);
    carrier.display.setCursor(78, 116);
    carrier.display.print(line2);
  }
}

void displaySplash() {
  carrier.display.fillScreen(COLOR_BG);
  drawCenteredTitle(F("MQTT"), F("PENSUM"), COLOR_ACCENT);

  carrier.display.drawCircle(120, 120, 92, COLOR_ACCENT);
  carrier.display.setTextSize(1);
  carrier.display.setTextColor(COLOR_ACCENT, COLOR_BG);
  carrier.display.setCursor(68, 136);
  carrier.display.print(F("Opla IoT Demo"));
}

void displayShowPhase(const char* phase) {
  strncpy(ui.phase, phase, sizeof(ui.phase) - 1);
  ui.phase[sizeof(ui.phase) - 1] = '\0';

  carrier.display.fillScreen(COLOR_BG);
  drawCenteredTitle(F("MQTT"), F("Forbinder..."), COLOR_ACCENT);

  carrier.display.setTextColor(COLOR_WIFI, COLOR_BG);
  carrier.display.setCursor(88, 136);
  carrier.display.print(phase);

  splashFrame = millis();
}

void displayAnimateConnecting() {
  if (ui.phase[0] == '\0') return;
  int dots = (millis() / 400) % 4;
  carrier.display.fillRect(88, 152, 64, 10, COLOR_BG);
  carrier.display.setTextColor(COLOR_LABEL, COLOR_BG);
  carrier.display.setCursor(88, 152);
  for (int i = 0; i < dots; i++) {
    carrier.display.print('.');
  }
}

void displayRedraw() {
  ui.wifiOk = WiFi.status() == WL_CONNECTED;
  ui.mqttOk = mqtt.connected();

  carrier.display.fillScreen(COLOR_BG);

  carrier.display.setTextSize(1);
  carrier.display.setTextColor(COLOR_ACCENT, COLOR_BG);
  carrier.display.setCursor(78, Y_TITLE);
  carrier.display.print(F("MQTT PENSUM"));

  drawStatusDot(82, Y_STATUS, ui.wifiOk, COLOR_WIFI);
  carrier.display.setTextColor(ui.wifiOk ? COLOR_WIFI : COLOR_LABEL, COLOR_BG);
  carrier.display.setCursor(92, Y_STATUS - 4);
  carrier.display.print(F("WiFi"));

  drawStatusDot(148, Y_STATUS, ui.mqttOk, COLOR_MQTT);
  carrier.display.setTextColor(ui.mqttOk ? COLOR_MQTT : COLOR_LABEL, COLOR_BG);
  carrier.display.setCursor(158, Y_STATUS - 4);
  carrier.display.print(F("MQTT"));

  drawSensorRow();
  drawLedDots();
  drawActivityLine();

  lastDisplayDraw = millis();
}

void displayTick() {
  if (ui.phase[0] != '\0' && (!ui.wifiOk || !ui.mqttOk)) {
    displayAnimateConnecting();
    return;
  }

  if (ui.phase[0] != '\0' && ui.wifiOk && ui.mqttOk) {
    ui.phase[0] = '\0';
    displayActivity("Online!");
    return;
  }

  if (millis() - lastDisplayDraw > DISPLAY_REFRESH_MS) {
    bool needRedraw = millis() >= activityUntil && activityUntil != 0;
    if (needRedraw) {
      activityUntil = 0;
      displayRedraw();
    }
  }
}

void setLedQuiet(int index, uint8_t r, uint8_t g, uint8_t b) {
  if (index < 0 || index >= 5) return;
  carrier.leds.setPixelColor(index, r, g, b);
  ui.ledRgb[index][0] = r;
  ui.ledRgb[index][1] = g;
  ui.ledRgb[index][2] = b;
}

void setLed(int index, uint8_t r, uint8_t g, uint8_t b) {
  setLedQuiet(index, r, g, b);
  carrier.leds.show();
  displayRedraw();
}

void setLedFromCommand(int index, const char* cmd) {
  if (index < 0 || index >= 5) return;

  if (strcmp(cmd, "off") == 0 || strcmp(cmd, "0") == 0) {
    setLed(index, 0, 0, 0);
    return;
  }

  if (strcmp(cmd, "on") == 0 || strcmp(cmd, "1") == 0) {
    setLed(index, LED_COLORS[index][0], LED_COLORS[index][1], LED_COLORS[index][2]);
    char msg[16];
    snprintf(msg, sizeof(msg), "LED %d ON", index);
    displayActivity(msg);
    return;
  }

  int r, g, b;
  if (sscanf(cmd, "%d,%d,%d", &r, &g, &b) == 3) {
    r = constrain(r, 0, 255);
    g = constrain(g, 0, 255);
    b = constrain(b, 0, 255);
    setLed(index, (uint8_t)r, (uint8_t)g, (uint8_t)b);
    char msg[20];
    snprintf(msg, sizeof(msg), "LED %d farve", index);
    displayActivity(msg);
  }
}

void setAllLedsFromCommand(const char* cmd) {
  bool turnOn = !(strcmp(cmd, "off") == 0 || strcmp(cmd, "0") == 0);

  for (int i = 0; i < 5; i++) {
    if (turnOn) {
      setLedQuiet(i, LED_COLORS[i][0], LED_COLORS[i][1], LED_COLORS[i][2]);
    } else {
      setLedQuiet(i, 0, 0, 0);
    }
  }
  carrier.leds.show();
  displayActivity(turnOn ? "LED alle ON" : "LED alle OFF");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastWifiRetry < WIFI_RETRY_MS) return;
  lastWifiRetry = millis();

  Serial.print(F("WiFi: forbinder til "));
  Serial.println(SECRET_SSID);
  displayShowPhase("WiFi");

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
  displayShowPhase("MQTT");

  if (mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr, TOPIC_STATUS, 0, true, "offline")) {
    Serial.println(F("MQTT: forbundet"));
    mqtt.subscribe(TOPIC_CMD);
    mqtt.publish(TOPIC_STATUS, "online", true);
    ui.phase[0] = '\0';
    displayActivity("MQTT OK");
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

void publishSensorData() {
  float temp     = carrier.Env.readTemperature();
  float humidity = carrier.Env.readHumidity();

  int r, g, b, light;
  while (!carrier.Light.colorAvailable()) {
    delay(5);
  }
  carrier.Light.readColor(r, g, b, light);

  ui.temp     = temp;
  ui.humidity = humidity;
  ui.light    = light;

  char buf[16];

  snprintf(buf, sizeof(buf), "%.1f", temp);
  mqtt.publish(TOPIC_TEMP, buf);

  snprintf(buf, sizeof(buf), "%.1f", humidity);
  mqtt.publish(TOPIC_HUMIDITY, buf);

  snprintf(buf, sizeof(buf), "%d", light);
  mqtt.publish(TOPIC_LIGHT, buf);

  displayActivity("PUB sensorer");
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
  carrier.Buzzer.beep(800, 50);

  char msg[16];
  snprintf(msg, sizeof(msg), "BTN %d", id);
  displayActivity(msg);
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
