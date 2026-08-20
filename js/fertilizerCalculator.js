const FertCalc = {
    init() {
        const form = document.getElementById('calc-form');
        if (form) form.addEventListener('submit', e => { e.preventDefault(); this.calculate(); });
        this.loadReopen();
    },
    calculate() {
        const area = parseFloat(document.getElementById('c-area').value) || 0;
        const unit = document.getElementById('c-unit').value;
        const rate = parseFloat(document.getElementById('c-rate').value) || 0;
        const rateUnit = document.getElementById('c-rate-unit').value;
        const total = area * rate;
        document.getElementById('c-result').innerHTML = `
            <h4>Result</h4>
            <div class="calc-result-item"><span class="label">Total Fertilizer Required</span><span class="value">${Utils.formatNumber(total.toFixed(2))} ${Utils.escapeHtml(rateUnit)}/${Utils.escapeHtml(unit)}</span></div>
        `;
        document.getElementById('c-result').style.display = 'block';
    },
    loadReopen() {
        const saved = localStorage.getItem('calc_reopen');
        if (!saved) return;
        try {
            const d = JSON.parse(saved);
            if (d.calculator_type !== 'fertilizer') return;
            localStorage.removeItem('calc_reopen');
            if (d.inputs) { document.getElementById('c-area').value = d.inputs.area || ''; document.getElementById('c-unit').value = d.inputs.unit || 'hectares'; document.getElementById('c-rate').value = d.inputs.rate || ''; document.getElementById('c-rate-unit').value = d.inputs.rateUnit || 'kg/ha'; }
            if (d.result) this.calculate();
        } catch(e) { localStorage.removeItem('calc_reopen'); }
    }
};