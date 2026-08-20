// ============================================================
// FIELD ACTIVITIES MODULE
// ============================================================

const Activities = {
    data: [],
    farms: [], fields: [], cycles: [],
    activityTypes: ['Land Preparation','Ploughing','Harrowing','Planting','Weeding','Fertilization','Irrigation','Spraying','Scouting','Harvest','Transport','Machinery','Other'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterType: '',
    sortBy: 'activity_date', sortOrder: 'desc',

    async init() {
        await this.loadLookups();
        await this.load();
        this.bindEvents();
    },

    async loadLookups() {
        const [farmsRes, cyclesRes] = await Promise.all([
            db.from('farms').select('id, name').eq('user_id', App.currentUser.id).order('name'),
            db.from('crop_cycles').select('id, farms(name), fields(name), crops(name)').eq('user_id', App.currentUser.id).order('created_at', { ascending: false })
        ]);
        this.farms = farmsRes.data || [];
        this.cycles = (cyclesRes.data || []).map(c => ({ ...c, label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}` }));
        Utils.populateSelect ? null : null;
        const fs = document.getElementById('activity-farm');
        if (fs) { fs.innerHTML = '<option value="">Select Farm</option>'; this.farms.forEach(f => { fs.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
        const cs = document.getElementById('activity-cycle');
        if (cs) { cs.innerHTML = '<option value="">Select Crop Cycle</option>'; this.cycles.forEach(c => { cs.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.label)}</option>`; }); }
        const ff = document.getElementById('filter-activity-farm');
        if (ff) { ff.innerHTML = '<option value="">All Farms</option>'; this.farms.forEach(f => { ff.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
        const ft = document.getElementById('filter-activity-type');
        if (ft) { ft.innerHTML = '<option value="">All Types</option>'; this.activityTypes.forEach(t => { ft.innerHTML += `<option value="${t}">${t}</option>`; }); }
        const at = document.getElementById('activity-type');
        if (at) { at.innerHTML = '<option value="">Select Type</option>'; this.activityTypes.forEach(t => { at.innerHTML += `<option value="${t}">${t}</option>`; }); }
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const sel = document.getElementById('activity-field');
        if (sel) { sel.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { sel.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; }); }
    },

    async load() {
        Utils.showLoading('activities-table-container');
        let query = db.from('field_activities').select('*, farms(name), fields(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterType) query = query.eq('activity_type', this.filterType);
        if (this.searchQuery) query = query.or(`description.ilike.%${this.searchQuery}%,performed_by.ilike.%${this.searchQuery}%`);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('activities-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load activities.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('activities-table-container');
        if (!container) return;
        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState('fa-tasks', 'No Activities', 'Record field activities to track all work done on your farm.', 'Add Activity', "Utils.openModal('activity-modal')");
            return;
        }
        let html = `<div class="table-responsive"><table class="data-table">
            <thead><tr>
                <th class="sortable" data-sort="activity_date">Date <i class="fas fa-sort"></i></th>
                <th>Type</th>
                <th>Farm / Field</th>
                <th>Crop</th>
                <th>Description</th>
                <th>Total Cost</th>
                <th>Actions</th>
            </tr></thead><tbody>`;
        this.data.forEach(a => {
            html += `<tr>
                <td>${Utils.formatDate(a.activity_date)}</td>
                <td><span class="badge badge-info">${Utils.escapeHtml(a.activity_type)}</span></td>
                <td>${Utils.escapeHtml(a.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(a.fields?.name || '')}</span></td>
                <td>${Utils.escapeHtml(a.crop_cycles?.crops?.name || '—')}</td>
                <td class="text-truncate" style="max-width:200px;">${Utils.escapeHtml(a.description || '—')}</td>
                <td>${a.total_cost ? Utils.formatCurrency(a.total_cost) : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Activities.view('${a.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Activities.edit('${a.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Activities.confirmDelete('${a.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        Utils.renderPagination('activities-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        container.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        const si = document.getElementById('activities-search');
        if (si) si.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        const ff = document.getElementById('filter-activity-farm');
        if (ff) ff.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        const ft = document.getElementById('filter-activity-type');
        if (ft) ft.addEventListener('change', e => { this.filterType = e.target.value; this.currentPage = 1; this.load(); });
        const farmSel = document.getElementById('activity-farm');
        if (farmSel) farmSel.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('activity-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]');
            Utils.setBtnLoading(btn, true);
            const fd = {
                user_id: App.currentUser.id,
                farm_id: form.activity_farm.value || null,
                field_id: form.activity_field.value || null,
                crop_cycle_id: form.activity_cycle.value || null,
                activity_type: form.activity_type.value,
                activity_date: form.activity_date.value,
                description: form.activity_description.value.trim(),
                labor_cost: parseFloat(form.activity_labor_cost.value) || 0,
                equipment_cost: parseFloat(form.activity_equipment_cost.value) || 0,
                material_cost: parseFloat(form.activity_material_cost.value) || 0,
                performed_by: form.activity_performed_by.value.trim(),
                notes: form.activity_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('field_activities').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Activity updated'); }
                else { const { error } = await db.from('field_activities').insert(fd); if (error) throw error; Utils.toast('Activity added'); }
                Utils.closeModal('activity-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; }
        });
    },

    edit(id) {
        const a = this.data.find(x => x.id === id);
        if (!a) return;
        const form = document.getElementById('activity-form');
        if (!form) return;
        if (a.farm_id) this.loadFields(a.farm_id);
        form.dataset.editId = id;
        form.activity_farm.value = a.farm_id || '';
        form.activity_field.value = a.field_id || '';
        form.activity_cycle.value = a.crop_cycle_id || '';
        form.activity_type.value = a.activity_type || '';
        form.activity_date.value = a.activity_date || '';
        form.activity_description.value = a.description || '';
        form.activity_labor_cost.value = a.labor_cost || 0;
        form.activity_equipment_cost.value = a.equipment_cost || 0;
        form.activity_material_cost.value = a.material_cost || 0;
        form.activity_performed_by.value = a.performed_by || '';
        form.activity_notes.value = a.notes || '';
        document.querySelector('#activity-modal .modal-title').textContent = 'Edit Activity';
        Utils.openModal('activity-modal');
    },

    view(id) {
        const a = this.data.find(x => x.id === id);
        if (!a) return;
        document.getElementById('activity-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(a.activity_date)}</p></div>
                <div class="view-item"><label>Type</label><p>${Utils.escapeHtml(a.activity_type)}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(a.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(a.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(a.crop_cycles?.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Performed By</label><p>${Utils.escapeHtml(a.performed_by || '—')}</p></div>
                <div class="view-item"><label>Labor Cost</label><p>${Utils.formatCurrency(a.labor_cost)}</p></div>
                <div class="view-item"><label>Equipment Cost</label><p>${Utils.formatCurrency(a.equipment_cost)}</p></div>
                <div class="view-item"><label>Material Cost</label><p>${Utils.formatCurrency(a.material_cost)}</p></div>
                <div class="view-item"><label>Total Cost</label><p><strong>${Utils.formatCurrency(a.total_cost)}</strong></p></div>
                <div class="view-item full-width"><label>Description</label><p>${Utils.escapeHtml(a.description || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(a.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('activity-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this activity record?', async () => {
            try { const { error } = await db.from('field_activities').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};