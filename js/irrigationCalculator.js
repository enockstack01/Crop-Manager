const IrrigCalc = {
    init(){const f=document.getElementById('irr-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){const area=parseFloat(document.getElementById('irr-area').value)||0,depth=parseFloat(document.getElementById('irr-depth').value)||0,eff=parseFloat(document.getElementById('irr-eff').value)||80,areaUnit=document.getElementById('irr-area-unit').value;
    const areaM2=areaUnit==='acres'?area*4046.86:area*10000;
    const volumeM3=areaM2*(depth/1000);const volumeL=volumeM3*1000;const required=volumeM3/(eff/100);
    document.getElementById('irr-result').innerHTML=`<h4>Estimated Water Requirement</h4>
        <div class="calc-result-item"><span class="label">Water Volume</span><span class="value">${Utils.formatNumber(volumeM3.toFixed(1))} m³ (${Utils.formatNumber(volumeL.toFixed(0))} litres)</span></div>
        <div class="calc-result-item"><span class="label">Gross Water Needed</span><span class="value">${Utils.formatNumber(required.toFixed(1))} m³</span></div>
        <div class="calc-result-item"><span class="label">Application Efficiency</span><span class="value">${eff}%</span></div>`;
    document.getElementById('irr-result').style.display='block';},
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='irrigation')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('irr-area').value=d.inputs.area||'';document.getElementById('irr-area-unit').value=d.inputs.areaUnit||'hectares';document.getElementById('irr-depth').value=d.inputs.depth||'';document.getElementById('irr-eff').value=d.inputs.eff||80;}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};