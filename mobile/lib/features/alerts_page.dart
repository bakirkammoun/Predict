import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';
import '../widgets/industrial_image_tile.dart';

class AlertsPage extends StatefulWidget {
  const AlertsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<AlertsPage> createState() => _AlertsPageState();
}

class _AlertsPageState extends State<AlertsPage> {
  List items = [];
  String? error;
  bool loading = true;
  String selectedStatus = 'all';

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
      final d = await widget.api.get('/alerts', {
        'limit': 50,
        if (selectedStatus != 'all') 'status': selectedStatus,
      });
      if (mounted) setState(() => items = d as List);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Alertes'),
        actions: [
          IconButton(
              onPressed: load,
              tooltip: 'Actualiser',
              icon: const Icon(Icons.refresh_rounded)),
          const SizedBox(width: 4),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? ErrorBox(message: error!, onRetry: load)
              : RefreshIndicator(
                  onRefresh: load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(15),
                          child: Row(
                            children: [
                              Container(
                                width: 42,
                                height: 42,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(
                                  Icons.health_and_safety_outlined,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Centre des alertes',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium),
                                    const SizedBox(height: 3),
                                    Text(
                                      '${items.length} alerte${items.length == 1 ? '' : 's'} dans cette vue',
                                      style:
                                          Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                '${items.length}',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(
                                      color: const Color(0xFFB45309),
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      SizedBox(
                        height: 42,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            _statusFilter('Toutes', 'all'),
                            _statusFilter('Nouvelles', 'new'),
                            _statusFilter('Reconnues', 'acknowledged'),
                            _statusFilter('En cours', 'in_progress'),
                            _statusFilter('Résolues', 'resolved'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 28),
                          child: EmptyState(
                            title: 'Aucune alerte',
                            message: 'Aucune alerte ne correspond à ce filtre.',
                            icon: Icons.verified_outlined,
                          ),
                        )
                      else
                        for (final raw in items) _alertCard(raw as Map),
                    ],
                  ),
                ),
    );
  }

  Widget _statusFilter(String label, String status) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selectedStatus == status,
        onSelected: (_) {
          setState(() => selectedStatus = status);
          load();
        },
      ),
    );
  }

  Widget _alertCard(Map a) {
    final critical = a['severity'] == 'critical';
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        leading: IndustrialImageTile(
          asset: a['parameter'] == 'connectivity'
              ? 'assets/images/maintenance-technician.jpg'
              : 'assets/images/sensor-maintenance.jpg',
          icon: critical
              ? Icons.error_outline_rounded
              : Icons.warning_amber_rounded,
          width: 54,
          height: 54,
        ),
        title: Text(nestedName(a['machineId']),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(
              '${labelParameter(a['parameter']?.toString())} · ${a['observedValue'] ?? '—'} ${a['unit'] ?? ''}'),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            StatusBadge(status: a['severity']?.toString()),
            const SizedBox(height: 5),
            Text(labelStatus(a['status']?.toString()),
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        onTap: () => context.go('/alerts/${a['_id']}'),
      ),
    );
  }
}
