import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { api } from '../lib/api.js';
import { REASONS, reasonText, useFarmerOrgMutations } from '../lib/orgApi.js';
import { t } from '../i18n/index.js';

const KEY = 'pending_join';
export const pendingJoin = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(KEY, v); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } },
};

/**
 * The page behind an organization referral link (crop.agricoders.com/join/<token>). It shows which organization
 * invited the farmer and what joining shares, then sends them to sign up or sign in, and finally asks for consent.
 * The server checks the link again when the farmer joins, so a link that ran out meanwhile is refused.
 */
export default function Join() {
  const { token } = useParams();
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { join } = useFarmerOrgMutations();
  const [state, setState] = useState({ loading: true });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.get(`/join/${token}`)
      .then((r) => { if (live) { pendingJoin.set(token); setState({ info: r.data }); } })
      .catch((err) => { if (live) { pendingJoin.clear(); setState({ code: err.code || 'invalid', message: err.message }); } });
    return () => { live = false; };
  }, [token]);

  const go = async () => {
    setError('');
    try {
      await join.mutateAsync({ token });
      pendingJoin.clear();
      navigate('/', { replace: true });
    } catch (err) {
      pendingJoin.clear();
      setError(reasonText(err));
    }
  };

  const org = state.info?.organization;
  return (
    <div className="org-page">
      <div className="org-card">
        <div className="org-brand">
          <img src="/brand/cropmanager-icon.png" alt="" width="44" height="44" />
          <div>
            <strong>CropManager</strong>
            <small>by Agricoders</small>
          </div>
        </div>

        {state.loading && <p className="org-muted">{t('Checking your invitation…')}</p>}

        {state.code && (
          <>
            <h1>{t('This link cannot be used')}</h1>
            <div className="auth-message error show" role="alert">{t(REASONS[state.code] || state.message || REASONS.invalid)}</div>
            <p className="org-muted">{t('Ask your organization for a new link, or continue as an independent farmer.')}</p>
            <Link className="btn btn-outline" to="/">{t('Continue to CropManager')}</Link>
          </>
        )}

        {org && (
          <>
            <h1>{t('You are invited to join {{name}}', { name: org.name })}</h1>
            <p className="org-muted">{[t(org.type), org.district, org.country].filter(Boolean).join(' · ')}</p>
            <div className="org-note">
              <i className="fas fa-shield-halved" />{' '}
              {t('Joining shares a summary of your crop activity (farms, crops, planting, harvests and field activity) with this organization. They cannot edit your records, and you can leave at any time in Settings.')}
            </div>

            {isLoaded && !isSignedIn && (
              <div className="org-actions">
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/sign-up')}>{t('Create an account to join')}</button>
                <button className="btn btn-secondary btn-lg" onClick={() => navigate('/sign-in')}>{t('I already have an account')}</button>
              </div>
            )}

            {isLoaded && isSignedIn && (
              <>
                <label className="org-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>{t('I agree to share a summary of my crop activity with {{name}}.', { name: org.name })}</span>
                </label>
                {error && <div className="auth-message error show" role="alert">{error}</div>}
                <div className="org-actions">
                  <button className="btn btn-primary btn-lg" disabled={!consent || join.isPending} onClick={go}>
                    {join.isPending ? t('Joining…') : t('Join {{name}}', { name: org.name })}
                  </button>
                </div>
              </>
            )}

            <p className="org-muted org-app-link">
              <a href={`cropmanager://join/${token}`}>{t('Open in the CropManager app')}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
