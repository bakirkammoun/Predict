using UnityEngine;
using UnityEngine.UI;

public sealed class ModelSelectionButton : MonoBehaviour
{
    [SerializeField] private AssistantArController controller;
    [SerializeField] private int modelIndex;

    private Button button;

    public void Configure(AssistantArController target, int index)
    {
        controller = target;
        modelIndex = index;
    }

    private void OnEnable()
    {
        button = GetComponent<Button>();
        if (button == null)
        {
            Debug.LogError("Model selection button requires a Unity UI Button component.");
            return;
        }

        button.onClick.AddListener(SelectModel);
    }

    private void OnDisable()
    {
        if (button != null)
        {
            button.onClick.RemoveListener(SelectModel);
        }
    }

    private void SelectModel()
    {
        if (controller == null)
        {
            Debug.LogError("Model selection button has no Assistant AR controller.");
            return;
        }

        controller.SelectModel(modelIndex);
    }
}
