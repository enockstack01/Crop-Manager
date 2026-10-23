import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { aiWeatherBriefing } from '../lib/ai';
import { useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme/theme';
import { AppText, ChartCard, EmptyState, Grid, Loading, PageHeader, Screen } from '../components/ui';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { SelectField } from '../components/fields';
import { t } from '../i18n';

export const WEATHER_ICON: Record<string, string> = {
  clear: 'sun', partly: 'cloud-sun', clouds: 'cloud', fog: 'smog', drizzle: 'cloud-rain', rain: 'cloud-showers-heavy', storm: 'bolt', snow: 'snowflake',
};
const LEVEL_ICON: Record<string, string> = { warn: 'triangle-exclamation', watch: 'eye', info: 'circle-check' };

export const useWeather = (farmId?: string) =>
  useQuery({
    queryKey: ['weather', farmId || ''],
    queryFn: () => api.get('/weather', { params: farmId ? { farm_id: farmId } : {} }).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

const day = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, o);
const hour = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Weather for the farm: now, next hours, 7 days, advice for the farm's crops and the water plan. */
export function WeatherScreen() {
  const { colors } = useTheme();
  const [farmId, setFarmId] = useState('');
  const { data, isLoading, isError, refetch, isFetching } = useWeather(farmId || undefined);
  const [briefing, setBriefing] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const brief = async () => {
    setBusy(true);
    setErr('');
    try {
      setBriefing((await aiWeatherBriefing()).briefing);
    } catch (e: any) {
      setErr(e?.message || t('Could not get the briefing'));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <Loading />;
  if (isError || !data) {
    return <EmptyState icon="cloud" title="Weather is not available right now" description="Check your connection and try again." actionLabel="Try again" onAction={refetch} />;
  }
  if (!data.located) {
    return <EmptyState icon="location-dot" title="Add your farm location" description="Add a farm with its location (district, province, country) or a field with GPS coordinates, and the weather for your land will appear here." />;
  }

  const c = data.current;
  const w = data.water;
  const levelColor = (l: string) => (l === 'warn' ? colors.red : l === 'watch' ? colors.orange : colors.primary);

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Weather" subtitle="Forecast and advice for your farm." />

      {data.farms.length > 1 ? (
        <View style={{ marginBottom: 14 }}>
          <SelectField value={farmId || data.farm_id || ''} onChangeValue={setFarmId} placeholder="" options={data.farms.map((f: any) => ({ value: f.id, label: f.name }))} />
        </View>
      ) : null}

      <View style={{ backgroundColor: colors.primaryDark, borderRadius: radius.lg, padding: 20, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Icon name={WEATHER_ICON[c.kind] || 'cloud'} size={54} color="#F9A825" />
          <View style={{ flex: 1 }}>
            <AppText weight="800" style={{ fontSize: 40, lineHeight: 44, color: '#fff' }}>{Math.round(c.temp)}°C</AppText>
            <AppText style={{ fontSize: 14, color: '#fff' }}>{t(c.description ? c.description[0].toUpperCase() + c.description.slice(1) : '')}</AppText>
            <AppText style={{ fontSize: 12, color: '#fff', opacity: 0.85, marginTop: 4 }}>
              {data.location.name}{data.location.place && data.location.place !== data.location.name ? ` · ${data.location.place}` : ''}
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {[
            ['Feels like', `${Math.round(c.feels)}°C`],
            ['Humidity', `${c.humidity}%`],
            ['Wind', `${Math.round(c.wind_kph)} km/h`],
            ['Cloud cover', c.clouds != null ? `${c.clouds}%` : '-'],
            ['Pressure', `${c.pressure} hPa`],
            ['Rain, past 7 days', data.rain_past_7d_mm != null ? `${data.rain_past_7d_mm} mm` : '-'],
          ].map(([l, v]) => (
            <View key={l} style={{ width: '31%', flexGrow: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 8, padding: 8 }}>
              <AppText style={{ fontSize: 10, color: '#fff', opacity: 0.85 }}>{t(l)}</AppText>
              <AppText weight="700" style={{ fontSize: 14, color: '#fff' }}>{v}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 20 }}>
        <ChartCard title={t('Next hours')} icon="clock" bodyStyle={{ padding: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {data.hourly.slice(0, 8).map((h: any) => (
              <View key={h.time} style={{ width: 76, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10 }}>
                <AppText style={{ fontSize: 11, color: colors.textLight }}>{hour(h.time)}</AppText>
                <Icon name={WEATHER_ICON[h.kind] || 'cloud'} size={20} color={colors.primary} />
                <AppText weight="700" style={{ fontSize: 14 }}>{Math.round(h.temp)}°</AppText>
                <AppText style={{ fontSize: 11, color: colors.textLight }}>{h.pop}%</AppText>
              </View>
            ))}
          </ScrollView>
        </ChartCard>

        <ChartCard title={t('Forecast')} icon="calendar-week" bodyStyle={{ padding: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {data.daily.slice(0, 7).map((d: any, i: number) => (
              <View key={d.date} style={{ width: 84, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 10 }}>
                <AppText weight="600" style={{ fontSize: 12, color: colors.textLight }}>{i === 0 ? t('Today') : day(d.date, { weekday: 'short' })}</AppText>
                <AppText style={{ fontSize: 10, color: colors.textLight }}>{day(d.date, { day: 'numeric', month: 'short' })}</AppText>
                <Icon name={WEATHER_ICON[d.kind] || 'cloud'} size={20} color={colors.primary} />
                <AppText style={{ fontSize: 13 }}><AppText weight="700">{Math.round(d.tmax)}°</AppText> <AppText style={{ color: colors.textLight }}>{Math.round(d.tmin)}°</AppText></AppText>
                <AppText style={{ fontSize: 11, color: colors.textLight }}>{d.rain_mm} mm</AppText>
              </View>
            ))}
          </ScrollView>
        </ChartCard>

        <ChartCard title={t('Advice for your farm')} icon="seedling">
          {data.crops.length ? <AppText style={{ fontSize: 12, color: colors.textLight, marginBottom: 10 }}>{t('Based on your active crops: {{crops}}', { crops: data.crops.join(', ') })}</AppText> : null}
          <View style={{ gap: 10 }}>
            {data.advice.map((a: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, padding: 10, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: levelColor(a.level), borderRadius: 8 }}>
                <Icon name={LEVEL_ICON[a.level] || 'circle-check'} size={14} color={levelColor(a.level)} />
                <View style={{ flex: 1 }}>
                  <AppText weight="700" style={{ fontSize: 13 }}>{t(a.topic)}</AppText>
                  <AppText style={{ fontSize: 13, lineHeight: 19 }}>{a.text}</AppText>
                </View>
              </View>
            ))}
          </View>
        </ChartCard>

        <ChartCard title={t('Water plan, next {{n}} days', { n: w.days })} icon="water">
          {[
            ['Crop water use', `${w.crop_water_use_mm} mm`],
            ['Useful rain expected', `${w.expected_useful_rain_mm} mm`],
            ['Irrigation needed', `${w.irrigation_needed_mm} mm`],
          ].map(([l, v], i) => (
            <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i === 2 ? 0 : 1, borderBottomColor: colors.border }}>
              <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(l)}</AppText>
              <AppText weight="700" style={{ fontSize: i === 2 ? 18 : 14, color: i === 2 ? colors.primaryDark : colors.text }}>{v}</AppText>
            </View>
          ))}
          <AppText style={{ fontSize: 11, color: colors.textLight, marginTop: 8 }}>{t('1 mm of water is 1 litre on every square metre. The Irrigation calculator uses this plan.')}</AppText>
        </ChartCard>

        <ChartCard title={t('Weekly briefing')} icon="wand-magic-sparkles">
          {err ? <AppText style={{ fontSize: 12, color: colors.red, marginBottom: 8 }}>{err}</AppText> : null}
          {briefing ? (
            <AppText style={{ fontSize: 13, lineHeight: 20 }}>{briefing}</AppText>
          ) : (
            <AppText style={{ fontSize: 13, color: colors.textLight, marginBottom: 10 }}>{t('The assistant reads the forecast together with your fields, crops and records and tells you what to do this week.')}</AppText>
          )}
          <View style={{ alignSelf: 'flex-start', marginTop: spacing.sm }}>
            <Button title={busy ? 'Working...' : 'Write my briefing'} icon="wand-magic-sparkles" loading={busy} onPress={brief} />
          </View>
        </ChartCard>

        <AppText style={{ fontSize: 11, color: colors.textLight }}>{t('Weather data from {{p}}. Forecasts change: check again before big decisions.', { p: data.provider })}</AppText>
      </View>
    </Screen>
  );
}
