import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge } from './ui';
import { HEALTH } from '../lib/greenhouseRules';
import { t } from '../i18n';

const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/** The health card for one photo: the plant, and which counted fruit look diseased (numbered like the marked photo). */
export function HealthCard({ health }: { health?: any }) {
  const { colors } = useTheme();
  const h = health || { status: 'not_checked' };
  const m = HEALTH[h.status] || HEALTH.not_checked;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6, backgroundColor: colors.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Badge label={t(m.label)} tone={m.tone} />
        <AppText weight="700" style={{ fontSize: 14 }}>{t('Plant health')}</AppText>
      </View>
      {h.status === 'not_checked' ? (
        <AppText style={{ fontSize: 13, color: colors.textLight }}>{h.reason ? t(h.reason) : t('The disease check was not done for this photo.')}</AppText>
      ) : (
        <>
          {h.message ? <AppText style={{ fontSize: 13, lineHeight: 19 }}>{t(h.message)}</AppText> : null}
          {h.plant?.disease ? (
            <AppText style={{ fontSize: 12, color: colors.textLight }}>
              {t('The plant in the photo')}: <AppText weight="700" style={{ fontSize: 12 }}>{h.plant.disease}</AppText> ({pct(h.plant.confidence)} {t('sure')})
              {h.plant.alternatives?.length ? `. ${t('Other possibilities')}: ${h.plant.alternatives.map((a: any) => `${a.disease} (${pct(a.confidence)})`).join(', ')}` : ''}
            </AppText>
          ) : null}
          {h.fruits ? (
            <View style={{ gap: 6 }}>
              <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Fruit checked')}: {h.checked_fruit}. {t('Diseased')}: {h.sick_fruit}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {h.fruits.map((f: any) => (
                  <View key={f.index} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: f.status === 'sick' ? '#FFEBEE' : f.status === 'healthy' ? '#E8F5E9' : '#ECEFF1' }}>
                    <AppText weight={f.status === 'sick' ? '700' : '500'} style={{ fontSize: 12, color: f.status === 'sick' ? '#B71C1C' : f.status === 'healthy' ? '#1B5E20' : colors.text }}>
                      #{f.index} {f.status === 'sick' ? f.disease : f.status === 'healthy' ? t('healthy') : t('not sure')}
                    </AppText>
                  </View>
                ))}
              </View>
              {h.sick_fruit > 0 ? <AppText variant="caption">{t('Fruit with a dashed red ring and a ! on the marked photo are the diseased ones.')}</AppText> : null}
            </View>
          ) : null}
          {h.fruit_note ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{t(h.fruit_note)}</AppText> : null}
        </>
      )}
    </View>
  );
}
