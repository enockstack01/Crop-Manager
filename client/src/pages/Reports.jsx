import { PageHeader, EmptyState } from '../components/ui.jsx';

export default function Reports() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Production and financial reporting." />
      <EmptyState
        icon="fa-file-alt"
        title="Reports coming soon"
        description="Detailed production, yield and financial reports will be available here in a future phase. In the meantime, the Dashboard summarises your key metrics."
      />
    </>
  );
}
