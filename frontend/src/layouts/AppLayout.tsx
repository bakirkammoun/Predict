import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  Factory,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sun,
  CheckCheck,
  Clock3,
  UserCircle2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { PERIODS, usePeriod } from "../lib/period";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { api } from "../lib/api";
import { ListSelect } from "../components/ListSelect";
import { when } from "../lib/format";

const links = [
  { section: "ESPACE", to: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "PARC & MAINTENANCE", to: "/machines", label: "Parc machines", icon: Factory, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "PARC & MAINTENANCE", to: "/measurements", label: "Mesures", icon: Activity, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "PARC & MAINTENANCE", to: "/alerts", label: "Alertes", icon: AlertTriangle, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "PARC & MAINTENANCE", to: "/interventions", label: "Interventions", icon: Wrench, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "PARC & MAINTENANCE", to: "/calendar", label: "Calendrier", icon: CalendarDays, roles: ["admin", "maintenance_manager", "technician"] },
  { section: "GESTION", to: "/users", label: "Utilisateurs", icon: Users, roles: ["admin", "maintenance_manager"] },
  { section: "GESTION", to: "/reports", label: "Rapports", icon: Gauge, roles: ["admin", "maintenance_manager"] },
  { section: "GESTION", to: "/settings", label: "Seuils & système", icon: SlidersHorizontal, roles: ["admin"] },
  { section: "GESTION", to: "/devices", label: "Appareils IoT", icon: Activity, roles: ["admin"] },
  { section: "GESTION", to: "/simulation", label: "Simulation", icon: Settings, roles: ["admin", "maintenance_manager"] },
  { section: "GESTION", to: "/audit", label: "Journaux", icon: ScrollText, roles: ["admin"] },
  { section: "COMPTE", to: "/profile", label: "Profil", icon: UserCircle2, roles: ["admin", "maintenance_manager", "technician"] },
];

const roleLabels = {
  admin: "Administrateur",
  maintenance_manager: "Responsable maintenance",
  technician: "Technicien",
} as const;

const pageTitles: Record<string, string> = {
  "/": "Tableau de bord",
  "/machines": "Parc machines",
  "/measurements": "Mesures",
  "/alerts": "Alertes",
  "/interventions": "Interventions",
  "/calendar": "Calendrier",
  "/users": "Utilisateurs",
  "/reports": "Rapports",
  "/settings": "Seuils & système",
  "/devices": "Appareils IoT",
  "/simulation": "Simulation",
  "/audit": "Journaux",
  "/profile": "Profil",
};

