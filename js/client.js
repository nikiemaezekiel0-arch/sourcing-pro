// --- Client Portal Logic ---

document.addEventListener('DOMContentLoaded', () => {
    const user = getCurrentUser();
    if (user && user.role === 'client' && user.status === 'active') {
        initClientPortal();
    }
});

function initClientPortal() {
    const user = getCurrentUser();
    
    // Check access based on plan
    if (user && user.planType === 'standard') {
        // Standard user: hide suppliers tab and show training
        const supNav = document.getElementById('client-nav-suppliers');
        const favNav = document.getElementById('client-nav-favorites');
        if(supNav) supNav.style.display = 'none';
        if(favNav) favNav.style.display = 'none';
        switchClientTab('trainings');
    } else {
        // Premium or admin: show everything, default to suppliers
        switchClientTab('suppliers');
        renderClientCategories();
        renderClientSuppliers();
    }
    
    renderClientTrainings();
    
    // Start Onboarding Tour
    setTimeout(startClientTour, 1000);
    
    // Listen to changes
    window.addEventListener('db_updated', () => {
        if(user && user.planType !== 'standard') {
            renderClientCategories();
            renderClientSuppliers();
        }
        renderClientTrainings();
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            renderClientSuppliers(currentCategoryFilter, term);
        });
    }
}

function switchClientTab(tab) {
    const user = getCurrentUser();
    
    // Access control
    if (user && user.planType === 'standard' && tab !== 'trainings') {
        alert("Vous devez avoir un forfait Premium pour accéder à cette section.");
        return;
    }
    
    ['suppliers', 'trainings', 'agent'].forEach(t => {
        const view = document.getElementById(`client-view-${t}`);
        const nav = document.getElementById(`client-nav-${t}`);
        if(view) view.classList.add('hidden');
        if(nav) nav.classList.remove('active');
    });
    
    // Manage favorites vs suppliers UI state
    const suppliersView = document.getElementById('client-view-suppliers');
    const favoritesNav = document.getElementById('client-nav-favorites');
    if(favoritesNav) favoritesNav.classList.remove('active');
    
    if (tab === 'suppliers' || tab === 'favorites') {
        if(suppliersView) suppliersView.classList.remove('hidden');
        if(tab === 'suppliers') {
            const nav = document.getElementById('client-nav-suppliers');
            if(nav) nav.classList.add('active');
            renderClientSuppliers(null, document.getElementById('search-input') ? document.getElementById('search-input').value : '');
        } else {
            if(favoritesNav) favoritesNav.classList.add('active');
            renderClientSuppliers('favorites');
        }
    } else if (tab === 'trainings') {
        const view = document.getElementById('client-view-trainings');
        const nav = document.getElementById('client-nav-trainings');
        if(view) view.classList.remove('hidden');
        if(nav) nav.classList.add('active');
    } else if (tab === 'agent') {
        const view = document.getElementById('client-view-agent');
        const nav = document.getElementById('client-nav-agent');
        if(view) view.classList.remove('hidden');
        if(nav) nav.classList.add('active');
        if(typeof renderClientAgentProducts === 'function') renderClientAgentProducts();
    }
}

function switchClientTrainingTab(subtab) {
    const modulesView = document.getElementById('client-train-subview-modules');
    const ebooksView = document.getElementById('client-train-subview-ebooks');
    const btnModules = document.getElementById('btn-client-train-modules');
    const btnEbooks = document.getElementById('btn-client-train-ebooks');

    if (!modulesView || !ebooksView) return;

    if (subtab === 'modules') {
        modulesView.classList.remove('hidden');
        ebooksView.classList.add('hidden');
        btnModules.className = 'btn-primary';
        btnEbooks.className = 'btn-secondary';
        // renderClientTrainings handles the dashboard vs reading view internally
    } else if (subtab === 'ebooks') {
        modulesView.classList.add('hidden');
        ebooksView.classList.remove('hidden');
        btnModules.className = 'btn-secondary';
        btnEbooks.className = 'btn-primary';
        renderClientEbooks();
    }
}

