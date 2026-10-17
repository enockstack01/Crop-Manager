import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, EmptyState, Loading } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useMyOrg, useOrg } from '../../lib/orgApi';
import { t } from '../../i18n';

/** Wraps every organization screen: finds the organization, explains when it is pending or suspended. */
export function OrgGate({ children, adminOnly = false }: { children: (p: { org: any; orgId: string; role: string }) => React.ReactNode; adminOnly?: boolean }) {
  const { colors } = useTheme();
  const { orgId, role } = useMyOrg();
  const { data: org, isLoading, isError } = useOrg(orgId);

  if (!orgId) return <EmptyState icon="building" title="No organization on this account" description="Register an organization or ask an organization administrator to invite you." />;
  if (isLoading) return <Loading label="Loading organization..." />;
  if (isError || !org) return <EmptyState icon="triangle-exclamation" title="Could not load the organization" />;
  if (adminOnly && role !== 'org_admin') return <EmptyState icon="lock" title="Administrators only" description="Only an organization administrator can open this page." />;

  const banner = (text: string, title: string, color: string, icon: string) => (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: radius.lg, padding: 12, marginBottom: 16, flexDirection: 'row', gap: 10 }}>
      <Icon name={icon} size={14} color={color} />
      <AppText style={{ flex: 1, fontSize: 13, lineHeight: 19 }}>
        <AppText weight="700" style={{ fontSize: 13 }}>{title}</AppText> {text}
      </AppText>
    </View>
  );
  return (
    <>
      {org.status === 'pending' && banner(t('A CropManager administrator will approve {{name}} soon. You can set up your profile and team now, and create referral links once it is approved.', { name: org.name }), t('Waiting for approval.'), colors.orange, 'hourglass-half')}
      {org.status === 'suspended' && banner(`${t('You can view data but not change it, and referral links do not work. Contact CropManager support.')}${org.suspended_reason ? ` ${org.suspended_reason}` : ''}`, t('This organization is suspended.'), colors.red, 'ban')}
      {children({ org, orgId, role })}
    </>
  );
}

/** farmers used of the limit, as a meter: "412 of 500 farmers" */
export function UsageMeter({ count, max }: { count: number; max: number }) {
  const { colors } = useTheme();
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 100;
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontSize: 14 }}>
        <AppText weight="700" style={{ fontSize: 14 }}>{count}</AppText> {t('of')} <AppText weight="700" style={{ fontSize: 14 }}>{max}</AppText> {t('farmers')} · {pct}%
      </AppText>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.bg, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: pct >= 100 ? colors.red : colors.primary }} />
      </View>
    </View>
  );
}
