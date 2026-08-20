// ============================================================
// DASHBOARD — Agricultural Command Center
// All data from Supabase. No fake numbers.
// ============================================================

const Dashboard = {
    charts: {},
    data: {},
    filters: { farm: '', season: '', dateFrom: '', dateTo: '' },

    // Color palette for charts
    colors: ['#2E7D32','#1976D2','#F9A825','#D32F2F','#7B1FA2','#00897B','#E65100','#5D4037','#37474F','#C2185B'],
    colorsAlpha: ['rgba(46,125,50,0.8)','rgba(25,118,210,0.8)','rgba(249,168,37,0.8)','rgba(211,47,47,0.8)','rgba(123,31,162,0.8)','rgba(0,137,123,0.8)','rgba(230,81,0,0.8)','rgba(93,64,87,0.8)','rgba(55,71,79,0.8)','rgba(194,24,91,0.8)'],

    isDark() { return document.documentElement.classList.contains('dark-mode'); },

    chartTextColor() { return this.isDark() ? '#BDBDBD' : '#546E7A'; },
    chartGridColor() { return this.isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
    chartBg() { return this.isDark() ? '#1E1E1E' : '#FFFFFF' },

    defaultChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: this.chartTextColor(), font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
                tooltip: { backgroundColor: this.isDark() ? '#2A2A2A' : '#fff', titleColor: this.isDark() ? '#E0E0E0' : '#263238', bodyColor: this.isDark() ? '#BDBDBD' : '#546E7A', borderColor: this.isDark() ? '#444' : '#E0E0E0', borderWidth: 1, cornerRadius: 8, padding: 12, titleFont: { family: 'Inter', weight: '600' }, bodyFont: { family: 'Inter' } }
            },
            scales: {
                x: { ticks: { color: this.chartTextColor(), font: { family: 'Inter', size: 11 } }, grid: { color: this.chartGridColor() }, border: { color: this.chartGridColor() } },
                y: { ticks: { color: this.chartTextColor(), font: { family: 'Inter', size: 11 } }, grid: { color: this.chartGridColor() }, border: { color: this.chartGridColor() }, beginAtZero: true }
            }
        };
    },

    async init() {
        this.renderHeader();
        Utils.showLoading('kpi-grid');

        try {
            await this.loadAllData();
            this.destroyCharts();
            this.renderKPIs();
            this.renderFarmOverview();
            this.renderCropDistribution();
            this.renderCropCycleStatus();
            this.renderProductionTrend();
            this.renderCropPerformance();
            this.renderHarvestAnalytics();
            this.renderFinancialOverview();
            this.renderExpenseBreakdown();
            this.renderSalesAnalytics();
            this.renderInventoryHealth();
            this.renderCropHealth();
            this.renderRecentActivities();
            this.renderUpcomingEvents();
            this.renderAlerts();
            this.renderQuickActions();
            this.loadNotifications();
        } catch (err) {
            console.error('Dashboard load error:', err);
            document.getElementById('kpi-grid').innerHTML = Utils.emptyState('fa-exclamation-triangle', 'Dashboard Error', 'Could not load dashboard data. Please try again.', 'Retry', 'Dashboard.init()');
        }
    },

    destroyCharts() {
        Object.values(this.charts).forEach(c => { if (c && typeof c.destroy === 'function') c.destroy(); });
        this.charts = {};
    },

    // ---- DATA LOADING ----
    async loadAllData() {
        const uid = App.currentUser.id;
        const [farms, fields, crops, seasons, cycles, harvests, activities, scouting, expenses, sales, inventory] = await Promise.all([
            db.from('farms').select('*').eq('user_id', uid),
            db.from('fields').select('*, farms(name)').eq('user_id', uid),
            db.from('crops').select('*').eq('user_id', uid),
            db.from('seasons').select('*').eq('user_id', uid).order('name'),
            db.from('crop_cycles').select('*, farms(name), fields(name), crops(name), crop_varieties(name), seasons(name)').eq('user_id', uid),
            db.from('harvest_records').select('*, farms(name), fields(name), crops(name)').eq('user_id', uid).order('harvest_date', { ascending: false }),
            db.from('field_activities').select('*, farms(name), fields(name)').eq('user_id', uid).order('activity_date', { ascending: false }).limit(20),
            db.from('crop_scouting_records').select('*, farms(name), fields(name), crops(name)').eq('user_id', uid).order('scouting_date', { ascending: false }).limit(20),
            db.from('expenses').select('*').eq('user_id', uid),
            db.from('sales').select('*, crops(name)').eq('user_id', uid),
            db.from('inventory_items').select('*').eq('user_id', uid)
        ]);

        this.data = {
            farms: farms.data || [],
            fields: fields.data || [],
            crops: crops.data || [],
            seasons: seasons.data || [],
            cycles: cycles.data || [],
            harvests: harvests.data || [],
            activities: activities.data || [],
            scouting: scouting.data || [],
            expenses: expenses.data || [],
            sales: sales.data || [],
            inventory: inventory.data || []
        };
    },

    // ---- FILTERED DATA ----
    filteredCycles() {
        let d = this.data.cycles;
        if (this.filters.farm) d = d.filter(c => c.farm_id === this.filters.farm);
        if (this.filters.season) d = d.filter(c => c.season_id === this.filters.season);
        if (this.filters.dateFrom) d = d.filter(c => !c.planting_date || c.planting_date >= this.filters.dateFrom);
        if (this.filters.dateTo) d = d.filter(c => !c.planting_date || c.planting_date <= this.filters.dateTo);
        return d;
    },
    filteredHarvests() {
        let d = this.data.harvests;
        if (this.filters.farm) d = d.filter(h => h.farm_id === this.filters.farm);
        if (this.filters.dateFrom) d = d.filter(h => h.harvest_date >= this.filters.dateFrom);
        if (this.filters.dateTo) d = d.filter(h => h.harvest_date <= this.filters.dateTo);
        return d;
    },
    filteredExpenses() {
        let d = this.data.expenses;
        if (this.filters.farm) d = d.filter(e => e.farm_id === this.filters.farm);
        if (this.filters.dateFrom) d = d.filter(e => e.expense_date >= this.filters.dateFrom);
        if (this.filters.dateTo) d = d.filter(e => e.expense_date <= this.filters.dateTo);
        return d;
    },
    filteredSales() {
        let d = this.data.sales;
        if (this.filters.farm) d = d.filter(s => s.farm_id === this.filters.farm);
        if (this.filters.dateFrom) d = d.filter(s => s.sale_date >= this.filters.dateFrom);
        if (this.filters.dateTo) d = d.filter(s => s.sale_date <= this.filters.dateTo);
        return d;
    },

    // ---- HEADER ----
    renderHeader() {
        const name = App.currentProfile?.full_name || 'Farmer';
        const greeting = Utils.getGreeting();
        let farmOpts = '<option value="">All Farms</option>';
        let seasonOpts = '<option value="">All Seasons</option>';
        if (this.data.farms) this.data.farms.forEach(f => { farmOpts += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; });
        if (this.data.seasons) this.data.seasons.forEach(s => { seasonOpts += `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`; });

        document.getElementById('dash-header').innerHTML = `
            <div>
                <h1 class="page-title">${greeting}, ${Utils.escapeHtml(name)}</h1>
                <p class="page-subtitle" style="margin-top:4px;">Here's what's happening across your farm today.</p>
            </div>
            <div class="dashboard-filters">
                <select class="dashboard-filter-select" id="dash-filter-farm">${farmOpts}</select>
                <select class="dashboard-filter-select" id="dash-filter-season">${seasonOpts}</select>
                <input type="date" class="dashboard-filter-select" id="dash-filter-from" style="padding:7px 10px;">
                <input type="date" class="dashboard-filter-select" id="dash-filter-to" style="padding:7px 10px;">
            </div>
        `;

        ['dash-filter-farm','dash-filter-season','dash-filter-from','dash-filter-to'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                this.filters.farm = document.getElementById('dash-filter-farm').value;
                this.filters.season = document.getElementById('dash-filter-season').value;
                this.filters.dateFrom = document.getElementById('dash-filter-from').value;
                this.filters.dateTo = document.getElementById('dash-filter-to').value;
                this.init();
            });
        });
    },

    // ---- KPI CARDS ----
    renderKPIs() {
        const cycles = this.filteredCycles();
        const activeCycles = cycles.filter(c => ['Planted','Growing','Ready for Harvest'].includes(c.status));
        const totalPlanted = cycles.filter(c => !['Planned','Cancelled'].includes(c.status)).reduce((s, c) => s + (c.area_planted || 0), 0);
        const expectedProd = cycles.reduce((s, c) => s + (c.expected_production || 0), 0);
        const completedHarvests = this.filteredHarvests().length;
        const totalExpenses = this.filteredExpenses().reduce((s, e) => s + (e.amount || 0), 0);
        const totalSales = this.filteredSales().reduce((s, sl) => s + (sl.total_amount || 0), 0);
        const lowStock = this.data.inventory.filter(i => i.current_quantity <= i.minimum_stock).length;

        const kpis = [
            { icon: 'fa-tractor', color: 'green', label: 'Total Farms', value: this.data.farms.length, link: 'pages/farms.html' },
            { icon: 'fa-map', color: 'blue', label: 'Total Fields', value: this.data.fields.length, link: 'pages/fields.html' },
            { icon: 'fa-sync-alt', color: 'green', label: 'Active Cycles', value: activeCycles.length, link: 'pages/crop-cycles.html' },
            { icon: 'fa-expand', color: 'blue', label: 'Planted Area', value: totalPlanted.toFixed(1) + ' ha', link: 'pages/crop-cycles.html' },
            { icon: 'fa-chart-line', color: 'purple', label: 'Expected Harvest', value: Utils.formatNumber(Math.round(expectedProd)) + ' kg', link: 'pages/crop-cycles.html' },
            { icon: 'fa-wheat-awn', color: 'green', label: 'Harvest Records', value: completedHarvests, link: 'pages/harvest.html' },
            { icon: 'fa-receipt', color: 'red', label: 'Total Expenses', value: Utils.formatCurrency(totalExpenses), link: 'pages/expenses.html' },
            { icon: 'fa-hand-holding-usd', color: 'green', label: 'Total Sales', value: Utils.formatCurrency(totalSales), link: 'pages/sales.html' },
            { icon: 'fa-boxes', color: 'blue', label: 'Inventory Items', value: this.data.inventory.length, link: 'pages/inventory.html' },
            { icon: 'fa-exclamation-triangle', color: lowStock > 0 ? 'red' : 'green', label: 'Low Stock Items', value: lowStock, link: 'pages/inventory.html' }
        ];

        document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
            <div class="kpi-card" onclick="window.location.href='${k.link}'">
                <div class="kpi-icon ${k.color}"><i class="fas ${k.icon}"></i></div>
                <div class="kpi-info">
                    <div class="kpi-label">${k.label}</div>
                    <div class="kpi-value">${k.value}</div>
                </div>
            </div>
        `).join('');
    },

    // ---- FARM OVERVIEW ----
    renderFarmOverview() {
        const totalArea = this.data.farms.reduce((s, f) => s + (f.total_area || 0), 0);
        const plantedArea = this.data.fields.filter(f => f.status === 'Active').reduce((s, f) => s + (f.area || 0), 0);
        const fallowArea = this.data.fields.filter(f => f.status === 'Fallow').reduce((s, f) => s + (f.area || 0), 0);
        const pct = totalArea > 0 ? Math.round((plantedArea / totalArea) * 100) : 0;

        document.getElementById('dash-row1').innerHTML = `
            <div class="chart-card">
                <div class="chart-card-header"><h3><i class="fas fa-map-marked-alt" style="color:var(--primary);margin-right:8px;"></i>Land Utilization</h3></div>
                <div class="chart-card-body" style="min-height:180px;display:flex;flex-direction:column;justify-content:center;">
                    <div style="text-align:center;margin-bottom:20px;">
                        <div style="font-size:36px;font-weight:800;color:var(--text);">${pct}%</div>
                        <div style="font-size:13px;color:var(--text-light);margin-top:4px;">Land Utilization Rate</div>
                    </div>
                    <div class="progress-bar" style="height:12px;border-radius:6px;margin-bottom:16px;">
                        <div class="progress-bar-fill" style="width:${pct}%;border-radius:6px;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <div><span style="color:var(--primary);font-weight:700;">${plantedArea.toFixed(1)} ha</span> <span style="color:var(--text-light);">planted</span></div>
                        <div><span style="color:var(--orange);font-weight:700;">${fallowArea.toFixed(1)} ha</span> <span style="color:var(--text-light);">fallow</span></div>
                        <div><span style="font-weight:700;">${totalArea.toFixed(1)} ha</span> <span style="color:var(--text-light);">total</span></div>
                    </div>
                    <div style="display:flex;gap:16px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--text-light);">
                        <div><strong style="color:var(--text);">${this.data.farms.length}</strong> Farms</div>
                        <div><strong style="color:var(--text);">${this.data.fields.length}</strong> Fields</div>
                        <div><strong style="color:var(--text);">${this.data.fields.filter(f=>f.status==='Active').length}</strong> Active</div>
                    </div>
                </div>
            </div>
            <div class="chart-card" id="crop-dist-card">
                <div class="chart-card-header"><h3><i class="fas fa-chart-pie" style="color:var(--primary);margin-right:8px;"></i>Crop Distribution</h3></div>
                <div class="chart-card-body" style="height:260px;position:relative;"><canvas id="chart-crop-dist"></canvas></div>
            </div>
        `;
        this.renderCropDistChart();
    },

    renderCropDistChart() {
        const cycles = this.filteredCycles().filter(c => !['Planned','Cancelled'].includes(c.status));
        const cropMap = {};
        cycles.forEach(c => {
            const name = c.crops?.name || 'Unknown';
            cropMap[name] = (cropMap[name] || 0) + (c.area_planted || 0);
        });
        const labels = Object.keys(cropMap);
        const values = Object.values(cropMap);

        if (labels.length === 0) {
            document.getElementById('chart-crop-dist').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No planted crops to display</div>';
            return;
        }

        this.charts.cropDist = new Chart(document.getElementById('chart-crop-dist'), {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: this.colors.slice(0, labels.length), borderWidth: 2, borderColor: this.chartBg() }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { color: this.chartTextColor(), font: { family: 'Inter', size: 11 }, padding: 10, usePointStyle: true, pointStyleWidth: 8 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.toFixed(1)} ha` } } } }
        });
    },

    // ---- CROP CYCLE STATUS ----
    renderCropCycleStatus() {
        const cycles = this.filteredCycles();
        const statuses = ['Planned','Planted','Growing','Ready for Harvest','Harvested','Completed','Cancelled'];
        const counts = statuses.map(s => cycles.filter(c => c.status === s).length);

        document.getElementById('dash-row2').innerHTML = `
            <div class="chart-card">
                <div class="chart-card-header"><h3><i class="fas fa-sync-alt" style="color:var(--primary);margin-right:8px;"></i>Cycle Status</h3></div>
                <div class="chart-card-body" style="height:260px;position:relative;"><canvas id="chart-cycle-status"></canvas></div>
            </div>
            <div class="chart-card">
                <div class="chart-card-header"><h3><i class="fas fa-chart-bar" style="color:var(--blue);margin-right:8px;"></i>Harvest by Crop</h3></div>
                <div class="chart-card-body" style="height:260px;position:relative;"><canvas id="chart-harvest-crop"></canvas></div>
            </div>
        `;

        const statusColors = ['#1976D2','#2E7D32','#66BB6A','#F9A825','#FF8F00','#43A047','#9E9E9E'];
        this.charts.cycleStatus = new Chart(document.getElementById('chart-cycle-status'), {
            type: 'doughnut',
            data: { labels: statuses, datasets: [{ data: counts, backgroundColor: statusColors, borderWidth: 2, borderColor: this.chartBg() }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right', labels: { color: this.chartTextColor(), font: { family: 'Inter', size: 11 }, padding: 8, usePointStyle: true, pointStyleWidth: 8 } } } }
        });

        // Harvest by crop bar
        const harvests = this.filteredHarvests();
        const hCropMap = {};
        harvests.forEach(h => { const n = h.crops?.name || 'Unknown'; hCropMap[n] = (hCropMap[n] || 0) + (h.quantity || 0); });
        const hLabels = Object.keys(hCropMap);
        const hValues = Object.values(hCropMap);
        if (hLabels.length === 0) {
            document.getElementById('chart-harvest-crop').parentElement.querySelector('.chart-card-body').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No harvest data</div>';
            return;
        }
        this.charts.harvestCrop = new Chart(document.getElementById('chart-harvest-crop'), {
            type: 'bar',
            data: { labels: hLabels, datasets: [{ label: 'Quantity (kg)', data: hValues, backgroundColor: this.colors.slice(0, hLabels.length), borderRadius: 6, borderSkipped: false }] },
            options: { ...this.defaultChartOptions(), plugins: { ...this.defaultChartOptions().plugins, legend: { display: false } }, scales: { ...this.defaultChartOptions().scales, x: { ...this.defaultChartOptions().scales.x, ticks: { ...this.defaultChartOptions().scales.x.ticks, maxRotation: 45 } } } }
        });
    },

    // ---- PRODUCTION TREND ----
    renderProductionTrend() {
        const harvests = this.filteredHarvests().sort((a, b) => a.harvest_date.localeCompare(b.harvest_date));
        const monthMap = {};
        harvests.forEach(h => {
            if (!h.harvest_date) return;
            const key = h.harvest_date.substring(0, 7);
            monthMap[key] = (monthMap[key] || 0) + (h.quantity || 0);
        });
        const sorted = Object.entries(monthMap).sort((a, b) => a[0].localeCompare(b[0]));
        const labels = sorted.map(([k]) => { const [y, m] = k.split('-'); return new Date(y, m - 1).toLocaleString('en', { month: 'short', year: '2-digit' }); });
        const values = sorted.map(([, v]) => v);

        document.getElementById('dash-row-trend').innerHTML = `
            <div class="chart-card full-width" style="margin-bottom:20px;">
                <div class="chart-card-header"><h3><i class="fas fa-chart-line" style="color:var(--primary);margin-right:8px;"></i>Production Trend</h3></div>
                <div class="chart-card-body" style="height:300px;position:relative;"><canvas id="chart-production-trend"></canvas></div>
            </div>
        `;

        if (labels.length === 0) {
            document.getElementById('chart-production-trend').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No harvest data for trend</div>';
            return;
        }

        this.charts.prodTrend = new Chart(document.getElementById('chart-production-trend'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Harvest (kg)',
                    data: values,
                    borderColor: '#2E7D32',
                    backgroundColor: 'rgba(46,125,50,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#2E7D32',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    borderWidth: 3
                }]
            },
            options: { ...this.defaultChartOptions() }
        });
    },

    // ---- CROP PERFORMANCE ----
    renderCropPerformance() {
        const cycles = this.filteredCycles();
        const cropData = {};
        cycles.forEach(c => {
            const n = c.crops?.name || 'Unknown';
            if (!cropData[n]) cropData[n] = { area: 0, cycles: 0, production: 0 };
            cropData[n].area += (c.area_planted || 0);
            cropData[n].cycles += 1;
            cropData[n].production += (c.actual_production || 0);
        });
        const labels = Object.keys(cropData);
        const areas = labels.map(l => cropData[l].area);
        const prods = labels.map(l => cropData[l].production);

        document.getElementById('dash-row4').innerHTML = `
            <div class="chart-card">
                <div class="chart-card-header">
                    <h3><i class="fas fa-seedling" style="color:var(--primary);margin-right:8px;"></i>Crop Performance</h3>
                    <select class="dashboard-filter-select" id="perf-metric" style="font-size:11px;padding:5px 24px 5px 8px;">
                        <option value="area">Area Planted</option>
                        <option value="production">Production</option>
                        <option value="cycles">Number of Cycles</option>
                    </select>
                </div>
                <div class="chart-card-body" style="height:260px;position:relative;"><canvas id="chart-crop-perf"></canvas></div>
            </div>
            <div class="chart-card" id="harvest-analytics-card">
                <div class="chart-card-header"><h3><i class="fas fa-wheat-awn" style="color:var(--orange);margin-right:8px;"></i>Harvest Analytics</h3></div>
                <div class="chart-card-body" id="harvest-analytics-body"></div>
            </div>
        `;

        const renderPerf = (metric) => {
            const dataMap = { area: areas, production: prods, cycles: labels.map(l => cropData[l].cycles) };
            const labelMap = { area: 'Area (ha)', production: 'Production (kg)', cycles: 'Cycles' };
            const d = dataMap[metric];

            if (this.charts.cropPerf) this.charts.cropPerf.destroy();
            if (labels.length === 0) return;

            this.charts.cropPerf = new Chart(document.getElementById('chart-crop-perf'), {
                type: 'bar',
                data: { labels, datasets: [{ label: labelMap[metric], data: d, backgroundColor: this.colors.slice(0, labels.length), borderRadius: 6, borderSkipped: false }] },
                options: { ...this.defaultChartOptions(), plugins: { ...this.defaultChartOptions().plugins, legend: { display: false } } }
            });
        };
        renderPerf('area');
        document.getElementById('perf-metric').addEventListener('change', e => renderPerf(e.target.value));

        // Harvest Analytics
        const harvests = this.filteredHarvests();
        const totalQty = harvests.reduce((s, h) => s + (h.quantity || 0), 0);
        const avgYield = harvests.length > 0 ? harvests.reduce((s, h) => s + (h.quantity || 0), 0) / Math.max(1, harvests.reduce((s, h) => s + (h.harvested_area || 0), 0)) : 0;
        const totalCost = harvests.reduce((s, h) => s + (h.labor_cost || 0) + (h.transport_cost || 0) + (h.other_costs || 0), 0);

        document.getElementById('harvest-analytics-body').innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="text-align:center;padding:16px;background:var(--bg);border-radius:10px;">
                    <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Harvested</div>
                    <div style="font-size:24px;font-weight:800;color:var(--text);margin-top:6px;">${Utils.formatNumber(Math.round(totalQty))}</div>
                    <div style="font-size:11px;color:var(--text-light);">kg</div>
                </div>
                <div style="text-align:center;padding:16px;background:var(--bg);border-radius:10px;">
                    <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Avg Yield</div>
                    <div style="font-size:24px;font-weight:800;color:var(--primary);margin-top:6px;">${avgYield.toFixed(0)}</div>
                    <div style="font-size:11px;color:var(--text-light);">kg/ha</div>
                </div>
                <div style="text-align:center;padding:16px;background:var(--bg);border-radius:10px;">
                    <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Harvest Records</div>
                    <div style="font-size:24px;font-weight:800;color:var(--blue);margin-top:6px;">${harvests.length}</div>
                    <div style="font-size:11px;color:var(--text-light);">records</div>
                </div>
                <div style="text-align:center;padding:16px;background:var(--bg);border-radius:10px;">
                    <div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Harvest Costs</div>
                    <div style="font-size:24px;font-weight:800;color:var(--red);margin-top:6px;">${Utils.formatCurrency(totalCost)}</div>
                    <div style="font-size:11px;color:var(--text-light);">total</div>
                </div>
            </div>
        `;
    },

    // ---- FINANCIAL OVERVIEW ----
    renderFinancialOverview() {
        const expenses = this.filteredExpenses().sort((a, b) => a.expense_date.localeCompare(b.expense_date));
        const sales = this.filteredSales().sort((a, b) => a.sale_date.localeCompare(b.sale_date));

        const expByMonth = {};
        expenses.forEach(e => { const k = e.expense_date?.substring(0, 7); if (k) expByMonth[k] = (expByMonth[k] || 0) + (e.amount || 0); });
        const salByMonth = {};
        sales.forEach(s => { const k = s.sale_date?.substring(0, 7); if (k) salByMonth[k] = (salByMonth[k] || 0) + (s.total_amount || 0); });

        const allMonths = [...new Set([...Object.keys(expByMonth), ...Object.keys(salByMonth)])].sort();
        const labels = allMonths.map(k => { const [y, m] = k.split('-'); return new Date(y, m - 1).toLocaleString('en', { month: 'short', year: '2-digit' }); });
        const expVals = allMonths.map(k => expByMonth[k] || 0);
        const salVals = allMonths.map(k => salByMonth[k] || 0);
        const balVals = allMonths.map((k, i) => salVals[i] - expVals[i]);

        const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const totalSal = sales.reduce((s, sl) => s + (sl.total_amount || 0), 0);
        const pending = sales.filter(s => s.payment_status === 'Pending').reduce((s, sl) => s + (sl.total_amount || 0), 0);

        document.getElementById('dash-row5').innerHTML = `
            <div class="chart-card full-width">
                <div class="chart-card-header">
                    <h3><i class="fas fa-chart-area" style="color:var(--primary);margin-right:8px;"></i>Revenue vs Expenses</h3>
                    <div style="display:flex;gap:16px;font-size:12px;">
                        <span style="color:var(--green);font-weight:600;"><i class="fas fa-arrow-up"></i> ${Utils.formatCurrency(totalSal)} Revenue</span>
                        <span style="color:var(--red);font-weight:600;"><i class="fas fa-arrow-down"></i> ${Utils.formatCurrency(totalExp)} Expenses</span>
                        <span style="color:var(--blue);font-weight:600;">Net: ${Utils.formatCurrency(totalSal - totalExp)}</span>
                        ${pending > 0 ? `<span style="color:var(--orange);font-weight:600;"><i class="fas fa-clock"></i> ${Utils.formatCurrency(pending)} Pending</span>` : ''}
                    </div>
                </div>
                <div class="chart-card-body" style="height:280px;position:relative;"><canvas id="chart-finance"></canvas></div>
            </div>
        `;

        if (labels.length === 0) {
            document.getElementById('chart-finance').parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No financial data yet</div>';
            return;
        }

        this.charts.finance = new Chart(document.getElementById('chart-finance'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Revenue', data: salVals, backgroundColor: 'rgba(46,125,50,0.7)', borderRadius: 4, borderSkipped: false, order: 2 },
                    { label: 'Expenses', data: expVals, backgroundColor: 'rgba(211,47,47,0.7)', borderRadius: 4, borderSkipped: false, order: 3 },
                    { label: 'Balance', data: balVals, type: 'line', borderColor: '#1976D2', backgroundColor: 'rgba(25,118,210,0.1)', fill: true, tension: 0.4, pointRadius: 4, borderWidth: 2, order: 1 }
                ]
            },
            options: { ...this.defaultChartOptions() }
        });
    },

    // ---- EXPENSE BREAKDOWN ----
    renderExpenseBreakdown() {
        const expenses = this.filteredExpenses();
        const catMap = {};
        expenses.forEach(e => { catMap[e.category || 'Other'] = (catMap[e.category || 'Other'] || 0) + (e.amount || 0); });
        const labels = Object.keys(catMap);
        const values = Object.values(catMap);

        document.getElementById('dash-row6').innerHTML = `
            <div class="chart-card">
                <div class="chart-card-header"><h3><i class="fas fa-receipt" style="color:var(--red);margin-right:8px;"></i>Expense Breakdown</h3></div>
                <div class="chart-card-body" style="height:260px;position:relative;"><canvas id="chart-expense-breakdown"></canvas></div>
            </div>
            <div class="chart-card" id="sales-analytics-card">
                <div class="chart-card-header"><h3><i class="fas fa-hand-holding-usd" style="color:var(--green);margin-right:8px;"></i>Sales Analytics</h3></div>
                <div class="chart-card-body" id="sales-analytics-body"></div>
            </div>
        `;

        if (labels.length === 0) {
            document.getElementById('chart-expense-breakdown').parentElement.querySelector('.chart-card-body').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No expense data</div>';
        } else {
            this.charts.expBreakdown = new Chart(document.getElementById('chart-expense-breakdown'), {
                type: 'doughnut',
                data: { labels, datasets: [{ data: values, backgroundColor: this.colors.slice(0, labels.length), borderWidth: 2, borderColor: this.chartBg() }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { position: 'right', labels: { color: this.chartTextColor(), font: { family: 'Inter', size: 11 }, padding: 8, usePointStyle: true, pointStyleWidth: 8 } } } }
            });
        }

        // Sales Analytics
        const sales = this.filteredSales();
        const paid = sales.filter(s => s.payment_status === 'Paid').reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const pending = sales.filter(s => s.payment_status === 'Pending').reduce((sum, s) => sum + (s.total_amount || 0), 0);
        const partial = sales.filter(s => s.payment_status === 'Partially Paid').reduce((sum, s) => sum + (s.total_amount || 0), 0);

        document.getElementById('sales-analytics-body').innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
                <div style="text-align:center;padding:14px 8px;background:#E8F5E9;border-radius:8px;">
                    <div style="font-size:10px;color:#2E7D32;font-weight:700;text-transform:uppercase;">Paid</div>
                    <div style="font-size:18px;font-weight:800;color:#2E7D32;margin-top:4px;">${Utils.formatCurrency(paid)}</div>
                </div>
                <div style="text-align:center;padding:14px 8px;background:#FFF8E1;border-radius:8px;">
                    <div style="font-size:10px;color:#F57F17;font-weight:700;text-transform:uppercase;">Pending</div>
                    <div style="font-size:18px;font-weight:800;color:#F57F17;margin-top:4px;">${Utils.formatCurrency(pending)}</div>
                </div>
                <div style="text-align:center;padding:14px 8px;background:#E3F2FD;border-radius:8px;">
                    <div style="font-size:10px;color:#1565C0;font-weight:700;text-transform:uppercase;">Partial</div>
                    <div style="font-size:18px;font-weight:800;color:#1565C0;margin-top:4px;">${Utils.formatCurrency(partial)}</div>
                </div>
            </div>
            <div style="margin-top:16px;text-align:center;padding:12px;background:var(--bg);border-radius:8px;">
                <div style="font-size:11px;color:var(--text-light);">Total Sales</div>
                <div style="font-size:22px;font-weight:800;color:var(--text);">${Utils.formatCurrency(paid + pending + partial)}</div>
                <div style="font-size:11px;color:var(--text-light);">${sales.length} records</div>
            </div>
        `;
    },

    // ---- INVENTORY HEALTH ----
    renderInventoryHealth() {
        const inv = this.data.inventory;
        const healthy = inv.filter(i => i.current_quantity > i.minimum_stock * 1.5).length;
        const low = inv.filter(i => i.current_quantity > 0 && i.current_quantity <= i.minimum_stock * 1.5).length;
        const out = inv.filter(i => i.current_quantity <= 0).length;
        const expiring = inv.filter(i => i.expiry_date && new Date(i.expiry_date) <= new Date(Date.now() + 30 * 86400000) && new Date(i.expiry_date) >= new Date()).length;
        const total = inv.length || 1;

        document.getElementById('dash-row7').innerHTML = `
            <div class="chart-card" id="inventory-health-card">
                <div class="chart-card-header"><h3><i class="fas fa-boxes" style="color:var(--blue);margin-right:8px;"></i>Inventory Health</h3></div>
                <div class="chart-card-body">
                    ${inv.length === 0 ? '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No inventory items yet</div>' : `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#E8F5E9;border-radius:8px;">
                            <div style="width:40px;height:40px;border-radius:8px;background:rgba(46,125,50,0.15);display:flex;align-items:center;justify-content:center;color:#2E7D32;font-weight:700;font-size:16px;">${healthy}</div>
                            <div><div style="font-size:13px;font-weight:600;color:#2E7D32;">Healthy Stock</div><div style="font-size:11px;color:var(--text-light);">${Math.round(healthy/total*100)}% of items</div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#FFF8E1;border-radius:8px;">
                            <div style="width:40px;height:40px;border-radius:8px;background:rgba(249,168,37,0.15);display:flex;align-items:center;justify-content:center;color:#F9A825;font-weight:700;font-size:16px;">${low}</div>
                            <div><div style="font-size:13px;font-weight:600;color:#F57F17;">Low Stock</div><div style="font-size:11px;color:var(--text-light);">${Math.round(low/total*100)}% of items</div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#FFEBEE;border-radius:8px;">
                            <div style="width:40px;height:40px;border-radius:8px;background:rgba(211,47,47,0.15);display:flex;align-items:center;justify-content:center;color:#D32F2F;font-weight:700;font-size:16px;">${out}</div>
                            <div><div style="font-size:13px;font-weight:600;color:#D32F2F;">Out of Stock</div><div style="font-size:11px;color:var(--text-light);">${Math.round(out/total*100)}% of items</div></div>
                        </div>
                        <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#E3F2FD;border-radius:8px;">
                            <div style="width:40px;height:40px;border-radius:8px;background:rgba(25,118,210,0.15);display:flex;align-items:center;justify-content:center;color:#1976D2;font-weight:700;font-size:16px;">${expiring}</div>
                            <div><div style="font-size:13px;font-weight:600;color:#1565C0;">Expiring Soon</div><div style="font-size:11px;color:var(--text-light);">Within 30 days</div></div>
                        </div>
                    </div>
                    <div style="margin-top:16px;">
                        <div class="progress-bar" style="height:10px;display:flex;border-radius:5px;overflow:hidden;">
                            <div style="width:${(healthy/total*100)}%;background:#2E7D32;"></div>
                            <div style="width:${(low/total*100)}%;background:#F9A825;"></div>
                            <div style="width:${(expiring/total*100)}%;background:#1976D2;"></div>
                            <div style="width:${(out/total*100)}%;background:#D32F2F;"></div>
                        </div>
                    </div>
                    `}
                </div>
            </div>
            <div class="chart-card" id="crop-health-card">
                <div class="chart-card-header"><h3><i class="fas fa-heartbeat" style="color:var(--red);margin-right:8px;"></i>Crop Health</h3></div>
                <div class="chart-card-body" id="crop-health-body"></div>
            </div>
        `;
        this.renderCropHealthBody();
    },

    renderCropHealthBody() {
        const scouting = this.data.scouting;
        if (scouting.length === 0) {
            document.getElementById('crop-health-body').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:13px;">No scouting data</div>';
            return;
        }

        const healthy = scouting.filter(s => s.plant_health === 'Healthy').length;
        const observed = scouting.filter(s => s.plant_health === 'Under Observation').length;
        const atRisk = scouting.filter(s => s.plant_health === 'At Risk').length;
        const total = scouting.length;
        const pests = scouting.filter(s => s.pest_observation).length;
        const diseases = scouting.filter(s => s.disease_observation).length;
        const weeds = scouting.filter(s => s.weed_observation).length;

        document.getElementById('crop-health-body').innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
                <div style="text-align:center;padding:12px;background:#E8F5E9;border-radius:8px;">
                    <div style="font-size:20px;font-weight:800;color:#2E7D32;">${healthy}</div>
                    <div style="font-size:11px;color:#2E7D32;font-weight:600;">Healthy</div>
                </div>
                <div style="text-align:center;padding:12px;background:#FFF8E1;border-radius:8px;">
                    <div style="font-size:20px;font-weight:800;color:#F57F17;">${observed}</div>
                    <div style="font-size:11px;color:#F57F17;font-weight:600;">Observed</div>
                </div>
                <div style="text-align:center;padding:12px;background:#FFEBEE;border-radius:8px;">
                    <div style="font-size:20px;font-weight:800;color:#D32F2F;">${atRisk}</div>
                    <div style="font-size:11px;color:#D32F2F;font-weight:600;">At Risk</div>
                </div>
            </div>
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;">Recent Observations</div>
            <div style="font-size:12px;color:var(--text-light);display:flex;flex-direction:column;gap:6px;">
                ${pests > 0 ? `<div style="padding:8px 10px;background:#FFEBEE;border-radius:6px;border-left:3px solid #D32F2F;"><i class="fas fa-bug" style="color:#D32F2F;margin-right:6px;"></i>${pests} pest observation${pests > 1 ? 's' : ''}</div>` : ''}
                ${diseases > 0 ? `<div style="padding:8px 10px;background:#FFF3E0;border-radius:6px;border-left:3px solid #E65100;"><i class="fas fa-virus" style="color:#E65100;margin-right:6px;"></i>${diseases} disease observation${diseases > 1 ? 's' : ''}</div>` : ''}
                ${weeds > 0 ? `<div style="padding:8px 10px;background:#E8F5E9;border-radius:6px;border-left:3px solid #2E7D32;"><i class="fas fa-leaf" style="color:#2E7D32;margin-right:6px;"></i>${weeds} weed observation${weeds > 1 ? 's' : ''}</div>` : ''}
                ${pests === 0 && diseases === 0 && weeds === 0 ? '<div style="text-align:center;padding:12px;color:var(--text-light);">No issues reported</div>' : ''}
            </div>
        `;
    },

    // ---- RECENT ACTIVITIES ----
    renderRecentActivities() {
        const acts = this.data.activities.slice(0, 8);
        const iconMap = { 'Land Preparation': 'fa-tractor', 'Ploughing': 'fa-tractor', 'Harrowing': 'fa-tractor', 'Planting': 'fa-seedling', 'Weeding': 'fa-leaf', 'Fertilization': 'fa-flask', 'Irrigation': 'fa-tint', 'Spraying': 'fa-shield-alt', 'Scouting': 'fa-search', 'Harvest': 'fa-wheat-awn', 'Transport': 'fa-truck', 'Machinery': 'fa-cog', 'Other': 'fa-tasks' };

        let html = '';
        if (acts.length === 0) {
            html = '<div style="text-align:center;padding:24px;color:var(--text-light);font-size:13px;">No recent activities</div>';
        } else {
            html = '<div class="activity-timeline">';
            acts.forEach(a => {
                const icon = iconMap[a.activity_type] || 'fa-tasks';
                html += `<div class="activity-item">
                    <div class="activity-dot"></div>
                    <div class="activity-text"><strong>${Utils.escapeHtml(a.activity_type)}</strong> — ${Utils.escapeHtml(a.description || 'No description')}</div>
                    <div class="activity-meta">${Utils.escapeHtml(a.farms?.name || '')} ${a.fields?.name ? '/ ' + Utils.escapeHtml(a.fields.name) : ''} &middot; ${Utils.formatDate(a.activity_date)}${a.total_cost > 0 ? ' &middot; ' + Utils.formatCurrency(a.total_cost) : ''}</div>
                </div>`;
            });
            html += '</div>';
        }

        // Replace row7 content with activities + crop health (already rendered)
        // Activities go in a new section
        const existingRow7 = document.getElementById('dash-row7');
        if (existingRow7) {
            existingRow7.innerHTML = `
                <div class="chart-card">
                    <div class="chart-card-header"><h3><i class="fas fa-clock" style="color:var(--purple);margin-right:8px;"></i>Recent Activities</h3></div>
                    <div class="chart-card-body" style="max-height:320px;overflow-y:auto;">${html}</div>
                </div>
                <div class="chart-card">
                    <div class="chart-card-header"><h3><i class="fas fa-heartbeat" style="color:var(--red);margin-right:8px;"></i>Crop Health</h3></div>
                    <div class="chart-card-body" id="crop-health-body"></div>
                </div>
            `;
            this.renderCropHealthBody();
        }
    },

    // ---- UPCOMING EVENTS ----
    renderUpcomingEvents() {
        const cycles = this.data.cycles.filter(c => ['Planned','Planted','Growing','Ready for Harvest'].includes(c.status));
        const now = new Date();
        const upcoming = cycles
            .filter(c => c.expected_harvest_date && new Date(c.expected_harvest_date) >= now)
            .sort((a, b) => new Date(a.expected_harvest_date) - new Date(b.expected_harvest_date))
            .slice(0, 5);

        let html = '';
        if (upcoming.length === 0) {
            html = '<div style="text-align:center;padding:24px;color:var(--text-light);font-size:13px;">No upcoming events</div>';
        } else {
            upcoming.forEach(c => {
                const d = new Date(c.expected_harvest_date);
                html += `<div class="upcoming-event">
                    <div class="upcoming-date"><span class="day">${d.getDate()}</span><span class="month">${d.toLocaleString('en', { month: 'short' })}</span></div>
                    <div class="upcoming-info"><div class="title">Expected Harvest — ${Utils.escapeHtml(c.crops?.name || '')}</div><div class="meta">${Utils.escapeHtml(c.farms?.name || '')} / ${Utils.escapeHtml(c.fields?.name || '')}</div></div>
                </div>`;
            });
        }

        document.getElementById('dash-row8').innerHTML = `
            <div class="chart-card">
                <div class="chart-card-header"><h3><i class="fas fa-calendar-check" style="color:var(--blue);margin-right:8px;"></i>Upcoming Events</h3></div>
                <div class="chart-card-body" style="max-height:300px;overflow-y:auto;">${html}</div>
            </div>
            <div class="chart-card" id="alerts-card">
                <div class="chart-card-header"><h3><i class="fas fa-bell" style="color:var(--orange);margin-right:8px;"></i>Alerts</h3></div>
                <div class="chart-card-body" id="alerts-body" style="max-height:300px;overflow-y:auto;"></div>
            </div>
            <div class="chart-card" id="quick-actions-card">
                <div class="chart-card-header"><h3><i class="fas fa-bolt" style="color:var(--purple);margin-right:8px;"></i>Quick Actions</h3></div>
                <div class="chart-card-body" id="quick-actions-body" style="max-height:300px;overflow-y:auto;"></div>
            </div>
        `;

        this.renderAlerts();
        this.renderQuickActions();
    },

    // ---- ALERTS ----
    renderAlerts() {
        const alerts = [];
        const inv = this.data.inventory;
        inv.filter(i => i.current_quantity <= i.minimum_stock && i.current_quantity > 0).forEach(i => {
            alerts.push({ type: 'warning', icon: 'fa-boxes', title: 'LOW STOCK', msg: `${Utils.escapeHtml(i.name)} is below minimum stock level.` });
        });
        inv.filter(i => i.current_quantity <= 0).forEach(i => {
            alerts.push({ type: 'danger', icon: 'fa-boxes', title: 'OUT OF STOCK', msg: `${Utils.escapeHtml(i.name)} has zero stock.` });
        });
        inv.filter(i => i.expiry_date && new Date(i.expiry_date) <= new Date(Date.now() + 10 * 86400000) && new Date(i.expiry_date) >= new Date()).forEach(i => {
            alerts.push({ type: 'warning', icon: 'fa-clock', title: 'EXPIRING INPUT', msg: `${Utils.escapeHtml(i.name)} expires on ${Utils.formatDate(i.expiry_date)}.` });
        });

        this.data.cycles.filter(c => c.status === 'Ready for Harvest').forEach(c => {
            const days = c.expected_harvest_date ? Math.ceil((new Date(c.expected_harvest_date) - new Date()) / 86400000) : 0;
            alerts.push({ type: 'info', icon: 'fa-wheat-awn', title: 'HARVEST READY', msg: `${Utils.escapeHtml(c.crops?.name || '')} is ready for harvest.${days > 0 ? ` Expected ${days} days ago.` : ''}` });
        });

        this.data.scouting.filter(s => s.plant_health === 'At Risk').slice(-3).forEach(s => {
            alerts.push({ type: 'danger', icon: 'fa-exclamation-triangle', title: 'CROP HEALTH', msg: `At-risk observation on ${Utils.escapeHtml(s.crops?.name || '')} at ${Utils.escapeHtml(s.farms?.name || '')}.` });
        });

        const body = document.getElementById('alerts-body');
        if (alerts.length === 0) {
            body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-light);font-size:13px;"><i class="fas fa-check-circle" style="font-size:24px;color:var(--primary);display:block;margin-bottom:8px;"></i>All clear — no alerts</div>';
        } else {
            body.innerHTML = alerts.slice(0, 8).map(a => `
                <div class="alert-item alert-${a.type}">
                    <i class="fas ${a.icon}"></i>
                    <div class="alert-content"><strong>${a.title}</strong>${a.msg}</div>
                </div>
            `).join('');
        }
    },

    // ---- QUICK ACTIONS ----
    renderQuickActions() {
        const actions = [
            { icon: 'fa-tractor', label: 'Add Farm', link: 'pages/farms.html', action: "Utils.openModal('farm-modal')" },
            { icon: 'fa-map', label: 'Add Field', link: 'pages/fields.html', action: "Utils.openModal('field-modal')" },
            { icon: 'fa-sync-alt', label: 'Start Cycle', link: 'pages/crop-cycles.html', action: "Utils.openModal('cycle-modal')" },
            { icon: 'fa-seedling', label: 'Record Planting', link: 'pages/planting.html', action: "Utils.openModal('planting-modal')" },
            { icon: 'fa-tasks', label: 'Record Activity', link: 'pages/activities.html', action: "Utils.openModal('activity-modal')" },
            { icon: 'fa-tint', label: 'Record Irrigation', link: 'pages/irrigation.html', action: "Utils.openModal('irrigation-modal')" },
            { icon: 'fa-flask', label: 'Record Fertilizer', link: 'pages/fertilizers.html', action: "Utils.openModal('fert-modal')" },
            { icon: 'fa-search', label: 'Record Scouting', link: 'pages/scouting.html', action: "Utils.openModal('scout-modal')" },
            { icon: 'fa-wheat-awn', label: 'Record Harvest', link: 'pages/harvest.html', action: "Utils.openModal('harvest-modal')" },
            { icon: 'fa-receipt', label: 'Add Expense', link: 'pages/expenses.html', action: '' },
            { icon: 'fa-hand-holding-usd', label: 'Record Sale', link: 'pages/sales.html', action: '' },
            { icon: 'fa-calculator', label: 'Calculators', link: 'pages/calculators.html', action: '' }
        ];

        document.getElementById('quick-actions-body').innerHTML = `<div class="quick-actions-grid">${actions.map(a => {
            const onclick = a.action ? `onclick="window.location.href='${a.link}'; setTimeout(()=>${a.action},300)"` : `onclick="window.location.href='${a.link}'"`;
            return `<button class="quick-action-btn" ${onclick}><i class="fas ${a.icon}"></i> ${a.label}</button>`;
        }).join('')}</div>`;
    },

    // ---- NOTIFICATIONS ----
    async loadNotifications() {
        try {
            const { data } = await db.from('notifications')
                .select('*')
                .eq('user_id', App.currentUser.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false })
                .limit(10);

            const notifs = data || [];
            const countEl = document.getElementById('notif-count');
            const listEl = document.getElementById('notif-list');

            if (countEl) countEl.textContent = notifs.length;
            if (countEl) countEl.style.display = notifs.length > 0 ? 'flex' : 'none';

            if (listEl) {
                if (notifs.length === 0) {
                    listEl.innerHTML = '<div class="dropdown-empty">No new notifications</div>';
                } else {
                    const iconMap = { info: 'info', warning: 'warning', danger: 'danger', success: 'success' };
                    listEl.innerHTML = notifs.map(n => `
                        <div class="notif-item ${n.is_read ? '' : 'unread'}">
                            <div class="notif-icon ${iconMap[n.type] || 'info'}"><i class="fas fa-bell"></i></div>
                            <div class="notif-content">
                                <div class="notif-text">${Utils.escapeHtml(n.message || n.title)}</div>
                                <div class="notif-time">${Utils.formatDateTime(n.created_at)}</div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Notification load error:', err);
        }
    },

    async markAllRead() {
        try {
            await db.from('notifications').update({ is_read: true }).eq('user_id', App.currentUser.id).eq('is_read', false);
            document.getElementById('notif-count').textContent = '0';
            document.getElementById('notif-count').style.display = 'none';
            document.getElementById('notif-list').innerHTML = '<div class="dropdown-empty">No new notifications</div>';
            Utils.toast('All notifications marked as read', 'info');
        } catch (err) {
            console.error('Mark read error:', err);
        }
    }
};