function renderClientTrainings() {
    switchClientTrainingTab('modules');
    // The new learning path is hardcoded in index.html (Dashboard view).
    // This function ensures we are in the dashboard state initially if we just switch tabs.
    closeTrainingModule();
}

function renderClientEbooks() {
    const db = getDB();
    const list = document.getElementById('client-ebooks-list');
    if (!list) return;

    list.innerHTML = '';
    
    // Filter out only ebooks from the trainings collection
    const ebooks = db.trainings ? db.trainings.filter(t => t.type === 'ebook') : [];

    if (ebooks.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8" style="grid-column: 1 / -1;">
                <span class="material-icons-round text-muted" style="font-size: 48px; opacity:0.5;">local_library</span>
                <p class="text-muted mt-4">La bibliothèque est vide pour le moment.</p>
            </div>
        `;
        return;
    }

    // Sort newest first
    const sortedEbooks = [...ebooks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const categories = ['Business', 'Technologie', 'Design', 'Marketing'];

    sortedEbooks.forEach((ebook, index) => {
        const category = categories[index % categories.length];
        const pages = Math.floor(Math.random() * 200) + 100;
        
        const card = document.createElement('div');
        card.className = 'v2-card';
        card.onclick = () => openEbookModal(ebook.fileUrl, ebook.title);
        
        card.innerHTML = `
            <div class="v2-cover-container">
                <div class="v2-cover">
                    <div class="v2-cover-title">${ebook.title.substring(0, 20)}${ebook.title.length > 20 ? '...' : ''}</div>
                    <div class="v2-meta">
                        <div style="font-size:0.6rem; color:rgba(255,255,255,0.5);">Sourcing Pro</div>
                    </div>
                </div>
            </div>
            
            <div class="v2-title">${ebook.title}</div>
            <div class="v2-desc">${ebook.description}</div>
            <div class="v2-tags">${category} • ${pages} pages</div>
            
            <div class="v2-actions">
                <button class="v2-btn" onclick="event.stopPropagation(); openEbookModal('${ebook.fileUrl}', '${ebook.title.replace(/'/g, "\\'")}')">Lire l'Ebook</button>
            </div>
        `;
        list.appendChild(card);
    });
}

let customPdfDoc = null;
let customPdfPageNum = 1;
let customPdfPageIsRendering = false;
let customPdfPageNumIsPending = null;
let customPdfCanvas = null;
let customPdfCtx = null;

async function openEbookModal(url, title) {
    document.getElementById('modal-ebook-title').innerText = title;
    const container = document.getElementById('modal-ebook-container');
    
    // Create Custom Reader UI
    container.innerHTML = `
        <div class="flex justify-between items-center p-3" style="background:#0f172a; border-bottom:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
            <button class="btn-icon" id="pdf-prev-btn" style="background:rgba(255,255,255,0.1); color:white;"><span class="material-icons-round">chevron_left</span></button>
            <span style="color:white; font-family:'Outfit',sans-serif; font-weight:600;">Page <span id="pdf-page-num">1</span> / <span id="pdf-page-count">...</span></span>
            <button class="btn-icon" id="pdf-next-btn" style="background:rgba(255,255,255,0.1); color:white;"><span class="material-icons-round">chevron_right</span></button>
        </div>
        <div id="pdf-canvas-wrapper" style="flex-grow:1; overflow:auto; background:#cbd5e1; display:flex; justify-content:center; align-items:flex-start; padding:1rem;">
            <canvas id="pdf-render-canvas" style="box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-width: 100%;"></canvas>
        </div>
    `;
    
    document.getElementById('ebook-modal').classList.remove('hidden');
    
    customPdfCanvas = document.getElementById('pdf-render-canvas');
    customPdfCtx = customPdfCanvas.getContext('2d');
    
    document.getElementById('pdf-prev-btn').addEventListener('click', () => {
        if (customPdfPageNum <= 1) return;
        customPdfPageNum--;
        queueRenderCustomPage(customPdfPageNum);
    });
    
    document.getElementById('pdf-next-btn').addEventListener('click', () => {
        if (customPdfPageNum >= customPdfDoc.numPages) return;
        customPdfPageNum++;
        queueRenderCustomPage(customPdfPageNum);
    });

    try {
        // Show loading state
        const ctx = customPdfCanvas.getContext('2d');
        ctx.font = '16px Arial';
        ctx.fillText('Chargement du Ebook...', 50, 50);
        
        customPdfDoc = await pdfjsLib.getDocument(url).promise;
        document.getElementById('pdf-page-count').textContent = customPdfDoc.numPages;
        customPdfPageNum = 1;
        renderCustomPage(customPdfPageNum);
    } catch (err) {
        console.error("PDF Loading Error: ", err);
        container.innerHTML = `<div style="padding:2rem; color:red; text-align:center;">Erreur lors du chargement de l'Ebook. Impossible de lire ce fichier PDF.</div>`;
    }
}

