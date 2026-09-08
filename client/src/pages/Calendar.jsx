import { PageHeader, EmptyState, Loading } from '../components/ui.jsx';
import { useDashboard } from '../features/dashboard/useDashboard.js';
import { formatDate } from '../lib/format.js';

export default function Calendar() {
  const { data, isLoading } = useDashboard();

  const events = [];
  for (const c of data?.cycles || []) {
    if (c.expected_harvest_date && ['Planned', 'Planted', 'Growing', 'Ready for Harvest'].includes(c.status)) {
      events.push({
        date: c.expected_harvest_date,
        title: `Expected harvest — ${c.crops?.name || ''}`,
        meta: `${c.farms?.name || ''} / ${c.fields?.name || ''}`,
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader title="Calendar" subtitle="Upcoming farm events." />
      {isLoading ? (
        <Loading />
      ) : events.length === 0 ? (
        <EmptyState icon="fa-calendar-check" title="No upcoming events" description="Expected harvest dates from your active crop cycles will appear here." />
      ) : (
        <div className="chart-card">
          <div className="chart-card-body" style={{ padding: 0 }}>
            {events.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 54, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{new Date(e.date).getDate()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                    {new Date(e.date).toLocaleString('en', { month: 'short' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    {e.meta} · {formatDate(e.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
