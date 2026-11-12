import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';
import '../core/helpers.dart';
import '../widgets/empty_state.dart';
import '../widgets/error_box.dart';
import '../widgets/brand_title.dart';
import '../widgets/status_badge.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});
  final ApiClient api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List items = [];
  String? error;
  bool loading = true;
  String filter = 'all';
  bool markingAll = false;

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
      final d = await widget.api.get('/notifications');
      if (mounted) setState(() => items = d as List);
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> markRead(String id) async {
    try {
      await widget.api.patch('/notifications/$id/read', {});
      if (!mounted) return;
      setState(() {
        items = items.map((raw) {
          final item = Map<String, dynamic>.from(raw as Map);
          if (item['_id'] == id) {
            item['readAt'] = DateTime.now().toIso8601String();
          }
          return item;
        }).toList();
      });
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    }
  }

  Future<void> markAllRead() async {
    setState(() {
      markingAll = true;
      error = null;
    });
    try {
      await widget.api.patch('/notifications/read-all', {});
      final readAt = DateTime.now().toIso8601String();
      if (mounted) {
        setState(() {
          items = items.map((raw) {
            final item = Map<String, dynamic>.from(raw as Map);
            item['readAt'] ??= readAt;
            return item;
          }).toList();
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = apiMessage(e));
    } finally {
      if (mounted) setState(() => markingAll = false);
    }
  }

  void openNotification(Map notification) {
    final resourceType = notification['resourceType']?.toString();
    final resourceId = notification['resourceId']?.toString() ?? '';
    if (resourceType == 'alert' && resourceId.isNotEmpty) {
      context.go('/alerts/$resourceId');
    } else if (resourceType == 'intervention' && resourceId.isNotEmpty) {
      context.go('/interventions/$resourceId');
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount =
        items.where((raw) => (raw as Map)['readAt'] == null).length;
    final visibleItems = items.where((raw) {
      final unread = (raw as Map)['readAt'] == null;
      return filter == 'all' || unread;
    }).toList();
    return Scaffold(
      appBar: AppBar(
        title: const BrandTitle(title: 'Notifications'),
        actions: [
          if (unreadCount > 0)
            TextButton(
              onPressed: markingAll ? null : markAllRead,
              child: Text(markingAll ? 'En cours…' : 'Tout lire'),
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .primary
                                  .withValues(alpha: .09),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              Icons.notifications_active_outlined,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Centre de notifications',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium),
                                const SizedBox(height: 3),
                                Text(
                                  unreadCount == 0
                                      ? 'Vous êtes à jour.'
                                      : '$unreadCount notification${unreadCount == 1 ? '' : 's'} à consulter',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (error != null) ...[
                    ErrorBox(message: error!, onRetry: load),
                    const SizedBox(height: 8),
                  ],
                  Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Toutes'),
                        selected: filter == 'all',
                        onSelected: (_) => setState(() => filter = 'all'),
                      ),
                      ChoiceChip(
                        label: Text('Non lues ($unreadCount)'),
                        selected: filter == 'unread',
                        onSelected: (_) => setState(() => filter = 'unread'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  if (visibleItems.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 28),
                      child: EmptyState(
                        title: filter == 'unread'
                            ? 'Tout est lu'
                            : 'Aucune notification',
                        message: filter == 'unread'
                            ? 'Les nouvelles notifications non lues apparaîtront ici.'
                            : 'Les nouvelles notifications apparaîtront ici.',
                        icon: Icons.notifications_none_rounded,
                      ),
                    )
                  else
                    for (final raw in visibleItems)
                      _notificationCard(raw as Map),
                ],
              ),
            ),
    );
  }

  Widget _notificationCard(Map notification) {
    final unread = notification['readAt'] == null;
    final createdAt =
        DateTime.tryParse(notification['createdAt']?.toString() ?? '');
    final type = notification['type']?.toString() ?? '';
    final icon = type == 'alert'
        ? Icons.warning_amber_rounded
        : Icons.notifications_outlined;
    return Card(
      color: unread ? const Color(0xFFF8FAFF) : Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () async {
          if (unread) await markRead(notification['_id'].toString());
          if (mounted) openNotification(notification);
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: unread
                    ? Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: .1)
                    : const Color(0xFFF2F4F7),
                child: Icon(
                  icon,
                  color: unread
                      ? Theme.of(context).colorScheme.primary
                      : const Color(0xFF667085),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification['title']?.toString() ?? '',
                            style: TextStyle(
                              fontWeight:
                                  unread ? FontWeight.w700 : FontWeight.w600,
                            ),
                          ),
                        ),
                        if (unread) const StatusBadge(status: 'new'),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      notification['body']?.toString() ?? '',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (createdAt != null) ...[
                      const SizedBox(height: 7),
                      Text(
                        DateFormat('dd/MM/yyyy · HH:mm')
                            .format(createdAt.toLocal()),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                    if (unread)
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton.icon(
                          onPressed: () =>
                              markRead(notification['_id'].toString()),
                          icon: const Icon(Icons.done_rounded, size: 17),
                          label: const Text('Marquer comme lue'),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
