#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <MQTT.h>
#include <ArduinoJson.h>
#include <time.h>
#include "configuration.h"
#include "errors.h"




// MQTT communication section
const int MQTT_PORT = 8883;
const char* MQTT_SUB_TOPIC = "devices/" THINGNAME "/commands";
const char* MQTT_PUB_TOPIC = "$aws/things/" THINGNAME "/shadow/update";

#ifdef USE_SUMMER_TIME_DST
uint8_t DST = 1;
#else
uint8_t DST = 0;
#endif

WiFiClientSecure net;

BearSSL::X509List cert(cacert);
BearSSL::X509List client_crt(client_cert);
BearSSL::PrivateKey key(privkey);

MQTTClient client;
unsigned long lastMs = 0;
time_t now;
time_t nowish = 1510592825;

void NTPConnect(void) {
  Serial.print("Setting time using SNTP");
  configTime(TIME_ZONE * 3600, DST * 3600, "pool.ntp.org", "time.nist.gov");
  now = time(nullptr);

  while (now < nowish) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }

  Serial.println("done!");
  struct tm timeinfo;
  gmtime_r(&now, &timeinfo);
  Serial.print("Current time: ");
  Serial.print(asctime(&timeinfo));
}

#define buzzer D7

void callback(String& topic, String& payload) {
  StaticJsonDocument<128> doc;

  // Parse the JSON
  DeserializationError error = deserializeJson(doc, payload);
  if (error) {
    Serial.print("JSON parse failed: ");
    Serial.println(error.c_str());
    return;
  }

  // Read the 'alarm' field from the JSON (as a boolean).
  // If alarm is missing or invalid, it defaults to false.
  bool message = doc["alarm"];

  Serial.print("Contenuto: ");
  Serial.println(message);

  // Se il messaggio arriva sul topic del buzzer
  if (String(topic).equals(MQTT_SUB_TOPIC)) {
    if (message) {
      tone(buzzer, 4000, 200); // Accendo il buzzer
      Serial.println("Buzzer ATTIVATO!");
    } else {
      Serial.println("Buzzer SPENTO!");
      noTone(buzzer);
    }
  }

}

void connectToMqtt(bool nonBlocking = false) {
  Serial.print("MQTT connecting ");
  while (!client.connected()) {
    if (client.connect(THINGNAME)) {
      Serial.println("connected!");
      if (!client.subscribe(MQTT_SUB_TOPIC))
        lwMQTTErr(client.lastError());
    } else {
      Serial.print("SSL Error Code: ");
      Serial.println(net.getLastSSLError());
      Serial.print("failed, reason -> ");
      lwMQTTErrConnection(client.returnCode());
      if (!nonBlocking) {
        Serial.println(" < try again in 5 seconds");
        delay(5000);
      } else {
        Serial.println(" <");
      }
    }
    if (nonBlocking) break;
  }
}

void connectToWiFi(String init_str) {
  if (init_str != emptyString)
    Serial.print(init_str);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(1000);
  }
  if (init_str != emptyString)
    Serial.println("ok!");
}

void verifyWiFiAndMQTT(void) {
  connectToWiFi("Checking WiFi");
  connectToMqtt();
}

unsigned long previousMillis = 0;
const long interval = 5000;

void sendData(int heartRate, int bloodPressure) {
  DynamicJsonDocument jsonBuffer(256);
  JsonObject root = jsonBuffer.to<JsonObject>();
  JsonObject state = root.createNestedObject("state");
  JsonObject state_reported = state.createNestedObject("reported");

  struct tm timeinfo;
  getLocalTime(&timeinfo);
  time_t now = mktime(&timeinfo);

  state_reported["id"] = THINGNAME;
  state_reported["heart-rate"] = heartRate;
  state_reported["blood-pressure"] = bloodPressure;
  state_reported["timestamp"] = now;
  Serial.printf("Sending [%s]: ", MQTT_PUB_TOPIC);
  serializeJson(root, Serial);
  Serial.println();

  char shadow[measureJson(root) + 1];
  serializeJson(root, shadow, sizeof(shadow));
  if (!client.publish(MQTT_PUB_TOPIC, shadow, false, 0))
    lwMQTTErr(client.lastError());
}




