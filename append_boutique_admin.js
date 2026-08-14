const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

const newCode = `
// ==========================================
// BOUTIQUE E-COMMERCE (ADMIN)
// ==========================================

function switchAdminBoutiqueTab(tab) {
    document.getElementById('admin-boutique-subview-products').classList.add('hidden');
    document.getElementById('admin-boutique-subview-categories').classList.add('hidden');
    document.getElementById('btn-admin-boutique-products').className = 'btn-secondary';
    document.getElementById('btn-admin-boutique-categories').className = 'btn-secondary';

    document.getElementById(\`admin-boutique-subview-\${tab}\`).classList.remove('hidden');
    document.getElementById(\`btn-admin-boutique-\${tab}\`).className = 'btn-primary';

    if (tab === 'products') renderAdminBoutiqueProducts();
    if (tab === 'categories') renderAdminBoutiqueCategories();
}

function renderAdminBoutique() {
    switchAdminBoutiqueTab('products');
}

function renderAdminBoutiqueCategories() {
    const db = getDB();
    const list = document.getElementById('admin-boutique-categories-list');
    list.innerHTML = '';
    
    if(!db.boutique_categories || db.boutique_categories.length === 0) {
        list.innerHTML = '<p class="text-muted">Aucune catégorie.</p>';
        return;
    }
    
    let htmlStr = '';
    db.boutique_categories.forEach(cat => {
        htmlStr += \`
        <div class="flex justify-between items-center bg-gray-800 p-3 rounded mb-2">
            <div>\${cat.name}</div>
            <button class="btn-danger text-sm" onclick="deleteBoutiqueCategory('\${cat.id}')">Supprimer</button>
        </div>\`;
    });
    list.innerHTML = htmlStr;
}

async function addBoutiqueCategory(e) {
    e.preventDefault();
    const nameInput = document.getElementById('boutique-cat-name');
    const name = nameInput.value.trim();
    if(!name) return;
    
    const cat = {
        id: generateId('bcat_'),
        name: name,
        createdAt: new Date().toISOString()
    };
    
    try {
        await saveDoc('boutique_categories', cat);
        nameInput.value = '';
        renderAdminBoutiqueCategories();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}

async function deleteBoutiqueCategory(id) {
    if(!confirm("Supprimer cette catégorie ?")) return;
    try {
        await deleteDoc('boutique_categories', id);
        renderAdminBoutiqueCategories();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}

let currentEditBoutiqueProductId = null;
function openBoutiqueProductModal(prodId = null) {
    currentEditBoutiqueProductId = prodId;
    let modal = document.getElementById('modal-boutique-product');
    
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-boutique-product';
        modal.className = 'modal';
        modal.innerHTML = \`
            <div class="modal-content" style="max-width: 600px;">
                <h3 id="boutique-prod-modal-title">Ajouter un produit</h3>
                <form id="boutique-prod-form" onsubmit="saveBoutiqueProduct(event)">
                    <div class="form-group mb-4">
                        <label>Titre du produit</label>
                        <input type="text" id="boutique-prod-title" required class="input-field">
                    </div>
                    <div class="form-group mb-4">
                        <label>Catégorie</label>
                        <select id="boutique-prod-category" required class="input-field"></select>
                    </div>
                    <div class="form-group mb-4">
                        <label>Prix (CFA ou Euros)</label>
                        <input type="text" id="boutique-prod-price" required class="input-field" placeholder="Ex: 15000 CFA">
                    </div>
                    <div class="form-group mb-4">
                        <label>Description</label>
                        <textarea id="boutique-prod-desc" required class="input-field" rows="3"></textarea>
                    </div>
                    <div class="form-group mb-4">
                        <label>Image principale (URL ou Fichier non géré pour l'instant, utilisez une URL)</label>
                        <input type="url" id="boutique-prod-image" required class="input-field" placeholder="https://lien-image.com/img.jpg">
                    </div>
                    <div class="flex gap-2 justify-end mt-6">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-boutique-product').style.display='none'">Annuler</button>
                        <button type="submit" class="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        \`;
        document.body.appendChild(modal);
    }
    
    // Populate categories
    const db = getDB();
    const catSelect = document.getElementById('boutique-prod-category');
    catSelect.innerHTML = '<option value="">Sélectionnez une catégorie</option>';
    if(db.boutique_categories) {
        db.boutique_categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.innerText = cat.name;
            catSelect.appendChild(opt);
        });
    }
    
    if(prodId) {
        document.getElementById('boutique-prod-modal-title').innerText = "Modifier le produit";
        const prod = db.boutique_products.find(p => p.id === prodId);
        if(prod) {
            document.getElementById('boutique-prod-title').value = prod.title || '';
            document.getElementById('boutique-prod-category').value = prod.categoryId || '';
            document.getElementById('boutique-prod-price').value = prod.price || '';
            document.getElementById('boutique-prod-desc').value = prod.description || '';
            document.getElementById('boutique-prod-image').value = prod.image || '';
        }
    } else {
        document.getElementById('boutique-prod-modal-title').innerText = "Ajouter un produit";
        document.getElementById('boutique-prod-form').reset();
    }
    
    modal.style.display = 'flex';
}

async function saveBoutiqueProduct(e) {
    e.preventDefault();
    const title = document.getElementById('boutique-prod-title').value;
    const categoryId = document.getElementById('boutique-prod-category').value;
    const price = document.getElementById('boutique-prod-price').value;
    const description = document.getElementById('boutique-prod-desc').value;
    const image = document.getElementById('boutique-prod-image').value;
    
    const prod = {
        id: currentEditBoutiqueProductId || generateId('bprod_'),
        title, categoryId, price, description, image,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await saveDoc('boutique_products', prod);
        document.getElementById('modal-boutique-product').style.display = 'none';
        renderAdminBoutiqueProducts();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}

function renderAdminBoutiqueProducts() {
    const db = getDB();
    const list = document.getElementById('admin-boutique-products-list');
    list.innerHTML = '';
    
    if(!db.boutique_products || db.boutique_products.length === 0) {
        list.innerHTML = '<p class="text-muted">Aucun produit dans la boutique.</p>';
        return;
    }
    
    let htmlStr = '';
    db.boutique_products.forEach(prod => {
        const cat = (db.boutique_categories || []).find(c => c.id === prod.categoryId);
        htmlStr += \`
        <div class="glass-panel" style="padding: 15px;">
            <div style="height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 10px;">
                <img src="\${prod.image || 'https://via.placeholder.com/300'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <h4 style="margin: 0 0 5px 0;">\${prod.title}</h4>
            <p class="text-muted text-sm" style="margin: 0 0 10px 0;">\${cat ? cat.name : 'Sans catégorie'}</p>
            <p style="font-weight: bold; color: var(--accent-gold); margin: 0 0 15px 0;">\${prod.price}</p>
            <div class="flex gap-2">
                <button class="btn-secondary text-sm" onclick="openBoutiqueProductModal('\${prod.id}')" style="flex:1;">Modifier</button>
                <button class="btn-danger text-sm" onclick="deleteBoutiqueProduct('\${prod.id}')" style="flex:1;">Supprimer</button>
            </div>
        </div>\`;
    });
    list.innerHTML = htmlStr;
}

async function deleteBoutiqueProduct(id) {
    if(!confirm("Supprimer ce produit ?")) return;
    try {
        await deleteDoc('boutique_products', id);
        renderAdminBoutiqueProducts();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}
`;

fs.writeFileSync('js/admin.js', code + "\n" + newCode);
console.log("Appended Boutique Admin Logic");
