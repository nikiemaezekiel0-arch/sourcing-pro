const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

// Modify switchAdminBoutiqueTab to include orders
code = code.replace(
    /document.getElementById\('admin-boutique-subview-products'\).classList.add\('hidden'\);/g,
    `document.getElementById('admin-boutique-subview-products').classList.add('hidden');
    document.getElementById('admin-boutique-subview-orders').classList.add('hidden');
    const btnOrders = document.getElementById('btn-admin-boutique-orders');
    if(btnOrders) btnOrders.className = 'btn-secondary';`
);

code = code.replace(
    /if \(tab === 'categories'\) renderAdminBoutiqueCategories\(\);/g,
    `if (tab === 'categories') renderAdminBoutiqueCategories();
    if (tab === 'orders') renderAdminBoutiqueOrders();`
);

code = code.replace(
    /switchAdminBoutiqueTab\('products'\);/g,
    `switchAdminBoutiqueTab('orders');`
);

const newCode = `
// ==========================================
// BOUTIQUE ORDERS LOGIC (ADMIN)
// ==========================================

function renderAdminBoutiqueOrders() {
    const db = getDB();
    const list = document.getElementById('admin-boutique-orders-list');
    list.innerHTML = '';
    
    if(!db.boutique_orders || db.boutique_orders.length === 0) {
        list.innerHTML = '<p class="text-muted">Aucune commande pour le moment.</p>';
        return;
    }
    
    // Sort by date desc
    const sortedOrders = [...db.boutique_orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    let htmlStr = '';
    sortedOrders.forEach(order => {
        const dateStr = new Date(order.createdAt).toLocaleString('fr-FR');
        
        let statusBadge = '';
        if(order.status === 'pending') statusBadge = '<span class="badge" style="background: var(--warning); color: #000;">En attente</span>';
        else if(order.status === 'processing') statusBadge = '<span class="badge" style="background: var(--primary);">En traitement</span>';
        else if(order.status === 'shipped') statusBadge = '<span class="badge" style="background: var(--accent-gold); color: #000;">Expédiée</span>';
        else if(order.status === 'delivered') statusBadge = '<span class="badge" style="background: var(--success); color: #000;">Livrée</span>';
        else if(order.status === 'cancelled') statusBadge = '<span class="badge" style="background: var(--danger);">Annulée</span>';
        
        let itemsHtml = '<ul style="margin: 10px 0; padding-left: 20px; color: var(--text-light); font-size: 0.9rem;">';
        order.items.forEach(item => {
            itemsHtml += \`<li>\${item.quantity}x \${item.title} (\${item.price})</li>\`;
        });
        itemsHtml += '</ul>';
        
        htmlStr += \`
        <div class="glass-panel" style="padding: 1.5rem; border-left: 4px solid \${order.status === 'pending' ? 'var(--warning)' : 'var(--glass-border)'};">
            <div class="flex justify-between items-start mb-4" style="flex-wrap: wrap; gap: 10px;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">Commande \${order.id.replace('bord_', '#')}</h4>
                    <p class="text-muted text-sm m-0">\${dateStr}</p>
                </div>
                <div>\${statusBadge}</div>
            </div>
            
            <div class="grid-layout" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <strong class="text-warning text-sm">Client :</strong><br>
                    \${order.customerName}<br>
                    📞 \${order.customerPhone}<br>
                    📍 \${order.customerAddress}
                </div>
                <div>
                    <strong class="text-warning text-sm">Notes :</strong><br>
                    \${order.notes || '<span class="text-muted">Aucune note</span>'}
                </div>
            </div>
            
            <strong class="text-warning text-sm">Produits :</strong>
            \${itemsHtml}
            
            <div class="flex justify-between items-center mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 1.3rem; font-weight: 900; color: var(--accent-gold);">Total: \${order.total}</div>
                
                <div class="flex gap-2">
                    <select class="input-field" style="padding: 0.4rem; max-width: 150px;" onchange="updateBoutiqueOrderStatus('\${order.id}', this.value)">
                        <option value="pending" \${order.status === 'pending' ? 'selected' : ''}>En attente</option>
                        <option value="processing" \${order.status === 'processing' ? 'selected' : ''}>En traitement</option>
                        <option value="shipped" \${order.status === 'shipped' ? 'selected' : ''}>Expédiée</option>
                        <option value="delivered" \${order.status === 'delivered' ? 'selected' : ''}>Livrée</option>
                        <option value="cancelled" \${order.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                    </select>
                    <button class="btn-danger" style="padding: 0.4rem 0.8rem;" onclick="deleteBoutiqueOrder('\${order.id}')"><span class="material-icons-round" style="font-size: 18px;">delete</span></button>
                </div>
            </div>
        </div>
        \`;
    });
    
    list.innerHTML = htmlStr;
}

async function updateBoutiqueOrderStatus(orderId, newStatus) {
    const db = getDB();
    const order = db.boutique_orders.find(o => o.id === orderId);
    if(!order) return;
    
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    
    try {
        await saveDoc('boutique_orders', order);
        renderAdminBoutiqueOrders();
        showNotification("Statut de la commande mis à jour", "success");
    } catch(err) {
        console.error(err);
        alert("Erreur lors de la mise à jour : " + err.message);
    }
}

async function deleteBoutiqueOrder(orderId) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer définitivement cette commande ?")) return;
    
    try {
        await deleteDoc('boutique_orders', orderId);
        renderAdminBoutiqueOrders();
        showNotification("Commande supprimée", "success");
    } catch(err) {
        console.error(err);
        alert("Erreur lors de la suppression : " + err.message);
    }
}
`;

fs.writeFileSync('js/admin.js', code + "\n" + newCode);
console.log("Appended Admin Orders Logic");
