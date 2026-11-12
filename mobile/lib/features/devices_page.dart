import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';

class DevicesPage extends StatefulWidget {
  const DevicesPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> {
  List devices = [];
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
      final result = await widget.api.get('/devices');
      setState(() => devices = result as List);
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _revoke(Map device) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Révoquer cet appareil ?'),
        content: const Text(
          'Cet ESP32 ne pourra plus transmettre de mesures. Cette action doit être confirmée.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Annuler')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Révoquer')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.api.post('/devices/${device['_id']}/revoke', {});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Appareil révoqué.')),
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Équipements IoT'),
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
          : error != null && devices.isEmpty
              ? ErrorBox(message: error!, onRetry: load)
              : RefreshIndicator(
                  onRefresh: load,
                  child: devices.isEmpty
                      ? ListView(
                          children: [
                            EmptyState(
                              title: 'Aucun appareil enregistré',
                              message:
                                  'Les ESP32 associés à vos machines apparaîtront ici.',
                              icon: Icons.sensors_off_outlined,
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                          children: [
                            if (error != null)
                              Padding(
                                padding: const EdgeInsets.all(8),
                                child: Text(error!,
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .error)),
                              ),
                            for (final raw in devices) _deviceCard(raw as Map),
                          ],
                        ),
                ),
    );
  }

  Widget _deviceCard(Map device) {
    final revoked = device['revoked'] == true;
    final online = device['status'] == 'online' && !revoked;
    final machine = device['machineId'];
    final machineName = machine is Map
        ? '${machine['name'] ?? ''} ${machine['code'] == null ? '' : '· ${machine['code']}'}'
            .trim()
        : 'Aucune machine associée';
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(
          children: [
            ListTile(
              leading: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: online
                      ? const Color(0xFFECFDF3)
                      : const Color(0xFFF2F4F7),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  online ? Icons.sensors_rounded : Icons.sensors_off_rounded,
                  color: online
                      ? const Color(0xFF15803D)
                      : const Color(0xFF667085),
                ),
              ),
              title: Text(device['name']?.toString() ?? 'ESP32',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(
                  '${device['hardwareId'] ?? 'Identifiant inconnu'}\n$machineName'),
              isThreeLine: true,
              trailing: StatusBadge(
                status: revoked
                    ? 'revoked'
                    : online
                        ? 'online'
                        : 'offline',
              ),
            ),
            if (!revoked)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _revoke(device),
                  icon: const Icon(Icons.block_rounded),
                  label: const Text('Révoquer l’appareil'),
                  style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
