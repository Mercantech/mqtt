#include "OplaNet.h"

#include <Arduino.h>

#include "OplaGlobals.h"
#include "OplaDisplay.h"

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

