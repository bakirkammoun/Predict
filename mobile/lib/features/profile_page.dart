import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../core/session.dart';
import '../core/app_theme.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/brand_title.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key, required this.api, required this.session});
  final ApiClient api;
  final SessionStore session;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map? me;
  List notifs = [];
  String? error;
  bool loading = true;
  final phone = TextEditingController();
  final currentPassword = TextEditingController();
  final newPassword = TextEditingController();
  bool savingPhone = false;
  bool changingPassword = false;

  @override
  void dispose() {
    phone.dispose();
    currentPassword.dispose();
    newPassword.dispose();
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
      final u = await widget.api.get('/auth/me');
      final n = await widget.api.get('/notifications');
      if (!mounted) return;
      phone.text = (u as Map)['phone']?.toString() ?? '';
      setState(() {
        me = u;
        notifs = n as List;
      });
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> savePhone() async {
    setState(() => savingPhone = true);
    try {
      await widget.api.patch('/profile', {'phone': phone.text.trim()});
      if (!mounted) return;
      setState(() {
        me = {...?me, 'phone': phone.text.trim()};
        error = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Téléphone mis à jour.')),
      );
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => savingPhone = false);
    }
  }

  Future<void> updatePassword() async {
    if (currentPassword.text.length < 8 || newPassword.text.length < 8) {
      setState(() => error =
          'Les deux mots de passe doivent contenir au moins 8 caractères.');
      return;
    }
    setState(() {
      changingPassword = true;
      error = null;
    });
    try {
      await widget.api.patch('/profile/password', {
        'currentPassword': currentPassword.text,
        'newPassword': newPassword.text,
      });
      if (!mounted) return;
      currentPassword.clear();
      newPassword.clear();
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Text('Mot de passe modifié'),
          content: const Text(
            'Pour protéger votre compte, vous allez être déconnecté. Connectez-vous avec votre nouveau mot de passe.',
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Continuer'),
            ),
          ],
        ),
      );
      await widget.session.clear();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => changingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = me?['role']?.toString();
    final roleStyle = RoleStyle.forRole(role);
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Mon profil'),
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
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 28,
                                  backgroundColor: roleStyle.tint,
                                  child: Icon(Icons.person_outline_rounded,
                                      color: roleStyle.accent, size: 29),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${me?['firstName'] ?? ''} ${me?['lastName'] ?? ''}'
                                            .trim(),
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleLarge,
                                      ),
                                      const SizedBox(height: 3),
                                      Text(me?['email']?.toString() ?? '',
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 9),
                              decoration: BoxDecoration(
                                  color: roleStyle.tint,
                                  borderRadius: BorderRadius.circular(12)),
                              child: Row(
                                children: [
                                  Icon(roleStyle.icon,
                                      color: roleStyle.accent, size: 18),
                                  const SizedBox(width: 8),
                                  Text(roleStyle.label,
                                      style: TextStyle(
                                          color: roleStyle.accent,
                                          fontWeight: FontWeight.w700)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Coordonnées',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 12),
                            TextFormField(
                              initialValue: me?['email']?.toString() ?? '',
                              readOnly: true,
                              decoration: const InputDecoration(
                                labelText: 'Adresse e-mail',
                                helperText:
                                    'L’adresse e-mail ne peut pas être modifiée.',
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: phone,
                              keyboardType: TextInputType.phone,
                              textInputAction: TextInputAction.done,
                              decoration: const InputDecoration(
                                labelText: 'Téléphone',
                                prefixIcon: Icon(Icons.phone_outlined),
                              ),
                            ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              onPressed: savingPhone ? null : savePhone,
                              icon: savingPhone
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Icon(Icons.save_outlined),
                              label: Text(savingPhone
                                  ? 'Enregistrement…'
                                  : 'Enregistrer le téléphone'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Sécurité',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 12),
                            TextField(
                              controller: currentPassword,
                              obscureText: true,
                              autofillHints: const [AutofillHints.password],
                              decoration: const InputDecoration(
                                labelText: 'Mot de passe actuel',
                                prefixIcon: Icon(Icons.lock_outline_rounded),
                              ),
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: newPassword,
                              obscureText: true,
                              autofillHints: const [AutofillHints.newPassword],
                              decoration: const InputDecoration(
                                labelText: 'Nouveau mot de passe',
                                helperText: '8 caractères minimum.',
                                prefixIcon: Icon(Icons.key_outlined),
                              ),
                            ),
                            const SizedBox(height: 12),
                            OutlinedButton.icon(
                              onPressed:
                                  changingPassword ? null : updatePassword,
                              icon: changingPassword
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2),
                                    )
                                  : const Icon(Icons.password_rounded),
                              label: Text(changingPassword
                                  ? 'Modification…'
                                  : 'Changer le mot de passe'),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text('Activité récente',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 6),
                    if (notifs.isEmpty)
                      const Card(
                        child: EmptyState(
                          title: 'Aucune notification',
                          message:
                              'Vos nouvelles notifications apparaîtront ici.',
                          icon: Icons.notifications_none_rounded,
                        ),
                      ),
                    ...notifs.take(15).map((raw) {
                      final n = raw as Map;
                      return Card(
                        child: ListTile(
                          leading: Icon(Icons.notifications_outlined,
                              color: roleStyle.accent),
                          title: Text(n['title']?.toString() ?? '',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Text(n['body']?.toString() ?? ''),
                        ),
                      );
                    }),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Se déconnecter ?'),
                            content: const Text(
                                'Vous devrez vous reconnecter pour accéder à vos données.'),
                            actions: [
                              TextButton(
                                  onPressed: () =>
                                      Navigator.pop(context, false),
                                  child: const Text('Annuler')),
                              FilledButton(
                                  onPressed: () => Navigator.pop(context, true),
                                  child: const Text('Déconnexion')),
                            ],
                          ),
                        );
                        if (confirm == true) await widget.session.clear();
                      },
                      child: const Text('Se déconnecter'),
                    ),
                  ],
                ),
    );
  }
}
