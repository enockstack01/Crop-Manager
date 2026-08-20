// ============================================================
// PLANTING RECORDS MODULE
// ============================================================

const Planting = {
    data: [],
    cycles: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterCycle: '',
    sortBy: 'planting_date',
    sortOrder: 'desc',

    async init() {
        await this.loadCycles();
        await this.load();
        this.bindEvents();
    },

    async loadCycles() {
        const { data } = await db
            .from('crop_cycles')
            .select('id, farms(name), fields(name), crops(name), seasons(name)')
            .eq('user_id', App.currentUser.id)
            .order('created_at', { ascending: false });
        this.cycles = (data || []).map(c => ({
            ...c,
            label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'} — ${c.seasons?.name || 'No Season'}`
        }));
        const sel = document.getElementById('planting-cycle');
        if (sel) {
            sel.innerHTML = '<option value="">Select Crop Cycle</option>';
            this.cycles.forEach(c => { sel.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.label)}</option>`; });
        }
        const fSel = document.getElementById('filter-planting-cycle');
        if (fSel) {
            fSel.innerHTML = '<option value="">All Cycles</option>';
            this.cycles.forEach(c => { fSel.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.label)}</option>`; });
        }
    },

    async load() {
        Utils.showLoading('planting-table-container');
        let query = db
            .from('planting_records')
            .select('*, crop_cycles(id, farms(name), fields(name), crops(name), seasons(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.filterCycle) query = query.eq('crop_cycle_id', this.filterCycle);
        if (this.searchQuery) query = query.or(`seed_source.ilike.%${this.searchQuery}%,planting_method.ilike.%${this.searchQuery}%`);

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;
        if (error) {
            console.error('Planting load error:', error);
            Utils.hideLoading('planting-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load planting records.'));
            return;
        }
        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('planting-table-container');
        if (!container) return;
        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState('fa-hand-holding-seedling', 'No Planting Records', 'Record planting details for your crop cycles.', 'Add Planting Record', "Utils.openModal('planting-modal')");
            return;
        }
        let html = `<div class="table-responsive"><table class="data-table">
            <thead><tr>
                <th class="sortable" data-sort="planting_date">Date <i class="fas fa-sort"></i></th>
                <th>Crop Cycle</th>
                <th>Seed Qty</th>
                <th>Seed Source</th>
                <th>Method</th>
                <th>Spacing</th>
                <th>Actions</th>
            </tr></thead><tbody>`;
        this.data.forEach(p => {
            const cc = p.crop_cycles;
            html += `<tr>
                <td>${Utils.formatDate(p.planting_date)}</td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(cc?.crops?.name || '—')}</span><br><span class="text-xs text-light">${Utils.escapeHtml(cc?.farms?.name || '')} / ${Utils.escapeHtml(cc?.fields?.name || '')}</span></td>
                <td>${p.seed_quantity ? Utils.formatNumber(p.seed_quantity) + ' ' + Utils.escapeHtml(p.seed_unit || 'kg') : '—'}</td>
                <td>${Utils.escapeHtml(p.seed_source || '—')}</td>
                <td>${Utils.escapeHtml(p.planting_method || '—')}</td>
                <td>${p.row_spacing && p.plant_spacing ? p.row_spacing + ' x ' + p.plant_spacing + ' ' + Utils.escapeHtml(p.spacing_unit || 'cm') : '—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Planting.view('${p.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Planting.edit('${p.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Planting.confirmDelete('${p.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
        Utils.renderPagination('planting-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load();
            });
        });
    },

    bindEvents() {
        const si = document.getElementById('planting-search');
        if (si) si.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        const fc = document.getElementById('filter-planting-cycle');
        if (fc) fc.addEventListener('change', e => { this.filterCycle = e.target.value; this.currentPage = 1; this.load(); });

        const form = document.getElementById('planting-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]');
            Utils.setBtnLoading(btn, true);
            const cycleId = form.planting_cycle.value;
            const cycle = this.cycles.find(c => c.id === cycleId);
            const fd = {
                user_id: App.currentUser.id,
                crop_cycle_id: cycleId,
                farm_id: cycle?.farm_id || null,
                field_id: cycle?.field_id || null,
                planting_date: form.planting_date.value,
                seed_quantity: parseFloat(form.planting_seed_qty.value) || null,
                seed_unit: form.planting_seed_unit.value,
                seed_source: form.planting_seed_source.value.trim(),
                seed_cost: parseFloat(form.planting_seed_cost.value) || null,
                row_spacing: parseFloat(form.planting_row_spacing.value) || null,
                plant_spacing: parseFloat(form.planting_plant_spacing.value) || null,
                spacing_unit: form.planting_spacing_unit.value,
                planting_method: form.planting_method.value.trim(),
                notes: form.planting_notes.value.trim()
            };
            try {
                if (form.dataset.editId) {
                    const { error } = await db.from('planting_records').update(fd).eq('id', form.dataset.editId);
                    if (error) throw error;
                    Utils.toast('Planting record updated');
                } else {
                    const { error } = await db.from('planting_records').insert(fd);
                    if (error) throw error;
                    Utils.toast('Planting record added');
                }
                Utils.closeModal('planting-modal');
                this.load();
            } catch (err) {
                console.error(err); Utils.toast(err.message || 'Failed to save', 'error');
            } finally {
                Utils.setBtnLoading(btn, false); delete form.dataset.editId;
            }
        });
    },

    edit(id) {
        const p = this.data.find(x => x.id === id);
        if (!p) return;
        const form = document.getElementById('planting-form');
        if (!form) return;
        form.dataset.editId = id;
        form.planting_cycle.value = p.crop_cycle_id || '';
        form.planting_date.value = p.planting_date || '';
        form.planting_seed_qty.value = p.seed_quantity || '';
        form.planting_seed_unit.value = p.seed_unit || 'kg';
        form.planting_seed_source.value = p.seed_source || '';
        form.planting_seed_cost.value = p.seed_cost || '';
        form.planting_row_spacing.value = p.row_spacing || '';
        form.planting_plant_spacing.value = p.plant_spacing || '';
        form.planting_spacing_unit.value = p.spacing_unit || 'cm';
        form.planting_method.value = p.planting_method || '';
        form.planting_notes.value = p.notes || '';
        document.querySelector('#planting-modal .modal-title').textContent = 'Edit Planting Record';
        Utils.openModal('planting-modal');
    },

    view(id) {
        const p = this.data.find(x => x.id === id);
        if (!p) return;
        const cc = p.crop_cycles;
        document.getElementById('planting-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(p.planting_date)}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(cc?.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(cc?.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(cc?.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Seed Quantity</label><p>${p.seed_quantity ? Utils.formatNumber(p.seed_quantity) + ' ' + Utils.escapeHtml(p.seed_unit || 'kg') : '—'}</p></div>
                <div class="view-item"><label>Seed Cost</label><p>${p.seed_cost ? Utils.formatCurrency(p.seed_cost) : '—'}</p></div>
                <div class="view-item"><label>Row Spacing</label><p>${p.row_spacing ? p.row_spacing + ' ' + Utils.escapeHtml(p.spacing_unit || 'cm') : '—'}</p></div>
                <div class="view-item"><label>Plant Spacing</label><p>${p.plant_spacing ? p.plant_spacing + ' ' + Utils.escapeHtml(p.spacing_unit || 'cm') : '—'}</p></div>
                <div class="view-item"><label>Seed Source</label><p>${Utils.escapeHtml(p.seed_source || '—')}</p></div>
                <div class="view-item"><label>Method</label><p>${Utils.escapeHtml(p.planting_method || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(p.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('planting-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this planting record?', async () => {
            try { const { error } = await db.from('planting_records').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};