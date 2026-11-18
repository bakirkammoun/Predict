using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.Management;
using Unity.XR.CoreUtils;

public static class PrediMaintARProjectBuilder
{
    private const string ModelsPath = "Assets/Models";
    private const string PrefabsPath = "Assets/Prefabs";
    private const string MaterialsPath = "Assets/Materials";
    private const string ScenesPath = "Assets/Scenes";
    private const string ScenePath = ScenesPath + "/ARScene.unity";
    private const string PlanePrefabPath = PrefabsPath + "/ARPlane.prefab";
    private const string PlaneMaterialPath = MaterialsPath + "/ARPlane.mat";

    private static readonly ModelDefinition[] Models =
    {
        new ModelDefinition("ESP32", "ESP32 DevKit", "device", string.Empty, "ESP32"),
        new ModelDefinition("DHT22", "DHT22", "temperature", "4", "DHT22"),
        new ModelDefinition("SW-420", "SW-420", "vibration", "27", "SW-420"),
        new ModelDefinition("ACS712", "ACS712", "current", "34", "ACS712")
    };

    [MenuItem("PrédiMaint AR/Generate prefabs and ARScene")]
    public static void GenerateProject()
    {
        Directory.CreateDirectory(PrefabsPath);
        Directory.CreateDirectory(MaterialsPath);
        Directory.CreateDirectory(ScenesPath);
        AssetDatabase.Refresh();

        ConfigureAndroidARCore();
        var prefabs = GeneratePrefabs();
        var planePrefab = GeneratePlanePrefab();
        GenerateScene(prefabs, planePrefab);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("PrédiMaint AR prefabs and ARScene were generated.");
    }

    private static void ConfigureAndroidARCore()
    {
        var target = BuildTargetGroup.Android;
        var generalSettings = XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(target);
        if (generalSettings == null)
        {
            var xrFolder = "Assets/XR";
            Directory.CreateDirectory(xrFolder);
            generalSettings = ScriptableObject.CreateInstance<XRGeneralSettings>();
            var managerSettings = ScriptableObject.CreateInstance<XRManagerSettings>();
            var perTargetSettings = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();

            AssetDatabase.CreateAsset(managerSettings, $"{xrFolder}/XRManagerSettings.asset");
            AssetDatabase.CreateAsset(generalSettings, $"{xrFolder}/XRGeneralSettings.asset");
            AssetDatabase.CreateAsset(perTargetSettings, $"{xrFolder}/XRGeneralSettingsPerBuildTarget.asset");
            generalSettings.AssignedSettings = managerSettings;
            generalSettings.InitManagerOnStart = true;
            perTargetSettings.SetSettingsForBuildTarget(target, generalSettings);
            EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, perTargetSettings, true);
        }

        if (generalSettings.AssignedSettings == null)
        {
            throw new InvalidOperationException("XR Plug-in Management has no Android manager settings.");
        }

        var arCoreAssigned = false;
        foreach (var loader in generalSettings.AssignedSettings.activeLoaders)
        {
            if (loader != null && loader.GetType().FullName == "UnityEngine.XR.ARCore.ARCoreLoader")
            {
                arCoreAssigned = true;
                break;
            }
        }

        if (!arCoreAssigned &&
            !XRPackageMetadataStore.AssignLoader(generalSettings.AssignedSettings, "UnityEngine.XR.ARCore.ARCoreLoader", target))
        {
            throw new InvalidOperationException("Could not enable the Google ARCore loader for Android.");
        }

