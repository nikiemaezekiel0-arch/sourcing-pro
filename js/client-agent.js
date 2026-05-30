// --- Client Agent (Buying Agent) Logic ---

let cart = JSON.parse(localStorage.getItem('SourcingPro_Cart') || '[]');

function updateCartCount() {
    const el = document.getElementById('cart-count');
    if (el) el.textContent = cart.length;
}

function saveCart() {
    localStorage.setItem('SourcingPro_Cart', JSON.stringify(cart));
    updateCartCount();
}

function renderClientAgentProducts() {
    // Make sure we are on the catalog tab
    switchClientAgentTab('catalog');
    
    const db = getDB();
    const list = document.getElementById('client-agent-list');
    if (!list) return;

    list.innerHTML = '';
    
    if (!db.agent_products || db.agent_products.length === 0) {
        list.innerHTML = '<p class="text-muted" data-i18n="txt_no_products">Aucun produit disponible pour le moment.</p>';
        return;
    }

    db.agent_products.forEach(prod => {
        const sellingPriceCNY = prod.priceCNY * 1.10; // +10% commission
        
        const images = prod.images || (prod.image ? [prod.image] : []);
        const firstImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/250?text=No+Image';

        const card = document.createElement('div');
        card.className = 'glass-panel hover-grow cursor-pointer flex flex-col gap-2 relative';
        card.onclick = () => openAgentProductModal(prod.id);
        card.innerHTML = `
            <div style="position:relative; width:100%; height:250px; border-radius:8px; overflow:hidden; margin-bottom:10px;">
                <img src="${firstImage}" alt="Product" style="width:100%; height:100%; object-fit:cover;">
                ${images.length > 1 ? `<div style="position:absolute; bottom:8px; right:8px; background:rgba(0,0,0,0.7); color:white; padding:2px 8px; border-radius:12px; font-size:12px;"><span class="material-icons-round" style="font-size:12px; vertical-align:middle;">photo_library</span> ${images.length}</div>` : ''}
            </div>
            <div class="font-bold text-lg">${prod.name}</div>
            <div class="text-warning font-bold text-xl mb-2">${formatPrice(sellingPriceCNY)}</div>
            <div class="flex gap-2 text-xs text-muted mt-auto">
                <span>Couleurs: ${prod.colors.length || 0}</span> | 
                <span>Tailles: ${prod.sizes.length || 0}</span>
            </div>
            <button class="btn-primary w-full mt-2" data-i18n="btn_view_product">Voir le produit</button>
        `;
        list.appendChild(card);
    });
    
    // Apply translations if loaded
    if (typeof applyTranslations === 'function') applyTranslations();
}

function openAgentProductModal(id) {
    const db = getDB();
    const prod = db.agent_products.find(p => p.id === id);
    if (!prod) return;

    const sellingPriceCNY = prod.priceCNY * 1.10;

    let modal = document.getElementById('agent-product-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'agent-product-modal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
    }

    let colorsHtml = prod.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    let sizesHtml = prod.sizes.map(s => `<option value="${s}">${s}</option>`).join('');

    const images = prod.images || (prod.image ? [prod.image] : []);
    let carouselHtml = '';
    if (images.length > 1) {
        let slides = images.map(src => `<img src="${src}" style="width:100%; flex-shrink:0; object-fit:cover; border-radius:8px; scroll-snap-align:start;">`).join('');
        carouselHtml = `
            <div style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:10px; padding-bottom:10px; -webkit-overflow-scrolling:touch;">
                ${slides}
            </div>
            <div class="text-center text-xs text-muted">Faites glisser pour voir plus d'images ↔️</div>
        `;
    } else {
        const singleImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/400?text=No+Image';
        carouselHtml = `<img src="${singleImage}" style="width:100%; border-radius:8px;">`;
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <span class="close-btn material-icons-round" onclick="document.getElementById('agent-product-modal').classList.add('hidden')">close</span>
            <div class="flex flex-col md:flex-row gap-6">
                <div style="flex:1; min-width:0;">
                    ${carouselHtml}
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:15px;">
                    <h2 class="text-2xl font-bold">${prod.name}</h2>
                    <div class="text-warning font-bold text-3xl">${formatPrice(sellingPriceCNY)}</div>
                    <div class="text-muted text-xs" data-i18n="txt_price_calculated">Le prix inclut la commission (10%)</div>
                    
                    ${colorsHtml ? `
                    <div class="form-group">
                        <label data-i18n="lbl_color">Couleur</label>
                        <select id="modal-sel-color" class="input-field">${colorsHtml}</select>
                    </div>` : ''}
                    
                    ${sizesHtml ? `
                    <div class="form-group">
                        <label data-i18n="lbl_size">Taille</label>
                        <select id="modal-sel-size" class="input-field">${sizesHtml}</select>
                    </div>` : ''}
                    
                    <div class="form-group">
                        <label data-i18n="lbl_quantity">Quantité</label>
                        <input type="number" id="modal-sel-qty" class="input-field" value="1" min="1">
                    </div>

                    <button class="btn-primary mt-auto" onclick="addToCart('${prod.id}')">
                        <span class="material-icons-round">add_shopping_cart</span> Ajouter au Panier
                    </button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof applyTranslations === 'function') applyTranslations();
    modal.classList.remove('hidden');
}

