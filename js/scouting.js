// ============================================================
// CROP SCOUTING MODULE — With Image Upload
// ============================================================

const Scouting = {
    data: [], farms: [], fields: [], crops: [], cycles: [],
    healthOptions: ['Healthy', 'Under Observation', 'At Risk'],
    currentPage: 1, perPage: 10, searchQuery: '', filterFarm: '', filterHealth: '',
    sortBy: 'scouting_date', sortOrder: 'desc',

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
        populate('scout-farm', this.farms, 'id', 'name', 'Select Farm');
        populate('scout-crop', this.crops, 'id', 'name', 'Select Crop');
        populate('scout-cycle', this.cycles, 'id', 'label', 'Select Crop Cycle');
        populate('filter-scout-farm', this.farms, 'id', 'name', 'All Farms');
        populate('filter-scout-health', this.healthOptions.map(h => ({ id: h, name: h })), 'id', 'name', 'All Health');
        populate('scout-health', this.healthOptions.map(h => ({ id: h, name: h })), 'id', 'name', 'Select Health');
    },

    async loadFields(farmId) {
        if (!farmId) { this.fields = []; return; }
        const { data } = await db.from('fields').select('id, name').eq('user_id', App.currentUser.id).eq('farm_id', farmId).order('name');
        this.fields = data || [];
        const s = document.getElementById('scout-field'); if (!s) return;
        s.innerHTML = '<option value="">Select Field</option>'; this.fields.forEach(f => { s.innerHTML += `<option value="${f.id}">${Utils.escapeHtml(f.name)}</option>`; });
    },

    async load() {
        Utils.showLoading('scout-table-container');
        let query = db.from('crop_scouting_records').select('*, farms(name), fields(name), crops(name), crop_cycles(id, crops(name))', { count: 'exact' })
            .eq('user_id', App.currentUser.id).order(this.sortBy, { ascending: this.sortOrder === 'asc' });
        if (this.filterFarm) query = query.eq('farm_id', this.filterFarm);
        if (this.filterHealth) query = query.eq('plant_health', this.filterHealth);
        if (this.searchQuery) query = query.or(`scout_name.ilike.%${this.searchQuery}%,growth_stage.ilike.%${this.searchQuery}%,pest_observation.ilike.%${this.searchQuery}%,disease_observation.ilike.%${this.searchQuery}%`);
        const from = (this.currentPage - 1) * this.perPage;
        query = query.range(from, from + this.perPage - 1);
        const { data, error, count } = await query;
        if (error) { console.error(error); Utils.hideLoading('scout-table-container', Utils.emptyState('fa-exclamation-triangle', 'Error', 'Could not load.')); return; }
        this.data = data || []; this.totalCount = count || 0; this.totalPages = Math.ceil(this.totalCount / this.perPage);
        this.render();
    },

    render() {
        const c = document.getElementById('scout-table-container'); if (!c) return;
        if (this.data.length === 0) { c.innerHTML = Utils.emptyState('fa-search', 'No Scouting Records', 'Record field scouting observations to monitor crop health.', 'Add Scouting Record', "Utils.openModal('scout-modal')"); return; }
        let html = `<div class="table-responsive"><table class="data-table"><thead><tr>
            <th class="sortable" data-sort="scouting_date">Date <i class="fas fa-sort"></i></th>
            <th>Farm / Field</th><th>Crop</th><th>Health</th><th>Growth Stage</th><th>Pest</th><th>Disease</th><th>Actions</th>
        </tr></thead><tbody>`;
        this.data.forEach(r => {
            const hasPest = r.pest_observation ? '<span class="text-danger text-xs font-semibold">Yes</span>' : '<span class="text-muted text-xs">None</span>';
            const hasDisease = r.disease_observation ? '<span class="text-danger text-xs font-semibold">Yes</span>' : '<span class="text-muted text-xs">None</span>';
            html += `<tr>
                <td>${Utils.formatDate(r.scouting_date)}</td>
                <td>${Utils.escapeHtml(r.farms?.name || '—')}<br><span class="text-xs text-light">${Utils.escapeHtml(r.fields?.name || '')}</span></td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(r.crops?.name || '—')}</span></td>
                <td>${Utils.statusBadge(r.plant_health)}</td>
                <td>${Utils.escapeHtml(r.growth_stage || '—')}</td>
                <td>${hasPest}</td>
                <td>${hasDisease}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="View" onclick="Scouting.view('${r.id}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Scouting.edit('${r.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Scouting.confirmDelete('${r.id}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        html += '</tbody></table></div>'; c.innerHTML = html;
        Utils.renderPagination('scout-pagination', this.currentPage, this.totalPages, p => { this.currentPage = p; this.load(); });
        c.querySelectorAll('.sortable').forEach(th => { th.addEventListener('click', () => { const col = th.dataset.sort; this.sortBy = col; this.sortOrder = this.sortBy === col && this.sortOrder === 'asc' ? 'desc' : 'asc'; this.currentPage = 1; this.load(); }); });
    },

    bindEvents() {
        document.getElementById('scout-search')?.addEventListener('input', Utils.debounce(e => { this.searchQuery = e.target.value.trim(); this.currentPage = 1; this.load(); }, 300));
        document.getElementById('filter-scout-farm')?.addEventListener('change', e => { this.filterFarm = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('filter-scout-health')?.addEventListener('change', e => { this.filterHealth = e.target.value; this.currentPage = 1; this.load(); });
        document.getElementById('scout-farm')?.addEventListener('change', e => this.loadFields(e.target.value));

        const form = document.getElementById('scout-form');
        if (form) form.addEventListener('submit', async e => {
            e.preventDefault(); if (!Utils.validateForm(form)) return;
            const btn = form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn, true);

            let photoUrl = form.dataset.existingPhoto || null;
            const fileInput = document.getElementById('scout-photo');
            if (fileInput && fileInput.files[0]) {
                try {
                    const file = fileInput.files[0];
                    const ext = file.name.split('.').pop();
                    const path = `${App.currentUser.id}/${Date.now()}.${ext}`;
                    const { error: uploadErr } = await db.storage.from('scouting-images').upload(path, file);
                    if (uploadErr) throw uploadErr;
                    const { data: urlData } = db.storage.from('scouting-images').getPublicUrl(path);
                    photoUrl = urlData.publicUrl;
                } catch (imgErr) {
                    console.error('Image upload error:', imgErr);
                    Utils.toast('Image upload failed, saving without photo', 'warning');
                }
            }

            const fd = {
                user_id: App.currentUser.id, farm_id: form.scout_farm.value || null, field_id: form.scout_field.value || null,
                crop_id: form.scout_crop.value || null, crop_cycle_id: form.scout_cycle.value || null,
                scouting_date: form.scout_date.value, scout_name: form.scout_name.value.trim(),
                growth_stage: form.scout_growth_stage.value.trim(), plant_health: form.scout_health.value,
                pest_observation: form.scout_pest.value.trim(), disease_observation: form.scout_disease.value.trim(),
                weed_observation: form.scout_weed.value.trim(), soil_observation: form.scout_soil.value.trim(),
                moisture_observation: form.scout_moisture.value.trim(), recommendation: form.scout_recommendation.value.trim(),
                photo_url: photoUrl, notes: form.scout_notes.value.trim()
            };
            try {
                if (form.dataset.editId) { const { error } = await db.from('crop_scouting_records').update(fd).eq('id', form.dataset.editId); if (error) throw error; Utils.toast('Updated'); }
                else { const { error } = await db.from('crop_scouting_records').insert(fd); if (error) throw error; Utils.toast('Added'); }
                Utils.closeModal('scout-modal'); this.load();
            } catch (err) { console.error(err); Utils.toast(err.message || 'Failed', 'error'); }
            finally { Utils.setBtnLoading(btn, false); delete form.dataset.editId; delete form.dataset.existingPhoto; }
        });
    },

    edit(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const form = document.getElementById('scout-form'); if (!form) return;
        if (r.farm_id) this.loadFields(r.farm_id);
        form.dataset.editId = id;
        form.dataset.existingPhoto = r.photo_url || '';
        form.scout_farm.value = r.farm_id || ''; form.scout_field.value = r.field_id || '';
        form.scout_crop.value = r.crop_id || ''; form.scout_cycle.value = r.crop_cycle_id || '';
        form.scout_date.value = r.scouting_date || ''; form.scout_name.value = r.scout_name || '';
        form.scout_growth_stage.value = r.growth_stage || ''; form.scout_health.value = r.plant_health || 'Healthy';
        form.scout_pest.value = r.pest_observation || ''; form.scout_disease.value = r.disease_observation || '';
        form.scout_weed.value = r.weed_observation || ''; form.scout_soil.value = r.soil_observation || '';
        form.scout_moisture.value = r.moisture_observation || ''; form.scout_recommendation.value = r.recommendation || '';
        form.scout_notes.value = r.notes || '';
        document.querySelector('#scout-modal .modal-title').textContent = 'Edit Scouting Record';
        Utils.openModal('scout-modal');
    },

    view(id) {
        const r = this.data.find(x => x.id === id); if (!r) return;
        const photoHtml = r.photo_url ? `<div class="view-item full-width"><label>Photo</label><p><img src="${r.photo_url}" alt="Scouting photo" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--border);margin-top:4px;"></p></div>` : '';
        document.getElementById('scout-view-content').innerHTML = `
            <div class="view-grid">
                <div class="view-item"><label>Date</label><p>${Utils.formatDate(r.scouting_date)}</p></div>
                <div class="view-item"><label>Scout</label><p>${Utils.escapeHtml(r.scout_name || '—')}</p></div>
                <div class="view-item"><label>Farm</label><p>${Utils.escapeHtml(r.farms?.name || '—')}</p></div>
                <div class="view-item"><label>Field</label><p>${Utils.escapeHtml(r.fields?.name || '—')}</p></div>
                <div class="view-item"><label>Crop</label><p>${Utils.escapeHtml(r.crops?.name || '—')}</p></div>
                <div class="view-item"><label>Growth Stage</label><p>${Utils.escapeHtml(r.growth_stage || '—')}</p></div>
                <div class="view-item"><label>Plant Health</label><p>${Utils.statusBadge(r.plant_health)}</p></div>
                <div class="view-item"><label>Moisture</label><p>${Utils.escapeHtml(r.moisture_observation || '—')}</p></div>
                <div class="view-item full-width"><label>Pest Observation</label><p>${Utils.escapeHtml(r.pest_observation || 'None observed')}</p></div>
                <div class="view-item full-width"><label>Disease Observation</label><p>${Utils.escapeHtml(r.disease_observation || 'None observed')}</p></div>
                <div class="view-item full-width"><label>Weed Observation</label><p>${Utils.escapeHtml(r.weed_observation || 'None observed')}</p></div>
                <div class="view-item full-width"><label>Soil Observation</label><p>${Utils.escapeHtml(r.soil_observation || '—')}</p></div>
                <div class="view-item full-width"><label>Recommendation</label><p>${Utils.escapeHtml(r.recommendation || '—')}</p></div>
                ${photoHtml}
                <div class="view-item full-width"><label>Notes</label><p>${Utils.escapeHtml(r.notes || '—')}</p></div>
            </div>`;
        Utils.openModal('scout-view-modal');
    },

    confirmDelete(id) {
        Utils.confirm('Delete this scouting record?', async () => {
            try { const { error } = await db.from('crop_scouting_records').delete().eq('id', id); if (error) throw error; Utils.toast('Deleted'); this.load(); }
            catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};