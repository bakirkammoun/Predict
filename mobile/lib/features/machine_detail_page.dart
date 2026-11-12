import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/app_theme.dart';
import '../core/helpers.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/industrial_image_tile.dart';

class MachineDetailPage extends StatefulWidget {
  const MachineDetailPage({super.key, required this.api, required this.id});
  final ApiClient api;
  final String id;

  @override
  State<MachineDetailPage> createState() => _MachineDetailPageState();
}

class _MachineDetailPageState extends State<MachineDetailPage> {
  Map? machine;
  List measurements = [];
  List interventions = [];
  int selectedTab = 0;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.get('/machines/${widget.id}'),
        widget.api.get('/machines/${widget.id}/measurements', {'limit': 40}),
        widget.api.get('/interventions', {
          'machineId': widget.id,
          'limit': 50,
        }),
      ]);
      setState(() {
        machine = results[0] as Map;
        measurements = (results[1] as List).reversed.toList();
        interventions = results[2] as List;
      });
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String get vibrationUnit {
    if (measurements.isEmpty) return 'g';
    final vibration = (measurements.first as Map)['vibration'];
    return vibration is Map ? vibration['unit']?.toString() ?? 'g' : 'g';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Détail équipement'),
        actions: [
          IconButton(
            onPressed: load,
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? ErrorBox(message: error!, onRetry: load)
              : Column(
                  children: [
                    _machineHeader(),
                    _tabs(),
                    Expanded(
                      child: IndexedStack(
                        index: selectedTab,
                        children: [
                          _overviewTab(),
                          _analyticsTab(),
                          _maintenanceTab(),
                          _historyTab(),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _machineHeader() {
    final risk = machine?['heuristicRisk'];
    return Card(
      margin: const EdgeInsets.fromLTRB(14, 4, 14, 6),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const IndustrialImageTile(
              asset: 'assets/images/factory-automation.jpg',
              icon: Icons.precision_manufacturing_rounded,
              width: 60,
              height: 60,
              radius: 16,
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    machine?['name']?.toString() ?? 'Machine',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: brandInk,
                    ),
                  ),
                  Text(
                    '${machine?['type'] ?? 'Équipement'} · ${machine?['location'] ?? 'Lieu non renseigné'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 5),
                  StatusBadge(status: machine?['healthStatus']?.toString()),
                ],
              ),
            ),
            if (risk is num)
              Column(
                children: [
                  Text(
                    '${risk.round()}',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: brandInk,
                    ),
                  ),
                  const Text(
                    'Risque / 100',
                    style: TextStyle(fontSize: 8, color: Color(0xFF758099)),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Widget _tabs() {
    const labels = ['Aperçu', 'Analyses', 'Maintenance', 'Historique'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: InkWell(
                onTap: () => setState(() => selectedTab = i),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color:
                            selectedTab == i ? brandBlue : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    labels[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight:
                          selectedTab == i ? FontWeight.w700 : FontWeight.w500,
                      color: selectedTab == i
                          ? brandBlue
                          : const Color(0xFF747E94),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _overviewTab() {
    final risk = machine?['heuristicRisk']?.toString() ?? '—';
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 20),
      children: [
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: brandNavy,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const Icon(Icons.memory_rounded, color: Colors.white, size: 21),
              const SizedBox(width: 11),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Indicateur de maintenance',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Évaluation heuristique basée sur les seuils configurés.',
                      style: TextStyle(
                        color: Color(0xFFCAD2E6),
                        fontSize: 9,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$risk/100',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('État de l’équipement',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 8),
                _infoRow(
                    'État', labelStatus(machine?['healthStatus']?.toString())),
                _infoRow('Code', machine?['code']?.toString() ?? '—'),
                _infoRow('Dernière communication',
                    _lastCommunication(machine?['lastCommunicationAt'])),
                _infoRow(
                  'Dernière mesure',
                  measurements.isEmpty
                      ? 'Aucune mesure enregistrée'
                      : _relativeDate((measurements.last as Map)['measuredAt']),
                ),
                _infoRow('En service depuis',
                    _formatDate(machine?['commissionedAt'])),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: () => context.go('/interventions'),
          icon: const Icon(Icons.calendar_month_rounded, size: 17),
          label: const Text('Planifier une maintenance'),
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(44),
          ),
        ),
        const SizedBox(height: 5),
        TextButton.icon(
          onPressed: () => setState(() => selectedTab = 1),
          icon: const Icon(Icons.analytics_outlined, size: 16),
          label: const Text('Voir les analyses'),
        ),
      ],
    );
  }

  Widget _analyticsTab() => ListView(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 20),
        children: [
          _chart(
            'Température (°C)',
            (r) => ((r['temperature'] as Map)['value'] as num).toDouble(),
          ),
          _chart(
            'Vibration ($vibrationUnit)',
            (r) => ((r['vibration'] as Map)['value'] as num).toDouble(),
          ),
          _chart(
            'Courant (A)',
            (r) => ((r['current'] as Map)['value'] as num).toDouble(),
          ),
        ],
      );

  Widget _maintenanceTab() {
    final pending = interventions.where((raw) {
      final status = (raw as Map)['status'];
      return status != 'completed' && status != 'cancelled';
    }).toList();
    if (pending.isEmpty) {
      return const Center(
        child: Text('Aucune maintenance planifiée pour cet équipement.'),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 20),
      children: [
        for (final raw in pending)
          Card(
            child: ListTile(
              leading:
                  const Icon(Icons.build_circle_outlined, color: brandBlue),
              title: Text(
                (raw as Map)['reference']?.toString() ?? 'Intervention',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                '${labelStatus(raw['status']?.toString())} · ${_formatDate(raw['scheduledAt'])}',
              ),
              trailing: StatusBadge(status: raw['priority']?.toString()),
              onTap: () => context.go('/interventions/${raw['_id']}'),
            ),
          ),
      ],
    );
  }

  Widget _historyTab() {
    if (measurements.isEmpty) {
      return const Center(child: Text('Aucune mesure enregistrée.'));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 20),
      children: [
        for (final raw in measurements.reversed.take(20))
          _measurementHistoryCard(raw as Map),
      ],
    );
  }

  Widget _measurementHistoryCard(Map row) => Card(
        child: ListTile(
          leading: const Icon(Icons.sensors_outlined, color: brandBlue),
          title: Text(
            'V ${row['vibration']['value']} ${row['vibration']['unit'] ?? 'g'} · '
            'T ${row['temperature']['value']} °C · I ${row['current']['value']} A',
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            '${_formatDate(row['measuredAt'])} · ${labelStatus(row['source']?.toString())}',
          ),
        ),
      );

  Widget _infoRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          children: [
            Expanded(
              child: Text(label,
                  style:
                      const TextStyle(color: Color(0xFF707A90), fontSize: 10)),
            ),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: const TextStyle(
                  color: brandInk,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _chart(String title, double Function(Map) pick) {
    final values = measurements
        .map((measurement) => pick(measurement as Map))
        .where((value) => value.isFinite)
        .toList();
    final latest = values.isEmpty ? null : values.last;
    return Card(
      child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (latest != null)
                Text(
                  'Dernière valeur  ${latest.toStringAsFixed(2)}',
                  style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w700),
                ),
              if (measurements.isEmpty)
                const Padding(
                    padding: EdgeInsets.all(12),
                    child: Text('Pas encore de série'))
              else
                SizedBox(
                  height: 140,
                  child: LineChart(LineChartData(
                    titlesData: const FlTitlesData(show: false),
                    lineBarsData: [
                      LineChartBarData(
                        spots: [
                          for (var i = 0; i < measurements.length; i++)
                            FlSpot(i.toDouble(), pick(measurements[i] as Map)),
                        ],
                        color: brandBlue,
                        dotData: const FlDotData(show: false),
                      ),
                    ],
                  )),
                ),
            ],
          )),
    );
  }

  String _lastCommunication(dynamic raw) {
    if (raw == null) return 'Aucune communication enregistrée';
    return 'Dernière communication : ${_relativeDate(raw)}';
  }

  String _relativeDate(dynamic raw) {
    final date = DateTime.tryParse(raw?.toString() ?? '')?.toLocal();
    if (date == null) return raw?.toString() ?? 'Date inconnue';
    final elapsed = DateTime.now().difference(date);
    if (elapsed.isNegative) return _formatDate(raw);
    if (elapsed.inMinutes < 1) return 'à l’instant';
    if (elapsed.inHours < 1) return 'il y a ${elapsed.inMinutes} min';
    if (elapsed.inDays < 1) return 'il y a ${elapsed.inHours} h';
    return 'le ${_formatDate(raw)}';
  }

  String _formatDate(dynamic raw) {
    final date = DateTime.tryParse(raw?.toString() ?? '');
    if (date == null) return raw?.toString() ?? 'Date inconnue';
    return DateFormat('dd/MM/yyyy à HH:mm').format(date.toLocal());
  }
}
