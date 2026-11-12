import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';
import '../widgets/industrial_image_tile.dart';

class MachinesPage extends StatefulWidget {
  const MachinesPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<MachinesPage> createState() => _MachinesPageState();
}

class _MachinesPageState extends State<MachinesPage> {
  List items = [];
  String? error;
  bool loading = true;
  final search = TextEditingController();
  String selectedStatus = 'all';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

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
      final d = await widget.api.get('/machines', {'limit': 100});
      if (mounted) setState(() => items = d as List);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = search.text.trim().toLowerCase();
    final visibleItems = items.where((raw) {
      final machine = raw as Map;
      final matchesSearch = query.isEmpty ||
          '${machine['name']} ${machine['code']} ${machine['location']}'
              .toLowerCase()
              .contains(query);
      final matchesStatus =
          selectedStatus == 'all' || machine['healthStatus'] == selectedStatus;
      return matchesSearch && matchesStatus;
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Machines'),
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
                      TextField(
                        controller: search,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search_rounded),
                          hintText:
                              'Rechercher une machine, un code ou un lieu',
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 42,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            _filterChip('Toutes', 'all'),
                            _filterChip('Normales', 'normal'),
                            _filterChip('Vigilance', 'warning'),
                            _filterChip('Critiques', 'critical'),
                            _filterChip('Hors ligne', 'offline'),
                            _filterChip('Capteur', 'sensor_error'),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (visibleItems.isEmpty)
                        EmptyState(
                          title: items.isEmpty
                              ? 'Aucune machine accessible'
                              : 'Aucun résultat',
                          message: items.isEmpty
                              ? 'Les machines accessibles à votre compte apparaîtront ici.'
                              : 'Modifiez la recherche ou le filtre pour continuer.',
                          icon: Icons.precision_manufacturing_outlined,
                        )
                      else ...[
                        Text('${visibleItems.length} machine(s)',
                            style: Theme.of(context).textTheme.bodySmall),
                        const SizedBox(height: 6),
                        for (final raw in visibleItems)
                          _machineCard(raw as Map),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = selectedStatus == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => selectedStatus = value),
      ),
    );
  }

  Widget _machineCard(Map machine) {
    final status = machine['healthStatus']?.toString();
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        leading: IndustrialImageTile(
          asset: 'assets/images/factory-automation.jpg',
          icon: Icons.precision_manufacturing_outlined,
          width: 54,
          height: 54,
        ),
        title: Text(machine['name']?.toString() ?? 'Machine',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(
            '${machine['code'] ?? '—'} · ${machine['location'] ?? 'Lieu non renseigné'}\n'
            'ESP32 : ${labelStatus((machine['deviceId'] as Map?)?['status']?.toString())}',
          ),
        ),
        isThreeLine: true,
        trailing: StatusBadge(status: status),
        onTap: () => context.go('/machines/${machine['_id']}'),
      ),
    );
  }
}
