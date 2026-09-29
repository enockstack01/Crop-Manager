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
import { SettingsScreen } from '../screens/SettingsScreen';

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

export function AppNavigator() {
  const { colors } = useTheme();
  // web: the sidebar is fixed from 768px up and becomes a slide-out menu below it
  const { isTablet } = useLayout();
  return (
    <Drawer.Navigator
      initialRouteName="dashboard"
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={({ navigation }) => ({
        header: () => <TopBar navigation={navigation} showMenu={!isTablet} />,
        drawerType: isTablet ? 'permanent' : 'front',
        drawerStyle: { width: 260, backgroundColor: '#1B5E20', borderRightWidth: 0 },
        overlayColor: 'rgba(0,0,0,0.5)',
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

      <Drawer.Screen name="calculators" component={CalculatorsStack} options={{ title: 'Calculators' }} />
      <Drawer.Screen name="reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Drawer.Screen name="calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Drawer.Screen name="settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  );
}
