using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;

public sealed class AssistantArController : MonoBehaviour
{
    [SerializeField] private ARRaycastManager raycastManager;
    [SerializeField] private Camera arCamera;
    [SerializeField] private SensorTelemetryReceiver telemetryReceiver;
    [SerializeField] private GameObject[] modelPrefabs;
    [SerializeField] private Text machineLabel;
    [SerializeField] private Text detailsLabel;
    [SerializeField] private Text hintLabel;
    [SerializeField] private Button cameraButton;
    [SerializeField] private Button placeButton;
    [SerializeField] private ARSession arSession;
    [SerializeField] private ARPlaneManager planeManager;

    private readonly List<ARRaycastHit> raycastHits = new List<ARRaycastHit>();
    private GameObject selectedInstance;
    private SensorModelTag selectedTag;
    private int selectedModelIndex;
    private bool placementEnabled = true;

    public void Configure(
        ARRaycastManager raycasts,
        Camera camera,
        SensorTelemetryReceiver receiver,
        GameObject[] prefabs,
        Text machineText,
        Text detailsText,
        Text hintText,
        Button cameraStartButton,
        ARSession session,
        ARPlaneManager planes,
        Button placementButton)
    {
        raycastManager = raycasts;
        arCamera = camera;
        telemetryReceiver = receiver;
        modelPrefabs = prefabs;
        machineLabel = machineText;
        detailsLabel = detailsText;
        hintLabel = hintText;
        cameraButton = cameraStartButton;
        arSession = session;
        planeManager = planes;
        placeButton = placementButton;
    }

    private void OnEnable()
    {
        if (telemetryReceiver != null)
        {
            telemetryReceiver.TelemetryChanged += RefreshDetails;
        }

        if (placeButton != null)
        {
            placeButton.onClick.AddListener(TogglePlacement);
        }

        if (cameraButton != null)
        {
            cameraButton.onClick.AddListener(ToggleCamera);
        }
    }

    private void OnDisable()
    {
        if (telemetryReceiver != null)
        {
            telemetryReceiver.TelemetryChanged -= RefreshDetails;
        }

        if (placeButton != null)
        {
            placeButton.onClick.RemoveListener(TogglePlacement);
        }

        if (cameraButton != null)
        {
            cameraButton.onClick.RemoveListener(ToggleCamera);
        }
    }

    private void Start()
    {
        SelectModel(0);
    }

    private void Update()
    {
        if (Input.touchCount > 0)
        {
            var touch = Input.GetTouch(0);
            if (IsTouchOverUi(touch.fingerId))
            {
                return;
            }

            if (touch.phase == TouchPhase.Began)
            {
                HandleTap(touch.position);
            }
            else if (touch.phase == TouchPhase.Moved && selectedInstance != null && Input.touchCount == 1)
            {
                selectedInstance.transform.Rotate(Vector3.up, -touch.deltaPosition.x * 0.18f, Space.World);
            }

            if (Input.touchCount >= 2 && selectedInstance != null)
            {
                ApplyPinchZoom();
            }

            return;
        }

        if (Input.GetMouseButtonDown(0) && !IsMouseOverUi())
        {
            HandleTap(Input.mousePosition);
        }
    }

    public void SelectModel(int index)
    {
        if (modelPrefabs == null || index < 0 || index >= modelPrefabs.Length || modelPrefabs[index] == null)
        {
            Debug.LogError($"Assistant AR model prefab at index {index} is not configured.");
            return;
        }

        selectedModelIndex = index;
        selectedInstance = null;
        selectedTag = modelPrefabs[index].GetComponent<SensorModelTag>();
        RefreshDetails();
    }

    private void HandleTap(Vector2 screenPosition)
    {
        if (arCamera == null || raycastManager == null)
        {
            Debug.LogError("Assistant AR camera or AR raycast manager is not configured.");
            return;
        }

        var ray = arCamera.ScreenPointToRay(screenPosition);
        if (Physics.Raycast(ray, out var modelHit))
        {
            var tag = modelHit.collider.GetComponentInParent<SensorModelTag>();
            if (tag != null)
            {
                selectedTag = tag;
                selectedInstance = tag.gameObject;
                RefreshDetails();
                return;
            }
        }

        if (!placementEnabled || !raycastManager.Raycast(screenPosition, raycastHits))
        {
            return;
        }

        if (modelPrefabs == null || selectedModelIndex < 0 ||
            selectedModelIndex >= modelPrefabs.Length || modelPrefabs[selectedModelIndex] == null)
        {
            Debug.LogError("Assistant AR has no valid model selected for placement.");
            return;
        }

        var pose = raycastHits[0].pose;
        var instance = Instantiate(modelPrefabs[selectedModelIndex], pose.position, pose.rotation);
        selectedInstance = instance;
        selectedTag = instance.GetComponent<SensorModelTag>();
        if (selectedTag != null)
        {
            selectedTag.Apply(telemetryReceiver?.FindChannel(selectedTag.TelemetryKey));
        }

        RefreshDetails();
    }

    private void TogglePlacement()
    {
        placementEnabled = !placementEnabled;
        if (placeButton != null)
        {
            var buttonText = placeButton.GetComponentInChildren<Text>();
            if (buttonText != null)
            {
                buttonText.text = placementEnabled ? "Placement : activé" : "Placement : désactivé";
            }
        }

        if (hintLabel != null)
        {
            hintLabel.text = placementEnabled
                ? "Touchez un plan détecté pour placer le modèle sélectionné."
                : "Touchez un composant placé pour afficher ses informations.";
        }
    }

