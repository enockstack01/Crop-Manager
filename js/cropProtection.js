// ============================================================
// CROP PROTECTION RECORDS MODULE
// ============================================================

const CropProtection = {
    data: [], farms: [], fields: [], cycles: [],
    problemTypes: ['Pest', 'Disease', 'Weed', 'Other'],
    severities: ['Low', 'Moderate', 'High', 'Critical'],
    methods: ['Spraying', 'Dusting', 'Seed Treatment', 'Soil Treatment', 'Biological Control', 'Other'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterType: '', filterSeverity: '',
    sortBy: 'protection_date', sortOrder: 'desc',

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
        populate('prot-farm', this.farms, 'id', 'name', 'Select Farm');
        populate('prot-cycle', this.cycles, 'id', 'label', 'Select Crop Cycle');
        populate('filter-prot-farm', this.farms, 'id', 'name', 'All Farms');
        populate('filter-prot-type', this.problemTypes.map(t => ({ id: t, name: t })), 'id', 'name', 'All Types');
        populate('filter-prot-severity', this.severities.map(s => ({ id: s, name: s })), 'id', 'name', 'All Severities');
        populate('prot-problem-type', this.problemTypes.map(t => ({ id: t, name: t })), 'id', 'name', 'Select Type');
        populate('prot-severity', this.severities.map(s => ({ id: s, name: s })), 'id', 'name', 'Select Severity');
        populate('prot-method', this.methods.map(m => ({ id: m, name: m })), 'id', 'name', 'Select Method');
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const s = document.getElementById('prot-field'); if (!s) return;
        s.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { s.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; });
    },

    async load() {
        Utils.showLoading('prot-table-container');
        let query = db.from('crop_protection_records').select('*, farms(name), fields(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterType) query = query.eq('problem_type', this.filterType);
        if (this.filterSeverity) query = query.eq('severity', this.filterSeverity);
        if (this.searchQuery) query = query.or(`problem_name.ilike.%${this.searchQuery}%,treatment.ilike.%${this.searchQuery}%,product_name.ilike.%${this.searchQuery}%`);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('prot-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const c = document.getElementById('prot-table-container'); if (!c) return;
        if (this.data.length === 0) { c.innerHTML = Utils.emptyState('fa-shield-alt', 'No Crop Protection Records', 'Record pest, disease, and weed management activities.', 'Add Record', "Utils.openModal('prot-modal')"); return; }
        let html = `<div class="table-responsive"><table class="data-table"><thead><tr>
            <th class="sortable" data-sort="protection_date">Date <i class="fas fa-sort"></i></th>
            <th>Type</th><th>Problem</th><th>Severity</th><th>Farm / Field</th><th>Treatment</th><th>Cost</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.data.forEach(r => {
            html += `<tr>
                <td>${Utils.formatDate(r.protection_date)}</td>
                <td><span class="badge badge-info">${Utils.escapeHtml(r.problem_type)}</span></td>
                <td><strong>${Utils.escapeHtml(r.problem_name)}</strong></td>
                <td>${Utils.statusBadge(r.severity)}</td>
                <td>${Utils.escapeHtml(r.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(r.fields?.name || '')}</span></td>
                <td>${Utils.escapeHtml(r.treatment || '—')}</td>
                <td>${r.cost ? Utils.formatCurrency(r.cost) : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="CropProtection.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="CropProtection.edit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="CropProtection.confirmDelete('${r.id}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>'; c.innerHTML = html;
        Utils.renderPagination('prot-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        c.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        document.getElementById('prot-search')?.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        document.getElementById('filter-prot-farm')?.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-prot-type')?.addEventListener('change', e => { this.filterType = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-prot-severity')?.addEventListener('change', e => { this.filterSeverity = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('prot-farm')?.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('prot-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault(); if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn, true);
            const fd = {
                user_id: App.currentUser.id, farm_id: form.prot_farm.value || null, field_id: form.prot_field.value || null,
                crop_cycle_id: form.prot_cycle.value || null, protection_date: form.prot_date.value,
                problem_type: form.prot_problem_type.value, problem_name: form.prot_problem_name.value.trim(),
                severity: form.prot_severity.value, treatment: form.prot_treatment.value.trim(),
                product_name: form.prot_product.value.trim(), quantity: parseFloat(form.prot_qty.value) || null,
                unit: form.prot_unit.value, application_method: form.prot_method.value,
                cost: parseFloat(form.prot_cost.value) || 0, applied_by: form.prot_applied_by.value.trim(), notes: form.prot_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('crop_protection_records').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Updated'); }
                else { const { error } = await db.from('crop_protection_records').insert(fd); if (error) throw error; Utils.toast('Added'); }
                Utils.closeModal('prot-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; }
        });
    },

    edit(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const form = document.getElementById('prot-form'); if (!form) return;
        if (r.farm_id) this.loadFields(r.farm_id);
        form.dataset.editId = id;
        form.prot_farm.value = r.farm_id || ''; form.prot_field.value = r.field_id || ''; form.prot_cycle.value = r.crop_cycle_id || '';
        form.prot_date.value = r.protection_date || ''; form.prot_problem_type.value = r.problem_type || '';
        form.prot_problem_name.value = r.problem_name || ''; form.prot_severity.value = r.severity || '';
        form.prot_treatment.value = r.treatment || ''; form.prot_product.value = r.product_name || '';
        form.prot_qty.value = r.quantity || ''; form.prot_unit.value = r.unit || 'litres';
        form.prot_method.value = r.application_method || ''; form.prot_cost.value = r.cost || 0;
        form.prot_applied_by.value = r.applied_by || ''; form.prot_notes.value = r.notes || '';
        document.querySelector('#prot-modal .modal-title').textContent = 'Edit Crop Protection Record';
        Utils.openModal('prot-modal');
    },

    view(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        document.getElementById('prot-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(r.protection_date)}</p></div>
                <div class="view-item"><label>Problem Type</label><p>${Utils.escapeHtml(r.problem_type)}</p></div>
                <div class="view-item"><label>Problem</label><p>${Utils.escapeHtml(r.problem_name)}</p></div>
                <div class="view-item"><label>Severity</label><p>${Utils.statusBadge(r.severity)}</p></div>
                <div class="view-item"><label>Treatment</label><p>${Utils.escapeHtml(r.treatment || '—')}</p></div>
                <div class="view-item"><label>Product</label><p>${Utils.escapeHtml(r.product_name || '—')}</p></div>
                <div class="view-item"><label>Quantity</label><p>${r.quantity ? Utils.formatNumber(r.quantity) + ' ' + Utils.escapeHtml(r.unit || 'L') : '—'}</p></div>
                <div class="view-item"><label>Cost</label><p>${Utils.formatCurrency(r.cost)}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(r.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(r.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Applied By</label><p>${Utils.escapeHtml(r.applied_by || '—')}</p></div>
                <div class="view-item"><label>Method</label><p>${Utils.escapeHtml(r.application_method || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(r.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('prot-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this crop protection record?', async () => {
            try { const { error } = await db.from('crop_protection_records').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};