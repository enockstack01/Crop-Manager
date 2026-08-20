// ============================================================
// CROP CYCLES MODULE — Full CRUD
// ============================================================

const CropCycles = {
    data: [],
    farms: [],
    fields: [],
    crops: [],
    varieties: [],
    seasons: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterFarm: '',
    filterCrop: '',
    filterSeason: '',
    filterStatus: '',
    sortBy: 'created_at',
    sortOrder: 'desc',

    async init() {
        await Promise.all([
            this.loadFarms(),
            this.loadCrops(),
            this.loadSeasons()
        ]);
        await this.load();
        this.bindEvents();
    },

    async loadFarms() {
        const { data } = await db.from('farms').select('id, name').eq('user_id', App.currentUser.id).order('name');
        this.farms = data || [];
    },

    async loadCrops() {
        const { data } = await db.from('crops').select('id, name').eq('user_id', App.currentUser.id).order('name');
        this.crops = data || [];
    },

    async loadSeasons() {
        const { data } = await db.from('seasons').select('id, name').eq('user_id', App.currentUser.id).order('name');
        this.seasons = data || [];
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
    },

    async loadVarieties(cropId) {
        if (!cropId) { this.varieties = []; return; }
        const { data } = await db.from('crop_varieties').select('id, name').eq('user_id', App.currentUser.id).eq('crop_id', cropId).order('name');
        this.varieties = data || [];
    },

    populateSelect(selectId, items, valueKey, labelKey, placeholder) {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        sel.innerHTML = `<option value="">${placeholder || 'Select...'}</option>`;
        items.forEach(item => {
            sel.innerHTML += `<option value="${item[valueKey]}">${Utils.escapeHtml(item[labelKey])}</option>`;
        });
    },

    async load() {
        Utils.showLoading('cycles-table-container');

        let query = db
            .from('crop_cycles')
            .select('*, farms(name), fields(name), crops(name), crop_varieties(name), seasons(name)', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`farms.name.ilike.%${this.searchQuery}%,fields.name.ilike.%${this.searchQuery}%,crops.name.ilike.%${this.searchQuery}%,crop_varieties.name.ilike.%${this.searchQuery}%`);
        }
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterCrop) query = query.eq('crop_id', this.filterCrop);
        if (this.filterSeason) query = query.eq('season_id', this.filterSeason);
        if (this.filterStatus) query = query.eq('status', this.filterStatus);

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;
        if (error) {
            console.error('Crop cycles load error:', error);
            Utils.hideLoading('cycles-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load crop cycles.'));
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('cycles-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-sync-alt', 'No Crop Cycles Yet',
                'Create your first crop cycle to start tracking production from planting to harvest.',
                'Add Crop Cycle', "Utils.openModal('cycle-modal')"
            );
            return;
        }

        let html = `<div class="table-responsive"><table class="data-table">
            <thead><tr>
                <th class="sortable" data-sort="created_at">Farm / Field <i class="fas fa-sort"></i></th>
                <th>Crop</th>
                <th>Variety</th>
                <th>Season</th>
                <th>Planted</th>
                <th>Area</th>
                <th>Status</th>
                <th>Actions</th>
            </tr></thead><tbody>`;

        this.data.forEach(c => {
            html += `<tr>
                <td><strong>${Utils.escapeHtml(c.farms?.name || '—')}</strong><br><span class="text-xs text-light">${Utils.escapeHtml(c.fields?.name || '')}</span></td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(c.crops?.name || '—')}</span></td>
                <td>${Utils.escapeHtml(c.crop_varieties?.name || '—')}</td>
                <td>${Utils.escapeHtml(c.seasons?.name || '—')}</td>
                <td>${Utils.formatDate(c.planting_date)}</td>
                <td>${c.area_planted ? Utils.formatNumber(c.area_planted) + ' ' + Utils.escapeHtml(c.area_unit || 'ha') : '—'}</td>
                <td>${Utils.statusBadge(c.status)}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="CropCycles.view('${c.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="CropCycles.edit('${c.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="CropCycles.confirmDelete('${c.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('cycles-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });

        container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                this.sortBy = col;
                this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc';
                this.currentPage = 1;
                this.load();
            });
        });
    },

    bindEvents() {
        const searchInput = document.getElementById('cycles-search');
        if (searchInput) searchInput.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));

        ['filter-cycle-farm', 'filter-cycle-crop', 'filter-cycle-season', 'filter-cycle-status'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', e => {
                if (id === 'filter-cycle-farm') this.filterFarm = e.target.value;
                if (id === 'filter-cycle-crop') this.filterCrop = e.target.value;
                if (id === 'filter-cycle-season') this.filterSeason = e.target.value;
                if (id === 'filter-cycle-status') this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.load();
            });
        });

        // Farm → Fields cascade
        const farmSel = document.getElementById('cycle-farm');
        if (farmSel) farmSel.addEventListener('change', async e => {
            await this.loadFields(e.target.value);
            this.populateSelect('cycle-field', this.fields, 'id', 'name', 'Select Field');
        });

        // Crop → Varieties cascade
        const cropSel = document.getElementById('cycle-crop');
        if (cropSel) cropSel.addEventListener('change', async e => {
            await this.loadVarieties(e.target.value);
            this.populateSelect('cycle-variety', this.varieties, 'id', 'name', 'No Variety');
        });

        // Form submit
        const form = document.getElementById('cycle-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault();
            if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]');
            Utils.setBtnLoading(btn, true);

            const fd = {
                user_id: App.currentUser.id,
                farm_id: form.cycle_farm.value,
                field_id: form.cycle_field.value,
                crop_id: form.cycle_crop.value,
                variety_id: form.cycle_variety.value || null,
                season_id: form.cycle_season.value || null,
                planting_date: form.cycle_planting_date.value || null,
                expected_harvest_date: form.cycle_expected_harvest.value || null,
                actual_harvest_date: form.cycle_actual_harvest.value || null,
                area_planted: parseFloat(form.cycle_area.value) || null,
                area_unit: form.cycle_area_unit.value,
                seed_quantity: parseFloat(form.cycle_seed_qty.value) || null,
                seed_unit: form.cycle_seed_unit.value,
                expected_production: parseFloat(form.cycle_expected_prod.value) || null,
                expected_production_unit: form.cycle_expected_prod_unit.value,
                actual_production: parseFloat(form.cycle_actual_prod.value) || null,
                actual_production_unit: form.cycle_actual_prod_unit.value,
                status: form.cycle_status.value,
                notes: form.cycle_notes.value.trim()
            };

            try {
                if (form.dataset.editId) {
                    const { error } = await db.from('crop_cycles').update(fd).eq('id', form.dataset.editId);
                    if (error) throw error;
                    Utils.toast('Crop cycle updated successfully');
                } else {
                    const { error } = await db.from('crop_cycles').insert(fd);
                    if (error) throw error;
                    Utils.toast('Crop cycle created successfully');
                }
                Utils.closeModal('cycle-modal');
                this.load();
            } catch (err) {
                console.error('Crop cycle save error:', err);
                Utils.toast(err.message || 'Failed to save crop cycle', 'error');
            } finally {
                Utils.setBtnLoading(btn, false);
                delete form.dataset.editId;
            }
        });
    },

    async edit(id) {
        const c = this.data.find(x => x.id === id);
        if (!c) return;
        const form = document.getElementById('cycle-form');
        if (!form) return;

        await this.loadFields(c.farm_id);
        await this.loadVarieties(c.crop_id);

        this.populateSelect('cycle-farm', this.farms, 'id', 'name', 'Select Farm');
        this.populateSelect('cycle-field', this.fields, 'id', 'name', 'Select Field');
        this.populateSelect('cycle-crop', this.crops, 'id', 'name', 'Select Crop');
        this.populateSelect('cycle-variety', this.varieties, 'id', 'name', 'No Variety');
        this.populateSelect('cycle-season', this.seasons, 'id', 'name', 'Select Season');

        form.dataset.editId = id;
        form.cycle_farm.value = c.farm_id || '';
        form.cycle_field.value = c.field_id || '';
        form.cycle_crop.value = c.crop_id || '';
        form.cycle_variety.value = c.variety_id || '';
        form.cycle_season.value = c.season_id || '';
        form.cycle_planting_date.value = c.planting_date || '';
        form.cycle_expected_harvest.value = c.expected_harvest_date || '';
        form.cycle_actual_harvest.value = c.actual_harvest_date || '';
        form.cycle_area.value = c.area_planted || '';
        form.cycle_area_unit.value = c.area_unit || 'hectares';
        form.cycle_seed_qty.value = c.seed_quantity || '';
        form.cycle_seed_unit.value = c.seed_unit || 'kg';
        form.cycle_expected_prod.value = c.expected_production || '';
        form.cycle_expected_prod_unit.value = c.expected_production_unit || 'kg';
        form.cycle_actual_prod.value = c.actual_production || '';
        form.cycle_actual_prod_unit.value = c.actual_production_unit || 'kg';
        form.cycle_status.value = c.status || 'Planned';
        form.cycle_notes.value = c.notes || '';

        document.querySelector('#cycle-modal .modal-title').textContent = 'Edit Crop Cycle';
        Utils.openModal('cycle-modal');
    },

    view(id) {
        const c = this.data.find(x => x.id === id);
        if (!c) return;
        const vc = document.getElementById('cycle-view-content');
        if (!vc) return;
        vc.innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(c.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(c.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(c.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Variety</label><p>${Utils.escapeHtml(c.crop_varieties?.name || '—')}</p></div>
                <div class="view-item"><label>Season</label><p>${Utils.escapeHtml(c.seasons?.name || '—')}</p></div>
                <div class="view-item"><label>Status</label><p>${Utils.statusBadge(c.status)}</p></div>
                <div class="view-item"><label>Planting Date</label><p>${Utils.formatDate(c.planting_date)}</p></div>
                <div class="view-item"><label>Expected Harvest</label><p>${Utils.formatDate(c.expected_harvest_date)}</p></div>
                <div class="view-item"><label>Actual Harvest</label><p>${Utils.formatDate(c.actual_harvest_date)}</p></div>
                <div class="view-item"><label>Area Planted</label><p>${c.area_planted ? Utils.formatNumber(c.area_planted) + ' ' + Utils.escapeHtml(c.area_unit || 'ha') : '—'}</p></div>
                <div class="view-item"><label>Seed Quantity</label><p>${c.seed_quantity ? Utils.formatNumber(c.seed_quantity) + ' ' + Utils.escapeHtml(c.seed_unit || 'kg') : '—'}</p></div>
                <div class="view-item"><label>Expected Production</label><p>${c.expected_production ? Utils.formatNumber(c.expected_production) + ' ' + Utils.escapeHtml(c.expected_production_unit || 'kg') : '—'}</p></div>
                <div class="view-item"><label>Actual Production</label><p>${c.actual_production ? Utils.formatNumber(c.actual_production) + ' ' + Utils.escapeHtml(c.actual_production_unit || 'kg') : '—'}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(c.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('cycle-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this crop cycle? All associated planting, activities, irrigation, fertilizer, protection, scouting, and harvest records will also be deleted.', async () => {
            try {
                const { error } = await db.from('crop_cycles').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Crop cycle deleted successfully');
                this.load();
            } catch (err) {
                Utils.toast(err.message || 'Failed to delete', 'error');
            }
        });
    }
};