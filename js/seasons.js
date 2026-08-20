// ============================================================
// SEASONS MODULE — Full CRUD
// ============================================================

const Seasons = {
    data: [],
    currentPage: 1,
    perPage: 10,
    searchQuery: '',
    filterStatus: '',
    sortBy: 'created_at',
    sortOrder: 'desc',

    async init() {
        await this.load();
        this.bindEvents();
    },

    async load() {
        Utils.showLoading('seasons-table-container');

        let query = db
            .from('seasons')
            .select('*', { count: 'exact' })
            .eq('user_id', App.currentUser.id)
            .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

        if (this.searchQuery) {
            query = query.or(`name.ilike.%${this.searchQuery}%,description.ilike.%${this.searchQuery}%`);
        }
        if (this.filterStatus) {
            query = query.eq('status', this.filterStatus);
        }

        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);

        const { data, error, count } = await query;
        if (error) {
            console.error('Seasons load error:', error);
            Utils.hideLoading('seasons-table-container',
                Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load seasons.')
            );
            return;
        }

        this.data = data || [];
        this.totalCount = count || 0;
        this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const container = document.getElementById('seasons-table-container');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = Utils.emptyState(
                'fa-calendar-alt',
                'No Seasons Yet',
                'Define your growing seasons to organize crop production by period.',
                'Add Season',
                "Utils.openModal('season-modal')"
            );
            return;
        }

        let html = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="name">Season <i class="fas fa-sort"></i></th>
                            <th>Start Date</th>
                            <th>End Date</th>
                            <th>Status</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.forEach(s => {
            html += `
                <tr>
                    <td><strong>${Utils.escapeHtml(s.name)}</strong></td>
                    <td>${Utils.formatDate(s.start_date)}</td>
                    <td>${Utils.formatDate(s.end_date)}</td>
                    <td>${Utils.statusBadge(s.status)}</td>
                    <td class="text-truncate" style="max-width:200px;">${Utils.escapeHtml(s.description || '—')}</td>
                    <td class="table-actions">
                        <button class="btn-icon" title="View" onclick="Seasons.view('${s.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-icon" title="Edit" onclick="Seasons.edit('${s.id}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Seasons.confirmDelete('${s.id}','${Utils.escapeHtml(s.name)}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        Utils.renderPagination('seasons-pagination', this.currentPage, this.totalPages, (p) => {
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
        const searchInput = document.getElementById('seasons-search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.load();
            }, 300));
        }

        const filterStatus = document.getElementById('filter-season-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.load();
            });
        }

        const form = document.getElementById('season-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!Utils.validateForm(form)) return;

                const btn = form.querySelector('button[type="submit"]');
                Utils.setBtnLoading(btn, true);

                const formData = {
                    user_id: App.currentUser.id,
                    name: form.season_name.value.trim(),
                    start_date: form.season_start.value || null,
                    end_date: form.season_end.value || null,
                    description: form.season_description.value.trim(),
                    status: form.season_status.value,
                    notes: form.season_notes.value.trim()
                };

                try {
                    if (form.dataset.editId) {
                        const { error } = await db.from('seasons').update(formData).eq('id', form.dataset.editId);
                        if (error) throw error;
                        Utils.toast('Season updated successfully');
                    } else {
                        const { error } = await db.from('seasons').insert(formData);
                        if (error) throw error;
                        Utils.toast('Season added successfully');
                    }
                    Utils.closeModal('season-modal');
                    this.load();
                } catch (err) {
                    console.error('Season save error:', err);
                    Utils.toast(err.message || 'Failed to save season', 'error');
                } finally {
                    Utils.setBtnLoading(btn, false);
                    delete form.dataset.editId;
                }
            });
        }
    },

    edit(id) {
        const s = this.data.find(x => x.id === id);
        if (!s) return;
        const form = document.getElementById('season-form');
        if (!form) return;

        form.dataset.editId = id;
        form.season_name.value = s.name || '';
        form.season_start.value = s.start_date || '';
        form.season_end.value = s.end_date || '';
        form.season_description.value = s.description || '';
        form.season_status.value = s.status || 'Active';
        form.season_notes.value = s.notes || '';

        const modalTitle = document.querySelector('#season-modal .modal-title');
        if (modalTitle) modalTitle.textContent = 'Edit Season';
        Utils.openModal('season-modal');
    },

    view(id) {
        const s = this.data.find(x => x.id === id);
        if (!s) return;
        const vc = document.getElementById('season-view-content');
        if (!vc) return;

        vc.innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Season Name</label><p>${Utils.escapeHtml(s.name)}</p></div>
                <div class="view-item"><label>Status</label><p>${Utils.statusBadge(s.status)}</p></div>
                <div class="view-item"><label>Start Date</label><p>${Utils.formatDate(s.start_date)}</p></div>
                <div class="view-item"><label>End Date</label><p>${Utils.formatDate(s.end_date)}</p></div>
                <div class="view-item full-width"><label>Description</label><p>${Utils.escapeHtml(s.description || '—')}</p></div>
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(s.notes || '—')}</p></div>
            </div>
        `;
        Utils.openModal('season-view-modal');
    },

    confirmDelete(id, name) {
        Utils.confirm(`Delete season <strong>"${name}"</strong>?`, async () => {
            try {
                const { error } = await db.from('seasons').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Season deleted successfully');
                this.load();
            } catch (err) {
                Utils.toast(err.message || 'Failed to delete season', 'error');
            }
        });
    }
};