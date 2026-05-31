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

    let colorsHtml = prod.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    let sizesHtml = prod.sizes.map(s => `<option value="${s}">${s}</option>`).join('');

    const images = prod.images || (prod.image ? [prod.image] : []);
    let carouselHtml = '';
    if (images.length > 1) {
        let slides = images.map(src => `<img src="${src}" style="width:100%; flex-shrink:0; object-fit:cover; border-radius:12px; scroll-snap-align:start;">`).join('');
        carouselHtml = `
            <div style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:10px; padding-bottom:10px; -webkit-overflow-scrolling:touch;">
                ${slides}
            </div>
            <div class="text-center text-xs text-muted mt-2">Faites glisser pour voir plus d'images ↔️</div>
        `;
    } else {
        const singleImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/400?text=No+Image';
        carouselHtml = `<img src="${singleImage}" style="width:100%; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.2);">`;
    }

    const detailContainer = document.getElementById('product-detail-content');
    detailContainer.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <div style="flex:1.2; min-width:0;">
                ${carouselHtml}
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:20px;">
                <h2 class="text-3xl font-bold text-white m-0">${prod.name}</h2>
                <div class="text-warning font-bold text-4xl">${formatPrice(sellingPriceCNY)}</div>
                <div class="text-muted text-sm" data-i18n="txt_price_calculated">Le prix inclut la commission SourcingPro (10%)</div>
                
                <div class="glass-panel" style="padding:1.5rem; background:rgba(255,255,255,0.02); margin-top:10px;">
                    ${colorsHtml ? `
                    <div class="form-group mb-4">
                        <label class="text-white" data-i18n="lbl_color">Couleur choisie</label>
                        <select id="modal-sel-color" class="input-field" style="background:rgba(0,0,0,0.5); color:white;">${colorsHtml}</select>
                    </div>` : ''}
                    
                    ${sizesHtml ? `
                    <div class="form-group mb-4">
                        <label class="text-white" data-i18n="lbl_size">Taille choisie</label>
                        <select id="modal-sel-size" class="input-field" style="background:rgba(0,0,0,0.5); color:white;">${sizesHtml}</select>
                    </div>` : ''}
                    
                    <div class="form-group mb-6">
                        <label class="text-white" data-i18n="lbl_quantity">Quantité souhaitée</label>
                        <input type="number" id="modal-sel-qty" class="input-field" value="1" min="1" style="background:rgba(0,0,0,0.5); color:white;">
                    </div>

                    <button class="btn-primary w-full" style="padding:1rem; font-size:1.1rem; justify-content:center;" onclick="addToCart('${prod.id}')">
                        <span class="material-icons-round">add_shopping_cart</span> Ajouter au Panier
                    </button>
                </div>
                
                <div class="mt-4">
                    <h4 class="text-white mb-2">À propos de cet article</h4>
                    <ul style="padding-left:1.5rem; color:#94a3b8; line-height:1.6; list-style-type:disc;">
                        <li>Vérifié par nos agents SourcingPro</li>
                        <li>Possibilité d'achat groupé avec vos autres commandes</li>
                        <li>Contrôle qualité inclus avant expédition</li>
                    </ul>
                </div>
                <div class="mt-6 glass-panel" style="padding:1.5rem; background:rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.3);">
                    <h4 class="text-white mb-2 flex items-center gap-2"><span class="material-icons-round" style="color:#10b981;">insights</span> Calculateur de Rentabilité</h4>
                    <p class="text-xs text-muted mb-4">Estimez votre marge nette en indiquant votre prix de revente. (Inclut la com. et 15% d'estimation de port).</p>
                    <div class="form-group mb-4">
                        <label class="text-white">Prix de revente espéré (<span id="calc-currency-symbol"></span>)</label>
                        <input type="number" id="calc-resale-price" class="input-field" placeholder="Ex: 50" style="background:rgba(0,0,0,0.5); color:white;">
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-white">Marge nette estimée :</span>
                        <span id="calc-profit-result" class="font-bold text-2xl text-muted">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Initialize Profitability Calculator
    const calcInput = document.getElementById('calc-resale-price');
    const calcResult = document.getElementById('calc-profit-result');
    const calcSymbol = document.getElementById('calc-currency-symbol');
    
    const symbols = { CNY: '¥', EUR: '€', USD: '$', XOF: 'FCFA' };
    const sym = typeof currentCurrency !== 'undefined' ? (symbols[currentCurrency] || '€') : '€';
    if(calcSymbol) calcSymbol.textContent = sym;
    
    if(calcInput && calcResult) {
        calcInput.addEventListener('input', (e) => {
            const resale = parseFloat(e.target.value);
            if(isNaN(resale) || resale <= 0) {
                calcResult.textContent = '--';
                calcResult.className = 'font-bold text-2xl text-muted';
                return;
            }
            
            // Total cost CNY = Purchase price + 10% agent + 15% shipping estimate
            const costCNY = prod.priceCNY * 1.10 * 1.15;
            let costConverted = 0;
            if(typeof convertPrice === 'function') {
                costConverted = parseFloat(convertPrice(costCNY));
            } else {
                costConverted = costCNY * 0.13;
            }
            
            const profit = resale - costConverted;
            const formattedProfit = typeof currentCurrency !== 'undefined' && currentCurrency === 'XOF' 
                ? Math.round(profit).toLocaleString('fr-FR') 
                : profit.toFixed(2);
                
            if(profit > 0) {
                calcResult.textContent = '+' + formattedProfit + ' ' + sym;
                calcResult.className = 'font-bold text-2xl text-success';
            } else {
                calcResult.textContent = formattedProfit + ' ' + sym;
                calcResult.className = 'font-bold text-2xl text-danger';
            }
        });
    }
    
    // Update cart count specifically in the detail view
    const detailCartCount = document.getElementById('detail-cart-count');
    if (detailCartCount) detailCartCount.textContent = cart.length;
    
    if (typeof applyTranslations === 'function') applyTranslations();
    
    // Hide catalog and show detail page
    document.getElementById('client-agent-subview-catalog').classList.add('hidden');
    document.getElementById('client-agent-subview-orders').classList.add('hidden');
    // Hide the tab buttons header from the catalog view to make it a true "page"
    document.querySelector('#client-view-agent > .flex.gap-4.mb-6').classList.add('hidden');
    document.querySelector('#client-view-agent > .flex.justify-between.items-center.mb-6').classList.add('hidden');
    
    document.getElementById('client-product-detail-view').classList.remove('hidden');
    
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function closeProductDetailView() {
    document.getElementById('client-product-detail-view').classList.add('hidden');
    
    // Restore catalog UI
    document.querySelector('#client-view-agent > .flex.gap-4.mb-6').classList.remove('hidden');
    document.querySelector('#client-view-agent > .flex.justify-between.items-center.mb-6').classList.remove('hidden');
    document.getElementById('client-agent-subview-catalog').classList.remove('hidden');
    
    window.scrollTo({top: 0, behavior: 'smooth'});
}


function addToCart(productId) {
    if(window.triggerHaptic) window.triggerHaptic();
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
    
    // Update local cart count
    const detailCartCount = document.getElementById('detail-cart-count');
    if (detailCartCount) detailCartCount.textContent = cart.length;
    
    showNotification("Produit ajouté au panier !", "success");
}

function openCartView() {
    if(window.triggerHaptic) window.triggerHaptic();
    
    // Hide other views
    ['suppliers', 'trainings', 'agent'].forEach(t => {
        const v = document.getElementById(`client-view-${t}`);
        if(v) v.classList.add('hidden');
    });
    const detailView = document.getElementById('client-product-detail-view');
    if(detailView) detailView.classList.add('hidden');
    
    const cartContainer = document.getElementById('cart-view-content');
    if(!cartContainer) return;

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

    cartContainer.innerHTML = `
        <h2 class="text-2xl font-bold mb-6" data-i18n="nav_cart">Mon Panier</h2>
        
        <div style="max-height:400px; overflow-y:auto; margin-bottom:20px;">
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
            
            <div class="flex flex-col gap-2">
                <button type="submit" class="btn-primary w-full justify-center">Valider la commande (Paiement manuel)</button>
                <button type="button" class="btn-secondary w-full justify-center flex items-center gap-2" onclick="generateCartPDF()">
                    <span class="material-icons-round">picture_as_pdf</span> Télécharger le Devis / Bon de Commande
                </button>
            </div>
        </form>
        ` : ''}
    `;
    
    if (typeof applyTranslations === 'function') applyTranslations();
    document.getElementById('client-cart-view').classList.remove('hidden');
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function closeCartView() {
    document.getElementById('client-cart-view').classList.add('hidden');
    // Return to agent view by default
    document.getElementById('client-view-agent').classList.remove('hidden');
    switchClientAgentTab('catalog');
}

function removeFromCart(cartId) {
    if(window.triggerHaptic) window.triggerHaptic();
    cart = cart.filter(i => i.cartId !== cartId);
    saveCart();
    openCartView(); // Refresh
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
    const cartView = document.getElementById('client-cart-view');
    if (cartView && !cartView.classList.contains('hidden')) {
        openCartView();
    }
    const productModal = document.getElementById('agent-product-modal');
    if (productModal && !productModal.classList.contains('hidden')) {
        // If product modal is open, we can't easily guess which one. Closing it is safest.
        productModal.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', updateCartCount);

function generateCartPDF() {
    if(window.triggerHaptic) window.triggerHaptic();
    if(cart.length === 0) {
        showNotification("Votre panier est vide.", "danger");
        return;
    }
    
    showNotification("Génération du PDF en cours...", "success");
    
    const invoiceDiv = document.createElement('div');
    invoiceDiv.style.padding = '40px';
    invoiceDiv.style.fontFamily = 'Arial, sans-serif';
    invoiceDiv.style.color = '#333';
    invoiceDiv.style.backgroundColor = '#fff';
    invoiceDiv.style.position = 'absolute';
    invoiceDiv.style.left = '-9999px';
    invoiceDiv.style.top = '-9999px';
    
    const user = getCurrentUser();
    const date = new Date().toLocaleDateString('fr-FR');
    
    let totalCNY = 0;
    let itemsHtml = '';
    
    cart.forEach((item, i) => {
        const lineTotal = item.priceCNY * item.qty;
        totalCNY += lineTotal;
        itemsHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px 8px;">${i+1}</td>
                <td style="padding: 12px 8px;"><strong>${item.name}</strong><br><small style="color:#666;">Coul: ${item.color} | Taille: ${item.size}</small></td>
                <td style="padding: 12px 8px; text-align:center;">${item.qty}</td>
                <td style="padding: 12px 8px; text-align:right;">${formatPrice(lineTotal)}</td>
            </tr>
        `;
    });

    invoiceDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom:2px solid #FBBF24; padding-bottom:20px;">
            <div>
                <h1 style="color:#000; margin:0; font-size:28px;">SOURCING<span style="color:#FBBF24;">PRO</span></h1>
                <p style="color:#666; margin:5px 0 0 0; font-size:14px;">Votre partenaire d'importation B2B</p>
            </div>
            <div style="text-align:right;">
                <h2 style="margin:0; color:#333;">DEVIS / BON DE COMMANDE</h2>
                <p style="margin:5px 0 0 0; color:#666;">Date : ${date}</p>
            </div>
        </div>
        
        <div style="margin-bottom:40px;">
            <h3 style="margin:0 0 10px 0; color:#333; border-bottom:1px solid #eee; padding-bottom:5px;">Informations Client</h3>
            <p style="margin:0; font-size:14px; line-height:1.6;">
                <strong>Nom :</strong> ${user?.name || 'Client'}<br>
                <strong>Email :</strong> ${user?.email || 'N/A'}<br>
                <strong>Téléphone :</strong> ${user?.phone || 'N/A'}
            </p>
        </div>
        
        <table style="width:100%; border-collapse:collapse; margin-bottom:40px;">
            <thead>
                <tr style="background-color:#f8f9fa;">
                    <th style="padding:12px 8px; text-align:left; border-bottom:2px solid #ddd;">#</th>
                    <th style="padding:12px 8px; text-align:left; border-bottom:2px solid #ddd;">Description du produit</th>
                    <th style="padding:12px 8px; text-align:center; border-bottom:2px solid #ddd;">Quantité</th>
                    <th style="padding:12px 8px; text-align:right; border-bottom:2px solid #ddd;">Sous-total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>
        
        <div style="display:flex; justify-content:flex-end;">
            <div style="width:300px; background:#f8f9fa; padding:20px; border-radius:8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <strong style="color:#333;">Total (Articles) :</strong>
                    <span style="color:#333;">${formatPrice(totalCNY)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; color:#666;">
                    <span>Frais de port :</span>
                    <span>Sur devis final</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-top:1px solid #ddd; padding-top:10px; margin-top:10px;">
                    <strong style="color:#000; font-size:18px;">TOTAL ESTIMÉ :</strong>
                    <strong style="color:#FBBF24; font-size:18px;">${formatPrice(totalCNY)}</strong>
                </div>
            </div>
        </div>
        
        <div style="margin-top:60px; text-align:center; color:#666; font-size:12px; border-top:1px solid #eee; padding-top:20px;">
            <p>Document généré automatiquement par SourcingPro App.<br>Veuillez transférer ce document à votre agent pour validation finale des frais d'expédition.</p>
        </div>
    `;

    document.body.appendChild(invoiceDiv);
    
    const opt = {
        margin:       1,
        filename:     'Devis_SourcingPro.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    if(typeof html2pdf !== 'undefined') {
        html2pdf().set(opt).from(invoiceDiv).save().then(() => {
            if(document.body.contains(invoiceDiv)) document.body.removeChild(invoiceDiv);
        }).catch(err => {
            console.error('PDF Generation error:', err);
            showNotification("Erreur lors de la génération du PDF", "danger");
            if(document.body.contains(invoiceDiv)) document.body.removeChild(invoiceDiv);
        });
    } else {
        showNotification("L'outil PDF n'est pas encore chargé.", "danger");
        if(document.body.contains(invoiceDiv)) document.body.removeChild(invoiceDiv);
    }
}
