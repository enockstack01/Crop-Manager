import { EmptyState, Loading } from '../../components/ui.jsx';
import { useMyOrg, useOrg } from '../../lib/orgApi.js';
import { t } from '../../i18n/index.js';

/**
 * Wraps every organization page: finds the user's organization, explains when it is waiting for approval or
 * suspended, and passes the organization and the user's role to the page.
 */
export function OrgGate({ children, adminOnly = false }) {
  const { orgId, role } = useMyOrg();
  const { data: org, isLoading, isError } = useOrg(orgId);

  if (!orgId) {
    return <EmptyState icon="fa-building" title="No organization on this account" description="Register an organization or ask an organization administrator to invite you." />;
  }
  if (isLoading) return <Loading label="Loading organization..." />;
  if (isError || !org) return <EmptyState icon="fa-exclamation-triangle" title="Could not load the organization" />;
  if (adminOnly && role !== 'org_admin') {
    return <EmptyState icon="fa-lock" title="Administrators only" description="Only an organization administrator can open this page." />;
  }
  return (
    <>
      {org.status === 'pending' && (
        <div className="org-banner">
          <i className="fas fa-hourglass-half" /> <b>{t('Waiting for approval.')}</b>{' '}
          {t('A CropManager administrator will approve {{name}} soon. You can set up your profile and team now, and create referral links once it is approved.', { name: org.name })}
        </div>
      )}
      {org.status === 'suspended' && (
        <div className="org-banner org-banner-alert">
          <i className="fas fa-ban" /> <b>{t('This organization is suspended.')}</b>{' '}
          {t('You can view data but not change it, and referral links do not work. Contact CropManager support.')}
          {org.suspended_reason ? ` ${org.suspended_reason}` : ''}
        </div>
      )}
      {children({ org, orgId, role })}
    </>
  );
}

/** farmers used of the limit, as a meter: "412 of 500 farmers" */
export function UsageMeter({ count, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 100;
  return (
    <div>
      <div className="org-usage-text">
        <b>{count}</b> {t('of')} <b>{max}</b> {t('farmers')} · {pct}%
      </div>
      <div className="fp-meter" role="img" aria-label={`${count} / ${max}`}>
        <span style={{ width: `${pct}%`, background: pct >= 100 ? '#C62828' : '#2E7D32' }} />
      </div>
    </div>
  );
}
