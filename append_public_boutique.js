const fs = require('fs');
let code = fs.readFileSync('js/client.js', 'utf8');

const newCode = `
// ==========================================
// PUBLIC BOUTIQUE E-COMMERCE
// ==========================================

let currentPublicBoutiqueCategory = 'all';

function showPublicBoutique() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('public-boutique-view').classList.remove('hidden');
    renderPublicBoutique();
}

function hidePublicBoutique() {
    document.getElementById('public-boutique-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}

function renderPublicBoutique() {
    const db = getDB();
    
    // 1. Render Categories Filter
    const filterContainer = document.getElementById('public-boutique-categories-filter');
    if (filterContainer) {
        let filterHtml = \`<button class="\${currentPublicBoutiqueCategory === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1.5rem; border-radius: 50px;" onclick="filterPublicBoutique('all')">Toutes</button>\`;
        
        if (db.boutique_categories) {
            db.boutique_categories.forEach(cat => {
                const isActive = currentPublicBoutiqueCategory === cat.id;
                filterHtml += \`<button class="\${isActive ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1.5rem; border-radius: 50px;" onclick="filterPublicBoutique('\${cat.id}')">\${cat.name}</button>\`;
            });
        }
        filterContainer.innerHTML = filterHtml;
    }
    
    // 2. Render Products
    const grid = document.getElementById('public-boutique-products-grid');
    if (!grid) return;
    
    let products = db.boutique_products || [];
    if (currentPublicBoutiqueCategory !== 'all') {
        products = products.filter(p => p.categoryId === currentPublicBoutiqueCategory);
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
            <div style="height: 200px; overflow: hidden; border-radius: 8px; margin-bottom: 15px;">
                <img src="\${prod.image || 'https://via.placeholder.com/300'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <div style="flex-grow: 1;">
                <p class="text-muted text-sm" style="margin: 0 0 5px 0;">\${cat ? cat.name : 'Divers'}</p>
                <h4 style="margin: 0 0 10px 0; font-size: 1.2rem;">\${prod.title}</h4>
            </div>
            <div class="flex justify-between items-center" style="margin-top: auto;">
                <span style="font-weight: 900; color: var(--accent-gold); font-size: 1.3rem;">\${prod.price}</span>
                <button class="btn-primary" style="padding: 0.5rem 1rem; border-radius: 8px;">Voir</button>
            </div>
        </div>\`;
    });
    
    grid.innerHTML = htmlStr;
}

function filterPublicBoutique(catId) {
    currentPublicBoutiqueCategory = catId;
    renderPublicBoutique();
}
`;

fs.writeFileSync('js/client.js', code + "\n" + newCode);
console.log("Appended Public Boutique Logic");
