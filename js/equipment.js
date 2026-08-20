const Equipment = {
    data:[],farms:[],statuses:['Available','In Use','Maintenance','Damaged','Retired'],
    currentPage:1,perPage:10,searchQuery:'',filterStatus:'',sortBy:'created_at',sortOrder:'desc',
    async init(){const[r]=await db.from('farms').select('id,name').eq('user_id',App.currentUser.id).order('name');this.farms=r.data||[];const p=(id,items)=>{const s=document.getElementById(id);if(!s)return;s.innerHTML='<option value="">Select Farm</option>';items.forEach(i=>{s.innerHTML+=`<option value="${i.id}">${Utils.escapeHtml(i.name)}</option>`;});};
    p('eq-farm',this.farms);p('filter-eq-status',this.statuses.map(s=>({id:s,name:s})));p('eq-status',this.statuses);
    await this.load();this.bindEvents();},
    async load(){Utils.showLoading('eq-table-container');let q=db.from('equipment').select('*',{count:'exact'}).eq('user_id',App.currentUser.id).order(this.sortBy,{ascending:this.sortOrder==='asc'});
    if(this.searchQuery)q=q.or(`name.ilike.%${this.searchQuery}%,model.ilike.%${this.searchQuery}%,serial_number.ilike.%${this.searchQuery}%`);
    if(this.filterStatus)q=q.eq('status',this.filterStatus);
    q=q.range((this.currentPage-1)*this.perPage,(this.currentPage-1)*this.perPage+this.perPage-1);
    const{data,error,count}=await q;if(error){console.error(error);Utils.hideLoading('eq-table-container',Utils.emptyState('fa-exclamation-triangle','Error','Could not load.'));return;}
    this.data=data||[];this.totalCount=count||0;this.totalPages=Math.ceil(this.totalCount/this.perPage);this.render();},
    render(){const c=document.getElementById('eq-table-container');if(!c)return;
    if(this.data.length===0){c.innerHTML=Utils.emptyState('fa-cog','No Equipment','Register your farm equipment.','Add Equipment',"Utils.openModal('eq-modal')");return;}
    let h=`<div class="table-responsive"><table class="data-table"><thead><tr><th class="sortable" data-sort="name">Equipment <i class="fas fa-sort"></i></th><th>Type</th><th>Model</th><th>Status</th><th>Condition</th><th>Location</th><th>Actions</th></tr></thead><tbody>`;
    this.data.forEach(e=>{h+=`<tr><td><strong>${Utils.escapeHtml(e.name)}</strong></td><td>${Utils.escapeHtml(e.equipment_type||'—')}</td><td>${Utils.escapeHtml(e.model||'—')}</td><td>${Utils.statusBadge(e.status)}</td><td>${Utils.escapeHtml(e.condition||'—')}</td><td>${Utils.escapeHtml(e.location||'—')}</td><td class="table-actions"><button class="btn-icon" title="Edit" onclick="Equipment.edit('${e.id}')"><i class="fas fa-pen"></i></button><button class="btn-icon btn-icon-danger" title="Delete" onclick="Equipment.confirmDelete('${e.id}','${Utils.escapeHtml(e.name)}')"><i class="fas fa-trash"></i></button></td></tr>`;});
    h+='</tbody></table></div>';c.innerHTML=h;Utils.renderPagination('eq-pagination',this.currentPage,this.totalPages,p=>{this.currentPage=p;this.load();});
    c.querySelectorAll('.sortable').forEach(th=>{th.addEventListener('click',()=>{const col=th.dataset.sort;this.sortBy=col;this.sortOrder=this.sortBy===col&&this.sortOrder==='asc'?'desc':'asc';this.currentPage=1;this.load();});});},
    bindEvents(){document.getElementById('eq-search')?.addEventListener('input',Utils.debounce(e=>{this.searchQuery=e.target.value.trim();this.currentPage=1;this.load();},300));
    document.getElementById('filter-eq-status')?.addEventListener('change',e=>{this.filterStatus=e.target.value;this.currentPage=1;this.load();});
    const form=document.getElementById('eq-form');if(form)form.addEventListener('submit',async e=>{
        e.preventDefault();if(!Utils.validateForm(form))return;const btn=form.querySelector('button[type="submit"]');Utils.setBtnLoading(btn,true);
        const fd={user_id:App.currentUser.id,name:form.eq_name.value.trim(),equipment_type:form.eq_type.value.trim(),model:form.eq_model.value.trim(),serial_number:form.eq_serial.value.trim(),purchase_date:form.eq_date.value||null,purchase_cost:parseFloat(form.eq_cost.value)||0,condition:form.eq_condition.value.trim(),location:form.eq_location.value.trim(),status:form.eq_status.value,notes:form.eq_notes.value.trim()};
        try{if(form.dataset.editId){const{error}=await db.from('equipment').update(fd).eq('id',form.dataset.editId);if(error)throw error;Utils.toast('Updated');}else{const{error}=await db.from('equipment').insert(fd);if(error)throw error;Utils.toast('Added');}Utils.closeModal('eq-modal');this.load();}catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);delete form.dataset.editId;}
    });},
    edit(id){const e=this.data.find(x=>x.id===id);if(!e)return;const form=document.getElementById('eq-form');if(!form)return;
    form.dataset.editId=id;form.eq_name.value=e.name||'';form.eq_type.value=e.equipment_type||'';form.eq_model.value=e.model||'';form.eq_serial.value=e.serial_number||'';
    form.eq_date.value=e.purchase_date||'';form.eq_cost.value=e.purchase_cost||0;form.eq_condition.value=e.condition||'';form.eq_location.value=e.location||'';form.eq_status.value=e.status||'Available';form.eq_notes.value=e.notes||'';
    document.querySelector('#eq-modal .modal-title').textContent='Edit Equipment';Utils.openModal('eq-modal');},
    confirmDelete(id,name){Utils.confirm(`Delete <strong>"${name}"</strong>?`,async()=>{try{const{error}=await db.from('equipment').delete().eq('id',id);if(error)throw error;Utils.toast('Deleted');this.load();}catch(err){Utils.toast(err.message||'Failed','error');}});}
};