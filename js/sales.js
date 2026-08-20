const Sales = {
    data:[],farms:[],crops:[],cycles:[],statuses:['Pending','Partially Paid','Paid'],
    currentPage:1,perPage:10,searchQuery:'',filterFarm:'',filterCrop:'',filterStatus:'',sortBy:'sale_date',sortOrder:'desc',
    async init(){const[f,c,cyc]=await Promise.all([db.from('farms').select('id,name').eq('user_id',App.currentUser.id).order('name'),db.from('crops').select('id,name').eq('user_id',App.currentUser.id).order('name'),db.from('crop_cycles').select('id,farms(name),crops(name)').eq('user_id',App.currentUser.id).limit(100)]);
    this.farms=f.data||[];this.crops=c.data||[];this.cycles=cyc.data||[];
    const p=(id,items,vk,lk,ph)=>{const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">${ph}</option>`;items.forEach(i=>{s.innerHTML+=`<option value="${i[vk]}">${Utils.escapeHtml(i[lk])}</option>`;});};
    p('sale-farm',this.farms,'id','name','Select Farm');p('filter-sale-farm',this.farms,'id','name','All Farms');
    p('sale-crop',this.crops,'id','name','All Crops');p('filter-sale-crop',this.crops,'id','name','All Crops');
    p('filter-sale-status',this.statuses.map(s=>({id:s,name:s})),'id','name','All Statuses');
    p('sale-cycle',this.cycles.map(c=>({id:c.id,name:`${c.farms?.name||'?'}/${c.crops?.name||'?'}`})),'id','name','Select Cycle');
    await this.load();this.bindEvents();},
    async load(){Utils.showLoading('sale-table-container');let q=db.from('sales').select('*,farms(name),crops(name)',{count:'exact'}).eq('user_id',App.currentUser.id).order(this.sortBy,{ascending:this.sortOrder==='asc'});
    if(this.searchQuery)q=q.or(`buyer.ilike.%${this.searchQuery}%,market.ilike.%${this.searchQuery}%`);
    if(this.filterFarm)q=q.eq('farm_id',this.filterFarm);if(this.filterCrop)q=q.eq('crop_id',this.filterCrop);if(this.filterStatus)q=q.eq('payment_status',this.filterStatus);
    q=q.range((this.currentPage-1)*this.perPage,(this.currentPage-1)*this.perPage+this.perPage-1);
    const{data,error,count}=await q;if(error){console.error(error);Utils.hideLoading('sale-table-container',Utils.emptyState('fa-exclamation-triangle','Error','Could not load.'));return;}
    this.data=data||[];this.totalCount=count||0;this.totalPages=Math.ceil(this.totalCount/this.perPage);this.render();},
    render(){const c=document.getElementById('sale-table-container');if(!c)return;
    if(this.data.length===0){c.innerHTML=Utils.emptyState('fa-hand-holding-usd','No Sales','Record crop sales and track payment status.','Add Sale',"Utils.openModal('sale-modal')");return;}
    let h=`<div class="table-responsive"><table class="data-table"><thead><tr><th class="sortable" data-sort="sale_date">Date <i class="fas fa-sort"></i></th><th>Crop</th><th>Buyer</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Payment</th><th>Actions</th></tr></thead><tbody>`;
    this.data.forEach(s=>{h+=`<tr><td>${Utils.formatDate(s.sale_date)}</td><td><span class="badge badge-primary">${Utils.escapeHtml(s.crops?.name||'—')}</span></td><td>${Utils.escapeHtml(s.buyer||'—')}</td><td>${Utils.formatNumber(s.quantity)} ${Utils.escapeHtml(s.unit||'kg')}</td><td>${Utils.formatCurrency(s.unit_price)}</td><td><strong>${Utils.formatCurrency(s.total_amount)}</strong></td><td>${Utils.statusBadge(s.payment_status)}</td><td class="table-actions"><button class="btn-icon" title="Edit" onclick="Sales.edit('${s.id}')"><i class="fas fa-pen"></i></button><button class="btn-icon btn-icon-danger" title="Delete" onclick="Sales.confirmDelete('${s.id}')"><i class="fas fa-trash"></i></button></td></tr>`;});
    h+='</tbody></table></div>';c.innerHTML=h;Utils.renderPagination('sale-pagination',this.currentPage,this.totalPages,p=>{this.currentPage=p;this.load();});
    c.querySelectorAll('.sortable').forEach(th=>{th.addEventListener('click',()=>{const col=th.dataset.sort;this.sortBy=col;this.sortOrder=this.sortBy===col&&this.sortOrder==='asc'?'desc':'asc';this.currentPage=1;this.load();});});},
    bindEvents(){document.getElementById('sale-search')?.addEventListener('input',Utils.debounce(e=>{this.searchQuery=e.target.value.trim();this.currentPage=1;this.load();},300));
    document.getElementById('filter-sale-farm')?.addEventListener('change',e=>{this.filterFarm=e.target.value;this.currentPage=1;this.load();});
    document.getElementById('filter-sale-crop')?.addEventListener('change',e=>{this.filterCrop=e.target.value;this.currentPage=1;this.load();});
    document.getElementById('filter-sale-status')?.addEventListener('change',e=>{this.filterStatus=e.target.value;this.currentPage=1;this.load();});
    const form=document.getElementById('sale-form');if(form)form.addEventListener('submit',async e=>{
        e.preventDefault();if(!Utils.validateForm(form))return;const btn=form.querySelector('button[type="submit"]');Utils.setBtnLoading(btn,true);
        const fd={user_id:App.currentUser.id,farm_id:form.sale_farm.value||null,crop_id:form.sale_crop.value,crop_cycle_id:form.sale_cycle.value||null,buyer:form.sale_buyer.value.trim(),quantity:parseFloat(form.sale_qty.value)||0,unit:form.sale_unit.value,unit_price:parseFloat(form.sale_price.value)||0,sale_date:form.sale_date.value,market:form.sale_market.value.trim(),payment_status:form.sale_status.value,notes:form.sale_notes.value.trim()};
        try{if(form.dataset.editId){const{error}=await db.from('sales').update({farm_id:fd.farm_id,crop_id:fd.crop_id,crop_cycle_id:fd.crop_cycle_id,buyer:fd.buyer,quantity:fd.quantity,unit:fd.unit,unit_price:fd.unit_price,sale_date:fd.sale_date,market:fd.market,payment_status:fd.payment_status,notes:fd.notes}).eq('id',form.dataset.editId);if(error)throw error;Utils.toast('Updated');}else{const{error}=await db.from('sales').insert(fd);if(error)throw error;Utils.toast('Added');}Utils.closeModal('sale-modal');this.load();}catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);delete form.dataset.editId;}
    });},
    edit(id){const s=this.data.find(x=>x.id===id);if(!s)return;const form=document.getElementById('sale-form');if(!form)return;
    form.dataset.editId=id;form.sale_farm.value=s.farm_id||'';form.sale_crop.value=s.crop_id||'';form.sale_cycle.value=s.crop_cycle_id||'';
    form.sale_buyer.value=s.buyer||'';form.sale_qty.value=s.quantity||'';form.sale_unit.value=s.unit||'kg';form.sale_price.value=s.unit_price||'';
    form.sale_date.value=s.sale_date||'';form.sale_market.value=s.market||'';form.sale_status.value=s.payment_status||'Pending';form.sale_notes.value=s.notes||'';
    document.querySelector('#sale-modal .modal-title').textContent='Edit Sale';Utils.openModal('sale-modal');},
    confirmDelete(id){Utils.confirm('Delete this sale record?',async()=>{try{const{error}=await db.from('sales').delete().eq('id',id);if(error)throw error;Utils.toast('Deleted');this.load();}catch(err){Utils.toast(err.message||'Failed','error');}});}
};