export function AppLayout() {
  const { user, logout, hasRole } = useAuth();
  const { hours, setHours } = usePeriod();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(() => localStorage.getItem("pm_theme") === "dark");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifs, setNotifs] = useState<{
    _id: string;
    title: string;
    body: string;
    readAt?: string;
    createdAt?: string;
    resourceType?: string;
    resourceId?: string;
  }[]>([]);
  const [notificationError, setNotificationError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const notificationPanelRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pm_theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const s = connectSocket();
    const loadNotifications = () => {
      setNotificationsLoading(true);
      api.get("/notifications")
        .then((r) => {
          setNotifs(r.data.data ?? []);
          setNotificationError("");
        })
        .catch(() => setNotificationError("Impossible de charger les notifications."))
        .finally(() => setNotificationsLoading(false));
    };
    const onNotification = (notification: (typeof notifs)[number]) => {
      setNotifs((prev) => [
        notification,
        ...prev.filter((item) => item._id !== notification._id),
      ].slice(0, 50));
    };
    loadNotifications();
    s?.on("connect", loadNotifications);
    s?.on("notification:new", onNotification);
    s?.on("alert:new", loadNotifications);
    return () => {
      s?.off("connect", loadNotifications);
      s?.off("notification:new", onNotification);
      s?.off("alert:new", loadNotifications);
      disconnectSocket();
    };
  }, []);

  const unread = notifs.filter((n) => !n.readAt).length;
  const markNotificationRead = async (id: string) => {
    setNotificationError("");
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((item) =>
        item._id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ));
    } catch {
      setNotificationError("Impossible de marquer cette notification comme lue.");
    }
  };
  const markAllNotificationsRead = async () => {
    setNotificationError("");
    setMarkingAllRead(true);
    try {
      await api.patch("/notifications/read-all");
      const readAt = new Date().toISOString();
      setNotifs((prev) => prev.map((item) => item.readAt ? item : { ...item, readAt }));
    } catch {
      setNotificationError("Impossible de marquer les notifications comme lues.");
    } finally {
      setMarkingAllRead(false);
    }
  };
  const openNotification = async (notification: (typeof notifs)[number]) => {
    if (!notification.readAt) await markNotificationRead(notification._id);
    notificationPanelRef.current?.removeAttribute("open");
    if (notification.resourceType === "alert") {
      navigate("/alerts");
    } else if (notification.resourceType === "intervention") {
      navigate(notification.resourceId ? `/interventions/${notification.resourceId}` : "/interventions");
    }
  };
  const activeLink = links.find((link) =>
    link.to === "/" ? location.pathname === "/" : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`),
  );
  const pageTitle = location.pathname.startsWith("/machines/") && location.pathname !== "/machines"
    ? "Détail machine"
    : location.pathname.startsWith("/interventions/") && location.pathname !== "/interventions"
      ? "Détail intervention"
      : pageTitles[location.pathname] ?? activeLink?.label ?? "PrédiMaint";

  return (
    <div className="app-shell flex min-h-screen bg-slate-50 text-slate-800 dark:bg-anthracite-900 dark:text-slate-100">
      {menuOpen ? (
        <button
          aria-label="Fermer le menu"
          className="fixed inset-0 z-20 bg-slate-900/30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <aside
        className={`app-sidebar ${
          menuOpen ? "flex" : "hidden"
        } fixed inset-y-0 left-0 z-30 w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-anthracite-800 md:sticky md:top-0 md:flex md:h-screen md:w-[248px]`}
      >
        <div className="app-brand flex items-center gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-700">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
            <Factory size={20} />
          </span>
          <div className="app-brand-label">
            <p className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">PrédiMaint</p>
            <p className="text-xs text-slate-500">Maintenance intelligente</p>
          </div>
          <button
            className="app-menu-close"
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Navigation principale" className="app-nav flex flex-1 flex-col gap-1 overflow-auto px-3 py-3">
          {links
            .filter((l) => hasRole(...(l.roles as never[])))
            .map((l, i, visibleLinks) => {
              const sectionStart = i === 0 || visibleLinks[i - 1]?.section !== l.section;
              return (
                <div className={`app-nav-item ${sectionStart && i > 0 ? "app-nav-section-start" : ""}`} key={l.to}>
                  {sectionStart && (
                    <p className="app-nav-section-label">{l.section}</p>
                  )}
                  <NavLink
                    to={l.to}
                    end={l.to === "/"}
                    title={l.label}
                    className={({ isActive }) =>
                      `app-nav-link flex h-10 w-full shrink-0 items-center gap-3 rounded-2xl px-3 text-sm transition ${
                        isActive
                          ? "bg-indigo-50 font-semibold text-brand dark:bg-indigo-950/50 dark:text-indigo-200"
                          : "text-slate-500 hover:bg-slate-50 hover:text-brand dark:text-slate-300 dark:hover:bg-anthracite"
                      }`
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    <l.icon size={18} strokeWidth={2} />
                    <span className="app-nav-label">{l.label}</span>
                  </NavLink>
                </div>
              );
            })}
        </nav>
        <div className="app-sidebar-footer gap-3 px-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-brand dark:bg-indigo-950/50">
            {user?.firstName?.slice(0, 1)}{user?.lastName?.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-xs text-slate-500">{user ? roleLabels[user.role] : ""}</p>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-header sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-anthracite-800/90">
          <div className="app-header-main">
            <button className="btn btn-ghost app-menu-toggle" type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Ouvrir le menu">
              <Menu size={18} />
            </button>
            <div className="app-page-context">
              <p>{activeLink?.section ?? "ESPACE DE TRAVAIL"}</p>
              <h2>{pageTitle}</h2>
            </div>
            <form
              className="app-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/machines?search=${encodeURIComponent(search)}`);
              }}
            >
              <label className="sr-only" htmlFor="global-search">
                Recherche
              </label>
              <span className="app-search-icon" aria-hidden="true"><Search size={17} /></span>
              <input
                id="global-search"
                placeholder="Rechercher une machine…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          </div>
          <div className="app-header-actions">
            <div className="app-period-wrap">
              <ListSelect
                className="app-period-select"
                ariaLabel="Période des données"
                value={String(hours)}
                onChange={(value) => setHours(Number(value))}
                options={PERIODS.map((period) => ({ value: String(period.hours), label: period.label }))}
              />
            </div>
            <button className="btn btn-ghost app-header-icon" onClick={() => setDark((d) => !d)} aria-label="Thème" title="Changer de thème">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <details className="app-notifications" ref={notificationPanelRef}>
              <summary
                className="btn btn-ghost app-header-icon relative cursor-pointer list-none"
                aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}
                title="Notifications"
              >
                <Bell size={18} />
                {unread > 0 ? (
                  <span className="app-notification-count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </summary>
              <section className="app-notification-panel" aria-label="Centre de notifications">
                <header className="app-notification-heading">
                  <div>
                    <h2>Notifications</h2>
                    <p>{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}</p>
                  </div>
                  {unread > 0 && (
                    <button
                      type="button"
                      className="app-notification-mark-all"
                      disabled={markingAllRead}
                      onClick={() => void markAllNotificationsRead()}
                    >
                      <CheckCheck size={15} />
                      {markingAllRead ? "En cours…" : "Tout marquer lu"}
                    </button>
                  )}
                </header>
                {notificationError ? (
                  <div className="app-notification-state app-notification-error" role="alert">
                    <p>{notificationError}</p>
                    <button type="button" onClick={() => {
                      setNotificationsLoading(true);
                      api.get("/notifications")
                        .then((response) => {
                          setNotifs(response.data.data ?? []);
                          setNotificationError("");
                        })
                        .catch(() => setNotificationError("Impossible de charger les notifications."))
                        .finally(() => setNotificationsLoading(false));
                    }}>
                      Réessayer
                    </button>
                  </div>
                ) : notificationsLoading ? (
                  <p className="app-notification-state" role="status">Chargement des notifications…</p>
                ) : notifs.length === 0 ? (
                  <div className="app-notification-state">
                    <Bell size={23} />
                    <p>Aucune notification pour le moment.</p>
                  </div>
                ) : (
                  <ul className="app-notification-list">
                    {notifs.slice(0, 12).map((notification) => (
                      <li
                        key={notification._id}
                        className={`app-notification-item ${notification.readAt ? "" : "is-unread"}`}
                      >
                        <button
                          type="button"
                          className="app-notification-open"
                          onClick={() => void openNotification(notification)}
                        >
                          <span className="app-notification-dot" aria-hidden="true" />
                          <span className="app-notification-copy">
                            <strong>{notification.title}</strong>
                            <span>{notification.body}</span>
                            <small><Clock3 size={12} />{when(notification.createdAt)}</small>
                          </span>
                        </button>
                        {!notification.readAt && (
                          <button
                            type="button"
                            className="app-notification-read"
                            aria-label={`Marquer « ${notification.title} » comme lue`}
                            title="Marquer comme lue"
                            onClick={() => void markNotificationRead(notification._id)}
                          >
                            <Check size={15} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <footer className="app-notification-footer">
                  <button type="button" onClick={() => {
                    notificationPanelRef.current?.removeAttribute("open");
                    navigate("/alerts");
                  }}>
                    Voir le centre des alertes
                  </button>
                </footer>
              </section>
            </details>
            <div className="app-user-summary">
              <span className="app-user-avatar">
                {user?.firstName?.slice(0, 1)}{user?.lastName?.slice(0, 1)}
              </span>
              <div className="app-user-copy">
                <p>{user?.firstName} {user?.lastName}</p>
                <span>{user ? roleLabels[user.role] : ""}</span>
              </div>
            </div>
            <button
              className="btn btn-ghost app-header-icon"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="app-main flex-1 p-4 md:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