function renderCustomPage(num) {
    customPdfPageIsRendering = true;

    customPdfDoc.getPage(num).then(page => {
        const wrapper = document.getElementById('pdf-canvas-wrapper');
        let viewport = page.getViewport({ scale: 1.5 });
        
        // Scale down if it doesn't fit on mobile screens
        if (wrapper && viewport.width > wrapper.clientWidth - 32) {
            const scale = (wrapper.clientWidth - 32) / viewport.width;
            viewport = page.getViewport({ scale: scale * 1.5 }); // adjust scale properly
        }

        customPdfCanvas.height = viewport.height;
        customPdfCanvas.width = viewport.width;

        const renderCtx = {
            canvasContext: customPdfCtx,
            viewport: viewport
        };

        page.render(renderCtx).promise.then(() => {
            customPdfPageIsRendering = false;
            if (customPdfPageNumIsPending !== null) {
                renderCustomPage(customPdfPageNumIsPending);
                customPdfPageNumIsPending = null;
            }
        });

        document.getElementById('pdf-page-num').textContent = num;
        
        // Scroll to top of page
        if(wrapper) wrapper.scrollTop = 0;
    });
}

function queueRenderCustomPage(num) {
    if (customPdfPageIsRendering) {
        customPdfPageNumIsPending = num;
    } else {
        renderCustomPage(num);
    }
}

let currentTrainingModule = 0;

window.openTrainingModule = function(moduleNumber) {
    currentTrainingModule = moduleNumber;
    
    // Hide dashboard
    document.getElementById('training-dashboard-view').classList.add('hidden');
    
    // Show reading view
    const readingView = document.getElementById('training-reading-view');
    readingView.classList.remove('hidden');
    
    // Update title
    document.getElementById('tr-module-title').innerText = `Module 0${moduleNumber}`;
    
    // Hide all module contents
    for(let i = 1; i <= 4; i++) {
        const modEl = document.getElementById(`t-module-${i}`);
        if(modEl) modEl.classList.add('hidden');
    }
    
    // Show specific module
    const targetMod = document.getElementById(`t-module-${moduleNumber}`);
    if(targetMod) {
        targetMod.classList.remove('hidden');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Handle "Next" button visibility
    const nextBtn = document.getElementById('tr-next-btn');
    if(nextBtn) {
        if(moduleNumber >= 4) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-flex';
        }
    }
};

