const RainfallCalc = {
    init(){const f=document.getElementById('rf-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){const depth=parseFloat(document.getElementById('rf-depth').value)||0,area=parseFloat(document.getElementById('rf-area').value)||0,areaUnit=document.getElementById('rf-area-unit').value;
    const areaM2=areaUnit==='acres'?area*4046.86:area*10000;const volM3=areaM2*(depth/1000);const volL=volM3*1000;
    document.getElementById('rf-result').innerHTML=`<h4>Water Volume from Rainfall</h4>
        <div class="calc-result-item"><span class="label">Rainfall Depth</span><span class="value">${Utils.formatNumber(depth)} mm over ${Utils.escapeHtml(area)} ${Utils.escapeHtml(areaUnit)}</span></div>
        <div class="calc-result-item"><span class="label">Water Volume</span><span class="value">${Utils.formatNumber(volM3.toFixed(1))} m³ (${Utils.formatNumber(volL.toFixed(0))} L)</span></div>`;
    document.getElementById('rf-result').style.display='block';},
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='rainfall')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('rf-depth').value=d.inputs.depth||'';document.getElementById('rf-area').value=d.inputs.area||'';document.getElementById('rf-area-unit').value=d.inputs.areaUnit||'hectares';}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};