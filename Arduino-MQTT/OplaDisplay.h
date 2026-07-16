#pragma once

void displaySplash();
void displayShowPhase(const char* phase);
void displayActivity(const char* msg);

void displayRequestUpdate();
void displayRedrawIfDue(bool force = false);
void displayTick();

