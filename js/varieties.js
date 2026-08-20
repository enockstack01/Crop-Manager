// ============================================================
// VARIETIES MODULE — Full CRUD
// ============================================================

const Varieties = {
    data: [],
    crops: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterCrop: '',
    sortBy: 'created_at',
    sortOrder: 'desc',

    async init() {
        await this.loadCrops();
        await this.load();
        this.bindEvents();
    },

    async loadCrops() {
        const { data } = await db
            .from('crops')
            .select('id, name')
            .eq('user_id', App.currentUser.id)
            .order('name');
        this.crops = data || [];
        this.populateCropSelects();
    },

    populateCropSelects() {
        ['variety-crop', 'filter-variety-crop'].forEach(selId => {
            const sel = document.getElementById(selId);
            if (!sel) return;
            sel.innerHTML = '<option value="">Select Crop</option>';
            this.crops.forEach(c => {
                sel.innerHTML += `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`;
            });
        });
    },

    async load() {
        Utils.showLoading('varieties-table-container');

        let query = db
            .from('crop_varieties')
            .select('*, crops(name)', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`name.ilike.%${this.searchQuery}%,description.ilike.%${this.searchQuery}%`);
        }
        if (this.filterCrop) {
            query = query.eq('crop_id', this.filterCrop);
        }

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;
        if (error) {
            console.error('Varieties load error:', error);
            Utils.hideLoading('varieties-table-container',
                Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load varieties.')
            );
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('varieties-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-seedling',
                'No Varieties Yet',
                'Add crop varieties to track different types within each crop.',
                'Add Variety',
                "Utils.openModal('variety-modal')"
            );
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Variety Name <i class="fas fa-sort"></i></th>
                            <th>Crop</th>
                            <th>Maturity Period</th>
                            <th>Seed Source</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(v => {
            html += `
                <tr>
                    <td><strong>${Utils.escapeHtml(v.name)}</strong></td>
                    <td><span class="badge badge-primary">${Utils.escapeHtml(v.crops?.name || '—')}</span></td>
                    <td>${v.maturity_period ? v.maturity_period + ' ' + (v.maturity_period_unit || 'days') : '—'}</td>
                    <td>${Utils.escapeHtml(v.seed_source || '—')}</td>
                    <td class="table-actions">
                        <button class="btn-icon" title="View" onclick="Varieties.view('${v.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" title="Edit" onclick="Varieties.edit('${v.id}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Varieties.confirmDelete('${v.id}','${Utils.escapeHtml(v.name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('varieties-pagination', this.currentPage, this.totalPages, (p) => {
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
        const searchInput = document.getElementById('varieties-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.load();
            }, 300));
        }

        const filterCrop = document.getElementById('filter-variety-crop');
        if (filterCrop) {
            filterCrop.addEventListener('change', (e) => {
                this.filterCrop = e.target.value;
                this.currentPage = 1;
                this.load();
            });
        }

        const form = document.getElementById('variety-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!Utils.validateForm(form)) return;

                const btn = form.querySelector('button[type="submit"]');
                Utils.setBtnLoading(btn, true);

                const formData = {
                    user_id: App.currentUser.id,
                    crop_id: form.variety_crop.value,
                    name: form.variety_name.value.trim(),
                    description: form.variety_description.value.trim(),
                    maturity_period: form.variety_maturity.value ? parseInt(form.variety_maturity.value) : null,
                    maturity_period_unit: form.variety_maturity_unit.value,
                    seed_source: form.variety_seed_source.value.trim(),
                    notes: form.variety_notes.value.trim()
                };

                try {
                    if (form.dataset.editId) {
                        const { error } = await db.from('crop_varieties').update(formData).eq('id', form.dataset.editId);
                        if (error) throw error;
                        Utils.toast('Variety updated successfully');
                    } else {
                        const { error } = await db.from('crop_varieties').insert(formData);
                        if (error) throw error;
                        Utils.toast('Variety added successfully');
                    }
                    Utils.closeModal('variety-modal');
                    this.load();
                } catch (err) {
                    console.error('Variety save error:', err);
                    Utils.toast(err.message || 'Failed to save variety', 'error');
                } finally {
                    Utils.setBtnLoading(btn, false);
                    delete form.dataset.editId;
                }
            });
        }
    },

    edit(id) {
        const v = this.data.find(x => x.id === id);
        if (!v) return;
        const form = document.getElementById('variety-form');
        if (!form) return;

        form.dataset.editId = id;
        form.variety_crop.value = v.crop_id || '';
        form.variety_name.value = v.name || '';
        form.variety_description.value = v.description || '';
        form.variety_maturity.value = v.maturity_period || '';
        form.variety_maturity_unit.value = v.maturity_period_unit || 'days';
        form.variety_seed_source.value = v.seed_source || '';
        form.variety_notes.value = v.notes || '';

        const modalTitle = document.querySelector('#variety-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Variety';
        Utils.openModal('variety-modal');
    },

    view(id) {
        const v = this.data.find(x => x.id === id);
        if (!v) return;
        const vc = document.getElementById('variety-view-content');
        if (!vc) return;

        vc.innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Variety Name</label><p>${Utils.escapeHtml(v.name)}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(v.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Maturity Period</label><p>${v.maturity_period ? v.maturity_period + ' ' + (v.maturity_period_unit || 'days') : '—'}</p></div>
                <div class="view-item"><label>Seed Source</label><p>${Utils.escapeHtml(v.seed_source || '—')}</p></div>
                <div class="view-item full-width"><label>Description</label><p>${Utils.escapeHtml(v.description || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(v.notes || '—')}</p></div>
            </div>
        `;
        Utils.openModal('variety-view-modal');
    },

    confirmDelete(id, name) {
        Utils.confirm(`Delete variety <strong>"${name}"</strong>?`, async () => {
            try {
                const { error } = await db.from('crop_varieties').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Variety deleted successfully');
                this.load();
            } catch (err) {
                Utils.toast(err.message || 'Failed to delete variety', 'error');
            }
        });
    }
};