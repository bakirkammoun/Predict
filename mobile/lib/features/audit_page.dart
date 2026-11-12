import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/brand_title.dart';

class AuditPage extends StatefulWidget {
  const AuditPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<AuditPage> createState() => _AuditPageState();
}

class _AuditPageState extends State<AuditPage> {
  List events = [];
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
      final result = await widget.api.get('/audit', {'limit': 50});
      setState(() => events = result as List);
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Journal des événements'),
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
                  child: events.isEmpty
                      ? ListView(
                          children: [
                            EmptyState(
                              title: 'Aucun événement enregistré',
                              message:
                                  'Les opérations administratives apparaîtront ici.',
                              icon: Icons.history_rounded,
                            ),
                          ],
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                          itemCount: events.length,
                          itemBuilder: (context, index) =>
                              _eventCard(events[index] as Map),
                        ),
                ),
    );
  }

  Widget _eventCard(Map event) {
    final metadata = event['metadata'];
    final actorName = event['actorEmail']?.toString() ?? 'system';
    final detail = metadata is Map && metadata.isNotEmpty
        ? metadata.entries
            .map((entry) => '${entry.key}: ${entry.value}')
            .join(' · ')
        : null;
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: .09),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Icon(Icons.history_rounded,
              color: Theme.of(context).colorScheme.primary),
        ),
        title: Text(event['action']?.toString() ?? 'Événement',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            [
              '${labelStatus(event['resource']?.toString())} · $actorName',
              if (detail != null) detail,
              _formatDate(event['createdAt']),
            ].join('\n'),
          ),
        ),
        isThreeLine: detail != null,
      ),
    );
  }

  String _formatDate(dynamic raw) {
    final date = DateTime.tryParse(raw?.toString() ?? '');
    if (date == null) return 'Date inconnue';
    return DateFormat('dd/MM/yyyy à HH:mm').format(date.toLocal());
  }
}
