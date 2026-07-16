#include "OplaLeds.h"

#include <cstring>
#include <cstdio>

#include "OplaGlobals.h"
#include "OplaDisplay.h"

static void setLedQuiet(int index, uint8_t r, uint8_t g, uint8_t b) {
  if (index < 0 || index >= 5) return;

  carrier.leds.setPixelColor(index, r, g, b);
  ui.ledRgb[index][0] = r;
  ui.ledRgb[index][1] = g;
  ui.ledRgb[index][2] = b;
}

static void setLed(int index, uint8_t r, uint8_t g, uint8_t b) {
  setLedQuiet(index, r, g, b);
  carrier.leds.show();
  displayRequestUpdate();
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

