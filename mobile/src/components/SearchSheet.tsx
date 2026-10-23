import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { api } from '../lib/api';
import { NAV_SECTIONS } from '../navigation/navConfig';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { AppText } from './ui';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, spacing } from '../theme/theme';
import { haptics } from '../lib/haptics';
import { t } from '../i18n';

type Group = { kind: string; label: string; route: string; items: { id: string; title: string; subtitle?: string }[] };

/**
 * The top bar search: finds pages and any of your records. Picking a record opens its page with that
 * page's own search box already filled in.
 */
export function SearchSheet({ visible, onClose, navigation }: { visible: boolean; onClose: () => void; navigation: any }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);

  const pages = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return NAV_SECTIONS.flatMap((s) => s.items).filter((i) => t(i.label).toLowerCase().includes(n) || i.label.toLowerCase().includes(n)).slice(0, 5);
  }, [q]);

  useEffect(() => {
    const n = q.trim();
    if (n.length < 2) { setGroups([]); return undefined; }
    let dead = false;
    setBusy(true);
    const id = setTimeout(() => {
      api.get('/search', { params: { q: n } })
        .then((r) => { if (!dead) setGroups(r.data.groups || []); })
        .catch(() => {})
        .finally(() => { if (!dead) setBusy(false); });
    }, 300);
    return () => { dead = true; clearTimeout(id); };
  }, [q]);

  const go = (route: string, params?: Record<string, any>) => {
    haptics.select();
    onClose();
    setQ('');
    navigation.navigate(route.replace(/^\//, ''), params);
  };

  const row = (key: string, icon: string | null, title: string, sub: string | undefined, onPress: () => void) => (
    <Pressable key={key} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? colors.bg : 'transparent' })}>
      {icon ? <Icon name={icon} size={14} color={colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <AppText weight="600" style={{ fontSize: 13 }} numberOfLines={1}>{title}</AppText>
        {sub ? <AppText style={{ fontSize: 11, color: colors.textLight }} numberOfLines={1}>{sub}</AppText> : null}
      </View>
    </Pressable>
  );
  const head = (label: string) => <AppText weight="700" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textLight, paddingTop: spacing.sm, paddingHorizontal: 8 }}>{label}</AppText>;

  const empty = q.trim().length >= 2 && !busy && !pages.length && !groups.length;

  return (
    <Sheet visible={visible} onClose={onClose} title="Search">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.input, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, minHeight: 44 }}>
        <Icon name={busy ? 'spinner' : 'magnifying-glass'} size={14} color={colors.placeholder} />
        <TextInput
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder={t('Search...')}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={{ flex: 1, paddingVertical: 10, color: colors.text, fontSize: 14, fontFamily: ff('400') }}
        />
      </View>
      <View style={{ marginTop: 8 }}>
        {pages.length ? head(t('Pages')) : null}
        {pages.map((p) => row(`p${p.route}`, p.icon, t(p.label), undefined, () => go(p.route)))}
        {groups.map((g) => (
          <View key={g.kind}>
            {head(t(g.label))}
            {g.items.map((i) => row(`${g.kind}${i.id}`, null, i.title, i.subtitle, () => go(g.route, { q: i.title })))}
          </View>
        ))}
        {empty ? <AppText style={{ fontSize: 13, color: colors.textLight, padding: 14 }}>{t('Nothing found for "{{q}}"', { q: q.trim() })}</AppText> : null}
      </View>
    </Sheet>
  );
}
