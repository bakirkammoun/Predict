import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/brand_title.dart';
import '../widgets/error_box.dart';

class SimulationPage extends StatefulWidget {
  const SimulationPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<SimulationPage> createState() => _SimulationPageState();
}

class _SimulationPageState extends State<SimulationPage> {
  static const scenarios =
      <({String value, String title, String detail, Color color})>[
    (
      value: 'normal',
      title: 'Fonctionnement normal',
      detail: 'Mesures dans les limites',
      color: Color(0xFF16A34A),
    ),
    (
      value: 'warning',
      title: 'Vigilance',
      detail: 'Dépassement modéré des seuils',
      color: Color(0xFFD97706),
    ),
    (
      value: 'critical',
      title: 'État critique',
      detail: 'Dépassement important des seuils',
      color: Color(0xFFDC2626),
    ),
    (
      value: 'offline',
      title: 'Machine hors ligne',
      detail: 'Simuler une perte de communication',
      color: Color(0xFF667085),
    ),
    (
      value: 'sensor_error',
      title: 'Erreur capteur',
      detail: 'Simuler une anomalie de capteur',
      color: Color(0xFF0284C7),
    ),
  ];

  Map<String, dynamic>? status;
  List<Map<String, dynamic>> machines = [];
  String? machineId;
  String? error;
  String? busyAction;
  bool loading = true;
  int intervalMs = 4000;
  final intervalController = TextEditingController(text: '4000');
  final intervalFormKey = GlobalKey<FormState>();

  bool get running => status?['running'] == true;

