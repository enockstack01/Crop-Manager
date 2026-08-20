// ============================================================
// FIELDS MODULE — Full CRUD
// ============================================================

const Fields = {
    data: [],
    farms: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterFarm: '',
    filterStatus: '',
    sortBy: 'created_at',
    sortOrder: 'desc',

    async init() {
        await this.loadFarms();
        await this.load();
        this.bindEvents();
    },

    async loadFarms() {
        const { data } = await db
            .from('farms')
            .select('id, name')
            .eq('user_id', App.currentUser.id)
            .order('name');
        this.farms = data || [];
        this.populateFarmSelects();
    },

    populateFarmSelects() {
        const selects = ['field-farm', 'filter-field-farm'];
        selects.forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            sel.innerHTML = '<option value="">Select Farm</option>';
            this.farms.forEach(f => {
                sel.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`;
            });
        });
    },

    async load() {
        Utils.showLoading('fields-table-container');

        let query = db
            .from('fields')
            .select('*, farms(name)', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`name.ilike.%${this.searchQuery}%,code.ilike.%${this.searchQuery}%,soil_type.ilike.%${this.searchQuery}%`);
        }
        if (this.filterFarm) {
            query = query.eq('farm_id', this.filterFarm);
        }
        if (this.filterStatus) {
            query = query.eq('status', this.filterStatus);
        }

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Fields load error:', error);
            Utils.hideLoading('fields-table-container',
                Utils.emptyState('fa-exclamation-triangle', 'Error Loading Fields', 'Could not load field data.')
            );
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('fields-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-map',
                'No Fields Yet',
                'Add your first field to start tracking crop production areas.',
                'Add Field',
                "Utils.openModal('field-modal')"
            );
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Field Name <i class="fas fa-sort"></i></th>
                            <th>Farm</th>
                            <th>Code</th>
                            <th class="sortable" data-sort="area">Area <i class="fas fa-sort"></i></th>
                            <th>Soil Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(field => {
            const farmName = field.farms?.name || '—';
            html += `
                <tr>
                    <td><strong>${Utils.escapeHtml(field.name)}</strong></td>
                    <td>${Utils.escapeHtml(farmName)}</td>
                    <td><span class="badge badge-neutral">${Utils.escapeHtml(field.code || '—')}</span></td>
                    <td>${Utils.formatNumber(field.area)} ${Utils.escapeHtml(field.area_unit || 'ha')}</td>
                    <td>${Utils.escapeHtml(field.soil_type || '—')}</td>
                    <td>${Utils.statusBadge(field.status)}</td>
                    <td class="table-actions">
                        <button class="btn-icon" title="View" onclick="Fields.view('${field.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" title="Edit" onclick="Fields.edit('${field.id}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Fields.confirmDelete('${field.id}','${Utils.escapeHtml(field.name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('fields-pagination', this.currentPage, this.totalPages, (p) => {
            this.currentPage = p;
            this.load();
        });

        container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this.sortBy === col) {
                    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortBy = col;
                    this.sortOrder = 'asc';
                }
                this.currentPage = 1;
                this.load();
            });
        });
    },

    bindEvents() {
        const searchInput = document.getElementById('fields-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.load();
            }, 300));
        }

        const filterFarm = document.getElementById('filter-field-farm');
        if (filterFarm) {
            filterFarm.addEventListener('change', (e) => {
                this.filterFarm = e.target.value;
                this.currentPage = 1;
                this.load();
            });
        }

        const filterStatus = document.getElementById('filter-field-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.load();
            });
        }

        const form = document.getElementById('field-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!Utils.validateForm(form)) return;

                const btn = form.querySelector('button[type="submit"]');
                Utils.setBtnLoading(btn, true);

                const formData = {
                    user_id: App.currentUser.id,
                    farm_id: form.field_farm.value,
                    name: form.field_name.value.trim(),
                    code: form.field_code.value.trim(),
                    area: parseFloat(form.field_area.value) || null,
                    area_unit: form.field_area_unit.value,
                    location: form.field_location.value.trim(),
                    latitude: form.field_latitude.value ? parseFloat(form.field_latitude.value) : null,
                    longitude: form.field_longitude.value ? parseFloat(form.field_longitude.value) : null,
                    soil_type: form.field_soil_type.value.trim(),
                    soil_ph: form.field_soil_ph.value ? parseFloat(form.field_soil_ph.value) : null,
                    status: form.field_status.value,
                    notes: form.field_notes.value.trim()
                };

                try {
                    if (form.dataset.editId) {
                        const { error } = await db.from('fields').update(formData).eq('id', form.dataset.editId);
                        if (error) throw error;
                        Utils.toast('Field updated successfully');
                    } else {
                        const { error } = await db.from('fields').insert(formData);
                        if (error) throw error;
                        Utils.toast('Field added successfully');
                    }
                    Utils.closeModal('field-modal');
                    this.load();
                } catch (err) {
                    console.error('Field save error:', err);
                    Utils.toast(err.message || 'Failed to save field', 'error');
                } finally {
                    Utils.setBtnLoading(btn, false);
                    delete form.dataset.editId;
                }
            });
        }
    },

    edit(id) {
        const field = this.data.find(f => f.id === id);
        if (!field) return;
        const form = document.getElementById('field-form');
        if (!form) return;

        form.dataset.editId = id;
        form.field_farm.value = field.farm_id || '';
        form.field_name.value = field.name || '';
        form.field_code.value = field.code || '';
        form.field_area.value = field.area || '';
        form.field_area_unit.value = field.area_unit || 'hectares';
        form.field_location.value = field.location || '';
        form.field_latitude.value = field.latitude || '';
        form.field_longitude.value = field.longitude || '';
        form.field_soil_type.value = field.soil_type || '';
        form.field_soil_ph.value = field.soil_ph || '';
        form.field_status.value = field.status || 'Active';
        form.field_notes.value = field.notes || '';

        const modalTitle = document.querySelector('#field-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Field';
        Utils.openModal('field-modal');
    },

    view(id) {
        const field = this.data.find(f => f.id === id);
        if (!field) return;
        const vc = document.getElementById('field-view-content');
        if (!vc) return;

        vc.innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Field Name</label><p>${Utils.escapeHtml(field.name)}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(field.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Code</label><p>${Utils.escapeHtml(field.code || '—')}</p></div>
                <div class="view-item"><label>Area</label><p>${Utils.formatNumber(field.area)} ${Utils.escapeHtml(field.area_unit || 'ha')}</p></div>
                <div class="view-item"><label>Location</label><p>${Utils.escapeHtml(field.location || '—')}</p></div>
                <div class="view-item"><label>Soil Type</label><p>${Utils.escapeHtml(field.soil_type || '—')}</p></div>
                <div class="view-item"><label>Soil pH</label><p>${field.soil_ph || '—'}</p></div>
                <div class="view-item"><label>Status</label><p>${Utils.statusBadge(field.status)}</p></div>
                <div class="view-item"><label>Latitude</label><p>${field.latitude || '—'}</p></div>
                <div class="view-item"><label>Longitude</label><p>${field.longitude || '—'}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(field.notes || '—')}</p></div>
            </div>
        `;
        Utils.openModal('field-view-modal');
    },

    confirmDelete(id, name) {
        Utils.confirm(`Delete field <strong>"${name}"</strong>? This action cannot be undone.`, async () => {
            try {
                const { error } = await db.from('fields').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Field deleted successfully');
                this.load();
            } catch (err) {
                Utils.toast(err.message || 'Failed to delete field', 'error');
            }
        });
    }
};