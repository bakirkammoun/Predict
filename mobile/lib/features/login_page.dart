import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../core/session.dart';
import '../widgets/brand_title.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.api, required this.session});
  final ApiClient api;
  final SessionStore session;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final formKey = GlobalKey<FormState>();
  final email = TextEditingController();
  final password = TextEditingController();
  final firstName = TextEditingController();
  final lastName = TextEditingController();
  final code = TextEditingController();
  String? error;
  bool loading = false;
  bool obscurePassword = true;
  String step = 'login';
  String role = 'technician';

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    firstName.dispose();
    lastName.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    setState(() {
      error = null;
      loading = true;
    });
    try {
      if (step == 'login') {
        final data = await widget.api.post('/auth/login', {
          'email': email.text.trim(),
          'password': password.text,
        }) as Map;
        await widget.session.save(data['token'] as String,
            Map<String, dynamic>.from(data['user'] as Map));
      } else if (step == 'register') {
        await widget.api.post('/auth/register', {
          'email': email.text.trim(),
          'password': password.text,
          'firstName': firstName.text.trim(),
          'lastName': lastName.text.trim(),
          'role': role,
        });
        setState(() => step = 'verify');
      } else if (step == 'verify') {
        await widget.api.post('/auth/verify-email', {
          'email': email.text.trim(),
          'code': code.text.trim(),
        });
        setState(() => step = 'pending');
      }
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Center(child: BrandLockup()),
                  const SizedBox(height: 24),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(22),
                    child: SizedBox(
                      height: 145,
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          Image.asset(
                            'assets/images/maintenance-technician.jpg',
                            fit: BoxFit.cover,
                          ),
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                                colors: [
                                  Color(0xE8171B31),
                                  Color(0x8C171B31),
                                  Color(0x17171B31),
                                ],
                              ),
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.all(18),
                            child: Align(
                              alignment: Alignment.bottomLeft,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'La maintenance, en toute maîtrise.',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800,
                                      height: 1.15,
                                    ),
                                  ),
                                  SizedBox(height: 5),
                                  Text(
                                    'Votre parc et vos équipes, réunis.',
                                    style: TextStyle(
                                      color: Color(0xFFDCE4F4),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Card(
                    margin: EdgeInsets.zero,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Form(
                        key: formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                                step == 'register'
                                    ? 'Créer un compte'
                                    : step == 'verify'
                                        ? 'Vérifier votre e-mail'
                                        : step == 'pending'
                                            ? 'Compte en attente'
                                            : 'Connexion',
                                style: Theme.of(context).textTheme.titleLarge),
                            if (step == 'pending') ...[
                              const SizedBox(height: 12),
                              const Text(
                                'Votre adresse e-mail est confirmée. L’administrateur a reçu votre demande. Votre compte restera désactivé jusqu’à son approbation.',
                              ),
                              const SizedBox(height: 16),
                              FilledButton(
                                onPressed: () => setState(() {
                                  error = null;
                                  step = 'login';
                                }),
                                child: const Text('Retour à la connexion'),
                              ),
                            ],
                            const SizedBox(height: 18),
                            if (step == 'register') ...[
                              TextFormField(
                                controller: firstName,
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [AutofillHints.givenName],
                                decoration: const InputDecoration(
                                  labelText: 'Prénom',
                                  prefixIcon:
                                      Icon(Icons.person_outline_rounded),
                                ),
                                validator: (value) =>
                                    (value?.trim().isEmpty ?? true)
                                        ? 'Saisissez votre prénom.'
                                        : null,
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: lastName,
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [AutofillHints.familyName],
                                decoration: const InputDecoration(
                                  labelText: 'Nom',
                                  prefixIcon:
                                      Icon(Icons.person_outline_rounded),
                                ),
                                validator: (value) =>
                                    (value?.trim().isEmpty ?? true)
                                        ? 'Saisissez votre nom.'
                                        : null,
                              ),
                              const SizedBox(height: 12),
                            ],
                            if (step != 'verify' && step != 'pending')
                              TextFormField(
                                controller: email,
                                keyboardType: TextInputType.emailAddress,
                                autofillHints: const [
                                  AutofillHints.username,
                                  AutofillHints.email
                                ],
                                decoration: const InputDecoration(
                                  labelText: 'Adresse e-mail',
                                  prefixIcon:
                                      Icon(Icons.alternate_email_rounded),
                                ),
                                validator: (value) {
                                  final text = value?.trim() ?? '';
                                  if (text.isEmpty || !text.contains('@')) {
                                    return 'Saisissez une adresse e-mail valide.';
                                  }
                                  return null;
                                },
                              ),
                            if (step == 'verify') ...[
                              Text(
                                'Un code à 6 chiffres a été envoyé à ${email.text.trim()}.',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: code,
                                keyboardType: TextInputType.number,
                                maxLength: 6,
                                autofillHints: const [
                                  AutofillHints.oneTimeCode
                                ],
                                decoration: const InputDecoration(
                                  labelText: 'Code de vérification',
                                  prefixIcon:
                                      Icon(Icons.mark_email_read_outlined),
                                  counterText: '',
                                ),
                                validator: (value) => RegExp(r'^\d{6}$')
                                        .hasMatch(value?.trim() ?? '')
                                    ? null
                                    : 'Saisissez les 6 chiffres reçus.',
                              ),
                            ],
                            if (step == 'register') ...[
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                initialValue: role,
                                decoration: const InputDecoration(
                                  labelText: 'Type de compte',
                                  prefixIcon: Icon(Icons.badge_outlined),
                                ),
                                items: const [
                                  DropdownMenuItem(
                                    value: 'technician',
                                    child: Text('Technicien'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'maintenance_manager',
                                    child: Text('Manager maintenance'),
                                  ),
                                ],
                                onChanged: loading
                                    ? null
                                    : (value) {
                                        if (value != null) {
                                          setState(() => role = value);
                                        }
                                      },
                              ),
                            ],
                            if (step != 'verify' && step != 'pending')
                              const SizedBox(height: 12),
                            if (step != 'verify' && step != 'pending')
                              TextFormField(
                                controller: password,
                                obscureText: obscurePassword,
                                autofillHints: step == 'register'
                                    ? const [AutofillHints.newPassword]
                                    : const [AutofillHints.password],
                                onFieldSubmitted: (_) =>
                                    loading ? null : submit(),
                                decoration: InputDecoration(
                                  labelText: step == 'register'
                                      ? 'Mot de passe (10 caractères minimum)'
                                      : 'Mot de passe',
                                  prefixIcon:
                                      const Icon(Icons.lock_outline_rounded),
                                  suffixIcon: IconButton(
                                    onPressed: () => setState(() =>
                                        obscurePassword = !obscurePassword),
                                    tooltip: obscurePassword
                                        ? 'Afficher le mot de passe'
                                        : 'Masquer le mot de passe',
                                    icon: Icon(obscurePassword
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined),
                                  ),
                                ),
                                validator: (value) {
                                  if (value?.isEmpty ?? true) {
                                    return 'Saisissez votre mot de passe.';
                                  }
                                  if (step == 'register' &&
                                      value!.length < 10) {
                                    return '10 caractères minimum.';
                                  }
                                  return null;
                                },
                              ),
                            if (error != null) ...[
                              const SizedBox(height: 12),
                              Text(error!,
                                  style: TextStyle(
                                      color:
                                          Theme.of(context).colorScheme.error)),
                            ],
                            const SizedBox(height: 20),
                            if (step != 'pending')
                              FilledButton(
                                onPressed: loading ? null : submit,
                                child: loading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2))
                                    : Text(step == 'register'
                                        ? 'Créer mon compte'
                                        : step == 'verify'
                                            ? 'Vérifier et continuer'
                                            : 'Se connecter'),
                              ),
                            if (step != 'verify' && step != 'pending')
                              TextButton(
                                onPressed: loading
                                    ? null
                                    : () => setState(() {
                                          error = null;
                                          step = step == 'login'
                                              ? 'register'
                                              : 'login';
                                        }),
                                child: Text(step == 'login'
                                    ? 'Créer un compte'
                                    : 'J’ai déjà un compte'),
                              ),
                            if (step == 'verify')
                              TextButton(
                                onPressed: loading
                                    ? null
                                    : () => setState(() {
                                          error = null;
                                          step = 'register';
                                        }),
                                child: const Text('Retour à l’inscription'),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Les accès et fonctionnalités affichés dépendent de votre rôle.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Color(0xFF667085)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
