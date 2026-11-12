import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:predimaint_mobile/core/app_theme.dart';
import 'package:predimaint_mobile/core/api_client.dart';
import 'package:predimaint_mobile/core/helpers.dart';
import 'package:predimaint_mobile/core/session.dart';
import 'package:predimaint_mobile/features/home_page.dart';
import 'package:predimaint_mobile/features/interventions_page.dart';
import 'package:predimaint_mobile/features/machine_detail_page.dart';
import 'package:predimaint_mobile/features/simulation_page.dart';
import 'package:predimaint_mobile/features/users_page.dart';
import 'package:predimaint_mobile/main.dart' show HomeShell;
import 'package:predimaint_mobile/widgets/brand_title.dart';
import 'package:predimaint_mobile/widgets/empty_state.dart';
import 'package:predimaint_mobile/widgets/status_badge.dart';

class _UsersApi extends ApiClient {
  _UsersApi({this.hasPendingUser = false}) : super(SessionStore());

  final bool hasPendingUser;

  @override
  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async {
    if (path == '/users/pending-approval') {
      return hasPendingUser
          ? [
              {
                '_id': 'pending-1',
                'firstName': 'Nouveau',
                'lastName': 'Technicien',
                'email': 'tech@example.com',
                'role': 'technician',
              },
            ]
          : [];
    }
    return [
      {
        '_id': 'user-1',
        'firstName': 'Amine',
        'lastName': 'Admin',
        'email': 'admin@example.com',
        'role': 'admin',
        'isActive': true,
      },
    ];
  }
}

class _DashboardApi extends ApiClient {
  _DashboardApi()
      : super(SessionStore()
          ..user = {'role': 'technician', 'firstName': 'Samira'});

  @override
  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async {
    if (path == '/dashboard/summary') {
      return {
        'counts': {
          'total': 4,
          'normal': 2,
          'warning': 1,
          'critical': 1,
        },
        'availability': .75,
        'trend': [
          {'vibration': .2},
          {'vibration': .4},
        ],
        'latestAlerts': [],
        'latestMeasurements': [],
        'dataOrigin': 'Données de démonstration',
      };
    }
    if (path == '/notifications' || path == '/interventions') return [];
    throw StateError('Unexpected API path: $path');
  }
}

class _DetailApi extends ApiClient {
  _DetailApi() : super(SessionStore());

  @override
  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async {
    if (path == '/machines/machine-1') {
      return {
        '_id': 'machine-1',
        'name': 'Scanner IRM 02',
        'code': 'IRM-02',
        'type': 'Scanner',
        'location': 'Radiologie',
        'healthStatus': 'warning',
        'heuristicRisk': 28,
      };
    }
    if (path == '/machines/machine-1/measurements' ||
        path == '/interventions') {
      return [];
    }
    throw StateError('Unexpected API path: $path');
  }
}

class _SimulationApi extends ApiClient {
  _SimulationApi() : super(SessionStore());

  bool running = false;
  int intervalMs = 4000;

  @override
  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async {
    if (path == '/simulation') {
      return {'running': running, 'intervalMs': intervalMs, 'scenarios': {}};
    }
    if (path == '/machines') {
      return [
        {'_id': 'machine-1', 'name': 'Pompe principale'},
      ];
    }
    throw StateError('Unexpected API path: $path');
  }

  @override
  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    if (path == '/simulation/start') running = true;
    if (path == '/simulation/stop') running = false;
    if (path == '/simulation/interval') intervalMs = body['intervalMs'] as int;
    return {'running': running, 'intervalMs': intervalMs};
  }
}

