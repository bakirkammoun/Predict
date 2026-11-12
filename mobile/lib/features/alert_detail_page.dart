import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';

class AlertDetailPage extends StatefulWidget {
  const AlertDetailPage({super.key, required this.api, required this.id});
  final ApiClient api;
  final String id;

  @override
  State<AlertDetailPage> createState() => _AlertDetailPageState();
}

class _AlertDetailPageState extends State<AlertDetailPage> {
  Map? alert;
  String? error;
  bool loading = true;
  bool creatingIntervention = false;

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
      final d = await widget.api.get('/alerts/${widget.id}');
      setState(() => alert = d as Map);
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> setStatus(String status) async {
    if (status == 'resolved') {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Résoudre cette alerte ?'),
          content: const Text(
              'Confirmez que le traitement de cette anomalie est terminé.'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Annuler')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirmer')),
          ],
        ),
      );
      if (confirm != true) return;
    }
    try {
      await widget.api.patch('/alerts/${widget.id}/status', {'status': status});
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  Future<void> createIntervention() async {
    final machineId = nestedId(alert?['machineId']);
    if (machineId.isEmpty || alert == null) return;
    setState(() {
      creatingIntervention = true;
      error = null;
    });
    try {
      final response = await widget.api.post('/interventions', {
        'machineId': machineId,
        'alertId': alert?['_id'],
        'type': 'corrective',
        'problemDescription': alert?['description']?.toString() ??
            alert?['parameter']?.toString() ??
            'Anomalie détectée',
        'priority': alert?['severity'] == 'critical' ? 'urgent' : 'high',
      }) as Map;
      if (mounted) context.go('/interventions/${response['_id']}');
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => creatingIntervention = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const BrandTitle(title: 'Détail alerte')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && alert == null
              ? ErrorBox(message: error!, onRetry: load)
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(nestedName(alert?['machineId']),
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 8),
                            Text(alert?['description']?.toString() ?? ''),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                StatusBadge(
                                    status: alert?['severity']?.toString()),
                                StatusBadge(
                                    status: alert?['status']?.toString()),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Détectée le ${_formatDate(alert?['detectedAt'])}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const Divider(height: 24),
                            _detailRow(
                                'Paramètre',
                                labelParameter(
                                    alert?['parameter']?.toString())),
                            _detailRow('Valeur mesurée',
                                '${alert?['observedValue'] ?? '—'} ${alert?['unit'] ?? ''}'),
                            _detailRow('Seuil',
                                '${alert?['threshold'] ?? '—'} ${alert?['unit'] ?? ''}'),
                            _detailRow('Source',
                                labelStatus(alert?['source']?.toString())),
                            const SizedBox(height: 12),
                            const Text(
                                "Une anomalie n'est pas une panne certaine.",
                                style: TextStyle(color: Color(0xFF667085))),
                          ],
                        ),
                      ),
                    ),
                    if (error != null)
                      Text(error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    const SizedBox(height: 16),
                    if (alert?['status'] == 'new')
                      FilledButton(
                          onPressed: () => setStatus('acknowledged'),
                          child: const Text('Reconnaître')),
                    if (alert?['status'] != 'resolved')
                      OutlinedButton(
                          onPressed: () => setStatus('resolved'),
                          child: const Text('Marquer résolue')),
                    if (alert?['interventionId'] is Map)
                      OutlinedButton.icon(
                        onPressed: () {
                          final id = nestedId(alert?['interventionId']);
                          if (id.isNotEmpty) context.go('/interventions/$id');
                        },
                        icon: const Icon(Icons.build_outlined),
                        label: const Text('Voir l’intervention liée'),
                      )
                    else
                      FilledButton.icon(
                        onPressed:
                            creatingIntervention ? null : createIntervention,
                        icon: creatingIntervention
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.build_rounded),
                        label: Text(
                          creatingIntervention
                              ? 'Création en cours…'
                              : 'Créer une intervention',
                        ),
                      ),
                  ],
                ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 120,
              child:
                  Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }

  String _formatDate(dynamic raw) {
    final date = DateTime.tryParse(raw?.toString() ?? '');
    if (date == null) return raw?.toString() ?? 'Date inconnue';
    return DateFormat('dd/MM/yyyy à HH:mm').format(date.toLocal());
  }
}
