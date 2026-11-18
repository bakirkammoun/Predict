import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/brand_title.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/industrial_banner.dart';
import '../widgets/status_badge.dart';

class MeasurementsPage extends StatefulWidget {
  const MeasurementsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<MeasurementsPage> createState() => _MeasurementsPageState();
}

class _MeasurementsPageState extends State<MeasurementsPage> {
  List machines = [];
  List measurements = [];
  String? machineId;
  String? error;
  bool loadingMachines = true;
  bool loadingMeasurements = false;
  Timer? refreshTimer;

  @override
  void initState() {
    super.initState();
    loadMachines();
    refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => loadMeasurements(background: true),
    );
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> loadMachines() async {
    try {
      final result = await widget.api.get('/machines', {'limit': 100}) as List;
      if (!mounted) return;
      setState(() {
        machines = result;
        machineId =
            result.isEmpty ? null : (result.first as Map)['_id'].toString();
        error = null;
      });
      if (machineId != null) await loadMeasurements();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loadingMachines = false);
    }
  }

  Future<void> loadMeasurements({bool background = false}) async {
    final selectedId = machineId;
    if (selectedId == null || loadingMeasurements) return;
    setState(() {
      loadingMeasurements = true;
      if (!background) error = null;
    });
    try {
      final result = await widget.api.get(
        '/machines/$selectedId/measurements',
        {'limit': 50, 'page': 1},
      ) as List;
      if (mounted && selectedId == machineId) {
        setState(() {
          measurements = result;
          error = null;
        });
      }
    } catch (e) {
      if (mounted && selectedId == machineId) {
        setState(() => error = apiMessage(e));
      }
    } finally {
      if (mounted) {
        final selectionChanged = selectedId != machineId;
        setState(() => loadingMeasurements = false);
        if (selectionChanged) unawaited(loadMeasurements());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Mesures'),
        actions: [
          IconButton(
            onPressed: () => loadMeasurements(),
            tooltip: 'Actualiser',
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
                  onRefresh: loadMeasurements,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      const IndustrialBanner(
                        title: 'Données capteurs en direct.',
                        subtitle:
                            'Consultez les dernières mesures de vos équipements.',
                        image: 'assets/images/sensor-maintenance.jpg',
                      ),
                      const SizedBox(height: 14),
                      DropdownButtonFormField<String>(
                        key: ValueKey(machineId),
                        initialValue: machineId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Machine',
                          prefixIcon:
                              Icon(Icons.precision_manufacturing_outlined),
                        ),
                        items: [
                          for (final raw in machines)
                            DropdownMenuItem(
                              value: (raw as Map)['_id'].toString(),
                              child: Text(
                                '${raw['name'] ?? 'Machine'} · ${raw['code'] ?? ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          setState(() {
                            machineId = value;
                            measurements = [];
                          });
                          loadMeasurements();
                        },
                      ),
                      const SizedBox(height: 12),
                      if (error != null) ...[
                        ErrorBox(
                          message: error!,
                          onRetry: () => loadMeasurements(),
                        ),
                        const SizedBox(height: 8),
                      ],
                      if (machines.isEmpty)
                        const EmptyState(
                          title: 'Aucune machine accessible',
                          message:
                              'Les machines accessibles à votre compte apparaîtront ici.',
                          icon: Icons.precision_manufacturing_outlined,
                        )
                      else if (loadingMeasurements && measurements.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 36),
                          child: Center(child: CircularProgressIndicator()),
                        )
                      else if (measurements.isEmpty)
                        const EmptyState(
                          title: 'Aucune mesure disponible',
                          message:
                              'Démarrez le simulateur ou connectez un ESP32 pour recevoir des données.',
                          icon: Icons.sensors_outlined,
                        )
                      else ...[
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                'Mesures récentes',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                            ),
                            Text(
                              'Actualisation · 5 s',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        for (final raw in measurements)
                          _measurementCard(raw as Map),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _measurementCard(Map measurement) {
    final measuredAt = DateTime.tryParse(
      measurement['measuredAt']?.toString() ?? '',
    );
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 5),
      child: Padding(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    measuredAt == null
                        ? 'Date inconnue'
                        : DateFormat('dd/MM/yyyy · HH:mm')
                            .format(measuredAt.toLocal()),
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                StatusBadge(
                  status: measurement['validationStatus']?.toString() ??
                      measurement['source']?.toString(),
                ),
              ],
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 2.0,
              children: [
                _reading('Vibration', measurement['vibration'], 'g',
                    Icons.vibration_rounded),
                _reading('Température', measurement['temperature'], '°C',
                    Icons.thermostat_rounded),
                _reading('Humidité', measurement['humidity'], '%',
                    Icons.water_drop_outlined),
                _reading('Courant', measurement['current'], 'A',
                    Icons.electric_bolt_outlined),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _reading(
      String label, dynamic raw, String fallbackUnit, IconData icon) {
    final reading = raw is Map ? raw : const {};
    final value = reading['value'];
    final unit = reading['unit']?.toString();
    final displayValue = value is num
        ? value.toStringAsFixed(value is int || value % 1 == 0 ? 0 : 1)
        : value?.toString() ?? '—';
    final displayUnit = unit == 'C' ? '°C' : (unit ?? fallbackUnit);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8FC),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall),
                Text(
                  '$displayValue $displayUnit',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF171B31),
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
