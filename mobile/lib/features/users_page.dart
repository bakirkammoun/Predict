import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/status_badge.dart';
import '../widgets/brand_title.dart';

class UsersPage extends StatefulWidget {
  const UsersPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  final search = TextEditingController();
  List users = [];
  List pendingUsers = [];
  String? error;
  bool loading = true;
  bool creating = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.get('/users', {
          'limit': 100,
          if (search.text.trim().isNotEmpty) 'search': search.text.trim(),
        }),
        widget.api.get('/users/pending-approval'),
      ]);
      setState(() {
        users = results[0] as List;
        pendingUsers = results[1] as List;
      });
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _createUser() async {
    final formKey = GlobalKey<FormState>();
    final firstName = TextEditingController();
    final lastName = TextEditingController();
    final email = TextEditingController();
    final password = TextEditingController();
    final phone = TextEditingController();
    var role = 'technician';
    var obscurePassword = true;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          scrollable: true,
          title: const Text('Ajouter un utilisateur'),
          content: SizedBox(
            width: 420,
            child: SingleChildScrollView(
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: firstName,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Prénom'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                              ? 'Le prénom est obligatoire.'
                              : null,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: lastName,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(labelText: 'Nom'),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                              ? 'Le nom est obligatoire.'
                              : null,
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      decoration:
                          const InputDecoration(labelText: 'Adresse e-mail'),
                      validator: (value) {
                        final address = value?.trim() ?? '';
                        return address.contains('@')
                            ? null
                            : 'Saisissez une adresse valide.';
                      },
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: password,
                      obscureText: obscurePassword,
                      textInputAction: TextInputAction.next,
                      decoration: InputDecoration(
                        labelText: 'Mot de passe initial',
                        suffixIcon: IconButton(
                          onPressed: () => setDialogState(
                            () => obscurePassword = !obscurePassword,
                          ),
                          tooltip: obscurePassword
                              ? 'Afficher le mot de passe'
                              : 'Masquer le mot de passe',
                          icon: Icon(
                            obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) => (value?.length ?? 0) >= 8
                          ? null
                          : 'Utilisez au moins 8 caractères.',
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: phone,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                          labelText: 'Téléphone (facultatif)'),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: role,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Rôle'),
                      items: const [
                        DropdownMenuItem(
                            value: 'technician', child: Text('Technicien')),
                        DropdownMenuItem(
                            value: 'maintenance_manager',
                            child: Text(
                              'Responsable maintenance',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            )),
                        DropdownMenuItem(
                            value: 'admin', child: Text('Administrateur')),
                      ],
                      onChanged: (value) {
                        if (value != null) setDialogState(() => role = value);
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () {
                if (!(formKey.currentState?.validate() ?? false)) return;
                Navigator.pop(context, {
                  'firstName': firstName.text.trim(),
                  'lastName': lastName.text.trim(),
                  'email': email.text.trim(),
                  'password': password.text,
                  'phone': phone.text.trim(),
                  'role': role,
                });
              },
              child: const Text('Créer le compte'),
            ),
          ],
        ),
      ),
    );
    firstName.dispose();
    lastName.dispose();
    email.dispose();
    password.dispose();
    phone.dispose();
    if (result == null) return;

    setState(() {
      creating = true;
      error = null;
    });
    try {
      await widget.api.post('/users', result);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Utilisateur créé.')),
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => creating = false);
    }
  }

  Future<void> _toggleActive(Map user) async {
    final isActive = user['isActive'] == true;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title:
            Text(isActive ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'),
        content: Text(
          isActive
              ? 'La personne ne pourra plus se connecter avec ce compte.'
              : 'La personne retrouvera l’accès à son compte.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Annuler')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(isActive ? 'Désactiver' : 'Réactiver'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await widget.api.patch('/users/${user['_id']}', {'isActive': !isActive});
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  Future<void> _approve(Map user) async {
    try {
      await widget.api.post('/users/${user['_id']}/approve', {});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Compte approuvé et activé.')),
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
        title: const BrandTitle(title: 'Utilisateurs'),
        actions: [
          IconButton(
              onPressed: load,
              tooltip: 'Actualiser',
              icon: const Icon(Icons.refresh_rounded)),
          const SizedBox(width: 4),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: creating ? null : _createUser,
        icon: creating
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Icon(Icons.person_add_alt_1_rounded),
        label: Text(creating ? 'Création…' : 'Ajouter'),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null && users.isEmpty
              ? ErrorBox(message: error!, onRetry: load)
              : RefreshIndicator(
                  onRefresh: load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    children: [
                      TextField(
                        controller: search,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => load(),
                        decoration: InputDecoration(
                          hintText: 'Rechercher un nom ou un e-mail',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: search.text.isEmpty
                              ? IconButton(
                                  onPressed: load,
                                  tooltip: 'Rechercher',
                                  icon: const Icon(Icons.arrow_forward_rounded),
                                )
                              : IconButton(
                                  onPressed: () {
                                    search.clear();
                                    load();
                                  },
                                  tooltip: 'Effacer la recherche',
                                  icon: const Icon(Icons.close_rounded),
                                ),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 8),
                        Text(error!,
                            style: TextStyle(
                                color: Theme.of(context).colorScheme.error)),
                      ],
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Demandes à approuver (${pendingUsers.length})',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Ces utilisateurs ont vérifié leur e-mail, mais leur compte reste désactivé.',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (pendingUsers.isEmpty)
                                const Padding(
                                  padding: EdgeInsets.only(top: 12),
                                  child: Text('Aucune demande en attente.'),
                                )
                              else
                                for (final raw in pendingUsers)
                                  _pendingCard(raw as Map),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (users.isEmpty)
                        const EmptyState(
                          title: 'Aucun utilisateur trouvé',
                          message:
                              'Modifiez la recherche ou créez un nouveau compte.',
                          icon: Icons.group_outlined,
                        )
                      else ...[
                        Text('${users.length} compte(s)',
                            style: Theme.of(context).textTheme.bodySmall),
                        for (final raw in users) _userCard(raw as Map),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _pendingCard(Map user) {
    final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            name.isEmpty ? 'Utilisateur' : name,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 3),
          Text(
            '${user['email'] ?? ''} · ${labelStatus(user['role']?.toString())}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => _approve(user),
            child: const Text('Approuver le compte'),
          ),
        ],
      ),
    );
  }

  Widget _userCard(Map user) {
    final active = user['isActive'] == true;
    final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    final role = labelStatus(user['role']?.toString());
    final accent = Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 21,
                  backgroundColor: accent.withValues(alpha: .1),
                  child: Icon(Icons.person_outline_rounded, color: accent),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    name.isEmpty ? 'Utilisateur' : name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                StatusBadge(status: active ? 'active' : 'inactive'),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(left: 54, top: 5),
              child: Text(
                user['email']?.toString() ?? '',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 54, top: 2),
              child: Row(
                children: [
                  Icon(Icons.badge_outlined,
                      size: 16, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      role,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () => _toggleActive(user),
                    icon: Icon(
                      active
                          ? Icons.pause_circle_outline_rounded
                          : Icons.play_circle_outline_rounded,
                      size: 18,
                    ),
                    label: Text(active ? 'Désactiver' : 'Réactiver'),
                    style: TextButton.styleFrom(
                      minimumSize: const Size(0, 40),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
