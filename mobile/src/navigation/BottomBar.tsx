import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { FOREST, ff } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { Icon } from '../components/Icon';
import { PressableScale } from '../components/PressableScale';
import { t } from '../i18n';

export type BarTab = { name: string; label: string; icon: string; center?: boolean };

/** Farmer app: the places people go most. The AI assistant sits in the middle as the main action. */
export const FARMER_TABS: BarTab[] = [
  { name: 'dashboard', label: 'Home', icon: 'house' },
  { name: 'farms', label: 'Farms', icon: 'tractor' },
  { name: 'assistant', label: 'AI Assistant', icon: 'wand-magic-sparkles', center: true },
  { name: 'reports', label: 'Reports', icon: 'file-lines' },
  { name: 'more', label: 'More', icon: 'bars' },
];

/** Organization workspace tabs. */
export const ORG_TABS: BarTab[] = [
  { name: 'org-dashboard', label: 'Overview', icon: 'house' },
  { name: 'org-farmers', label: 'Farmers', icon: 'users' },
  { name: 'org-links', label: 'Referral links', icon: 'link', center: true },
  { name: 'org-profile', label: 'Organization', icon: 'building' },
  { name: 'more', label: 'More', icon: 'bars' },
];

/**
 * Bottom tab bar for phones: icon pill and label, 60 px tall plus the gesture bar inset.
 * Every other page (all the farm records, calculators, calendar, weather, settings, administration)
 * is reached from "More"; those pages keep the More tab lit.
 */
export function BottomBar({ state, navigation, tabs }: BottomTabBarProps & { tabs: BarTab[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index].name;
  const activeTab = tabs.some((x) => x.name === current) ? current : 'more';

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row', backgroundColor: colors.card, paddingBottom: insets.bottom,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
      }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.name;
        const color = active ? colors.primary : colors.textLight;
        return (
          <View key={tab.name} style={{ flex: 1 }}>
          <PressableScale
            feedback="none"
            scaleTo={0.94}
            accessibilityRole="tab"
            accessibilityLabel={t(tab.label)}
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.select();
              navigation.navigate(tab.name);
            }}
            style={{ minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6, paddingBottom: 4 }}
          >
            {tab.center ? (
              <View style={{ width: 44, height: 32, borderRadius: 16, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={tab.icon} size={16} color="#FFFFFF" />
              </View>
            ) : (
              <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primaryLight : 'transparent' }}>
                <Icon name={tab.icon} size={18} color={color} />
              </View>
            )}
            <Text
              style={{ fontSize: 12, lineHeight: 15, fontFamily: ff(active || tab.center ? '700' : '500'), color: tab.center ? colors.primary : color }}
              numberOfLines={1}
            >
              {t(tab.label)}
            </Text>
          </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
