using System;
using UnityEngine;

[Serializable]
public sealed class AssistantTelemetryPayload
{
    public string machineId;
    public string machineName;
    public string machineStatus;
    public string deviceStatus;
    public TelemetryChannel[] channels;
}

[Serializable]
public sealed class TelemetryChannel
{
    public string key;
    public string label;
    public string value;
    public string unit;
    public string status;
    public string gpio;
    public string updatedAt;
    public bool activeAlert;
    public string alertMessage;
    public string threshold;
    public TelemetryReading[] history;
}

[Serializable]
public sealed class TelemetryReading
{
    public string value;
    public string unit;
    public string updatedAt;
}

public sealed class SensorModelTag : MonoBehaviour
{
    [SerializeField] private string telemetryKey;
    [SerializeField] private string displayName;
    [SerializeField] private string signalGpio;
    [SerializeField] private string markerName;

    private Renderer[] renderers;
    private MaterialPropertyBlock propertyBlock;
    private TelemetryChannel channel;

    public string TelemetryKey => telemetryKey;
    public string DisplayName => displayName;
    public string SignalGpio => signalGpio;
    public string MarkerName => markerName;
    public TelemetryChannel Channel => channel;

    public void Configure(string key, string label, string gpio, string marker)
    {
        telemetryKey = key;
        displayName = label;
        signalGpio = gpio;
        markerName = marker;
    }

    public void Apply(TelemetryChannel value)
    {
        channel = value;
        UpdateHighlight();
    }

    private void Awake()
    {
        renderers = GetComponentsInChildren<Renderer>(true);
        propertyBlock = new MaterialPropertyBlock();
        UpdateHighlight();
    }

    private void UpdateHighlight()
    {
        if (renderers == null)
        {
            return;
        }

        var color = GetStatusColor();
        foreach (var renderer in renderers)
        {
            renderer.GetPropertyBlock(propertyBlock);
            foreach (var material in renderer.sharedMaterials)
            {
                if (material == null)
                {
                    continue;
                }

                if (material.HasProperty("_BaseColor"))
                {
                    propertyBlock.SetColor("_BaseColor", color);
                }

                if (material.HasProperty("_Color"))
                {
                    propertyBlock.SetColor("_Color", color);
                }
            }

            renderer.SetPropertyBlock(propertyBlock);
        }
    }

    private Color GetStatusColor()
    {
        if (channel == null || string.Equals(channel.status, "offline", StringComparison.OrdinalIgnoreCase))
        {
            return new Color(0.55f, 0.59f, 0.64f, 1f);
        }

        if (channel.activeAlert ||
            string.Equals(channel.status, "critical", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(channel.status, "anomaly", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(channel.status, "sensor_error", StringComparison.OrdinalIgnoreCase))
        {
            return new Color(1f, 0.18f, 0.16f, 1f);
        }

        if (string.Equals(channel.status, "warning", StringComparison.OrdinalIgnoreCase))
        {
            return new Color(1f, 0.62f, 0.12f, 1f);
        }

        if (string.Equals(channel.status, "normal", StringComparison.OrdinalIgnoreCase))
        {
            return new Color(0.18f, 0.78f, 0.43f, 1f);
        }

        return new Color(0.7f, 0.74f, 0.8f, 1f);
    }
}

public sealed class SensorTelemetryReceiver : MonoBehaviour
{
    public event Action TelemetryChanged;

    public AssistantTelemetryPayload Current { get; private set; }

    public void SetTelemetryJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            Debug.LogError("Assistant AR received an empty telemetry payload.");
            return;
        }

        AssistantTelemetryPayload payload;
        try
        {
            payload = JsonUtility.FromJson<AssistantTelemetryPayload>(json);
        }
        catch (ArgumentException exception)
        {
            Debug.LogError($"Assistant AR could not parse telemetry JSON: {exception.Message}");
            return;
        }

        if (payload == null)
        {
            Debug.LogError("Assistant AR could not parse telemetry JSON.");
            return;
        }

        Current = payload;
        foreach (var model in FindObjectsOfType<SensorModelTag>())
        {
            model.Apply(FindChannel(model.TelemetryKey));
        }

        TelemetryChanged?.Invoke();
    }

    public TelemetryChannel FindChannel(string key)
    {
        if (Current?.channels == null)
        {
            return null;
        }

        foreach (var channel in Current.channels)
        {
            if (channel != null && string.Equals(channel.key, key, StringComparison.OrdinalIgnoreCase))
            {
                return channel;
            }
        }

        if (string.Equals(key, "device", StringComparison.OrdinalIgnoreCase))
        {
            var deviceStatus = string.IsNullOrWhiteSpace(Current.deviceStatus)
                ? "offline"
                : Current.deviceStatus;
            return new TelemetryChannel
            {
                key = "device",
                label = "ESP32",
                value = deviceStatus,
                status = string.Equals(deviceStatus, "online", StringComparison.OrdinalIgnoreCase)
                    ? "normal"
                    : string.Equals(deviceStatus, "offline", StringComparison.OrdinalIgnoreCase)
                        ? "offline"
                        : "unknown"
            };
        }

        return null;
    }
}
