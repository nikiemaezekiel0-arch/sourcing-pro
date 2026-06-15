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
    window.addEventListener('db_updated', async () => {
        const db = getDB();

        renderAdminUsers();
        renderAdminCategories();
        renderAdminSuppliers();
        populateCategorySelect();
        if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
        
    // Update Charts if they exist
        if (typeof renderAdminCharts === 'function') {
            renderAdminCharts(db.users);
        }
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
    ['users', 'categories', 'suppliers', 'trainings', 'agent'].forEach(t => {
        const view = document.getElementById(`admin-view-${t}`);
        const nav = document.getElementById(`admin-nav-${t}`);
        if(view) view.classList.add('hidden');
        if(nav) nav.classList.remove('active');
    });
    
    document.getElementById(`admin-view-${tab}`).classList.remove('hidden');
    document.getElementById(`admin-nav-${tab}`).classList.add('active');
    
    if(tab === 'users') renderAdminUsers();
    if(tab === 'categories') renderAdminCategories();
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
    
    // Update Counters
    const totalClients = db.users.filter(u => u.role === 'client').length;
    const totalSuppliers = db.users.filter(u => u.role === 'supplier').length;
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
    let usersList = db.users.filter(u => u.role === 'client' || u.role === 'supplier');
    
    if (filterVal !== 'all') {
        usersList = usersList.filter(u => u.role === filterVal);
    }
    
    if (usersList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aucun utilisateur trouvé</td></tr>`;
        return;
    }
    
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
        
        tbody.innerHTML += `
            <tr>
                <td>${u.company ? (u.company + '<br><small class="text-muted">' + u.name + '</small>') : u.name}</td>
                <td>${roleBadge}</td>
                <td>${u.phone}</td>
                <td>${statusBadge}</td>
                <td><div class="flex gap-2">${actionBtn}</div></td>
            </tr>
        `;
    });
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
    if(!confirm("⚠️ Êtes-vous sûr de vouloir supprimer DÉFINITIVEMENT cet utilisateur ? Cette action est irréversible.")) return;
    
    try {
        const db = getDB();
        const user = db.users.find(u => u.id === id);
        
        // S'il s'agit d'un fournisseur, on supprime aussi son profil public
        if (user && user.role === 'supplier') {
            const supProfile = db.suppliers?.find(s => s.userId === id);
            if (supProfile) {
                await deleteDoc('suppliers', supProfile.id);
            }
        }
        
        // Supprimer l'utilisateur de la collection users
        await deleteDoc('users', id);
        alert("Utilisateur supprimé définitivement.");
    } catch (e) {
        console.error("Delete user error", e);
        alert("Erreur lors de la suppression.");
    }
}

// --- Categories Management ---
function renderAdminCategories() {
    const db = getDB();
    const list = document.getElementById('admin-categories-list');
    if(!list) return;
    
    list.innerHTML = '';
    db.categories.forEach(cat => {
        list.innerHTML += `
            <div class="glass-panel flex justify-between items-center" style="padding:1rem; margin-bottom:0.5rem;">
                <div class="flex items-center gap-4">
                    <span class="material-icons-round text-primary" style="font-size:2rem;">${cat.icon}</span>
                    <span class="font-bold">${cat.name}</span>
                </div>
                <button class="btn-icon danger" onclick="deleteCategory('${cat.id}')"><span class="material-icons-round">delete</span></button>
            </div>
        `;
    });
}

async function addCategory(e) {
    e.preventDefault();
    const name = document.getElementById('cat-name').value;
    const icon = document.getElementById('cat-icon').value || 'category';
    
    if(!name) return showNotification('Nom requis', 'error');
    
    await saveDoc('categories', { id: generateId('cat_'), name, icon });
    
    document.getElementById('cat-name').value = '';
    showNotification('Catégorie ajoutée', 'success');
}

async function deleteCategory(id) {
    if(!confirm("Êtes-vous sûr ?")) return;
    await deleteDoc('categories', id);
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
        const index = db.suppliers.findIndex(s => s.id === currentEditSupplierId);
        if(index !== -1) {
            const updatedSup = {
                id: currentEditSupplierId,
                name, categoryId, description, link, isPremium,
                cardFront: getValidImage(cardFront),
                cardBack: getValidImage(cardBack),
                qrWhatsApp: getValidImage(qrWhatsApp),
                qrWeChat: getValidImage(qrWeChat),
                catalogLinks: catalogPdfs
            };
            await saveDoc('suppliers', updatedSup);
        }
    } else {
        // SYNCHRONIZATION: Create phantom user account for this manually added supplier
        const newUserId = generateId('usr_');
        const dummyEmail = `manuel_${newUserId.substring(4,10)}@fournisseur.com`;
        
        await saveDoc('users', {
            id: newUserId,
            name: name,
            company: name,
            email: dummyEmail,
            phone: 'N/A',
            role: 'supplier',
            status: 'active',
            isManual: true
        });

        const newSup = {
            id: generateId('sup_'),
            userId: newUserId,
            name, categoryId, description, link, isPremium,
            cardFront: getValidImage(cardFront),
            cardBack: getValidImage(cardBack),
            qrWhatsApp: getValidImage(qrWhatsApp),
            qrWeChat: getValidImage(qrWeChat),
            catalogLinks: catalogPdfs,
            vipCode: 'VIP-' + Math.random().toString(36).substr(2, 5).toUpperCase()
        };
        await saveDoc('suppliers', newSup);
    }
    
    cancelEditSupplier();

    if(isUpdate) {
        alert("✅ Le fournisseur '" + name + "' a été mis à jour avec succès !");
    } else {
        alert("✅ Le fournisseur '" + name + "' a été ajouté avec succès à la liste !");
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
    
    let filtered = db.suppliers;
    
    if (filterText) {
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(filterText) || 
            (s.description && s.description.toLowerCase().includes(filterText))
        );
    }
    if (filterCat !== 'all') {
        filtered = filtered.filter(s => s.categoryId === filterCat);
    }
    if (filterPremium) {
        filtered = filtered.filter(s => s.isPremium);
    }
    
    list.innerHTML = '';
    if(filtered.length === 0) {
        if(db.suppliers.length === 0) {
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
        return a.name.localeCompare(b.name);
    });
    
    filtered.forEach(sup => {
        const cat = db.categories.find(c => c.id === sup.categoryId);
        list.innerHTML += `
            <div class="glass-panel flex justify-between items-center" style="padding:1rem; margin-bottom:0.5rem;">
                <div>
                    <div class="font-bold flex items-center gap-2">
                        ${sup.name}
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
}

function editSupplier(id) {
    const db = getDB();
    const sup = db.suppliers.find(s => s.id === id);
    if(!sup) return;
    
    currentEditSupplierId = id;
    
    document.getElementById('sup-name').value = sup.name;
    document.getElementById('sup-category').value = sup.categoryId;
    document.getElementById('sup-desc').value = sup.description;
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
    await deleteDoc('suppliers', id);
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