function addToCart(productId) {
    const db = getDB();
    const prod = db.agent_products.find(p => p.id === productId);
    
    const colorEl = document.getElementById('modal-sel-color');
    const sizeEl = document.getElementById('modal-sel-size');
    const qtyEl = document.getElementById('modal-sel-qty');
    
    const item = {
        cartId: 'cart_' + Date.now(),
        productId: productId,
        name: prod.name,
        image: prod.images && prod.images.length > 0 ? prod.images[0] : (prod.image || 'https://via.placeholder.com/50'),
        priceCNY: prod.priceCNY * 1.10,
        color: colorEl ? colorEl.value : 'N/A',
        size: sizeEl ? sizeEl.value : 'N/A',
        qty: parseInt(qtyEl.value || 1)
    };
    
    cart.push(item);
    saveCart();
    document.getElementById('agent-product-modal').classList.add('hidden');
    showNotification("Produit ajouté au panier !", "success");
}

function openCartModal() {
    let modal = document.getElementById('cart-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cart-modal';
        modal.className = 'modal hidden';
        document.body.appendChild(modal);
    }

    let itemsHtml = '';
    let totalCNY = 0;

    cart.forEach(item => {
        const itemTotal = item.priceCNY * item.qty;
        totalCNY += itemTotal;
        itemsHtml += `
            <div class="flex items-center gap-4 mb-4 glass-panel" style="padding:10px;">
                <img src="${item.image}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">
                <div style="flex:1;">
                    <div class="font-bold text-sm">${item.name}</div>
                    <div class="text-xs text-muted">Couleur: ${item.color} | Taille: ${item.size} | Qty: ${item.qty}</div>
                    <div class="text-warning font-bold text-sm">${formatPrice(itemTotal)}</div>
                </div>
                <button class="btn-icon danger" onclick="removeFromCart('${item.cartId}')"><span class="material-icons-round">delete</span></button>
            </div>
        `;
    });

    if (cart.length === 0) {
        itemsHtml = '<p class="text-center text-muted py-8">Votre panier est vide.</p>';
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close-btn material-icons-round" onclick="document.getElementById('cart-modal').classList.add('hidden')">close</span>
            <h2 class="text-2xl font-bold mb-6" data-i18n="nav_cart">Mon Panier</h2>
            
            <div style="max-height:300px; overflow-y:auto; margin-bottom:20px;">
                ${itemsHtml}
            </div>
            
            ${cart.length > 0 ? `
            <div class="flex justify-between items-center mb-6 font-bold text-lg">
                <span data-i18n="txt_total">Total :</span>
                <span class="text-warning">${formatPrice(totalCNY)}</span>
            </div>
            <form onsubmit="checkout(event)">
                <h4 class="mb-2">Informations de livraison</h4>
                <input type="text" id="checkout-name" required placeholder="Votre Nom & Prénom" class="input-field mb-2" value="${getCurrentUser()?.name || ''}">
                <input type="text" id="checkout-phone" required placeholder="Numéro de Téléphone" class="input-field mb-2" value="${getCurrentUser()?.phone || ''}">
                <textarea id="checkout-address" required placeholder="Adresse complète de livraison" class="input-field mb-4" rows="3"></textarea>
                <button type="submit" class="btn-primary w-full">Valider la commande (Paiement manuel)</button>
            </form>
            ` : ''}
        </div>
    `;
    
    if (typeof applyTranslations === 'function') applyTranslations();
    modal.classList.remove('hidden');
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.cartId !== cartId);
    saveCart();
    openCartModal(); // Refresh
}

async function checkout(event) {
    event.preventDefault();
    const currentUser = getCurrentUser();
    
    for (const item of cart) {
        const order = {
            id: generateId('ord_'),
            productId: item.productId,
            clientName: document.getElementById('checkout-name').value,
            clientPhone: document.getElementById('checkout-phone').value,
            clientAddress: document.getElementById('checkout-address').value,
            clientId: currentUser ? currentUser.id : 'guest',
            quantity: item.qty,
            variantInfo: `Couleur: ${item.color}, Taille: ${item.size}`,
            totalPriceFormatted: formatPrice(item.priceCNY * item.qty), // Save the string as they saw it
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        await saveDoc('orders', order);
    }
    
    cart = [];
    saveCart();
    document.getElementById('cart-modal').classList.add('hidden');
    alert("Commande envoyée avec succès !");
    
    // Switch to Orders tab so client can see it
    switchClientAgentTab('orders');
}

function switchClientAgentTab(subtab) {
    const catalogView = document.getElementById('client-agent-subview-catalog');
    const ordersView = document.getElementById('client-agent-subview-orders');
    const btnCatalog = document.getElementById('btn-client-agent-catalog');
    const btnOrders = document.getElementById('btn-client-agent-orders');

    if (!catalogView || !ordersView) return;

    if (subtab === 'catalog') {
        catalogView.classList.remove('hidden');
        ordersView.classList.add('hidden');
        btnCatalog.className = 'btn-primary';
        btnOrders.className = 'btn-secondary';
        // renderClientAgentProducts is usually called by the main nav switch
    } else if (subtab === 'orders') {
        catalogView.classList.add('hidden');
        ordersView.classList.remove('hidden');
        btnCatalog.className = 'btn-secondary';
        btnOrders.className = 'btn-primary';
        renderClientOrders();
    }
}

function renderClientOrders() {
    const db = getDB();
    const currentUser = getCurrentUser();
    const list = document.getElementById('client-orders-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (!currentUser) {
        list.innerHTML = '<p class="text-muted text-center py-8">Veuillez vous connecter pour voir vos commandes.</p>';
        return;
    }

    // Filter orders belonging to this client
    const myOrders = (db.orders || []).filter(o => o.clientId === currentUser.id);
    
    if (myOrders.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8">
                <span class="material-icons-round text-muted" style="font-size: 48px; opacity:0.5;">receipt_long</span>
                <p class="text-muted mt-4">Vous n'avez pas encore passé de commande.</p>
                <button class="btn-primary mt-4" onclick="switchClientAgentTab('catalog')">Découvrir le catalogue</button>
            </div>
        `;
        return;
    }
    
    // Sort newest first
    myOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    myOrders.forEach(order => {
        const product = db.agent_products.find(p => p.id === order.productId) || { name: 'Produit Inconnu', images: ['https://via.placeholder.com/150'] };
        const image = product.images && product.images.length > 0 ? product.images[0] : (product.image || 'https://via.placeholder.com/150');
        
        let statusColor = 'text-warning';
        let statusText = 'En attente';
        let statusIcon = 'hourglass_empty';
        let progress = 25;
        
        if (order.status === 'ordered') { statusColor = 'text-primary'; statusText = 'Commandé'; statusIcon = 'shopping_bag'; progress = 50; }
        if (order.status === 'shipped') { statusColor = 'text-success'; statusText = 'Expédié'; statusIcon = 'local_shipping'; progress = 75; }
        if (order.status === 'delivered') { statusColor = 'text-muted'; statusText = 'Livré'; statusIcon = 'check_circle'; progress = 100; }

        const card = document.createElement('div');
        card.className = 'glass-panel mb-4';
        card.innerHTML = `
            <div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <div class="font-bold text-lg">Commande #${order.id.split('_')[1]}</div>
                <div class="text-xs text-muted">${new Date(order.createdAt).toLocaleDateString()}</div>
            </div>
            
            <div class="flex gap-4 items-center">
                <img src="${image}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;">
                <div style="flex:1;">
                    <div class="font-bold mb-1">${product.name}</div>
                    <div class="text-xs text-muted mb-2">${order.variantInfo} | Qté: ${order.quantity}</div>
                    <div class="font-bold text-warning">${order.totalPriceFormatted}</div>
                </div>
            </div>
            
            <!-- Progress Tracker -->
            <div class="mt-6">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-bold flex items-center gap-1 ${statusColor}">
                        <span class="material-icons-round" style="font-size:16px;">${statusIcon}</span> ${statusText}
                    </span>
                </div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                    <div style="width:${progress}%; height:100%; background:currentColor;" class="${statusColor} transition-all"></div>
                </div>
                <div class="flex justify-between text-[10px] text-muted mt-1">
                    <span>En attente</span>
                    <span>Acheté</span>
                    <span>Expédié</span>
                    <span>Livré</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

// Re-render when db updates or currency changes
window.addEventListener('db_updated', () => {
    const currentTab = document.querySelector('.nav-item.active');
    if (currentTab && currentTab.id === 'client-nav-agent') {
        const ordersView = document.getElementById('client-agent-subview-orders');
        if (ordersView && !ordersView.classList.contains('hidden')) {
            renderClientOrders();
        } else {
            renderClientAgentProducts();
        }
    }
});

window.addEventListener('currency_updated', () => {
    const currentTab = document.querySelector('.nav-item.active');
    if (currentTab && currentTab.id === 'client-nav-agent') {
        renderClientAgentProducts();
    }
    const cartModal = document.getElementById('cart-modal');
    if (cartModal && !cartModal.classList.contains('hidden')) {
        openCartModal();
    }
    const productModal = document.getElementById('agent-product-modal');
    if (productModal && !productModal.classList.contains('hidden')) {
        // If product modal is open, we can't easily guess which one. Closing it is safest.
        productModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', updateCartCount);
