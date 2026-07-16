#pragma once

void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);

