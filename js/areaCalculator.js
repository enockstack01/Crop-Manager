const AreaCalc = {
    init(){const f=document.getElementById('ar-form');if(f)f.addEventListener('submit',e=>{e.preventDefault();this.calculate();});this.loadReopen();},
    calculate(){
        const shape=document.getElementById('ar-shape').value,results=[];
        const l=parseFloat(document.getElementById('ar-l').value)||0,w=parseFloat(document.getElementById('ar-w').value)||0,h=parseFloat(document.getElementById('ar-h').value)||0,r=parseFloat(document.getElementById('ar-r').value)||0,b=parseFloat(document.getElementById('ar-b').value)||0,base=parseFloat(document.getElementById('ar-base').value)||0,s=parseFloat(document.getElementById('ar-s').value)||0;
        let m2=0;
        if(shape==='rectangle')m2=l*w;
        else if(shape==='square')m2=l*l;
        else if(shape==='triangle')m2=(b*base)/2;
        else if(shape==='circle')m2=Math.PI*r*r;
        const ha=m2/10000,ac=ha*2.471;
        results.push({label:'Square Metres (m²)',value:m2.toFixed(2)});
        results.push({label:'Hectares (ha)',value:ha.toFixed(4)});
        results.push({label:'Acres',value:ac.toFixed(4)});
        document.getElementById('ar-result').innerHTML=`<h4>Area Calculation — ${Utils.escapeHtml(shape)}</h4>${results.map(r=>`<div class="calc-result-item"><span class="label">${r.label}</span><span class="value">${r.value}</span></div>`).join('')}`;
        document.getElementById('ar-result').style.display='block';
        // Show/hide shape-specific fields
        ['ar-l','ar-w','ar-h','ar-r','ar-b','ar-base','ar-s'].forEach(id=>{
            const el=document.getElementById(id);if(el)el.closest('.form-group').style.display=shape==='rectangle'?'':'none';
        });
    },
    loadReopen(){const s=localStorage.getItem('calc_reopen');if(!s)return;try{const d=JSON.parse(s);if(d.calculator_type!=='area')return;localStorage.removeItem('calc_reopen');if(d.inputs){document.getElementById('ar-shape').value=d.inputs.shape||'rectangle';document.getElementById('ar-l').value=d.inputs.l||'';document.getElementById('ar-w').value=d.inputs.w||'';document.getElementById('ar-h').value=d.inputs.h||'';document.getElementById('ar-r').value=d.inputs.r||'';document.getElementById('ar-b').value=d.inputs.b||'';document.getElementById('ar-base').value=d.inputs.base||'';document.getElementById('ar-s').value=d.inputs.s||'';document.getElementById('ar-shape').dispatchEvent(new Event('change'));}if(d.result)this.calculate();}catch(e){localStorage.removeItem('calc_reopen');}}
};