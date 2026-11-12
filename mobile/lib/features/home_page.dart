import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:go_router/go_router.dart';
import '../core/api_client.dart';
import '../core/app_theme.dart';
import '../core/helpers.dart';
import '../widgets/dashboard_metric_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/industrial_banner.dart';

class TechnicianDashboard extends StatefulWidget {
  const TechnicianDashboard({super.key, required this.api});
  final ApiClient api;

  @override
  State<TechnicianDashboard> createState() => _TechnicianDashboardState();
}

class _TechnicianDashboardState extends State<TechnicianDashboard> {
  Map? data;
  List assignedInterventions = [];
  List adminDevices = [];
  List adminEvents = [];
  String? error;
  bool loading = true;
  int unreadNotifications = 0;

  String get role =>
      widget.api.session.user?['role']?.toString() ?? 'technician';
  RoleStyle get style => RoleStyle.forRole(role);

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
      final requests = <Future<dynamic>>[
        widget.api.get('/dashboard/summary'),
        widget.api.get('/notifications'),
        widget.api.get('/interventions', {'limit': 100}),
      ];
      if (role == 'admin') {
        requests
          ..add(widget.api.get('/devices'))
          ..add(widget.api.get('/audit', {'limit': 5}));
      }
      final results = await Future.wait(requests);
      final notifications = results[1] as List;
      final unread =
          notifications.where((item) => (item as Map)['readAt'] == null).length;
      setState(() {
        data = results[0] as Map;
        unreadNotifications = unread;
        assignedInterventions = results[2] as List;
        if (role == 'admin') {
          adminDevices = results[3] as List;
          adminEvents = results[4] as List;
        }
      });
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.api.session.user;
    final firstName = user?['firstName']?.toString();
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: style.tint,
              child: Icon(Icons.person_rounded, color: style.accent, size: 22),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Bonjour${firstName == null || firstName.isEmpty ? '' : ', $firstName'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: brandInk,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    style.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF7C8496),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.go('/notifications'),
            tooltip: 'Notifications',
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.notifications_none_rounded),
                if (unreadNotifications > 0)
                  Positioned(
                    top: -6,
                    right: -7,
                    child: Container(
                      constraints:
                          const BoxConstraints(minWidth: 18, minHeight: 18),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        unreadNotifications > 99
                            ? '99+'
                            : '$unreadNotifications',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
          ),
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
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    children: [
                      IndustrialBanner(
                        title: 'Une vision claire de vos équipements.',
                        subtitle:
                            'Alertes, mesures et interventions réunies au même endroit.',
                        actionLabel: 'Explorer le parc',
                        onAction: () => context.go('/machines'),
                      ),
                      const SizedBox(height: 16),
                      _healthCard(),
                      const SizedBox(height: 16),
                      _metrics(),
                      const SizedBox(height: 22),
                      _sectionHeading(
                        'Maintenance à prévoir',
                        actionLabel: 'Voir tout',
                        onAction: () => context.go('/interventions'),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          'Équipements nécessitant une intervention',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      const SizedBox(height: 6),
                      _maintenanceTasks(),
                      const SizedBox(height: 18),
                      _sectionHeading(
                        'Alertes récentes',
                        actionLabel: 'Tout voir',
                        onAction: () => context.go('/alerts'),
                      ),
                      const SizedBox(height: 6),
                      _recentAlerts(),
                      const SizedBox(height: 18),
                      _sectionHeading('Tendance des vibrations'),
                      const SizedBox(height: 6),
                      _vibrationTrend(),
                      const SizedBox(height: 18),
                      _sectionHeading(
                        'Dernières mesures',
                        actionLabel: 'Équipements',
                        onAction: () => context.go('/machines'),
                      ),
                      const SizedBox(height: 6),
                      _latestMeasurements(),
                      if (role == 'admin') ...[
                        const SizedBox(height: 18),
                        _sectionHeading('Équipements IoT'),
                        const SizedBox(height: 6),
                        _adminDevices(),
                        const SizedBox(height: 18),
                        _sectionHeading('Événements système récents'),
                        const SizedBox(height: 6),
                        _adminEvents(),
                      ],
                      const SizedBox(height: 20),
                      Text(
                        data?['dataOrigin']?.toString() ?? '',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _healthCard() {
    final counts = data?['counts'] as Map? ?? {};
    final availability = ((data?['availability'] as num?) ?? 0).toDouble();
    final percentage = (availability * 100).round().clamp(0, 100);
    final healthy = ((counts['normal'] as num?)?.toInt() ?? 0) +
        ((counts['warning'] as num?)?.toInt() ?? 0);
    final total = (counts['total'] as num?)?.toInt() ?? 0;
    final trend = data?['trend'] as List? ?? [];
    final spots = <FlSpot>[];
    for (var i = 0; i < trend.length; i++) {
      final item = trend[i];
      if (item is Map && item['vibration'] is num) {
        spots.add(FlSpot(i.toDouble(), (item['vibration'] as num).toDouble()));
      }
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        color: brandNavy,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1C080D2B),
            blurRadius: 16,
            offset: Offset(0, 7),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 23,
                height: 23,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.monitor_heart_outlined,
                  color: Color(0xFFB7C9FF),
                  size: 14,
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Santé des équipements',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .94),
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'Tous les systèmes',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: .68),
                        fontSize: 8,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints:
                    const BoxConstraints.tightFor(width: 24, height: 24),
                onPressed: () => context.go('/machines'),
                icon: const Icon(Icons.chevron_right_rounded,
                    color: Color(0xFFB7C1D6), size: 17),
              ),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                width: 94,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$percentage%',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        height: 1.1,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -1.2,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$healthy / $total en bon état',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFB9C4D9),
                        fontSize: 9,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: SizedBox(
                  height: 66,
                  child: spots.length < 2
                      ? const Icon(
                          Icons.multiline_chart_rounded,
                          color: Color(0xFF5076F6),
                          size: 56,
                        )
                      : LineChart(
                          LineChartData(
                            titlesData: const FlTitlesData(show: false),
                            gridData: const FlGridData(show: false),
                            borderData: FlBorderData(show: false),
                            lineTouchData: const LineTouchData(enabled: false),
                            lineBarsData: [
                              LineChartBarData(
                                spots: spots,
                                color: const Color(0xFF4D7CFF),
                                barWidth: 2.2,
                                isCurved: true,
                                dotData: const FlDotData(show: false),
                                belowBarData: BarAreaData(
                                  show: true,
                                  color: const Color(0xFF4D7CFF)
                                      .withValues(alpha: .13),
                                ),
                              ),
                            ],
                          ),
                        ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          LayoutBuilder(
            builder: (context, constraints) => Stack(
              children: [
                Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: const Color(0xFF192248),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                Container(
                  width: constraints.maxWidth * percentage / 100,
                  height: 8,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF4167F5), Color(0xFF82B7FF)],
                    ),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                Positioned(
                  left: (constraints.maxWidth * percentage / 100 - 1)
                      .clamp(0, constraints.maxWidth - 2),
                  child: Container(
                    width: 2,
                    height: 8,
                    color: Colors.white.withValues(alpha: .9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeading(
    String title, {
    String? actionLabel,
    VoidCallback? onAction,
  }) =>
      Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ),
          if (actionLabel != null)
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 6),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                actionLabel,
                style: TextStyle(
                  color: style.accent,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
        ],
      );

  Widget _metrics() {
    final counts = data?['counts'] as Map? ?? {};
    final healthy = ((counts['normal'] as num?)?.toInt() ?? 0) +
        ((counts['warning'] as num?)?.toInt() ?? 0);
    final active = assignedInterventions.where((raw) {
      final status = (raw as Map)['status'];
      return status != 'completed' && status != 'cancelled';
    }).length;
    final tiles = [
      (
        label: 'Équipements',
        value: counts['total'],
        icon: Icons.precision_manufacturing_outlined,
        color: const Color(0xFF6A4FF5)
      ),
      (
        label: 'Sains',
        value: healthy,
        icon: Icons.check_circle_outline_rounded,
        color: const Color(0xFF16A34A)
      ),
      (
        label: 'Maintenance',
        value: active,
        icon: Icons.build_outlined,
        color: const Color(0xFFF59E0B)
      ),
      (
        label: 'Critiques',
        value: counts['critical'],
        icon: Icons.error_outline_rounded,
        color: const Color(0xFFEF4444)
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 7.0;
        final width = (constraints.maxWidth - gap * 3) / 4;
        return Row(
          children: [
            for (var i = 0; i < tiles.length; i++) ...[
              DashboardMetricCard(
                label: tiles[i].label,
                value: tiles[i].value,
                icon: tiles[i].icon,
                accent: tiles[i].color,
                tint: tiles[i].color.withValues(alpha: .09),
                width: width,
              ),
              if (i < tiles.length - 1) const SizedBox(width: gap),
            ],
          ],
        );
      },
    );
  }

  Widget _adminDevices() {
    if (adminDevices.isEmpty) {
      return const Card(
        child: EmptyState(
          title: 'Aucun équipement IoT',
          message: 'Les appareils enregistrés apparaîtront ici.',
          icon: Icons.sensors_off_outlined,
        ),
      );
    }
    return Column(
      children: [
        for (final raw in adminDevices.take(4)) _deviceCard(raw as Map),
      ],
    );
  }

  Widget _deviceCard(Map device) {
    final online = device['status'] == 'online';
    final color = online ? const Color(0xFF16A34A) : const Color(0xFF667085);
    final machine = device['machineId'];
    final machineName = machine is Map ? machine['name']?.toString() : null;
    return Card(
      child: ListTile(
        leading: Icon(
          online ? Icons.sensors_rounded : Icons.sensors_off_rounded,
          color: color,
        ),
        title: Text(
          device['name']?.toString() ??
              device['hardwareId']?.toString() ??
              'Équipement',
        ),
        subtitle: Text(machineName ?? 'Aucune machine associée'),
        trailing: StatusBadge(
          status: device['revoked'] == true
              ? 'revoked'
              : online
                  ? 'online'
                  : 'offline',
        ),
      ),
    );
  }

  Widget _adminEvents() {
    if (adminEvents.isEmpty) {
      return const Card(
        child: EmptyState(
          title: 'Aucun événement récent',
          message: 'Les actions système journalisées apparaîtront ici.',
          icon: Icons.history_rounded,
        ),
      );
    }
    return Column(
      children: [
        for (final raw in adminEvents.take(5)) _eventCard(raw as Map),
      ],
    );
  }

  Widget _eventCard(Map event) {
    final actor = event['actorId'];
    final actorName = actor is Map
        ? '${actor['firstName'] ?? ''} ${actor['lastName'] ?? ''}'.trim()
        : null;
    final actorEmail = event['actorEmail']?.toString();
    return Card(
      child: ListTile(
        leading: const Icon(Icons.history_rounded, color: Color(0xFF2563EB)),
        title: Text(event['action']?.toString() ?? 'Événement'),
        subtitle: Text(
          actorName?.isNotEmpty == true
              ? actorName!
              : actorEmail?.isNotEmpty == true
                  ? actorEmail!
                  : 'Action système',
        ),
      ),
    );
  }

  Widget _vibrationTrend() {
    final trend = data?['trend'] as List? ?? [];
    final points = <FlSpot>[];
    for (var i = 0; i < trend.length; i++) {
      final item = trend[i];
      if (item is Map && item['vibration'] is num) {
        points.add(FlSpot(i.toDouble(), (item['vibration'] as num).toDouble()));
      }
    }
    if (points.length < 2) {
      return const Card(
        child: EmptyState(
          title: 'Tendance indisponible',
          message:
              'Au moins deux mesures de vibration sont nécessaires pour afficher une évolution.',
          icon: Icons.show_chart_rounded,
        ),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Vibration moyenne',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 145,
              child: LineChart(
                LineChartData(
                  titlesData: const FlTitlesData(show: false),
                  gridData:
                      const FlGridData(show: true, drawVerticalLine: false),
                  borderData: FlBorderData(show: false),
                  lineBarsData: [
                    LineChartBarData(
                      spots: points,
                      color: const Color(0xFFD97706),
                      barWidth: 2.5,
                      isCurved: true,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        color: const Color(0xFFD97706).withValues(alpha: .1),
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

  Widget _maintenanceTasks() {
    final openInterventions = assignedInterventions.where((raw) {
      final status = (raw as Map)['status'];
      return status != 'completed' && status != 'cancelled';
    }).toList();
    if (openInterventions.isEmpty) {
      return const Card(
        child: EmptyState(
          title: 'Aucune intervention à suivre',
          message: 'Les interventions ouvertes apparaîtront ici.',
          icon: Icons.task_alt_rounded,
        ),
      );
    }
    return Column(
      children: [
        for (final raw in openInterventions.take(4)) _taskCard(raw as Map),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () => context.go('/interventions'),
            icon: const Icon(Icons.arrow_forward_rounded),
            label: const Text('Toutes les interventions'),
          ),
        ),
      ],
    );
  }

  Widget _taskCard(Map item) {
    final machine = item['machineId'];
    final scheduledAt =
        DateTime.tryParse(item['scheduledAt']?.toString() ?? '')?.toLocal();
    final priority = item['priority']?.toString();
    final priorityColor = priority == 'urgent' || priority == 'high'
        ? const Color(0xFFDC2626)
        : const Color(0xFFDC8A58);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => context.go('/interventions/${item['_id']}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F4F9),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(
                  machine is Map && machine['type'] == 'scanner'
                      ? Icons.medical_services_outlined
                      : Icons.precision_manufacturing_outlined,
                  color: const Color(0xFF60718F),
                  size: 25,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedName(item['machineId']).isEmpty
                          ? item['reference']?.toString() ?? 'Intervention'
                          : nestedName(item['machineId']),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: brandInk,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item['type']?.toString() ?? 'Maintenance',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 9,
                        color: Color(0xFF788197),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      scheduledAt == null
                          ? 'Date à planifier'
                          : 'Prévue le ${scheduledAt.day.toString().padLeft(2, '0')}/${scheduledAt.month.toString().padLeft(2, '0')}',
                      style: const TextStyle(
                        color: Color(0xFFD18049),
                        fontSize: 8,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: priorityColor.withValues(alpha: .09),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  labelStatus(priority),
                  style: TextStyle(
                    color: priorityColor,
                    fontSize: 8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _recentAlerts() {
    final alerts = data?['latestAlerts'] as List? ?? [];
    if (alerts.isEmpty) {
      return const Card(
        child: EmptyState(
          title: 'Aucune alerte récente',
          message: 'Les anomalies détectées seront listées ici.',
          icon: Icons.verified_outlined,
        ),
      );
    }
    return Column(
      children: [
        for (final raw in alerts.take(3)) _alertCard(raw as Map),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () => context.go('/alerts'),
            child: const Text('Toutes les alertes'),
          ),
        ),
      ],
    );
  }

  Widget _alertCard(Map alert) {
    final critical = alert['severity'] == 'critical';
    final color = critical ? const Color(0xFFDC2626) : const Color(0xFFD97706);
    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
              color: color.withValues(alpha: .09),
              borderRadius: BorderRadius.circular(13)),
          child: Icon(
              critical
                  ? Icons.error_outline_rounded
                  : Icons.warning_amber_rounded,
              color: color),
        ),
        title: Text(nestedName(alert['machineId']),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
            '${labelParameter(alert['parameter']?.toString())} · ${labelStatus(alert['severity']?.toString())}'),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => context.go('/alerts/${alert['_id']}'),
      ),
    );
  }

  Widget _latestMeasurements() {
    final measurements = data?['latestMeasurements'] as List? ?? [];
    if (measurements.isEmpty) {
      return const Card(
        child: EmptyState(
          title: 'Aucune mesure disponible',
          message: 'Les dernières mesures apparaîtront ici dès réception.',
          icon: Icons.sensors_outlined,
        ),
      );
    }
    return Column(
      children: [
        for (final raw in measurements.take(3)) _measurementCard(raw as Map),
      ],
    );
  }

  Widget _measurementCard(Map measurement) {
    String value(String key, String unit) {
      final metric = measurement[key];
      if (metric is! Map || metric['value'] == null) return '—';
      return '${metric['value']} $unit';
    }

    final vibration = measurement['vibration'];
    final vibrationUnit =
        vibration is Map ? vibration['unit']?.toString() ?? 'g' : 'g';

    return Card(
      child: ListTile(
        leading: const Icon(Icons.sensors_outlined, color: Color(0xFF2563EB)),
        title: Text(nestedName(measurement['machineId']),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
            'T ${value('temperature', '°C')}  ·  V ${value('vibration', vibrationUnit)}  ·  I ${value('current', 'A')}'),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () {
          final machineId = nestedId(measurement['machineId']);
          if (machineId.isNotEmpty) context.go('/machines/$machineId');
        },
      ),
    );
  }
}
