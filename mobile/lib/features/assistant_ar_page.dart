import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api_client.dart';
import '../core/app_theme.dart';
import '../core/helpers.dart';
import '../widgets/brand_title.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';

class AssistantArPage extends StatefulWidget {
  const AssistantArPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<AssistantArPage> createState() => _AssistantArPageState();
}

class _AssistantArPageState extends State<AssistantArPage> {
  static const _sensors = <(String, String, IconData)>[
    ('temperature', 'Température', Icons.thermostat_rounded),
    ('vibration', 'Vibration', Icons.vibration_rounded),
    ('current', 'Courant', Icons.electric_bolt_outlined),
  ];

  List machines = [];
  List measurements = [];
  List alerts = [];
  Map? machine;
  String? machineId;
  String? error;
  String? selectedSensor;
  bool loadingMachines = true;
  bool loadingData = false;
  bool socketConnected = false;
  int requestGeneration = 0;
  io.Socket? socket;

  @override
  void initState() {
    super.initState();
    _connectSocket();
    loadMachines();
  }

  @override
  void dispose() {
    socket?.disconnect();
    socket?.dispose();
    super.dispose();
  }

  void _connectSocket() {
    final token = widget.api.session.token;
    if (token == null || token.isEmpty) return;

    final apiUri = Uri.parse(widget.api.dio.options.baseUrl);
    final socketUri =
        apiUri.replace(path: '', query: '', fragment: '').toString();
    socket = io.io(
      socketUri,
      <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': false,
        'reconnection': true,
        'auth': {'token': token},
      },
    );
    socket!
      ..onConnect((_) {
        if (mounted) setState(() => socketConnected = true);
        unawaited(loadSelectedMachine(silent: true));
      })
      ..onDisconnect((_) {
        if (mounted) setState(() => socketConnected = false);
      });