// device loop and setup section
#define heartRateEditModeButton D6
#define heartRateEditModeLed D5
#define bloodPressureEditModeButton D2
#define bloodPressureEditModeLed D1
#define editModePotentiometer A0


#define HEART_RATE_MIN_RANGE 0
#define HEART_RATE_MAX_RANGE 250
#define BLOOD_PRESSURE_MIN_RANGE 0
#define BLOOD_PRESSURE_MAX_RANGE 200

bool heartRateEditMode = false;
bool bloodPressureEditMode = false;

int heartRateRangeSize = 10;
int heartRateMinRange = 0;
int heartRateMaxRange = heartRateMinRange + heartRateRangeSize;
int bloodPressureRangeSize = 10;
int bloodPressureMinRange = 0;
int bloodPressureMaxRange = bloodPressureMinRange + bloodPressureRangeSize;

float potentiometerLastValue;

unsigned long sendDataTimerStart = millis();
int sendDataTimer = 1000;




void setup() {
  Serial.begin(115200);

  pinMode(heartRateEditModeButton, INPUT);
  pinMode(heartRateEditModeLed, OUTPUT);
  pinMode(bloodPressureEditModeButton, INPUT);
  pinMode(bloodPressureEditModeLed, OUTPUT);
  pinMode(buzzer, OUTPUT);

  potentiometerLastValue = map(analogRead(editModePotentiometer), 0, 1023, 0, 180);

  WiFi.hostname(THINGNAME);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, pass);
  connectToWiFi(String("Trying to connect with SSID: ") + String(ssid));
  NTPConnect();
  net.setTrustAnchors(&cert);
  net.setClientRSACert(&client_crt, &key);
  client.begin(MQTT_HOST, MQTT_PORT, net);
  client.onMessage(callback);
  connectToMqtt();
}




void loop() {
  if (!client.connected()) {
    verifyWiFiAndMQTT();
  } else {
    client.loop();

    unsigned long currentTime = millis();
    if (currentTime - sendDataTimerStart >= sendDataTimer) {
      int heartRate = random(heartRateMinRange, heartRateMaxRange + 1);
      int bloodPressure = random(bloodPressureMinRange, bloodPressureMaxRange + 1);
      sendData(heartRate, bloodPressure);
      sendDataTimerStart = currentTime;
    }

    float potentiometerCurrentValue = map(analogRead(editModePotentiometer), 0, 1023, 0, 180);
    int rangeIncrement = potentiometerCurrentValue - potentiometerLastValue;
    potentiometerLastValue = potentiometerCurrentValue;

    if (digitalRead(heartRateEditModeButton))
      heartRateEditMode = !heartRateEditMode;

    if (digitalRead(bloodPressureEditModeButton))
      bloodPressureEditMode = !bloodPressureEditMode;

    if (heartRateEditMode) {
      heartRateMinRange = max(HEART_RATE_MIN_RANGE, heartRateMinRange + rangeIncrement);
      heartRateMaxRange = heartRateMinRange + heartRateRangeSize;
      if (heartRateMaxRange > HEART_RATE_MAX_RANGE) {
        heartRateMaxRange = HEART_RATE_MAX_RANGE;
        heartRateMinRange = heartRateMaxRange - heartRateRangeSize;
      }
    }

    if (bloodPressureEditMode) {
      bloodPressureMinRange = max(BLOOD_PRESSURE_MIN_RANGE, bloodPressureMinRange + rangeIncrement);
      bloodPressureMaxRange = bloodPressureMinRange + bloodPressureRangeSize;
      if (bloodPressureMaxRange > BLOOD_PRESSURE_MAX_RANGE) {
        bloodPressureMaxRange = BLOOD_PRESSURE_MAX_RANGE;
        bloodPressureMinRange = bloodPressureMaxRange - bloodPressureRangeSize;
      }
    }

    digitalWrite(heartRateEditModeLed, heartRateEditMode);
    digitalWrite(bloodPressureEditModeLed, bloodPressureEditMode);
  }

  delay(200);
}