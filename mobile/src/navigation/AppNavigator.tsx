import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useLayout } from '../components/ui';
import { CustomDrawer } from './CustomDrawer';
import { TopBar } from './TopBar';
import { BottomBar, FARMER_TABS } from './BottomBar';
import { screenHeader, useStackScreenOptions } from './headers';
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
import { ScanScreen } from '../screens/ScanScreen';
import { OfflineAssistantScreen } from '../screens/OfflineAssistantScreen';
import { MoreScreen } from '../screens/MoreScreen';
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

const Tabs = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

function CalculatorsStack() {
  const opts = useStackScreenOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="calculators-list" component={CalculatorsScreen} options={{ title: 'Calculators' }} />
      <Stack.Screen name="calculator-detail" component={CalculatorDetailScreen} options={{ title: 'Calculators' }} />
    </Stack.Navigator>
  );
}

/** User management: the list, then one user. */
function AdminUsersStack() {
  const opts = useStackScreenOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="admin-users-list" component={AdminUsersScreen} options={{ title: 'User Management' }} />
      <Stack.Screen name="admin-user" component={AdminUserDetailScreen} options={{ title: 'User' }} />
    </Stack.Navigator>
  );
}

/** Organizations: the list, then one organization. */
function AdminOrgsStack() {
  const opts = useStackScreenOptions();
  return (
    <Stack.Navigator screenOptions={opts}>
      <Stack.Screen name="admin-orgs-list" component={AdminOrganizationsScreen} options={{ title: 'Organizations' }} />
      <Stack.Screen name="admin-org" component={AdminOrganizationDetailScreen} options={{ title: 'Organization' }} />
    </Stack.Navigator>
  );
}

/** Every page of the app, shared by the phone tabs and the tablet side menu. */
function screens(Nav: typeof Tabs | typeof Drawer, isAdmin: boolean) {
  const S: any = Nav.Screen;
  return (
    <>
      <S name="dashboard" component={DashboardScreen} options={{ title: 'Home' }} />

      {MODULES.map((m) => (
        <S key={m.key} name={m.key} options={{ title: m.title }}>
          {() => <CrudScreen config={m} />}
        </S>
      ))}

      <S name="assistant" component={AssistantScreen} options={{ title: 'AI Assistant' }} />
      <S name="scan" component={ScanScreen} options={{ title: 'Scan a leaf' }} />
      <S name="offline-assistant" component={OfflineAssistantScreen} options={{ title: 'Offline assistant' }} />
      <S name="calculators" component={CalculatorsStack} options={{ title: 'Calculators', headerShown: false }} />
      <S name="reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <S name="calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <S name="weather" component={WeatherScreen} options={{ title: 'Weather' }} />
      <S name="settings" component={SettingsScreen} options={{ title: 'Settings' }} />

      {isAdmin ? (
        <>
          <S name="admin-overview" component={AdminOverviewScreen} options={{ title: 'Admin Overview' }} />
          <S name="admin-users" component={AdminUsersStack} options={{ title: 'User Management', headerShown: false }} />
          <S name="admin-orgs" component={AdminOrgsStack} options={{ title: 'Organizations', headerShown: false }} />
          <S name="admin-audit" component={AdminAuditScreen} options={{ title: 'Audit log' }} />
          <S name="admin-ai" component={AdminAIScreen} options={{ title: 'AI assistant' }} />
          <S name="admin-data" component={AdminDataScreen} options={{ title: 'Data Browser' }} />
          <S name="admin-settings" component={AdminSettingsScreen} options={{ title: 'System Settings' }} />
        </>
      ) : null}
    </>
  );
}

export function AppNavigator() {
  const { colors } = useTheme();
  // the side menu stays on tablets (web: fixed from 768px up); phones get the bottom tab bar
  const { isTablet } = useLayout();
  const { profile } = useProfile();
  const isAdmin = !!profile?.is_admin;
  const sections = isAdmin ? [...NAV_SECTIONS, ADMIN_SECTION] : NAV_SECTIONS;

  if (!isTablet) {
    return (
      <Tabs.Navigator
        initialRouteName="dashboard"
        backBehavior="history"
        tabBar={(props) => <BottomBar {...props} tabs={FARMER_TABS} />}
        screenOptions={{
          sceneStyle: { backgroundColor: colors.bg },
          header: screenHeader(FARMER_TABS),
        }}
      >
        {screens(Tabs, isAdmin)}
        <Tabs.Screen name="more" options={{ title: 'More' }}>
          {({ navigation }) => <MoreScreen navigation={navigation} sections={sections} />}
        </Tabs.Screen>
      </Tabs.Navigator>
    );
  }

  return (
    <Drawer.Navigator
      initialRouteName="dashboard"
      drawerContent={(props) => <CustomDrawer {...props} sections={sections} />}
      screenOptions={({ navigation }) => ({
        header: ({ options }) => <TopBar title={String(options.title ?? '')} navigation={navigation} />,
        drawerType: 'permanent',
        drawerStyle: { width: 260, backgroundColor: '#1B5E20', borderRightWidth: 0 },
        overlayColor: 'rgba(15,31,20,0.55)',
        sceneStyle: { backgroundColor: colors.bg },
        swipeEdgeWidth: 40,
      })}
    >
      {screens(Drawer, isAdmin)}
    </Drawer.Navigator>
  );
}