    for (final event in [
      'measurement:new',
      'alert:new',
      'alert:updated',
      'machine:status',
    ]) {
      socket!.on(event, _onLiveEvent);
    }
    socket!.connect();
  }

  void _onLiveEvent(dynamic payload) {
    if (payload is! Map ||
        _id(payload['machineId']) != machineId ||
        machineId == null) {
      return;
    }
    unawaited(loadSelectedMachine(silent: true));
  }

  Future<void> loadMachines() async {
    try {
      final result = await widget.api.get('/machines', {'limit': 100}) as List;
      if (!mounted) return;
      final previousId = machineId;
      final selected = result.where((raw) {
        return _id((raw as Map)['_id']) == previousId;
      }).firstOrNull;
      setState(() {
        machines = result;
        machineId = selected == null
            ? (result.isEmpty ? null : _id((result.first as Map)['_id']))
            : _id((selected as Map)['_id']);
        error = null;
      });
      if (machineId != null) await loadSelectedMachine();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loadingMachines = false);
    }
  }

  Future<void> loadSelectedMachine({bool silent = false}) async {
    final selectedId = machineId;
    if (selectedId == null) return;
    final generation = ++requestGeneration;
    if (!silent && mounted) {
      setState(() {
        loadingData = true;
        error = null;
      });
    }
    try {
      final result = await Future.wait([
        widget.api.get('/machines/$selectedId'),
        widget.api.get('/machines/$selectedId/measurements', {'limit': 30}),
        widget.api.get('/alerts', {'machineId': selectedId, 'limit': 100}),
      ]);
      if (!mounted ||
          selectedId != machineId ||
          generation != requestGeneration) {
        return;
      }
      setState(() {
        machine = result[0] as Map;
        measurements = result[1] as List;
        alerts = result[2] as List;
        error = null;
      });
    } catch (e) {
      if (mounted && selectedId == machineId) {
        setState(() => error = apiMessage(e));
      }
    } finally {
      if (mounted && selectedId == machineId) {
        setState(() => loadingData = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Assistant AR'),
        actions: [
          IconButton(
            onPressed: loadSelectedMachine,
            tooltip: 'Actualiser les données',
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: loadingMachines
          ? const Center(child: CircularProgressIndicator())
          : error != null && machines.isEmpty
              ? ErrorBox(message: error!, onRetry: loadMachines)
              : RefreshIndicator(
                  onRefresh: loadSelectedMachine,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      _arViewer(),
                      const SizedBox(height: 12),
                      _machineSelector(),
                      const SizedBox(height: 10),
                      _connectionStatus(),
                      if (error != null) ...[
                        const SizedBox(height: 8),
                        ErrorBox(
                          message: error!,
                          onRetry: loadSelectedMachine,
                        ),
                      ],
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Composants de mesure',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          if (loadingData)
                            const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Ces trois voies correspondent aux champs de télémétrie de la machine sélectionnée; aucun capteur individuel n’est enregistré dans la base.',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      if (machines.isEmpty)
                        const EmptyState(
                          title: 'Aucune machine accessible',
                          message:
                              'Les composants apparaîtront après association d’une machine à votre compte.',
                          icon: Icons.precision_manufacturing_outlined,
                        )
                      else
                        for (final sensor in _sensors)
                          _sensorCard(sensor.$1, sensor.$2, sensor.$3),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _showWiringGuide,
                        icon: const Icon(Icons.account_tree_outlined),
                        label: const Text('Guide de câblage'),
                      ),
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        onPressed: () => context.go('/'),
                        icon: const Icon(Icons.home_outlined),
                        label: const Text('Retour à PrédiMaint'),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _arViewer() {
    return Container(
      height: 280,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [brandNavy, Color(0xFF2D3558)],
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -24,
            top: -34,
            child: Icon(
              Icons.view_in_ar_rounded,
              size: 190,
              color: Colors.white.withValues(alpha: .07),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.view_in_ar_rounded,
                        color: Color(0xFFB7C9FF), size: 18),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Text(
                        'ESPACE DE VISUALISATION AR',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: .8),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: .7,
                        ),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                const Text(
                  'Module Unity non disponible',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'La caméra et la superposition 3D seront activées après ajout et compilation du runtime Unity/ARCore et des modèles vérifiés.',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: .75),
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.camera_alt_outlined),
                        label: const Text('Démarrer la caméra'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      onPressed: null,
                      tooltip: 'Scanner les marqueurs',
                      icon: const Icon(Icons.qr_code_scanner_rounded),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _machineSelector() {
    if (machines.isEmpty) return const SizedBox.shrink();
    return DropdownButtonFormField<String>(
      key: ValueKey(machineId),
      initialValue: machineId,
      isExpanded: true,
      decoration: const InputDecoration(
        labelText: 'Machine associée',
        prefixIcon: Icon(Icons.precision_manufacturing_outlined),
      ),
      items: [
        for (final raw in machines)
          DropdownMenuItem(
            value: _id((raw as Map)['_id']),
            child: Text(
              '${raw['name'] ?? 'Machine'} · ${raw['code'] ?? ''}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
      ],
      onChanged: (value) {
        if (value == null) return;
        setState(() {
          machineId = value;
          machine = null;
          measurements = [];
          alerts = [];
          error = null;
        });
        loadSelectedMachine();
      },
    );
  }

  Widget _connectionStatus() {
    final device = machine?['deviceId'];
    final deviceStatus =
        device is Map ? device['status']?.toString() : 'offline';
    final deviceOnline = deviceStatus == 'online';
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: [
        _infoChip(
          icon:
              deviceOnline ? Icons.sensors_rounded : Icons.sensors_off_rounded,
          label: deviceOnline ? 'Appareil en ligne' : 'Appareil hors ligne',
          color:
              deviceOnline ? const Color(0xFF15803D) : const Color(0xFF667085),
        ),
        _infoChip(
          icon: socketConnected ? Icons.bolt_rounded : Icons.sync_disabled,
          label: socketConnected
              ? 'Flux temps réel actif'
              : 'Flux temps réel déconnecté',
          color: socketConnected
              ? const Color(0xFF15803D)
              : const Color(0xFF667085),
        ),
      ],
    );
  }

  Widget _infoChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sensorCard(String parameter, String label, IconData icon) {
    final latest = measurements.isEmpty ? null : measurements.first as Map;
    final metric = latest?[parameter];
    final value = metric is Map ? metric['value'] : null;
    final rawUnit = metric is Map ? metric['unit']?.toString() : null;
    final unit = rawUnit == 'C' ? '°C' : rawUnit;
    final measuredAt =
        DateTime.tryParse(latest?['measuredAt']?.toString() ?? '');
    final metricHealth = machine?['metricHealth'];
    final rawHealth =
        metricHealth is Map ? metricHealth[parameter]?.toString() : null;
    final activeAlert = _activeAlert(parameter);
    final status = _sensorStatus(rawHealth, activeAlert);
    final color = _statusColor(status);
    final expanded = selectedSensor == parameter;
    final history = measurements
        .where((raw) => (raw as Map)[parameter] is Map)
        .take(6)
        .toList();

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: activeAlert == null
              ? const Color(0xFFE9ECF3)
              : const Color(0xFFDC2626),
          width: activeAlert == null ? 1 : 1.5,
        ),
      ),
      child: InkWell(
        onTap: () => setState(
          () => selectedSensor = expanded ? null : parameter,
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 19,
                    backgroundColor: color.withValues(alpha: .1),
                    child: Icon(icon, color: color, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        Text(
                          '${_modelName(parameter)} · $_machineName',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(status: status),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Text(
                      value is num
                          ? '${_formatValue(value)} ${unit ?? ''}'
                          : '—',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: color,
                                fontSize: 25,
                              ),
                    ),
                  ),
                  if (measuredAt != null)
                    Text(
                      DateFormat('dd/MM · HH:mm').format(measuredAt.toLocal()),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
              if (parameter == 'temperature' && latest?['humidity'] is Map)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    'Humidité · DHT22 : ${_formatValue((latest!['humidity'] as Map)['value'])} ${(latest['humidity'] as Map)['unit'] ?? '%'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              const SizedBox(height: 5),
              Text(
                _thresholdSummary(machine?['thresholds'], parameter),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (activeAlert != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    activeAlert['description']?.toString() ??
                        'Alerte ${labelStatus(activeAlert['severity']?.toString())} active',
                    style: const TextStyle(
                      color: Color(0xFFB42318),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
              if (expanded) ...[
                const Divider(height: 22),
                Text('Historique récent',
                    style: Theme.of(context).textTheme.titleSmall),
                if (history.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      'Aucune mesure historique disponible.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  )
                else
                  for (final raw in history) _historyRow(raw as Map, parameter),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _historyRow(Map measurement, String parameter) {
    final metric = measurement[parameter];
    final timestamp =
        DateTime.tryParse(measurement['measuredAt']?.toString() ?? '');
    return Padding(
      padding: const EdgeInsets.only(top: 7),
      child: Row(
        children: [
          const Icon(Icons.history_rounded, size: 15, color: Color(0xFF667085)),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              timestamp == null
                  ? 'Date inconnue'
                  : DateFormat('dd/MM/yyyy · HH:mm')
                      .format(timestamp.toLocal()),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                metric is Map
                    ? '${_formatValue(metric['value'])} ${metric['unit'] ?? ''}'
                    : '—',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (parameter == 'temperature' && measurement['humidity'] is Map)
                Text(
                  'Humidité ${_formatValue((measurement['humidity'] as Map)['value'])} ${(measurement['humidity'] as Map)['unit'] ?? '%'}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
        ],
      ),
    );
  }

  String _modelName(String parameter) {
    switch (parameter) {
      case 'temperature':
        return 'DHT22';
      case 'vibration':
        return 'SW-420';
      case 'current':
        return 'ACS712';
      default:
        return 'Capteur';
    }
  }

  Map? _activeAlert(String parameter) {
    for (final raw in alerts) {
      final alert = raw as Map;
      if (alert['parameter'] == parameter &&
          {'new', 'acknowledged', 'in_progress'}
              .contains(alert['status']?.toString())) {
        return alert;
      }
    }
    return null;
  }

  String _sensorStatus(String? health, Map? activeAlert) {
    final device = machine?['deviceId'];
    if (device is Map && device['status'] == 'offline') return 'offline';
    if (activeAlert != null) {
      return activeAlert['severity']?.toString() == 'critical'
          ? 'critical'
          : 'warning';
    }
    return health ?? 'unknown';
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'normal':
      case 'resolved':
        return const Color(0xFF16A34A);
      case 'warning':
      case 'acknowledged':
      case 'in_progress':
        return const Color(0xFFD97706);
      case 'critical':
      case 'sensor_error':
        return const Color(0xFFDC2626);
      case 'offline':
        return const Color(0xFF667085);
      default:
        return const Color(0xFF98A2B3);
    }
  }

  String _thresholdSummary(dynamic thresholds, String parameter) {
    if (thresholds is! Map || thresholds[parameter] is! Map) {
      return 'Seuil non configuré';
    }
    final threshold = thresholds[parameter] as Map;
    final unit = threshold['unit']?.toString() ?? '';
    final warningMin = threshold['warningMin'];
    final warningMax = threshold['warningMax'];
    final criticalMin = threshold['criticalMin'];
    final criticalMax = threshold['criticalMax'];
    final parts = <String>[];
    if (warningMin is num) {
      parts.add('attention ≥ ${_formatValue(warningMin)}');
    }
    if (warningMax is num) {
      parts.add('attention ≤ ${_formatValue(warningMax)}');
    }
    if (criticalMin is num) {
      parts.add('critique ≥ ${_formatValue(criticalMin)}');
    }
    if (criticalMax is num) {
      parts.add('critique ≤ ${_formatValue(criticalMax)}');
    }
    return parts.isEmpty
        ? 'Seuils non renseignés'
        : 'Seuils (${unit.isEmpty ? 'unité non précisée' : unit}) : ${parts.join(' · ')}';
  }

  String get _machineName =>
      machine?['name']?.toString() ?? 'Machine non chargée';

  String _id(dynamic value) {
    if (value is Map) return value['_id']?.toString() ?? '';
    return value?.toString() ?? '';
  }

  String _formatValue(dynamic value) {
    if (value is! num) return value?.toString() ?? '—';
    return value.toStringAsFixed(value % 1 == 0 ? 0 : 1);
  }

  Future<void> _showWiringGuide() {
    return showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Guide de câblage',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text(
              'Broches de signal configurées dans le firmware : DHT22 DATA → GPIO 4; SW-420 DO → GPIO 27; ACS712 OUT → GPIO 34.',
            ),
            const SizedBox(height: 10),
            const Text(
              'Ces broches décrivent la configuration logicielle, pas une validation du montage physique. Les références exactes, l’alimentation et les tensions des modules doivent être vérifiées avant tout branchement.',
              style: TextStyle(
                color: Color(0xFFB42318),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
