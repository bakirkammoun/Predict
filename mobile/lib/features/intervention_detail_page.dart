import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';

class InterventionDetailPage extends StatefulWidget {
  const InterventionDetailPage(
      {super.key, required this.api, required this.id});
  final ApiClient api;
  final String id;

  @override
  State<InterventionDetailPage> createState() => _InterventionDetailPageState();
}

class _InterventionDetailPageState extends State<InterventionDetailPage> {
  Map? doc;
  String? error;
  bool loading = true;
  final diagnosis = TextEditingController();
  final actions = TextEditingController();
  final observations = TextEditingController();
  final parts = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    diagnosis.dispose();
    actions.dispose();
    observations.dispose();
    parts.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final d = await widget.api.get('/interventions/${widget.id}') as Map;
      diagnosis.text = d['diagnosis']?.toString() ?? '';
      actions.text = d['actions']?.toString() ?? '';
      observations.text = d['observations']?.toString() ?? '';
      final p = d['parts'];
      if (p is List) {
        parts.text = p.map((e) => '${e['name']}:${e['quantity']}').join(', ');
      }
      setState(() => doc = d);
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> patch(Map<String, dynamic> body) async {
    try {
      await widget.api.patch('/interventions/${widget.id}', body);
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = doc?['status']?.toString();
    return Scaffold(
      appBar: AppBar(
        title: BrandTitle(
          title: doc?['reference']?.toString() ?? 'Intervention',
        ),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && doc == null
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
                            Text(nestedName(doc?['machineId']),
                                style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 8),
                            Text(doc?['problemDescription']?.toString() ?? ''),
                            const Divider(height: 24),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                StatusBadge(status: status),
                                StatusBadge(
                                    status: doc?['priority']?.toString()),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                                'Prévue : ${_formatDate(doc?['scheduledAt'])}'),
                            if (doc?['assignedTechnicianId'] is Map)
                              Text(
                                'Technicien : ${doc?['assignedTechnicianId']['firstName'] ?? ''} ${doc?['assignedTechnicianId']['lastName'] ?? ''}',
                              ),
                          ],
                        ),
                      ),
                    ),
                    if (error != null)
                      Text(error!,
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    const SizedBox(height: 12),
                    if (status == 'todo' || status == 'planned')
                      FilledButton(
                          onPressed: () => patch({'status': 'in_progress'}),
                          child: const Text('Démarrer')),
                    if (status == 'in_progress') ...[
                      OutlinedButton(
                          onPressed: () => patch({'status': 'on_hold'}),
                          child: const Text('Mettre en attente')),
                      const SizedBox(height: 8),
                    ],
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Compte rendu',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 14),
                            TextField(
                                controller: diagnosis,
                                maxLines: 3,
                                decoration: const InputDecoration(
                                    labelText: 'Diagnostic *')),
                            const SizedBox(height: 12),
                            TextField(
                                controller: actions,
                                maxLines: 3,
                                decoration: const InputDecoration(
                                    labelText: 'Actions réalisées')),
                            const SizedBox(height: 12),
                            TextField(
                                controller: observations,
                                maxLines: 3,
                                decoration: const InputDecoration(
                                    labelText: 'Observations')),
                            const SizedBox(height: 12),
                            TextField(
                              controller: parts,
                              decoration: const InputDecoration(
                                  labelText: 'Pièces (nom:qté, nom:qté)'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () => patch({
                        'diagnosis': diagnosis.text,
                        'actions': actions.text,
                        'observations': observations.text,
                        'parts': _parseParts(parts.text),
                      }),
                      child: const Text('Enregistrer le compte rendu'),
                    ),
                    if (status == 'in_progress')
                      FilledButton(
                        onPressed: () {
                          if (diagnosis.text.trim().isEmpty) {
                            setState(() => error =
                                'Renseignez le diagnostic avant de terminer l’intervention.');
                            return;
                          }
                          patch({
                            'status': 'completed',
                            'diagnosis': diagnosis.text,
                            'actions': actions.text,
                            'observations': observations.text,
                            'parts': _parseParts(parts.text),
                          });
                        },
                        child: const Text('Terminer'),
                      ),
                  ],
                ),
    );
  }

  List<Map<String, dynamic>> _parseParts(String raw) {
    return raw
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .map((s) {
      final bits = s.split(':');
      return {
        'name': bits.first.trim(),
        'quantity': int.tryParse(bits.length > 1 ? bits[1].trim() : '1') ?? 1,
      };
    }).toList();
  }

  String _formatDate(dynamic raw) {
    if (raw == null) return 'Non planifiée';
    final date = DateTime.tryParse(raw.toString());
    if (date == null) return raw.toString();
    return '${date.toLocal().day.toString().padLeft(2, '0')}/'
        '${date.toLocal().month.toString().padLeft(2, '0')}/'
        '${date.toLocal().year}';
  }
}