window.closeTrainingModule = function() {
    currentTrainingModule = 0;
    
    const dashboard = document.getElementById('training-dashboard-view');
    const readingView = document.getElementById('training-reading-view');
    
    if(dashboard && readingView) {
        readingView.classList.add('hidden');
        dashboard.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.nextTrainingModule = function() {
    if(currentTrainingModule > 0 && currentTrainingModule < 4) {
        openTrainingModule(currentTrainingModule + 1);
    }
};

function renderClientCategories() {
    const db = getDB();
    const container = document.getElementById('category-filters');
    if(!container) return;
    
    let html = `<button class="cat-btn active" onclick="filterByCategory(null, this)">
                    <span class="material-icons-round">grid_view</span> Tout
                </button>`;
                
    db.categories.forEach(cat => {
        html += `<button class="cat-btn" onclick="filterByCategory('${cat.id}', this)">
                    <span class="material-icons-round">${cat.icon}</span> ${cat.name}
                 </button>`;
    });
    
    container.innerHTML = html;
}

let currentCategoryFilter = null;

function filterByCategory(catId, btnElement) {
    currentCategoryFilter = catId;
    
    // Update active class on buttons
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
    
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    renderClientSuppliers(catId, searchTerm);
}

async function toggleFavorite(supplierId, btnElement) {
    event.stopPropagation(); // Prevent opening modal
    const db = getDB();
    const user = getCurrentUser();
    
    // Update user in db
    const dbUser = db.users.find(u => u.id === user.id);
    if(dbUser) {
        if (!dbUser.favorites) dbUser.favorites = [];
        
        const index = dbUser.favorites.indexOf(supplierId);
        if (index > -1) {
            dbUser.favorites.splice(index, 1);
            btnElement.classList.remove('active-fav');
            showNotification('Retiré des favoris');
        } else {
            dbUser.favorites.push(supplierId);
            btnElement.classList.add('active-fav');
            showNotification('Ajouté aux favoris', 'success');
        }
        
        await saveDoc('users', dbUser);
        setCurrentUser(dbUser); // update local session
    }
}

function renderClientSuppliers(categoryId = currentCategoryFilter, searchTerm = '') {
    const db = getDB();
    const user = getCurrentUser();
    const container = document.getElementById('suppliers-grid');
    if(!container) return;
    
    let filtered = db.suppliers;
    
    if (categoryId) {
        filtered = filtered.filter(s => s.categoryId === categoryId);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(searchTerm) || 
            s.description.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span class="material-icons-round">search_off</span>
            <p>Aucun fournisseur trouvé.</p>
        </div>`;
        return;
    }
    
    let html = '';
    filtered.forEach(sup => {
        const cat = db.categories.find(c => c.id === sup.categoryId);
        const isFav = user.favorites && user.favorites.includes(sup.id);
        const favClass = isFav ? 'active-fav' : '';
        
        html += `
            <div class="supplier-card glass-panel" onclick="openSupplierModal('${sup.id}')">
                <div class="card-header">
                    <div class="supplier-badge">
                        <span class="material-icons-round text-sm">${cat ? cat.icon : 'store'}</span>
                        ${cat ? cat.name : 'Autre'}
                    </div>
                    <button class="btn-icon fav-btn ${favClass}" onclick="toggleFavorite('${sup.id}', this)">
                        <span class="material-icons-round">favorite</span>
                    </button>
                </div>
                
                <div class="supplier-image-wrapper">
                    ${sup.cardFront ? `<img src="${sup.cardFront}" class="supplier-thumb">` : `<div class="placeholder-img"><span class="material-icons-round">business</span></div>`}
                    ${sup.isPremium ? `<div class="premium-badge"><span class="material-icons-round">verified</span> Vérifié</div>` : ''}
                </div>
                
                <div class="card-body">
                    <h3>${sup.name}</h3>
                    <p class="desc-preview">${sup.description.substring(0, 80)}${sup.description.length > 80 ? '...' : ''}</p>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

let supplierViewTimer = null;

function openSupplierModal(id) {
    const db = getDB();
    const sup = db.suppliers.find(s => s.id === id);
    if(!sup) return;
    
    // Start 60-second view timer
    if (supplierViewTimer) clearTimeout(supplierViewTimer);
    supplierViewTimer = setTimeout(async () => {
        await incrementSupplierViews(id);
    }, 60000); // 60 seconds
    
    const cat = db.categories.find(c => c.id === sup.categoryId);
    
    document.getElementById('modal-sup-name').textContent = sup.name;
    document.getElementById('modal-sup-cat').innerHTML = `<span class="material-icons-round text-sm">${cat ? cat.icon : 'store'}</span> ${cat ? cat.name : 'Autre'}`;
    document.getElementById('modal-sup-desc').textContent = sup.description;
    
    // 3D Flip Card
    const cardContainer = document.getElementById('modal-flip-card');
    let frontImg = sup.images && sup.images[0] ? sup.images[0] : sup.cardFront;
    let backImg = sup.images && sup.images[1] ? sup.images[1] : sup.cardBack;
    
    if (frontImg && backImg) {
        cardContainer.style.display = 'block';
        document.getElementById('card-front-img').src = frontImg;
        document.getElementById('card-back-img').src = backImg;
    } else if (frontImg) {
        cardContainer.style.display = 'block';
        document.getElementById('card-front-img').src = frontImg;
        document.getElementById('card-back-img').src = frontImg; // Fallback
    } else {
        cardContainer.style.display = 'none';
    }
    
    // QR Codes
    const qrContainer = document.getElementById('modal-qr-container');
    let qrHtml = '';
    let waQR = sup.qrWa || sup.qrWhatsApp;
    let wcQR = sup.qrWc || sup.qrWeChat;
    
    if(waQR) {
        qrHtml += `
            <div class="qr-item" onclick="openLightbox('${waQR}')" style="cursor:zoom-in;">
                <img src="${waQR}" alt="WhatsApp">
                <span>WhatsApp</span>
            </div>
        `;
    }
    if(wcQR) {
        qrHtml += `
            <div class="qr-item" onclick="openLightbox('${wcQR}')" style="cursor:zoom-in;">
                <img src="${wcQR}" alt="WeChat">
                <span>WeChat</span>
            </div>
        `;
    }
    qrContainer.innerHTML = qrHtml;
    
    // Catalogs (PDFs)
    const catalogContainer = document.getElementById('modal-catalog-container');
    
    // Support legacy 'catalogLink' or new 'catalogLinks' array or new 'pdfCatalog'
    let pdfs = [];
    if (sup.pdfCatalog) pdfs.push(sup.pdfCatalog);
    else if (sup.catalogLinks && sup.catalogLinks.length > 0) pdfs = sup.catalogLinks;
    else if (sup.catalogLink) pdfs.push(sup.catalogLink);
    
    if(pdfs.length > 0) {
        let html = '';
        pdfs.forEach((pdfUrl, index) => {
            html += `
                <div class="glass-panel" style="padding:0.5rem; border:1px solid var(--accent-gold); margin-bottom: 1rem;">
                    <div class="flex justify-between items-center mb-2 px-2">
                        <span class="font-bold text-sm text-warning">Catalogue ${index + 1}</span>
                        <a href="${pdfUrl}" target="_blank" class="btn-ghost text-xs text-primary"><span class="material-icons-round" style="font-size:16px;">open_in_new</span> Ouvrir en grand</a>
                    </div>
                    <iframe src="${pdfUrl}#toolbar=0" style="width:100%; height:600px; border:none; border-radius:8px;"></iframe>
                </div>
            `;
        });
        catalogContainer.innerHTML = html;
    } else {
        catalogContainer.innerHTML = '<p class="text-muted text-sm text-center" style="padding: 2rem 0;">Aucun catalogue PDF disponible</p>';
    }
    
    document.getElementById('supplier-modal').classList.remove('hidden');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    
    // Clear supplier view timer if closing supplier modal
    if (modalId === 'supplier-modal' && supplierViewTimer) {
        clearTimeout(supplierViewTimer);
        supplierViewTimer = null;
    }
}

async function incrementSupplierViews(supplierId) {
    try {
        const db = getDB();
        const sup = db.suppliers.find(s => s.id === supplierId);
        if (sup) {
            sup.views = (sup.views || 0) + 1;
            
            // Add detailed visit log
            if (!sup.visitLogs) sup.visitLogs = [];
            
            const currentUser = getCurrentUser();
            let visitorCountry = 'Unknown';
            if (currentUser && currentUser.country) {
                visitorCountry = currentUser.country;
            }
            
            sup.visitLogs.push({
                timestamp: Date.now(),
                country: visitorCountry
            });
            
            await saveDoc('suppliers', sup);
            console.log(`Supplier view logged for ${supplierId}`);
        }
    } catch (e) {
        console.error("Failed to increment views", e);
    }
}

function openLightbox(srcOrArray) {
    if(!srcOrArray) return;
    const container = document.getElementById('lightbox-container');
    container.innerHTML = ''; // Clear previous images
    
    // Ensure we have an array
    let srcs = Array.isArray(srcOrArray) ? srcOrArray : [srcOrArray];
    
    // Filter out empty sources and current page URLs (fallback)
    srcs = srcs.filter(src => src && !src.endsWith('index.html'));
    
    // Remove duplicates (e.g. if the user only uploaded front image, both might be same)
    srcs = [...new Set(srcs)];
    
    if (srcs.length === 0) return;

    srcs.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        // If there are 2 images, take ~45% width, if 1 image, take 90%
        img.style.maxWidth = srcs.length > 1 ? '45%' : '90%';
        img.style.maxHeight = '90vh';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)';
        
        // Add responsiveness for small screens
        if(window.innerWidth < 768 && srcs.length > 1) {
            img.style.maxWidth = '90%';
            img.style.maxHeight = '40vh';
        }
        
        container.appendChild(img);
    });

    document.getElementById('lightbox-modal').classList.remove('hidden');
}

function closeModalOnOutsideClick(event, modalId) {
    if(event.target.id === modalId) {
        closeModal(modalId);
    }
}

// 3D Card logic
function flipCard(element) {
    element.classList.toggle('flipped');
}

// --- Guided Tour (Onboarding) ---
function startClientTour() {
    const user = getCurrentUser();
    if (!user || user.role !== 'client') return;
    
    const tourKey = `tourCompleted_${user.id}`;
    if (localStorage.getItem(tourKey)) return; // Already seen

    // Check if Driver.js is loaded
    if (!window.driver || !window.driver.js) return;

    const driverObj = window.driver.js.driver({
        showProgress: true,
        animate: true,
        doneBtnText: 'Terminer',
        nextBtnText: 'Suivant',
        prevBtnText: 'Précédent',
        allowClose: false,
        popoverClass: 'glass-panel', // Use our custom glassmorphism class
        steps: [
            { 
                popover: { 
                    title: '👋 Bienvenue sur SourcingPro !', 
                    description: 'Nous sommes ravis de vous compter parmi nous. Laissez-nous vous guider rapidement à travers votre espace personnel.' 
                } 
            }
        ]
    });

    const steps = driverObj.getConfig().steps;

    // Premium users get to see Suppliers & Favorites
    if (user.planType === 'premium') {
        steps.push({
            element: '#client-nav-suppliers',
            popover: {
                title: '🛒 Trouver des Fournisseurs',
                description: 'C\'est ici que vous trouverez notre catalogue exclusif des meilleurs fournisseurs de Chine. Utilisez la barre de recherche pour affiner vos résultats.',
                side: "bottom", align: 'start'
            }
        });
        steps.push({
            element: '#client-nav-favorites',
            popover: {
                title: '❤️ Vos Favoris',
                description: 'Enregistrez les fournisseurs qui vous intéressent pour les retrouver facilement ici plus tard.',
                side: "bottom", align: 'start'
            }
        });
    }

    // Both Standard and Premium have access to Trainings
    steps.push({
        element: '#client-nav-trainings',
        popover: {
            title: '🎓 Espace Formation',
            description: 'Accédez à toutes vos vidéos et modules de cours ici. C\'est par ici qu\'il faut commencer !',
            side: "bottom", align: 'start'
        }
    });

    driverObj.setConfig({ steps });
    
    // Save state on complete or destroy
    const markDone = () => localStorage.setItem(tourKey, 'true');
    driverObj.setConfig({
        ...driverObj.getConfig(),
        onDestroyStarted: () => {
            driverObj.destroy();
            markDone();
        }
    });

    driverObj.drive();
}
