const fs = require('fs');
let code = fs.readFileSync('js/client.js', 'utf8');

// Replace WhatsApp button in the modal detail with 'Ajouter au panier'
code = code.replace(
    /<a href="https:\/\/wa.me.*Commander sur WhatsApp\s*<\/a>/s,
    `<button class="btn-primary w-full" style="justify-content: center; padding: 1rem; font-size: 1.1rem; gap: 10px; background: var(--accent-gold); color: black;" onclick="addBoutiqueToCart('\${prod.id}')">
        <span class="material-icons-round">add_shopping_cart</span>
        Ajouter au panier
    </button>`
);

// Append Cart logic
const newCode = `
// ==========================================
// BOUTIQUE CART LOGIC
// ==========================================

let boutiqueCart = JSON.parse(localStorage.getItem('boutiqueCart') || '[]');

function updateBoutiqueCartCount() {
    const totalItems = boutiqueCart.reduce((sum, item) => sum + item.quantity, 0);
    const clientCount = document.getElementById('client-cart-count');
    const publicCount = document.getElementById('public-cart-count');
    if(clientCount) clientCount.innerText = totalItems;
    if(publicCount) publicCount.innerText = totalItems;
}

// Initialize count on load
document.addEventListener('DOMContentLoaded', () => {
    updateBoutiqueCartCount();
});

function addBoutiqueToCart(prodId) {
    const db = getDB();
    const prod = (db.boutique_products || []).find(p => p.id === prodId);
    if (!prod) return;
    
    const existingItem = boutiqueCart.find(item => item.id === prodId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        boutiqueCart.push({
            id: prod.id,
            title: prod.title,
            price: prod.price,
            image: prod.image,
            quantity: 1
        });
    }
    
    localStorage.setItem('boutiqueCart', JSON.stringify(boutiqueCart));
    updateBoutiqueCartCount();
    
    document.getElementById('modal-boutique-detail').style.display = 'none';
    
    // Custom notification
    showNotification(prod.title + " a été ajouté au panier !", "success");
}

function openBoutiqueCart() {
    renderBoutiqueCart();
    document.getElementById('modal-boutique-cart').style.display = 'flex';
}

function renderBoutiqueCart() {
    const list = document.getElementById('boutique-cart-items');
    const totalEl = document.getElementById('boutique-cart-total');
    
    if (boutiqueCart.length === 0) {
        list.innerHTML = '<p class="text-center text-muted py-4">Votre panier est vide.</p>';
        totalEl.innerText = '0';
        document.getElementById('boutique-checkout-form-container').style.display = 'none';
        return;
    }
    
    document.getElementById('boutique-checkout-form-container').style.display = 'block';
    
    let html = '';
    let total = 0;
    
    boutiqueCart.forEach((item, index) => {
        // Simple extraction of numbers from price string (e.g. "15000 CFA" -> 15000)
        let priceNum = 0;
        const match = item.price.match(/\\d+/g);
        if(match) priceNum = parseInt(match.join(''), 10);
        
        total += priceNum * item.quantity;
        
        html += \`
        <div class="flex justify-between items-center bg-gray-800 p-3 rounded">
            <div class="flex items-center gap-3">
                <img src="\${item.image}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://via.placeholder.com/50'">
                <div>
                    <div style="font-weight: bold;">\${item.title}</div>
                    <div class="text-muted text-sm">\${item.price} x \${item.quantity}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="btn-secondary" style="padding: 2px 8px;" onclick="changeBoutiqueCartQuantity(\${index}, -1)">-</button>
                <span>\${item.quantity}</span>
                <button class="btn-secondary" style="padding: 2px 8px;" onclick="changeBoutiqueCartQuantity(\${index}, 1)">+</button>
                <button class="btn-danger ml-2" style="padding: 2px 8px;" onclick="removeBoutiqueCartItem(\${index})">X</button>
            </div>
        </div>
        \`;
    });
    
    list.innerHTML = html;
    
    // Add currency symbol back based on the first item or user preference
    const currency = boutiqueCart[0].price.replace(/[0-9\\s\\.\\,]/g, '').trim() || '';
    totalEl.innerText = total.toLocaleString() + ' ' + currency;
}

function changeBoutiqueCartQuantity(index, delta) {
    boutiqueCart[index].quantity += delta;
    if (boutiqueCart[index].quantity <= 0) {
        boutiqueCart.splice(index, 1);
    }
    localStorage.setItem('boutiqueCart', JSON.stringify(boutiqueCart));
    updateBoutiqueCartCount();
    renderBoutiqueCart();
}

function removeBoutiqueCartItem(index) {
    boutiqueCart.splice(index, 1);
    localStorage.setItem('boutiqueCart', JSON.stringify(boutiqueCart));
    updateBoutiqueCartCount();
    renderBoutiqueCart();
}

async function submitBoutiqueOrder(e) {
    e.preventDefault();
    if (boutiqueCart.length === 0) return;
    
    const name = document.getElementById('checkout-name').value;
    const phone = document.getElementById('checkout-phone').value;
    const address = document.getElementById('checkout-address').value;
    const notes = document.getElementById('checkout-notes').value;
    
    // Calculate total string
    let total = 0;
    let currency = '';
    boutiqueCart.forEach(item => {
        let priceNum = 0;
        const match = item.price.match(/\\d+/g);
        if(match) priceNum = parseInt(match.join(''), 10);
        total += priceNum * item.quantity;
        if(!currency) currency = item.price.replace(/[0-9\\s\\.\\,]/g, '').trim();
    });
    const totalString = total.toLocaleString() + ' ' + currency;
    
    const user = getCurrentUser(); // Might be null if public
    
    const order = {
        id: generateId('bord_'),
        items: boutiqueCart,
        total: totalString,
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        notes: notes,
        status: 'pending', // pending, processing, shipped, delivered, cancelled
        createdAt: new Date().toISOString(),
        clientId: user ? user.uid : 'public'
    };
    
    try {
        await saveDoc('boutique_orders', order);
        
        // Empty cart
        boutiqueCart = [];
        localStorage.removeItem('boutiqueCart');
        updateBoutiqueCartCount();
        
        document.getElementById('modal-boutique-cart').style.display = 'none';
        
        // Show success
        alert("Merci ! Votre commande a été enregistrée avec succès. Nous vous contacterons très vite au " + phone + " pour la livraison.");
        
    } catch(err) {
        console.error(err);
        alert("Erreur lors de la commande: " + err.message);
    }
}
`;

fs.writeFileSync('js/client.js', code + "\n" + newCode);
console.log("Appended Boutique Cart Logic");
