import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useList, useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius, shadow } from '../theme/theme';
import { AppText, Badge, EmptyState, Grid, IconButton, PageHeader, SkeletonList, useLayout } from '../components/ui';
import { Button } from '../components/Button';
import { haptics } from '../lib/haptics';
import { SelectField } from '../components/fields';
import { ResourceFormSheet } from './ResourceFormSheet';
import { RecordDetailSheet } from './RecordDetailSheet';
import { InventoryStockSheet } from './InventoryStockSheet';
import type { FilterDef, ModuleConfig } from '../navigation/modules';
import { t } from '../i18n';

const PER_PAGE = 15;

/*
 * A module page laid out like the web's (client/src/pages/*.jsx + tables.css):
 * page title/subtitle, "Add …" button, search + filter selects, then the records in
 * a bordered table panel (row = record, with view/edit/delete actions), and
 * Previous/Next pagination. Filters sit side by side on tablets.
 */
export function CrudScreen({ config }: { config: ModuleConfig }) {
  const { colors } = useTheme();
  const { gutter, isTablet } = useLayout();
  const toast = useToast();
  const confirm = useConfirm();
  const { remove } = useResourceMutations(config.resource);

  const filters: FilterDef[] = config.useFilters ? config.useFilters() : [];

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
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
  const total = data?.total ?? rows.length;

  const onSearch = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 350);
  }, []);

  const onDelete = async (row: any) => {
    const ok = await confirm(t('Delete "{{name}}"? This cannot be undone.', { name: row.name || row.buyer || t('this record') }));
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast(t('Deleted successfully'));
    } catch (e: any) {
      toast(e?.message || t('Failed to delete'), 'error');
    }
  };

  const addLabel = config.addLabel || t('Add {{name}}', { name: t(config.formTitle) });

  /* ---------- header: title, add button, search, filters (web .table-toolbar) ---------- */
  const header = (
    <View style={{ paddingTop: 20 }}>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={<Button title={addLabel} icon="plus" onPress={() => setForm({ editing: null })} />}
      />
      <View style={{ gap: 10, marginBottom: 16 }}>
        {config.searchable !== false ? (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
              borderColor: searchFocused ? colors.primary : colors.border, paddingHorizontal: 13, minHeight: 42,
              ...(searchFocused ? { boxShadow: '0 0 0 3px rgba(46,125,50,0.12)' as any } : null),
            }}
          >
            <Icon name="magnifying-glass" size={13} color={colors.placeholder} />
            <TextInput
              value={search}
              placeholder={config.searchPlaceholder ? t(config.searchPlaceholder) : t('Search {{name}}...', { name: t(config.title).toLowerCase() })}
              placeholderTextColor={colors.placeholder}
              onChangeText={onSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
              style={{ flex: 1, paddingVertical: 10, color: colors.text, fontSize: 13, fontFamily: ff('400') }}
            />
            {search ? (
              <Pressable onPress={() => { haptics.select(); onSearch(''); }} hitSlop={10} accessibilityLabel="Clear search">
                <Icon name="circle-xmark" size={14} color={colors.placeholder} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {filters.length ? (
          <Grid columns={isTablet ? Math.min(filters.length, 4) : 1} gap={10}>
            {filters.map((flt) => (
              <SelectField
                key={flt.key}
                value={filterValues[flt.key] ?? ''}
                onChangeValue={(v) => { setFilterValues((prev) => ({ ...prev, [flt.key]: v })); setPage(1); }}
                options={flt.options}
                placeholder={flt.placeholder}
              />
            ))}
          </Grid>
        ) : null}
      </View>
    </View>
  );

  /* ---------- one table row ---------- */
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const view = config.row(item);
    const first = index === 0;
    const last = index === rows.length - 1;
    return (
      <Pressable
        onPress={() => { haptics.tap(); setViewRow(item); }}
        accessibilityRole="button"
        accessibilityLabel={String(view.title)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingVertical: 12, paddingLeft: 16, paddingRight: 8,
          backgroundColor: pressed ? colors.tableHover : colors.card,
          borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
          borderTopWidth: first ? 1 : 0,
          borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0,
          borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0,
        })}
      >
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <AppText weight="600" style={{ fontSize: 13 }} numberOfLines={2}>{view.title}</AppText>
          {view.subtitle ? <AppText style={{ fontSize: 12, color: colors.textLight }} numberOfLines={2}>{view.subtitle}</AppText> : null}
          {view.badge || view.right ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
              {view.badge ? <Badge label={view.badge.label} tone={view.badge.tone} /> : null}
              {view.right ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{view.right}</AppText> : null}
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          {config.rowActions === 'inventory-stock' ? (
            <>
              <IconButton name="arrow-up" color={colors.green} onPress={() => setStock({ item, type: 'in' })} label="Stock in" />
              <IconButton name="arrow-down" color={colors.red} onPress={() => setStock({ item, type: 'out' })} label="Stock out" />
            </>
          ) : null}
          <IconButton name="pen" color={colors.blue} onPress={() => setForm({ editing: item })} label="Edit" />
          <IconButton name="trash-can" color={colors.red} onPress={() => onDelete(item)} label="Delete" />
        </View>
      </Pressable>
    );
  };

  const footer =
    totalPages > 1 ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, gap: 8 }}>
        <AppText style={{ fontSize: 12, color: colors.textLight }}>
          Page {page} of {totalPages} · {total} records
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Prev" kind="secondary" size="sm" icon="chevron-left" disabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))} />
          <Button title="Next" kind="secondary" size="sm" disabled={page >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))} />
        </View>
      </View>
    ) : (
      <View style={{ height: 24 }} />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {isError ? (
        <View style={{ paddingHorizontal: gutter }}>
          {header}
          <EmptyState
            icon={(error as any)?.network ? 'cloud-off-outline' : 'triangle-exclamation'}
            title="Couldn't load this list"
            description={(error as any)?.message}
            actionLabel="Try again"
            onAction={refetch}
          />
        </View>
      ) : isLoading ? (
        <View style={{ paddingHorizontal: gutter }}>
          {header}
          <SkeletonList />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListFooterComponent={rows.length ? footer : null}
          contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 24, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow(1) }}>
              <EmptyState
                icon={config.emptyIcon}
                title={q || Object.values(filterValues).some(Boolean) ? t('No matching records') : config.emptyTitle}
                description={q || Object.values(filterValues).some(Boolean) ? 'Try a different search or clear the filters.' : config.emptyDescription}
                actionLabel={q ? undefined : addLabel}
                onAction={() => setForm({ editing: null })}
              />
            </View>
          }
        />
      )}

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
