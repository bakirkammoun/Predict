import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/api_client.dart';
import '../core/app_theme.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';

class InterventionsPage extends StatefulWidget {
  const InterventionsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<InterventionsPage> createState() => _InterventionsPageState();
}

class _InterventionsPageState extends State<InterventionsPage> {
  List items = [];
  String? error;
  bool loading = true;
  String selectedView = 'calendar';
  DateTime visibleMonth = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime selectedDate = DateTime(
    DateTime.now().year,
    DateTime.now().month,
    DateTime.now().day,
  );

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
      final d = await widget.api.get('/interventions', {'limit': 50});
      setState(() => items = d as List);
    } catch (e) {
      setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> createIntervention() async {
    List machines;
    List technicians;
    try {
      machines = await widget.api.get('/machines', {'limit': 100}) as List;
      technicians = await widget.api.get('/users', {
        'limit': 100,
        'role': 'technician',
      }) as List;
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
      return;
    }
    if (!mounted) return;
    if (machines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text(
                'Ajoutez une machine avant de planifier une intervention.')),
      );
      return;
    }

    final formKey = GlobalKey<FormState>();
    final description = TextEditingController();
    var machineId = (machines.first as Map)['_id'].toString();
    String? technicianId;
    var kind = 'corrective';
    var priority = 'medium';
    DateTime? scheduledAt;

    final request = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Planifier une intervention'),
          content: SizedBox(
            width: 440,
            child: SingleChildScrollView(
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      initialValue: machineId,
                      decoration: const InputDecoration(labelText: 'Machine'),
                      items: [
                        for (final raw in machines)
                          DropdownMenuItem(
                            value: (raw as Map)['_id'].toString(),
                            child: Text(
                              '${raw['name'] ?? 'Machine'} · ${raw['code'] ?? ''}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => machineId = value);
                        }
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: kind,
                      decoration: const InputDecoration(labelText: 'Type'),
                      items: const [
                        DropdownMenuItem(
                            value: 'corrective', child: Text('Corrective')),
                        DropdownMenuItem(
                            value: 'preventive', child: Text('Préventive')),
                        DropdownMenuItem(
                            value: 'inspection', child: Text('Inspection')),
                      ],
                      onChanged: (value) {
                        if (value != null) setDialogState(() => kind = value);
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: priority,
                      decoration: const InputDecoration(labelText: 'Priorité'),
                      items: const [
                        DropdownMenuItem(value: 'low', child: Text('Faible')),
                        DropdownMenuItem(
                            value: 'medium', child: Text('Moyenne')),
                        DropdownMenuItem(value: 'high', child: Text('Haute')),
                        DropdownMenuItem(
                            value: 'urgent', child: Text('Urgente')),
                      ],
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => priority = value);
                        }
                      },
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: technicianId,
                      decoration: const InputDecoration(
                        labelText: 'Technicien affecté (facultatif)',
                      ),
                      items: [
                        const DropdownMenuItem<String>(
                          value: null,
                          child: Text('Non affecté'),
                        ),
                        for (final raw in technicians)
                          if ((raw as Map)['isActive'] == true)
                            DropdownMenuItem<String>(
                              value: raw['_id'].toString(),
                              child: Text(
                                '${raw['firstName'] ?? ''} ${raw['lastName'] ?? ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                      ],
                      onChanged: (value) =>
                          setDialogState(() => technicianId = value),
                    ),
                    const SizedBox(height: 10),
                    TextFormField(
                      controller: description,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'Description du problème',
                        alignLabelWithHint: true,
                      ),
                      validator: (value) => (value?.trim().length ?? 0) >= 3
                          ? null
                          : 'Décrivez le problème (3 caractères minimum).',
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: scheduledAt ?? DateTime.now(),
                          firstDate: DateTime.now(),
                          lastDate:
                              DateTime.now().add(const Duration(days: 730)),
                        );
                        if (date != null) {
                          setDialogState(() => scheduledAt = date);
                        }
                      },
                      icon: const Icon(Icons.calendar_month_outlined),
                      label: Text(
                        scheduledAt == null
                            ? 'Choisir une date (facultatif)'
                            : 'Prévue le ${scheduledAt!.day.toString().padLeft(2, '0')}/${scheduledAt!.month.toString().padLeft(2, '0')}/${scheduledAt!.year}',
                      ),
                    ),
                    if (scheduledAt != null)
                      TextButton(
                        onPressed: () =>
                            setDialogState(() => scheduledAt = null),
                        child: const Text('Retirer la date'),
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
                  'machineId': machineId,
                  'type': kind,
                  'priority': priority,
                  'problemDescription': description.text.trim(),
                  if (technicianId != null)
                    'assignedTechnicianId': technicianId,
                  if (scheduledAt != null)
                    'scheduledAt': DateTime(
                      scheduledAt!.year,
                      scheduledAt!.month,
                      scheduledAt!.day,
                      9,
                    ).toUtc().toIso8601String(),
                });
              },
              child: const Text('Créer'),
            ),
          ],
        ),
      ),
    );
    description.dispose();
    if (request == null) return;

    try {
      await widget.api.post('/interventions', request);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Intervention créée.')),
      );
      await load();
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTechnician = widget.api.session.user?['role'] == 'technician';
    return Scaffold(
      appBar: AppBar(
        title: Text(isTechnician ? 'Ma maintenance' : 'Maintenance'),
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
              : RefreshIndicator(
                  onRefresh: load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 24),
                    children: [
                      _viewSelector(),
                      const SizedBox(height: 15),
                      if (selectedView == 'calendar') ...[
                        _monthHeader(),
                        const SizedBox(height: 10),
                        _calendar(),
                        const SizedBox(height: 12),
                        Text(
                          _selectedDateLabel(),
                          style: const TextStyle(
                            color: brandInk,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        _interventionList(_forSelectedDate),
                      ] else if (selectedView == 'requests') ...[
                        const Text(
                          'À planifier',
                          style: TextStyle(
                            color: brandInk,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Interventions sans date programmée',
                          style: TextStyle(
                            color: Color(0xFF778197),
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _interventionList(_unplanned),
                      ] else ...[
                        const Text(
                          'Toutes les interventions',
                          style: TextStyle(
                            color: brandInk,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _interventionList(items),
                      ],
                      if (!isTechnician) ...[
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: createIntervention,
                          icon: const Icon(Icons.calendar_month_rounded),
                          label: const Text('Planifier une maintenance'),
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(48),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }

  List get _forSelectedDate => items.where((raw) {
        final date = _scheduledDate(raw as Map);
        return date != null &&
            date.year == selectedDate.year &&
            date.month == selectedDate.month &&
            date.day == selectedDate.day;
      }).toList();

  List get _unplanned => items.where((raw) {
        final item = raw as Map;
        return item['scheduledAt'] == null &&
            item['status'] != 'completed' &&
            item['status'] != 'cancelled';
      }).toList();

  DateTime? _scheduledDate(Map item) {
    final date = item['status'] == 'completed'
        ? item['endedAt'] ?? item['scheduledAt']
        : item['scheduledAt'];
    return DateTime.tryParse(date?.toString() ?? '')?.toLocal();
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'completed':
        return const Color(0xFF16A34A);
      case 'cancelled':
        return const Color(0xFF98A2B3);
      case 'in_progress':
        return const Color(0xFF2563EB);
      case 'planned':
        return const Color(0xFFD18049);
      default:
        return brandBlue;
    }
  }

  Widget _viewSelector() {
    const views = [
      ('Calendrier', 'calendar'),
      ('Liste', 'list'),
      ('Demandes', 'requests'),
    ];
    return Container(
      height: 42,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE8ECF4)),
      ),
      child: Row(
        children: [
          for (final view in views)
            Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => setState(() => selectedView = view.$2),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selectedView == view.$2
                        ? brandNavy
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Text(
                    view.$1,
                    style: TextStyle(
                      color: selectedView == view.$2
                          ? Colors.white
                          : const Color(0xFF4E5669),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _monthHeader() {
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Planning de maintenance',
            style: TextStyle(
              color: brandInk,
              fontSize: 17,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        IconButton(
          onPressed: () => _moveMonth(-1),
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.chevron_left_rounded, size: 20),
        ),
        Text(
          '${months[visibleMonth.month - 1]} ${visibleMonth.year}',
          style: const TextStyle(
            color: brandInk,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
        IconButton(
          onPressed: () => _moveMonth(1),
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.chevron_right_rounded, size: 20),
        ),
      ],
    );
  }

  void _moveMonth(int amount) {
    setState(() {
      visibleMonth = DateTime(visibleMonth.year, visibleMonth.month + amount);
      selectedDate = DateTime(visibleMonth.year, visibleMonth.month, 1);
    });
  }

  Widget _calendar() {
    const weekDays = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
    final firstWeekday =
        DateTime(visibleMonth.year, visibleMonth.month, 1).weekday;
    final days = DateTime(visibleMonth.year, visibleMonth.month + 1, 0).day;
    final cellCount = ((firstWeekday - 1 + days + 6) ~/ 7) * 7;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(7, 9, 7, 7),
        child: Column(
          children: [
            Row(
              children: [
                for (final day in weekDays)
                  Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: const TextStyle(
                          color: Color(0xFF7A8295),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 5),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: cellCount,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                childAspectRatio: 1.1,
              ),
              itemBuilder: (context, index) {
                final day = index - firstWeekday + 2;
                if (day < 1 || day > days) return const SizedBox.shrink();
                final date =
                    DateTime(visibleMonth.year, visibleMonth.month, day);
                final isSelected = date.year == selectedDate.year &&
                    date.month == selectedDate.month &&
                    date.day == selectedDate.day;
                final scheduledItems = items
                    .where((raw) {
                      final item = raw as Map;
                      final scheduled = _scheduledDate(item);
                      return scheduled != null &&
                          scheduled.year == date.year &&
                          scheduled.month == date.month &&
                          scheduled.day == date.day;
                    })
                    .take(3)
                    .toList();
                return InkWell(
                  borderRadius: BorderRadius.circular(99),
                  onTap: () => setState(() => selectedDate = date),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 27,
                        height: 27,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isSelected ? brandNavy : Colors.transparent,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '$day',
                          style: TextStyle(
                            color: isSelected ? Colors.white : brandInk,
                            fontSize: 10,
                            fontWeight:
                                isSelected ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (final raw in scheduledItems)
                            Container(
                              width: 3,
                              height: 3,
                              margin: const EdgeInsets.symmetric(horizontal: 1),
                              decoration: BoxDecoration(
                                color: _statusColor(
                                    (raw as Map)['status']?.toString()),
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  String _selectedDateLabel() {
    final today = DateTime.now();
    if (selectedDate.year == today.year &&
        selectedDate.month == today.month &&
        selectedDate.day == today.day) {
      return 'Aujourd’hui, ${selectedDate.day} ${_monthName(selectedDate.month)}';
    }
    return '${selectedDate.day} ${_monthName(selectedDate.month)} ${selectedDate.year}';
  }

  String _monthName(int month) => const [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
      ][month - 1];

  Widget _interventionList(List source) {
    if (source.isEmpty) {
      return const EmptyState(
        title: 'Aucune intervention',
        message: 'Les interventions correspondantes apparaîtront ici.',
        icon: Icons.calendar_today_outlined,
      );
    }
    final ordered = [...source]..sort((a, b) {
        final first = _scheduledDate(a as Map);
        final second = _scheduledDate(b as Map);
        if (first == null) return second == null ? 0 : 1;
        if (second == null) return -1;
        return first.compareTo(second);
      });
    return Column(
      children: [
        for (final raw in ordered) _scheduleCard(raw as Map),
      ],
    );
  }

  Widget _scheduleCard(Map item) {
    final scheduledAt = _scheduledDate(item);
    final priority = item['priority']?.toString();
    final statusColor = _statusColor(item['status']?.toString());
    final dateLabel = scheduledAt == null
        ? 'À planifier'
        : [
            if (selectedView != 'calendar')
              '${scheduledAt.day.toString().padLeft(2, '0')}/${scheduledAt.month.toString().padLeft(2, '0')} · ',
            '${scheduledAt.hour.toString().padLeft(2, '0')}:${scheduledAt.minute.toString().padLeft(2, '0')}',
            labelStatus(item['status']?.toString()),
          ].join(' · ');
    final priorityColor = priority == 'urgent' || priority == 'high'
        ? const Color(0xFFE85B64)
        : const Color(0xFFD18049);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => context.go('/interventions/${item['_id']}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.precision_manufacturing_outlined,
                    color: statusColor, size: 22),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      nestedName(item['machineId']).isEmpty
                          ? item['reference']?.toString() ?? 'Intervention'
                          : nestedName(item['machineId']),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: brandInk,
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      item['type']?.toString() ?? 'Maintenance',
                      style: const TextStyle(
                        color: Color(0xFF7A8295),
                        fontSize: 8,
                      ),
                    ),
                    Text(
                      dateLabel,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 8,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                decoration: BoxDecoration(
                  color: priorityColor.withValues(alpha: .1),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  labelStatus(priority),
                  style: TextStyle(
                    color: priorityColor,
                    fontSize: 8,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
