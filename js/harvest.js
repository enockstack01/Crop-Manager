// ============================================================
// HARVEST RECORDS MODULE
// ============================================================

const Harvest = {
    data: [], farms: [], fields: [], crops: [], cycles: [],
    qualities: ['Excellent', 'Good', 'Average', 'Poor', 'Rejected'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterCrop: '',
    sortBy: 'harvest_date', sortOrder: 'desc',

    async init() {
        await this.loadLookups(); await this.load(); this.bindEvents();
    },

    async loadLookups() {
        const [farmsRes, cropsRes, cyclesRes] = await Promise.all([
            db.from('farms').select('id, name').eq('user_id', App.currentUser.id).order('name'),
            db.from('crops').select('id, name').eq('user_id', App.currentUser.id).order('name'),
            db.from('crop_cycles').select('id, farms(name), fields(name), crops(name)').eq('user_id', App.currentUser.id).limit(200)
        ]);
        this.farms = farmsRes.data || [];
        this.crops = cropsRes.data || [];
        this.cycles = (cyclesRes.data || []).map(c => ({ ...c, label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}` }));
        const populate = (id, items, vk, lk, ph) => { const s = document.getElementById(id); if (!s) return; s.innerHTML = `<option value="">${ph}</option>`; items.forEach(i => { s.innerHTML += `<option value="${i[vk]}">${Utils.escapeHtml(i[lk])}</option>`; }); };
        populate('harvest-farm', this.farms, 'id', 'name', 'Select Farm');
        populate('harvest-crop', this.crops, 'id', 'name', 'Select Crop');
        populate('harvest-cycle', this.cycles, 'id', 'label', 'Select Crop Cycle');
        populate('filter-harvest-farm', this.farms, 'id', 'name', 'All Farms');
        populate('filter-harvest-crop', this.crops, 'id', 'name', 'All Crops');
        populate('harvest-quality', this.qualities.map(q => ({ id: q, name: q })), 'id', 'name', 'Select Quality');
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const s = document.getElementById('harvest-field'); if (!s) return;
        s.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { s.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; });
    },

    async load() {
        Utils.showLoading('harvest-table-container');
        let query = db.from('harvest_records').select('*, farms(name), fields(name), crops(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterCrop) query = query.eq('crop_id', this.filterCrop);
        if (this.searchQuery) query = query.or(`storage_location.ilike.%${this.searchQuery}%,grade.ilike.%${this.searchQuery}%`);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('harvest-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const c = document.getElementById('harvest-table-container'); if (!c) return;
        if (this.data.length === 0) { c.innerHTML = Utils.emptyState('fa-wheat-awn', 'No Harvest Records', 'Record harvest data to track your production output.', 'Add Harvest', "Utils.openModal('harvest-modal')"); return; }
        let html = `<div class="table-responsive"><table class="data-table"><thead><tr>
            <th class="sortable" data-sort="harvest_date">Date <i class="fas fa-sort"></i></th>
            <th>Crop</th><th>Farm / Field</th><th>Quantity</th><th>Area</th><th>Quality</th><th>Total Cost</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.data.forEach(r => {
            const totalCost = (r.labor_cost || 0) + (r.transport_cost || 0) + (r.other_costs || 0);
            html += `<tr>
                <td>${Utils.formatDate(r.harvest_date)}</td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(r.crops?.name || '—')}</span></td>
                <td>${Utils.escapeHtml(r.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(r.fields?.name || '')}</span></td>
                <td><strong>${Utils.formatNumber(r.quantity)}</strong> ${Utils.escapeHtml(r.unit || 'kg')}</td>
                <td>${r.harvested_area ? Utils.formatNumber(r.harvested_area) + ' ' + Utils.escapeHtml(r.area_unit || 'ha') : '—'}</td>
                <td>${Utils.escapeHtml(r.quality || '—')}</td>
                <td>${totalCost > 0 ? Utils.formatCurrency(totalCost) : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Harvest.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Harvest.edit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Harvest.confirmDelete('${r.id}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>'; c.innerHTML = html;
        Utils.renderPagination('harvest-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        c.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        document.getElementById('harvest-search')?.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        document.getElementById('filter-harvest-farm')?.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-harvest-crop')?.addEventListener('change', e => { this.filterCrop = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('harvest-farm')?.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('harvest-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault(); if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn, true);
            const fd = {
                user_id: App.currentUser.id, farm_id: form.harvest_farm.value || null, field_id: form.harvest_field.value || null,
                crop_id: form.harvest_crop.value, crop_cycle_id: form.harvest_cycle.value || null,
                harvest_date: form.harvest_date.value, harvested_area: parseFloat(form.harvest_area.value) || null,
                area_unit: form.harvest_area_unit.value, quantity: parseFloat(form.harvest_qty.value),
                unit: form.harvest_unit.value, grade: form.harvest_grade.value.trim(),
                quality: form.harvest_quality.value, storage_location: form.harvest_storage.value.trim(),
                labor_cost: parseFloat(form.harvest_labor.value) || 0, transport_cost: parseFloat(form.harvest_transport.value) || 0,
                other_costs: parseFloat(form.harvest_other.value) || 0, notes: form.harvest_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('harvest_records').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Updated'); }
                else { const { error } = await db.from('harvest_records').insert(fd); if (error) throw error; Utils.toast('Added'); }
                Utils.closeModal('harvest-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; }
        });
    },

    edit(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const form = document.getElementById('harvest-form'); if (!form) return;
        if (r.farm_id) this.loadFields(r.farm_id);
        form.dataset.editId = id;
        form.harvest_farm.value = r.farm_id || ''; form.harvest_field.value = r.field_id || '';
        form.harvest_crop.value = r.crop_id || ''; form.harvest_cycle.value = r.crop_cycle_id || '';
        form.harvest_date.value = r.harvest_date || ''; form.harvest_area.value = r.harvested_area || '';
        form.harvest_area_unit.value = r.area_unit || 'hectares'; form.harvest_qty.value = r.quantity || '';
        form.harvest_unit.value = r.unit || 'kg'; form.harvest_grade.value = r.grade || '';
        form.harvest_quality.value = r.quality || 'Good'; form.harvest_storage.value = r.storage_location || '';
        form.harvest_labor.value = r.labor_cost || 0; form.harvest_transport.value = r.transport_cost || 0;
        form.harvest_other.value = r.other_costs || 0; form.harvest_notes.value = r.notes || '';
        document.querySelector('#harvest-modal .modal-title').textContent = 'Edit Harvest Record';
        Utils.openModal('harvest-modal');
    },

    view(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const totalCost = (r.labor_cost || 0) + (r.transport_cost || 0) + (r.other_costs || 0);
        document.getElementById('harvest-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Harvest Date</label><p>${Utils.formatDate(r.harvest_date)}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(r.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(r.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(r.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Quantity</label><p><strong>${Utils.formatNumber(r.quantity)}</strong> ${Utils.escapeHtml(r.unit || 'kg')}</p></div>
                <div class="view-item"><label>Harvested Area</label><p>${r.harvested_area ? Utils.formatNumber(r.harvested_area) + ' ' + Utils.escapeHtml(r.area_unit || 'ha') : '—'}</p></div>
                <div class="view-item"><label>Grade</label><p>${Utils.escapeHtml(r.grade || '—')}</p></div>
                <div class="view-item"><label>Quality</label><p>${Utils.escapeHtml(r.quality || '—')}</p></div>
                <div class="view-item"><label>Storage</label><p>${Utils.escapeHtml(r.storage_location || '—')}</p></div>
                <div class="view-item"><label>Total Cost</label><p><strong>${Utils.formatCurrency(totalCost)}</strong></p></div>
                <div class="view-item"><label>Labor Cost</label><p>${Utils.formatCurrency(r.labor_cost)}</p></div>
                <div class="view-item"><label>Transport Cost</label><p>${Utils.formatCurrency(r.transport_cost)}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(r.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('harvest-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this harvest record?', async () => {
            try { const { error } = await db.from('harvest_records').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};