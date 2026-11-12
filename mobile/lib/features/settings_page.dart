import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/error_box.dart';
import '../widgets/brand_title.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final formKey = GlobalKey<FormState>();
  final offlineTimeout = TextEditingController();
  final retentionDays = TextEditingController();
  final confirmationCount = TextEditingController();
  final hysteresisCount = TextEditingController();
  final warningVibration = TextEditingController();
  final criticalVibration = TextEditingController();
  final warningTemperature = TextEditingController();
  final criticalTemperature = TextEditingController();
  final warningCurrent = TextEditingController();
  final criticalCurrent = TextEditingController();
  final machineConfirmationCount = TextEditingController();
  List<Map<String, dynamic>> machines = [];
  String? selectedMachineId;
  String? error;
  bool loading = true;
  bool saving = false;
  bool savingThresholds = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    offlineTimeout.dispose();
    retentionDays.dispose();
    confirmationCount.dispose();
    hysteresisCount.dispose();
    warningVibration.dispose();
    criticalVibration.dispose();
    warningTemperature.dispose();
    criticalTemperature.dispose();
    warningCurrent.dispose();
    criticalCurrent.dispose();
    machineConfirmationCount.dispose();
    super.dispose();
  }

  Future<void> load() async {
    if (mounted) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final results = await Future.wait([
        widget.api.get('/settings'),
        widget.api.get('/machines', {'limit': 100}),
      ]);
      final settings = results[0] as Map;
      final loadedMachines = (results[1] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      if (!mounted) return;
      offlineTimeout.text = settings['offlineTimeoutMs']?.toString() ?? '';
      retentionDays.text =
          settings['measurementRetentionDays']?.toString() ?? '';
      confirmationCount.text = settings['confirmationCount']?.toString() ?? '';
      hysteresisCount.text = settings['hysteresisCount']?.toString() ?? '';
      machines = loadedMachines;
      if (selectedMachineId == null ||
          !loadedMachines
              .any((machine) => machine['_id'] == selectedMachineId)) {
        selectedMachineId = loadedMachines.isEmpty
            ? null
            : loadedMachines.first['_id']?.toString();
      }
      _loadMachineThresholds();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void _loadMachineThresholds() {
    Map<String, dynamic>? machine;
    for (final item in machines) {
      if (item['_id']?.toString() == selectedMachineId) {
        machine = item;
        break;
      }
    }
    final thresholds = machine?['thresholds'] as Map?;
    final vibration = thresholds?['vibration'] as Map?;
    final temperature = thresholds?['temperature'] as Map?;
    final current = thresholds?['current'] as Map?;
    final vibrationIsDetection = vibration?['unit'] == 'detection';
    warningVibration.text = vibrationIsDetection
        ? _thresholdValue(vibration, 'warningMax', '0.5')
        : '0.5';
    criticalVibration.text = vibrationIsDetection
        ? _thresholdValue(vibration, 'criticalMax', '2')
        : '2';
    warningTemperature.text = _thresholdValue(temperature, 'warningMax', '70');
    criticalTemperature.text =
        _thresholdValue(temperature, 'criticalMax', '90');
    warningCurrent.text = _thresholdValue(current, 'warningMax', '8');
    criticalCurrent.text = _thresholdValue(current, 'criticalMax', '12');
    machineConfirmationCount.text =
        machine?['confirmationCount']?.toString() ?? '3';
  }

  String _thresholdValue(Map? metric, String key, String fallback) =>
      metric?[key]?.toString() ?? fallback;

  String? _validateInteger(String? raw, {required int min, int? max}) {
    final value = int.tryParse(raw?.trim() ?? '');
    if (value == null) return 'Saisissez un nombre entier.';
    if (value < min || (max != null && value > max)) {
      return max == null
          ? 'La valeur doit être au moins $min.'
          : 'La valeur doit être comprise entre $min et $max.';
    }
    return null;
  }

  Future<void> save() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    setState(() {
      error = null;
      saving = true;
    });
    try {
      await widget.api.patch('/settings', {
        'offlineTimeoutMs': int.parse(offlineTimeout.text.trim()),
        'measurementRetentionDays': int.parse(retentionDays.text.trim()),
        'confirmationCount': int.parse(confirmationCount.text.trim()),
        'hysteresisCount': int.parse(hysteresisCount.text.trim()),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Paramètres enregistrés.')),
      );
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> saveMachineThresholds() async {
    final id = selectedMachineId;
    if (id == null) {
      setState(() => error = 'Choisissez une machine.');
      return;
    }
    final warningV = double.tryParse(warningVibration.text.trim());
    final criticalV = double.tryParse(criticalVibration.text.trim());
    final warningT = double.tryParse(warningTemperature.text.trim());
    final criticalT = double.tryParse(criticalTemperature.text.trim());
    final warningC = double.tryParse(warningCurrent.text.trim());
    final criticalC = double.tryParse(criticalCurrent.text.trim());
    final confirmations = int.tryParse(machineConfirmationCount.text.trim());
    if (warningV == null ||
        criticalV == null ||
        warningT == null ||
        criticalT == null ||
        warningC == null ||
        criticalC == null ||
        warningV >= criticalV ||
        warningT >= criticalT ||
        warningC >= criticalC ||
        confirmations == null ||
        confirmations < 1 ||
        confirmations > 20) {
      setState(() => error =
          'Vérifiez les valeurs : le seuil de vigilance doit être inférieur au seuil critique et la confirmation comprise entre 1 et 20.');
      return;
    }

    setState(() {
      error = null;
      savingThresholds = true;
    });
    try {
      final updated = await widget.api.patch('/machines/$id', {
        'confirmationCount': confirmations,
        'thresholds': {
          'vibration': {
            'unit': 'detection',
            'validMin': 0,
            'validMax': 1,
            'warningMax': warningV,
            'criticalMax': criticalV,
          },
          'temperature': {
            'unit': 'C',
            'validMin': -20,
            'validMax': 150,
            'warningMax': warningT,
            'criticalMax': criticalT,
          },
          'current': {
            'unit': 'A',
            'validMin': 0,
            'validMax': 100,
            'warningMax': warningC,
            'criticalMax': criticalC,
          },
        },
      });
      if (!mounted) return;
      final updatedMachine = Map<String, dynamic>.from(updated as Map);
      setState(() {
        machines = machines
            .map((machine) =>
                machine['_id']?.toString() == id ? updatedMachine : machine)
            .toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Seuils de la machine enregistrés.')),
      );
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => savingThresholds = false);
    }
  }

  Widget _thresholdFields(
    String title,
    TextEditingController warning,
    TextEditingController critical,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: warning,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Vigilance',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                controller: critical,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Critique',
                  isDense: true,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Paramètres système'),
        actions: [
          IconButton(
              onPressed: load,
              tooltip: 'Recharger',
              icon: const Icon(Icons.refresh_rounded)),
          const SizedBox(width: 4),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && offlineTimeout.text.isEmpty
              ? ErrorBox(message: error!, onRetry: load)
              : Form(
                  key: formKey,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text(
                        'Ces paramètres influencent la surveillance et la conservation des données.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 16),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Surveillance des équipements',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: offlineTimeout,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Délai hors ligne',
                                  suffixText: 'ms',
                                  helperText: 'Minimum : 10 000 ms',
                                ),
                                validator: (value) =>
                                    _validateInteger(value, min: 10000),
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: confirmationCount,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Mesures de confirmation',
                                  helperText:
                                      'Nombre de mesures avant de confirmer un état.',
                                ),
                                validator: (value) =>
                                    _validateInteger(value, min: 1),
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: hysteresisCount,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Mesures d’hystérésis',
                                  helperText:
                                      'Nombre de mesures normales avant le retour à l’état normal.',
                                ),
                                validator: (value) =>
                                    _validateInteger(value, min: 1),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Conservation',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 14),
                              TextFormField(
                                controller: retentionDays,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Rétention des mesures',
                                  suffixText: 'jours',
                                  helperText: 'De 1 à 730 jours.',
                                ),
                                validator: (value) =>
                                    _validateInteger(value, min: 1, max: 730),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Seuils par machine',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 8),
                              Text(
                                'Définissez les limites de vigilance et critiques pour chaque équipement.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              const SizedBox(height: 14),
                              DropdownButtonFormField<String>(
                                key: ValueKey(selectedMachineId),
                                initialValue: selectedMachineId,
                                isExpanded: true,
                                decoration:
                                    const InputDecoration(labelText: 'Machine'),
                                hint: const Text('Choisir une machine'),
                                items: machines
                                    .map(
                                      (machine) => DropdownMenuItem<String>(
                                        value: machine['_id'].toString(),
                                        child: Text(
                                          machine['name']?.toString() ??
                                              'Machine',
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    )
                                    .toList(),
                                onChanged: machines.isEmpty
                                    ? null
                                    : (value) => setState(() {
                                          selectedMachineId = value;
                                          _loadMachineThresholds();
                                        }),
                              ),
                              const SizedBox(height: 14),
                              _thresholdFields(
                                'Vibration SW-420 · détection (0 ou 1)',
                                warningVibration,
                                criticalVibration,
                              ),
                              const SizedBox(height: 12),
                              _thresholdFields(
                                'Température (°C)',
                                warningTemperature,
                                criticalTemperature,
                              ),
                              const SizedBox(height: 12),
                              _thresholdFields(
                                'Courant (A)',
                                warningCurrent,
                                criticalCurrent,
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: machineConfirmationCount,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText:
                                      'Échantillons consécutifs avant alerte',
                                  helperText: 'Valeur comprise entre 1 et 20.',
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Le capteur SW-420 détecte une vibration, mais ne mesure pas son intensité.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              const SizedBox(height: 12),
                              FilledButton.icon(
                                onPressed: savingThresholds ||
                                        selectedMachineId == null
                                    ? null
                                    : saveMachineThresholds,
                                icon: savingThresholds
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white),
                                      )
                                    : const Icon(Icons.save_outlined),
                                label: Text(savingThresholds
                                    ? 'Enregistrement…'
                                    : 'Enregistrer les seuils'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 8),
                        Text(error!,
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: saving ? null : save,
                        child: Text(saving
                            ? 'Enregistrement…'
                            : 'Enregistrer les paramètres'),
                      ),
                    ],
                  ),
                ),
    );
  }
}
