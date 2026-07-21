// --- Admin Portal Logic ---

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (user && user.role === 'admin') {
        initAdminPortal();
    }
});

let hasRunAutoSync = false;
let autoSyncTimer = null;

function initAdminPortal() {
    switchAdminTab('users');
    let hasRunRepair = false;
    let renderTimeout = null;
    
    let lastUserCount = -1;
    setInterval(() => {
        const db = getDB();
        if (db && db.users && db.users.length !== lastUserCount) {
            lastUserCount = db.users.length;
            renderAdminUsers();
            renderAdminCategories();
            renderAdminSuppliers();
            if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
            if(typeof renderAdminAgentProducts === 'function') renderAdminAgentProducts();
        }
    }, 1000);

    window.addEventListener('db_updated', async () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            const db = getDB();

            // One-time wipe of platforms as requested by user
            if (!localStorage.getItem('platforms_wiped_v3') && db.sales_platforms && db.sales_platforms.length > 0) {
                localStorage.setItem('platforms_wiped_v3', 'true');
                try {
                    for(let p of db.sales_platforms) {
                        firestore.collection('sales_platforms').doc(p.id).delete();
                    }
                } catch(e){}
            }

            renderAdminUsers();
            renderAdminCategories();
            renderAdminSuppliers();
            populateCategorySelect();
            if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
            if(typeof renderVintedStock === 'function') renderVintedStock();
            if(typeof renderVintedSales === 'function') renderVintedSales();
            if(typeof renderSaleRegistration === 'function') renderSaleRegistration();
            
        // Update Charts if they exist
            if (typeof renderAdminCharts === 'function') {
                renderAdminCharts(db.users);
            }
        }, 150); // Debounce by 150ms
    });

}



async function autoSyncDatabases() {
    const db = getDB();
    let hasChanges = false;
    
    // 1. Ensure all Suppliers have a linked User account
    for (const sup of db.suppliers) {
        const existingUser = db.users.find(u => u.id === sup.userId);
        if (!existingUser) {
            const newUserId = generateId('usr_');
            sup.userId = newUserId;
            await saveDoc('suppliers', sup);
            
            await saveDoc('users', {
                id: newUserId,
                name: sup.name,
                company: sup.name,
                email: `manuel_${newUserId.substring(4,10)}@fournisseur.com`,
                phone: 'N/A',
                role: 'supplier',
                status: 'active',
                isManual: true
            });
            hasChanges = true;
        }
    }
    
    // 2. Ensure all active Supplier Users have a Supplier profile
    for (const user of db.users) {
        if (user.role === 'supplier' && user.status === 'active') {
            const existingSup = db.suppliers.find(s => s.userId === user.id);
            if (!existingSup) {
                const newSup = {
                    id: generateId('sup_'),
                    userId: user.id,
                    name: user.company || user.name,
                    categoryId: '',
                    description: 'Profil en attente de configuration par le fournisseur.',
                    isPremium: false,
                    views: 0,
                    vipCode: 'VIP-' + Math.random().toString(36).substr(2, 5).toUpperCase()
                };
                await saveDoc('suppliers', newSup);
                hasChanges = true;
            }
        }
    }
    
    if (hasChanges) {
        console.log("Databases auto-synchronized!");
    }
}

function switchAdminTab(tab) {
    ['users', 'team', 'categories', 'suppliers', 'trainings', 'agent', 'demos', 'stock', 'salereg', 'sales', 'backups', 'boutique'].forEach(t => {
        const view = document.getElementById(`admin-view-${t}`);
        const nav = document.getElementById(`admin-nav-${t}`);
        if(view) view.classList.add('hidden');
        if(nav) nav.classList.remove('active');
    });
    
    document.getElementById(`admin-view-${tab}`).classList.remove('hidden');
    document.getElementById(`admin-nav-${tab}`).classList.add('active');
    
    if(tab === 'users') renderAdminUsers();
    if(tab === 'team') renderAdminTeam();
    if(tab === 'categories') renderAdminCategories();
    if(tab === 'boutique') renderAdminBoutique();
    if(tab === 'suppliers') {
        renderAdminSuppliers();
        populateCategorySelect();
    }
    if(tab === 'trainings') {
        if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
    }
    if(tab === 'agent') {
        switchAdminAgentTab('catalog'); // Default to catalog
    }
    if(tab === 'demos') {
        if(typeof renderAdminDemos === 'function') renderAdminDemos();
    }
    if(tab === 'stock') {
        if(typeof renderVintedStock === 'function') renderVintedStock();
    }
    if(tab === 'salereg') {
        if(typeof renderSaleRegistration === 'function') renderSaleRegistration();
    }
    if(tab === 'sales') {
        if(typeof renderVintedSales === 'function') renderVintedSales();
    }
}

function switchAdminAgentTab(subtab) {
    const catalogView = document.getElementById('admin-agent-subview-catalog');
    const ordersView = document.getElementById('admin-agent-subview-orders');
    const btnCatalog = document.getElementById('btn-admin-agent-catalog');
    const btnOrders = document.getElementById('btn-admin-agent-orders');

    if (subtab === 'catalog') {
        catalogView.classList.remove('hidden');
        ordersView.classList.add('hidden');
        btnCatalog.className = 'btn-primary';
        btnOrders.className = 'btn-secondary';
        if(typeof renderAdminAgentProducts === 'function') renderAdminAgentProducts();
    } else if (subtab === 'orders') {
        catalogView.classList.add('hidden');
        ordersView.classList.remove('hidden');
        btnCatalog.className = 'btn-secondary';
        btnOrders.className = 'btn-primary';
        if(typeof renderAdminOrders === 'function') renderAdminOrders();
    }
}

