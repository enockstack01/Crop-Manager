const Inventory = {
    data: [], farms: [], categories: ['Seeds','Fertilizers','Pesticides','Tools','Equipment','Packaging','Other'],
    currentPage: 1, perPage: 10, searchQuery: '', filterCategory: '', filterStatus: '',
    sortBy: 'name', sortOrder: 'asc',

    async init() {
        const [farmsRes] = await Promise.all([db.from('farms').select('id,name').eq('user_id', App.currentUser.id).order('name')]);
        this.farms = farmsRes.data || [];
        const pop = (id, items, vk, lk, ph) => { const s = document.getElementById(id); if(!s) return; s.innerHTML = `<option value="">${ph}</option>`; items.forEach(i => { s.innerHTML += `<option value="${i[vk]}">${Utils.escapeHtml(i[lk])}</option>`; }); };
        pop('inv-farm', this.farms, 'id', 'name', 'All Farms');
        pop('filter-inv-farm', this.farms, 'id', 'name', 'All Farms');
        pop('inv-category', this.categories.map(c=>({id:c,name:c})), 'id', 'name', 'All Categories');
        pop('filter-inv-category', this.categories.map(c=>({id:c,name:c})), 'id', 'name', 'All Categories');
        pop('inv-filter-status', [{id:'all',name:'All'},{id:'In Stock',name:'In Stock'},{id:'Low Stock',name:'Low Stock'},{id:'Out of Stock',name:'Out of Stock'}], 'id', 'name', 'All Statuses');
        pop('inv-status', [{id:'In Stock',name:'In Stock'},{id:'Low Stock',name:'Low Stock'},{id:'Out of Stock',name:'Out of Stock'}], 'id', 'name', 'Select Status');
        pop('inv-unit', [{id:'kg',name:'kg'},{id:'bags',name:'Bags (50kg)'},{id:'litres',name:'Litres'},{id:'tonnes',name:'Tonnes'},{id:'units',name:'Units'},{id:'packets',name:'Packets'}], 'id', 'name', 'Select Unit');
        await this.load(); this.bindEvents();
    },

    async load() {
        Utils.showLoading('inv-table-container');
        let q = db.from('inventory_items').select('*', {count:'exact'}).eq('user_id', App.currentUser.id).order(this.sortBy, {ascending:this.sortOrder==='asc'});
        if(this.searchQuery) q = q.or(`name.ilike.%${this.searchQuery}%,supplier.ilike.%${this.searchQuery}%,storage_location.ilike.%${this.searchQuery}%`);
        if(this.filterCategory) q = q.eq('category', this.filterCategory);
        if(this.filterStatus === 'In Stock') q = q.gt('current_quantity', 0);
        else if(this.filterStatus === 'Low Stock') q = q.lte('current_quantity', db.raw('inventory_items.minimum_stock * 1.5')).gt('current_quantity', 0);
        else if(this.filterStatus === 'Out of Stock') q = q.eq('current_quantity', 0);
        q = q.range((this.currentPage-1)*this.perPage, (this.currentPage-1)*this.perPage+this.perPage-1);
        const {data,error,count} = await q;
        if(error){console.error(error);Utils.hideLoading('inv-table-container',Utils.emptyState('fa-exclamation-triangle','Error','Could not load.'));return;}
        this.data=data||[]; this.totalCount=count||0; this.totalPages=Math.ceil(this.totalCount/this.perPage);
        this.render();
    },

    render() {
        const c=document.getElementById('inv-table-container'); if(!c) return;
        if(this.data.length===0){c.innerHTML=Utils.emptyState('fa-boxes','No Inventory Items','Add items to track your stock levels.','Add Item',"Utils.openModal('inv-modal')");return;}
        let h=`<div class="table-responsive"><table class="data-table"><thead><tr><th class="sortable" data-sort="name">Item <i class="fas fa-sort"></i></th><th>Category</th><th>Current Stock</th><th>Min Stock</th><th>Status</th><th>Unit Cost</th><th>Expiry</th><th>Actions</th></tr></thead><tbody>`;
        this.data.forEach(i=>{
            const status = i.current_quantity<=0?'Out of Stock':i.current_quantity<=i.minimum_stock*1.5?'Low Stock':'In Stock';
            const expiringSoon = i.expiry_date && new Date(i.expiry_date)<=new Date(Date.now()+30*86400000);
            h+=`<tr>
                <td><strong>${Utils.escapeHtml(i.name)}</strong></td>
                <td><span class="badge badge-primary">${Utils.escapeHtml(i.category)}</span></td>
                <td><strong>${Utils.formatNumber(i.current_quantity)}</strong></td>
                <td>${Utils.formatNumber(i.minimum_stock)}</td>
                <td>${Utils.statusBadge(status)}</td>
                <td>${i.unit_cost?Utils.formatCurrency(i.unit_cost):'—'}</td>
                <td>${i.expiry_date?`<span style="color:${expiringSoon?'var(--orange)':'inherit'}">${Utils.formatDate(i.expiry_date)}</span>`:'—'}</td>
                <td class="table-actions">
                    <button class="btn-icon" title="Stock In" onclick="Inventory.stockModal('${i.id}','in')"><i class="fas fa-arrow-up" style="color:var(--green);"></i></button>
                    <button class="btn-icon" title="Stock Out" onclick="Inventory.stockModal('${i.id}','out')"><i class="fas fa-arrow-down" style="color:var(--red);"></i></button>
                    <button class="btn-icon" title="Edit" onclick="Inventory.edit('${i.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Delete" onclick="Inventory.confirmDelete('${i.id}','${Utils.escapeHtml(i.name)}')"><i class="fas fa-trash"></i></button>
                </td></tr>`;
        });
        h+='</tbody></table></div>'; c.innerHTML=h;
        Utils.renderPagination('inv-pagination',this.currentPage,this.totalPages,p=>{this.currentPage=p;this.load();});
        c.querySelectorAll('.sortable').forEach(th=>{th.addEventListener('click',()=>{const col=th.dataset.sort;this.sortBy=col;this.sortOrder=this.sortBy===col&&this.sortOrder==='asc'?'desc':'asc';this.currentPage=1;this.load();});});
    },

    bindEvents() {
        document.getElementById('inv-search')?.addEventListener('input',Utils.debounce(e=>{this.searchQuery=e.target.value.trim();this.currentPage=1;this.load();},300));
        document.getElementById('filter-inv-farm')?.addEventListener('change',e=>{this.filterFarm=e.target.value;this.currentPage=1;this.load();});
        document.getElementById('filter-inv-category')?.addEventListener('change',e=>{this.filterCategory=e.target.value;this.currentPage=1;this.load();});
        document.getElementById('inv-filter-status')?.addEventListener('change',e=>{this.filterStatus=e.target.value;this.currentPage=1;this.load();});
        const form=document.getElementById('inv-form');
        if(form) form.addEventListener('submit',async e=>{
            e.preventDefault(); if(!Utils.validateForm(form))return;
            const btn=form.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn,true);
            const fd={user_id:App.currentUser.id,name:form.inv_name.value.trim(),category:form.inv_category.value,unit:form.inv_unit.value,current_quantity:parseFloat(form.inv_qty.value)||0,minimum_stock:parseFloat(form.inv_min.value)||0,unit_cost:parseFloat(form.inv_cost.value)||0,supplier:form.inv_supplier.value.trim(),expiry_date:form.inv_expiry.value||null,storage_location:form.inv_storage.value.trim(),notes:form.inv_notes.value.trim()};
            try{if(form.dataset.editId){const{error}=await db.from('inventory_items').update(fd).eq('id',form.dataset.editId);if(error)throw error;Utils.toast('Updated');}else{const{error}=await db.from('inventory_items').insert(fd);if(error)throw error;Utils.toast('Added');}Utils.closeModal('inv-modal');this.load();}catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);delete form.dataset.editId;}
        });
        // Stock modal
        document.getElementById('stock-form')?.addEventListener('submit',async e=>{
            e.preventDefault(); if(!Utils.validateForm(e.target))return;
            const btn=e.target.querySelector('button[type="submit"]'); Utils.setBtnLoading(btn,true);
            const id=e.target.stock_id.value, type=e.target.stock_type.value, qty=parseFloat(e.target.stock_qty.value)||0;
            try{
                const item=this.data.find(i=>i.id===id);if(!item)throw new Error('Item not found');
                const prev=item.current_quantity; const newVal=type==='in'?prev+qty:Math.max(0,prev-qty);
                await db.from('inventory_items').update({current_quantity:newVal}).eq('id',id);
                await db.from('inventory_transactions').insert({user_id:App.currentUser.id,item_id:id,transaction_type:type==='in'?'Stock In':'Stock Out',quantity:qty,previous_quantity:prev,new_quantity:newVal,notes:e.target.stock_notes.value.trim()});
                Utils.closeModal('stock-modal');Utils.toast(`${type==='in'?'Added':'Removed'} ${qty} ${item.unit}`);this.load();
            }catch(err){console.error(err);Utils.toast(err.message||'Failed','error');}finally{Utils.setBtnLoading(btn,false);e.target.reset();}
        });
    },

    stockModal(id, type) {
        const item=this.data.find(i=>i.id===id);if(!item)return;
        const form=document.getElementById('stock-form');if(!form)return;
        form.stock_id.value=id; form.stock_type.value=type;
        document.querySelector('#stock-modal .modal-title').textContent=type==='in'?'Stock In':'Stock Out';
        Utils.openModal('stock-modal');
    },

    edit(id) {
        const i=this.data.find(x=>x.id===id);if(!i)return;
        const form=document.getElementById('inv-form');if(!form)return;
        form.dataset.editId=id;
        form.inv_name.value=i.name||'';form.inv_category.value=i.category||'';form.inv_unit.value=i.unit||'';
        form.inv_qty.value=i.current_quantity||0;form.inv_min.value=i.minimum_stock||0;
        form.inv_cost.value=i.unit_cost||0;form.inv_supplier.value=i.supplier||'';
        form.inv_expiry.value=i.expiry_date||'';form.inv_storage.value=i.storage_location||'';
        form.inv_notes.value=i.notes||'';
        document.querySelector('#inv-modal .modal-title').textContent='Edit Item';
        Utils.openModal('inv-modal');
    },

    confirmDelete(id,name) {
        Utils.confirm(`Delete <strong>"${name}"</strong>?`,async()=>{
            try{const{error}=await db.from('inventory_items').delete().eq('id',id);if(error)throw error;Utils.toast('Deleted');this.load();}catch(err){Utils.toast(err.message||'Failed','error');}
        });
    }
};