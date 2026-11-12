import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MachinesPage } from "./pages/MachinesPage";
import { MachineDetailPage } from "./pages/MachineDetailPage";
import { MeasurementsPage } from "./pages/MeasurementsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { InterventionsPage } from "./pages/InterventionsPage";
import { InterventionDetailPage } from "./pages/InterventionDetailPage";
import { CalendarPage } from "./pages/CalendarPage";
import { UsersPage } from "./pages/UsersPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { AuditPage } from "./pages/AuditPage";
import { SimulationPage } from "./pages/SimulationPage";
import { DevicesPage } from "./pages/DevicesPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import type { Role } from "./lib/api";

function Guard({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Chargement de la session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <Guard>
            <AppLayout />
          </Guard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="machines/:id" element={<MachineDetailPage />} />
        <Route path="measurements" element={<MeasurementsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="interventions" element={<InterventionsPage />} />
        <Route path="interventions/:id" element={<InterventionDetailPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route
          path="users"
          element={
            <Guard roles={["admin", "maintenance_manager"]}>
              <UsersPage />
            </Guard>
          }
        />
        <Route
          path="reports"
          element={
            <Guard roles={["admin", "maintenance_manager"]}>
              <ReportsPage />
            </Guard>
          }
        />
        <Route
          path="settings"
          element={
            <Guard roles={["admin"]}>
              <SettingsPage />
            </Guard>
          }
        />
        <Route
          path="simulation"
          element={
            <Guard roles={["admin", "maintenance_manager"]}>
              <SimulationPage />
            </Guard>
          }
        />
        <Route
          path="devices"
          element={
            <Guard roles={["admin"]}>
              <DevicesPage />
            </Guard>
          }
        />
        <Route
          path="audit"
          element={
            <Guard roles={["admin"]}>
              <AuditPage />
            </Guard>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
