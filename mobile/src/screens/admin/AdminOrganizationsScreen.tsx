import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useAdminOrgMutations, useAdminOrgs, useAdminPlatformStats } from '../../lib/adminApi';
import { reasonText } from '../../lib/orgApi';
import { formatDate, formatNumber } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../theme/ThemeProvider';
import { Badge, Card, EmptyState, Grid, Loading, PageHeader, Screen, StatTile } from '../../components/ui';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { NumberField, SelectField, TextField } from '../../components/fields';
import { Chips, ListRow, SearchBox } from './bits';
import { t } from '../../i18n';

const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];
export const ORG_TONE: Record<string, 'warning' | 'success' | 'danger'> = { pending: 'warning', active: 'success', suspended: 'danger' };
const TABS = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending approval' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
];

function CreateSheet({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const toast = useToast();
  const { create } = useAdminOrgMutations();
  const [v, setV] = useState({ name: '', type: 'Cooperative', country: 'Rwanda', district: '', admin_email: '', contact_phone: '', max_farmers: '' });
  const set = (k: string) => (x: string) => setV((s) => ({ ...s, [k]: x }));
  const submit = async () => {
    try {
      const org = await create.mutateAsync(v);
      toast(t('Organization created and active'));
      onDone(org.id);
    } catch (err: any) {
      toast(reasonText(err), 'error');
    }
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Create organization"
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Button title="Cancel" kind="secondary" onPress={onClose} /><Button title="Create" loading={create.isPending} disabled={!v.name.trim()} onPress={submit} /></View>}
    >
      <View style={{ gap: 14 }}>
        <TextField label="Organization name" required value={v.name} onChangeValue={set('name')} />
        <SelectField label="Type" value={v.type} onChangeValue={set('type')} options={TYPES} placeholder="" />
        <TextField label="Country" value={v.country} onChangeValue={set('country')} />
        <TextField label="District" value={v.district} onChangeValue={set('district')} />
        <TextField label="Contact phone" value={v.contact_phone} onChangeValue={set('contact_phone')} keyboardType="phone-pad" />
        <TextField label="Administrator email" value={v.admin_email} onChangeValue={set('admin_email')} keyboardType="email-address" hint="They become the organization administrator when they sign in with this email." />
        <NumberField label="Farmer limit" value={v.max_farmers} onChangeValue={set('max_farmers')} hint="Empty uses the default." />
      </View>
    </Sheet>
  );
}

/** web Organizations: platform tiles, status tabs, search, create. */
export function AdminOrganizationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch, isFetching } = useAdminOrgs({ ...(tab ? { status: tab } : {}), ...(q ? { q } : {}) });
  const { data: stats } = useAdminPlatformStats();

  return (
    <Screen refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}>
      <PageHeader title="Organizations" subtitle="Approve organizations, set their farmer limits and watch usage." action={<Button title="Create organization" icon="plus" onPress={() => setCreating(true)} />} />

      {stats ? (
        <Grid columns={2} gap={12}>
          <StatTile label="Organizations" value={formatNumber((stats.organizations.active || 0) + (stats.organizations.pending || 0) + (stats.organizations.suspended || 0))} sub={`${stats.organizations.pending || 0} ${t('waiting for approval')}`} color="#1B5E20" />
          <StatTile label="Farmers in organizations" value={formatNumber(stats.farmers_in_organizations)} color="#2E7D32" />
          <StatTile label="Independent farmers" value={formatNumber(stats.independent_farmers)} color="#5B6B5D" />
          <StatTile label="Farm area" value={`${formatNumber(Math.round(stats.hectares.organizations + stats.hectares.independent))} ha`} sub={`${formatNumber(Math.round(stats.hectares.organizations))} ha ${t('in organizations')}`} color="#1B5E20" />
        </Grid>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <SearchBox value={q} onChange={setQ} placeholder="Search organizations..." />
        <Chips value={tab} onChange={setTab} options={TABS.map((x) => ({ id: x.id, label: `${t(x.label)}${x.id && data?.counts?.[x.id] ? ` (${data.counts[x.id]})` : ''}` }))} />
      </View>

      {isLoading ? <Loading /> : isError ? <EmptyState icon="triangle-exclamation" title="Could not load organizations" /> : !data?.data?.length ? (
        <EmptyState icon="building" title="No organizations" description="Organizations appear here when they register, or when you create one." />
      ) : (
        <View style={{ gap: 12 }}>
          {data.data.map((o: any) => (
            <Card key={o.id} style={{ padding: 0 }}>
              <ListRow
                title={o.name}
                lines={[[o.district, o.country].filter(Boolean).join(', '), `${t(o.type)} · ${o.farmer_count} ${t('Farmers')} · ${t('Limit')} ${o.max_farmers} (${o.usage_pct}%) · ${o.members} ${t('Team')}`, `${t('Registered')} ${formatDate(o.created_at)}`]}
                right={<Badge label={o.status} tone={ORG_TONE[o.status] || 'neutral'} />}
                onPress={() => navigation.navigate('admin-org', { orgId: o.id })}
                last
              />
            </Card>
          ))}
        </View>
      )}
      {creating ? <CreateSheet onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); navigation.navigate('admin-org', { orgId: id }); }} /> : null}
    </Screen>
  );
}
