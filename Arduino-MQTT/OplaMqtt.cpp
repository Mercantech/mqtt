#include "OplaMqtt.h"

#include <Arduino.h>
#include <cstring>
#include <cstdio>

#include "OplaGlobals.h"
#include "OplaDisplay.h"
#include "OplaLeds.h"

/*
 * Forbinder til MQTT-brokeren.
 *
 * Vigtige MQTT-begreber her:
 * - Client ID: unik identifikator (MQTT_CLIENT_ID fra secrets.h)
 * - LWT (Last Will and Testament): brokeren publicerer automatisk
 *   "offline" på TOPIC_STATUS, hvis vi forsvinder uden pæn disconnect
 * - Retain på status: nye subscribers får seneste online/offline med det samme
 * - Subscribe på TOPIC_CMD ("demo/opla/cmd/#"): wildcard # = alt under cmd/
 */
void connectMQTT() {
  // Ingen MQTT uden WiFi.
  if (WiFi.status() != WL_CONNECTED) return;

  // Allerede forbundet — intet at gøre.
  if (mqtt.connected()) return;

  // Undgå at spamme reconnect (throttle).
  if (millis() - lastMqttRetry < MQTT_RETRY_MS) return;
  lastMqttRetry = millis();

  Serial.print(F("MQTT: forbinder til "));
  Serial.print(MQTT_SERVER);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);

  displayShowPhase("MQTT");

  /*
   * mqtt.connect(clientId, user, pass, willTopic, willQos, willRetain, willMessage)
   *
   * user/pass = nullptr  → anonym (demo-broker uden auth)
   * willTopic            → demo/opla/status
   * willQos = 0          → best effort
   * willRetain = true    → status huskes på brokeren
   * willMessage          → "offline" hvis forbindelsen dør unormalt
   */
  if (mqtt.connect(MQTT_CLIENT_ID, nullptr, nullptr, TOPIC_STATUS, 0, true, "offline")) {
    Serial.println(F("MQTT: forbundet"));

    // Lyt efter kommandoer fra web-demoen (LED, buzzer, …).
    mqtt.subscribe(TOPIC_CMD);

    // Fortæl verden vi er online (retained, så dashboard ser det med det samme).
    mqtt.publish(TOPIC_STATUS, "online", true);

    ui.phase[0] = '\0';
    displayActivity("MQTT OK");
    displayRedrawIfDue(true);
  } else {
    // PubSubClient state(): -4 timeout … 5 unauthorized osv.
    Serial.print(F("MQTT: fejl rc="));
    Serial.println(mqtt.state());
    displayShowPhase("MQTT fejl");
  }
}

/*
 * Kaldes af PubSubClient (via mqtt.loop()) når der kommer en besked
 * på et topic vi er subscribed på.
 *
 * topic   — f.eks. "demo/opla/cmd/led/2"
 * payload — rå bytes (ikke null-termineret!)
 * length  — antal bytes i payload
 *
 * Topic-kontrakt (samme som pensumsidens live demo):
 *   demo/opla/cmd/led/N   → én LED (N = 0..4), payload: "on"|"off"|"R,G,B"
 *   demo/opla/cmd/led     → alle LED'er
 *   demo/opla/cmd/buzzer  → "beep"
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Konverter payload til C-streng (PubSubClient giver ikke '\0').
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.print(F("Modtaget ["));
  Serial.print(topic);
  Serial.print(F("]: "));
  Serial.println(message);

  // Enkelt LED: topic ender med index efter "demo/opla/cmd/led/"
  if (strncmp(topic, "demo/opla/cmd/led/", 18) == 0) {
    int index = atoi(topic + 18);  // parse tallet efter prefix
    setLedFromCommand(index, message);
  } else if (strcmp(topic, "demo/opla/cmd/led") == 0) {
    // Alle LED'er på én gang
    setAllLedsFromCommand(message);
  }

  // Buzzer-kommando
  if (strcmp(topic, "demo/opla/cmd/buzzer") == 0 && strcmp(message, "beep") == 0) {
    carrier.Buzzer.beep(800, 100);
    displayActivity("Buzzer!");
  }
}