    private void ToggleCamera()
    {
        if (arSession == null || planeManager == null || raycastManager == null)
        {
            Debug.LogError("Assistant AR session components are not configured.");
            return;
        }

        var startCamera = !arSession.enabled;
        arSession.enabled = startCamera;
        planeManager.enabled = startCamera;
        raycastManager.enabled = startCamera;
        if (cameraButton != null)
        {
            var buttonText = cameraButton.GetComponentInChildren<Text>();
            if (buttonText != null)
            {
                buttonText.text = startCamera ? "Arrêter caméra" : "Démarrer caméra";
            }
        }

        if (hintLabel != null)
        {
            hintLabel.text = startCamera
                ? "Autorisez la caméra et touchez un plan détecté pour placer un modèle."
                : "Caméra arrêtée. Aucune mesure n'est simulée.";
        }
    }

    private void ApplyPinchZoom()
    {
        var first = Input.GetTouch(0);
        var second = Input.GetTouch(1);
        var previousFirst = first.position - first.deltaPosition;
        var previousSecond = second.position - second.deltaPosition;
        var previousDistance = Vector2.Distance(previousFirst, previousSecond);
        var currentDistance = Vector2.Distance(first.position, second.position);
        if (previousDistance <= 0f)
        {
            return;
        }

        var scale = Mathf.Clamp(currentDistance / previousDistance, 0.9f, 1.1f);
        selectedInstance.transform.localScale = Vector3.ClampMagnitude(
            selectedInstance.transform.localScale * scale,
            10f);
        selectedInstance.transform.localScale = Vector3.Max(
            selectedInstance.transform.localScale,
            Vector3.one * 0.1f);
    }

    private void RefreshDetails()
    {
        var machineName = telemetryReceiver?.Current?.machineName;
        var machineStatus = telemetryReceiver?.Current?.machineStatus;
        if (machineLabel != null)
        {
            machineLabel.text = string.IsNullOrWhiteSpace(machineName)
                ? "Aucune machine sélectionnée"
                : string.IsNullOrWhiteSpace(machineStatus) ? machineName : $"{machineName}  •  {machineStatus}";
        }

        var tag = selectedTag;
        if (tag == null && modelPrefabs != null && selectedModelIndex < modelPrefabs.Length)
        {
            tag = modelPrefabs[selectedModelIndex]?.GetComponent<SensorModelTag>();
        }

        if (detailsLabel == null)
        {
            return;
        }

        if (tag == null)
        {
            detailsLabel.text = "Sélectionnez un composant pour voir ses informations.";
            return;
        }

        var channel = telemetryReceiver?.FindChannel(tag.TelemetryKey);
        var signal = string.IsNullOrWhiteSpace(tag.SignalGpio) ? "—" : $"GPIO {tag.SignalGpio}";
        if (channel == null)
        {
            var unavailable = string.Equals(tag.TelemetryKey, "device", System.StringComparison.OrdinalIgnoreCase)
                ? "Aucun état réel de l'appareil reçu."
                : "Aucune mesure réelle reçue.";
            detailsLabel.text = $"{tag.DisplayName}  •  {signal}\n{unavailable}";
            return;
        }

        var reading = $"{channel.value} {channel.unit}".Trim();
        var status = string.IsNullOrWhiteSpace(channel.status) ? "inconnu" : channel.status;
        var relatedHumidity = string.Equals(tag.TelemetryKey, "temperature", System.StringComparison.OrdinalIgnoreCase)
            ? telemetryReceiver?.FindChannel("humidity")
            : null;
        var humidityHistory = string.Empty;
        if (relatedHumidity != null)
        {
            reading += $"\nHumidité : {relatedHumidity.value} {relatedHumidity.unit}".TrimEnd();
            humidityHistory = "\nHumidité\n" + FormatHistory(relatedHumidity.history);
        }

        var alertMessage = string.IsNullOrWhiteSpace(channel.alertMessage)
            ? "Alerte active"
            : channel.alertMessage;
        var alert = channel.activeAlert ? $"\nALERTE : {alertMessage}" : string.Empty;
        var threshold = string.IsNullOrWhiteSpace(channel.threshold)
            ? string.Empty
            : $"\nSeuil backend : {channel.threshold}";
        var history = FormatHistory(channel.history);

        detailsLabel.text = $"{tag.DisplayName}  •  {signal}\n{reading}  •  {status}{threshold}{alert}{history}{humidityHistory}";
    }

    private static string FormatHistory(TelemetryReading[] history)
    {
        if (history == null || history.Length == 0)
        {
            return "\nHistorique indisponible.";
        }

        var result = "\nHistorique récent :";
        var count = Mathf.Min(history.Length, 3);
        for (var index = 0; index < count; index++)
        {
            var reading = history[index];
            if (reading != null)
            {
                result += $"\n• {reading.value} {reading.unit} — {reading.updatedAt}";
            }
        }

        return result;
    }

    private static bool IsTouchOverUi(int fingerId)
    {
        return EventSystem.current != null && EventSystem.current.IsPointerOverGameObject(fingerId);
    }

    private static bool IsMouseOverUi()
    {
        return EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
    }
}
