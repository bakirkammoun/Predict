
/**
 * Firmware ESP32 PrédiMaint — capteurs physiques.
 *
 * SIMULATION_MODE 1 : valeurs synthetiques.
 * SIMULATION_MODE 0 : DHT22, ACS712 et SW-420.
 *
 * SW-420 : HIGH = vibration detectee, LOW = aucune vibration.
 * ACS712 : calibrer VREF_MID et SENSITIVITY_V_PER_A.
 * DHT22 : NaN indique une erreur de lecture.
 *
 * Copier secrets.example.h vers secrets.h avant compilation.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <time.h>
#include <math.h>
#include <string.h>

#include "../secrets.h"

#ifndef SIMULATION_MODE
#define SIMULATION_MODE 0
#endif

// --------------------------------------------------
// 1. Configuration des capteurs
// --------------------------------------------------

#define DHT_PIN 4
#define DHT_TYPE DHT22

#define ACS712_PIN 34
#define SW420_PIN 27

#define SENSITIVITY_V_PER_A 0.185f
#define VREF_MID 1.65f

#define SAMPLE_MS 4000

#define ADC_VREF 3.3f
#define ADC_MAX 4095.0f

#define TEMP_FAULT_C -127.0f

// --------------------------------------------------
// 2. Objets Wi-Fi, MQTT et DHT
// --------------------------------------------------

WiFiClient wifi;
PubSubClient mqtt(wifi);
DHT dht(DHT_PIN, DHT_TYPE);

// --------------------------------------------------
// 3. Topics MQTT
// --------------------------------------------------

char telemetryTopic[80];
char statusTopic[80];
char machineMeasTopic[96];
char commandsTopic[80];

// --------------------------------------------------
// 4. Horodatage ISO 8601
// --------------------------------------------------

void isoTimestamp(char* buf, size_t n) {
  time_t now = time(nullptr);

  if (now > 1600000000) {
    strftime(buf, n, "%Y-%m-%dT%H:%M:%SZ", gmtime(&now));
  } else {
    snprintf(
      buf,
      n,
      "1970-01-01T00:00:%02luZ",
      (millis() / 1000UL) % 60
    );
  }
}

// --------------------------------------------------
// 5. Publication de l'etat du dispositif
// --------------------------------------------------

void publishStatus(bool online) {
  JsonDocument doc;

  doc["deviceId"] = DEVICE_ID;
  doc["online"] = online;
  doc["source"] = SIMULATION_MODE ? "simulation" : "hardware";

  char buf[192];
  serializeJson(doc, buf, sizeof(buf));

  mqtt.publish(statusTopic, buf, true);
}

// --------------------------------------------------
// 6. Connexion Wi-Fi
// --------------------------------------------------

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);

    if (millis() - start > 30000) {
      Serial.println("Wi-Fi timeout, nouvelle tentative");

      start = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  Serial.print("Wi-Fi OK : ");
  Serial.println(WiFi.localIP());
}

// --------------------------------------------------
// 7. Connexion MQTT
// --------------------------------------------------

void connectMqtt() {
  while (!mqtt.connected()) {
    bool ok;

    if (strlen(MQTT_USER) > 0) {
      ok = mqtt.connect(
        DEVICE_ID,
        MQTT_USER,
        MQTT_PASS,
        statusTopic,
        1,
        true,
        "{\"deviceId\":\"" DEVICE_ID "\",\"online\":false}"
      );
    } else {
      ok = mqtt.connect(
        DEVICE_ID,
        statusTopic,
        1,
        true,
        "{\"deviceId\":\"" DEVICE_ID "\",\"online\":false}"
      );
    }

    if (ok) {
      mqtt.subscribe(commandsTopic);
      publishStatus(true);

      Serial.println("MQTT OK");
      Serial.print("Topic telemetry : ");
      Serial.println(telemetryTopic);

      Serial.print("Topic machine : ");
      Serial.println(machineMeasTopic);
    } else {
      Serial.print("Echec MQTT, code : ");
      Serial.println(mqtt.state());

      delay(2000);
    }
  }
}

// --------------------------------------------------
// 8. Reception des commandes MQTT
// --------------------------------------------------

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Commande MQTT : ");
  Serial.println(topic);

  (void)payload;
  (void)length;
}

// --------------------------------------------------
// 9. Lecture de la temperature
// --------------------------------------------------

float readTemperatureC(bool* fault) {
  *fault = false;

#if SIMULATION_MODE

  return 42.0f + (random(-20, 20) / 10.0f);

#else

  float t = dht.readTemperature();

  if (!isfinite(t)) {
    *fault = true;
    return TEMP_FAULT_C;
  }

  return t;

#endif
}

// --------------------------------------------------
// 10. Lecture de l'humidite
// --------------------------------------------------

float readHumidityPercent(bool* fault) {
  *fault = false;

#if SIMULATION_MODE

  return 45.0f + random(-100, 101) / 10.0f;

#else

  float humidity = dht.readHumidity();

  if (!isfinite(humidity) ||
      humidity < 0.0f ||
      humidity > 100.0f) {
    *fault = true;
    return 0.0f;
  }

  return humidity;

#endif
}

// --------------------------------------------------
// 11. Lecture du courant ACS712
// --------------------------------------------------

float readCurrentA(bool* fault) {
  *fault = false;

#if SIMULATION_MODE

  return 3.1f + (random(-15, 15) / 20.0f);

#else

  const int n = 32;
  float sum = 0.0f;

  for (int i = 0; i < n; i++) {
    sum += analogRead(ACS712_PIN);
    delay(1);
  }

  float volts = (sum / n) * ADC_VREF / ADC_MAX;
  float amps = (volts - VREF_MID) / SENSITIVITY_V_PER_A;

  if (!isfinite(amps) || fabsf(amps) > 50.0f) {
    *fault = true;
    return 0.0f;
  }

  return amps;

#endif
}

// --------------------------------------------------
// 12. Lecture SW-420 — correction
// --------------------------------------------------

bool readVibrationDetected() {
#if SIMULATION_MODE

  return random(0, 20) == 0;

#else

  // Selon le test du capteur :
  // HIGH (1) = vibration detectee
  // LOW  (0) = aucune vibration
  return digitalRead(SW420_PIN) == HIGH;

#endif
}

// --------------------------------------------------
// 13. Initialisation
// --------------------------------------------------

void setup() {
  Serial.begin(115200);

  randomSeed(analogRead(0));
  analogReadResolution(12);

  // Construction des topics MQTT d'origine
  snprintf(
    telemetryTopic,
    sizeof(telemetryTopic),
    "predimaint/devices/%s/telemetry",
    DEVICE_ID
  );

  snprintf(
    statusTopic,
    sizeof(statusTopic),
    "predimaint/devices/%s/status",
    DEVICE_ID
  );

  snprintf(
    machineMeasTopic,
    sizeof(machineMeasTopic),
    "predimaint/machines/%s/measurements",
    MACHINE_CODE
  );

  snprintf(
    commandsTopic,
    sizeof(commandsTopic),
    "predimaint/devices/%s/commands",
    DEVICE_ID
  );

#if !SIMULATION_MODE

  dht.begin();

  // SW-420 : lecture directe, sans interruption
  pinMode(SW420_PIN, INPUT);

  // ACS712 : entree analogique
  pinMode(ACS712_PIN, INPUT);

#endif

  // Connexion reseau
  connectWifi();

  // Synchronisation de l'heure
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  // Configuration MQTT
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(callback);
  mqtt.setBufferSize(768);

  Serial.println();
  Serial.println("==================================");
  Serial.println("     PrediMaint ESP32 demarre");
  Serial.println("==================================");
}

// --------------------------------------------------
// 14. Boucle principale
// --------------------------------------------------

void loop() {
  // Verification Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  // Verification MQTT
  if (!mqtt.connected()) {
    connectMqtt();
  }

  mqtt.loop();

  // Lecture des capteurs
  bool tFault = false;
  bool hFault = false;
  bool iFault = false;

  float t = readTemperatureC(&tFault);
  float humidity = readHumidityPercent(&hFault);
  float current = readCurrentA(&iFault);

  // Lecture SW-420
  int sw420Raw = digitalRead(SW420_PIN);
  bool vibrationDetected = readVibrationDetected();

  float vibration = vibrationDetected ? 1.0f : 0.0f;

  // Affichage des mesures
  Serial.println();
  Serial.println("--- Mesures des capteurs ---");

  Serial.print("Temperature : ");

  if (tFault) {
    Serial.println("ERREUR DHT22");
  } else {
    Serial.printf("%.1f C\n", t);
  }

  Serial.print("Humidite    : ");

  if (hFault) {
    Serial.println("ERREUR DHT22");
  } else {
    Serial.printf("%.1f %%\n", humidity);
  }

  Serial.print("Courant     : ");

  if (iFault) {
    Serial.println("ERREUR ACS712");
  } else {
    Serial.printf("%.2f A (a calibrer)\n", current);
  }

  Serial.printf("SW420 DO brut : %d\n", sw420Raw);

  Serial.printf(
    "Vibration   : %s (detection 0/1)\n",
    vibrationDetected ? "DETECTEE" : "non detectee"
  );

  // ------------------------------------------------
  // 15. Construction du JSON attendu par le dashboard
  // ------------------------------------------------

  JsonDocument doc;

  doc["deviceId"] = DEVICE_ID;
  doc["machineId"] = MACHINE_CODE;

  char iso[32];
  isoTimestamp(iso, sizeof(iso));
  doc["timestamp"] = iso;

  // Vibration
  JsonObject vib = doc["vibration"].to<JsonObject>();
  vib["value"] = vibration;
  vib["unit"] = "detection";

  // Temperature
  JsonObject temp = doc["temperature"].to<JsonObject>();
  temp["value"] = t;
  temp["unit"] = "C";

  // Humidite
  JsonObject humidityMetric = doc["humidity"].to<JsonObject>();
  humidityMetric["value"] = humidity;
  humidityMetric["unit"] = "%";

  // Courant
  JsonObject cur = doc["current"].to<JsonObject>();
  cur["value"] = current;
  cur["unit"] = "A";

  // Objet measurements
  // On cree des objets independants pour eviter
  // de deplacer les objets JSON racine.
  JsonObject meas = doc["measurements"].to<JsonObject>();

  JsonObject measVib = meas["vibration"].to<JsonObject>();
  measVib["value"] = vibration;
  measVib["unit"] = "detection";

  JsonObject measTemp = meas["temperature"].to<JsonObject>();
  measTemp["value"] = t;
  measTemp["unit"] = "C";

  JsonObject measHumidity = meas["humidity"].to<JsonObject>();
  measHumidity["value"] = humidity;
  measHumidity["unit"] = "%";

  JsonObject measCurrent = meas["current"].to<JsonObject>();
  measCurrent["value"] = current;
  measCurrent["unit"] = "A";

  doc["source"] = SIMULATION_MODE ? "simulation" : "hardware";
  doc["firmwareVersion"] = "esp32-1.2.0";

  // Erreurs capteurs
  if (tFault || hFault || iFault) {
    JsonObject err = doc["sensorErrors"].to<JsonObject>();

    err["temperature"] = tFault;
    err["humidity"] = hFault;
    err["current"] = iFault;
  }

  // ------------------------------------------------
  // 16. Publication MQTT
  // ------------------------------------------------

  char buf[768];

  size_t payloadLength = serializeJson(doc, buf, sizeof(buf));

  if (payloadLength == 0 || payloadLength >= sizeof(buf)) {
    Serial.println("ERREUR : JSON vide ou trop volumineux");
    delay(SAMPLE_MS);
    return;
  }

  Serial.print("JSON envoye : ");
  Serial.println(buf);

  bool devicePublished = mqtt.publish(telemetryTopic, buf);
  bool machinePublished = mqtt.publish(machineMeasTopic, buf);

  Serial.printf(
    "MQTT appareil : %s | MQTT machine : %s\n",
    devicePublished ? "envoye" : "echec",
    machinePublished ? "envoye" : "echec"
  );

  // Laisser le temps aux capteurs et au reseau
  delay(SAMPLE_MS);
}
