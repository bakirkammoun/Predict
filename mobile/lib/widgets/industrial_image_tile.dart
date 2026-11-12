import 'package:flutter/material.dart';

class IndustrialImageTile extends StatelessWidget {
  const IndustrialImageTile({
    super.key,
    required this.asset,
    required this.icon,
    this.width = 52,
    this.height = 52,
    this.radius = 14,
  });

  final String asset;
  final IconData icon;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: Image.asset(
          asset,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => ColoredBox(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: .08),
            child: Icon(icon, color: Theme.of(context).colorScheme.primary),
          ),
        ),
      ),
    );
  }
}
