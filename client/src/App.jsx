import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

import { AppLayout } from './components/AppLayout.jsx';
import { AuthScreen } from './components/AuthScreen.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Farms from './pages/Farms.jsx';
import Fields from './pages/Fields.jsx';
import Crops from './pages/Crops.jsx';
import Varieties from './pages/Varieties.jsx';
import Seasons from './pages/Seasons.jsx';
import CropCycles from './pages/CropCycles.jsx';
import Planting from './pages/Planting.jsx';
import Activities from './pages/Activities.jsx';
import Irrigation from './pages/Irrigation.jsx';
import Fertilizers from './pages/Fertilizers.jsx';
import CropProtection from './pages/CropProtection.jsx';
import Scouting from './pages/Scouting.jsx';
import Harvest from './pages/Harvest.jsx';
import Inventory from './pages/Inventory.jsx';
import Equipment from './pages/Equipment.jsx';
import Maintenance from './pages/Maintenance.jsx';
import Expenses from './pages/Expenses.jsx';
import Sales from './pages/Sales.jsx';
import Calculators from './pages/Calculators.jsx';
import CalculatorDetail from './pages/CalculatorDetail.jsx';
import Reports from './pages/Reports.jsx';
import Calendar from './pages/Calendar.jsx';
import Assistant from './pages/Assistant.jsx';
import Join from './pages/Join.jsx';
import OrgRegister from './pages/OrgRegister.jsx';
import OrgDashboard from './pages/org/OrgDashboard.jsx';
import OrgFarmers from './pages/org/OrgFarmers.jsx';
import OrgLinks from './pages/org/OrgLinks.jsx';
import { OrgTeam, OrgProfile } from './pages/org/OrgTeamProfile.jsx';
import AdminOrganizations from './pages/admin/AdminOrganizations.jsx';
import AdminOrganizationDetail from './pages/admin/AdminOrganizationDetail.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import { useMyOrg } from './lib/orgApi.js';
import Settings from './pages/Settings.jsx';
import { AdminGuard } from './components/AdminGuard.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminUserDetail from './pages/admin/AdminUserDetail.jsx';
import AdminData from './pages/admin/AdminData.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';

/** Organization staff open their workspace instead of the farm dashboard. */
function Home() {
  const { platformRole } = useMyOrg();
  return platformRole === 'org_user' ? <Navigate to="/org" replace /> : <Dashboard />;
}

export function App() {
  return (
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
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
