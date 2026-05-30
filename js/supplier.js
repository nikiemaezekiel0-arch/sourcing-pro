// --- Supplier Logic ---

function switchSupplierTab(tab) {
    document.getElementById('sp-view-profile').classList.add('hidden');
    document.getElementById('sp-view-stats').classList.add('hidden');
    document.getElementById('nav-sp-profile').classList.remove('active');
    document.getElementById('nav-sp-stats').classList.remove('active');
    
    document.getElementById('sp-view-' + tab).classList.remove('hidden');
    document.getElementById('nav-sp-' + tab).classList.add('active');
    
    if (tab === 'stats') {
        renderSupplierStats();
    }
}

function renderSupplierStats() {
    if (!currentSupplierProfile) return;
    
    const logs = currentSupplierProfile.visitLogs || [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;
    let countries = {};
    
    logs.forEach(log => {
        const diff = now - log.timestamp;
        if (diff < oneDay) todayCount++;
        if (diff < 7 * oneDay) weekCount++;
        if (diff < 30 * oneDay) monthCount++;
        
        const c = log.country || 'Inconnu';
        countries[c] = (countries[c] || 0) + 1;
    });
    
    document.getElementById('stat-today').innerText = todayCount;
    document.getElementById('stat-week').innerText = weekCount;
    document.getElementById('stat-month').innerText = monthCount;
    document.getElementById('stat-total').innerText = currentSupplierProfile.views || logs.length;
    
    const countriesContainer = document.getElementById('stat-countries-container');
    const sortedCountries = Object.keys(countries).sort((a,b) => countries[b] - countries[a]);
    
    if (sortedCountries.length === 0) {
        countriesContainer.innerHTML = '<p class="text-muted text-sm text-center">Aucune donnée disponible</p>';
    } else {
        let html = '';
        sortedCountries.forEach(c => {
            const count = countries[c];
            const percent = Math.round((count / logs.length) * 100);
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                    <span class="text-sm">${c}</span>
                    <div style="flex:1; margin:0 1rem; background:rgba(255,255,255,0.1); height:8px; border-radius:4px; overflow:hidden;">
                        <div style="width:${percent}%; background:var(--accent-gold); height:100%;"></div>
                    </div>
                    <span class="text-sm font-bold">${count} (${percent}%)</span>
                </div>
            `;
        });
        countriesContainer.innerHTML = html;
    }
}

let currentSupplierProfile = null;

function populateSupplierCategories() {
    const categorySelect = document.getElementById('sp-category');
    const db = typeof getDB === 'function' ? getDB() : null;
    
    if (categorySelect && db && db.categories) {
        // Garder la valeur actuellement sélectionnée si elle existe
        const currentVal = categorySelect.value;
        categorySelect.innerHTML = '<option value="">Select a Category</option>';
        db.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id; // Utilisez l'ID pour la synchronisation
            opt.textContent = cat.name;
            categorySelect.appendChild(opt);
        });
        if (currentVal) categorySelect.value = currentVal;
    }
}

// Ecouter les mises à jour de Firebase pour être sûr de charger les catégories
window.addEventListener('db_updated', () => {
    populateSupplierCategories();
});

async function loadSupplierProfile() {
    const user = getCurrentUser();
    if (!user || user.role !== 'supplier') return;
    
    populateSupplierCategories();

    const db = getDB();
    const profile = db.suppliers.find(s => s.userId === user.id);
    
    if (profile) {
        currentSupplierProfile = profile;
        document.getElementById('sp-name').value = profile.name || '';
        document.getElementById('sp-category').value = profile.categoryId || profile.category || '';
        document.getElementById('sp-desc').value = profile.description || '';
        document.getElementById('sp-whatsapp').value = profile.whatsapp || '';
        document.getElementById('sp-wechat').value = profile.wechat || '';
        document.getElementById('sp-views-count').innerText = profile.views || 0;
        
        // Restore existing images
        if (profile.images && profile.images.length > 0) {
            if (profile.images[0]) setPreview('sp-preview-front', profile.images[0]);
            if (profile.images[1]) setPreview('sp-preview-back', profile.images[1]);
        }
        if (profile.qrWa) setPreview('sp-preview-wa', profile.qrWa);
        if (profile.qrWc) setPreview('sp-preview-wc', profile.qrWc);

        if (profile.name) {
            setSupplierFormMode('read');
        } else {
            setSupplierFormMode('edit');
        }
    } else {
        setSupplierFormMode('edit');
    }
}

function setSupplierFormMode(mode) {
    const form = document.getElementById('supplier-profile-form');
    const inputs = form.querySelectorAll('input, select, textarea');
    const saveBtn = document.getElementById('sp-save-btn');
    const editBtn = document.getElementById('sp-edit-btn');
    const previewBtn = document.getElementById('sp-preview-btn');
    
    if (mode === 'read') {
        inputs.forEach(el => {
            if(el.type !== 'file') el.readOnly = true;
            if(el.tagName === 'SELECT' || el.type === 'file') el.disabled = true;
        });
        saveBtn.classList.add('hidden');
        if(editBtn) editBtn.classList.remove('hidden');
        if(previewBtn) previewBtn.classList.remove('hidden');
    } else {
        inputs.forEach(el => {
            if(el.type !== 'file') el.readOnly = false;
            if(el.tagName === 'SELECT' || el.type === 'file') el.disabled = false;
        });
        saveBtn.classList.remove('hidden');
        if(editBtn) editBtn.classList.add('hidden');
        if(previewBtn) previewBtn.classList.add('hidden');
    }
}

function setPreview(imgId, url) {
    const img = document.getElementById(imgId);
    if (img && url) {
        img.src = url;
        img.classList.remove('hidden');
    }
}

function previewSpImage(input, previewId) {
    if (input.files && input.files[0]) {
        const url = URL.createObjectURL(input.files[0]);
        setPreview(previewId, url);
    }
}

async function handleSupplierProfileSave(event) {
    event.preventDefault();
    
    try {
        const nameVal = document.getElementById('sp-name').value.trim();
        const catVal = document.getElementById('sp-category').value;
        const descVal = document.getElementById('sp-desc').value.trim();
        
        if (!nameVal || !catVal || !descVal) {
            showNotification("Veuillez remplir le nom, la catégorie et la description.", "warning");
            return;
        }
        
        const btn = document.getElementById('sp-save-btn');
        if (!btn) {
            alert("Bouton de sauvegarde introuvable !");
            return;
        }
        
        const ogText = btn.innerHTML;
        btn.innerHTML = 'Uploading & Saving...';
        btn.disabled = true;
        
        try {
            const user = getCurrentUser();
            if (!user) {
                alert("Erreur : Utilisateur non connecté !");
                throw new Error("User not found");
            }
            
            const profileId = currentSupplierProfile ? currentSupplierProfile.id : 'sup_' + user.id;
            
            let profileData = {
                id: profileId,
                userId: user.id,
                name: nameVal,
                categoryId: catVal,
                description: descVal,
                whatsapp: document.getElementById('sp-whatsapp').value.trim(),
                wechat: document.getElementById('sp-wechat').value.trim(),
                status: 'active'
            };

            // Handle specific Images Uploads
            let imagesArray = currentSupplierProfile ? (currentSupplierProfile.images || []) : [];
            let qrWaUrl = currentSupplierProfile ? currentSupplierProfile.qrWa : '';
            let qrWcUrl = currentSupplierProfile ? currentSupplierProfile.qrWc : '';

            const frontFile = document.getElementById('sp-upload-front').files[0];
            const backFile = document.getElementById('sp-upload-back').files[0];
            const waFile = document.getElementById('sp-upload-wa').files[0];
            const wcFile = document.getElementById('sp-upload-wc').files[0];

            if (frontFile) imagesArray[0] = await uploadFileToStorage(frontFile, 'supplier_photos');
            if (backFile) imagesArray[1] = await uploadFileToStorage(backFile, 'supplier_photos');
            if (waFile) qrWaUrl = await uploadFileToStorage(waFile, 'supplier_qrs');
            if (wcFile) qrWcUrl = await uploadFileToStorage(wcFile, 'supplier_qrs');

            profileData.images = imagesArray;
            profileData.qrWa = qrWaUrl;
            profileData.qrWc = qrWcUrl;

            // Handle PDF Upload
            const pdfInput = document.getElementById('sp-pdf');
            const pdfStatus = document.getElementById('sp-pdf-status');
            let pdfUrl = currentSupplierProfile ? (currentSupplierProfile.pdfCatalog || '') : '';
            if (pdfInput.files && pdfInput.files[0]) {
                const file = pdfInput.files[0];
                if (file.size > 50 * 1024 * 1024) { // 50MB
                    throw new Error("Le fichier PDF est trop volumineux (Max 50MB)");
                }
                pdfStatus.innerText = 'Uploading PDF... Please wait.';
                const url = await uploadFileToStorage(file, 'supplier_catalogs');
                if (url) {
                    pdfUrl = url;
                    pdfStatus.innerText = 'PDF Uploaded Successfully!';
                }
            }
            profileData.pdfCatalog = pdfUrl;

            // Save to Firestore
            await saveDoc('suppliers', profileData);
            currentSupplierProfile = profileData;
            
            // Mettre à jour localDB immédiatement pour que la modale ait les bonnes données
            const db = typeof getDB === 'function' ? getDB() : null;
            if (db) {
                const idx = db.suppliers.findIndex(s => s.id === profileId);
                if (idx > -1) db.suppliers[idx] = profileData;
                else db.suppliers.push(profileData);
            }
            
            showNotification('Profile updated and published successfully!', 'success');
            setSupplierFormMode('read');
            
            // Ouvrir la modale de rendu public
            if (typeof openSupplierModal === 'function') {
                setTimeout(() => openSupplierModal(profileId), 300);
            }
            
        } catch (e) {
            console.error("Supplier save error:", e);
            alert("Erreur interne lors de la sauvegarde : " + e.message);
            showNotification(e.message || 'Error saving profile', 'error');
        } finally {
            if (btn) {
                btn.innerHTML = ogText;
                btn.disabled = false;
            }
        }
    } catch (globalError) {
        alert("Une erreur inattendue empêche la sauvegarde : " + globalError.message);
        console.error(globalError);
    }
}
