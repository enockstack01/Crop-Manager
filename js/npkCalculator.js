const NPKCalc = {
    init() { const f=document.getElementById('npk-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();}); this.loadReopen(); },
    calculate() {
        const qty=parseFloat(document.getElementById('npk-qty').value)||0, n=parseFloat(document.getElementById('npk-n').value)||0, p=parseFloat(document.getElementById('npk-p').value)||0, k=parseFloat(document.getElementById('npk-k').value)||0;
        document.getElementById('npk-result').innerHTML=`
            <h4>NPK Breakdown</h4>
            <div class="calc-result-item"><span class="label">Nitrogen (N)</span><span class="value">${Utils.formatNumber((qty*n/100).toFixed(2))} kg</span></div>
            <div class="calc-result-item"><span class="label">Phosphorus (P)</span><span class="value">${Utils.formatNumber((qty*p/100).toFixed(2))} kg</span></div>
            <div class="calc-result-item"><span class="label">Potassium (K)</span><span class="value">${Utils.formatNumber((qty*k/100).toFixed(2))} kg</span></div>
            <div class="calc-result-item"><span class="label">Total Fertilizer</span><span class="value">${Utils.formatNumber(qty.toFixed(2))} kg</span></div>
        `;
        document.getElementById('npk-result').style.display='block';
    },
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='npk')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('npk-qty').value=d.inputs.qty||'';document.getElementById('npk-n').value=d.inputs.n||'';document.getElementById('npk-p').value=d.inputs.p||'';document.getElementById('npk-k').value=d.inputs.k||'';}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};