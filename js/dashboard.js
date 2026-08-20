// ============================================================
// DASHBOARD — Phase 1 Placeholder
// Full dashboard will be built in Phase 3
// ============================================================

const Dashboard = {
    async init() {
        const container = document.getElementById('dashboard-content');
        if (!container) return;

        const profile = App.currentProfile;
        const greeting = Utils.getGreeting();
        const name = profile?.full_name || 'Farmer';

        container.innerHTML = `
            <div class="dashboard-header">
                <div>
                    <h1 class="page-title">${greeting}, ${Utils.escapeHtml(name)}</h1>
                    <p class="page-subtitle">Here's what's happening across your farm today.</p>
                </div>
            </div>
            <div style="margin-top:32px;">
                ${Utils.emptyState(
                    'fa-seedling',
                    'Dashboard Coming Soon',
                    'Your agricultural command center is being built. Complete Phase 1 setup by adding farms, fields, crops, varieties, and seasons. The full dashboard with KPIs, charts, and analytics will be available in Phase 3.',
                    'Go to Farms',
                    "window.location.href='pages/farms.html'"
                )}
            </div>
        `;
    }
};