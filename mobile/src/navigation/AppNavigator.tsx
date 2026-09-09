import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { CustomDrawer } from './CustomDrawer';
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
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="calculators-list" component={CalculatorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="calculator-detail" component={CalculatorDetailScreen} options={{ title: 'Calculator' }} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      initialRouteName="dashboard"
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        drawerType: 'front',
        drawerStyle: { width: 300 },
      }}
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