  @override
  void dispose() {
    intervalController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool showLoading = true}) async {
    if (showLoading && mounted) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final results = await Future.wait([
        widget.api.get('/simulation'),
        widget.api.get('/machines', {'limit': 100}),
      ]);
      if (!mounted) return;
      final loadedMachines = (results[1] as List)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      setState(() {
        status = Map<String, dynamic>.from(results[0] as Map);
        machines = loadedMachines;
        if (machineId == null ||
            !loadedMachines.any((machine) => machine['_id'] == machineId)) {
          machineId = loadedMachines.isEmpty
              ? null
              : loadedMachines.first['_id']?.toString();
        }
        final serverInterval = status?['intervalMs'];
        if (serverInterval is num) {
          intervalMs = serverInterval.toInt();
          intervalController.text = intervalMs.toString();
        }
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> perform(String action, Future<dynamic> Function() request,
      String successMessage) async {
    if (busyAction != null) return;
    setState(() {
      busyAction = action;
      error = null;
    });
    try {
      await request();
      await load(showLoading: false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(successMessage)),
      );
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => busyAction = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Simulation'),
        actions: [
          IconButton(
            onPressed: loading ? null : load,
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && status == null
              ? ErrorBox(message: error!, onRetry: load)
              : RefreshIndicator(
                  onRefresh: load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7E8),
                          border: Border.all(color: const Color(0xFFF4D9A5)),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline_rounded,
                                color: Color(0xFFB45309)),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Les mesures générées sont synthétiques. Elles ne proviennent pas de capteurs physiques.',
                                style: TextStyle(
                                  color: Color(0xFF854D0E),
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error),
                        ),
                      ],
                      const SizedBox(height: 16),
                      _sectionCard(
                        title: 'État du simulateur',
                        subtitle:
                            'Contrôlez la génération automatique des mesures.',
                        icon: Icons.waves_rounded,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: running
                                  ? const Color(0xFFECFDF3)
                                  : const Color(0xFFF7F8FC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: running
                                    ? const Color(0xFFB7E4C7)
                                    : const Color(0xFFE9ECF3),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  running
                                      ? Icons.check_circle_rounded
                                      : Icons.pause_circle_outline_rounded,
                                  color: running
                                      ? const Color(0xFF15803D)
                                      : const Color(0xFF667085),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        running
                                            ? 'Simulation en cours'
                                            : 'Simulation arrêtée',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700),
                                      ),
                                      Text(
                                        'Intervalle actuel : ${status?['intervalMs'] ?? '—'} ms',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                                if (busyAction != null)
                                  const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                          Form(
                            key: intervalFormKey,
                            child: TextFormField(
                              controller: intervalController,
                              enabled: busyAction == null,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Fréquence des mesures',
                                suffixText: 'ms',
                                helperText:
                                    'Valeur autorisée : 500 à 60 000 ms.',
                              ),
                              validator: (value) {
                                final parsed =
                                    int.tryParse(value?.trim() ?? '');
                                if (parsed == null ||
                                    parsed < 500 ||
                                    parsed > 60000) {
                                  return 'Saisissez un nombre entre 500 et 60 000.';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: busyAction != null
                                ? null
                                : () {
                                    if (!(intervalFormKey.currentState
                                            ?.validate() ??
                                        false)) {
                                      return;
                                    }
                                    intervalMs = int.parse(
                                        intervalController.text.trim());
                                    perform(
                                      'interval',
                                      () => widget.api.post(
                                          '/simulation/interval',
                                          {'intervalMs': intervalMs}),
                                      'Fréquence mise à jour.',
                                    );
                                  },
                            icon: const Icon(Icons.tune_rounded),
                            label: const Text('Appliquer la fréquence'),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: busyAction != null || running
                                      ? null
                                      : () {
                                          if (!(intervalFormKey.currentState
                                                  ?.validate() ??
                                              false)) {
                                            return;
                                          }
                                          intervalMs = int.parse(
                                              intervalController.text.trim());
                                          perform(
                                            'start',
                                            () => widget.api.post(
                                              '/simulation/start',
                                              {'intervalMs': intervalMs},
                                            ),
                                            'Simulateur démarré.',
                                          );
                                        },
                                  icon: const Icon(Icons.play_arrow_rounded),
                                  label: const Text('Démarrer'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: busyAction != null || !running
                                      ? null
                                      : () => perform(
                                            'stop',
                                            () => widget.api
                                                .post('/simulation/stop', {}),
                                            'Simulateur arrêté.',
                                          ),
                                  icon: const Icon(Icons.stop_rounded),
                                  label: const Text('Arrêter'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _sectionCard(
                        title: 'Scénario de machine',
                        subtitle:
                            'Testez un état sur une machine sélectionnée.',
                        icon: Icons.precision_manufacturing_outlined,
                        children: [
                          DropdownButtonFormField<String>(
                            key: ValueKey(machineId),
                            initialValue: machineId,
                            isExpanded: true,
                            decoration:
                                const InputDecoration(labelText: 'Machine'),
                            hint: const Text('Choisir une machine'),
                            items: machines
                                .map(
                                  (machine) => DropdownMenuItem<String>(
                                    value: machine['_id'].toString(),
                                    child: Text(
                                      machine['name']?.toString() ?? 'Machine',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: busyAction != null || machines.isEmpty
                                ? null
                                : (value) => setState(() => machineId = value),
                          ),
                          const SizedBox(height: 10),
                          if (machines.isEmpty)
                            const Text(
                              'Aucune machine accessible pour le moment.',
                              style: TextStyle(color: Color(0xFF667085)),
                            ),
                          for (final scenario in scenarios)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: OutlinedButton(
                                onPressed:
                                    busyAction != null || machineId == null
                                        ? null
                                        : () => perform(
                                              'scenario-${scenario.value}',
                                              () => widget.api.post(
                                                '/simulation/scenario',
                                                {
                                                  'machineId': machineId,
                                                  'scenario': scenario.value,
                                                },
                                              ),
                                              'Scénario « ${scenario.title} » appliqué.',
                                            ),
                                style: OutlinedButton.styleFrom(
                                  alignment: Alignment.centerLeft,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 13, vertical: 12),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 9,
                                      height: 9,
                                      decoration: BoxDecoration(
                                        color: scenario.color,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 11),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(scenario.title,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                          Text(
                                            scenario.detail,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (busyAction ==
                                        'scenario-${scenario.value}')
                                      const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2),
                                      )
                                    else
                                      const Icon(Icons.chevron_right_rounded),
                                  ],
                                ),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _sectionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(subtitle,
                          style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...children,
          ],
        ),
      ),
    );
  }
}
