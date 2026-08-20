const Maintenance = {
    data:[],equipmentList:[],currentPage:1,perPage:10,searchQuery:'',sortBy:'maintenance_date',sortOrder:'desc',
    async init(){const[r]=await db.from('equipment').select('id,name').eq('user_id',App.currentUser.id).order('name');this.equipmentList=r.data||[];
    const s=document.getElementById('mnt-eq');if(s){s.innerHTML='<option value="">Select Equipment</option>';this.equipmentList.forEach(e=>{s.innerHTML+=`<option value="${e.id}">${Utils.escapeHtml(e.name)}</option>`;});}
    await this.load();this.bindEvents();},
    async load(){Utils.showLoading('mnt-table-container');let q=db.from('equipment_maintenance').select('*,equipment(name)').eq('user_id',App.currentUser.id).order(this.sortBy,{ascending:this.sortOrder==='asc'});
    if(this.searchQuery)q=q.or(`description.ilike.%${this.searchQuery}%,performed_by.ilike.%${this.searchQuery}%`);
    q=q.range((this.currentPage-1)*this.perPage,(this.currentPage-1)*this.perPage+this.perPage-1);
    const{data,error,count}=await q;if(error){console.error(error);Utils.hideLoading('mnt-table-container',Utils.emptyState('fa-exclamation-triangle','Error','Could not load.'));return;}
    this.data=data||[];this.totalCount=count||0;this.totalPages=Math.ceil(this.totalCount/this.perPage);this.render();},
    render(){const c=document.getElementById('mnt-table-container');if(!c)return;
    if(this.data.length===0){c.innerHTML=Utils.emptyState('fa-wrench','No Maintenance Records','Track equipment servicing and repairs.','Add Record',"Utils.openModal('mnt-modal')");return;}
    let h=`<div class="table-responsive"><table class="data-table"><thead><tr><th class="sortable" data-sort="maintenance_date">Date <i class="fas fa-sort"></i></th><th>Equipment</th><th>Type</th><th>Description</th><th>Cost</th><th>Performed By</th><th>Actions</th></tr></thead><tbody>`;
    this.data.forEach(m=>{h+=`<tr><td>${Utils.formatDate(m.maintenance_date)}</td><td><span class="badge badge-primary">${Utils.escapeHtml(m.equipment?.name||'—')}</span></td><td>${Utils.escapeHtml(m.type||'—')}</td><td class="text-truncate" style="max-width:180px;">${Utils.escapeHtml(m.description||'—')}</td><td>${m.cost?Utils.formatCurrency(m.cost):'—'}</td><td>${Utils.escapeHtml(m.performed_by||'—')}</td><td class="table-actions"><button class="btn-icon" title="Edit" onclick="Maintenance.edit('${m.id}')"><i class="fas fa-pen"></i></button><button class="btn-icon btn-icon-danger" title="Delete" onclick="Maintenance.confirmDelete('${m.id}')"><i class="fas fa-trash"></i></button></td></tr>`;});
    h+='</tbody></table></div>';c.innerHTML=h;Utils.renderPagination('mnt-pagination',this.currentPage,this.totalPages,p=>{this.currentPage=p;this.load();});
    c.querySelectorAll('.sortable').forEach(th=>{th.addEventListener('click',()=>{const col=th.dataset.sort;this.sortBy=col;this.sortOrder=this.sortBy===col&&this.sortOrder==='asc'?'desc':'asc';this.currentPage=1;this.load();});});},
    bindEvents(){document.getElementById('mnt-search')?.addEventListener('input',Utils.debounce(e=>{this.searchQuery=e.target.value.trim();this.currentPage=1;this.load();},300));
    const form=document.getElementById('mnt-form');if(form)form.addEventListener('submit',async e=>{
        e.preventDefault();if(!Utils.validateForm(form))return;const btn=form.querySelector('button[type="submit"]');Utils.setBtnLoading(btn,true);
        const fd={user_id:App.currentUser.id,equipment_id:form.mnt_equipment.value||null,maintenance_date:form.mnt_date.value,type:form.mnt_type.value.trim(),description:form.mnt_desc.value.trim(),cost:parseFloat(form.mnt_cost.value)||0,performed_by:form.mnt_performed.value.trim(),next_maintenance:form.mnt_next.value||null,notes:form.mnt_notes.value.trim()};
        try{if(form.dataset.editId){const{error}=await db.from('equipment_maintenance').update(fd).eq('id',form.dataset.editId);if(error)throw error;Utils.toast('Updated');}else{const{error}=await db.from('equipment_maintenance').insert(fd);if(error)throw error;Utils.toast('Added');}Utils.closeModal('mnt-modal');this.load();}catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);delete form.dataset.editId;}
    });},
    edit(id){const m=this.data.find(x=>x.id===id);if(!m)return;const form=document.getElementById('mnt-form');if(!form)return;
    form.dataset.editId=id;form.mnt_equipment.value=m.equipment_id||'';form.mnt_date.value=m.maintenance_date||'';form.mnt_type.value=m.type||'';form.mnt_desc.value=m.description||'';
    form.mnt_cost.value=m.cost||0;form.mnt_performed.value=m.performed_by||'';form.mnt_next.value=m.next_maintenance||'';form.mnt_notes.value=m.notes||'';
    document.querySelector('#mnt-modal .modal-title').textContent='Edit Maintenance';Utils.openModal('mnt-modal');},
    confirmDelete(id){Utils.confirm('Delete this maintenance record?',async()=>{try{const{error}=await db.from('equipment_maintenance').delete().eq('id',id);if(error)throw error;Utils.toast('Deleted');this.load();}catch(err){Utils.toast(err.message||'Failed','error');}});}
};