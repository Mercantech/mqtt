#include "OplaDisplay.h"

#include <cstring>
#include <cstdio>

#include "OplaGlobals.h"

static void drawStatusDot(int x, int y, bool on, uint16_t color) {
  carrier.display.fillCircle(x, y, 4, on ? color : COLOR_DIM);
}

static void drawLedDots() {
  int startX = 76;
  for (int i = 0; i < 5; i++) {
    int x = startX + i * 24;
    int y = Y_LEDS;
    uint16_t c =
      (ui.ledRgb[i][0] || ui.ledRgb[i][1] || ui.ledRgb[i][2])
        ? carrier.leds.Color(ui.ledRgb[i][0], ui.ledRgb[i][1], ui.ledRgb[i][2])
        : COLOR_DIM;
    carrier.display.fillCircle(x, y, 5, c);
  }
}

static void drawSensorRow() {
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

static void drawActivityLine() {
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

static void drawCenteredTitle(const __FlashStringHelper* line1,
                                const __FlashStringHelper* line2,
                                uint16_t color1) {
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

static void displayAnimateConnecting() {
  if (ui.phase[0] == '\0') return;
  int dots = (millis() / DISPLAY_ANIM_MS) % 4;

  carrier.display.fillRect(88, 152, 64, 10, COLOR_BG);
  carrier.display.setTextColor(COLOR_LABEL, COLOR_BG);
  carrier.display.setCursor(88, 152);

  for (int i = 0; i < dots; i++) {
    carrier.display.print('.');
  }
}

void displayRequestUpdate() {
  displayDirty = true;
}

void displayActivity(const char* msg) {
  strncpy(ui.activity, msg, sizeof(ui.activity) - 1);
  ui.activity[sizeof(ui.activity) - 1] = '\0';

  activityUntil = millis() + ACTIVITY_SHOW_MS;
  displayRequestUpdate();
}

static void displayRedraw() {
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
  displayDirty = false;
}

void displayRedrawIfDue(bool force) {
  if (!force && !displayDirty) return;
  if (!force && (millis() - lastDisplayDraw < DISPLAY_REFRESH_MS)) return;
  displayRedraw();
}

void displayTick() {
  ui.wifiOk = WiFi.status() == WL_CONNECTED;
  ui.mqttOk = mqtt.connected();

  if (activityUntil != 0 && millis() >= activityUntil) {
    activityUntil = 0;
    displayRequestUpdate();
  }

  if (ui.phase[0] != '\0' && (!ui.wifiOk || !ui.mqttOk)) {
    if (millis() - lastDisplayAnim >= DISPLAY_ANIM_MS) {
      lastDisplayAnim = millis();
      displayAnimateConnecting();
    }
    return;
  }

  if (ui.phase[0] != '\0' && ui.wifiOk && ui.mqttOk) {
    ui.phase[0] = '\0';
    displayActivity("Online!");
    displayRedrawIfDue(true);
    return;
  }

  displayRedrawIfDue();
}

