// ============================================================
// CROPS MODULE — Full CRUD
// ============================================================

const Crops = {
    data: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',

    async init() {
        await this.load();
        this.bindEvents();
    },

    async load() {
        Utils.showLoading('crops-table-container');

        let query = db
            .from('crops')
            .select('*', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`name.ilike.%${this.searchQuery}%,category.ilike.%${this.searchQuery}%`);
        }

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;
        if (error) {
            console.error('Crops load error:', error);
            Utils.hideLoading('crops-table-container',
                Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load crops.')
            );
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('crops-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-leaf',
                'No Crops Yet',
                'Add your first crop to start building your crop database.',
                'Add Crop',
                "Utils.openModal('crop-modal')"
            );
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Crop Name <i class="fas fa-sort"></i></th>
                            <th>Category</th>
                            <th>Growing Period</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(crop => {
            html += `
                <tr>
                    <td><strong>${Utils.escapeHtml(crop.name)}</strong></td>
                    <td><span class="badge badge-primary">${Utils.escapeHtml(crop.category || '—')}</span></td>
                    <td>${crop.typical_growing_period ? crop.typical_growing_period + ' ' + (crop.growing_period_unit || 'days') : '—'}</td>
                    <td class="text-truncate" style="max-width:250px;">${Utils.escapeHtml(crop.description || '—')}</td>
                    <td class="table-actions">
                        <button class="btn-icon" title="View" onclick="Crops.view('${crop.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" title="Edit" onclick="Crops.edit('${crop.id}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Crops.confirmDelete('${crop.id}','${Utils.escapeHtml(crop.name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('crops-pagination', this.currentPage, this.totalPages, (p) => {
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
        const searchInput = document.getElementById('crops-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.load();
            }, 300));
        }

        const form = document.getElementById('crop-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!Utils.validateForm(form)) return;

                const btn = form.querySelector('button[type="submit"]');
                Utils.setBtnLoading(btn, true);

                const formData = {
                    user_id: App.currentUser.id,
                    name: form.crop_name.value.trim(),
                    category: form.crop_category.value.trim(),
                    description: form.crop_description.value.trim(),
                    typical_growing_period: form.crop_growing_period.value ? parseInt(form.crop_growing_period.value) : null,
                    growing_period_unit: form.crop_growing_period_unit.value,
                    notes: form.crop_notes.value.trim()
                };

                try {
                    if (form.dataset.editId) {
                        const { error } = await db.from('crops').update(formData).eq('id', form.dataset.editId);
                        if (error) throw error;
                        Utils.toast('Crop updated successfully');
                    } else {
                        const { error } = await db.from('crops').insert(formData);
                        if (error) throw error;
                        Utils.toast('Crop added successfully');
                    }
                    Utils.closeModal('crop-modal');
                    this.load();
                } catch (err) {
                    console.error('Crop save error:', err);
                    Utils.toast(err.message || 'Failed to save crop', 'error');
                } finally {
                    Utils.setBtnLoading(btn, false);
                    delete form.dataset.editId;
                }
            });
        }
    },

    edit(id) {
        const crop = this.data.find(c => c.id === id);
        if (!crop) return;
        const form = document.getElementById('crop-form');
        if (!form) return;

        form.dataset.editId = id;
        form.crop_name.value = crop.name || '';
        form.crop_category.value = crop.category || '';
        form.crop_description.value = crop.description || '';
        form.crop_growing_period.value = crop.typical_growing_period || '';
        form.crop_growing_period_unit.value = crop.growing_period_unit || 'days';
        form.crop_notes.value = crop.notes || '';

        const modalTitle = document.querySelector('#crop-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Crop';
        Utils.openModal('crop-modal');
    },

    view(id) {
        const crop = this.data.find(c => c.id === id);
        if (!crop) return;
        const vc = document.getElementById('crop-view-content');
        if (!vc) return;

        vc.innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Crop Name</label><p>${Utils.escapeHtml(crop.name)}</p></div>
                <div class="view-item"><label>Category</label><p>${Utils.escapeHtml(crop.category || '—')}</p></div>
                <div class="view-item"><label>Growing Period</label><p>${crop.typical_growing_period ? crop.typical_growing_period + ' ' + (crop.growing_period_unit || 'days') : '—'}</p></div>
                <div class="view-item full-width"><label>Description</label><p>${Utils.escapeHtml(crop.description || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(crop.notes || '—')}</p></div>
            </div>
        `;
        Utils.openModal('crop-view-modal');
    },

    confirmDelete(id, name) {
        Utils.confirm(`Delete crop <strong>"${name}"</strong>? All associated varieties will also be deleted.`, async () => {
            try {
                const { error } = await db.from('crops').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Crop deleted successfully');
                this.load();
            } catch (err) {
                Utils.toast(err.message || 'Failed to delete crop', 'error');
            }
        });
    }
};