const CropSpacingCalc = {
    init(){const f=document.getElementById('cs-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){const row=parseFloat(document.getElementById('cs-row').value)||0,plant=parseFloat(document.getElementById('cs-plant').value)||0,area=parseFloat(document.getElementById('cs-area').value)||0;
    const perSqm=10000/(row*plant),perHectare=perSqm*10000,total=Math.round(perHectare*area);
    document.getElementById('cs-result').innerHTML=`<h4>Plant Population</h4>
        <div class="calc-result-item"><span class="label">Plants per m²</span><span class="value">${perSqm.toFixed(2)}</span></div>
        <div class="calc-result-item"><span class="label">Plants per Hectare</span><span class="value">${Utils.formatNumber(perHectare)}</span></div>
        <div class="calc-result-item"><span class="label">Estimated Total</span><span class="value">${Utils.formatNumber(total)}</span></div>`;
        document.getElementById('cs-result').style.display='block';},
    loadReopen(){const s=localStorage.getItem('calc_reload');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='crop-spacing')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('cs-row').value=d.inputs.row||'';document.getElementById('cs-plant').value=d.inputs.plant||'';document.getElementById('cs-area').value=d.inputs.area||'';}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};