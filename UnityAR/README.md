# Assistant AR PrédiMaint

## Project target and packages

- Unity `2022.3.62f1`
- AR Foundation `5.2.2`
- Google ARCore XR Plugin `5.2.2`
- glTFast `6.0.1`
- Unity UI `1.0.0`

glTFast 6.0.1 contains an Editor `ScriptedImporter` for `.gltf` and `.glb`.
The original GLB files in `Assets/Models/` are left untouched. Their structure
and used glTF extensions were audited; this is not a substitute for a Unity
import or an Android device test.

## What is in this project

- `Assets/Scripts/SensorTelemetry.cs`: model/channel metadata, backend-supplied
  health and alert highlighting, and a JSON telemetry receiver.
- `Assets/Scripts/AssistantArController.cs`: plane placement, model selection,
  touch selection, rotation, zoom, and the on-screen measurement panel.
- `Assets/Scripts/TrackedMarkerModelSpawner.cs`: maps tracked images named
  `ESP32`, `DHT22`, `SW-420`, or `ACS712` to their corresponding model.
- `Assets/Editor/PrediMaintARProjectBuilder.cs`: menu command that imports the
  GLBs, creates four selectable Prefabs and a plane Prefab, generates
  `Assets/Scenes/ARScene.unity`, adds it to Build Settings, and configures the
  Android ARCore loader, IL2CPP, ARM64, and Android API 24 minimum.

To generate the Unity assets after activating the Editor license, open this
project in Unity and run **PrédiMaint AR > Generate prefabs and ARScene**. The
generated Prefabs and scene are outputs of that command; they are not checked
in before Unity has imported and validated the original GLBs.

## Model and hardware limits

The audit found these file-internal bounds. They are GLB coordinates, not
verified measurements of the physical parts:

| Model | GLB bounds (m) | Important limitation |
| --- | --- | --- |
| `ESP32.glb` | 0.0490 × 0.0130 × 0.0254 | Physical board revision/dimensions not confirmed |
| `DHT22.glb` | 1.530 × 2.819 × 0.880 | Scale is implausible for a sensor; do not treat as calibrated |
| `SW-420.glb` | 0.0140 × 0.0381 × 0.0075 | Physical module dimensions not confirmed |
| `ACS712.glb` | 0.0060 × 0.0049 × 0.00175 | Model is a bare SOIC-8 IC, not a breakout board |

No model scale is silently corrected. The AR controls allow display zoom, but
that does not calibrate a model to a physical sensor. The exact ESP32 board,
DHT22 package/breakout, SW-420 module, and ACS712 breakout variant and
dimensions are still needed before the models can be presented at 1:1 scale.
The DHT22 GLB includes Sketchfab attribution: Stichting Consortium
Beroepsonderwijs, CC BY 4.0
([source model](https://sketchfab.com/3d-models/dht22-522ec192b914407f9c3d85870ad14c1d)).

Only the firmware signal pins currently verified are shown: DHT22 DATA → GPIO
4, SW-420 DO → GPIO 27, and ACS712 OUT → GPIO 34. No VCC, ground, voltage,
connector, or other wiring is inferred. The ACS712 firmware sensitivity
constant (`0.185 V/A`) does not identify the installed module variant.

## Marker tracking

ARCore image tracking recognizes a configured reference image, not a sensor by
its shape. The scene generator includes a disabled `ARTrackedImageManager` and
the marker-to-model spawner, but no reference image library is generated
because the printable marker images and their physical widths have not been
provided. Until a real library is added and assigned, use plane placement only;
do not describe this as physical component recognition.

When supplied, marker names must be exactly `ESP32`, `DHT22`, `SW-420`, and
`ACS712`. Each marker must be visually distinct and its printed width measured
in metres when creating the Unity reference image library. Validate detection,
scale, and placement with the printed markers on the target Android device.

## Real data and app integration status

The existing Flutter app remains the authenticated source of machine
measurements, statuses, thresholds, history, and alerts. Unity does not connect
directly to MQTT and does not fabricate readings. `SensorTelemetryReceiver`
exposes `SetTelemetryJson(string)` for a future Unity-as-a-Library bridge; the
Flutter-to-Unity Android bridge is not yet implemented. Therefore this Unity
scene does not currently receive live PrédiMaint data.

Unity as a Library with a small Android/Flutter bridge is the intended
integration path: keep authentication and API/Socket.IO handling in Flutter,
then forward only the selected machine's current payload to Unity. The current
Flutter Android project uses Gradle 9.3.1, Android Gradle Plugin 9.1.0, Kotlin
2.4.0, and Java 17. A Unity 2022.3 Android export must be reconciled with those
versions before adding its library; this has not been attempted without a
valid Unity export.

The receiver expects a payload shaped like:

```json
{
  "machineId": "machine-id",
  "machineName": "Machine 1",
  "machineStatus": "normal",
  "deviceStatus": "online",
  "channels": [
    {
      "key": "temperature",
      "label": "Temperature",
      "value": "27.1",
      "unit": "C",
      "status": "normal",
      "activeAlert": false,
      "alertMessage": "",
      "threshold": "backend-provided threshold",
      "updatedAt": "ISO-8601 timestamp",
      "history": []
    }
  ]
}
```

Populate `status`, `activeAlert`, and `threshold` from the backend; Unity does
not calculate alert states. An active alert is highlighted red, warning
orange, normal green, and offline/unknown gray. DHT22 humidity may be supplied
as a separate `humidity` channel; the current backend has no humidity alert
threshold.

## Current validation blockers

The Unity `2022.3.62f1` Editor and Android player files are installed, but the
Editor batch-mode check stopped before project import because no Unity Editor
license is activated (`No valid Unity Editor license found`). Consequently the
Package Manager restore, GLB import, generated Prefabs/scene, C# compilation,
and Unity Android build have **not** been run or verified.

The installed Unity Android player directory does not include bundled SDK,
NDK, or OpenJDK folders. The separate Flutter Android SDK has an NDK, but its
command-line tools were reported missing by `flutter doctor`. Android
command-line tools are now installed at
`C:\Users\HP\AppData\Local\Android\sdk\cmdline-tools\latest`, and the Android
SDK licenses were accepted with the user's approval. A temporary, checksum-
verified Microsoft JDK 17 was used only to run the SDK manager. The SDK has
NDK `28.2.13676358`; Unity 2022.3 should instead use its Unity Hub-managed
Android Build Support, SDK/NDK Tools, and OpenJDK modules (including NDK r23b).
The SDK manager reports a pre-existing duplicate `platform-tools.backup`
directory; it was left untouched. None of this substitutes for a Unity build.

## Remaining work and device tests

1. Activate the Unity Personal license in Unity Hub; reopen this project and
   run the asset-generation menu command.
2. Resolve any Unity Console/package errors, confirm GLB import materials and
   Prefab references, and compile all C# scripts.
3. Supply the physical model revisions/dimensions and four printed marker
   images with measured widths; then calibrate the visual scale and enable
   image tracking.
4. Implement the Flutter/Unity Android-as-a-Library bridge so authenticated
   Flutter data reaches `SetTelemetryJson`; do not put backend credentials in
   the Unity project.
5. In Unity Hub, add Android Build Support, Android SDK & NDK Tools, and
   OpenJDK to Unity `2022.3.62f1`; build for Android, then test on an
   ARCore-supported phone:
   camera permission, horizontal/vertical planes, placement, selection,
   rotation/zoom, marker reacquisition, real telemetry/history, and alert
   highlighting.

No Android device test or successful Unity build is claimed.
