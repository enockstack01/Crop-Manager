const Expenses = {
    data:[],farms:[],cycles:[],categories:['Seeds','Fertilizer','Pesticides','Labor','Irrigation','Machinery','Fuel','Transport','Storage','Equipment','Other'],
    currentPage:1,perPage:10,searchQuery:'',filterFarm:'',filterCategory:'',sortBy:'expense_date',sortOrder:'desc',
    async init(){const[f,c]=await Promise.all([db.from('farms').select('id,name').eq('user_id',App.currentUser.id).order('name'),db.from('crop_cycles').select('id,farms(name),crops(name),seasons(name)').eq('user_id',App.currentUser.id).limit(100)]);
    this.farms=f.data||[];this.cycles=c.data||[];
    const p=(id,items,vk,lk,ph)=>{const s=document.getElementById(id);if(!s)return;s.innerHTML=`<option value="">${ph}</option>`;items.forEach(i=>{s.innerHTML+=`<option value="${i[vk]}">${Utils.escapeHtml(i[lk])}</option>`;});};
    p('exp-farm',this.farms,'id','name','Select Farm');p('filter-exp-farm',this.farms,'id','name','All Farms');
    p('exp-category',this.categories.map(c=>({id:c,name:c})),'id','name','All Categories');p('filter-exp-category',this.categories.map(c=>({id:c,name:c})),'id','name','All Categories');
    p('exp-cycle',this.cycles.map(c=>({id:c.id,name:`${c.farms?.name||'?'}/${c.crops?.name||'?'} — ${c.seasons?.name||''}`})),'id','name','Select Crop Cycle');
    await this.load();this.bindEvents();},
    async load(){Utils.showLoading('exp-table-container');let q=db.from('expenses').select('*,farms(name)',{count:'exact'}).eq('user_id',App.currentUser.id).order(this.sortBy,{ascending:this.sortOrder==='asc'});
    if(this.searchQuery)q=q.or(`description.ilike.%${this.searchQuery}%,supplier.ilike.%${this.searchQuery}%`);
    if(this.filterFarm)q=q.eq('farm_id',this.filterFarm);if(this.filterCategory)q=q.eq('category',this.filterCategory);
    q=q.range((this.currentPage-1)*this.perPage,(this.currentPage-1)*this.perPage+this.perPage-1);
    const{data,error,count}=await q;if(error){console.error(error);Utils.hideLoading('exp-table-container',Utils.emptyState('fa-exclamation-triangle','Error','Could not load.'));return;}
    this.data=data||[];this.totalCount=count||0;this.totalPages=Math.ceil(this.totalCount/this.perPage);this.render();},
    render(){const c=document.getElementById('exp-table-container');if(!c)return;
    if(this.data.length===0){c.innerHTML=Utils.emptyState('fa-receipt','No Expenses','Track all farm-related expenditures.','Add Expense',"Utils.openModal('exp-modal')");return;}
    let h=`<div class="table-responsive"><table class="data-table"><thead><tr><th class="sortable" data-sort="expense_date">Date <i class="fas fa-sort"></i></th><th>Category</th><th>Description</th><th>Farm</th><th>Amount</th><th>Supplier</th><th>Actions</th></tr></thead><tbody>`;
    this.data.forEach(e=>{h+=`<tr><td>${Utils.formatDate(e.expense_date)}</td><td><span class="badge badge-primary">${Utils.escapeHtml(e.category||'Other')}</span></td><td class="text-truncate" style="max-width:200px;">${Utils.escapeHtml(e.description||'—')}</td><td>${Utils.escapeHtml(e.farms?.name||'—')}</td><td><strong style="color:var(--red);">${Utils.formatCurrency(e.amount)}</strong></td><td>${Utils.escapeHtml(e.supplier||'—')}</td><td class="table-actions"><button class="btn-icon" title="Edit" onclick="Expenses.edit('${e.id}')"><i class="fas fa-pen"></i></button><button class="btn-icon btn-icon-danger" title="Delete" onclick="Expenses.confirmDelete('${e.id}')"><i class="fas fa-trash"></i></button></td></tr>`;});
    h+='</tbody></table></div>';c.innerHTML=h;Utils.renderPagination('exp-pagination',this.currentPage,this.totalPages,p=>{this.currentPage=p;this.load();});
    c.querySelectorAll('.sortable').forEach(th=>{th.addEventListener('click',()=>{const col=th.dataset.sort;this.sortBy=col;this.sortOrder=this.sortBy===col&&this.sortOrder==='asc'?'desc':'asc';this.currentPage=1;this.load();});});},
    bindEvents(){document.getElementById('exp-search')?.addEventListener('input',Utils.debounce(e=>{this.searchQuery=e.target.value.trim();this.currentPage=1;this.load();},300));
    document.getElementById('filter-exp-farm')?.addEventListener('change',e=>{this.filterFarm=e.target.value;this.currentPage=1;this.load();});
    document.getElementById('filter-exp-category')?.addEventListener('change',e=>{this.filterCategory=e.target.value;this.currentPage=1;this.load();});
    const form=document.getElementById('exp-form');if(form)form.addEventListener('submit',async e=>{
        e.preventDefault();if(!Utils.validateForm(form))return;const btn=form.querySelector('button[type="submit"]');Utils.setBtnLoading(btn,true);
        const fd={user_id:App.currentUser.id,farm_id:form.exp_farm.value||null,crop_cycle_id:form.exp_cycle.value||null,category:form.exp_category.value,description:form.exp_desc.value.trim(),amount:parseFloat(form.exp_amount.value)||0,expense_date:form.exp_date.value,payment_method:form.exp_payment.value.trim(),supplier:form.exp_supplier.value.trim(),notes:form.exp_notes.value.trim()};
        try{if(form.dataset.editId){const{error}=await db.from('expenses').update(fd).eq('id',form.dataset.editId);if(error)throw error;Utils.toast('Updated');}else{const{error}=await db.from('expenses').insert(fd);if(error)throw error;Utils.toast('Added');}Utils.closeModal('exp-modal');this.load();}catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);delete form.dataset.editId;}
    });},
    edit(id){const e=this.data.find(x=>x.id===id);if(!e)return;const form=document.getElementById('exp-form');if(!form)return;
    form.dataset.editId=id;form.exp_farm.value=e.farm_id||'';form.exp_cycle.value=e.crop_cycle_id||'';form.exp_category.value=e.category||'Other';
    form.exp_desc.value=e.description||'';form.exp_amount.value=e.amount||0;form.exp_date.value=e.expense_date||'';
    form.exp_payment.value=e.payment_method||'';form.exp_supplier.value=e.supplier||'';form.exp_notes.value=e.notes||'';
    document.querySelector('#exp-modal .modal-title').textContent='Edit Expense';Utils.openModal('exp-modal');},
    confirmDelete(id){Utils.confirm('Delete this expense?',async()=>{try{const{error}=await db.from('expenses').delete().eq('id',id);if(error)throw error;Utils.toast('Deleted');this.load();}catch(err){Utils.toast(err.message||'Failed','error');}});}
};