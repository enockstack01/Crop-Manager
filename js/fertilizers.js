// ============================================================
// FERTILIZER APPLICATIONS MODULE
// ============================================================

const Fertilizers = {
    data: [], farms: [], fields: [], cycles: [],
    types: ['NPK', 'Urea', 'DAP', 'CAN', 'MOP', 'TSP', 'Organic', 'Foliar', 'Lime', 'Other'],
    methods: ['Broadcasting', 'Band Placement', 'Fertigation', 'Foliar Spray', 'Top Dressing', 'Basal', 'Other'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterType: '',
    sortBy: 'application_date', sortOrder: 'desc',

    async init() {
        await this.loadLookups(); await this.load(); this.bindEvents();
    },

    async loadLookups() {
        const [farmsRes, cyclesRes] = await Promise.all([
            db.from('farms').select('id, name').eq('user_id', App.currentUser.id).order('name'),
            db.from('crop_cycles').select('id, farms(name), fields(name), crops(name)').eq('user_id', App.currentUser.id).limit(200)
        ]);
        this.farms = farmsRes.data || [];
        this.cycles = (cyclesRes.data || []).map(c => ({ ...c, label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}` }));
        const populate = (id, items, vk, lk, ph) => { const s = document.getElementById(id); if (!s) return; s.innerHTML = `<option value="">${ph}</option>`; items.forEach(i => { s.innerHTML += `<option value="${i[vk]}">${Utils.escapeHtml(i[lk])}</option>`; }); };
        populate('fert-farm', this.farms, 'id', 'name', 'Select Farm');
        populate('fert-cycle', this.cycles, 'id', 'label', 'Select Crop Cycle');
        populate('filter-fert-farm', this.farms, 'id', 'name', 'All Farms');
        populate('filter-fert-type', this.types.map(t => ({ id: t, name: t })), 'id', 'name', 'All Types');
        populate('fert-type', this.types.map(t => ({ id: t, name: t })), 'id', 'name', 'Select Type');
        populate('fert-method', this.methods.map(m => ({ id: m, name: m })), 'id', 'name', 'Select Method');
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const s = document.getElementById('fert-field'); if (!s) return;
        s.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { s.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; });
    },

    async load() {
        Utils.showLoading('fert-table-container');
        let query = db.from('fertilizer_applications').select('*, farms(name), fields(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterType) query = query.eq('fertilizer_type', this.filterType);
        if (this.searchQuery) query = query.or(`fertilizer_name.ilike.%${this.searchQuery}%,supplier.ilike.%${this.searchQuery}%`);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('fert-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const c = document.getElementById('fert-table-container'); if (!c) return;
        if (this.data.length === 0) { c.innerHTML = Utils.emptyState('fa-flask', 'No Fertilizer Records', 'Track fertilizer applications for your crops.', 'Add Application', "Utils.openModal('fert-modal')"); return; }
        let html = `<div class="table-responsive"><table class="data-table"><thead><tr>
            <th class="sortable" data-sort="application_date">Date <i class="fas fa-sort"></i></th>
            <th>Fertilizer</th><th>Type</th><th>Farm / Field</th><th>Quantity</th><th>Method</th><th>Cost</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.data.forEach(r => {
            html += `<tr>
                <td>${Utils.formatDate(r.application_date)}</td>
                <td><strong>${Utils.escapeHtml(r.fertilizer_name)}</strong></td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(r.fertilizer_type)}</span></td>
                <td>${Utils.escapeHtml(r.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(r.fields?.name || '')}</span></td>
                <td>${r.quantity ? Utils.formatNumber(r.quantity) + ' ' + Utils.escapeHtml(r.unit || 'kg') : '—'}</td>
                <td>${Utils.escapeHtml(r.application_method || '—')}</td>
                <td>${r.cost ? Utils.formatCurrency(r.cost) : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Fertilizers.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Fertilizers.edit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Fertilizers.confirmDelete('${r.id}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>'; c.innerHTML = html;
        Utils.renderPagination('fert-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        c.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        document.getElementById('fert-search')?.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        document.getElementById('filter-fert-farm')?.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-fert-type')?.addEventListener('change', e => { this.filterType = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('fert-farm')?.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('fert-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault(); if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn, true);
            const fd = {
                user_id: App.currentUser.id, farm_id: form.fert_farm.value || null, field_id: form.fert_field.value || null,
                crop_cycle_id: form.fert_cycle.value || null, application_date: form.fert_date.value,
                fertilizer_name: form.fert_name.value.trim(), fertilizer_type: form.fert_type.value,
                quantity: parseFloat(form.fert_qty.value) || null, unit: form.fert_unit.value,
                application_method: form.fert_method.value, cost: parseFloat(form.fert_cost.value) || 0,
                supplier: form.fert_supplier.value.trim(), applied_by: form.fert_applied_by.value.trim(), notes: form.fert_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('fertilizer_applications').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Updated'); }
                else { const { error } = await db.from('fertilizer_applications').insert(fd); if (error) throw error; Utils.toast('Added'); }
                Utils.closeModal('fert-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; }
        });
    },

    edit(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const form = document.getElementById('fert-form'); if (!form) return;
        if (r.farm_id) this.loadFields(r.farm_id);
        form.dataset.editId = id;
        form.fert_farm.value = r.farm_id || ''; form.fert_field.value = r.field_id || ''; form.fert_cycle.value = r.crop_cycle_id || '';
        form.fert_date.value = r.application_date || ''; form.fert_name.value = r.fertilizer_name || ''; form.fert_type.value = r.fertilizer_type || '';
        form.fert_qty.value = r.quantity || ''; form.fert_unit.value = r.unit || 'kg'; form.fert_method.value = r.application_method || '';
        form.fert_cost.value = r.cost || 0; form.fert_supplier.value = r.supplier || ''; form.fert_applied_by.value = r.applied_by || '';
        form.fert_notes.value = r.notes || '';
        document.querySelector('#fert-modal .modal-title').textContent = 'Edit Fertilizer Application';
        Utils.openModal('fert-modal');
    },

    view(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        document.getElementById('fert-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(r.application_date)}</p></div>
                <div class="view-item"><label>Fertilizer</label><p>${Utils.escapeHtml(r.fertilizer_name)}</p></div>
                <div class="view-item"><label>Type</label><p>${Utils.escapeHtml(r.fertilizer_type)}</p></div>
                <div class="view-item"><label>Method</label><p>${Utils.escapeHtml(r.application_method || '—')}</p></div>
                <div class="view-item"><label>Quantity</label><p>${r.quantity ? Utils.formatNumber(r.quantity) + ' ' + Utils.escapeHtml(r.unit || 'kg') : '—'}</p></div>
                <div class="view-item"><label>Cost</label><p>${Utils.formatCurrency(r.cost)}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(r.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(r.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Supplier</label><p>${Utils.escapeHtml(r.supplier || '—')}</p></div>
                <div class="view-item"><label>Applied By</label><p>${Utils.escapeHtml(r.applied_by || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(r.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('fert-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this fertilizer record?', async () => {
            try { const { error } = await db.from('fertilizer_applications').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};