        PlayerSettings.SetScriptingBackend(target, ScriptingImplementation.IL2CPP);
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
        PlayerSettings.Android.forceInternetPermission = true;
        EditorUtility.SetDirty(generalSettings);
        EditorUtility.SetDirty(generalSettings.AssignedSettings);
        AssetDatabase.SaveAssets();
    }

    private static GameObject[] GeneratePrefabs()
    {
        var prefabs = new GameObject[Models.Length];
        for (var index = 0; index < Models.Length; index++)
        {
            var definition = Models[index];
            var modelPath = $"{ModelsPath}/{definition.FileName}.glb";
            var prefabPath = $"{PrefabsPath}/{definition.FileName}.prefab";
            if (!File.Exists(modelPath))
            {
                throw new FileNotFoundException($"Required GLB model is missing: {modelPath}");
            }

            AssetDatabase.ImportAsset(modelPath, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            var importedModel = AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
            if (importedModel == null)
            {
                throw new InvalidOperationException(
                    $"glTFast did not import {modelPath}. Check the Unity Console before retrying.");
            }

            var root = new GameObject(definition.DisplayName);
            var model = PrefabUtility.InstantiatePrefab(importedModel) as GameObject;
            if (model == null)
            {
                UnityEngine.Object.DestroyImmediate(root);
                throw new InvalidOperationException($"Could not instantiate imported model {modelPath}.");
            }

            model.transform.SetParent(root.transform, false);
            var tag = root.AddComponent<SensorModelTag>();
            tag.Configure(definition.TelemetryKey, definition.DisplayName, definition.Gpio, definition.MarkerName);
            AddSelectionCollider(root);

            var savedPrefab = PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
            UnityEngine.Object.DestroyImmediate(root);
            if (savedPrefab == null)
            {
                throw new InvalidOperationException($"Could not create prefab {prefabPath}.");
            }

            prefabs[index] = savedPrefab;
        }

        return prefabs;
    }

    private static void AddSelectionCollider(GameObject root)
    {
        var renderers = root.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length == 0)
        {
            throw new InvalidOperationException($"Imported model {root.name} contains no renderers.");
        }

        var bounds = renderers[0].bounds;
        for (var index = 1; index < renderers.Length; index++)
        {
            bounds.Encapsulate(renderers[index].bounds);
        }

        var collider = root.AddComponent<BoxCollider>();
        collider.center = root.transform.InverseTransformPoint(bounds.center);
        collider.size = bounds.size;
    }

    private static GameObject GeneratePlanePrefab()
    {
        var shader = Shader.Find("Unlit/Transparent");
        if (shader == null)
        {
            throw new InvalidOperationException("The built-in Unlit/Transparent shader is unavailable.");
        }

        var planeMaterial = AssetDatabase.LoadAssetAtPath<Material>(PlaneMaterialPath);
        if (planeMaterial == null)
        {
            planeMaterial = new Material(shader)
            {
                name = "AR Plane Preview"
            };
            planeMaterial.color = new Color(0.12f, 0.62f, 0.92f, 0.14f);
            AssetDatabase.CreateAsset(planeMaterial, PlaneMaterialPath);
        }

        var plane = new GameObject("AR Plane", typeof(ARPlane), typeof(ARPlaneMeshVisualizer), typeof(MeshFilter), typeof(MeshRenderer), typeof(LineRenderer));
        plane.GetComponent<MeshRenderer>().sharedMaterial = planeMaterial;
        var boundary = plane.GetComponent<LineRenderer>();
        boundary.useWorldSpace = false;
        boundary.loop = true;
        boundary.startWidth = 0.004f;
        boundary.endWidth = 0.004f;
        boundary.sharedMaterial = planeMaterial;

        var savedPrefab = PrefabUtility.SaveAsPrefabAsset(plane, PlanePrefabPath);
        UnityEngine.Object.DestroyImmediate(plane);
        if (savedPrefab == null)
        {
            throw new InvalidOperationException($"Could not create plane prefab {PlanePrefabPath}.");
        }

        return savedPrefab;
    }

    private static void GenerateScene(GameObject[] prefabs, GameObject planePrefab)
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var session = new GameObject("AR Session");
        var arSession = session.AddComponent<ARSession>();
        session.AddComponent<ARInputManager>();
        arSession.enabled = false;

        var originObject = new GameObject("XR Origin");
        var origin = originObject.AddComponent<XROrigin>();
        var cameraObject = new GameObject(
            "AR Camera",
            typeof(Camera),
            typeof(AudioListener),
            typeof(ARCameraManager),
            typeof(ARCameraBackground));
        cameraObject.tag = "MainCamera";
        cameraObject.transform.SetParent(originObject.transform, false);
        origin.Camera = cameraObject.GetComponent<Camera>();

        var planes = originObject.AddComponent<ARPlaneManager>();
        planes.requestedDetectionMode = UnityEngine.XR.ARSubsystems.PlaneDetectionMode.Horizontal |
            UnityEngine.XR.ARSubsystems.PlaneDetectionMode.Vertical;
        planes.planePrefab = planePrefab;
        planes.enabled = false;
        var raycasts = originObject.AddComponent<ARRaycastManager>();
        raycasts.enabled = false;

        var imageTracking = originObject.AddComponent<ARTrackedImageManager>();
        imageTracking.enabled = false;
        var markerSpawner = originObject.AddComponent<TrackedMarkerModelSpawner>();

        var receiverObject = new GameObject("PrédiMaint Telemetry Receiver");
        var receiver = receiverObject.AddComponent<SensorTelemetryReceiver>();
        markerSpawner.Configure(imageTracking, prefabs, receiver);
        var controllerObject = new GameObject("Assistant AR Controller");
        var controller = controllerObject.AddComponent<AssistantArController>();

        var canvasObject = new GameObject("AR Interface", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = canvasObject.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasObject.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1080, 1920);
        scaler.matchWidthOrHeight = 0.5f;

        new GameObject("Event System", typeof(EventSystem), typeof(StandaloneInputModule));

        CreatePanel(canvas.transform, new Vector2(0.02f, 0.54f), new Vector2(0.98f, 0.98f),
            new Color(0.04f, 0.08f, 0.14f, 0.82f));
        var machineLabel = CreateText(canvas.transform, "Machine", new Vector2(0.06f, 0.92f), new Vector2(0.94f, 0.97f), 36, FontStyle.Bold);
        var detailsLabel = CreateText(canvas.transform, "Sensor details", new Vector2(0.06f, 0.55f), new Vector2(0.94f, 0.92f), 24, FontStyle.Normal);

        CreatePanel(canvas.transform, new Vector2(0.02f, 0.01f), new Vector2(0.98f, 0.25f),
            new Color(0.04f, 0.08f, 0.14f, 0.82f));
        var hintLabel = CreateText(canvas.transform, "Hint", new Vector2(0.06f, 0.19f), new Vector2(0.94f, 0.24f), 22, FontStyle.Normal);
        hintLabel.text = "Mesures en attente de PrédiMaint. Suivi par marqueur inactif jusqu'à l'ajout de marqueurs calibrés.";

        var cameraButton = CreateButton(canvas.transform, "Démarrer caméra", new Vector2(0.04f, 0.13f), new Vector2(0.48f, 0.18f));
        var placeButton = CreateButton(canvas.transform, "Placement : activé", new Vector2(0.52f, 0.13f), new Vector2(0.96f, 0.18f));
        for (var index = 0; index < Models.Length; index++)
        {
            var xMin = 0.04f + index * 0.24f;
            var xMax = xMin + 0.21f;
            var button = CreateButton(canvas.transform, Models[index].DisplayName, new Vector2(xMin, 0.05f), new Vector2(xMax, 0.11f));
            button.gameObject.AddComponent<ModelSelectionButton>().Configure(controller, index);
        }

        controller.Configure(
            raycasts,
            cameraObject.GetComponent<Camera>(),
            receiver,
            prefabs,
            machineLabel,
            detailsLabel,
            hintLabel,
            cameraButton,
            arSession,
            planes,
            placeButton);

        EditorSceneManager.MarkSceneDirty(scene);
        EditorSceneManager.SaveScene(scene, ScenePath);
        AddSceneToBuildSettings(ScenePath);
    }

    private static void AddSceneToBuildSettings(string scenePath)
    {
        var scenes = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        foreach (var scene in scenes)
        {
            if (scene.path == scenePath)
            {
                scene.enabled = true;
                EditorBuildSettings.scenes = scenes.ToArray();
                return;
            }
        }

        scenes.Add(new EditorBuildSettingsScene(scenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
    }

    private static void CreatePanel(Transform parent, Vector2 min, Vector2 max, Color color)
    {
        var panel = new GameObject("Panel", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        panel.transform.SetParent(parent, false);
        var rect = panel.GetComponent<RectTransform>();
        rect.anchorMin = min;
        rect.anchorMax = max;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        panel.GetComponent<Image>().color = color;
    }

    private static Text CreateText(Transform parent, string name, Vector2 min, Vector2 max, int size, FontStyle style)
    {
        var textObject = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
        textObject.transform.SetParent(parent, false);
        var rect = textObject.GetComponent<RectTransform>();
        rect.anchorMin = min;
        rect.anchorMax = max;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        var text = textObject.GetComponent<Text>();
        text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
        text.fontSize = size;
        text.fontStyle = style;
        text.color = Color.white;
        text.alignment = TextAnchor.MiddleLeft;
        text.horizontalOverflow = HorizontalWrapMode.Wrap;
        text.verticalOverflow = VerticalWrapMode.Truncate;
        return text;
    }

    private static Button CreateButton(Transform parent, string label, Vector2 min, Vector2 max)
    {
        var buttonObject = new GameObject(label + " Button", typeof(RectTransform), typeof(CanvasRenderer), typeof(Image), typeof(Button));
        buttonObject.transform.SetParent(parent, false);
        var rect = buttonObject.GetComponent<RectTransform>();
        rect.anchorMin = min;
        rect.anchorMax = max;
        rect.offsetMin = Vector2.zero;
        rect.offsetMax = Vector2.zero;
        buttonObject.GetComponent<Image>().color = new Color(0.08f, 0.42f, 0.75f, 0.95f);
        var labelText = CreateText(buttonObject.transform, "Label", Vector2.zero, Vector2.one, 20, FontStyle.Bold);
        labelText.alignment = TextAnchor.MiddleCenter;
        labelText.text = label;
        return buttonObject.GetComponent<Button>();
    }

    private sealed class ModelDefinition
    {
        public readonly string FileName;
        public readonly string DisplayName;
        public readonly string TelemetryKey;
        public readonly string Gpio;
        public readonly string MarkerName;

        public ModelDefinition(string fileName, string displayName, string telemetryKey, string gpio, string markerName)
        {
            FileName = fileName;
            DisplayName = displayName;
            TelemetryKey = telemetryKey;
            Gpio = gpio;
            MarkerName = markerName;
        }
    }
}
