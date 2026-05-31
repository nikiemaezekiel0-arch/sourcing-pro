// --- Client Portal Logic ---

window.triggerHaptic = function() {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
    }
};

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

let currentPdfDoc = null;
let pdfPageObserver = null;

async function openEbookModal(url, title) {
    document.getElementById('modal-ebook-title').innerText = title;
    const container = document.getElementById('modal-ebook-container');
    document.getElementById('ebook-modal').classList.remove('hidden');
    
    // Show loading state
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#f1f5f9;">
            <div class="loader" style="border:4px solid #e2e8f0; border-top:4px solid var(--accent-gold); border-radius:50%; width:40px; height:40px; animation:spin 1s linear infinite;"></div>
            <p style="margin-top:16px; color:#475569; font-family:Outfit; font-weight:600;">Chargement et optimisation du document...</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;

    try {
        if (!window.pdfjsLib) {
            throw new Error("PDF.js n'est pas chargé");
        }
        
        currentPdfDoc = await pdfjsLib.getDocument(url).promise;
        const numPages = currentPdfDoc.numPages;
        
        // Get first page to calculate aspect ratio
        const firstPage = await currentPdfDoc.getPage(1);
        const containerWidth = container.clientWidth || window.innerWidth;
        
        // Calculate scale to fit width
        const targetWidth = Math.min(containerWidth - 20, 1000); 
        const unscaledViewport = firstPage.getViewport({ scale: 1.0 });
        const scale = targetWidth / unscaledViewport.width;
        const scaledViewport = firstPage.getViewport({ scale });
        
        const pageHeight = scaledViewport.height;
        const pageWidth = scaledViewport.width;
        
        // Setup the scrolling container
        container.innerHTML = `<div id="pdf-scroll-view" style="width:100%; height:100%; overflow-y:auto; background:#cbd5e1; display:flex; flex-direction:column; align-items:center; padding:15px 0;"></div>`;
        const scrollView = document.getElementById('pdf-scroll-view');
        
        // Disconnect previous observer
        if (pdfPageObserver) pdfPageObserver.disconnect();
        
        pdfPageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const pageNum = parseInt(entry.target.dataset.page);
                if (entry.isIntersecting) {
                    renderPdfPage(pageNum, entry.target, scale);
                } else {
                    // Memory optimization: clear canvas if it goes too far off-screen
                    // We only do this if we want strict memory management
                }
            });
        }, { root: scrollView, rootMargin: '1000px 0px' }); // Render a few pages ahead
        
        for (let i = 1; i <= numPages; i++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page-container';
            pageDiv.dataset.page = i;
            pageDiv.dataset.rendered = "false";
            pageDiv.style.width = `${pageWidth}px`;
            pageDiv.style.height = `${pageHeight}px`;
            pageDiv.style.backgroundColor = '#fff';
            pageDiv.style.marginBottom = '15px';
            pageDiv.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
            pageDiv.style.position = 'relative';
            
            pageDiv.innerHTML = `
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#cbd5e1;">
                    <span class="material-icons-round" style="font-size:32px;">hourglass_empty</span>
                </div>
                <div style="position:absolute; bottom:10px; right:10px; font-size:12px; color:#94a3b8; font-weight:bold;">${i} / ${numPages}</div>
            `;
            
            scrollView.appendChild(pageDiv);
            pdfPageObserver.observe(pageDiv);
        }
        
    } catch (error) {
        console.error("PDF Load Error:", error);
        // Mobile fallback
        container.innerHTML = `
            <div style="background: #fef2f2; padding: 20px; text-align: center; border-bottom: 1px solid #fca5a5;">
                <p style="color: #ef4444; font-weight: bold; margin-bottom: 10px;">Le lecteur natif ne peut pas ouvrir ce fichier.</p>
                <a href="${url}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:8px;">
                    <span class="material-icons-round">open_in_new</span> Ouvrir en plein écran
                </a>
            </div>
            <iframe src="${url}" style="width:100%; height:100%; border:none; background:#fff; flex:1;"></iframe>
        `;
    }
}

