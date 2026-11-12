# Topics MQTT

Deux conventions sont acceptées. L’identité de l’émetteur est toujours le champ `deviceId`, contrôlé contre le topic appareil lorsqu’il est présent.

## Appareil (canonique, recommandé)

`predimaint/devices/{deviceId}/`

| Suffixe | Sens |
| --- | --- |
| `telemetry` | Mesure JSON |
| `status` | `{ "deviceId", "online": true\|false }` |
| `config` | Configuration descendante |
| `commands` | Commandes backend → ESP32 |

Le `deviceId` du topic **doit** égaler `deviceId` du JSON.

## Machine (alias cahier des charges)

`predimaint/machines/{machineCode}/measurements`  
`predimaint/machines/{machineCode}/status`

Le JSON **doit** contenir `deviceId`. L’appareil est ensuite associé à la machine en base.

## Télémétrie

Format plat (historique) ou imbriqué :

```json
{
  "deviceId": "ESP32-001",
  "machineId": "MACHINE-001",
  "timestamp": "2026-10-10T12:00:00.000Z",
  "measurements": {
    "vibration": { "value": 1, "unit": "detection" },
    "temperature": { "value": 48.5, "unit": "°C" },
    "humidity": { "value": 55, "unit": "%" },
    "current": { "value": 3.2, "unit": "A" }
  },
  "source": "hardware"
}
```

- `source` : `hardware` / `HARDWARE_REAL` ou `simulation` / `SIMULATION`.
- Firmware DHT22/SW-420 : vibration `0` = pas de détection et `1` = événement détecté pendant l'intervalle d'échantillonnage, unité `detection`. Ce n'est pas une mesure d'accélération en **g**.
- Les seuils d'alerte sont configurés par machine dans **Seuils & système**. Pour le SW-420 binaire, une détection peut produire un warning ; elle ne mesure pas une sévérité critique.
- `humidity` est optionnelle pour préserver la compatibilité des anciens appareils ; si elle est présente, la valeur doit être comprise entre 0 et 100.
- `sensorErrors` optionnel : `{ "temperature": true, "humidity": true, ... }` → état machine `sensor_error`.

Les messages mal formés, d’un appareil révoqué ou d’un `deviceId` incohérent sont rejetés.

## Broker local

Docker : `allow_anonymous true` (développement). Production : identifiants, ACL (`infrastructure/mosquitto/acl.example`), TLS listener 8883.

L'ESP32 et le backend doivent être connectés au **même broker**. Dans `.env`,
`MQTT_URL` (ou `MQTT_BROKER_URL`) désigne l'adresse du broker vue depuis le
backend. Si le broker Docker tourne sur le PC et que l'ESP32 s'y connecte par
Wi-Fi, configurez le firmware avec l'IP LAN du PC et utilisez cette même IP
dans `MQTT_URL`. Dans cette configuration, l'adresse du PC est
`192.168.43.253` ; remplacez-la si votre adresse Wi-Fi change.
