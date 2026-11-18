import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/brand_title.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/industrial_banner.dart';
import '../widgets/status_badge.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  List rows = [];
  String? error;
  bool loading = true;
  int periodDays = 7;

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
    final to = DateTime.now().toUtc();
    final from = to.subtract(Duration(days: periodDays));
    try {
      final result = await widget.api.get('/reports', {
        'from': from.toIso8601String(),
        'to': to.toIso8601String(),
      }) as Map;
      if (mounted) setState(() => rows = result['rows'] as List? ?? []);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final alertCount =
        rows.fold<int>(0, (sum, raw) => sum + _count((raw as Map)['alerts']));
    final interventionCount = rows.fold<int>(
        0, (sum, raw) => sum + _count((raw as Map)['interventions']));
    final activeRows = rows
        .where((raw) => (raw as Map)['operationalStatus'] == 'active')
        .toList();
    final availability = activeRows.isEmpty
        ? null
        : activeRows.fold<double>(
              0,
              (sum, raw) => sum + _number((raw as Map)['availability']),
            ) /
            activeRows.length;

    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Rapports'),
        actions: [
          IconButton(
            onPressed: load,
            tooltip: 'Actualiser',
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: loading && rows.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  const IndustrialBanner(
                    title: 'Le parc, en un coup d’œil.',
                    subtitle:
                        'Synthèse des alertes, interventions et disponibilité.',
                    image: 'assets/images/factory-automation.jpg',
                  ),
                  const SizedBox(height: 14),
                  _periodSelector(),
                  const SizedBox(height: 12),
                  if (error != null) ...[
                    ErrorBox(message: error!, onRetry: load),
                    const SizedBox(height: 8),
                  ],
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _summaryCard(
                        'Équipements',
                        '${rows.length}',
                        Icons.precision_manufacturing_outlined,
                        const Color(0xFF625DF5),
                      ),
                      _summaryCard(
                        'Alertes',
                        '$alertCount',
                        Icons.warning_amber_rounded,
                        const Color(0xFFE59B24),
                      ),
                      _summaryCard(
                        'Interventions',
                        '$interventionCount',
                        Icons.build_outlined,
                        const Color(0xFF328B84),
                      ),
                      _summaryCard(
                        'Disponibilité',
                        availability == null
                            ? '—'
                            : '${(availability * 100).round()}%',
                        Icons.speed_rounded,
                        const Color(0xFF2E9D68),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text('État par machine',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(
                    'Les compteurs couvrent la période sélectionnée.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  if (!loading && rows.isEmpty && error == null)
                    const EmptyState(
                      title: 'Aucune machine accessible',
                      message:
                          'Les données du parc apparaîtront ici lorsqu’elles seront disponibles.',
                      icon: Icons.analytics_outlined,
                    )
                  else
                    for (final raw in rows) _machineReportCard(raw as Map),
                  const SizedBox(height: 8),
                  Card(
                    color: const Color(0xFFFFFBEB),
                    child: Padding(
                      padding: const EdgeInsets.all(13),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.info_outline_rounded,
                              color: Color(0xFFB45309), size: 19),
                          const SizedBox(width: 9),
                          Expanded(
                            child: Text(
                              'Le score de risque est un indicateur heuristique fondé sur les seuils, et non une probabilité validée de panne.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _periodSelector() {
    return Wrap(
      spacing: 8,
      children: [
        for (final option in const [
          (1, '24 h'),
          (7, '7 jours'),
          (30, '30 jours')
        ])
          ChoiceChip(
            label: Text(option.$2),
            selected: periodDays == option.$1,
            onSelected: (_) {
              setState(() => periodDays = option.$1);
              load();
            },
          ),
      ],
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color accent) {
    return SizedBox(
      width: (MediaQuery.sizeOf(context).width - 40) / 2,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              CircleAvatar(
                radius: 19,
                backgroundColor: accent.withValues(alpha: .1),
                child: Icon(icon, color: accent, size: 20),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall),
                    Text(value, style: Theme.of(context).textTheme.titleMedium),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _machineReportCard(Map row) {
    final inactive = row['operationalStatus'] == 'inactive';
    final availability = inactive || row['availability'] == null
        ? null
        : _number(row['availability']).clamp(0, 1).toDouble();
    final risk = row['heuristicRisk'];
    final riskLabel = risk is num ? '${risk.round()} / 100' : '—';

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.go('/machines/${row['machineId']}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: .1),
                    child: Icon(Icons.precision_manufacturing_outlined,
                        color: Theme.of(context).colorScheme.primary, size: 19),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row['name']?.toString() ?? 'Machine',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          row['code']?.toString() ?? 'Sans code',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  StatusBadge(
                    status:
                        inactive ? 'inactive' : row['healthStatus']?.toString(),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _countLabel('Alertes', row['alerts']),
                  _countLabel('Interventions', row['interventions']),
                  _countLabel('Mesures', row['samples']),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Disponibilité',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  Text(
                    availability == null
                        ? '—'
                        : '${(availability * 100).round()}%',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF171B31),
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 5),
              LinearProgressIndicator(
                value: availability,
                minHeight: 6,
                borderRadius: BorderRadius.circular(8),
                backgroundColor: const Color(0xFFF0F2F7),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(Icons.insights_outlined,
                      size: 16, color: Color(0xFF667085)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Risque indicatif',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  const Spacer(),
                  Text(riskLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: const Color(0xFF171B31),
                            fontWeight: FontWeight.w700,
                          )),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _countLabel(String label, dynamic value) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${_count(value)}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(width: 4),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      );

  int _count(dynamic value) => value is num ? value.toInt() : 0;
  double _number(dynamic value) => value is num ? value.toDouble() : 0;
}
