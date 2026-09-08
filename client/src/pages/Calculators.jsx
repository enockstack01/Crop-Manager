import { Link, useNavigate } from 'react-router-dom';
import { CALCULATOR_BY_TYPE, CALCULATORS } from '../lib/calculators.js';
import { useList, useResourceMutations } from '../lib/useResource.js';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, IconButton } from '../components/ui.jsx';
import { formatDateTime } from '../lib/format.js';

export default function Calculators() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { data } = useList('calculation-history', { perPage: 20, sort: 'created_at', order: 'desc' });
  const { remove } = useResourceMutations('calculation-history');
  const history = data?.data || [];

  const reopen = (h) => {
    try {
      sessionStorage.setItem('calc_reopen', JSON.stringify(h));
    } catch {
      /* ignore */
    }
    navigate(`/calculators/${h.calculator_type}`);
  };

  const del = async (h) => {
    if (await confirm('Delete this calculation from history?')) {
      await remove.mutateAsync(h.id);
      toast('Deleted from history');
    }
  };

  return (
    <>
      <PageHeader title="Agricultural Calculators" subtitle="Quick field-planning tools." />

      <div className="calculator-grid" style={{ marginBottom: 32 }}>
        {CALCULATORS.map((c) => (
          <Link key={c.type} className="calc-card" to={`/calculators/${c.type}`}>
            <div className="calc-card-icon">
              <i className={`fas ${c.icon}`} />
            </div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </Link>
        ))}
      </div>

      <h3 className="section-title">Recent Calculations</h3>
      <div className="chart-card">
        <div className="chart-card-body">
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-light)', fontSize: 13 }}>
              No calculation history yet
            </div>
          ) : (
            history.map((h) => (
              <div
                key={h.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                }}
              >
                <div>
                  <span className="badge badge-primary">
                    {CALCULATOR_BY_TYPE[h.calculator_type]?.title || h.calculator_type}
                  </span>
                  <span style={{ color: 'var(--text-light)', fontSize: 12, marginLeft: 8 }}>
                    {formatDateTime(h.created_at)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <IconButton icon="fa-redo" title="Reopen" onClick={() => reopen(h)} />
                  <IconButton icon="fa-trash" title="Delete" danger onClick={() => del(h)} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
