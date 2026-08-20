// ============================================================
// FARMS MODULE — Full CRUD
// ============================================================

const Farms = {
    data: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    sortBy: 'created_at',
    sortOrder: 'desc',

    async init() {
        await this.load();
        this.bindEvents();
    },

    async load() {
        Utils.showLoading('farms-table-container');

        let query = db
            .from('farms')
            .select('*', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`name.ilike.%${this.searchQuery}%,code.ilike.%${this.searchQuery}%,location.ilike.%${this.searchQuery}%`);
        }

        const from = (this.currentPage - 1) * this.perPage;
        const to = from + this.perPage - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Farms load error:', error);
            Utils.hideLoading('farms-table-container',
                Utils.emptyState('fa-exclamation-triangle', 'Error Loading Farms', 'Could not load farm data. Please try again.')
            );
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);

        this.render();
    },

    render() {
        const container = document.getElementById('farms-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-tractor',
                'No Farms Yet',
                'Start by adding your first farm to begin managing crop production.',
                'Add Farm',
                "Utils.openModal('farm-modal')"
            );
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Farm Name <i class="fas fa-sort"></i></th>
                            <th class="sortable" data-sort="code">Code <i class="fas fa-sort"></i></th>
                            <th>Location</th>
                            <th class="sortable" data-sort="total_area">Area <i class="fas fa-sort"></i></th>
                            <th>Type</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(farm => {
            html += `
                <tr>
                    <td><strong>${Utils.escapeHtml(farm.name)}</strong></td>
                    <td><span class="badge badge-neutral">${Utils.escapeHtml(farm.code || '—')}</span></td>
                    <td>${Utils.escapeHtml(farm.location || '—')}</td>
                    <td>${Utils.formatNumber(farm.total_area)} ${Utils.escapeHtml(farm.area_unit || 'ha')}</td>
                    <td>${Utils.escapeHtml(farm.farm_type || 'Crop')}</td>
                    <td>${Utils.formatDate(farm.created_at)}</td>
                    <td class="table-actions">
                        <button class="btn-icon" title="View" onclick="Farms.view('${farm.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" title="Edit" onclick="Farms.edit('${farm.id}')">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Farms.confirmDelete('${farm.id}', '${Utils.escapeHtml(farm.name)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('farms-pagination', this.currentPage, this.totalPages, (page) => {
            this.currentPage = page;
            this.load();
        });

        // Bind sort
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
        // Search
        const searchInput = document.getElementById('farms-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.load();
            }, 300));
        }

        // Form submit
        const form = document.getElementById('farm-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!Utils.validateForm(form)) return;

                const btn = form.querySelector('button[type="submit"]');
                Utils.setBtnLoading(btn, true);

                const formData = {
                    user_id: App.currentUser.id,
                    name: form.farm_name.value.trim(),
                    code: form.farm_code.value.trim(),
                    description: form.farm_description.value.trim(),
                    location: form.farm_location.value.trim(),
                    district: form.farm_district.value.trim(),
                    province: form.farm_province.value.trim(),
                    country: form.farm_country.value.trim() || 'Zambia',
                    total_area: parseFloat(form.farm_area.value) || null,
                    area_unit: form.farm_area_unit.value,
                    farm_type: form.farm_type.value,
                    notes: form.farm_notes.value.trim()
                };

                try {
                    if (form.dataset.editId) {
                        // Update
                        const { error } = await db
                            .from('farms')
                            .update(formData)
                            .eq('id', form.dataset.editId);
                        if (error) throw error;
                        Utils.toast('Farm updated successfully');
                    } else {
                        // Insert
                        const { error } = await db.from('farms').insert(formData);
                        if (error) throw error;
                        Utils.toast('Farm added successfully');
                    }

                    Utils.closeModal('farm-modal');
                    this.load();
                } catch (err) {
                    console.error('Farm save error:', err);
                    Utils.toast(err.message || 'Failed to save farm', 'error');
                } finally {
                    Utils.setBtnLoading(btn, false);
                    delete form.dataset.editId;
                }
            });
        }
    },

    edit(id) {
        const farm = this.data.find(f => f.id === id);
        if (!farm) return;

        const form = document.getElementById('farm-form');
        if (!form) return;

        form.dataset.editId = id;
        form.farm_name.value = farm.name || '';
        form.farm_code.value = farm.code || '';
        form.farm_description.value = farm.description || '';
        form.farm_location.value = farm.location || '';
        form.farm_district.value = farm.district || '';
        form.farm_province.value = farm.province || '';
        form.farm_country.value = farm.country || 'Zambia';
        form.farm_area.value = farm.total_area || '';
        form.farm_area_unit.value = farm.area_unit || 'hectares';
        form.farm_type.value = farm.farm_type || 'Crop';
        form.farm_notes.value = farm.notes || '';

        // Update modal title
        const modalTitle = document.querySelector('#farm-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Farm';

        Utils.openModal('farm-modal');
    },

    view(id) {
        const farm = this.data.find(f => f.id === id);
        if (!farm) return;

        const viewContent = document.getElementById('farm-view-content');
        if (!viewContent) return;

        viewContent.innerHTML = `
            <div class="view-grid">
                <div class="view-item">
                    <label>Farm Name</label>
                    <p>${Utils.escapeHtml(farm.name)}</p>
                </div>
                <div class="view-item">
                    <label>Code</label>
                    <p>${Utils.escapeHtml(farm.code || '—')}</p>
                </div>
                <div class="view-item">
                    <label>Location</label>
                    <p>${Utils.escapeHtml(farm.location || '—')}</p>
                </div>
                <div class="view-item">
                    <label>District</label>
                    <p>${Utils.escapeHtml(farm.district || '—')}</p>
                </div>
                <div class="view-item">
                    <label>Province</label>
                    <p>${Utils.escapeHtml(farm.province || '—')}</p>
                </div>
                <div class="view-item">
                    <label>Country</label>
                    <p>${Utils.escapeHtml(farm.country || '—')}</p>
                </div>
                <div class="view-item">
                    <label>Total Area</label>
                    <p>${Utils.formatNumber(farm.total_area)} ${Utils.escapeHtml(farm.area_unit || 'ha')}</p>
                </div>
                <div class="view-item">
                    <label>Farm Type</label>
                    <p>${Utils.escapeHtml(farm.farm_type || '—')}</p>
                </div>
                <div class="view-item full-width">
                    <label>Description</label>
                    <p>${Utils.escapeHtml(farm.description || '—')}</p>
                </div>
                <div class="view-item full-width">
                    <label>Notes</label>
                    <p>${Utils.escapeHtml(farm.notes || '—')}</p>
                </div>
            </div>
        `;
        Utils.openModal('farm-view-modal');
    },

    confirmDelete(id, name) {
        Utils.confirm(`Are you sure you want to delete the farm <strong>"${name}"</strong>? This will also delete all associated fields. This action cannot be undone.`, async () => {
            try {
                const { error } = await db.from('farms').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Farm deleted successfully');
                this.load();
            } catch (err) {
                console.error('Farm delete error:', err);
                Utils.toast(err.message || 'Failed to delete farm', 'error');
            }
        });
    }
};