#include "OplaGlobals.h"

MKRIoTCarrier carrier;
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish = 0;
unsigned long lastWifiRetry = 0;
unsigned long lastMqttRetry = 0;

unsigned long lastDisplayDraw = 0;
unsigned long lastDisplayAnim = 0;

unsigned long activityUntil = 0;
unsigned long splashFrame = 0;

bool displayDirty = true;

UiState ui;

