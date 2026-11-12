import 'package:flutter/material.dart';
import '../core/helpers.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String? status;

  @override
  Widget build(BuildContext context) {
    final raw = status ?? '';
    final color = switch (raw) {
      'critical' ||
      'urgent' ||
      'cancelled' ||
      'revoked' =>
        const Color(0xFFDC2626),
      'warning' ||
      'high' ||
      'in_progress' ||
      'on_hold' ||
      'acknowledged' =>
        const Color(0xFFD97706),
      'new' => const Color(0xFF2563EB),
      'offline' => const Color(0xFF667085),
      'sensor_error' => const Color(0xFF0D9488),
      'normal' ||
      'resolved' ||
      'completed' ||
      'active' =>
        const Color(0xFF16A34A),
      _ => const Color(0xFF475467),
    };
    final bg = switch (raw) {
      'critical' ||
      'urgent' ||
      'cancelled' ||
      'revoked' =>
        const Color(0xFFFEF2F2),
      'warning' ||
      'high' ||
      'in_progress' ||
      'on_hold' =>
        const Color(0xFFFFF7ED),
      'new' || 'acknowledged' => const Color(0xFFEFF6FF),
      'sensor_error' => const Color(0xFFECFEFF),
      'normal' ||
      'resolved' ||
      'completed' ||
      'active' =>
        const Color(0xFFF0FDF4),
      _ => const Color(0xFFF2F4F7),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(
        labelStatus(raw),
        style:
            TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700),
      ),
    );
  }
}
