import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'core/api_client.dart';
import 'core/app_theme.dart';
import 'core/session.dart';
import 'features/alert_detail_page.dart';
import 'features/alerts_page.dart';
import 'features/assistant_ar_page.dart';
import 'features/audit_page.dart';
import 'features/devices_page.dart';
import 'features/home_page.dart';
import 'features/intervention_detail_page.dart';
import 'features/interventions_page.dart';
import 'features/login_page.dart';
import 'features/machine_detail_page.dart';
import 'features/machines_page.dart';
import 'features/measurements_page.dart';
import 'features/notifications_page.dart';
import 'features/profile_page.dart';
import 'features/reports_page.dart';
import 'features/settings_page.dart';
import 'features/simulation_page.dart';
import 'features/users_page.dart';

void main() {
  runApp(const PrediMaintApp());
}

class PrediMaintApp extends StatefulWidget {
  const PrediMaintApp({super.key});

  @override
  State<PrediMaintApp> createState() => _PrediMaintAppState();
}

class _PrediMaintAppState extends State<PrediMaintApp> {
  final session = SessionStore();
  late final ApiClient api = ApiClient(session);
  late final GoRouter router = GoRouter(
    initialLocation: '/login',
    refreshListenable: session,
    redirect: (context, state) {
      final logged = session.token != null;
      final loggingIn = state.matchedLocation == '/login';
      if (!logged && !loggingIn) return '/login';
      if (logged && loggingIn) return '/';
      const adminOnlyRoutes = {
        '/users',
        '/devices',
        '/settings',
        '/audit',
      };
      if (logged &&
          adminOnlyRoutes.contains(state.matchedLocation) &&
          session.user?['role'] != 'admin') {
        return '/';
      }
      if (logged &&
          state.matchedLocation == '/reports' &&
          !{'admin', 'maintenance_manager'}
              .contains(session.user?['role']?.toString())) {
        return '/';
      }
      if (logged &&
          state.matchedLocation == '/simulation' &&
          !{'admin', 'maintenance_manager'}
              .contains(session.user?['role']?.toString())) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(
          path: '/login',
          builder: (_, __) => LoginPage(api: api, session: session)),
      ShellRoute(
        builder: (context, state, child) =>
            HomeShell(session: session, child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => TechnicianDashboard(api: api)),
          GoRoute(
              path: '/machines', builder: (_, __) => MachinesPage(api: api)),
          GoRoute(
            path: '/measurements',
            builder: (_, __) => MeasurementsPage(api: api),
          ),
          GoRoute(
            path: '/assistant-ar',
            builder: (_, __) => AssistantArPage(api: api),
          ),
          GoRoute(
            path: '/reports',
            builder: (_, __) => ReportsPage(api: api),
          ),
          GoRoute(
            path: '/machines/:id',
            builder: (_, s) =>
                MachineDetailPage(api: api, id: s.pathParameters['id']!),
          ),
          GoRoute(path: '/alerts', builder: (_, __) => AlertsPage(api: api)),
          GoRoute(
            path: '/alerts/:id',
            builder: (_, s) =>
                AlertDetailPage(api: api, id: s.pathParameters['id']!),
          ),
          GoRoute(
              path: '/interventions',
              builder: (_, __) => InterventionsPage(api: api)),
          GoRoute(
            path: '/interventions/:id',
            builder: (_, s) =>
                InterventionDetailPage(api: api, id: s.pathParameters['id']!),
          ),
          GoRoute(
              path: '/profile',
              builder: (_, __) => ProfilePage(api: api, session: session)),
          GoRoute(
              path: '/notifications',
              builder: (_, __) => NotificationsPage(api: api)),
          GoRoute(path: '/users', builder: (_, __) => UsersPage(api: api)),
          GoRoute(path: '/devices', builder: (_, __) => DevicesPage(api: api)),
          GoRoute(
              path: '/settings', builder: (_, __) => SettingsPage(api: api)),
          GoRoute(
              path: '/simulation',
              builder: (_, __) => SimulationPage(api: api)),
          GoRoute(path: '/audit', builder: (_, __) => AuditPage(api: api)),
        ],
      ),
    ],
  );

  @override
  void initState() {
    super.initState();
    session.restore(api);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: session,
      builder: (context, _) => MaterialApp.router(
        title: 'PrédiMaint',
        theme: buildAppTheme(session.user?['role']?.toString()),
        routerConfig: router,
      ),
    );
  }
}

