// ============================================================
// IRRIGATION RECORDS MODULE
// ============================================================

const Irrigation = {
    data: [],
    farms: [], fields: [], cycles: [],
    methods: ['Drip', 'Sprinkler', 'Furrow', 'Basin', 'Flood', 'Center Pivot', 'Other'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterMethod: '',
    sortBy: 'irrigation_date', sortOrder: 'desc',

    async init() {
        await this.loadLookups();
        await this.load();
        this.bindEvents();
    },

    async loadLookups() {
        const [farmsRes, cyclesRes] = await Promise.all([
            db.from('farms').select('id, name').eq('user_id', App.currentUser.id).order('name'),
            db.from('crop_cycles').select('id, farms(name), fields(name), crops(name)').eq('user_id', App.currentUser.id).limit(200)
        ]);
        this.farms = farmsRes.data || [];
        this.cycles = (cyclesRes.data || []).map(c => ({ ...c, label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}` }));
        const fs = document.getElementById('irrigation-farm');
        if (fs) { fs.innerHTML = '<option value="">Select Farm</option>'; this.farms.forEach(f => { fs.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
        const cs = document.getElementById('irrigation-cycle');
        if (cs) { cs.innerHTML = '<option value="">Select Crop Cycle</option>'; this.cycles.forEach(c => { cs.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.label)}</option>`; }); }
        const ff = document.getElementById('filter-irrigation-farm');
        if (ff) { ff.innerHTML = '<option value="">All Farms</option>'; this.farms.forEach(f => { ff.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
        const fm = document.getElementById('filter-irrigation-method');
        if (fm) { fm.innerHTML = '<option value="">All Methods</option>'; this.methods.forEach(m => { fm.innerHTML += `<option value="${m}">${m}</option>`; }); }
        const ms = document.getElementById('irrigation-method');
        if (ms) { ms.innerHTML = '<option value="">Select Method</option>'; this.methods.forEach(m => { ms.innerHTML += `<option value="${m}">${m}</option>`; }); }
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const sel = document.getElementById('irrigation-field');
        if (sel) { sel.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { sel.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
    },

    async load() {
        Utils.showLoading('irrigation-table-container');
        let query = db.from('irrigation_records').select('*, farms(name), fields(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterMethod) query = query.eq('irrigation_method', this.filterMethod);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('irrigation-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const c = document.getElementById('irrigation-table-container');
        if (!c) return;
        if (this.data.length === 0) { c.innerHTML = Utils.emptyState('fa-tint', 'No Irrigation Records', 'Track water applications across your fields.', 'Add Irrigation', "Utils.openModal('irrigation-modal')"); return; }
        let html = `<div class="table-responsive"><table class="data-table"><thead><tr>
            <th class="sortable" data-sort="irrigation_date">Date <i class="fas fa-sort"></i></th>
            <th>Method</th><th>Farm / Field</th><th>Volume</th><th>Duration</th><th>Cost</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.data.forEach(r => {
            html += `<tr>
                <td>${Utils.formatDate(r.irrigation_date)}</td>
                <td><span class="badge badge-info">${Utils.escapeHtml(r.irrigation_method)}</span></td>
                <td>${Utils.escapeHtml(r.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(r.fields?.name || '')}</span></td>
                <td>${r.water_volume ? Utils.formatNumber(r.water_volume) + ' ' + Utils.escapeHtml(r.water_unit || 'm³') : '—'}</td>
                <td>${r.duration_hours ? r.duration_hours + ' hrs' : '—'}</td>
                <td>${r.cost ? Utils.formatCurrency(r.cost) : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Irrigation.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Irrigation.edit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Irrigation.confirmDelete('${r.id}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>';
        c.innerHTML = html;
        Utils.renderPagination('irrigation-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        c.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        const si = document.getElementById('irrigation-search');
        if (si) si.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        document.getElementById('filter-irrigation-farm')?.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-irrigation-method')?.addEventListener('change', e => { this.filterMethod = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('irrigation-farm')?.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('irrigation-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault(); if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn, true);
            const fd = {
                user_id: App.currentUser.id, farm_id: form.irrigation_farm.value || null, field_id: form.irrigation_field.value || null,
                crop_cycle_id: form.irrigation_cycle.value || null, irrigation_date: form.irrigation_date.value,
                irrigation_method: form.irrigation_method.value, duration_hours: parseFloat(form.irrigation_duration.value) || null,
                water_volume: parseFloat(form.irrigation_volume.value) || null, water_unit: form.irrigation_volume_unit.value,
                area_irrigated: parseFloat(form.irrigation_area.value) || null, area_unit: form.irrigation_area_unit.value,
                cost: parseFloat(form.irrigation_cost.value) || 0, operator: form.irrigation_operator.value.trim(), notes: form.irrigation_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('irrigation_records').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Updated'); }
                else { const { error } = await db.from('irrigation_records').insert(fd); if (error) throw error; Utils.toast('Added'); }
                Utils.closeModal('irrigation-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; }
        });
    },

    edit(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const form = document.getElementById('irrigation-form'); if (!form) return;
        if (r.farm_id) this.loadFields(r.farm_id);
        form.dataset.editId = id;
        form.irrigation_farm.value = r.farm_id || ''; form.irrigation_field.value = r.field_id || '';
        form.irrigation_cycle.value = r.crop_cycle_id || ''; form.irrigation_date.value = r.irrigation_date || '';
        form.irrigation_method.value = r.irrigation_method || ''; form.irrigation_duration.value = r.duration_hours || '';
        form.irrigation_volume.value = r.water_volume || ''; form.irrigation_volume_unit.value = r.water_unit || 'cubic metres';
        form.irrigation_area.value = r.area_irrigated || ''; form.irrigation_area_unit.value = r.area_unit || 'hectares';
        form.irrigation_cost.value = r.cost || 0; form.irrigation_operator.value = r.operator || ''; form.irrigation_notes.value = r.notes || '';
        document.querySelector('#irrigation-modal .modal-title').textContent = 'Edit Irrigation Record';
        Utils.openModal('irrigation-modal');
    },

    view(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        document.getElementById('irrigation-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(r.irrigation_date)}</p></div>
                <div class="view-item"><label>Method</label><p>${Utils.escapeHtml(r.irrigation_method)}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(r.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(r.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Volume</label><p>${r.water_volume ? Utils.formatNumber(r.water_volume) + ' ' + Utils.escapeHtml(r.water_unit || 'm³') : '—'}</p></div>
                <div class="view-item"><label>Duration</label><p>${r.duration_hours ? r.duration_hours + ' hours' : '—'}</p></div>
                <div class="view-item"><label>Area Irrigated</label><p>${r.area_irrigated ? Utils.formatNumber(r.area_irrigated) + ' ' + Utils.escapeHtml(r.area_unit || 'ha') : '—'}</p></div>
                <div class="view-item"><label>Cost</label><p>${Utils.formatCurrency(r.cost)}</p></div>
                <div class="view-item"><label>Operator</label><p>${Utils.escapeHtml(r.operator || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(r.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('irrigation-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this irrigation record?', async () => {
            try { const { error } = await db.from('irrigation_records').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};