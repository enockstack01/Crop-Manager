import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText } from '../components/ui';
import { LeafLogo } from '../components/LeafLogo';
import { useConfirm } from '../components/Confirm';
import { haptics } from '../lib/haptics';
import { NAV_SECTIONS } from './navConfig';

export function CustomDrawer(props: DrawerContentComponentProps) {
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();
  const { user } = useUser();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const activeRoute = props.state.routeNames[props.state.index];

  const name = user?.fullName || user?.firstName || 'Your account';
  const email = user?.primaryEmailAddress?.emailAddress;
  const initials = (name.match(/\b\w/g) || ['?']).slice(0, 2).join('').toUpperCase();

  const onSignOut = async () => {
    const ok = await confirm('Sign out of CropManager on this device?', { confirmLabel: 'Sign out', danger: true });
    if (ok) signOut();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.card }}>
      <LinearGradient
        colors={isDark ? ['#1B5E20', '#0F2E12'] : ['#43A047', '#1B5E20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
          <LeafLogo size={34} tile />
          <AppText weight="800" style={{ color: '#fff', fontSize: 18 }}>CropManager</AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {user?.hasImage && user.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }} />
          ) : (
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <AppText weight="800" style={{ color: '#fff', fontSize: 16 }}>{initials}</AppText>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <AppText weight="700" numberOfLines={1} style={{ color: '#fff' }}>{name}</AppText>
            {email ? <AppText numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{email}</AppText> : null}
          </View>
        </View>
      </LinearGradient>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: spacing.sm }}>
        {NAV_SECTIONS.map((section) => (
          <View key={section.label || 'root'} style={{ marginBottom: spacing.xs }}>
            {section.label ? (
              <AppText
                variant="caption"
                weight="700"
                style={{ textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 4 }}
              >
                {section.label}
              </AppText>
            ) : null}
            {section.items.map((item) => {
              const focused = activeRoute === item.route;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => {
                    haptics.select();
                    props.navigation.navigate(item.route);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: focused }}
                  android_ripple={{ color: colors.primaryLight }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                    paddingVertical: 11, paddingHorizontal: spacing.md, marginHorizontal: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: focused ? colors.primaryLight : pressed ? colors.bg : 'transparent',
                  })}
                >
                  {focused ? (
                    <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.primary }} />
                  ) : null}
                  <MaterialCommunityIcons name={item.icon as any} size={21} color={focused ? colors.primary : colors.textLight} />
                  <AppText color={focused ? colors.primary : colors.text} weight={focused ? '700' : '500'}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        android_ripple={{ color: colors.primaryLight }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border,
        }}
      >
        <MaterialCommunityIcons name="logout" size={20} color={colors.red} />
        <AppText color={colors.red} weight="700">Sign out</AppText>
      </Pressable>
    </View>
  );
}
