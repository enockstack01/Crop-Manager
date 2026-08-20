const PlantPopCalc = {
    init(){const f=document.getElementById('pp-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){const row=parseFloat(document.getElementById('pp-row').value)||0,plant=parseFloat(document.getElementById('pp-plant').value)||0,area=parseFloat(document.getElementById('pp-area').value)||0;
    const perSqm=(10000/(row*plant)),perHectare=perSqm*10000,total=Math.round(perHectare*area);
    document.getElementById('pp-result').innerHTML=`<h4>Result</h4>
        <div class="calc-result-item"><span class="label">Plants per m²</span><span class="value">${perSqm.toFixed(1)}</span></div>
        <div class="calc-result-item"><span class="label">Plants per Hectare</span><span class="value">${Utils.formatNumber(perHectare)}</span></div>
        <div class="calc-result-item"><span class="label">Estimated Total Population</span><span class="value">${Utils.formatNumber(total)}</span></div>`;
    document.getElementById('pp-result').style.display='block';},
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='plant-population')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('pp-row').value=d.inputs.row||'';document.getElementById('pp-plant').value=d.inputs.plant||'';document.getElementById('pp-area').value=d.inputs.area||'';}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};