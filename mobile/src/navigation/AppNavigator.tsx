import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { ff } from '../theme/theme';
import { useLayout } from '../components/ui';
import { CustomDrawer } from './CustomDrawer';
import { TopBar } from './TopBar';
import { MODULES } from './modules';
import { CrudScreen } from '../screens/CrudScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { CalculatorsScreen } from '../screens/CalculatorsScreen';
import { CalculatorDetailScreen } from '../screens/CalculatorDetailScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { WeatherScreen } from '../screens/WeatherScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { useProfile } from '../lib/useResource';
import { NAV_SECTIONS, ADMIN_SECTION } from './navConfig';
import { AdminOverviewScreen } from '../screens/admin/AdminOverviewScreen';
import { AdminUsersScreen } from '../screens/admin/AdminUsersScreen';
import { AdminUserDetailScreen } from '../screens/admin/AdminUserDetailScreen';
import { AdminOrganizationsScreen } from '../screens/admin/AdminOrganizationsScreen';
import { AdminOrganizationDetailScreen } from '../screens/admin/AdminOrganizationDetailScreen';
import { AdminAIScreen } from '../screens/admin/AdminAIScreen';
import { AdminAuditScreen } from '../screens/admin/AdminAuditScreen';
import { AdminDataScreen } from '../screens/admin/AdminDataScreen';
import { AdminSettingsScreen } from '../screens/admin/AdminSettingsScreen';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function CalculatorsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: ff('600'), fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="calculators-list" component={CalculatorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="calculator-detail" component={CalculatorDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

function useStackOptions() {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.card },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: ff('600'), fontSize: 16 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  } as const;
}

/** User management: the list, then one user. */
function AdminUsersStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="admin-users-list" component={AdminUsersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="admin-user" component={AdminUserDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

/** Organizations: the list, then one organization. */
function AdminOrgsStack() {
  const opts = useStackOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="admin-orgs-list" component={AdminOrganizationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="admin-org" component={AdminOrganizationDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { colors } = useTheme();
  // web: the sidebar is fixed from 768px up and becomes a slide-out menu below it
  const { isTablet } = useLayout();
  const { profile } = useProfile();
  const sections = profile?.is_admin ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;
  return (
    <Drawer.Navigator
      initialRouteName="dashboard"
      drawerContent={(props) => <CustomDrawer {...props} sections={sections} />}
      screenOptions={({ navigation }) => ({
        header: () => <TopBar navigation={navigation} showMenu={!isTablet} />,
        drawerType: isTablet ? 'permanent' : 'front',
        drawerStyle: { width: 260, backgroundColor: '#14532D', borderRightWidth: 0 },
        overlayColor: 'rgba(15,31,20,0.55)',
        sceneStyle: { backgroundColor: colors.bg },
        swipeEdgeWidth: 40,
      })}
    >
      <Drawer.Screen name="dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />

      {MODULES.map((m) => (
        <Drawer.Screen key={m.key} name={m.key} options={{ title: m.title }}>
          {() => <CrudScreen config={m} />}
        </Drawer.Screen>
      ))}

      <Drawer.Screen name="assistant" component={AssistantScreen} options={{ title: 'AI Assistant' }} />
      <Drawer.Screen name="calculators" component={CalculatorsStack} options={{ title: 'Calculators' }} />
      <Drawer.Screen name="reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Drawer.Screen name="calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Drawer.Screen name="weather" component={WeatherScreen} options={{ title: 'Weather' }} />
      <Drawer.Screen name="settings" component={SettingsScreen} options={{ title: 'Settings' }} />

      {profile?.is_admin ? (
        <>
          <Drawer.Screen name="admin-overview" component={AdminOverviewScreen} options={{ title: 'Admin Overview' }} />
          <Drawer.Screen name="admin-users" component={AdminUsersStack} options={{ title: 'User Management' }} />
          <Drawer.Screen name="admin-orgs" component={AdminOrgsStack} options={{ title: 'Organizations' }} />
          <Drawer.Screen name="admin-audit" component={AdminAuditScreen} options={{ title: 'Audit log' }} />
          <Drawer.Screen name="admin-ai" component={AdminAIScreen} options={{ title: 'AI assistant' }} />
          <Drawer.Screen name="admin-data" component={AdminDataScreen} options={{ title: 'Data Browser' }} />
          <Drawer.Screen name="admin-settings" component={AdminSettingsScreen} options={{ title: 'System Settings' }} />
        </>
      ) : null}
    </Drawer.Navigator>
  );
}
