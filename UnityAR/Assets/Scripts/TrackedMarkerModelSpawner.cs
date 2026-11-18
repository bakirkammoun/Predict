using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

public sealed class TrackedMarkerModelSpawner : MonoBehaviour
{
    [SerializeField] private ARTrackedImageManager imageManager;
    [SerializeField] private GameObject[] modelPrefabs;
    [SerializeField] private SensorTelemetryReceiver telemetryReceiver;

    private readonly Dictionary<TrackableId, GameObject> instances = new Dictionary<TrackableId, GameObject>();

    public void Configure(ARTrackedImageManager manager, GameObject[] prefabs, SensorTelemetryReceiver receiver)
    {
        imageManager = manager;
        modelPrefabs = prefabs;
        telemetryReceiver = receiver;
    }

    private void OnEnable()
    {
        if (imageManager != null)
        {
            imageManager.trackedImagesChanged += OnTrackedImagesChanged;
        }
    }

    private void OnDisable()
    {
        if (imageManager != null)
        {
            imageManager.trackedImagesChanged -= OnTrackedImagesChanged;
        }
    }

    private void OnTrackedImagesChanged(ARTrackedImagesChangedEventArgs eventArgs)
    {
        foreach (var image in eventArgs.added)
        {
            AddModel(image);
        }

        foreach (var image in eventArgs.updated)
        {
            UpdateModel(image);
        }

        foreach (var image in eventArgs.removed)
        {
            RemoveModel(image);
        }
    }

    private void AddModel(ARTrackedImage image)
    {
        var prefab = FindPrefab(image.referenceImage.name);
        if (prefab == null)
        {
            Debug.LogWarning($"No AR model is mapped to marker '{image.referenceImage.name}'.");
            return;
        }

        var instance = Instantiate(prefab, image.transform);
        instance.transform.localPosition = Vector3.zero;
        instance.transform.localRotation = Quaternion.identity;
        var tag = instance.GetComponent<SensorModelTag>();
        if (tag != null)
        {
            tag.Apply(telemetryReceiver?.FindChannel(tag.TelemetryKey));
        }

        instances[image.trackableId] = instance;
        UpdateModel(image);
    }

    private void UpdateModel(ARTrackedImage image)
    {
        if (instances.TryGetValue(image.trackableId, out var instance))
        {
            instance.SetActive(image.trackingState == TrackingState.Tracking);
        }
    }

    private void RemoveModel(ARTrackedImage image)
    {
        if (instances.TryGetValue(image.trackableId, out var instance))
        {
            Destroy(instance);
            instances.Remove(image.trackableId);
        }
    }

    private GameObject FindPrefab(string markerName)
    {
        if (modelPrefabs == null)
        {
            return null;
        }

        foreach (var prefab in modelPrefabs)
        {
            var tag = prefab != null ? prefab.GetComponent<SensorModelTag>() : null;
            if (tag != null && string.Equals(tag.MarkerName, markerName, System.StringComparison.OrdinalIgnoreCase))
            {
                return prefab;
            }
        }

        return null;
    }
}
