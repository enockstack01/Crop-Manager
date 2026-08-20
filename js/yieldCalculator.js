const YieldCalc = {
    init(){const f=document.getElementById('yd-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){const qty=parseFloat(document.getElementById('yd-qty').value)||0,area=parseFloat(document.getElementById('yd-area').value)||0,areaUnit=document.getElementById('yd-area-unit').value;
        const areaHa=areaUnit==='acres'?area*0.404686:area;
        const yHa=qty/areaHa, yAc=yHa*2.471;
        document.getElementById('yd-result').innerHTML=`<h4>Yield Calculation</h4>
        <div class="calc-result-item"><span class="label">Yield per Hectare</span><span class="value">${yHa.toFixed(2)} kg/ha</span></div>
        <div class="calc-result-item"><span class="label">Yield per Acre</span><span class="value">${yAc.toFixed(2)} kg/ac</span></div>`;
        document.getElementById('yd-result').style.display='block';},
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='yield')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('yd-qty').value=d.inputs.qty||'';document.getElementById('yd-area').value=d.inputs.area||'';document.getElementById('yd-area-unit').value=d.inputs.areaUnit||'hectares';}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};