class _NavigationItem {
  const _NavigationItem(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.child, required this.session});
  final Widget child;
  final SessionStore session;

  @override
  Widget build(BuildContext context) {
    final role = session.user?['role']?.toString();
    final loc = GoRouterState.of(context).uri.toString();
    final items = const <_NavigationItem>[
      _NavigationItem('Accueil', Icons.home_rounded, '/'),
      _NavigationItem(
          'Équipements', Icons.precision_manufacturing_outlined, '/machines'),
      _NavigationItem('Maintenance', Icons.build_outlined, '/interventions'),
      _NavigationItem('Alertes', Icons.inventory_2_outlined, '/alerts'),
    ];
    var selectedIndex = items.indexWhere(
        (item) => loc == item.path || loc.startsWith('${item.path}/'));
    final isMoreRoute = selectedIndex < 0;

    return Scaffold(
      body: child,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 6, 14, 8),
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE9ECF3)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x120B172A),
                  blurRadius: 16,
                  offset: Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: _BottomNavigationButton(
                    item: items[0],
                    selected: selectedIndex == 0,
                    onTap: () => context.go(items[0].path),
                  ),
                ),
                Expanded(
                  child: _BottomNavigationButton(
                    item: items[1],
                    selected: selectedIndex == 1,
                    onTap: () => context.go(items[1].path),
                  ),
                ),
                Expanded(
                  child: _QuickMenuButton(
                    selected: isMoreRoute,
                    onTap: () => _showMore(context, role),
                  ),
                ),
                Expanded(
                  child: _BottomNavigationButton(
                    item: items[2],
                    selected: selectedIndex == 2,
                    onTap: () => context.go(items[2].path),
                  ),
                ),
                Expanded(
                  child: _BottomNavigationButton(
                    item: items[3],
                    selected: selectedIndex == 3,
                    onTap: () => context.go(items[3].path),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showMore(BuildContext context, String? role) {
    final extraItems = role == 'admin'
        ? const [
            _NavigationItem('Machines', Icons.precision_manufacturing_outlined,
                '/machines'),
            _NavigationItem(
                'Interventions', Icons.build_outlined, '/interventions'),
            _NavigationItem(
                'Assistant AR', Icons.view_in_ar_rounded, '/assistant-ar'),
            _NavigationItem('Mesures', Icons.sensors_outlined, '/measurements'),
            _NavigationItem('Rapports', Icons.analytics_outlined, '/reports'),
            _NavigationItem(
                'Appareils IoT', Icons.sensors_outlined, '/devices'),
            _NavigationItem(
                'Utilisateurs', Icons.people_outline_rounded, '/users'),
            _NavigationItem('Alertes', Icons.warning_amber_rounded, '/alerts'),
            _NavigationItem('Notifications', Icons.notifications_outlined,
                '/notifications'),
            _NavigationItem(
                'Simulation', Icons.science_outlined, '/simulation'),
            _NavigationItem('Paramètres', Icons.tune_rounded, '/settings'),
            _NavigationItem('Journal d’audit', Icons.history_rounded, '/audit'),
            _NavigationItem(
                'Mon profil', Icons.person_outline_rounded, '/profile'),
          ]
        : role == 'maintenance_manager'
            ? const [
                _NavigationItem('Machines',
                    Icons.precision_manufacturing_outlined, '/machines'),
                _NavigationItem(
                    'Alertes', Icons.warning_amber_rounded, '/alerts'),
                _NavigationItem(
                    'Interventions', Icons.build_outlined, '/interventions'),
                _NavigationItem(
                    'Assistant AR', Icons.view_in_ar_rounded, '/assistant-ar'),
                _NavigationItem(
                    'Mesures', Icons.sensors_outlined, '/measurements'),
                _NavigationItem(
                    'Rapports', Icons.analytics_outlined, '/reports'),
                _NavigationItem('Notifications', Icons.notifications_outlined,
                    '/notifications'),
                _NavigationItem(
                    'Simulation', Icons.science_outlined, '/simulation'),
                _NavigationItem(
                    'Mon profil', Icons.person_outline_rounded, '/profile'),
              ]
            : const [
                _NavigationItem(
                    'Assistant AR', Icons.view_in_ar_rounded, '/assistant-ar'),
                _NavigationItem(
                    'Mesures', Icons.sensors_outlined, '/measurements'),
                _NavigationItem(
                    'Alertes', Icons.warning_amber_rounded, '/alerts'),
                _NavigationItem('Notifications', Icons.notifications_outlined,
                    '/notifications'),
                _NavigationItem(
                    'Mon profil', Icons.person_outline_rounded, '/profile'),
              ];
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) => ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 10),
            child: Text(
              'Autres espaces',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          for (final item in extraItems)
            ListTile(
              leading:
                  Icon(item.icon, color: Theme.of(context).colorScheme.primary),
              title: Text(item.label),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () {
                Navigator.pop(sheetContext);
                context.go(item.path);
              },
            ),
        ],
      ),
    );
  }
}

class _BottomNavigationButton extends StatelessWidget {
  const _BottomNavigationButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavigationItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: Tooltip(
        message: item.label,
        child: InkResponse(
          radius: 26,
          onTap: onTap,
          child: SizedBox(
            height: 62,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOut,
                  width: 38,
                  height: 34,
                  decoration: BoxDecoration(
                    color: selected ? brandTint : Colors.transparent,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    item.icon,
                    size: 20,
                    color: selected ? brandBlue : const Color(0xFF667085),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  switch (item.label) {
                    'Équipements' => 'Parc',
                    'Maintenance' => 'Interv.',
                    _ => item.label,
                  },
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: selected ? brandBlue : const Color(0xFF667085),
                    fontSize: 9,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickMenuButton extends StatelessWidget {
  const _QuickMenuButton({required this.onTap, required this.selected});

  final VoidCallback onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Autres espaces',
      child: Tooltip(
        message: 'Autres espaces',
        child: InkResponse(
          radius: 26,
          onTap: onTap,
          child: SizedBox(
            height: 62,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: 38,
                  height: 34,
                  decoration: BoxDecoration(
                    color: selected ? brandTint : brandBlue,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    Icons.add_rounded,
                    size: 22,
                    color: selected ? brandBlue : Colors.white,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Plus',
                  style: TextStyle(
                    color: selected ? brandBlue : const Color(0xFF667085),
                    fontSize: 9,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
