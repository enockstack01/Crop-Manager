import React from 'react';
import { Pressable, View } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from '../components/ui';
import { NAV_SECTIONS } from './navConfig';

export function CustomDrawer(props: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();
  const activeRoute = props.state.routeNames[props.state.index];

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="sprout" size={22} color="#fff" />
          </View>
          <View>
            <AppText weight="800">CropManager</AppText>
            <AppText variant="caption" numberOfLines={1}>{user?.primaryEmailAddress?.emailAddress}</AppText>
          </View>
        </View>

        {NAV_SECTIONS.map((section) => (
          <View key={section.label || 'root'} style={{ marginBottom: spacing.sm }}>
            {section.label ? (
              <AppText
                variant="caption"
                style={{ textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 4 }}
              >
                {section.label}
              </AppText>
            ) : null}
            {section.items.map((item) => {
              const focused = activeRoute === item.route;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => props.navigation.navigate(item.route)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    paddingVertical: 11, paddingHorizontal: spacing.lg, marginHorizontal: spacing.sm,
                    borderRadius: radius.sm, backgroundColor: focused ? colors.primaryLight : 'transparent',
                  }}
                >
                  <MaterialCommunityIcons name={item.icon as any} size={20} color={focused ? colors.primary : colors.textLight} />
                  <AppText color={focused ? colors.primary : colors.text} weight={focused ? '700' : '400'}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      <Pressable
        onPress={() => signOut()}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
        }}
      >
        <MaterialCommunityIcons name="logout" size={20} color={colors.red} />
        <AppText color={colors.red} weight="600">Sign out</AppText>
      </Pressable>
    </View>
  );
}
