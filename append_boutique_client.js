const fs = require('fs');
let code = fs.readFileSync('js/client.js', 'utf8');

const newCode = `
// ==========================================
// BOUTIQUE E-COMMERCE (CLIENT)
// ==========================================

let currentBoutiqueCategory = 'all';

function renderClientBoutique() {
    const db = getDB();
    
    // 1. Render Categories Filter
    const filterContainer = document.getElementById('boutique-categories-filter');
    if (filterContainer) {
        let filterHtml = \`<button class="\${currentBoutiqueCategory === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.4rem 1rem; border-radius: 50px;" onclick="filterBoutique('all')">Toutes</button>\`;
        
        if (db.boutique_categories) {
            db.boutique_categories.forEach(cat => {
                const isActive = currentBoutiqueCategory === cat.id;
                filterHtml += \`<button class="\${isActive ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.4rem 1rem; border-radius: 50px;" onclick="filterBoutique('\${cat.id}')">\${cat.name}</button>\`;
            });
        }
        filterContainer.innerHTML = filterHtml;
    }
    
    // 2. Render Products
    const grid = document.getElementById('boutique-products-grid');
    if (!grid) return;
    
    let products = db.boutique_products || [];
    if (currentBoutiqueCategory !== 'all') {
        products = products.filter(p => p.categoryId === currentBoutiqueCategory);
    }
    
    if (products.length === 0) {
        grid.innerHTML = '<p class="text-muted" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Aucun produit disponible dans cette catégorie.</p>';
        return;
    }
    
    let htmlStr = '';
    products.forEach(prod => {
        const cat = (db.boutique_categories || []).find(c => c.id === prod.categoryId);
        htmlStr += \`
        <div class="glass-panel" style="padding: 15px; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s;" onclick="openBoutiqueProductDetail('\${prod.id}')" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="height: 180px; overflow: hidden; border-radius: 8px; margin-bottom: 15px;">
                <img src="\${prod.image || 'https://via.placeholder.com/300'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <div style="flex-grow: 1;">
                <p class="text-muted text-sm" style="margin: 0 0 5px 0;">\${cat ? cat.name : 'Divers'}</p>
                <h4 style="margin: 0 0 10px 0; font-size: 1.1rem;">\${prod.title}</h4>
            </div>
            <div class="flex justify-between items-center" style="margin-top: auto;">
                <span style="font-weight: 900; color: var(--accent-gold); font-size: 1.2rem;">\${prod.price}</span>
                <button class="btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px;">Voir</button>
            </div>
        </div>\`;
    });
    
    grid.innerHTML = htmlStr;
}

function filterBoutique(catId) {
    currentBoutiqueCategory = catId;
    renderClientBoutique();
}

function openBoutiqueProductDetail(prodId) {
    const db = getDB();
    const prod = (db.boutique_products || []).find(p => p.id === prodId);
    if (!prod) return;
    
    const cat = (db.boutique_categories || []).find(c => c.id === prod.categoryId);
    
    let modal = document.getElementById('modal-boutique-detail');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-boutique-detail';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    const waMessage = encodeURIComponent(\`Bonjour, je souhaite commander le produit suivant depuis votre boutique SourcingPro :\\n\\n*Produit :* \${prod.title}\\n*Prix :* \${prod.price}\\n\\nMerci de m'indiquer la marche à suivre pour le paiement et la livraison.\`);
    const adminPhone = "33600000000"; // IMPORTANT: L'utilisateur devra configurer son numéro
    
    modal.innerHTML = \`
        <div class="modal-content" style="max-width: 800px; padding: 0; overflow: hidden; background: #1e293b;">
            <div class="flex flex-col md:flex-row">
                <!-- Image -->
                <div style="flex: 1; background: #000; display: flex; align-items: center; justify-content: center; min-height: 300px;">
                    <img src="\${prod.image || 'https://via.placeholder.com/600'}" style="max-width: 100%; max-height: 500px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/600'">
                </div>
                <!-- Details -->
                <div style="flex: 1; padding: 2rem; display: flex; flex-direction: column;">
                    <button class="material-icons-round text-muted hover-glow" style="background: none; border: none; align-self: flex-end; cursor: pointer; position: absolute; top: 1rem; right: 1rem; z-index: 10;" onclick="document.getElementById('modal-boutique-detail').style.display='none'">close</button>
                    
                    <p class="text-muted text-sm" style="margin: 0 0 5px 0;">\${cat ? cat.name : 'Divers'}</p>
                    <h2 style="margin: 0 0 15px 0; font-weight: 800; font-size: 1.8rem; line-height: 1.2;">\${prod.title}</h2>
                    <div style="font-weight: 900; color: var(--accent-gold); font-size: 1.5rem; margin-bottom: 20px;">\${prod.price}</div>
                    
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 25px; flex-grow: 1;">
                        <h4 class="text-sm text-muted mb-2">Description du produit</h4>
                        <p style="white-space: pre-wrap; margin: 0; font-size: 0.95rem; line-height: 1.5;">\${prod.description}</p>
                    </div>
                    
                    <a href="https://wa.me/\${adminPhone}?text=\${waMessage}" target="_blank" class="btn-primary w-full" style="text-decoration: none; justify-content: center; padding: 1rem; font-size: 1.1rem; gap: 10px;">
                        <span class="material-icons-round">whatsapp</span>
                        Commander sur WhatsApp
                    </a>
                    <p class="text-center text-muted text-xs mt-3">Paiement sécurisé et livraison rapide.</p>
                </div>
            </div>
        </div>
    \`;
    
    modal.style.display = 'flex';
}
`;

fs.writeFileSync('js/client.js', code + "\n" + newCode);
console.log("Appended Boutique Client Logic");
