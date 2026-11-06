import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

import { AppLayout } from './components/AppLayout.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Farms = lazy(() => import('./pages/Farms.jsx'));
const Fields = lazy(() => import('./pages/Fields.jsx'));
const Crops = lazy(() => import('./pages/Crops.jsx'));
const Varieties = lazy(() => import('./pages/Varieties.jsx'));
const Seasons = lazy(() => import('./pages/Seasons.jsx'));
const CropCycles = lazy(() => import('./pages/CropCycles.jsx'));
const Planting = lazy(() => import('./pages/Planting.jsx'));
const Activities = lazy(() => import('./pages/Activities.jsx'));
const Irrigation = lazy(() => import('./pages/Irrigation.jsx'));
const Fertilizers = lazy(() => import('./pages/Fertilizers.jsx'));
const CropProtection = lazy(() => import('./pages/CropProtection.jsx'));
const Scouting = lazy(() => import('./pages/Scouting.jsx'));
const Harvest = lazy(() => import('./pages/Harvest.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const Equipment = lazy(() => import('./pages/Equipment.jsx'));
const Maintenance = lazy(() => import('./pages/Maintenance.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const Sales = lazy(() => import('./pages/Sales.jsx'));
const Calculators = lazy(() => import('./pages/Calculators.jsx'));
const CalculatorDetail = lazy(() => import('./pages/CalculatorDetail.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Weather = lazy(() => import('./pages/Weather.jsx'));
const Assistant = lazy(() => import('./pages/Assistant.jsx'));
const Join = lazy(() => import('./pages/Join.jsx'));
const OrgRegister = lazy(() => import('./pages/OrgRegister.jsx'));
const OrgDashboard = lazy(() => import('./pages/org/OrgDashboard.jsx'));
const OrgFarmers = lazy(() => import('./pages/org/OrgFarmers.jsx'));
const OrgLinks = lazy(() => import('./pages/org/OrgLinks.jsx'));
const OrgTeam = lazy(() => import('./pages/org/OrgTeamProfile.jsx').then((m) => ({ default: m.OrgTeam })));
const OrgProfile = lazy(() => import('./pages/org/OrgTeamProfile.jsx').then((m) => ({ default: m.OrgProfile })));
const AdminOrganizations = lazy(() => import('./pages/admin/AdminOrganizations.jsx'));
const AdminOrganizationDetail = lazy(() => import('./pages/admin/AdminOrganizationDetail.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit.jsx'));
const AdminAI = lazy(() => import('./pages/admin/AdminAI.jsx'));
import { useMyOrg } from './lib/orgApi.js';
const Settings = lazy(() => import('./pages/Settings.jsx'));
import { AdminGuard } from './components/AdminGuard.jsx';
import { Loading } from './components/ui.jsx';
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail.jsx'));
const AdminData = lazy(() => import('./pages/admin/AdminData.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings.jsx'));

/** Organization staff open their workspace instead of the farm dashboard. */
function Home() {
  const { platformRole } = useMyOrg();
  return platformRole === 'org_user' ? <Navigate to="/org" replace /> : <Dashboard />;
}

export function App() {
  return (
    <Suspense fallback={<Loading label="Loading..." />}>
    <Routes>
      <Route path="/sign-in/*" element={<AuthScreen mode="sign-in" />} />
      <Route path="/sign-up/*" element={<AuthScreen mode="sign-up" />} />
      {/* an organization referral link, and organization sign-up: open to signed-out visitors */}
      <Route path="/join/:token" element={<Join />} />
      <Route path="/organization/register" element={<OrgRegister />} />

      <Route
        element={
          <>
            <SignedIn>
              <AppLayout />
            </SignedIn>
            <SignedOut>
              <Navigate to="/sign-in" replace />
            </SignedOut>
          </>
        }
      >
        <Route index element={<Home />} />
        <Route path="farms" element={<Farms />} />
        <Route path="fields" element={<Fields />} />
        <Route path="crops" element={<Crops />} />
        <Route path="varieties" element={<Varieties />} />
        <Route path="seasons" element={<Seasons />} />
        <Route path="crop-cycles" element={<CropCycles />} />
        <Route path="planting" element={<Planting />} />
        <Route path="activities" element={<Activities />} />
        <Route path="irrigation" element={<Irrigation />} />
        <Route path="fertilizers" element={<Fertilizers />} />
        <Route path="crop-protection" element={<CropProtection />} />
        <Route path="scouting" element={<Scouting />} />
        <Route path="harvest" element={<Harvest />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="equipment" element={<Equipment />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="sales" element={<Sales />} />
        <Route path="calculators" element={<Calculators />} />
        <Route path="calculators/:type" element={<CalculatorDetail />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="reports" element={<Reports />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="weather" element={<Weather />} />
        <Route path="settings" element={<Settings />} />

        <Route path="org">
          <Route index element={<OrgDashboard />} />
          <Route path="farmers" element={<OrgFarmers />} />
          <Route path="links" element={<OrgLinks />} />
          <Route path="team" element={<OrgTeam />} />
          <Route path="profile" element={<OrgProfile />} />
        </Route>

        <Route path="admin" element={<AdminGuard />}>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<AdminUserDetail />} />
          <Route path="data" element={<AdminData />} />
          <Route path="organizations" element={<AdminOrganizations />} />
          <Route path="organizations/:orgId" element={<AdminOrganizationDetail />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="ai" element={<AdminAI />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
