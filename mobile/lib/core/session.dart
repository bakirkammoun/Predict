import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionStore extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  String? token;
  Map<String, dynamic>? user;

  Future<void> load() async {
    token = await _storage.read(key: 'pm_token');
    notifyListeners();
  }

  Future<void> restore(dynamic api) async {
    token = await _storage.read(key: 'pm_token');
    if (token != null) {
      try {
        final me = await api.get('/auth/me');
        user = Map<String, dynamic>.from(me as Map);
      } catch (_) {
        token = null;
        user = null;
        await _storage.delete(key: 'pm_token');
      }
    }
    notifyListeners();
  }

  Future<void> save(String t, Map<String, dynamic> u) async {
    token = t;
    user = u;
    await _storage.write(key: 'pm_token', value: t);
    notifyListeners();
  }

  Future<void> clear() async {
    token = null;
    user = null;
    await _storage.delete(key: 'pm_token');
    notifyListeners();
  }
}
