#pragma once

#include <Arduino.h>

/*
 * MQTT-modul (PubSubClient)
 *
 * connectMQTT()  — forbinder til broker med Last Will (LWT) + status
 * mqttCallback() — kaldes automatisk ved indkommende beskeder på subscribed topics
 */

// Forsøg at forbinde (med retry-throttle). Kræver at WiFi allerede er oppe.
void connectMQTT();

// Callback når broker leverer en publish til os (fx LED/buzzer-kommandoer).
void mqttCallback(char* topic, byte* payload, unsigned int length);
