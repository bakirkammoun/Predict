import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { api, apiError } from "../lib/api";
import { Badge } from "../components/Badge";
import { Empty } from "../components/Empty";
import { PageHeader } from "../components/PageHeader";

type CalendarIntervention = {
  _id: string;
  reference?: string;
  problemDescription?: string;
  scheduledAt?: string;
  endedAt?: string;
  status?: string;
  priority?: string;
  machineId?: { name?: string; code?: string };
};

type CalendarView = "month" | "week";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value?: string) {
  if (!value) return "Horaire à confirmer";
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function calendarDate(intervention: CalendarIntervention) {
  return intervention.status === "completed"
    ? intervention.endedAt ?? intervention.scheduledAt
    : intervention.scheduledAt;
}

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [rows, setRows] = useState<CalendarIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { from, to, label } = useMemo(() => {
    let from: Date;
    let to: Date;
    let label: string;
    if (view === "week") {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
      to = new Date(from);
      to.setDate(to.getDate() + 6);
      to.setHours(23, 59, 59, 999);
      const startLabel = from.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
      const endLabel = to.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
      label = `${startLabel} – ${endLabel}`;
    } else {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      label = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    return { from, to, label };
  }, [cursor, view]);

  useEffect(() => {
    let active = true;
    const loadMonth = async () => {
      setLoading(true);
      setError("");
      setRows([]);
      try {
        const query = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: "100",
          page: "1",
          calendar: "true",
        });
        const firstPage = await api.get(`/interventions?${query.toString()}`);
        const total = Number(firstPage.data.meta?.total ?? firstPage.data.data.length);
        const pageCount = Math.ceil(total / 100);
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
            api.get(`/interventions?${new URLSearchParams({
              from: from.toISOString(),
              to: to.toISOString(),
              limit: "100",
              page: String(index + 2),
              calendar: "true",
            }).toString()}`),
          ),
        );
        if (active) {
          setRows([
            ...firstPage.data.data,
            ...remainingPages.flatMap((response) => response.data.data),
          ]);
        }
      } catch (requestError) {
        if (active) setError(apiError(requestError));
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMonth();
    return () => {
      active = false;
    };
  }, [from, to]);

  const calendarDays = useMemo(() => {
    const firstWeekday = view === "week" ? 0 : (from.getDay() + 6) % 7;
    const dayCount = view === "week"
      ? 7
      : new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + dayCount) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      return dayNumber > 0 && dayNumber <= dayCount
        ? view === "week"
          ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + index)
          : new Date(from.getFullYear(), from.getMonth(), dayNumber)
        : null;
    });
  }, [from, view]);

  const interventionsByDay = useMemo(() => {
    const groups = new Map<string, CalendarIntervention[]>();
    rows.forEach((intervention) => {
      const eventDate = calendarDate(intervention);
      if (!eventDate) return;
      const key = dateKey(new Date(eventDate));
      groups.set(key, [...(groups.get(key) ?? []), intervention]);
    });
    return groups;
  }, [rows]);

  const urgentCount = rows.filter((item) => item.priority === "urgent").length;
  const completedCount = rows.filter((item) => item.status === "completed").length;
  const todayKey = dateKey(new Date());

  const changePeriod = (amount: number) => {
    setCursor((current) => {
      const next = new Date(current);
      if (view === "week") next.setDate(next.getDate() + amount * 7);
      else next.setMonth(next.getMonth() + amount);
      return next;
    });
  };

  return (
    <div className="calendar-page space-y-4">
      <PageHeader
        section="PARC & MAINTENANCE"
        title="Calendrier des interventions"
        description="Visualisez les opérations planifiées et leur répartition dans le mois."
        actions={
          <div className="calendar-controls" aria-label="Navigation du calendrier">
            <button
              className="btn btn-ghost calendar-nav-button"
              aria-label={view === "week" ? "Semaine précédente" : "Mois précédent"}
              onClick={() => changePeriod(-1)}
            >
              <ChevronLeft size={17} />
              <span>Précédent</span>
            </button>
            <span className="calendar-current-month" aria-live="polite">{label}</span>
            <button
              className="btn btn-ghost calendar-nav-button"
              onClick={() => setCursor(new Date())}
            >
              Aujourd’hui
            </button>
            <div className="calendar-view-switch" aria-label="Période affichée">
              <button
                type="button"
                className={`calendar-view-button ${view === "month" ? "calendar-view-button-active" : ""}`}
                aria-pressed={view === "month"}
                onClick={() => setView("month")}
              >
                Mois
              </button>
              <button
                type="button"
                className={`calendar-view-button ${view === "week" ? "calendar-view-button-active" : ""}`}
                aria-pressed={view === "week"}
                onClick={() => setView("week")}
              >
                Semaine
              </button>
            </div>
            <button
              className="btn btn-ghost calendar-nav-button"
              aria-label={view === "week" ? "Semaine suivante" : "Mois suivant"}
              onClick={() => changePeriod(1)}
            >
              <span>Suivant</span>
              <ChevronRight size={17} />
            </button>
          </div>
        }
      />

      <section className="calendar-summary" aria-label="Résumé du mois">
        <article className="calendar-summary-card">
          <span className="calendar-summary-icon"><CalendarDays size={18} /></span>
          <div><p>Interventions datées</p><strong>{loading ? "—" : rows.length}</strong></div>
        </article>
        <article className="calendar-summary-card">
          <span className="calendar-summary-icon calendar-summary-icon-alert"><AlertTriangle size={18} /></span>
          <div><p>Priorité urgente</p><strong>{loading ? "—" : urgentCount}</strong></div>
        </article>
        <article className="calendar-summary-card">
          <span className="calendar-summary-icon calendar-summary-icon-done"><CheckCircle2 size={18} /></span>
          <div><p>Terminées</p><strong>{loading ? "—" : completedCount}</strong></div>
        </article>
      </section>

      {error && <p className="calendar-error" role="alert">{error}</p>}

      <section className="calendar-board" aria-label={`Calendrier des interventions pour ${label}`}>
        <div className="calendar-weekdays" aria-hidden="true">
          {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
        </div>
        <div className="calendar-grid" aria-live="polite">
          {calendarDays.map((date, index) => {
            if (!date) return <div className="calendar-day calendar-day-empty" key={`empty-${index}`} aria-hidden="true" />;
            const dayKey = dateKey(date);
            const dayInterventions = interventionsByDay.get(dayKey) ?? [];
            return (
              <div className={`calendar-day ${dayKey === todayKey ? "calendar-day-today" : ""}`} key={dayKey}>
                <div className="calendar-day-heading">
                  <span className="calendar-day-number">{date.getDate()}</span>
                  {dayInterventions.length > 0 && (
                    <span className="calendar-day-count" aria-label={`${dayInterventions.length} intervention(s)`}>
                      {dayInterventions.length}
                    </span>
                  )}
                </div>
                <div className="calendar-day-events">
                  {dayInterventions.map((intervention) => {
                    const status = intervention.status || "planned";
                    const eventDate = calendarDate(intervention);
                    const dateLabel = status === "completed" ? "Terminée" : "Prévue";
                    const detailTitle = [
                      intervention.problemDescription || intervention.reference || "Intervention",
                      intervention.machineId?.name || "Machine non précisée",
                      `${dateLabel} à ${formatTime(eventDate)}`,
                    ].join("\n");
                    return (
                      <Link
                        className={[
                          "calendar-event",
                          `calendar-event-${status}`,
                          intervention.priority === "urgent" && status !== "completed" ? "calendar-event-urgent" : "",
                        ].filter(Boolean).join(" ")}
                        key={intervention._id}
                        to={`/interventions/${intervention._id}`}
                        title={detailTitle}
                        aria-label={`${intervention.reference || "Intervention"} — ${detailTitle}`}
                      >
                        <span className="calendar-event-time">
                          {status === "completed" ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                          {dateLabel} · {formatTime(eventDate)}
                        </span>
                        <strong>{intervention.reference || "Intervention"}</strong>
                        <span className="calendar-event-machine">{intervention.machineId?.name || "Machine non précisée"}</span>
                        <Badge value={status} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {!loading && !error && rows.length === 0 && (
          <div className="calendar-empty">
            <Empty title="Aucune intervention planifiée ce mois-ci" hint="Les interventions avec une date prévue apparaîtront ici." />
          </div>
        )}
        {loading && <p className="calendar-loading" role="status">Chargement du calendrier…</p>}
      </section>
    </div>
  );
}
