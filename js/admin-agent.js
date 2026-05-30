// --- Admin Agent (Buying Agent) Management ---

let pendingAgentImages = [];

async function previewAgentImages(input) {
    const previewContainer = document.getElementById('agent-images-preview');
    previewContainer.innerHTML = '';
    pendingAgentImages = [];

    if (!input.files || input.files.length === 0) return;

    for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        if (!file.type.startsWith('image/')) continue;

        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to 60% quality JPEG
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                pendingAgentImages.push(compressedDataUrl);

                // Add to preview UI
                const wrapper = document.createElement('div');
                wrapper.style = "position:relative; min-width:80px; height:80px; border-radius:8px; overflow:hidden;";
                wrapper.innerHTML = `
                    <img src="${compressedDataUrl}" style="width:100%; height:100%; object-fit:cover;">
                    <div style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.5); color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer;" onclick="this.parentElement.remove(); pendingAgentImages.splice(${pendingAgentImages.length - 1}, 1)">✕</div>
                `;
                previewContainer.appendChild(wrapper);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function addAgentProduct(event) {
    event.preventDefault();
    const link = document.getElementById('agent-prod-link').value;
    const name = document.getElementById('agent-prod-name').value;
    const priceCNY = parseFloat(document.getElementById('agent-prod-price').value);
    
    if (pendingAgentImages.length === 0) {
        alert("Veuillez sélectionner au moins une image pour le produit.");
        return;
    }
    
    // Convert comma-separated string to arrays
    const colorsInput = document.getElementById('agent-prod-colors').value;
    const sizesInput = document.getElementById('agent-prod-sizes').value;
    
    const colors = colorsInput ? colorsInput.split(',').map(s => s.trim()).filter(s => s) : [];
    const sizes = sizesInput ? sizesInput.split(',').map(s => s.trim()).filter(s => s) : [];

    const newProduct = {
        id: generateId('prod_'),
        link: link,
        name: name,
        images: pendingAgentImages, // Array of base64 images
        priceCNY: priceCNY,
        colors: colors,
        sizes: sizes,
        // The price displayed to the client will be calculated dynamically on the frontend (+10%)
        createdAt: new Date().toISOString()
    };

    try {
        await saveDoc('agent_products', newProduct);
        document.getElementById('admin-agent-form').reset();
        document.getElementById('agent-images-preview').innerHTML = '';
        pendingAgentImages = [];
        showNotification("Produit ajouté au catalogue avec succès !", "success");
        renderAdminAgentProducts();
    } catch (e) {
        showNotification("Erreur lors de l'ajout du produit", "error");
    }
}

async function deleteAgentProduct(id) {
    if(!confirm("Supprimer ce produit du catalogue ?")) return;
    await deleteDoc('agent_products', id);
    renderAdminAgentProducts();
}

function renderAdminAgentProducts() {
    const db = getDB();
    const list = document.getElementById('admin-agent-list');
    if (!list) return;

    list.innerHTML = '';
    
    if (!db.agent_products || db.agent_products.length === 0) {
        list.innerHTML = '<p class="text-muted">Aucun produit dans le catalogue Agent.</p>';
        return;
    }

    db.agent_products.forEach(prod => {
        // Calculate the selling price (+10% commission)
        const sellingPriceCNY = prod.priceCNY * 1.10;
        
        // Handle backwards compatibility for single image
        const images = prod.images || (prod.image ? [prod.image] : []);
        const firstImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/150?text=No+Image';
        const imageCountBadge = images.length > 1 ? `<div style="position:absolute; top:8px; right:8px; background:var(--accent-gold); color:black; padding:2px 8px; border-radius:12px; font-weight:bold; font-size:12px;">+${images.length - 1} photo(s)</div>` : '';
        
        const card = document.createElement('div');
        card.className = 'glass-panel flex flex-col gap-2 relative';
        card.innerHTML = `
            <div style="position:relative; width:100%; height:200px; border-radius:8px; overflow:hidden; margin-bottom:10px;">
                <img src="${firstImage}" alt="Product" style="width:100%; height:100%; object-fit:cover;">
                ${imageCountBadge}
            </div>
            <div class="font-bold">${prod.name}</div>
            <div class="text-sm text-muted">Prix d'achat: ${prod.priceCNY} ¥</div>
            <div class="text-sm text-warning font-bold mb-2">Prix Client (+10%): ${sellingPriceCNY.toFixed(2)} ¥</div>
            <div class="flex gap-2 text-xs text-muted mb-2">
                <span>Couleurs: ${prod.colors.length || 0}</span> | 
                <span>Tailles: ${prod.sizes.length || 0}</span>
            </div>
            <div class="flex gap-2 mt-auto">
                <a href="${prod.link}" target="_blank" class="btn-secondary" style="flex:1; padding:0.5rem; text-align:center;"><span class="material-icons-round" style="font-size:16px;">link</span> Lien</a>
                <button class="btn-icon danger" onclick="deleteAgentProduct('${prod.id}')"><span class="material-icons-round">delete_outline</span></button>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- Admin Orders Management ---

function renderAdminOrders() {
    const db = getDB();
    const list = document.getElementById('admin-orders-list');
    if (!list) return;

    list.innerHTML = '';

    if (!db.orders || db.orders.length === 0) {
        list.innerHTML = '<p class="text-muted">Aucune commande pour le moment.</p>';
        return;
    }

    // Sort by newest first
    const sortedOrders = [...db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sortedOrders.forEach(order => {
        const product = db.agent_products.find(p => p.id === order.productId) || { name: 'Produit Inconnu', link: '#' };
        
        let statusColor = 'text-warning';
        let statusText = 'En attente';
        if (order.status === 'ordered') { statusColor = 'text-primary'; statusText = 'Commandé'; }
        if (order.status === 'shipped') { statusColor = 'text-success'; statusText = 'Expédié'; }
        if (order.status === 'delivered') { statusColor = 'text-muted'; statusText = 'Livré'; }

        const card = document.createElement('div');
        card.className = 'glass-panel mb-4';
        card.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div class="font-bold text-lg">Commande #${order.id.split('_')[1]}</div>
                <div class="font-bold ${statusColor}">${statusText}</div>
            </div>
            <div class="mb-2 text-sm">
                <strong>Client:</strong> ${order.clientName} (${order.clientPhone || 'Pas de tél'})<br>
                <strong>Adresse:</strong> ${order.clientAddress}<br>
                <strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}
            </div>
            <div class="glass-panel" style="background: rgba(0,0,0,0.1); padding: 1rem; border: none; margin: 1rem 0;">
                <div class="font-bold text-primary mb-1">${product.name}</div>
                <div class="text-sm">Variante: ${order.variantInfo}</div>
                <div class="text-sm">Quantité: ${order.quantity}</div>
                <div class="font-bold text-warning mt-2">Total Payé/Dû: ${order.totalPriceFormatted}</div>
                <a href="${product.link}" target="_blank" class="text-xs text-primary underline mt-2 inline-block">🔗 Voir sur le site fournisseur (pour l'acheter)</a>
            </div>
            <div class="flex gap-2 mt-4 items-center flex-wrap">
                <label class="text-sm text-muted">Changer le statut :</label>
                <select class="input-field" style="width: auto; padding: 0.2rem 0.5rem;" onchange="updateOrderStatus('${order.id}', this.value)">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>⏳ En attente</option>
                    <option value="ordered" ${order.status === 'ordered' ? 'selected' : ''}>🛒 Commandé (Acheté)</option>
                    <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>🚚 Expédié</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>✅ Livré</option>
                </select>
                <button class="btn-icon danger ml-auto" onclick="deleteOrder('${order.id}')"><span class="material-icons-round">delete_outline</span></button>
            </div>
        `;
        list.appendChild(card);
    });
}

async function updateOrderStatus(orderId, newStatus) {
    const db = getDB();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return;
    
    order.status = newStatus;
    await saveDoc('orders', order);
    showNotification("Statut mis à jour", "success");
    renderAdminOrders();
}

async function deleteOrder(id) {
    if(!confirm("Supprimer définitivement cette commande ?")) return;
    await deleteDoc('orders', id);
    renderAdminOrders();
}

// Re-render when db updates
window.addEventListener('db_updated', () => {
    const currentTab = document.querySelector('.nav-item.active');
    if (currentTab && currentTab.id === 'admin-nav-agent') {
        const ordersView = document.getElementById('admin-agent-subview-orders');
        if (ordersView && !ordersView.classList.contains('hidden')) {
            renderAdminOrders();
        } else {
            renderAdminAgentProducts();
        }
    }
});
