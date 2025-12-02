#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

MAX30105 particleSensor;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;

float beatsPerMinute;
int beatAvg;

// AD8232 Pins
const int LO_PLUS = 35;
const int LO_MINUS = 32;
const int ECG_OUTPUT = 34;

void setup() {
  Serial.begin(115200);
  Serial.println("System Starting...");
  
  // Initialize AD8232
  pinMode(LO_PLUS, INPUT);
  pinMode(LO_MINUS, INPUT);
  pinMode(ECG_OUTPUT, INPUT);

  // Initialize MAX30102
  // Try different I2C speeds if unstable, but FAST is usually good
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30105 NOT FOUND! Check wiring (SDA/SCL).");
    // Don't halt, so we can still debug ECG
  } else {
    Serial.println("MAX30105 Found!");
    particleSensor.setup(); 
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
  }
}

void loop() {
  // --- MAX30102 READ ---
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();

  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute < 255 && beatsPerMinute > 20) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      beatAvg = 0;
      for (byte x = 0 ; x < RATE_SIZE ; x++)
        beatAvg += rates[x];
      beatAvg /= RATE_SIZE;
    }
  }

  // --- ECG READ ---
  // Read raw values to debug connections
  int loPlus = digitalRead(LO_PLUS);
  int loMinus = digitalRead(LO_MINUS);
  int ecgValue = analogRead(ECG_OUTPUT);
  
  // Logic: If LO+ or LO- is 1, leads are OFF.
  int leadsOn = 1;
  if (loPlus == 1 || loMinus == 1) {
    leadsOn = 0; 
    // We do NOT set ecgValue to 0 here anymore, so you can see noise
  }

  // CSV Format: timestamp, ecg_raw, leads_on, ir, red, bpm, debug_lo+, debug_lo-
  Serial.print(millis());
  Serial.print(",");
  Serial.print(ecgValue);
  Serial.print(",");
  Serial.print(leadsOn);
  Serial.print(",");
  Serial.print(irValue);
  Serial.print(",");
  Serial.print(redValue);
  Serial.print(",");
  Serial.print(beatAvg);
  Serial.print(",");
  Serial.print(loPlus); // Debug: 1 means disconnected
  Serial.print(",");
  Serial.println(loMinus); // Debug: 1 means disconnected

  delay(20); // Slight slow down to make serial readable
}
