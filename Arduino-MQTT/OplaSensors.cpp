#include "OplaSensors.h"

#include <Arduino.h>
#include <cstring>
#include <cstdio>

#include "OplaGlobals.h"
#include "OplaDisplay.h"

static void publishButton(int id) {
  char payload[8];
  snprintf(payload, sizeof(payload), "btn-%d", id);
  mqtt.publish(TOPIC_BUTTON, payload);

  carrier.Buzzer.beep(800, 50);

  char msg[16];
  snprintf(msg, sizeof(msg), "BTN %d", id);
  displayActivity(msg);
}

void publishSensorData() {
  float temp = carrier.Env.readTemperature();
  float humidity = carrier.Env.readHumidity();

  int r, g, b, light;
  while (!carrier.Light.colorAvailable()) {
    delay(5);
  }
  carrier.Light.readColor(r, g, b, light);

  ui.temp = temp;
  ui.humidity = humidity;
  ui.light = light;

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

