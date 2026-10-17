import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useTheme } from '../theme/ThemeProvider';
import { useLayout } from '../components/ui';
import { CustomDrawer } from './CustomDrawer';
import { TopBar } from './TopBar';
import { ORG_ADMIN_SECTIONS, ORG_STAFF_SECTIONS } from './navConfig';
import { OrgDashboardScreen } from '../screens/org/OrgDashboardScreen';
import { OrgFarmersScreen, OrgLinksScreen, OrgProfileScreen, OrgTeamScreen } from '../screens/org/OrgListScreens';
import { SettingsScreen } from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator();

/** The organization workspace on the phone: overview, farmers, referral links, team and profile. */
export function OrgNavigator({ role }: { role: string }) {
  const { colors } = useTheme();
  const { isTablet } = useLayout();
  const sections = role === 'org_admin' ? ORG_ADMIN_SECTIONS : ORG_STAFF_SECTIONS;
  return (
    <Drawer.Navigator
      initialRouteName="org-dashboard"
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
      <Drawer.Screen name="org-dashboard" component={OrgDashboardScreen} options={{ title: 'Overview' }} />
      <Drawer.Screen name="org-farmers" component={OrgFarmersScreen} options={{ title: 'Farmers' }} />
      <Drawer.Screen name="org-links" component={OrgLinksScreen} options={{ title: 'Referral links' }} />
      {role === 'org_admin' ? <Drawer.Screen name="org-team" component={OrgTeamScreen} options={{ title: 'Team' }} /> : null}
      <Drawer.Screen name="org-profile" component={OrgProfileScreen} options={{ title: 'Organization' }} />
      <Drawer.Screen name="settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  );
}