async function renderPdfPage(pageNum, containerDiv, scale) {
    if (containerDiv.dataset.rendered === "true") return;
    containerDiv.dataset.rendered = "true";
    
    try {
        const page = await currentPdfDoc.getPage(pageNum);
        // Use a higher scale for rendering to ensure crisp text on Retina/Mobile displays
        const renderScale = window.devicePixelRatio || 2;
        const viewport = page.getViewport({ scale: scale * renderScale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        
        const context = canvas.getContext('2d');
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        containerDiv.innerHTML = '';
        containerDiv.appendChild(canvas);
        
    } catch (err) {
        console.error("Error rendering page", pageNum, err);
        containerDiv.dataset.rendered = "false";
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

let currentSupplierList = [];
let supplierDisplayCount = 0;
const SUPPLIERS_PER_PAGE = 15;
let supplierObserver = null;

function renderClientSuppliers(categoryId = currentCategoryFilter, searchTerm = '') {
    const db = getDB();
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
    
    currentSupplierList = filtered;
    supplierDisplayCount = 0;
    container.innerHTML = ''; // Reset
    
    const trigger = document.getElementById('load-more-trigger');
    
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <span class="material-icons-round">search_off</span>
            <p>Aucun fournisseur trouvé.</p>
        </div>`;
        if (trigger) trigger.style.display = 'none';
        return;
    }
    
    // Initial load
    loadMoreSuppliers();
    
    // Setup observer if not already setup
    if (trigger && !supplierObserver) {
        supplierObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && supplierDisplayCount < currentSupplierList.length) {
                loadMoreSuppliers();
            }
        });
        supplierObserver.observe(trigger);
    }
}

function loadMoreSuppliers() {
    const container = document.getElementById('suppliers-grid');
    const trigger = document.getElementById('load-more-trigger');
    const db = getDB();
    const user = getCurrentUser();
    
    let html = '';
    const slice = currentSupplierList.slice(supplierDisplayCount, supplierDisplayCount + SUPPLIERS_PER_PAGE);
    
    slice.forEach((sup, index) => {
        const cat = db.categories.find(c => c.id === sup.categoryId);
        const isFav = user.favorites && user.favorites.includes(sup.id);
        const favClass = isFav ? 'active-fav' : '';
        const delay = (index % SUPPLIERS_PER_PAGE) * 0.05;
        
        html += `
            <div class="supplier-card glass-panel fade-in-up" style="animation-delay: ${delay}s" onclick="openSupplierModal('${sup.id}')">
                <div class="card-header">
                    <div class="supplier-badge">
                        <span class="material-icons-round text-sm">${cat ? cat.icon : 'store'}</span>
                        ${cat ? cat.name : 'Autre'}
                    </div>
                    <button class="btn-icon fav-btn ${favClass}" onclick="event.stopPropagation(); toggleFavorite('${sup.id}', this)">
                        <span class="material-icons-round">favorite</span>
                    </button>
                </div>
                
                <div class="supplier-image-wrapper">
                    ${sup.cardFront ? `<img src="${sup.cardFront}" class="supplier-thumb" loading="lazy">` : `<div class="placeholder-img"><span class="material-icons-round">business</span></div>`}
                    ${sup.isPremium ? `<div class="premium-badge"><span class="material-icons-round">verified</span> Vérifié</div>` : ''}
                </div>
                
                <div class="card-body">
                    <h3>${sup.name}</h3>
                    <p class="desc-preview">${sup.description.substring(0, 80)}${sup.description.length > 80 ? '...' : ''}</p>
                </div>
            </div>
        `;
    });
    
    container.insertAdjacentHTML('beforeend', html);
    supplierDisplayCount += slice.length;
    
    if (trigger) {
        trigger.style.display = (supplierDisplayCount >= currentSupplierList.length) ? 'none' : 'block';
    }
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
    
    const linkContainer = document.getElementById('modal-sup-link-container');
    if (sup.link) {
        linkContainer.innerHTML = `
            <a href="${sup.link}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-size:0.9rem;">
                <span class="material-icons-round text-sm">language</span> Visiter le lien web
            </a>
        `;
        linkContainer.classList.remove('hidden');
    } else {
        linkContainer.classList.add('hidden');
        linkContainer.innerHTML = '';
    }
    
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
    
    // QR Codes & IDs
    const qrContainer = document.getElementById('modal-qr-container');
    let qrHtml = '';
    let waQR = sup.qrWa || sup.qrWhatsApp;
    let wcQR = sup.qrWc || sup.qrWeChat;
    
    // WhatsApp
    if(waQR || sup.whatsapp) {
        qrHtml += `<div class="qr-item" style="display:flex; flex-direction:column; align-items:center; gap:8px;">`;
        if(waQR) {
            qrHtml += `<img src="${waQR}" alt="WhatsApp" onclick="openLightbox('${waQR}')" style="cursor:zoom-in;">`;
        } else {
            qrHtml += `<div style="width:120px; height:120px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; border-radius:8px;"><span class="material-icons-round text-muted" style="font-size:48px;">person</span></div>`;
        }
        qrHtml += `<span>WhatsApp</span>`;
        if(sup.whatsapp) {
            qrHtml += `<div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:8px; font-size:0.85rem;">
                ${sup.whatsapp}
                <button class="copy-btn" onclick="copyToClipboard('${sup.whatsapp}', this)" title="Copier">
                    <span class="material-icons-round" style="font-size:16px;">content_copy</span>
                </button>
            </div>`;
        }
        qrHtml += `</div>`;
    }
    
    // WeChat
    if(wcQR || sup.wechatId) {
        qrHtml += `<div class="qr-item" style="display:flex; flex-direction:column; align-items:center; gap:8px;">`;
        if(wcQR) {
            qrHtml += `<img src="${wcQR}" alt="WeChat" onclick="openLightbox('${wcQR}')" style="cursor:zoom-in;">`;
        } else {
            qrHtml += `<div style="width:120px; height:120px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; border-radius:8px;"><span class="material-icons-round text-muted" style="font-size:48px;">person</span></div>`;
        }
        qrHtml += `<span>WeChat</span>`;
        if(sup.wechatId) {
            qrHtml += `<div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:8px; font-size:0.85rem;">
                ${sup.wechatId}
                <button class="copy-btn" onclick="copyToClipboard('${sup.wechatId}', this)" title="Copier">
                    <span class="material-icons-round" style="font-size:16px;">content_copy</span>
                </button>
            </div>`;
        }
        qrHtml += `</div>`;
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
                <div class="glass-panel" style="padding:1rem; border:1px solid var(--glass-border); margin-bottom: 1rem; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="material-icons-round" style="font-size:32px; color:var(--accent-gold);">picture_as_pdf</span>
                        <div>
                            <div class="font-bold text-md text-white">Catalogue Produit ${pdfs.length > 1 ? index + 1 : ''}</div>
                            <div class="text-xs text-muted">Cliquez pour afficher en grand</div>
                        </div>
                    </div>
                    <button class="btn-primary" onclick="openEbookModal('${pdfUrl}', 'Catalogue du Fournisseur')">
                        <span class="material-icons-round text-sm">fullscreen</span> Ouvrir
                    </button>
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

function copyToClipboard(text, btnElement) {
    if (!navigator.clipboard) {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(textArea);
    } else {
        navigator.clipboard.writeText(text).catch(err => console.error(err));
    }
    
    // UI Feedback
    if(btnElement) {
        const originalHtml = btnElement.innerHTML;
        btnElement.classList.add('copied');
        btnElement.innerHTML = '<span class="material-icons-round" style="font-size:16px;">check</span>';
        setTimeout(() => {
            btnElement.classList.remove('copied');
            btnElement.innerHTML = originalHtml;
        }, 2000);
    }
}
