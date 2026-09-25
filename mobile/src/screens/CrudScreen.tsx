import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useList, useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme/theme';
import { AppText, Badge, EmptyState, IconButton, SkeletonList } from '../components/ui';
import { PressableScale } from '../components/PressableScale';
import { haptics } from '../lib/haptics';
import { FAB } from '../components/FAB';
import { Sheet } from '../components/Sheet';
import { SelectField } from '../components/fields';
import { ResourceFormSheet } from './ResourceFormSheet';
import { RecordDetailSheet } from './RecordDetailSheet';
import { InventoryStockSheet } from './InventoryStockSheet';
import type { FilterDef, ModuleConfig } from '../navigation/modules';

const PER_PAGE = 15;

export function CrudScreen({ config }: { config: ModuleConfig }) {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { remove } = useResourceMutations(config.resource);

  const filters: FilterDef[] = config.useFilters ? config.useFilters() : [];

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [form, setForm] = useState<{ editing: any | null } | null>(null);
  const [viewRow, setViewRow] = useState<any | null>(null);
  const [stock, setStock] = useState<{ item: any; type: 'in' | 'out' } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const params = useMemo(() => {
    const p: Record<string, any> = {
      page, perPage: PER_PAGE,
      sort: config.defaultSort?.sort ?? 'created_at',
      order: config.defaultSort?.order ?? 'desc',
    };
    if (q) p.q = q;
    for (const [k, v] of Object.entries(filterValues)) if (v) p[k] = v;
    return p;
  }, [page, q, filterValues, config]);

  const { data, isLoading, isFetching, isError, error, refetch } = useList(config.resource, params);
  const rows = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const onSearch = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 350);
  }, []);

  const onDelete = async (row: any) => {
    const ok = await confirm(`Delete "${row.name || row.buyer || 'this record'}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast('Deleted successfully');
    } catch (e: any) {
      toast(e?.message || 'Failed to delete', 'error');
    }
  };

  const activeFilterCount = Object.values(filterValues).filter(Boolean).length;

  const renderItem = ({ item }: { item: any }) => {
    const view = config.row(item);
    return (
      <PressableScale
        onPress={() => setViewRow(item)}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={String(view.title)}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.md,
          paddingLeft: spacing.lg,
          marginBottom: spacing.sm + 2,
          ...shadow(1),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText weight="700" numberOfLines={1}>{view.title}</AppText>
            {view.subtitle ? (
              <AppText variant="caption" numberOfLines={2}>{view.subtitle}</AppText>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
              {view.badge ? <Badge label={view.badge.label} tone={view.badge.tone} /> : null}
              {view.right ? <AppText variant="caption" color={colors.textLight}>{view.right}</AppText> : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {config.rowActions === 'inventory-stock' ? (
              <>
                <IconButton name="arrow-up-bold" color={colors.green} onPress={() => setStock({ item, type: 'in' })} />
                <IconButton name="arrow-down-bold" color={colors.red} onPress={() => setStock({ item, type: 'out' })} />
              </>
            ) : null}
            <IconButton name="pencil" onPress={() => setForm({ editing: item })} />
            <IconButton name="trash-can-outline" color={colors.red} onPress={() => onDelete(item)} />
          </View>
        </View>
      </PressableScale>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* toolbar */}
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
        <AppText variant="subtitle">{config.subtitle}</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {config.searchable !== false ? (
            <View
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: colors.card, borderRadius: radius.md,
                borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
                paddingHorizontal: spacing.md, ...shadow(1),
              }}
            >
              <MaterialCommunityIcons name="magnify" size={18} color={colors.textLight} />
              <TextInput
                value={search}
                placeholder={config.searchPlaceholder ?? 'Search…'}
                placeholderTextColor={colors.textLight}
                onChangeText={onSearch}
                returnKeyType="search"
                style={{ flex: 1, paddingVertical: 11, color: colors.text, fontSize: 15 }}
              />
              {search ? (
                <Pressable onPress={() => { haptics.select(); onSearch(''); }} hitSlop={10} accessibilityLabel="Clear search">
                  <MaterialCommunityIcons name="close-circle" size={18} color={colors.textLight} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          {filters.length > 0 ? (
            <PressableScale
              onPress={() => setFilterOpen(true)}
              feedback="select"
              accessibilityRole="button"
              accessibilityLabel={activeFilterCount ? `Filters (${activeFilterCount} active)` : 'Filters'}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                backgroundColor: activeFilterCount ? colors.primary : colors.card,
                borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
                borderColor: activeFilterCount ? colors.primary : colors.border,
                paddingHorizontal: spacing.md,
              }}
            >
              <MaterialCommunityIcons name="filter-variant" size={18} color={activeFilterCount ? '#fff' : colors.textLight} />
              {activeFilterCount ? <AppText color="#fff" weight="700">{activeFilterCount}</AppText> : null}
            </PressableScale>
          ) : null}
        </View>
      </View>

      {isError ? (
        <EmptyState
          icon={(error as any)?.network ? 'cloud-off-outline' : 'alert-circle-outline'}
          title="Couldn't load this list"
          description={(error as any)?.message}
          actionLabel="Try again"
          onAction={refetch}
        />
      ) : isLoading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 96, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon={config.emptyIcon}
              title={config.emptyTitle}
              description={config.emptyDescription}
              actionLabel={config.addLabel}
              onAction={() => setForm({ editing: null })}
            />
          }
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg }}>
                <IconButton name="chevron-left" onPress={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} />
                <AppText variant="caption">Page {page} of {totalPages}</AppText>
                <IconButton name="chevron-right" onPress={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} />
              </View>
            ) : null
          }
        />
      )}

      <FAB onPress={() => setForm({ editing: null })} />

      {/* filter sheet */}
      <Sheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filters">
        {filters.map((flt) => (
          <SelectField
            key={flt.key}
            label={flt.placeholder}
            value={filterValues[flt.key] ?? ''}
            onChangeValue={(v) => { setFilterValues((prev) => ({ ...prev, [flt.key]: v })); setPage(1); }}
            options={flt.options}
            placeholder={flt.placeholder}
          />
        ))}
      </Sheet>

      {form ? (
        <ResourceFormSheet
          config={config}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSaved={(msg) => { setForm(null); toast(msg); }}
        />
      ) : null}

      {viewRow ? (
        <RecordDetailSheet
          config={config}
          row={viewRow}
          onClose={() => setViewRow(null)}
          onEdit={() => { setForm({ editing: viewRow }); setViewRow(null); }}
        />
      ) : null}

      {stock ? (
        <InventoryStockSheet item={stock.item} type={stock.type} onClose={() => setStock(null)} />
      ) : null}
    </View>
  );
}
