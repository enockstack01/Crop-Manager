import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useTheme } from '../theme/ThemeProvider';
import { useLayout } from '../components/ui';
import { CustomDrawer } from './CustomDrawer';
import { TopBar } from './TopBar';
import { BottomBar, ORG_TABS } from './BottomBar';
import { screenHeader } from './headers';
import { ORG_ADMIN_SECTIONS, ORG_STAFF_SECTIONS } from './navConfig';
import { OrgDashboardScreen } from '../screens/org/OrgDashboardScreen';
import { OrgFarmersScreen, OrgLinksScreen, OrgProfileScreen, OrgTeamScreen } from '../screens/org/OrgListScreens';
import { OrgActivityScreen, OrgFarmerScreen, OrgInvitesScreen } from '../screens/org/OrgWorkspaceScreens';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MoreScreen } from '../screens/MoreScreen';

const Tabs = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

/** The organization pages, shared by the phone tabs and the tablet side menu. */
function screens(Nav: typeof Tabs | typeof Drawer, role: string) {
  const S: any = Nav.Screen;
  return (
    <>
      <S name="org-dashboard" component={OrgDashboardScreen} options={{ title: 'Overview' }} />
      <S name="org-farmers" component={OrgFarmersScreen} options={{ title: 'Farmers' }} />
      <S name="org-invitations" component={OrgInvitesScreen} options={{ title: 'Invitations' }} />
      <S name="org-farmer" component={OrgFarmerScreen} options={{ title: 'Farmer' }} />
      <S name="org-links" component={OrgLinksScreen} options={{ title: 'Referral links' }} />
      {role === 'org_admin' ? <S name="org-team" component={OrgTeamScreen} options={{ title: 'Team' }} /> : null}
      <S name="org-profile" component={OrgProfileScreen} options={{ title: 'Organization' }} />
      {role === 'org_admin' ? <S name="org-activity" component={OrgActivityScreen} options={{ title: 'Activity' }} /> : null}
      <S name="settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </>
  );
}

/** The organization workspace on the phone: overview, farmers, referral links, team and profile. */
export function OrgNavigator({ role }: { role: string }) {
  const { colors } = useTheme();
  const { isTablet } = useLayout();
  const sections = role === 'org_admin' ? ORG_ADMIN_SECTIONS : ORG_STAFF_SECTIONS;

  if (!isTablet) {
    return (
      <Tabs.Navigator
        initialRouteName="org-dashboard"
        backBehavior="history"
        tabBar={(props) => <BottomBar {...props} tabs={ORG_TABS} />}
        screenOptions={{
          sceneStyle: { backgroundColor: colors.bg },
          header: screenHeader(ORG_TABS, 'org-dashboard'),
        }}
      >
        {screens(Tabs, role)}
        <Tabs.Screen name="more" options={{ title: 'More' }}>
          {({ navigation }) => <MoreScreen navigation={navigation} sections={sections} />}
        </Tabs.Screen>
      </Tabs.Navigator>
    );
  }

  return (
    <Drawer.Navigator
      initialRouteName="org-dashboard"
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
      {screens(Drawer, role)}
    </Drawer.Navigator>
  );
}
