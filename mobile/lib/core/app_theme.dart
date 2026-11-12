import 'package:flutter/material.dart';

const brandNavy = Color(0xFF171B31);
const brandBlue = Color(0xFF625DF5);
const brandGold = Color(0xFFFFB020);
const brandTint = Color(0xFFE4E2FF);
const brandInk = Color(0xFF171B31);
const actionBlack = Color(0xFF625DF5);

class RoleStyle {
  const RoleStyle({
    required this.accent,
    required this.tint,
    required this.gradientStart,
    required this.gradientEnd,
    required this.label,
    required this.icon,
  });

  final Color accent;
  final Color tint;
  final Color gradientStart;
  final Color gradientEnd;
  final String label;
  final IconData icon;

  static RoleStyle forRole(String? role) {
    switch (role) {
      case 'admin':
        return const RoleStyle(
          accent: brandBlue,
          tint: brandTint,
          gradientStart: brandNavy,
          gradientEnd: brandBlue,
          label: 'Administration',
          icon: Icons.admin_panel_settings_outlined,
        );
      case 'maintenance_manager':
        return const RoleStyle(
          accent: brandBlue,
          tint: brandTint,
          gradientStart: brandNavy,
          gradientEnd: brandBlue,
          label: 'Supervision maintenance',
          icon: Icons.monitor_heart_outlined,
        );
      default:
        return const RoleStyle(
          accent: brandBlue,
          tint: brandTint,
          gradientStart: brandNavy,
          gradientEnd: brandBlue,
          label: 'Équipe terrain',
          icon: Icons.engineering_outlined,
        );
    }
  }
}

ThemeData buildAppTheme(String? role) {
  final style = RoleStyle.forRole(role);
  const muted = Color(0xFF667085);
  const border = Color(0xFFE9ECF3);

  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: style.accent,
      brightness: Brightness.light,
    ).copyWith(
      primary: style.accent,
      onPrimary: Colors.white,
      secondary: const Color(0xFF00AFA2),
      surface: Colors.white,
      error: const Color(0xFFDC2626),
    ),
    scaffoldBackgroundColor: const Color(0xFFF7F8FC),
    materialTapTargetSize: MaterialTapTargetSize.padded,
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xFFF7F8FC),
      foregroundColor: brandInk,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      elevation: 0,
      toolbarHeight: 56,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: brandInk,
      ),
      iconTheme: IconThemeData(color: brandInk),
      actionsIconTheme: IconThemeData(color: brandInk),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: brandNavy,
      contentTextStyle: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      titleTextStyle: const TextStyle(
        color: brandInk,
        fontSize: 19,
        fontWeight: FontWeight.w700,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shadowColor: const Color(0x0D0B172A),
      margin: const EdgeInsets.symmetric(vertical: 5),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: style.accent, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: actionBlack,
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFFE9ECF3),
        disabledForegroundColor: muted,
        overlayColor: Colors.white.withValues(alpha: .14),
        minimumSize: const Size.fromHeight(48),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        textStyle: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          letterSpacing: -.1,
        ),
        elevation: 0,
        shape: const StadiumBorder(),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: brandInk,
        backgroundColor: Colors.white,
        side: const BorderSide(color: border),
        minimumSize: const Size.fromHeight(46),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        shape: const StadiumBorder(),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: brandInk,
        minimumSize: const Size(44, 44),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
        shape: const StadiumBorder(),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(
        foregroundColor: const Color(0xFF667085),
        minimumSize: const Size(44, 44),
        overlayColor: style.accent.withValues(alpha: .08),
        shape: const CircleBorder(),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: style.tint,
      height: 72,
      elevation: 0,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11,
          height: 1.15,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? style.accent : muted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 22,
          color: states.contains(WidgetState.selected) ? style.accent : muted,
        ),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      side: const BorderSide(color: border),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      labelStyle: const TextStyle(color: brandInk, fontWeight: FontWeight.w600),
    ),
    listTileTheme: ListTileThemeData(
      tileColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    ),
    textTheme: const TextTheme(
      headlineSmall:
          TextStyle(fontSize: 25, fontWeight: FontWeight.w700, color: brandInk),
      titleLarge:
          TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: brandInk),
      titleMedium:
          TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: brandInk),
      bodyLarge: TextStyle(fontSize: 15, color: brandInk),
      bodyMedium: TextStyle(fontSize: 14, color: muted),
      bodySmall: TextStyle(fontSize: 12, color: muted),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: style.accent),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: actionBlack,
      foregroundColor: Colors.white,
      elevation: 2,
      shape: const CircleBorder(),
    ),
    dividerTheme: const DividerThemeData(color: border, thickness: 1),
    splashColor: style.accent.withValues(alpha: .08),
    highlightColor: style.accent.withValues(alpha: .04),
  );
}