void main() {
  testWidgets('PrédiMaint brand title uses the dashboard factory mark',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: BrandTitle())),
      ),
    );

    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is RichText && widget.text.toPlainText() == 'PrédiMaint',
      ),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.factory_rounded), findsOneWidget);
  });

  testWidgets('login lockup uses the dashboard PrédiMaint brand',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Center(child: BrandLockup())),
      ),
    );

    expect(find.byIcon(Icons.factory_rounded), findsOneWidget);
    expect(find.text('Maintenance intelligente'), findsOneWidget);
  });

  test('roles share the product color system', () {
    expect(RoleStyle.forRole('admin').accent, brandBlue);
    expect(RoleStyle.forRole('maintenance_manager').accent, brandBlue);
    expect(RoleStyle.forRole('technician').accent, brandBlue);
    expect(
      RoleStyle.forRole('admin').accent,
      RoleStyle.forRole('technician').accent,
    );
    expect(buildAppTheme('admin').scaffoldBackgroundColor,
        const Color(0xFFF7F8FC));
    expect(buildAppTheme('admin').appBarTheme.foregroundColor,
        const Color(0xFF171B31));
    expect(buildAppTheme('admin').colorScheme.primary, brandBlue);
    expect(
      buildAppTheme('maintenance_manager').colorScheme.primary,
      brandBlue,
    );
    expect(
      buildAppTheme('technician').colorScheme.primary,
      brandBlue,
    );
    expect(
      buildAppTheme('technician')
          .filledButtonTheme
          .style
          ?.backgroundColor
          ?.resolve({}),
      actionBlack,
    );
    expect(
      buildAppTheme('technician').outlinedButtonTheme.style?.shape?.resolve({}),
      const StadiumBorder(),
    );
  });

  testWidgets('critical status remains red and empty states have useful copy',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('technician'),
        home: const Scaffold(
          body: Column(
            children: [
              StatusBadge(status: 'critical'),
              EmptyState(
                  title: 'Aucune machine',
                  message: 'Les machines apparaîtront ici.'),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Critique'), findsOneWidget);
    expect(find.text('Aucune machine'), findsOneWidget);
    final badgeText = tester.widget<Text>(find.text('Critique'));
    expect(badgeText.style?.color, const Color(0xFFDC2626));
  });

  testWidgets('user list stays readable on a narrow phone screen',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('admin'),
        home: UsersPage(api: _UsersApi()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Amine Admin'), findsOneWidget);
    expect(find.text('admin@example.com'), findsOneWidget);
    expect(find.text('Administrateur'), findsOneWidget);
    expect(find.text('Désactiver'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pending approval fits a narrow phone screen', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('admin'),
        home: UsersPage(api: _UsersApi(hasPendingUser: true)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nouveau Technicien'), findsOneWidget);
    expect(find.text('Approuver le compte'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('new-user form fits a narrow phone screen', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('admin'),
        home: UsersPage(api: _UsersApi()),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ajouter'));
    await tester.pumpAndSettle();

    expect(find.text('Ajouter un utilisateur'), findsOneWidget);
    expect(find.text('Créer le compte'), findsOneWidget);
    expect(find.text('Mot de passe initial'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dashboard sections fit a narrow phone screen', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('technician'),
        home: TechnicianDashboard(api: _DashboardApi()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Bonjour, Samira'), findsOneWidget);
    expect(find.text('Santé des équipements'), findsOneWidget);
    expect(find.text('Maintenance à prévoir'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Alertes récentes'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Alertes récentes'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Dernières mesures'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Dernières mesures'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('simulation exposes controls and applies the start action',
      (tester) async {
    final api = _SimulationApi();
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('admin'),
        home: SimulationPage(api: api),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Simulation en cours'), findsNothing);
    expect(find.text('Simulation arrêtée'), findsOneWidget);
    expect(find.text('Pompe principale'), findsOneWidget);
    expect(find.text('Machine hors ligne'), findsOneWidget);

    await tester.tap(find.text('Démarrer'));
    await tester.pumpAndSettle();

    expect(api.running, isTrue);
    expect(find.text('Simulation en cours'), findsOneWidget);
  });

  testWidgets('equipment detail keeps the reference tabs usable on mobile',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('technician'),
        home: MachineDetailPage(api: _DetailApi(), id: 'machine-1'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Détail équipement'), findsOneWidget);
    expect(find.text('Scanner IRM 02'), findsOneWidget);
    expect(find.text('Aperçu'), findsOneWidget);
    expect(find.text('Analyses'), findsOneWidget);
    expect(find.text('Maintenance'), findsWidgets);
    expect(find.text('Historique'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('maintenance screen shows a compact month calendar on mobile',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme('technician'),
        home: InterventionsPage(api: _DetailApi()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Maintenance'), findsOneWidget);
    expect(find.text('Calendrier'), findsOneWidget);
    expect(find.text('Liste'), findsOneWidget);
    expect(find.text('Demandes'), findsOneWidget);
    expect(find.text('Planning de maintenance'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('navigation uses the floating pill design and keeps quick links',
      (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final session = SessionStore()..user = {'role': 'technician'};
    final router = GoRouter(
      routes: [
        ShellRoute(
          builder: (context, state, child) =>
              HomeShell(session: session, child: child),
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) =>
                  const Scaffold(body: Text('Contenu accueil')),
            ),
            GoRoute(
              path: '/interventions',
              builder: (context, state) => const Scaffold(body: Text('Tâches')),
            ),
            GoRoute(
              path: '/machines',
              builder: (context, state) =>
                  const Scaffold(body: Text('Machines')),
            ),
            GoRoute(
              path: '/profile',
              builder: (context, state) => const Scaffold(body: Text('Profil')),
            ),
            GoRoute(
              path: '/notifications',
              builder: (context, state) =>
                  const Scaffold(body: Text('Notifications')),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      MaterialApp.router(
        theme: buildAppTheme('technician'),
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Accueil'), findsOneWidget);
    expect(find.byTooltip('Maintenance'), findsOneWidget);
    expect(find.byTooltip('Équipements'), findsOneWidget);
    expect(find.byTooltip('Alertes'), findsOneWidget);
    expect(find.text('Accueil'), findsOneWidget);
    expect(find.text('Parc'), findsOneWidget);
    expect(find.text('Interv.'), findsOneWidget);
    expect(find.byIcon(Icons.add_rounded), findsOneWidget);
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Container &&
            widget.decoration is BoxDecoration &&
            (widget.decoration! as BoxDecoration).color == Colors.white,
      ),
      findsOneWidget,
    );
    expect(find.text('Profil'), findsNothing);
    expect(tester.takeException(), isNull);
    expect(find.byType(NavigationBar), findsNothing);

    await tester.tap(find.byIcon(Icons.add_rounded));
    await tester.pumpAndSettle();
    expect(find.text('Autres espaces'), findsOneWidget);
    expect(find.text('Mon profil'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('mobile labels match the web terminology', () {
    expect(labelParameter('vibration'), 'Vibration');
    expect(labelParameter('temperature'), 'Température');
    expect(labelParameter('current'), 'Courant');
    expect(labelParameter('connectivity'), 'Connectivité');
  });
}