// --- Demo Access Management ---
window.generateDemoAccess = async function() {
    if(!confirm("Voulez-vous vraiment générer un accès Démo de 1H ?")) return;
    
    const demoCode = Math.random().toString(36).substr(2, 4).toUpperCase();
    const email = `demo_${demoCode}@sourcingpro.demo`;
    const password = `Demo-${demoCode}`;
    const newUserId = generateId('usr_');

    // Mettre l'UI en attente
    const btn = document.querySelector('button[onclick="generateDemoAccess()"]');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round rotate">sync</span> Génération...';
    btn.disabled = true;

    try {
        // Utiliser une App Firebase Secondaire pour ne pas déconnecter l'Admin
        const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
        const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        await secondaryApp.auth().signOut();
        await secondaryApp.delete(); // cleanup

        const newUser = {
            id: userCredential.user.uid,
            name: `Visiteur Démo (${demoCode})`,
            email: email,
            phone: 'N/A',
            role: 'client',
            planType: 'demo',
            demoStatus: 'unused',
            status: 'active',
            createdAt: new Date().toISOString()
        };

        await saveDoc('users', newUser);

        alert(`✅ Accès Démo généré avec succès !\n\nEmail : ${email}\nMot de passe : ${password}\n\nEnvoyez ces identifiants au prospect. L'heure de démo commencera à sa première connexion.`);

    } catch (e) {
        console.error("Erreur génération démo :", e);
        alert("Erreur lors de la création de l'accès démo : " + e.message);
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
};

// --- Users Management ---
function renderAdminUsers() {
    const db = getDB();
    const tbody = document.getElementById('admin-users-tbody');
    if(!tbody) return;
    
    // Update Counters (excluding demos)
    const realUsers = db.users.filter(u => u.planType !== 'demo');
    const totalClients = realUsers.filter(u => u.role === 'client').length;
    const totalSuppliers = realUsers.filter(u => u.role === 'supplier').length;
    const elClients = document.getElementById('admin-count-clients');
    const elSuppliers = document.getElementById('admin-count-suppliers');
    if (elClients) elClients.innerText = totalClients;
    if (elSuppliers) elSuppliers.innerText = totalSuppliers;
    
    // Update Charts
    if (typeof renderAdminCharts === 'function') {
        renderAdminCharts(db.users);
    }
    
    // Filtering
    const filterVal = document.getElementById('admin-user-filter') ? document.getElementById('admin-user-filter').value : 'all';
    
    tbody.innerHTML = '';
    let usersList = db.users.filter(u => u.planType !== 'demo' && (u.role === 'client' || u.role === 'supplier'));
    
    if (filterVal !== 'all') {
        usersList = usersList.filter(u => u.role === filterVal);
    }
    
    if (usersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun utilisateur trouvé</td></tr>`;
        return;
    }
    
    let htmlStr = '';
    usersList.forEach(u => {
        let statusBadge = '';
        let actionBtn = '';
        let roleBadge = u.role === 'supplier' ? '<span class="badge text-warning" style="background:rgba(251,191,36,0.1)">Fournisseur</span>' : '<span class="badge" style="background:rgba(255,255,255,0.1)">Client</span>';
        
        if (u.status === 'pending') {
            statusBadge = '<span class="badge warning">En Attente</span>';
            if (u.role === 'client') {
                actionBtn = `
                    <button class="btn-icon text-primary" onclick="updateUserStatus('${u.id}', 'active', 'standard')" title="Valider (Formation Uniquement)"><span class="material-icons-round">school</span></button>
                    <button class="btn-icon success" onclick="updateUserStatus('${u.id}', 'active', 'premium')" title="Valider (Premium : Formation + Fournisseurs)"><span class="material-icons-round">stars</span></button>
                    <button class="btn-icon danger" onclick="updateUserStatus('${u.id}', 'rejected')" title="Refuser"><span class="material-icons-round">cancel</span></button>
                    <button class="btn-icon danger" onclick="deleteUser('${u.id}')" title="Supprimer définitivement"><span class="material-icons-round">delete_forever</span></button>
                `;
            } else {
                actionBtn = `
                    <button class="btn-icon success" onclick="updateUserStatus('${u.id}', 'active', 'standard')" title="Valider le Fournisseur"><span class="material-icons-round">check_circle</span></button>
                    <button class="btn-icon danger" onclick="updateUserStatus('${u.id}', 'rejected')" title="Refuser"><span class="material-icons-round">cancel</span></button>
                    <button class="btn-icon danger" onclick="deleteUser('${u.id}')" title="Supprimer définitivement"><span class="material-icons-round">delete_forever</span></button>
                `;
            }
        } else if (u.status === 'active') {
            let planBadge = (u.role === 'client' && u.planType === 'premium') ? '<span class="text-accent-gold text-xs ml-2 font-bold">Premium</span>' : (u.role === 'client' ? '<span class="text-primary text-xs ml-2 font-bold">Standard</span>' : '');
            statusBadge = `<span class="badge success">Actif</span> ${planBadge}`;
            
            let switchPlanBtn = '';
            if (u.role === 'client') {
                switchPlanBtn = u.planType === 'premium' 
                    ? `<button class="btn-icon text-primary" onclick="updateUserStatus('${u.id}', 'active', 'standard')" title="Passer au Forfait Standard"><span class="material-icons-round">school</span></button>`
                    : `<button class="btn-icon text-accent-gold" onclick="updateUserStatus('${u.id}', 'active', 'premium')" title="Passer au Forfait Premium"><span class="material-icons-round">stars</span></button>`;
            }
                
            actionBtn = `
                ${switchPlanBtn}
                <button class="btn-icon danger" onclick="updateUserStatus('${u.id}', 'pending')" title="Suspendre"><span class="material-icons-round">block</span></button>
                <button class="btn-icon danger" onclick="deleteUser('${u.id}')" title="Supprimer définitivement"><span class="material-icons-round">delete_forever</span></button>
            `;
        } else {
            statusBadge = '<span class="badge danger">Refusé</span>';
            actionBtn = `
                <button class="btn-icon success" onclick="updateUserStatus('${u.id}', 'active', 'standard')" title="Réactiver"><span class="material-icons-round">restore</span></button>
                <button class="btn-icon danger" onclick="deleteUser('${u.id}')" title="Supprimer définitivement"><span class="material-icons-round">delete_forever</span></button>
            `;
        }
        htmlStr += `
            <tr>
                <td>${u.company ? (u.company + '<br><small class="text-muted">' + u.name + '</small>') : u.name}</td>
                <td>${roleBadge}</td>
                <td>${u.phone}</td>
                <td>${statusBadge}</td>
                <td><div class="flex gap-2">${actionBtn}</div></td>
            </tr>
        `;
    });
    tbody.innerHTML = htmlStr;
}

async function updateUserStatus(userId, status, planType = 'standard') {
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(user) {
        user.status = status;
        if (status === 'active') {
            user.planType = planType;
            
            // SYNCHRONIZATION: Create empty supplier profile if it doesn't exist
            if (user.role === 'supplier') {
                const existingSup = db.suppliers?.find(s => s.userId === userId);
                if (!existingSup) {
                    const newSup = {
                        id: generateId('sup_'),
                        userId: userId,
                        name: user.company || user.name,
                        categoryId: '',
                        description: 'Profil en attente de configuration par le fournisseur.',
                        link: '',
                        isPremium: false,
                        views: 0
                    };
                    await saveDoc('suppliers', newSup);
                }
            }
        }
        await saveDoc('users', user);
        alert(`Le statut du client ${user.name} a été mis à jour : ${status.toUpperCase()} ${status === 'active' ? '(' + planType + ')' : ''}`);
    }
}

async function deleteUser(id) {
    if(!confirm("⚠️ Êtes-vous sûr de vouloir supprimer cet élément ?")) return;
    
    try {
        const db = getDB();
        const user = db.users.find(u => u.id === id);
        
        // BACKUP HISTORY FOR SUPPLIERS
        if (user && user.role === 'supplier') {
            await saveBackupHistory('SUPPRESSION', user);
        }
        
        // Supprimer l'utilisateur de la collection users
        await deleteDoc('users', id);
        alert("Supprimé avec succès.");
    } catch (e) {
        console.error("Delete user error", e);
        alert("Erreur lors de la suppression.");
    }
}

// --- Categories Management ---
const CATEGORY_ICONS = [
    'category', 'checkroom', 'diamond', 'watch', 'shopping_bag', 'local_shipping', 'storefront', 
    'spa', 'health_and_safety', 'fitness_center', 'sports_esports', 'phone_iphone', 'computer', 
    'chair', 'kitchen', 'brush', 'palette', 'child_friendly', 'toys', 'pets', 'auto_awesome',
    'shopping_cart', 'inventory_2', 'bolt', 'eco', 'home', 'construction', 'car_rental', 'fastfood'
];

function renderIconPicker(selectedIcon = 'category') {
    const grid = document.getElementById('icon-picker-grid');
    if (!grid) return;
    
    grid.innerHTML = CATEGORY_ICONS.map(icon => `
        <button type="button" 
                onclick="selectCategoryIcon('${icon}')" 
                class="btn-icon" 
                style="width: 40px; height: 40px; border-radius: 8px; ${icon === selectedIcon ? 'background: var(--accent-blue); border: 2px solid #fff;' : 'background: rgba(255,255,255,0.05);'}"
                title="${icon}">
            <span class="material-icons-round" style="font-size: 20px; ${icon === selectedIcon ? 'color: #fff;' : 'color: var(--text-muted);'}">${icon}</span>
        </button>
    `).join('');
    
    document.getElementById('cat-icon').value = selectedIcon;
}

window.selectCategoryIcon = function(icon) {
    renderIconPicker(icon);
}

function renderAdminCategories() {
    const db = getDB();
    const list = document.getElementById('admin-categories-list');
    if(!list) return;
    
    let htmlStr = '';
    db.categories.forEach(cat => {
        htmlStr += `
            <div class="glass-panel flex justify-between items-center" style="padding:1rem; margin-bottom:0.5rem;">
                <div class="flex items-center gap-4">
                    <span class="material-icons-round text-primary" style="font-size:2rem;">${cat.icon}</span>
                    <span class="font-bold">${cat.name}</span>
                </div>
                <div class="flex gap-2">
                    <button class="btn-icon" style="background: rgba(59, 130, 246, 0.2); color: var(--accent-blue);" onclick="editCategory('${cat.id}')"><span class="material-icons-round">edit</span></button>
                    <button class="btn-icon danger" onclick="deleteCategory('${cat.id}')"><span class="material-icons-round">delete</span></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = htmlStr;
    
    if (document.getElementById('icon-picker-grid') && document.getElementById('icon-picker-grid').innerHTML.trim() === '') {
        renderIconPicker();
    }
}

window.editCategory = function(id) {
    const db = getDB();
    const cat = db.categories.find(c => c.id === id);
    if (!cat) return;
    
    document.getElementById('cat-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    renderIconPicker(cat.icon);
    
    document.getElementById('cat-form-title').innerText = "Modifier la Catégorie";
    document.getElementById('cat-submit-btn').innerText = "Mettre à jour";
    document.getElementById('cat-cancel-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cancelEditCategory = function() {
    document.getElementById('cat-id').value = '';
    document.getElementById('cat-name').value = '';
    renderIconPicker('category');
    
    document.getElementById('cat-form-title').innerText = "Nouvelle Catégorie";
    document.getElementById('cat-submit-btn').innerText = "Ajouter";
    document.getElementById('cat-cancel-btn').classList.add('hidden');
}

async function addCategory(e) {
    e.preventDefault();
    const id = document.getElementById('cat-id').value;
    const name = document.getElementById('cat-name').value;
    const icon = document.getElementById('cat-icon').value || 'category';
    
    if(!name) return showNotification('Nom requis', 'error');
    
    if (id) {
        // Update existing
        const db = getDB();
        const catIndex = db.categories.findIndex(c => c.id === id);
        if (catIndex > -1) {
            db.categories[catIndex].name = name;
            db.categories[catIndex].icon = icon;
            await saveDoc('categories', db.categories[catIndex]);
            showNotification('Catégorie mise à jour', 'success');
        }
    } else {
        // Add new
        await saveDoc('categories', { id: generateId('cat_'), name, icon });
        showNotification('Catégorie ajoutée', 'success');
    }
    
    cancelEditCategory();
    renderAdminCategories(); // Ensure UI refreshes
}

async function deleteCategory(id) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer cette catégorie ?")) return;
    await deleteDoc('categories', id);
    renderAdminCategories();
}

function populateCategorySelect() {
    const db = getDB();
    const select = document.getElementById('sup-category');
    const filterSelect = document.getElementById('admin-filter-cat');
    
    if(select) {
        select.innerHTML = '<option value="" disabled selected>Choisir une catégorie</option>';
        db.categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    }
    
    if(filterSelect) {
        const currentVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Toutes les catégories</option>';
        db.categories.forEach(cat => {
            filterSelect.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
        if(currentVal && currentVal !== 'all') {
            filterSelect.value = currentVal;
        }
    }
}

// --- Suppliers Management ---

// To handle mock file uploads, we'll use base64 conversion
// Array global pour stocker les PDFs temporairement avant l'ajout
let currentSupplierPdfs = [];
let currentEditSupplierId = null;

function handlePdfUpload(inputId, hiddenDataId) {
    const files = document.getElementById(inputId).files;
    if (files.length > 0) {
        let allValid = true;
        let totalNewSize = 0;
        
        for (let i = 0; i < files.length; i++) {
            if (files[i].type !== "application/pdf") {
                alert("Erreur : Le fichier " + files[i].name + " n'est pas un PDF.");
                allValid = false;
            }
            totalNewSize += files[i].size;
        }
        
        if (!allValid) {
            document.getElementById(inputId).value = "";
            return;
        }
        
        if (totalNewSize > 2.5 * 1024 * 1024) { // 2.5MB total max
            alert("⚠️ La taille des PDFs sélectionnés dépasse 2.5 Mo. Veuillez réduire la taille pour la simulation locale.");
            document.getElementById(inputId).value = "";
            return;
        }
        
        let filesRead = 0;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentSupplierPdfs.push(e.target.result);
                filesRead++;
                if (filesRead === files.length) {
                    document.getElementById(hiddenDataId).value = JSON.stringify(currentSupplierPdfs);
                    renderPdfPreviewList();
                }
            };
            reader.readAsDataURL(file);
        });
    }
    // Reset file input so user can add more without overwriting
    document.getElementById(inputId).value = "";
}

function renderPdfPreviewList() {
    const container = document.getElementById('pdf-list-preview');
    if(!container) return;
    container.innerHTML = '';
    
    currentSupplierPdfs.forEach((pdf, index) => {
        container.innerHTML += `
            <div class="glass-panel flex justify-between items-center" style="padding:0.5rem 1rem; border:1px solid rgba(255,255,255,0.2);">
                <div class="flex items-center gap-2">
                    <span class="material-icons-round text-warning">picture_as_pdf</span>
                    <span class="text-sm">Catalogue ${index + 1}</span>
                </div>
                <button type="button" class="btn-icon danger" onclick="removePdf(${index})" title="Supprimer ce PDF"><span class="material-icons-round">close</span></button>
            </div>
        `;
    });
}

function removePdf(index) {
    currentSupplierPdfs.splice(index, 1);
    document.getElementById('sup-catalog-data').value = JSON.stringify(currentSupplierPdfs);
    renderPdfPreviewList();
}

function handleImageUpload(inputId, previewId) {
    const file = document.getElementById(inputId).files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
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
                
                // Compression JPEG (qualité 60%)
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                
                document.getElementById(previewId).src = compressedDataUrl;
                document.getElementById(previewId).classList.remove('hidden');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function addSupplier(e) {
    try {
    e.preventDefault();
    const name = document.getElementById('sup-name').value;
    const categoryId = document.getElementById('sup-category').value;
    const description = document.getElementById('sup-desc').value;
    const link = document.getElementById('sup-link').value.trim();
    const isPremium = document.getElementById('sup-premium').checked;
    
    if(!name || !categoryId || !description) {
        alert("Erreur : Veuillez remplir tous les champs obligatoires (Nom, Catégorie, Description).");
        return;
    }
    
    const cardFront = document.getElementById('preview-front').src || '';
    const cardBack = document.getElementById('preview-back').src || '';
    const qrWhatsApp = document.getElementById('preview-wa').src || '';
    const qrWeChat = document.getElementById('preview-wc').src || '';
    const catalogDataStr = document.getElementById('sup-catalog-data').value;
    let catalogPdfs = [];
    if(catalogDataStr) {
        try { catalogPdfs = JSON.parse(catalogDataStr); } catch(e){}
    }
    
    const getValidImage = (src) => (src && typeof src === 'string' && src.startsWith('data:')) ? src : null;
    
    const db = getDB();
    const isUpdate = !!currentEditSupplierId;
    
    if (isUpdate) {
        const index = (db.users || []).findIndex(s => s.id === currentEditSupplierId && s.role === 'supplier');
        if(index !== -1) {
            const existingSup = db.users[index];
            const updatedSup = {
                ...existingSup,
                name, categoryId, description, link, isPremium,
                cardFront: getValidImage(cardFront),
                cardBack: getValidImage(cardBack),
                qrWhatsApp: getValidImage(qrWhatsApp),
                qrWeChat: getValidImage(qrWeChat),
                catalogLinks: catalogPdfs
            };
            // BACKUP HISTORY: Save old version before update
            await saveBackupHistory('MODIFICATION', existingSup);
            
            await saveDoc('users', updatedSup);
        }
    } else {
        const newUserId = generateId('usr_');
        const dummyEmail = `manuel_${newUserId.substring(4,10)}@fournisseur.com`;
        
        const newSupplier = {
            id: newUserId,
            name: name,
            company: name,
            email: dummyEmail,
            phone: 'N/A',
            role: 'supplier',
            status: 'active',
            isManual: true,
            categoryId, description, link, isPremium,
            cardFront: getValidImage(cardFront),
            cardBack: getValidImage(cardBack),
            qrWhatsApp: getValidImage(qrWhatsApp),
            qrWeChat: getValidImage(qrWeChat),
            catalogLinks: catalogPdfs,
            vipCode: 'VIP-' + Math.random().toString(36).substr(2, 5).toUpperCase()
        };
        await saveDoc('users', newSupplier);
        
        // BACKUP HISTORY: Save newly created supplier
        await saveBackupHistory('CREATION', newSupplier);
    }
    
    cancelEditSupplier();

    if(isUpdate) {
        alert("✅ Le fournisseur '" + name + "' a été mis à jour avec succès !");
    } else {
        alert("✅ Le fournisseur '" + name + "' a été ajouté avec succès à la liste !");
    }
    } catch (error) {
        console.error("Erreur dans addSupplier :", error);
        alert("Erreur : " + error.message);
    }
}

function renderAdminSuppliers() {
    const db = getDB();
    const list = document.getElementById('admin-suppliers-list');
    if(!list) return;
    
    // Get filter values
    const filterTextElem = document.getElementById('admin-filter-text');
    const filterCatElem = document.getElementById('admin-filter-cat');
    const filterPremiumElem = document.getElementById('admin-filter-premium');
    
    const filterText = filterTextElem ? filterTextElem.value.toLowerCase() : '';
    const filterCat = filterCatElem ? filterCatElem.value : 'all';
    const filterPremium = filterPremiumElem ? filterPremiumElem.checked : false;
    
    let filtered = (db.users || []).filter(u => u.role === 'supplier' && u.status === 'active');
    
    if (filterText) {
        filtered = filtered.filter(s => 
            (s.name && s.name.toLowerCase().includes(filterText)) || 
            (s.firstname && s.firstname.toLowerCase().includes(filterText)) ||
            (s.description && s.description.toLowerCase().includes(filterText))
        );
    }
    if (filterCat !== 'all') {
        filtered = filtered.filter(s => s.categoryId === filterCat || (s.categories && s.categories.includes(filterCat)));
    }
    if (filterPremium) {
        filtered = filtered.filter(s => s.isPremium);
    }
    
    list.innerHTML = '';
    if(filtered.length === 0) {
        if((db.users || []).filter(u => u.role === 'supplier' && u.status === 'active').length === 0) {
            list.innerHTML = '<p class="text-muted text-sm text-center">Aucun fournisseur enregistré.</p>';
        } else {
            list.innerHTML = '<p class="text-muted text-sm text-center">Aucun fournisseur ne correspond à vos filtres.</p>';
        }
        return;
    }
    
    // Sort suppliers: Premium first, then alphabetically by name
    filtered.sort((a, b) => {
        if (a.isPremium && !b.isPremium) return -1;
        if (!a.isPremium && b.isPremium) return 1;
        const nameA = a.name || a.firstname || '';
        const nameB = b.name || b.firstname || '';
        return nameA.localeCompare(nameB);
    });
    
    let htmlStr = '';
    filtered.forEach(sup => {
        const catId = sup.categoryId || (sup.categories && sup.categories.length > 0 ? sup.categories[0] : null);
        const cat = db.categories.find(c => c.id === catId);
        htmlStr += `
            <div class="glass-panel flex justify-between items-center" style="padding:1rem; margin-bottom:0.5rem;">
                <div>
                    <div class="font-bold flex items-center gap-2">
                        ${sup.name || sup.firstname || 'Fournisseur'}
                        ${sup.isPremium ? '<span class="material-icons-round text-warning text-sm">verified</span>' : ''}
                    </div>
                    <div class="text-sm text-muted">${cat ? cat.name : 'Autre'} • <span class="material-icons-round" style="font-size:14px; vertical-align:middle;">visibility</span> ${sup.views || 0} vues</div>
                </div>
                <div class="flex gap-2">
                    <button class="btn-icon text-primary" onclick="openSupplierModal('${sup.id}')" title="Aperçu Public"><span class="material-icons-round">visibility</span></button>
                    <button class="btn-icon" onclick="openShareModal('${sup.id}')" title="Partager l'Accès" style="color: #25D366;"><span class="material-icons-round">share</span></button>
                    <button class="btn-icon text-accent-gold" onclick="editSupplier('${sup.id}')" title="Modifier"><span class="material-icons-round" style="color:var(--accent-gold);">edit</span></button>
                    <button class="btn-icon danger" onclick="deleteSupplier('${sup.id}')" title="Supprimer"><span class="material-icons-round">delete</span></button>
                </div>
            </div>
        `;
    });
    list.innerHTML = htmlStr;
}

function editSupplier(id) {
    const db = getDB();
    const sup = (db.users || []).find(s => s.id === id && s.role === 'supplier');
    if(!sup) return;
    
    currentEditSupplierId = id;
    
    document.getElementById('sup-name').value = sup.name || sup.firstname || '';
    document.getElementById('sup-category').value = sup.categoryId || (sup.categories && sup.categories.length > 0 ? sup.categories[0] : '');
    document.getElementById('sup-desc').value = sup.description || '';
    document.getElementById('sup-link').value = sup.link || '';
    document.getElementById('sup-premium').checked = sup.isPremium;
    
    // Set images
    const setImage = (previewId, src) => {
        const img = document.getElementById(previewId);
        if(src) {
            img.src = src;
            img.classList.remove('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
        }
    };
    
    setImage('preview-front', sup.cardFront);
    setImage('preview-back', sup.cardBack);
    setImage('preview-wa', sup.qrWhatsApp);
    setImage('preview-wc', sup.qrWeChat);
    
    // Set PDFs
    currentSupplierPdfs = sup.catalogLinks ? [...sup.catalogLinks] : [];
    if(sup.catalogLink && currentSupplierPdfs.length === 0) currentSupplierPdfs = [sup.catalogLink];
    
    document.getElementById('sup-catalog-data').value = JSON.stringify(currentSupplierPdfs);
    renderPdfPreviewList();
    
    // Update UI buttons
    document.getElementById('btn-submit-supplier-text').textContent = "Mettre à jour le fournisseur";
    document.getElementById('btn-submit-supplier-icon').textContent = "update";
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    
    // Scroll to form (top of the page)
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditSupplier() {
    currentEditSupplierId = null;
    const form = document.querySelector('form[onsubmit="addSupplier(event)"]');
    if(form) form.reset();
    
    // Cacher les prévisualisations
    ['preview-front', 'preview-back', 'preview-wa', 'preview-wc'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
        document.getElementById(id).src = '';
    });
    
    document.getElementById('sup-catalog-data').value = '';
    currentSupplierPdfs = [];
    renderPdfPreviewList();
    
    // Update UI buttons
    document.getElementById('btn-submit-supplier-text').textContent = "Enregistrer le fournisseur";
    document.getElementById('btn-submit-supplier-icon').textContent = "save";
    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

async function deleteSupplier(id) {
    if(!confirm("Êtes-vous sûr ?")) return;
    
    // BACKUP HISTORY
    const db = getDB();
    const supplier = db.users.find(u => u.id === id);
    if (supplier) {
        await saveBackupHistory('SUPPRESSION', supplier);
    }
    
    await deleteDoc('users', id);
}

function openShareModal(id) {
    const db = getDB();
    const sup = db.suppliers.find(s => s.id === id);
    if(!sup) return;
    
    // Ensure they have a VIP code
    if (!sup.vipCode) {
        sup.vipCode = 'VIP-' + Math.random().toString(36).substr(2, 5).toUpperCase();
        saveDoc('suppliers', sup); // save it silently
    }
    
    const message = `Hello ${sup.name} 👋
We have added your products to the SourcingPro portal! Thousands of buyers can now see your catalog.

To take control of your profile and talk to buyers:
1. Go to: ${window.location.origin}${window.location.pathname}
2. Click "Supplier Register"
3. Use the VIP Invitation Code: ${sup.vipCode}

---

你好 ${sup.name} 👋
我们已将您的产品添加到 SourcingPro 门户网站！现在有成千上万的买家可以看到您的目录。

要控制您的资料并与买家交谈：
1. 访问：${window.location.origin}${window.location.pathname}
2. 点击 "Supplier Register"
3. 使用 VIP 邀请码：${sup.vipCode}`;

    document.getElementById('share-message-content').value = message;
    
    document.getElementById('btn-share-whatsapp').onclick = function() {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };
    
    document.getElementById('share-supplier-modal').classList.remove('hidden');
}

function copyShareMessage() {
    const text = document.getElementById('share-message-content').value;
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Message copié dans le presse-papier !', 'success');
    }).catch(err => {
        console.error('Erreur lors de la copie', err);
        showNotification('Erreur de copie.', 'error');
    });
}

// --- Trainings Management ---

function renderAdminTrainings() {
    const db = getDB();
    const list = document.getElementById('admin-trainings-list');
    if(!list) return;
    
    if (!db.trainings) db.trainings = [];
    list.innerHTML = '';
    
    if (!db.trainings || db.trainings.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm text-center mt-4">Aucun module pour l\'instant.</p>';
        return;
    }
    
    // Filter out ebooks
    const modules = db.trainings.filter(t => t.type !== 'ebook');
    
    if (modules.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm text-center mt-4">Aucun module classique pour l\'instant.</p>';
        return;
    }

    modules.forEach((mod, index) => {
        list.innerHTML += `
            <div class="glass-panel" style="padding:1rem; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.1);">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-lg text-accent-gold">Module ${index + 1} : ${mod.title}</h4>
                    <div class="flex gap-2">
                        <button class="btn-icon text-accent-gold" onclick="editTraining('${mod.id}')" title="Modifier ce module"><span class="material-icons-round">edit</span></button>
                        <button class="btn-icon danger" onclick="deleteTraining('${mod.id}')" title="Supprimer ce module"><span class="material-icons-round">delete</span></button>
                    </div>
                </div>
                <details class="text-sm text-muted mb-4 cursor-pointer">
                    <summary class="font-bold text-primary" style="outline:none;">Voir le contenu du cours</summary>
                    <div style="white-space: pre-wrap; margin-top:0.5rem; padding-left:1rem; border-left:2px solid var(--primary-color);">${mod.content}</div>
                </details>
                ${mod.mediaLink ? `<a href="${mod.mediaLink}" target="_blank" class="btn-secondary" style="display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none;"><span class="material-icons-round text-sm">link</span> Ouvrir le Média rattaché</a>` : ''}
            </div>
        `;
    });
}

let currentEditTrainingId = null;

async function addTraining(e) {
    e.preventDefault();
    const title = document.getElementById('train-title').value;
    const content = document.getElementById('train-content').value;
    const mediaLink = document.getElementById('train-media').value;
    
    if(!title || !content) {
        alert("Le titre et le contenu texte sont obligatoires.");
        return;
    }
    
    const db = getDB();
    if (!db.trainings) db.trainings = [];
    
    if (currentEditTrainingId) {
        const modIndex = db.trainings.findIndex(t => t.id === currentEditTrainingId);
        if (modIndex > -1) {
            const updatedTraining = {
                ...db.trainings[modIndex],
                title,
                content,
                mediaLink: mediaLink || null,
            };
            await saveDoc('trainings', updatedTraining);
            alert("✅ Module de formation mis à jour avec succès !");
        }
        currentEditTrainingId = null;
        document.getElementById('btn-submit-training-text').innerText = "Enregistrer le module";
        const cancelBtn = document.getElementById('btn-cancel-training');
        if(cancelBtn) cancelBtn.classList.add('hidden');
    } else {
        const newTraining = {
            id: generateId('train_'),
            title,
            content,
            mediaLink: mediaLink || null,
            createdAt: new Date().toISOString()
        };
        await saveDoc('trainings', newTraining);
        alert("✅ Module de formation ajouté avec succès !");
    }
    
    e.target.reset();
}

function editTraining(id) {
    const db = getDB();
    const mod = db.trainings.find(t => t.id === id);
    if (!mod) return;
    
    currentEditTrainingId = id;
    document.getElementById('train-title').value = mod.title;
    document.getElementById('train-content').value = mod.content;
    document.getElementById('train-media').value = mod.mediaLink || '';
    
    document.getElementById('btn-submit-training-text').innerText = "Mettre à jour le module";
    const cancelBtn = document.getElementById('btn-cancel-training');
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditTraining() {
    currentEditTrainingId = null;
    document.getElementById('train-title').value = '';
    document.getElementById('train-content').value = '';
    document.getElementById('train-media').value = '';
    
    document.getElementById('btn-submit-training-text').innerText = "Enregistrer le module";
    const cancelBtn = document.getElementById('btn-cancel-training');
    if(cancelBtn) cancelBtn.classList.add('hidden');
}

async function deleteTraining(id) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer ce module ?")) return;
    await deleteDoc('trainings', id);
    alert("✅ Module supprimé !");
    if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
}

function switchAdminTrainingTab(subtab) {
    const modulesView = document.getElementById('admin-train-subview-modules');
    const ebooksView = document.getElementById('admin-train-subview-ebooks');
    const btnModules = document.getElementById('btn-admin-train-modules');
    const btnEbooks = document.getElementById('btn-admin-train-ebooks');

    if (subtab === 'modules') {
        modulesView.classList.remove('hidden');
        ebooksView.classList.add('hidden');
        btnModules.className = 'btn-primary';
        btnEbooks.className = 'btn-secondary';
        if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
    } else if (subtab === 'ebooks') {
        modulesView.classList.add('hidden');
        ebooksView.classList.remove('hidden');
        btnModules.className = 'btn-secondary';
        btnEbooks.className = 'btn-primary';
        if(typeof renderAdminEbooks === 'function') renderAdminEbooks();
    }
}

let currentEditEbookId = null;

async function addEbook(e) {
    e.preventDefault();
    const title = document.getElementById('ebook-title').value;
    const desc = document.getElementById('ebook-desc').value;
    const fileInput = document.getElementById('ebook-file');
    const submitBtn = document.getElementById('btn-submit-ebook');
    
    // If we are creating a new ebook, a file is required
    if (!currentEditEbookId && (!title || !desc || !fileInput.files.length)) {
        alert("Veuillez remplir tous les champs et sélectionner un PDF.");
        return;
    }
    
    // If editing, title and desc are required, but file is optional
    if (currentEditEbookId && (!title || !desc)) {
        alert("Veuillez remplir le titre et la description.");
        return;
    }

    // Change button state
    submitBtn.innerHTML = '<span class="material-icons-round animate-spin">sync</span> Enregistrement en cours... Ne quittez pas la page';
    submitBtn.disabled = true;

    try {
        if (currentEditEbookId) {
            // EDIT EXISTING EBOOK
            const db = getDB();
            const existingEbook = db.trainings.find(t => t.id === currentEditEbookId);
            if (!existingEbook) throw new Error("Ebook introuvable");
            
            let finalUrl = existingEbook.fileUrl;
            let finalName = existingEbook.fileName;
            
            // If a new file is provided, upload it
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                if (file.type !== 'application/pdf') {
                    alert("Veuillez sélectionner un fichier PDF valide.");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span class="material-icons-round">cloud_upload</span> <span id="btn-submit-ebook-text">Mettre à jour l\'Ebook</span>';
                    return;
                }
                const newUrl = await uploadFileToStorage(file, 'ebooks');
                if (!newUrl) throw new Error("Échec de l'upload du nouveau fichier");
                finalUrl = newUrl;
                finalName = file.name;
            }
            
            const updatedEbook = {
                ...existingEbook,
                title: title,
                description: desc,
                fileUrl: finalUrl,
                fileName: finalName
            };
            
            await saveDoc('trainings', updatedEbook);
            alert("✅ Ebook mis à jour avec succès !");
            cancelEditEbook();
            
        } else {
            // CREATE NEW EBOOK
            const file = fileInput.files[0];
            if (file.type !== 'application/pdf') {
                alert("Veuillez sélectionner un fichier PDF valide.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-icons-round">cloud_upload</span> <span id="btn-submit-ebook-text">Uploader et Ajouter l\'Ebook</span>';
                return;
            }
            
            const fileUrl = await uploadFileToStorage(file, 'ebooks');
            if (!fileUrl) throw new Error("Échec de la récupération de l'URL du fichier.");

            const newEbook = {
                id: generateId('ebk_'),
                type: 'ebook',
                title: title,
                description: desc,
                fileUrl: fileUrl,
                fileName: file.name,
                createdAt: new Date().toISOString()
            };

            await saveDoc('trainings', newEbook);
            alert("✅ Ebook ajouté avec succès au pack !");
            e.target.reset();
        }
        
        renderAdminEbooks();
        
    } catch (error) {
        console.error("Erreur ajout/édition ebook:", error);
        alert("Erreur technique DÉTAILLÉE : " + error.message);
    } finally {
        // Restore button state (cancelEditEbook handles the text if we were editing)
        if (!currentEditEbookId) {
            submitBtn.innerHTML = '<span class="material-icons-round">cloud_upload</span> <span id="btn-submit-ebook-text">Uploader et Ajouter l\'Ebook</span>';
        }
        submitBtn.disabled = false;
    }
}

function editEbook(id) {
    const db = getDB();
    const ebook = db.trainings.find(t => t.id === id);
    if (!ebook) return;
    
    currentEditEbookId = id;
    document.getElementById('ebook-title').value = ebook.title;
    document.getElementById('ebook-desc').value = ebook.description;
    
    document.getElementById('ebook-file-required').classList.add('hidden');
    document.getElementById('btn-submit-ebook-text').innerText = "Mettre à jour l'Ebook";
    
    const cancelBtn = document.getElementById('btn-cancel-ebook');
    if(cancelBtn) cancelBtn.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditEbook() {
    currentEditEbookId = null;
    document.getElementById('ebook-title').value = '';
    document.getElementById('ebook-desc').value = '';
    document.getElementById('ebook-file').value = '';
    
    document.getElementById('ebook-file-required').classList.remove('hidden');
    document.getElementById('btn-submit-ebook').innerHTML = '<span class="material-icons-round">cloud_upload</span> <span id="btn-submit-ebook-text">Uploader et Ajouter l\'Ebook</span>';
    
    const cancelBtn = document.getElementById('btn-cancel-ebook');
    if(cancelBtn) cancelBtn.classList.add('hidden');
}

async function deleteEbook(id) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer cet Ebook du pack ?")) return;
    await deleteDoc('trainings', id);
    alert("✅ Ebook supprimé !");
    renderAdminEbooks();
}

function renderAdminEbooks() {
    const db = getDB();
    const list = document.getElementById('admin-ebooks-list');
    if (!list) return;

    list.innerHTML = '';
    
    // Filter out only ebooks from the trainings collection
    const ebooks = db.trainings ? db.trainings.filter(t => t.type === 'ebook') : [];

    if (ebooks.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm text-center">Aucun Ebook dans le pack pour le moment.</p>';
        return;
    }

    // Sort newest first
    const sortedEbooks = [...ebooks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sortedEbooks.forEach(ebook => {
        const card = document.createElement('div');
        card.className = 'glass-panel flex flex-col gap-2 relative';
        card.innerHTML = `
            <div style="background: rgba(251, 191, 36, 0.1); border-radius: 8px; height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                <span class="material-icons-round text-warning" style="font-size: 64px;">picture_as_pdf</span>
            </div>
            <div class="font-bold text-lg text-primary">${ebook.title}</div>
            <div class="text-sm text-muted mb-2 line-clamp-2">${ebook.description}</div>
            <div class="text-xs text-muted mb-4">Nom du fichier : ${ebook.fileName}</div>
            
            <div class="flex gap-2 mt-auto">
                <a href="${ebook.fileUrl}" target="_blank" class="btn-secondary" style="flex:1; text-align:center; padding:0.5rem;"><span class="material-icons-round text-sm">visibility</span> Voir</a>
                <button class="btn-icon" style="background:rgba(255,255,255,0.1); color:white;" onclick="editEbook('${ebook.id}')" title="Modifier"><span class="material-icons-round">edit</span></button>
                <button class="btn-icon danger" onclick="deleteEbook('${ebook.id}')" title="Supprimer"><span class="material-icons-round">delete_outline</span></button>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- Analytics Charts ---
let chartRolesInstance = null;
let chartStatusInstance = null;

function renderAdminCharts(users) {
    // Only render if Chart is defined and we are on the users tab
    if (typeof Chart === 'undefined') return;
    const canvasRoles = document.getElementById('chart-roles');
    const canvasStatus = document.getElementById('chart-status');
    if (!canvasRoles || !canvasStatus) return;

    // Destroy previous instances to avoid overlay bugs
    if (chartRolesInstance) chartRolesInstance.destroy();
    if (chartStatusInstance) chartStatusInstance.destroy();

    // Data prep: Roles
    const clients = users.filter(u => u.role === 'client').length;
    const db = typeof getDB === 'function' ? getDB() : { suppliers: [] };
    const suppliers = db.suppliers ? db.suppliers.length : users.filter(u => u.role === 'supplier').length;

    // Data prep: Status
    const active = users.filter(u => u.status === 'active').length;
    const pending = users.filter(u => u.status === 'pending').length;
    const rejected = users.filter(u => u.status === 'rejected').length;

    // Chart Design Settings
    Chart.defaults.color = 'rgba(255, 255, 255, 0.7)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Create Roles Chart
    chartRolesInstance = new Chart(canvasRoles, {
        type: 'doughnut',
        data: {
            labels: ['Clients', 'Fournisseurs'],
            datasets: [{
                data: [clients, suppliers],
                backgroundColor: ['#eab308', '#2563eb'], // Gold and Blue
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Create Status Chart
    chartStatusInstance = new Chart(canvasStatus, {
        type: 'pie',
        data: {
            labels: ['Actifs', 'En Attente', 'Refusés'],
            datasets: [{
                data: [active, pending, rejected],
                backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'], // Green, Orange, Red
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// --- Admin Demos View ---
let demoTimerInterval = null;

window.renderAdminDemos = function() {
    const db = getDB();
    const tbody = document.getElementById('admin-demos-tbody');
    if(!tbody) return;

    const demosList = db.users.filter(u => u.planType === 'demo');
    
    // Update Counters
    const connectedDemos = demosList.filter(u => u.demoStatus === 'active' || u.demoStatus === 'expired').length;
    const waitingDemos = demosList.filter(u => u.demoStatus === 'unused').length;
    
    const elActive = document.getElementById('admin-count-demos-active');
    const elWaiting = document.getElementById('admin-count-demos-waiting');
    if(elActive) elActive.innerText = connectedDemos;
    if(elWaiting) elWaiting.innerText = waitingDemos;

    tbody.innerHTML = '';

    if (demosList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun compte démo généré</td></tr>`;
        return;
    }

    demosList.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach(u => {
        let statusHtml = '';
        let timerHtml = '--:--';
        
        if (u.demoStatus === 'unused') {
            statusHtml = '<span class="badge" style="background: rgba(148, 163, 184, 0.2); color: var(--text-secondary);">En Attente</span>';
            timerHtml = '1 Heure (non démarré)';
        } else if (u.demoStatus === 'active') {
            const remaining = u.demoExpiresAt - Date.now();
            if (remaining <= 0) {
                statusHtml = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger);">Expiré</span>';
                timerHtml = '00:00';
            } else {
                statusHtml = '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">En Cours</span>';
                const totalSec = Math.floor(remaining / 1000);
                const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
                const secs = (totalSec % 60).toString().padStart(2, '0');
                timerHtml = `<span style="font-family: monospace; font-size: 1.1rem; color: var(--success); font-weight: bold;">${mins}:${secs}</span>`;
            }
        } else {
            statusHtml = '<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger);">Expiré</span>';
            timerHtml = '00:00';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div class="font-bold">${u.name || '<i>En attente du nom...</i>'}</div>
            </td>
            <td class="text-muted text-sm">${u.email}</td>
            <td>${statusHtml}</td>
            <td>${timerHtml}</td>
            <td>
                <button onclick="deleteUser('${u.id}')" class="btn-icon danger" title="Supprimer"><span class="material-icons-round">delete</span></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Setup live timer loop
    if (demoTimerInterval) clearInterval(demoTimerInterval);
    demoTimerInterval = setInterval(() => {
        const view = document.getElementById('admin-view-demos');
        if (view && !view.classList.contains('hidden')) {
            renderAdminDemos();
        } else {
            clearInterval(demoTimerInterval);
        }
    }, 1000);
}


// --- BATCH MANAGEMENT (CHINE) ---

function openManageBatchesModal() {
    renderBatchesList();
    document.getElementById('modal-manage-batches').classList.remove('hidden');
    if(document.getElementById('batch-categories-container').children.length === 0) {
        addBatchCategoryRow();
    }
}

function closeManageBatchesModal() {
    document.getElementById('modal-manage-batches').classList.add('hidden');
    // Refresh the select in stock form
    renderVintedStock(); 
}

function addBatchCategoryRow(catName = '', weight = '', qty = '') {
    const container = document.getElementById('batch-categories-container');
    const row = document.createElement('div');
    row.className = 'batch-cat-row glass-panel mb-2 relative';
    row.style.padding = '10px';
    row.style.background = 'rgba(255,255,255,0.02)';
    
    row.innerHTML = `
        <button type="button" class="btn-icon danger text-sm absolute top-2 right-2" onclick="this.parentElement.remove()" title="Supprimer" style="width:24px; height:24px; padding:0;">
            <span class="material-icons-round" style="font-size:14px;">close</span>
        </button>
        <div class="flex flex-col gap-2 mt-2">
            <div>
                <label class="text-xs text-muted mb-1 block">Nom de l'article</label>
                <input type="text" class="input-control batch-cat-name" placeholder="ex: Baskets" value="${catName}" required>
            </div>
            <div class="flex gap-2">
                <div style="flex:1;">
                    <label class="text-xs text-muted mb-1 block">Poids Unitaire (kg)</label>
                    <input type="number" step="0.01" min="0.01" class="input-control batch-cat-weight" placeholder="0.5" value="${weight}" required>
                </div>
                <div style="flex:1;">
                    <label class="text-xs text-muted mb-1 block">Quantité</label>
                    <input type="number" min="1" class="input-control batch-cat-qty" placeholder="10" value="${qty}" required>
                </div>
            </div>
        </div>
    `;
    container.appendChild(row);
}

async function submitNewBatch(e) {
    e.preventDefault();
    const db = getDB();
    
    const batchId = document.getElementById('batch-id').value;
    const ref = document.getElementById('batch-ref').value;
    const totalCost = parseFloat(document.getElementById('batch-total-cost').value);
    
    const rowElements = document.querySelectorAll('.batch-cat-row');
    if(rowElements.length === 0) {
        alert("Veuillez ajouter au moins une catégorie au colis.");
        return;
    }
    
    let items = [];
    let totalWeight = 0;
    
    rowElements.forEach(row => {
        const cat = row.querySelector('.batch-cat-name').value.trim();
        const weight = parseFloat(row.querySelector('.batch-cat-weight').value);
        const qty = parseInt(row.querySelector('.batch-cat-qty').value);
        if(cat && weight > 0 && qty > 0) {
            totalWeight += (weight * qty);
            items.push({ category: cat, unitWeight: weight, qty: qty, computedCost: 0 });
        }
    });
    
    if(items.length === 0 || totalWeight <= 0) return;
    
    // Règle de 3
    const costPerKg = totalCost / totalWeight;
    items.forEach(item => {
        item.computedCost = costPerKg * item.unitWeight;
    });
    
    if(!db.shipping_batches) db.shipping_batches = [];
    
    if (batchId) {
        // Mode modification
        const batchIndex = db.shipping_batches.findIndex(b => b.id === batchId);
        if(batchIndex !== -1) {
            db.shipping_batches[batchIndex].ref = ref;
            db.shipping_batches[batchIndex].totalCost = totalCost;
            db.shipping_batches[batchIndex].items = items;
            // Supprimer les anciens champs obsolètes
            delete db.shipping_batches[batchIndex].itemsCount;
            delete db.shipping_batches[batchIndex].unitCost;
            
            await saveDoc('shipping_batches', db.shipping_batches[batchIndex]);
            showNotification('Colis mis à jour avec succès.', 'success');
        }
    } else {
        // Mode création
        const newBatch = {
            id: generateId('batch_'),
            ref,
            totalCost,
            items,
            createdAt: new Date().toISOString()
        };
        db.shipping_batches.push(newBatch);
        await saveDoc('shipping_batches', newBatch);
        showNotification('Nouveau colis créé.', 'success');
    }
    
    cancelEditBatch();
    renderBatchesList();
}

function openEditBatch(id) {
    const db = getDB();
    const batch = (db.shipping_batches || []).find(b => b.id === id);
    if(!batch) return;
    
    document.getElementById('batch-id').value = batch.id;
    document.getElementById('batch-ref').value = batch.ref;
    document.getElementById('batch-total-cost').value = batch.totalCost;
    
    const container = document.getElementById('batch-categories-container');
    container.innerHTML = '';
    
    if (batch.items && batch.items.length > 0) {
        batch.items.forEach(item => {
            addBatchCategoryRow(item.category, item.unitWeight, item.qty);
        });
    } else {
        // Legacy batch
        addBatchCategoryRow('Articles divers', 1, batch.itemsCount || 1);
    }
    
    document.getElementById('batch-form-title').innerText = 'Modifier le colis';
    document.getElementById('batch-submit-btn').innerHTML = '<span class="material-icons-round">save</span> Mettre à jour';
    document.getElementById('batch-cancel-btn').classList.remove('hidden');
}

function cancelEditBatch() {
    const form = document.getElementById('form-manage-batch');
    if(form) form.reset();
    
    document.getElementById('batch-categories-container').innerHTML = '';
    addBatchCategoryRow(); // Add one empty row
    
    document.getElementById('batch-id').value = '';
    document.getElementById('batch-form-title').innerText = 'Créer un nouveau lot / colis';
    document.getElementById('batch-submit-btn').innerHTML = '<span class="material-icons-round">add</span> Enregistrer le colis';
    document.getElementById('batch-cancel-btn').classList.add('hidden');
}

function renderBatchesList() {
    const db = getDB();
    const list = document.getElementById('batches-list');
    if(!list) return;
    
    if(!db.shipping_batches || db.shipping_batches.length === 0) {
        list.innerHTML = '<p class="text-muted text-sm">Aucun colis enregistré.</p>';
        return;
    }
    
    const sorted = [...db.shipping_batches].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    list.innerHTML = sorted.map(b => {
        let detailsHtml = '';
        if (b.items && b.items.length > 0) {
            let itemsHtml = b.items.map(i => `<div style="display:flex; justify-content:space-between; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 2px;"><span>${i.qty}x ${i.category} (${i.unitWeight}kg)</span> <strong style="color:var(--accent-gold);">${i.computedCost.toFixed(2)}€/u</strong></div>`).join('');
            detailsHtml = `<div class="mt-2 text-xs" style="background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">${itemsHtml}</div>`;
        } else {
            // Legacy
            detailsHtml = `<div class="mt-1 text-xs">Articles: ${b.itemsCount} <strong style="color:var(--accent-gold);">${b.unitCost.toFixed(2)}€/u</strong></div>`;
        }
        
        return `
        <div class="glass-panel" style="padding: 10px; font-size: 0.9rem;">
            <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-accent-gold">${b.ref} (${b.totalCost}€)</span>
                <div class="flex gap-2">
                    <button onclick="openEditBatch('${b.id}')" class="btn-icon secondary text-sm" title="Modifier"><span class="material-icons-round" style="font-size:1rem;">edit</span></button>
                    <button onclick="deleteBatch('${b.id}')" class="btn-icon danger text-sm" title="Supprimer"><span class="material-icons-round" style="font-size:1rem;">delete</span></button>
                </div>
            </div>
            ${detailsHtml}
        </div>
    `}).join('');
}

async function deleteBatch(id) {
    if(confirm("Voulez-vous vraiment supprimer ce colis de l'historique ?")) {
        await deleteDoc('shipping_batches', id);
        renderBatchesList();
    }
}

function getBatchOptionsHtml() {
    const db = getDB();
    if(!db.shipping_batches || db.shipping_batches.length === 0) return '<option value="">Aucun lot sélectionné...</option>';
    
    let html = '<option value="">Aucun lot sélectionné...</option>';
    const sortedBatches = [...db.shipping_batches].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    sortedBatches.forEach(b => {
        if(b.items && b.items.length > 0) {
            html += `<optgroup label="${b.ref} (${b.totalCost}€)">`;
            b.items.forEach(item => {
                // Escape quotes in category just in case
                const safeCat = item.category.replace(/"/g, '&quot;');
                html += `<option value="${b.id}::${safeCat}">${item.category} (${item.computedCost.toFixed(2)}€/u)</option>`;
            });
            html += `</optgroup>`;
        } else {
            // Legacy batch
            html += `<option value="${b.id}">${b.ref} (${(b.unitCost || 0).toFixed(2)}€/u)</option>`;
        }
    });
    
    return html;
}

function getBatchImportCost(lotValue) {
    if(!lotValue) return 0;
    const db = getDB();
    const parts = lotValue.split('::');
    const batchId = parts[0];
    const category = parts[1];
    
    const batch = (db.shipping_batches || []).find(b => b.id === batchId);
    if(batch) {
        if (category && batch.items) {
            const item = batch.items.find(i => i.category === category);
            if(item) return item.computedCost;
        }
        return batch.unitCost || 0;
    }
    return 0;
}

function getBatchDisplayRef(lotValue) {
    if(!lotValue) return '';
    const db = getDB();
    const parts = lotValue.split('::');
    const batchId = parts[0];
    const category = parts[1];
    
    const batch = (db.shipping_batches || []).find(b => b.id === batchId);
    if(batch) {
        if (category) return `${batch.ref} - ${category}`;
        return batch.ref;
    }
    return lotValue;
}

function updateImportCostFromBatch() {
    const select = document.getElementById('vinted-lot');
    const importCostInput = document.getElementById('vinted-import-cost');
    
    if(!select || !importCostInput) return;
    
    importCostInput.value = getBatchImportCost(select.value).toFixed(2);
}

// --- VINTED / LEBONCOIN STOCK MANAGEMENT ---

async function addVintedProduct(e) {
    e.preventDefault();
    const idField = document.getElementById('vinted-id');
    const isUpdate = idField && idField.value !== '';
    const currentEditId = isUpdate ? idField.value : null;

    const title = document.getElementById('vinted-title').value;
    const color = document.getElementById('vinted-color').value;
    const purchasePrice = parseFloat(document.getElementById('vinted-purchase-price').value);
    const qty = parseInt(document.getElementById('vinted-qty').value);
    const lotNumber = document.getElementById('vinted-lot').value || '';
    const importCost = parseFloat(document.getElementById('vinted-import-cost').value) || 0;
    const photo = document.getElementById('vinted-preview-photo').src;
    
    if(!title || isNaN(purchasePrice) || isNaN(qty) || qty < 1) {
        alert("Veuillez remplir correctement tous les champs obligatoires.");
        return;
    }
    
    const validPhoto = (photo && photo.startsWith('data:')) ? photo : '';
    const db = getDB();
    
    if (isUpdate) {
        const product = db.vinted_stock.find(p => p.id === currentEditId);
        if (product) {
            // Update available qty based on difference
            const diff = qty - product.initialQty;
            product.initialQty = qty;
            product.availableQty += diff;
            if(product.availableQty < 0) product.availableQty = 0; // Prevent negative
            
            product.title = title;
            product.color = color;
            product.purchasePrice = purchasePrice;
            product.lotNumber = lotNumber;
            product.importCost = importCost;
            if(validPhoto) product.photo = validPhoto;
            
            await saveDoc('vinted_stock', product);
            alert("✅ Produit mis à jour avec succès !");
        }
    } else {
        const newStock = {
            id: generateId('vst_'),
            title,
            color,
            purchasePrice,
            lotNumber,
            importCost,
            initialQty: qty,
            availableQty: qty,
            soldQty: 0,
            photo: validPhoto,
            sales: [], // Will track individual sales: { price, bordereau, status }
            createdAt: new Date().toISOString()
        };
        await saveDoc('vinted_stock', newStock);
        alert("✅ Produit ajouté au stock avec succès !");
    }
    
    cancelEditVinted();
}

window.editVintedProduct = function(id) {
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === id);
    if(!product) return;
    
    document.getElementById('vinted-id').value = product.id;
    document.getElementById('vinted-title').value = product.title;
    document.getElementById('vinted-color').value = product.color || '';
    document.getElementById('vinted-purchase-price').value = product.purchasePrice;
    document.getElementById('vinted-qty').value = product.initialQty;
    document.getElementById('vinted-lot').value = product.lotNumber || '';
    document.getElementById('vinted-import-cost').value = product.importCost || 0;
    
    if(product.photo) {
        document.getElementById('vinted-preview-photo').src = product.photo;
        document.getElementById('vinted-preview-photo').classList.remove('hidden');
    }
    
    document.getElementById('btn-submit-vinted').innerHTML = '<span class="material-icons-round">save</span> Enregistrer les modifications';
    document.getElementById('btn-cancel-vinted').classList.remove('hidden');
    
    // Scroll to top
    document.getElementById('admin-view-stock').scrollIntoView({behavior: "smooth"});
};

function cancelEditVinted() {
    document.getElementById('vinted-id').value = '';
    document.getElementById('vinted-title').value = '';
    document.getElementById('vinted-color').value = '';
    document.getElementById('vinted-purchase-price').value = '';
    document.getElementById('vinted-qty').value = '1';
    document.getElementById('vinted-preview-photo').src = '';
    document.getElementById('vinted-preview-photo').classList.add('hidden');
    document.getElementById('vinted-upload-photo').value = '';
    
    document.getElementById('btn-submit-vinted').innerHTML = '<span class="material-icons-round">add</span> Ajouter au Stock';
    document.getElementById('btn-cancel-vinted').classList.add('hidden');
}

async function markProductSold(id) {
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === id);
    if(!product) return;
    if(product.availableQty <= 0) {
        alert("Rupture de stock !");
        return;
    }
    
    // Switch to new sale registration tab and pre-select the product
    switchAdminTab('salereg');
    setTimeout(() => {
        const select = document.getElementById('sale-product-id');
        if(select) select.value = id;
    }, 100);
}

async function renderSaleRegistration() {
    const db = getDB();
    
    // Ensure the array exists
    if(!db.sales_platforms) db.sales_platforms = [];
    
    // Extract all platforms (custom + historical) to prevent missing legacy platforms
    let allPlatforms = new Set((db.sales_platforms || []).map(p => p.name));
    if (db.vinted_stock) {
        db.vinted_stock.forEach(prod => {
            if (prod.sales) {
                prod.sales.forEach(s => {
                    if (s.platform) allPlatforms.add(s.platform);
                });
            }
        });
    }
    const sortedPlatforms = Array.from(allPlatforms).sort();

    // Populate platforms
    const platformList = document.getElementById('sales-platforms-list');
    const platformSelect = document.getElementById('sale-platform');
    const filterPlatform = document.getElementById('filter-sales-platform');
    
    if(platformList) {
        platformList.innerHTML = (db.sales_platforms || []).map(p => `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                <span>${p.name}</span>
                <button onclick="deleteSalesPlatform('${p.id}')" class="btn-icon danger text-sm"><span class="material-icons-round" style="font-size:1rem;">delete</span></button>
            </div>
        `).join('');
    }
    if(platformSelect) {
        platformSelect.innerHTML = '<option value="">Sélectionnez une plateforme...</option>' + 
            sortedPlatforms.map(name => `<option value="${name}">${name}</option>`).join('');
    }
    if (filterPlatform) {
        const currentValue = filterPlatform.value;
        filterPlatform.innerHTML = '<option value="all">Toutes</option>' + 
            sortedPlatforms.map(name => `<option value="${name}">${name}</option>`).join('');
        // Restore previous selection if it still exists
        if ([...filterPlatform.options].some(o => o.value === currentValue)) {
            filterPlatform.value = currentValue;
        }
    }
    
    // Populate products
    const productSelect = document.getElementById('sale-product-id');
    if(productSelect) {
        const availableProducts = db.vinted_stock.filter(p => p.availableQty > 0);
        productSelect.innerHTML = '<option value="">Sélectionnez un article en stock...</option>' + 
            availableProducts.map(p => `<option value="${p.id}">${p.title} - Reste ${p.availableQty}</option>`).join('');
    }
}

async function addSalesPlatform() {
    const input = document.getElementById('new-platform-name');
    const name = input.value.trim();
    if(!name) return;
    
    const newPlatform = { id: generateId('plat_'), name };
    await saveDoc('sales_platforms', newPlatform);
    input.value = '';
}

async function deleteSalesPlatform(id) {
    if(confirm("Supprimer cette plateforme ?")) {
        await deleteDoc('sales_platforms', id);
    }
}

async function submitNewSale(e) {
    e.preventDefault();
    const db = getDB();
    
    const productId = document.getElementById('sale-product-id').value;
    const platform = document.getElementById('sale-platform').value;
    const buyer = document.getElementById('sale-buyer-name').value;
    const sellPrice = parseFloat(document.getElementById('sale-sell-price').value);
    const shippingCost = parseFloat(document.getElementById('sale-shipping-cost').value) || 0;
    const bordereau = document.getElementById('sale-bordereau').value;
    const paymentStatusEl = document.getElementById('sale-payment-status');
    const paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'payé';
    
    if(!productId || !platform || isNaN(sellPrice)) {
        alert("Veuillez remplir les champs obligatoires.");
        return;
    }
    
    const product = db.vinted_stock.find(p => p.id === productId);
    if(!product) return;
    
    if(product.availableQty <= 0) {
        alert("Ce produit est en rupture de stock.");
        return;
    }
    
    product.availableQty -= 1;
    product.soldQty = (product.soldQty || 0) + 1;
    
    if(!product.sales) product.sales = [];
    
    product.sales.push({
        saleId: generateId('vsl_'),
        platform: platform,
        buyer: buyer || 'Inconnu',
        sellPrice: sellPrice,
        shippingCost: shippingCost,
        bordereau: bordereau || '',
        paymentStatus: paymentStatus,
        status: 'à expédier',
        date: new Date().toISOString()
    });
    
    try {
        await saveDoc('vinted_stock', product);
        alert("✅ Vente enregistrée avec succès !");
        e.target.reset();
        switchAdminTab('sales'); // Rediriger vers le suivi des ventes
    } catch (err) {
        // Error already handled and notified by saveDoc
        console.error("Failed to save sale:", err);
    }
}

async function markProductShipped(productId, saleId) {
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === productId);
    if(!product || !product.sales) return;
    
    const sale = product.sales.find(s => s.saleId === saleId);
    if(!sale) return;
    
    if(confirm("Confirmez-vous que ce colis a bien été déposé/expédié ?")) {
        sale.status = 'envoyé';
        await saveDoc('vinted_stock', product);
    }
}

async function deleteVintedProduct(id) {
    if(confirm("Voulez-vous vraiment supprimer ce produit de votre stock ? (Action irréversible)")) {
        await deleteDoc('vinted_stock', id);
    }
}

async function deleteVintedSale(productId, saleId) {
    if(!confirm("Voulez-vous vraiment annuler et supprimer cette vente ? Le produit retournera en stock.")) return;
    
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === productId);
    if(!product || !product.sales) return;
    
    const saleIndex = product.sales.findIndex(s => s.saleId === saleId);
    if(saleIndex === -1) return;
    
    // Remove the sale
    product.sales.splice(saleIndex, 1);
    
    // Update quantities
    product.availableQty = (product.availableQty || 0) + 1;
    product.soldQty = Math.max(0, (product.soldQty || 1) - 1);
    
    await saveDoc('vinted_stock', product);
}

function openEditSaleModal(productId, saleId) {
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === productId);
    if(!product || !product.sales) return;
    
    const sale = product.sales.find(s => s.saleId === saleId);
    if(!sale) return;
    
    // Synchroniser toutes les plateformes (existantes + historiques des ventes)
    const platformSelect = document.getElementById('edit-sale-platform');
    if(platformSelect) {
        let allPlatforms = new Set((db.sales_platforms || []).map(p => p.name));
        
        // Parcourir toutes les ventes pour récupérer les plateformes déjà saisies
        db.vinted_stock.forEach(prod => {
            if(prod.sales) {
                prod.sales.forEach(s => {
                    if(s.platform) allPlatforms.add(s.platform);
                });
            }
        });
        
        const sortedPlatforms = Array.from(allPlatforms).sort();
        
        platformSelect.innerHTML = '<option value="">Sélectionnez une plateforme...</option>' + 
            sortedPlatforms.map(name => `<option value="${name}">${name}</option>`).join('');
    }
    
    // Populate batches/lots
    const batchSelect = document.getElementById('edit-sale-lot');
    if(batchSelect) {
        batchSelect.innerHTML = getBatchOptionsHtml();
    }
    
    document.getElementById('edit-sale-product-id').value = productId;
    document.getElementById('edit-sale-id').value = saleId;
    
    document.getElementById('edit-sale-buyer').value = sale.buyer || '';
    if(platformSelect) platformSelect.value = sale.platform || '';
    if(batchSelect) batchSelect.value = product.lotNumber || '';
    document.getElementById('edit-sale-sell-price').value = sale.sellPrice;
    document.getElementById('edit-sale-shipping').value = sale.shippingCost || 0;
    document.getElementById('edit-sale-import-cost').value = product.importCost || 0;
    document.getElementById('edit-sale-bordereau').value = sale.bordereau || '';
    
    const paymentStatusEl = document.getElementById('edit-sale-payment-status');
    if (paymentStatusEl) paymentStatusEl.value = sale.paymentStatus || 'payé';
    
    document.getElementById('modal-edit-sale').classList.remove('hidden');
}

function updateImportCostInEditSale() {
    const select = document.getElementById('edit-sale-lot');
    const importCostInput = document.getElementById('edit-sale-import-cost');
    
    if(!select || !importCostInput) return;
    
    importCostInput.value = getBatchImportCost(select.value).toFixed(2);
}

async function submitEditSale(e) {
    e.preventDefault();
    const db = getDB();
    
    const productId = document.getElementById('edit-sale-product-id').value;
    const saleId = document.getElementById('edit-sale-id').value;
    
    const buyer = document.getElementById('edit-sale-buyer').value;
    const platform = document.getElementById('edit-sale-platform').value;
    const lotNumber = document.getElementById('edit-sale-lot').value;
    const importCost = parseFloat(document.getElementById('edit-sale-import-cost').value) || 0;
    const sellPrice = parseFloat(document.getElementById('edit-sale-sell-price').value);
    const shippingCost = parseFloat(document.getElementById('edit-sale-shipping').value) || 0;
    const bordereau = document.getElementById('edit-sale-bordereau').value;
    const paymentStatusEl = document.getElementById('edit-sale-payment-status');
    const paymentStatus = paymentStatusEl ? paymentStatusEl.value : 'payé';
    
    if(!platform || isNaN(sellPrice)) {
        alert("Veuillez remplir les champs obligatoires (Plateforme et Prix de vente).");
        return;
    }
    
    const product = db.vinted_stock.find(p => p.id === productId);
    if(!product || !product.sales) return;
    
    const sale = product.sales.find(s => s.saleId === saleId);
    if(!sale) return;
    
    sale.buyer = buyer || 'Inconnu';
    sale.platform = platform;
    sale.sellPrice = sellPrice;
    sale.shippingCost = shippingCost;
    sale.bordereau = bordereau;
    sale.paymentStatus = paymentStatus;
    
    product.lotNumber = lotNumber;
    product.importCost = importCost;
    
    await saveDoc('vinted_stock', product);
    
    closeModal('modal-edit-sale');
    // We don't need to alert to save user clicks, just re-render
    renderVintedSales();
    renderVintedStock();
}

function renderVintedStock() {
    const db = getDB();
    const list = document.getElementById('admin-stock-list');
    
    // Populate batch select
    const batchSelect = document.getElementById('vinted-lot');
    if(batchSelect) {
        const currentVal = batchSelect.value;
        batchSelect.innerHTML = getBatchOptionsHtml();
        if(currentVal) batchSelect.value = currentVal;
    }
    
    const profitCounter = document.getElementById('admin-stock-total-profit');
    const revenueCounter = document.getElementById('admin-stock-total-revenue');
    const costsCounter = document.getElementById('admin-stock-total-costs');
    
    if(!list) return;
    
    list.innerHTML = '';
    let totalProfit = 0;
    let totalRevenue = 0;
    let totalCosts = 0;
    
    // Sort descending by creation date
    const sortedStock = [...db.vinted_stock].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    sortedStock.forEach(p => {
        let productProfit = 0;
        const importCost = p.importCost || 0;
        
        if(p.sales && p.sales.length > 0) {
            p.sales.forEach(sale => {
                const shipping = sale.shippingCost || 0;
                const profit = sale.sellPrice - p.purchasePrice - shipping - importCost;
                
                productProfit += profit;
                totalProfit += profit;
                totalRevenue += sale.sellPrice;
                totalCosts += (p.purchasePrice + shipping + importCost);
            });
        }
    
        let stockStatus = '';
        if (p.availableQty > 1) {
            stockStatus = `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success);">En Stock (${p.availableQty})</span>`;
        } else if (p.availableQty === 1) {
            stockStatus = `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); animation: pulse 2s infinite;">Dernier article !</span>`;
        } else {
            stockStatus = `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger);">Rupture</span>`;
        }

        const card = document.createElement('div');
        card.className = 'glass-panel flex flex-col justify-between';
        card.style.padding = '15px';
        
        const photoUrl = p.photo || 'https://via.placeholder.com/150?text=No+Photo';
        
        let batchRefDisplay = getBatchDisplayRef(p.lotNumber);
        
        const lotBadge = p.lotNumber ? `<div class="badge" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-size: 0.7rem; margin-top: 5px;">📦 Lot: ${batchRefDisplay} (Import: ${importCost.toFixed(2)}€)</div>` : '';
        
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3">
                    <img src="${photoUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div class="flex gap-2">
                        ${stockStatus}
                        <button onclick="deleteVintedProduct('${p.id}')" class="btn-icon danger text-sm" title="Supprimer"><span class="material-icons-round">delete</span></button>
                    </div>
                </div>
                <h4 style="font-size: 1.1rem; margin-bottom: 5px;">${p.title}</h4>
                <div class="text-sm text-muted mb-2">Couleur: ${p.color || 'N/A'}</div>
                ${lotBadge}
                
                <div class="grid-layout mt-3" style="grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; font-size: 0.9rem;">
                    <div style="background: var(--bg-body); padding: 8px; border-radius: 6px;">
                        <div class="text-muted text-xs">Prix Achat (+Import)</div>
                        <div class="font-bold">${(p.purchasePrice + importCost).toFixed(2)} €</div>
                    </div>
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 8px; border-radius: 6px;">
                        <div class="text-muted text-xs">Bénéfice (Sur Ventes)</div>
                        <div class="font-bold" style="color: var(--success);">${productProfit > 0 ? '+' : ''}${productProfit.toFixed(2)} €</div>
                    </div>
                </div>
                
                <div class="text-sm mb-3">
                    Quantité totale : <strong>${p.initialQty}</strong><br>
                    Vendus : <strong>${p.soldQty}</strong>
                </div>
            </div>
            
            <div class="mt-2 pt-3" style="border-top: 1px solid var(--border-color); display: flex; flex-wrap: wrap; gap: 8px;">
                <button class="btn-secondary flex-1 flex items-center justify-center gap-1" onclick="editVintedProduct('${p.id}')" style="padding: 6px;">
                    <span class="material-icons-round text-sm">edit</span> Modifier
                </button>
                <button class="btn-secondary flex-1 flex items-center justify-center gap-1" onclick="printProductLabel('${p.id}')" title="Imprimer Étiquette" style="padding: 6px;">
                    <span class="material-icons-round text-sm">qr_code_2</span> Étiquette
                </button>
                <button class="btn-primary w-full flex items-center justify-center gap-1 mt-1" onclick="markProductSold('${p.id}')" ${p.availableQty <= 0 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    <span class="material-icons-round text-sm">sell</span> Vendre (1)
                </button>
            </div>
        `;
        list.appendChild(card);
    });
    
    if(profitCounter) {
        profitCounter.innerText = totalProfit > 0 ? `+${totalProfit.toFixed(2)} €` : `${totalProfit.toFixed(2)} €`;
    }
    if(revenueCounter) {
        revenueCounter.innerText = `${totalRevenue.toFixed(2)} €`;
    }
    if(costsCounter) {
        costsCounter.innerText = `${totalCosts.toFixed(2)} €`;
    }
}

let salesTrendChartInstance = null;
let salesPlatformChartInstance = null;

function renderVintedSales() {
    const db = getDB();
    const list = document.getElementById('admin-sales-list');
    
    // UI Elements
    const countCounter = document.getElementById('admin-sales-count');
    const profitCounter = document.getElementById('admin-sales-total-profit');
    const revenueCounter = document.getElementById('admin-sales-total-revenue');
    const costsCounter = document.getElementById('admin-sales-total-costs');
    const roiCounter = document.getElementById('admin-sales-roi');
    const avgProfitCounter = document.getElementById('admin-sales-avg-profit');
    
    // Filters
    const periodFilter = document.getElementById('filter-sales-period') ? document.getElementById('filter-sales-period').value : 'all';
    const platformFilter = document.getElementById('filter-sales-platform') ? document.getElementById('filter-sales-platform').value : 'all';
    const statusFilter = document.getElementById('filter-sales-status') ? document.getElementById('filter-sales-status').value : 'all';

    if(!list) return;
    list.innerHTML = '';
    
    // Extract all sales from all products
    let allSales = [];
    db.vinted_stock.forEach(p => {
        if(p.sales && p.sales.length > 0) {
            p.sales.forEach(sale => {
                const shipping = sale.shippingCost || 0;
                const importCost = p.importCost || 0;
                const profit = sale.sellPrice - p.purchasePrice - shipping - importCost;
                
                allSales.push({
                    ...sale,
                    productId: p.id,
                    productTitle: p.title,
                    productPhoto: p.photo || 'https://via.placeholder.com/150?text=No+Photo',
                    purchasePrice: p.purchasePrice,
                    importCost: importCost,
                    profit: profit,
                    shipping: shipping,
                    lotNumber: p.lotNumber
                });
            });
        }
    });
    
    // Apply Filters
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDay6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    allSales = allSales.filter(sale => {
        const saleDate = new Date(sale.date);
        
        // Period Filter
        if (periodFilter === 'this_month' && saleDate < firstDayThisMonth) return false;
        if (periodFilter === 'last_month' && (saleDate < firstDayLastMonth || saleDate >= firstDayThisMonth)) return false;
        if (periodFilter === '6_months' && saleDate < firstDay6MonthsAgo) return false;
        
        // Platform Filter
        const pName = (sale.platform || '').trim().toLowerCase();
        if (platformFilter !== 'all' && pName !== platformFilter.toLowerCase()) return false;
        
        // Status Filter
        if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
        
        return true;
    });
    
    // Sort sales by date descending
    allSales.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate KPIs
    let totalProfit = 0;
    let totalRevenue = 0;
    let totalCosts = 0;
    let pendingRevenue = 0;
    let completedSalesCount = 0;
    
    allSales.forEach(sale => {
        if (sale.paymentStatus === 'en_attente') {
            pendingRevenue += sale.sellPrice;
        } else {
            totalProfit += sale.profit;
            totalRevenue += sale.sellPrice;
            totalCosts += (sale.purchasePrice + sale.shipping + sale.importCost);
            completedSalesCount++;
        }
    });
    
    const count = allSales.length;
    const roi = totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0;
    const avgProfit = completedSalesCount > 0 ? totalProfit / completedSalesCount : 0;
    
    // Update KPI DOM
    const pendingCounter = document.getElementById('admin-sales-pending-revenue');
    if(countCounter) countCounter.innerText = count;
    if(profitCounter) profitCounter.innerText = totalProfit > 0 ? `+${totalProfit.toFixed(2)} €` : `${totalProfit.toFixed(2)} €`;
    if(revenueCounter) revenueCounter.innerText = `${totalRevenue.toFixed(2)} €`;
    if(pendingCounter) pendingCounter.innerText = `${pendingRevenue.toFixed(2)} €`;
    if(costsCounter) costsCounter.innerText = `${totalCosts.toFixed(2)} €`;
    if(roiCounter) {
        roiCounter.innerText = `${roi.toFixed(1)}%`;
        roiCounter.style.color = roi >= 0 ? '#10b981' : '#ef4444';
    }
    if(avgProfitCounter) avgProfitCounter.innerText = `${avgProfit.toFixed(2)} €`;
    
    // Generate Charts
    generateSalesCharts(allSales);
    
    if(allSales.length === 0) {
        list.innerHTML = '<p class="text-muted text-center py-4">Aucune vente ne correspond à vos critères.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'w-full text-left';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
        <thead>
            <tr style="border-bottom: 2px solid var(--border-color);">
                <th class="p-2">Produit</th>
                <th class="p-2">Colis / Type</th>
                <th class="p-2">Plateforme</th>
                <th class="p-2">Acheteur</th>
                <th class="p-2">Prix de Vente</th>
                <th class="p-2">Bénéfice Net</th>
                <th class="p-2">Statut / Action</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    
    allSales.forEach(sale => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';
        
        let actionBtn = '';
        let statusBadge = '';
        
        if(sale.status === 'à expédier') {
            statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: var(--danger); font-size:0.7rem;">À Expédier</span>`;
            actionBtn = `<button class="btn-primary mt-1" style="padding: 2px 8px; font-size:0.7rem;" onclick="markProductShipped('${sale.productId}', '${sale.saleId}')">Expédié ?</button>`;
        } else {
            statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--success); font-size:0.7rem;">Envoyé</span>`;
        }
        
        const bordereauLink = sale.bordereau ? `<a href="${sale.bordereau}" target="_blank" style="color:var(--primary); text-decoration:underline; font-size: 0.8rem; display:block; margin-top:3px;">Bordereau</a>` : '';
        const buyerName = sale.buyer || 'Inconnu';
        const platformName = sale.platform || 'N/A';
        
        const dateObj = new Date(sale.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR');
        
        let paymentBadge = '';
        if (sale.paymentStatus === 'en_attente') {
            paymentBadge = `<div style="margin-top:4px;"><span class="badge" style="background: rgba(252, 211, 77, 0.2); color: #fcd34d; font-size:0.65rem; padding: 2px 6px;">Paiement en attente</span></div>`;
        } else {
            paymentBadge = `<div style="margin-top:4px;"><span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-size:0.65rem; padding: 2px 6px;">Payé</span></div>`;
        }
        
        tr.innerHTML = `
            <td class="p-2" style="min-width: 200px;">
                <div class="flex items-center gap-2">
                    <img src="${sale.productPhoto}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                    <div>
                        <div class="font-bold text-sm">${sale.productTitle}</div>
                        <div class="text-xs text-muted">${dateStr}</div>
                    </div>
                </div>
            </td>
            <td class="p-2 text-sm text-muted" style="min-width: 120px;">${getBatchDisplayRef(sale.lotNumber) || '-'}</td>
            <td class="p-2 text-sm" style="min-width: 100px;"><span class="badge" style="background: rgba(255,255,255,0.1);">${platformName}</span></td>
            <td class="p-2 text-sm" style="min-width: 100px;">
                <strong>${buyerName}</strong>
                ${paymentBadge}
            </td>
            <td class="p-2" style="min-width: 150px;">
                <div class="text-sm">Vente: <strong>${sale.sellPrice}€</strong></div>
                <div class="text-xs text-muted">Achat: ${sale.purchasePrice}€ | Import: ${sale.importCost}€ | Frais: ${sale.shipping}€</div>
            </td>
            <td class="p-2" style="min-width: 100px;">
                <div class="font-bold" style="color: ${sale.profit > 0 ? 'var(--success)' : 'inherit'};">${sale.profit > 0 ? '+' : ''}${sale.profit.toFixed(2)} €</div>
            </td>
            <td class="p-2" style="min-width: 120px;">
                <div>${statusBadge}</div>
                ${bordereauLink}
                <div class="flex gap-2 items-center mt-2">
                    ${actionBtn}
                    <button class="btn-icon secondary mt-1" style="font-size:1rem; padding: 2px;" onclick="generateInvoice('${sale.productId}', '${sale.saleId}')" title="Générer Facture PDF"><span class="material-icons-round" style="font-size:1.1rem;">receipt</span></button>
                    <button class="btn-icon secondary mt-1" style="font-size:1rem; padding: 2px;" onclick="openEditSaleModal('${sale.productId}', '${sale.saleId}')" title="Modifier cette vente"><span class="material-icons-round" style="font-size:1.1rem;">edit</span></button>
                    <button class="btn-icon danger mt-1" style="font-size:1rem; padding: 2px;" onclick="deleteVintedSale('${sale.productId}', '${sale.saleId}')" title="Annuler et supprimer cette vente"><span class="material-icons-round" style="font-size:1.1rem;">delete</span></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    const wrapper = document.createElement('div');
    wrapper.style.overflowX = 'auto';
    wrapper.appendChild(table);
    list.appendChild(wrapper);
    
    // --- ANALYTICS V2 : Objectifs et Tops ---
    
    // 1. Goal Progress
    const monthlyGoal = parseFloat(localStorage.getItem('adminSalesGoal')) || 1000;
    let goalPercentage = (totalProfit / monthlyGoal) * 100;
    if (goalPercentage < 0) goalPercentage = 0;
    if (goalPercentage > 100) goalPercentage = 100;
    
    const goalText = document.getElementById('admin-sales-goal-text');
    const goalBar = document.getElementById('admin-sales-goal-bar');
    if (goalText) goalText.innerText = `${totalProfit.toFixed(2)} € / ${monthlyGoal} €`;
    if (goalBar) {
        goalBar.style.width = `${goalPercentage}%`;
        if (goalPercentage < 33) goalBar.style.background = 'var(--danger)';
        else if (goalPercentage < 80) goalBar.style.background = 'var(--warning)';
        else goalBar.style.background = 'var(--success)';
    }

    // 2. Top Products & Platforms
    const productProfits = {};
    const platformProfits = {};

    allSales.forEach(sale => {
        if(sale.paymentStatus !== 'en_attente') {
            // Product
            if (!productProfits[sale.productId]) {
                productProfits[sale.productId] = { title: sale.productTitle, profit: 0, photo: sale.productPhoto };
            }
            productProfits[sale.productId].profit += sale.profit;
            
            // Platform
            const pName = sale.platform || 'Inconnu';
            if (!platformProfits[pName]) {
                platformProfits[pName] = { name: pName, profit: 0 };
            }
            platformProfits[pName].profit += sale.profit;
        }
    });

    const topProducts = Object.values(productProfits).sort((a,b) => b.profit - a.profit).slice(0, 5);
    const topPlatforms = Object.values(platformProfits).sort((a,b) => b.profit - a.profit).slice(0, 5);

    const topProductsEl = document.getElementById('admin-top-products');
    if (topProductsEl) {
        if (topProducts.length === 0) topProductsEl.innerHTML = '<p class="text-muted text-sm">Aucune donnée.</p>';
        else {
            topProductsEl.innerHTML = topProducts.map((p, idx) => `
                <div class="flex items-center justify-between p-2 rounded" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex items-center gap-2">
                        <div class="text-sm font-bold text-muted w-4">${idx+1}.</div>
                        <img src="${p.photo}" style="width:30px; height:30px; border-radius:4px; object-fit:cover;">
                        <span class="text-sm truncate" style="max-width: 150px;" title="${p.title}">${p.title}</span>
                    </div>
                    <strong style="color:var(--success); font-size:0.9rem;">+${p.profit.toFixed(2)}€</strong>
                </div>
            `).join('');
        }
    }

    const topPlatformsEl = document.getElementById('admin-top-platforms');
    if (topPlatformsEl) {
        if (topPlatforms.length === 0) topPlatformsEl.innerHTML = '<p class="text-muted text-sm">Aucune donnée.</p>';
        else {
            topPlatformsEl.innerHTML = topPlatforms.map((p, idx) => `
                <div class="flex items-center justify-between p-2 rounded" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex items-center gap-2">
                        <div class="text-sm font-bold text-muted w-4">${idx+1}.</div>
                        <span class="text-sm font-bold">${p.name}</span>
                    </div>
                    <strong style="color:var(--success); font-size:0.9rem;">+${p.profit.toFixed(2)}€</strong>
                </div>
            `).join('');
        }
    }
}

window.promptSalesGoal = function() {
    const currentGoal = parseFloat(localStorage.getItem('adminSalesGoal')) || 1000;
    const newGoal = prompt("Entrez votre nouvel objectif de bénéfice mensuel (€) :", currentGoal);
    if (newGoal !== null) {
        const val = parseFloat(newGoal);
        if (!isNaN(val) && val > 0) {
            localStorage.setItem('adminSalesGoal', val);
            renderVintedSales(); // Refresh UI immediately
        }
    }
}



function generateSalesCharts(allSales) {
    if (typeof Chart === 'undefined') return; // Exit if Chart.js is not loaded
    
    const ctxTrend = document.getElementById('sales-trend-chart');
    const ctxPlatform = document.getElementById('sales-platform-chart');
    
    if (!ctxTrend || !ctxPlatform) return;
    
    // Group by Month (Last 6 Months)
    const months = [];
    const revData = [];
    const profitData = [];
    
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
        revData.push(0);
        profitData.push(0);
    }
    
    // Platform data
    const platCounts = { 'Vinted': 0, 'Leboncoin': 0, 'Autre': 0 };
    
    allSales.forEach(sale => {
        const sd = new Date(sale.date);
        
        // Populate Trend
        const mDiff = (now.getFullYear() - sd.getFullYear()) * 12 + now.getMonth() - sd.getMonth();
        if (mDiff >= 0 && mDiff <= 5) {
            const idx = 5 - mDiff;
            revData[idx] += sale.sellPrice;
            profitData[idx] += sale.profit;
        }
        
        // Populate Platform
        const plat = (sale.platform || '').trim().toLowerCase();
        if (plat === 'vinted') platCounts['Vinted']++;
        else if (plat === 'leboncoin') platCounts['Leboncoin']++;
        else platCounts['Autre']++;
    });

    // Destroy existing instances if present
    if (salesTrendChartInstance) salesTrendChartInstance.destroy();
    if (salesPlatformChartInstance) salesPlatformChartInstance.destroy();
    
    // Chart 1: Trend
    salesTrendChartInstance = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Chiffre d\'Affaires (€)',
                    data: revData,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Bénéfice Net (€)',
                    data: profitData,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc' } }
            }
        }
    });
    
    // Chart 2: Platform Pie
    const platLabels = [];
    const platData = [];
    const platColors = [];
    
    if(platCounts['Vinted'] > 0) { platLabels.push('Vinted'); platData.push(platCounts['Vinted']); platColors.push('#09b1ba'); }
    if(platCounts['Leboncoin'] > 0) { platLabels.push('Leboncoin'); platData.push(platCounts['Leboncoin']); platColors.push('#ff6e14'); }
    if(platCounts['Autre'] > 0) { platLabels.push('Autre'); platData.push(platCounts['Autre']); platColors.push('#94a3b8'); }
    
    if (platData.length === 0) {
        platLabels.push('Aucune vente');
        platData.push(1);
        platColors.push('#333');
    }

    salesPlatformChartInstance = new Chart(ctxPlatform, {
        type: 'doughnut',
        data: {
            labels: platLabels,
            datasets: [{
                data: platData,
                backgroundColor: platColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc', padding: 10 } }
            },
            cutout: '70%'
        }
    });
}

function exportSalesCSV() {
    const db = getDB();
    
    // Get currently applied filters
    const periodFilter = document.getElementById('filter-sales-period') ? document.getElementById('filter-sales-period').value : 'all';
    const platformFilter = document.getElementById('filter-sales-platform') ? document.getElementById('filter-sales-platform').value : 'all';
    const statusFilter = document.getElementById('filter-sales-status') ? document.getElementById('filter-sales-status').value : 'all';

    let allSales = [];
    db.vinted_stock.forEach(p => {
        if(p.sales && p.sales.length > 0) {
            p.sales.forEach(sale => {
                allSales.push({
                    ...sale,
                    productTitle: p.title,
                    purchasePrice: p.purchasePrice,
                    importCost: p.importCost || 0,
                    shipping: sale.shippingCost || 0,
                    profit: sale.sellPrice - p.purchasePrice - (sale.shippingCost || 0) - (p.importCost || 0)
                });
            });
        }
    });
    
    // Apply Filters (same as UI)
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDay6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    allSales = allSales.filter(sale => {
        const saleDate = new Date(sale.date);
        if (periodFilter === 'this_month' && saleDate < firstDayThisMonth) return false;
        if (periodFilter === 'last_month' && (saleDate < firstDayLastMonth || saleDate >= firstDayThisMonth)) return false;
        if (periodFilter === '6_months' && saleDate < firstDay6MonthsAgo) return false;
        
        const pName = (sale.platform || '').trim().toLowerCase();
        if (platformFilter !== 'all' && pName !== platformFilter.toLowerCase()) return false;
        if (statusFilter !== 'all' && sale.status !== statusFilter) return false;
        return true;
    });
    
    if (allSales.length === 0) {
        showNotification("Aucune donnée à exporter avec ces filtres.", "danger");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date;Produit;Acheteur;Plateforme;Statut Expédition;Paiement;Prix de Vente;Prix d'Achat;Frais Import;Frais Port;Benefice Net\n";
    
    allSales.forEach(s => {
        const dateStr = new Date(s.date).toLocaleDateString('fr-FR');
        const paymentStatusLabel = s.paymentStatus === 'en_attente' ? 'En attente' : 'Payé';
        const row = [
            dateStr,
            `"${s.productTitle.replace(/"/g, '""')}"`,
            `"${(s.buyer || '').replace(/"/g, '""')}"`,
            s.platform || 'N/A',
            s.status,
            paymentStatusLabel,
            s.sellPrice.toFixed(2).replace('.', ','),
            s.purchasePrice.toFixed(2).replace('.', ','),
            s.importCost.toFixed(2).replace('.', ','),
            s.shipping.toFixed(2).replace('.', ','),
            s.profit.toFixed(2).replace('.', ',')
        ].join(";");
        csvContent += row + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Export_Ventes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- PHASE 2 : QR CODES ET ETIQUETTES ---

window.printProductLabel = function(productId) {
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === productId);
    if (!product) return;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        showNotification("Veuillez autoriser les pop-ups pour imprimer l'étiquette.", "danger");
        return;
    }
    
    const batchDisplay = getBatchDisplayRef(product.lotNumber) || 'N/A';
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Étiquette - ${product.title}</title>
            <style>
                body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; text-align: center; color: #000; background: #fff; }
                .label-container { border: 2px dashed #000; padding: 20px; border-radius: 8px; display: inline-block; max-width: 300px; }
                h2 { margin: 0 0 10px 0; font-size: 1.2rem; text-transform: uppercase; }
                p { margin: 5px 0; font-size: 0.9rem; }
                #qrcode { margin-top: 15px; display: flex; justify-content: center; }
                @media print {
                    body { padding: 0; }
                    .label-container { border: none; padding: 0; margin: 0 auto; }
                }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        </head>
        <body>
            <div class="label-container">
                <h2>${product.title}</h2>
                <p><strong>Couleur:</strong> ${product.color || 'N/A'}</p>
                <p><strong>Lot:</strong> ${batchDisplay}</p>
                <p><strong>ID:</strong> ${product.id.substring(0,8)}</p>
                <div id="qrcode"></div>
            </div>
            <script>
                window.onload = function() {
                    new QRCode(document.getElementById("qrcode"), {
                        text: "PRODUCT:${product.id}",
                        width: 128,
                        height: 128,
                        colorDark : "#000000",
                        colorLight : "#ffffff",
                        correctLevel : QRCode.CorrectLevel.H
                    });
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

window.calculateIdealPrice = function() {
    const purchaseInput = document.getElementById('vinted-purchase-price');
    const importInput = document.getElementById('vinted-import-cost');
    const marginInput = document.getElementById('calc-margin-target');
    const idealInput = document.getElementById('calc-ideal-price');

    if (!purchaseInput || !marginInput || !idealInput) return;

    const purchase = parseFloat(purchaseInput.value) || 0;
    const importCost = parseFloat(importInput && importInput.value ? importInput.value : 0) || 0;
    const margin = parseFloat(marginInput.value) || 0;

    const totalCost = purchase + importCost;
    
    if (totalCost <= 0) {
        idealInput.value = "0.00 €";
        return;
    }

    // ROI margin calculation: SellPrice = TotalCost + (TotalCost * Margin / 100)
    const idealPrice = totalCost * (1 + (margin / 100));
    idealInput.value = idealPrice.toFixed(2) + " €";
}

// --- PHASE 4 : FACTURATION PDF ---

window.generateInvoice = function(productId, saleId) {
    if (typeof html2pdf === 'undefined') {
        showNotification("La bibliothèque de génération PDF n'est pas chargée.", "danger");
        return;
    }
    
    const db = getDB();
    const product = db.vinted_stock.find(p => p.id === productId);
    if (!product || !product.sales) return;
    
    const sale = product.sales.find(s => s.saleId === saleId);
    if (!sale) return;
    
    // Create hidden invoice container
    const invoiceEl = document.createElement('div');
    invoiceEl.style.padding = '40px';
    invoiceEl.style.fontFamily = 'Inter, sans-serif';
    invoiceEl.style.color = '#000';
    invoiceEl.style.background = '#fff';
    invoiceEl.style.width = '800px';
    invoiceEl.style.position = 'absolute';
    invoiceEl.style.left = '-9999px';
    
    const dateStr = new Date(sale.date).toLocaleDateString('fr-FR');
    const invoiceNumber = `FACT-${new Date().getFullYear()}-${saleId.substring(0,6).toUpperCase()}`;
    
    invoiceEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
                <h1 style="margin: 0; font-size: 28px; color: #000;">SOURCING PRO</h1>
                <p style="margin: 5px 0 0 0; color: #555;">Facture de vente</p>
            </div>
            <div style="text-align: right;">
                <h2 style="margin: 0; color: #000;">FACTURE</h2>
                <p style="margin: 5px 0 0 0; color: #555;">N° ${invoiceNumber}</p>
                <p style="margin: 5px 0 0 0; color: #555;">Date : ${dateStr}</p>
            </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
            <div>
                <h3 style="margin: 0 0 10px 0; color: #000;">Émetteur :</h3>
                <p style="margin: 0; color: #333;">Sourcing Pro (Vendeur)</p>
                <p style="margin: 0; color: #333;">Plateforme : ${sale.platform || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
                <h3 style="margin: 0 0 10px 0; color: #000;">Facturé à :</h3>
                <p style="margin: 0; color: #333; font-weight: bold;">${sale.buyer || 'Client'}</p>
            </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
            <thead>
                <tr style="background: #f0f0f0;">
                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #ddd; color: #000;">Désignation</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #000;">Prix Unitaire</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #000;">Frais de Port</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #000;">Total TTC</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee; color: #333;">${product.title} (Couleur: ${product.color || '-'})</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #333;">${(sale.sellPrice - (sale.shippingCost || 0)).toFixed(2)} €</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #333;">${(sale.shippingCost || 0).toFixed(2)} €</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">${sale.sellPrice.toFixed(2)} €</td>
                </tr>
            </tbody>
        </table>
        
        <div style="display: flex; justify-content: flex-end;">
            <div style="width: 300px;">
                <div style="display: flex; justify-content: space-between; border-top: 2px solid #000; padding-top: 10px;">
                    <strong style="color: #000;">NET À PAYER :</strong>
                    <strong style="color: #000; font-size: 20px;">${sale.sellPrice.toFixed(2)} €</strong>
                </div>
                <p style="text-align: right; font-size: 12px; color: #777; margin-top: 5px;">TVA non applicable, art. 293 B du CGI</p>
                <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                    <strong style="color: #000;">Statut Paiement :</strong>
                    <strong style="color: ${sale.paymentStatus === 'en_attente' ? '#d97706' : '#16a34a'};">${sale.paymentStatus === 'en_attente' ? 'En attente' : 'Acquitté'}</strong>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 60px; text-align: center; color: #777; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
            Merci pour votre achat sur ${sale.platform || 'notre boutique'}.
        </div>
    `;
    
    document.body.appendChild(invoiceEl);
    
    html2pdf().from(invoiceEl).set({
        margin: 10,
        filename: `${invoiceNumber}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save().then(() => {
        document.body.removeChild(invoiceEl);
        showNotification("Facture générée avec succès !");
    });
}

// ==========================================
// SAUVEGARDES ET HISTORIQUE (AUDIT TRAIL)
// ==========================================

async function saveBackupHistory(action, supplierData) {
    if (!supplierData || !supplierData.id) return;
    
    // Create a new document in backups_history collection
    const backupObj = {
        action: action, // 'CREATION', 'MODIFICATION', 'SUPPRESSION'
        timestamp: new Date().toISOString(),
        supplierId: supplierData.id,
        supplierName: supplierData.name || 'Inconnu',
        category: supplierData.category || 'Non classé',
        data: supplierData
    };
    
    try {
        const id = 'backup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        backupObj.id = id;
        
        let db = getDB();
        if (!db.backups_history) db.backups_history = [];
        db.backups_history.push(backupObj);
        
        // Push to Firebase directly
        await firestore.collection('backups_history').doc(id).set(backupObj);
        console.log(`Historique sauvegardé : ${action} pour ${backupObj.supplierName}`);
    } catch (e) {
        console.error("Erreur sauvegarde historique :", e);
    }
}

function renderAdminBackups() {
    let db = getDB();
    const tbody = document.getElementById('admin-backups-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let history = db.backups_history || [];
    // Sort by newest first
    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-8">Aucun historique disponible.</td></tr>';
        return;
    }
    
    let htmlStr = '';
    history.forEach(item => {
        const dateStr = new Date(item.timestamp).toLocaleString('fr-FR', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        
        let actionBadge = '';
        if (item.action === 'CREATION') actionBadge = '<span class="status-badge" style="background:#22c55e20; color:#22c55e;">CRÉATION</span>';
        if (item.action === 'MODIFICATION') actionBadge = '<span class="status-badge" style="background:#eab30820; color:#eab308;">MODIFICATION</span>';
        if (item.action === 'SUPPRESSION') actionBadge = '<span class="status-badge" style="background:#ef444420; color:#ef4444;">SUPPRESSION</span>';
        
        htmlStr += `
        <tr>
            <td>${dateStr}</td>
            <td>${actionBadge}</td>
            <td class="font-bold">${item.supplierName}</td>
            <td><span class="category-badge">${item.category || 'Général'}</span></td>
            <td>
                <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="restoreBackup('${item.id}')">
                    <span class="material-icons-round" style="font-size:1rem;">restore</span> Restaurer
                </button>
            </td>
        </tr>
        `;
    });
    tbody.innerHTML = htmlStr;
}

async function restoreBackup(backupId) {
    if (!confirm("Voulez-vous vraiment restaurer cette ancienne version du fournisseur ? Cela écrasera sa version actuelle sur le site s'il existe toujours.")) return;
    
    const db = getDB();
    const backup = (db.backups_history || []).find(b => b.id === backupId);
    if (!backup) return alert("Sauvegarde introuvable.");
    
    const supplierData = backup.data;
    
    try {
        showLoading();
        // Update in DB object
        const existingIndex = db.users.findIndex(u => u.id === supplierData.id);
        if (existingIndex >= 0) {
            db.users[existingIndex] = supplierData;
        } else {
            db.users.push(supplierData);
        }
        
        // Update in Firestore
        await firestore.collection('users').doc(supplierData.id).set(supplierData);
        
        // Log this restoration as a MODIFICATION (so we have a trail of the restoration)
        await saveBackupHistory('MODIFICATION (RESTAURATION)', supplierData);
        
        hideLoading();
        showNotification("Fournisseur restauré avec succès !");
        
        // Refresh view
        if (!document.getElementById('admin-view-suppliers').classList.contains('hidden')) {
            renderAdminSuppliers();
        }
        
    } catch (e) {
        hideLoading();
        console.error("Erreur restauration :", e);
        alert("Erreur lors de la restauration.");
    }
}

// -----------------------------------------------------
// IMPORT EXCEL SECURISE
// -----------------------------------------------------
async function startExcelImport() {
    if(!confirm("Êtes-vous sûr de vouloir lancer l'importation massive des fournisseurs depuis l'Excel ? (Cette action va traiter plus de 650 fournisseurs. Cela peut prendre quelques secondes. Il n'y aura aucun écrasement.)")) {
        return;
    }
    
    showLoading();
    try {
        // 1. Fetch JSON file
        const response = await fetch('/js/import_data.json');
        if (!response.ok) {
            throw new Error("Impossible de charger import_data.json");
        }
        const suppliersList = await response.json();
        
        let addedCount = 0;
        let skippedCount = 0;
        
        const db = getDB();
        const existingUsers = db.users || [];
        const existingCats = db.categories || [];
        
        // Disable real-time listeners momentarily if they cause too much lag? 
        // Not necessary, we just await saveDoc.
        
        for (const sup of suppliersList) {
            // Check if already exists (by link or exact name)
            const exists = existingUsers.some(u => 
                u.role === 'supplier' && 
                (u.name.toLowerCase() === sup.name.toLowerCase() || 
                (sup.link && u.link && u.link.toLowerCase() === sup.link.toLowerCase()))
            );
            
            if (exists) {
                skippedCount++;
                continue;
            }
            
            // Map category
            let catId = null;
            let catMatch = existingCats.find(c => c.name.toLowerCase() === sup.categoryName.toLowerCase());
            
            if (catMatch) {
                catId = catMatch.id;
            } else {
                // Create new category
                catId = generateId('cat_');
                const newCat = { id: catId, name: sup.categoryName, icon: 'category' };
                await saveDoc('categories', newCat);
                // Update local array for next iterations
                existingCats.push(newCat); 
            }
            
            // Create supplier
            const newUserId = generateId('usr_');
            const newSupplier = {
                id: newUserId,
                name: sup.name,
                company: sup.name,
                email: `import_${newUserId.substring(4,10)}@fournisseur.com`,
                phone: sup.phone || 'N/A',
                role: 'supplier',
                status: 'active',
                isManual: true,
                categoryId: catId,
                description: sup.description,
                link: sup.link,
                isPremium: false,
                createdAt: new Date().toISOString()
            };
            
            // BACKUP HISTORY: Save new creation
            await saveBackupHistory('CREATION', newSupplier);
            await saveDoc('users', newSupplier);
            
            addedCount++;
        }
        
        hideLoading();
        alert(`Importation terminée !\n- ${addedCount} fournisseurs ajoutés.\n- ${skippedCount} fournisseurs ignorés (déjà existants).`);
        
        // Refresh UI
        renderAdminBackups();
        
    } catch (error) {
        hideLoading();
        console.error("Erreur lors de l'importation Excel :", error);
        alert("Erreur lors de l'importation : " + error.message);
    }
}



// ==========================================
// BOUTIQUE E-COMMERCE (ADMIN)
// ==========================================

function switchAdminBoutiqueTab(tab) {
    document.getElementById('admin-boutique-subview-products').classList.add('hidden');
    document.getElementById('admin-boutique-subview-orders').classList.add('hidden');
    const btnOrders = document.getElementById('btn-admin-boutique-orders');
    if(btnOrders) btnOrders.className = 'btn-secondary';
    document.getElementById('admin-boutique-subview-categories').classList.add('hidden');
    document.getElementById('btn-admin-boutique-products').className = 'btn-secondary';
    document.getElementById('btn-admin-boutique-categories').className = 'btn-secondary';

    document.getElementById(`admin-boutique-subview-${tab}`).classList.remove('hidden');
    document.getElementById(`btn-admin-boutique-${tab}`).className = 'btn-primary';

    if (tab === 'products') renderAdminBoutiqueProducts();
    if (tab === 'categories') renderAdminBoutiqueCategories();
    if (tab === 'orders') renderAdminBoutiqueOrders();
}

function renderAdminBoutique() {
    switchAdminBoutiqueTab('orders');
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
        htmlStr += `
        <div class="flex justify-between items-center bg-gray-800 p-3 rounded mb-2">
            <div>${cat.name}</div>
            <button class="btn-danger text-sm" onclick="deleteBoutiqueCategory('${cat.id}')">Supprimer</button>
        </div>`;
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
    let modal = document.getElementById('modal-boutique-product-v2');
    
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-boutique-product-v2';
        modal.className = 'modal-overlay hidden';
        modal.style.zIndex = '2000';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h3 id="boutique-prod-modal-title">Ajouter un produit</h3>
                <form id="boutique-prod-form" onsubmit="saveBoutiqueProduct(event)">
                    
                    <div class="form-group mb-4">
                        <label>Sélectionner un produit du Stock (Optionnel mais recommandé pour synchronisation)</label>
                        <select id="boutique-prod-stock-id" class="input-field" onchange="autoFillBoutiqueFromStock()">
                            <option value="">-- Création Manuelle --</option>
                        </select>
                        <p id="boutique-prod-cost-hint" class="text-xs text-muted mt-1 hidden"></p>
                    </div>

                    <div class="form-group mb-4">
                        <label>Titre du produit *</label>
                        <input type="text" id="boutique-prod-title" required class="input-field">
                    </div>
                    <div class="form-group mb-4">
                        <label>Catégorie *</label>
                        <select id="boutique-prod-category" required class="input-field"></select>
                    </div>
                    <div class="form-group mb-4">
                        <label>Prix de vente (CFA ou Euros) *</label>
                        <input type="number" step="0.01" id="boutique-prod-price" required class="input-field" placeholder="Ex: 50.00">
                    </div>
                    <div class="form-group mb-4">
                        <label>Description *</label>
                        <textarea id="boutique-prod-desc" required class="input-field" rows="3"></textarea>
                    </div>
                    <div class="form-group mb-4">
                        <label>Lien Image Principale *</label>
                        <input type="text" id="boutique-prod-image" required class="input-field" placeholder="https://lien-image.com/img.jpg">
                    </div>
                    <div class="flex gap-2 justify-end mt-6">
                        <button type="button" class="btn-secondary" onclick="document.getElementById('modal-boutique-product-v2').classList.add('hidden')">Annuler</button>
                        <button type="submit" class="btn-primary">Enregistrer</button>
                    </div>
                </form>
            </div>
        `;
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

    // Populate stock select
    const stockSelect = document.getElementById('boutique-prod-stock-id');
    stockSelect.innerHTML = '<option value="">-- Création Manuelle --</option>';
    if(db.vinted_stock) {
        db.vinted_stock.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.innerText = item.title + (item.color ? ` (${item.color})` : '');
            // Store cost info for autofill logic
            const cost = (parseFloat(item.purchasePrice) || 0) + (parseFloat(item.shippingCost) || 0) + (parseFloat(item.agentFee) || 0);
            opt.dataset.cost = cost.toFixed(2);
            opt.dataset.title = item.title;
            opt.dataset.image = item.photoUrl || '';
            stockSelect.appendChild(opt);
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
            document.getElementById('boutique-prod-stock-id').value = prod.stockId || '';
        }
    } else {
        document.getElementById('boutique-prod-modal-title').innerText = "Ajouter un produit";
        document.getElementById('boutique-prod-form').reset();
        document.getElementById('boutique-prod-cost-hint').classList.add('hidden');
    }
    
    modal.classList.remove('hidden');
}

function autoFillBoutiqueFromStock() {
    const select = document.getElementById('boutique-prod-stock-id');
    const hint = document.getElementById('boutique-prod-cost-hint');
    const opt = select.options[select.selectedIndex];
    
    if(opt && opt.value) {
        const title = opt.dataset.title;
        const image = opt.dataset.image;
        const cost = opt.dataset.cost;
        
        document.getElementById('boutique-prod-title').value = title;
        if (image) document.getElementById('boutique-prod-image').value = image;
        
        hint.innerHTML = `Ce produit vous a coûté environ <strong>${cost} €</strong>. Ajustez votre prix de vente en conséquence.`;
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
}

async function saveBoutiqueProduct(e) {
    e.preventDefault();
    const title = document.getElementById('boutique-prod-title').value;
    const categoryId = document.getElementById('boutique-prod-category').value;
    const price = parseFloat(document.getElementById('boutique-prod-price').value);
    const description = document.getElementById('boutique-prod-desc').value;
    const image = document.getElementById('boutique-prod-image').value;
    const stockId = document.getElementById('boutique-prod-stock-id').value;
    
    const prod = {
        id: currentEditBoutiqueProductId || generateId('bprod_'),
        title, categoryId, price, description, image, stockId,
        updatedAt: new Date().toISOString()
    };
    
    try {
        await saveDoc('boutique_products', prod);
        document.getElementById('modal-boutique-product-v2').classList.add('hidden');
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
        htmlStr += `
        <div class="glass-panel" style="padding: 15px;">
            <div style="height: 150px; overflow: hidden; border-radius: 8px; margin-bottom: 10px;">
                <img src="${prod.image || 'https://via.placeholder.com/300'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <h4 style="margin: 0 0 5px 0;">${prod.title}</h4>
            <p class="text-muted text-sm" style="margin: 0 0 10px 0;">${cat ? cat.name : 'Sans catégorie'}</p>
            <p style="font-weight: bold; color: var(--accent-gold); margin: 0 0 15px 0;">${prod.price}</p>
            <div class="flex gap-2">
                <button class="btn-secondary text-sm" onclick="openBoutiqueProductModal('${prod.id}')" style="flex:1;">Modifier</button>
                <button class="btn-danger text-sm" onclick="deleteBoutiqueProduct('${prod.id}')" style="flex:1;">Supprimer</button>
            </div>
        </div>`;
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
            itemsHtml += `<li>${item.quantity}x ${item.title} (${item.price})</li>`;
        });
        itemsHtml += '</ul>';
        
        htmlStr += `
        <div class="glass-panel" style="padding: 1.5rem; border-left: 4px solid ${order.status === 'pending' ? 'var(--warning)' : 'var(--glass-border)'};">
            <div class="flex justify-between items-start mb-4" style="flex-wrap: wrap; gap: 10px;">
                <div>
                    <h4 style="margin: 0 0 5px 0;">Commande ${order.id.replace('bord_', '#')}</h4>
                    <p class="text-muted text-sm m-0">${dateStr}</p>
                </div>
                <div>${statusBadge}</div>
            </div>
            
            <div class="grid-layout" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <strong class="text-warning text-sm">Client :</strong><br>
                    ${order.customerName}<br>
                    📞 ${order.customerPhone}<br>
                    📍 ${order.customerAddress}
                </div>
                <div>
                    <strong class="text-warning text-sm">Notes :</strong><br>
                    ${order.notes || '<span class="text-muted">Aucune note</span>'}
                </div>
            </div>
            
            <strong class="text-warning text-sm">Produits :</strong>
            ${itemsHtml}
            
            <div class="flex justify-between items-center mt-4 pt-4" style="border-top: 1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 1.3rem; font-weight: 900; color: var(--accent-gold);">Total: ${order.total}</div>
                
                <div class="flex gap-2">
                    <select class="input-field" style="padding: 0.4rem; max-width: 150px;" onchange="updateBoutiqueOrderStatus('${order.id}', this.value)">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>En attente</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>En traitement</option>
                        <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Expédiée</option>
                        <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Livrée</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Annulée</option>
                    </select>
                    <button class="btn-danger" style="padding: 0.4rem 0.8rem;" onclick="deleteBoutiqueOrder('${order.id}')"><span class="material-icons-round" style="font-size: 18px;">delete</span></button>
                </div>
            </div>
        </div>
        `;
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
        // Automatic stock deduction
        if ((newStatus === 'shipped' || newStatus === 'delivered') && !order.stockDeducted) {
            if (order.items && order.items.length > 0) {
                for (const item of order.items) {
                    // item.id is the boutique_product id
                    const bProd = db.boutique_products.find(bp => bp.id === item.id);
                    if (bProd && bProd.stockId) {
                        const stockItem = db.vinted_stock.find(vs => vs.id === bProd.stockId);
                        if (stockItem) {
                            stockItem.quantity = Math.max(0, (parseInt(stockItem.quantity) || 0) - (parseInt(item.quantity) || 1));
                            await saveDoc('vinted_stock', stockItem);
                        }
                    }
                }
            }
            order.stockDeducted = true;
        }

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


// ==========================================
// TEAM MANAGEMENT LOGIC (ADMIN)
// ==========================================

function renderAdminTeam() {
    const db = getDB();
    const list = document.getElementById('admin-team-list');
    if(!list) return;
    
    // Find all users who are not normal clients or suppliers (or find all users and we can change their role)
    // Actually, to add a staff, the admin should be able to see ALL users and change their role to staff.
    // BUT we only want to show staff here. So we show staff, AND a select box to add a new one from clients.
    
    const staffMembers = (db.users || []).filter(u => u.role === 'staff_sales' || u.role === 'admin');
    const clients = (db.users || []).filter(u => u.role === 'client' && u.status === 'active');
    
    let html = '';
    
    // Add new staff form
    html += `
    <div class="glass-panel mb-6" style="padding: 1.5rem; border: 1px solid var(--primary);">
        <h4 class="mb-3">Ajouter un collaborateur</h4>
        <div class="flex gap-2" style="flex-wrap: wrap;">
            <select id="team-new-member" class="input-field" style="flex: 1; min-width: 200px;">
                <option value="">-- Sélectionner un client existant --</option>
                ${clients.map(c => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')}
            </select>
            <select id="team-new-role" class="input-field" style="width: 200px;">
                <option value="staff_sales">Chargé(e) de Vente</option>
                <option value="admin">Administrateur</option>
            </select>
            <button class="btn-primary" onclick="addTeamMember()">Ajouter à l'équipe</button>
        </div>
    </div>
    `;
    
    // List staff
    staffMembers.forEach(staff => {
        const isAdmin = staff.role === 'admin';
        const roleLabel = isAdmin ? 'Administrateur' : 'Chargé(e) de Vente';
        const badgeColor = isAdmin ? 'var(--danger)' : 'var(--primary)';
        
        html += `
        <div class="glass-panel flex justify-between items-center" style="padding: 1rem 1.5rem;">
            <div>
                <h4 style="margin: 0 0 5px 0;">${staff.name}</h4>
                <div class="text-muted text-sm">${staff.email}</div>
            </div>
            <div class="flex items-center gap-4">
                <span class="badge" style="background: ${badgeColor};">${roleLabel}</span>
                ${!isAdmin ? `<button class="btn-secondary text-sm" onclick="removeTeamMember('${staff.id}')">Retirer l'accès</button>` : ''}
            </div>
        </div>
        `;
    });
    
    list.innerHTML = html;
}

async function addTeamMember() {
    const userId = document.getElementById('team-new-member').value;
    const role = document.getElementById('team-new-role').value;
    
    if(!userId) return alert("Veuillez sélectionner un utilisateur.");
    
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(!user) return;
    
    if(!confirm(`Êtes-vous sûr de vouloir donner le rôle ${role === 'admin' ? 'Administrateur' : 'Chargé(e) de Vente'} à ${user.name} ?`)) return;
    
    user.role = role;
    
    try {
        await saveDoc('users', user);
        showNotification(user.name + " a été ajouté à l'équipe !", "success");
        renderAdminTeam();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}

async function removeTeamMember(userId) {
    if(!confirm("Voulez-vous vraiment retirer l'accès à ce collaborateur ? Il redeviendra un client normal.")) return;
    
    const db = getDB();
    const user = db.users.find(u => u.id === userId);
    if(!user) return;
    
    user.role = 'client';
    
    try {
        await saveDoc('users', user);
        showNotification(user.name + " a été retiré de l'équipe.", "success");
        renderAdminTeam();
    } catch(err) {
        console.error(err);
        alert("Erreur: " + err.message);
    }
}
