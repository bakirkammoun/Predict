import 'package:flutter/material.dart';
import '../core/app_theme.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: brandBlue,
        borderRadius: BorderRadius.circular(size * .32),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F625DF5),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: Icon(
        Icons.factory_rounded,
        size: size * .54,
        color: Colors.white,
        semanticLabel: 'Logo PrédiMaint',
      ),
    );
  }
}

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.large = false});

  final bool large;

  @override
  Widget build(BuildContext context) {
    final fontSize = large ? 25.0 : 17.0;
    return RichText(
      text: TextSpan(
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          letterSpacing: -.5,
          color: const Color(0xFF20212A),
        ),
        children: const [
          TextSpan(text: 'Prédi'),
          TextSpan(text: 'Maint'),
        ],
      ),
    );
  }
}

class BrandTitle extends StatelessWidget {
  const BrandTitle({super.key, this.title});

  final String? title;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const BrandMark(size: 36),
        const SizedBox(width: 9),
        Flexible(
          child: title == null
              ? const BrandWordmark()
              : Text(
                  title!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
        ),
      ],
    );
  }
}

class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: const BrandMark(size: 56),
        ),
        const SizedBox(height: 12),
        const BrandWordmark(large: true),
        const SizedBox(height: 4),
        Text(
          'Maintenance intelligente',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: const Color(0xFF667085),
              ),
        ),
      ],
    );
  }
}
