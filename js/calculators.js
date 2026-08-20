const Calculators = {
    async init() {
        const cards = [
            { icon:'fa-flask',title:'Fertilizer Calculator',desc:'Calculate total fertilizer needed based on area and rate.',link:'calculators/fertilizer.html' },
            { icon:'fa-atom',title:'NPK Calculator',desc:'Calculate N, P, K quantities from fertilizer blend.',link:'calculators/npk.html' },
            { icon:'fa-seedling',title:'Seed Rate Calculator',desc:'Calculate total seed requirement for a given area.',link:'calculators/seed-rate.html' },
            { icon:'fa-th',title:'Plant Population Calculator',desc:'Estimate plant population from spacing and area.',link:'calculators/plant-population.html' },
            { icon:'fa-tint',title:'Irrigation Calculator',desc:'Estimate water requirements for irrigation.',link:'calculators/irrigation.html' },
            { icon:'fa-cloud-rain',title:'Rainfall Calculator',desc:'Calculate water volume from rainfall depth.',link:'calculators/rainfall.html' },
            { icon:'fa-draw-polygon',title:'Field Area Calculator',desc:'Calculate area for rectangles, circles, triangles.',link:'calculators/area.html' },
            { icon:'fa-balance-scale',title:'Yield Calculator',desc:'Calculate yield per hectare or acre.',link:'calculators/yield.html' },
            { icon:'fa-arrows-alt-h',title:'Crop Spacing Calculator',desc:'Calculate plants per hectare from spacing.',link:'calculators/crop-spacing.html' }
        ];
        const container = document.getElementById('calc-cards-grid');
        if (container) {
            container.innerHTML = cards.map(c => `
                <a class="calc-card" href="${c.link}">
                    <div class="calc-card-icon"><i class="fas ${c.icon}"></i></div>
                    <h3>${c.title}</h3>
                    <p>${c.desc}</p>
                </a>
            `).join('');
        }
        await this.loadHistory();
    },

    async loadHistory() {
        const container = document.getElementById('calc-history-list');
        if (!container) return;
        try {
            const { data } = await db.from('calculation_history')
                .select('*')
                .eq('user_id', App.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (!data || data.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-light);font-size:13px;">No calculation history yet</div>';
                return;
            }
            const typeLabels = {
                'fertilizer':'Fertilizer','npk':'NPK','seed-rate':'Seed Rate','plant-population':'Plant Population',
                'irrigation':'Irrigation','rainfall':'Rainfall','area':'Area','yield':'Yield','crop-spacing':'Crop Spacing'
            };
            container.innerHTML = data.map(h => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;">
                    <div>
                        <span class="badge badge-primary">${Utils.escapeHtml(typeLabels[h.calculator_type] || h.calculator_type)}</span>
                        <span style="color:var(--text-light);font-size:12px;margin-left:8px;">${Utils.formatDateTime(h.created_at)}</span>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn-icon" title="Reopen" onclick="Calculators.reopen('${h.id}')"><i class="fas fa-redo"></i></button>
                        <button class="btn-icon btn-icon-danger" title="Delete" onclick="Calculators.deleteHistory('${h.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
        } catch (err) { console.error('History load error:', err); }
    },

    async saveHistory(type, inputs, result) {
        try {
            const { error } = await db.from('calculation_history').insert({
                user_id: App.currentUser.id,
                calculator_type: type,
                inputs: inputs,
                result: result
            });
            if (error) throw error;
            Utils.toast('Calculation saved to history', 'info');
            this.loadHistory();
        } catch (err) {
            console.error('Save history error:', err);
        }
    },

    async reopen(id) {
        try {
            const { data } = await db.from('calculation_history').select('*').eq('id', id).single();
            if (data) {
                localStorage.setItem('calc_reopen', JSON.stringify(data));
                const typeMap = {
                    'fertilizer':'calculators/fertilizer.html','npk':'calculators/npk.html','seed-rate':'calculators/seed-rate.html',
                    'plant-population':'calculators/plant-population.html','irrigation':'calculators/irrigation.html',
                    'rainfall':'calculators/rainfall.html','area':'calculators/area.html','yield':'calculators/yield.html','crop-spacing':'calculators/crop-spacing.html'
                };
                if (typeMap[data.calculator_type]) window.location.href = typeMap[data.calculator_type];
            }
        } catch (err) { console.error(err); }
    },

    async deleteHistory(id) {
        Utils.confirm('Delete this calculation from history?', async () => {
            try {
                const { error } = await db.from('calculation_history').delete().eq('id', id);
                if (error) throw error;
                Utils.toast('Deleted from history');
                this.loadHistory();
            } catch (err) { Utils.toast(err.message || 'Failed', 'error'); }
        });
    }
};