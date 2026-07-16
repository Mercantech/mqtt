#pragma once

#include <Arduino.h>
#include <WiFiNINA.h>
#include <PubSubClient.h>
#include <Arduino_MKRIoTCarrier.h>

#include "secrets.h"

// MQTT topics used by this sketch + the pensum web demo.
static const char TOPIC_STATUS[]   = "demo/opla/status";
static const char TOPIC_TEMP[]     = "demo/opla/temp";
static const char TOPIC_HUMIDITY[] = "demo/opla/humidity";
static const char TOPIC_LIGHT[]    = "demo/opla/light";
static const char TOPIC_BUTTON[]   = "demo/opla/button";
static const char TOPIC_CMD[]      = "demo/opla/cmd/#";

static const uint8_t LED_COLORS[5][3] = {
  {0, 0, 255},     // idx 0
  {0, 255, 0},     // idx 1
  {255, 0, 0},     // idx 2
  {0, 255, 255},   // idx 3
  {255, 255, 255}, // idx 4
};

static const unsigned long PUBLISH_INTERVAL_MS = 5000;
static const unsigned long WIFI_RETRY_MS       = 5000;
static const unsigned long MQTT_RETRY_MS       = 5000;
static const unsigned long DISPLAY_REFRESH_MS  = 5000;
static const unsigned long DISPLAY_ANIM_MS     = 400;
static const unsigned long ACTIVITY_SHOW_MS    = 3500;

// Layout til rund 240×240 skærm — hold indhold i sikker zone.
static const int SAFE_X = 48;
static const int SAFE_W = 144;
static const int Y_TITLE    = 56;
static const int Y_STATUS   = 74;
static const int Y_SENSORS  = 92;
static const int Y_LEDS     = 132;
static const int Y_ACTIVITY = 158;

// RGB565 — MQTT-tema
static const uint16_t COLOR_BG     = 0x0841;
static const uint16_t COLOR_PANEL  = 0x10A2;
static const uint16_t COLOR_ACCENT = 0x07FF;
static const uint16_t COLOR_MQTT   = 0x07E0;
static const uint16_t COLOR_WIFI   = 0xFD20;
static const uint16_t COLOR_TEMP   = 0xFC60;
static const uint16_t COLOR_HUM    = 0x5D1F;
static const uint16_t COLOR_LUX    = 0xFE19;
static const uint16_t COLOR_DIM    = 0x3186;
static const uint16_t COLOR_LABEL  = 0x8C71;

extern MKRIoTCarrier carrier;
extern WiFiClient wifiClient;
extern PubSubClient mqtt;

struct UiState {
  float temp = 0;
  float humidity = 0;
  int light = 0;
  bool wifiOk = false;
  bool mqttOk = false;
  uint8_t ledRgb[5][3] = {{0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}, {0, 0, 0}};
  char activity[28] = {0};
  char phase[16] = {0};
};

extern UiState ui;

extern unsigned long lastPublish;
extern unsigned long lastWifiRetry;
extern unsigned long lastMqttRetry;

extern unsigned long lastDisplayDraw;
extern unsigned long lastDisplayAnim;

extern unsigned long activityUntil;
extern unsigned long splashFrame;
extern bool displayDirty;

