import 'package:flutter/material.dart';

class DashboardMetricCard extends StatelessWidget {
  const DashboardMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.accent,
    required this.tint,
    required this.width,
  });

  final String label;
  final Object? value;
  final IconData icon;
  final Color accent;
  final Color tint;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 82,
      child: Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(5, 7, 5, 7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 27,
                height: 27,
                decoration: BoxDecoration(
                  color: tint,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: accent, size: 15),
              ),
              const Spacer(),
              Text(
                value?.toString() ?? '—',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontSize: 16, height: 1.05),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(fontSize: 8, height: 1.2)),
            ],
          ),
        ),
      ),
    );
  }
}
