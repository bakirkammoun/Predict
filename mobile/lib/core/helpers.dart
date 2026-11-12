import 'package:dio/dio.dart';

String apiMessage(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map && data['error'] is Map) {
      return data['error']['message']?.toString() ?? 'Erreur serveur';
    }
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout) {
      return 'Réseau indisponible. Vérifiez la connexion au serveur.';
    }
  }
  return error.toString();
}

String nestedName(dynamic value) {
  if (value is Map) return value['name']?.toString() ?? '';
  return '';
}

String nestedId(dynamic value) {
  if (value is Map) return value['_id']?.toString() ?? '';
  return value?.toString() ?? '';
}

String labelParameter(String? raw) {
  switch (raw) {
    case 'vibration':
      return 'Vibration';
    case 'temperature':
      return 'Température';
    case 'current':
      return 'Courant';
    case 'connectivity':
      return 'Connectivité';
    default:
      return raw ?? '—';
  }
}

String labelStatus(String? raw) {
  switch (raw) {
    case 'normal':
      return 'Normal';
    case 'warning':
      return 'Vigilance';
    case 'critical':
      return 'Critique';
    case 'offline':
      return 'Hors ligne';
    case 'sensor_error':
      return 'Capteur en erreur';
    case 'online':
      return 'En ligne';
    case 'active':
      return 'Actif';
    case 'inactive':
      return 'Inactif';
    case 'revoked':
      return 'Révoqué';
    case 'urgent':
      return 'Urgente';
    case 'high':
      return 'Haute';
    case 'medium':
      return 'Moyenne';
    case 'low':
      return 'Faible';
    case 'hardware':
      return 'HARDWARE_REAL';
    case 'simulation':
      return 'SIMULATION';
    case 'new':
      return 'Nouvelle';
    case 'acknowledged':
      return 'Reconnue';
    case 'in_progress':
      return 'En cours';
    case 'resolved':
      return 'Résolue';
    case 'planned':
      return 'Planifiée';
    case 'todo':
      return 'À faire';
    case 'on_hold':
      return 'En attente';
    case 'completed':
      return 'Terminée';
    case 'cancelled':
      return 'Annulée';
    case 'admin':
      return 'Administrateur';
    case 'maintenance_manager':
      return 'Responsable maintenance';
    case 'technician':
      return 'Technicien';
    default:
      return raw ?? '—';
  }
}
