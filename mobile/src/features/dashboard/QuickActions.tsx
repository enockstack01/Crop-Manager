import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { FOREST, ff, radius } from '../../theme/theme';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { t } from '../../i18n';

const ACTIONS = [
  { route: 'assistant', label: 'AI Assistant', icon: 'wand-magic-sparkles' },
  { route: 'scan', label: 'Scan a plant', icon: 'leaf' },
  { route: 'offline-tools', label: 'Offline tools', icon: 'cloud-off-outline' },
  { route: 'expenses', label: 'Expenses', icon: 'receipt' },
  { route: 'harvest', label: 'Harvest', icon: 'wheat-awn' },
  { route: 'scouting', label: 'Crop Scouting', icon: 'magnifying-glass' },
  { route: 'weather', label: 'Weather', icon: 'cloud-sun' },
  { route: 'calendar', label: 'Calendar', icon: 'calendar-check' },
];

/** Shortcuts under the greeting: a round green icon and a label, scrolling sideways on phones. */
export function QuickActions({ onOpen }: { onOpen: (route: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }} style={{ flexGrow: 0 }}>
      {ACTIONS.map((a) => (
        <PressableScale
          key={a.route}
          onPress={() => onOpen(a.route)}
          scaleTo={0.96}
          accessibilityRole="button"
          accessibilityLabel={t(a.label)}
          style={{
            width: 96, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 6,
            backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: FOREST, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={a.icon} size={16} color="#FFFFFF" />
          </View>
          <Text style={{ fontFamily: ff('700'), fontSize: 13, color: colors.text, textAlign: 'center' }} numberOfLines={2}>{t(a.label)}</Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}
