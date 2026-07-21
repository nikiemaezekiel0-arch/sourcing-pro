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
    
    // --- DEMO CHECKER & TIMER ---
    if (user && user.planType === 'demo') {
        const timerWidget = document.getElementById('demo-floating-timer');
        const clockEl = document.getElementById('demo-timer-clock');
        
        if (timerWidget) timerWidget.classList.remove('hidden');

        setInterval(() => {
            const db = getDB();
            const liveUser = db.users.find(u => u.id === user.id);
            if (liveUser && liveUser.demoStatus === 'active') {
                const remainingMs = liveUser.demoExpiresAt - Date.now();
                
                if (remainingMs <= 0) {
                    // Expired
                    if (clockEl) clockEl.innerText = "00:00";
                    firebase.auth().signOut().then(() => {
                        document.getElementById('demo-expired-overlay').classList.remove('hidden');
                        if (timerWidget) timerWidget.classList.add('hidden');
                    });
                } else {
                    // Update visual timer
                    const totalSec = Math.floor(remainingMs / 1000);
                    const mins = Math.floor(totalSec / 60);
                    const secs = totalSec % 60;
                    if (clockEl) {
                        clockEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    }
                }
            }
        }, 1000); // Check and update every second
    }
    
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
        renderClientStats();
        renderClientCategories();
        renderClientSuppliers();
    }
    
    renderClientTrainings();
    
    // Start Onboarding Tour
    setTimeout(startClientTour, 1000);
    
    // Listen to changes
    window.addEventListener('db_updated', () => {
        if(user && user.planType !== 'standard') {
            renderClientStats();
            renderClientCategories();
            renderClientSuppliers();
        }
        renderClientTrainings();
    });

    // Utility function for debouncing
    function debounce(func, timeout = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => { func.apply(this, args); }, timeout);
        };
    }

    // Search functionality with debounce
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const term = e.target.value.toLowerCase();
            renderClientSuppliers(currentCategoryFilter, term);
        }, 300));
    }
}

function switchClientTab(tab) {
    const user = getCurrentUser();
    
    // Access control
    if (user && user.planType === 'standard' && tab !== 'trainings') {
        alert("Vous devez avoir un forfait Premium pour accéder à cette section.");
        return;
    }
    
    ['suppliers', 'trainings', 'agent', 'boutique', 'favorites'].forEach(t => {
        const view = document.getElementById(`client-view-${t}`);
        const nav = document.getElementById(`client-nav-${t}`);
        if(view) view.classList.add('hidden');
        if(nav) nav.classList.remove('active');
    });
    
    // Always ensure the product detail view and cart view are hidden when switching tabs
    const detailView = document.getElementById('client-product-detail-view');
    if (detailView) detailView.classList.add('hidden');
    const cartView = document.getElementById('client-cart-view');
    if (cartView) cartView.classList.add('hidden');
    
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
        
        renderClientAgentProducts();
    }
    
    if (tab === 'boutique') {
        renderClientBoutique();
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
    updateTrainingProgressUI();
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
        
        const user = getCurrentUser();
        const progressObj = (user && user.ebookProgress && user.ebookProgress[ebook.fileUrl]) ? user.ebookProgress[ebook.fileUrl] : null;
        const percent = progressObj ? progressObj.percent : 0;
        
        const card = document.createElement('div');
        card.className = 'ebook-premium-card';
        card.onclick = () => openEbookModal(ebook.fileUrl, ebook.title);
        
        card.innerHTML = `
            <div class="ebook-premium-cover-container" id="ebook-cover-container-${ebook.id}">
                <div class="ebook-premium-cover">
                    <div class="ebook-premium-cover-title">${ebook.title}</div>
                </div>
            </div>
            
            <div class="ebook-premium-content">
                <div>
                    <div class="ebook-premium-meta">[ ${category.toUpperCase()} • ${pages} PAGES ]</div>
                    <div class="ebook-premium-title" title="${ebook.title.replace(/"/g, '&quot;')}">${ebook.title}</div>
                    
                    <div style="margin-top: 10px; width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                        <div style="height: 100%; width: ${percent}%; background: var(--accent-gold);"></div>
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; text-align: right;">${percent}% lu</div>
                </div>
                <button class="ebook-premium-btn" style="margin-top: 10px;" onclick="event.stopPropagation(); openEbookModal('${ebook.fileUrl}', '${ebook.title.replace(/'/g, "\\'")}')">${percent > 0 ? 'REPRENDRE LA LECTURE' : "LIRE L'EBOOK"}</button>
            </div>
        `;
        list.appendChild(card);
    });

    // Asynchronously load PDF covers
    setTimeout(async () => {
        if (!window.pdfjsLib) return;
        for (const ebook of sortedEbooks) {
            try {
                const container = document.getElementById(`ebook-cover-container-${ebook.id}`);
                if (!container) continue;
                
                const pdf = await pdfjsLib.getDocument(ebook.fileUrl).promise;
                const page = await pdf.getPage(1);
                
                const viewport = page.getViewport({ scale: 0.5 });
                const canvas = document.createElement('canvas');
                canvas.className = 'ebook-premium-cover';
                canvas.style.padding = '0';
                canvas.style.border = 'none';
                canvas.style.objectFit = 'cover';
                canvas.style.width = '100%';
                canvas.style.height = '100%';
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                
                // Replace the default cover with the canvas
                container.innerHTML = '';
                container.appendChild(canvas);
            } catch (err) {
                console.error("Impossible de charger la couverture PDF de " + ebook.title, err);
            }
        }
    }, 500);
}

window.updateEbookProgress = function(url, pageNum, numPages) {
    const user = getCurrentUser();
    if (!user) return;
    
    if (!user.ebookProgress) user.ebookProgress = {};
    
    const currentMax = user.ebookProgress[url] ? user.ebookProgress[url].page : 0;
    
    if (pageNum > currentMax) {
        user.ebookProgress[url] = {
            page: pageNum,
            total: numPages,
            percent: Math.min(100, Math.round((pageNum / numPages) * 100))
        };
        
        if(user.id && user.id !== 'usr_admin1' && user.id !== 'usr_client1' && user.id !== 'usr_supplier1') {
            saveDoc('users', user);
            setCurrentUser(user);
        }
    }
};

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
                    updateEbookProgress(url, pageNum, numPages);
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
    
    // Handle "Next" and "Finish" buttons visibility
    const nextBtn = document.getElementById('tr-next-btn');
    const finishBtn = document.getElementById('tr-finish-btn');
    
    if(nextBtn && finishBtn) {
        if(moduleNumber >= 4) {
            nextBtn.style.display = 'none';
            finishBtn.style.display = 'inline-flex';
            finishBtn.classList.remove('hidden');
        } else {
            nextBtn.style.display = 'inline-flex';
            finishBtn.style.display = 'none';
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

function getTrainingProgress() {
    const user = getCurrentUser();
    if (!user) return { completed: [], current: 1 };
    if (!user.trainingProgress) {
        user.trainingProgress = { completed: [], current: 1 };
        // wait, let's just do a safe update via saveDoc if we have user id
        // but only if the user is a real authenticated user!
        if (user.id && user.id !== 'usr_admin1' && user.id !== 'usr_client1' && user.id !== 'usr_supplier1') {
            saveDoc('users', user);
            setCurrentUser(user);
        }
    }
    return user.trainingProgress;
}

window.markModuleAsCompleted = function(moduleNum) {
    const user = getCurrentUser();
    if (!user) return;
    
    if (!user.trainingProgress) {
        user.trainingProgress = { completed: [], current: 1 };
    }
    
    if (!user.trainingProgress.completed.includes(moduleNum)) {
        user.trainingProgress.completed.push(moduleNum);
    }
    
    if (moduleNum === user.trainingProgress.current && moduleNum < 4) {
        user.trainingProgress.current = moduleNum + 1;
    }
    
    if(user.id && user.id !== 'usr_admin1' && user.id !== 'usr_client1' && user.id !== 'usr_supplier1') {
        saveDoc('users', user);
        setCurrentUser(user);
    }
    
    updateTrainingProgressUI();
};

window.updateTrainingProgressUI = function() {
    const progress = getTrainingProgress();
    const totalModules = 4;
    const completedCount = progress.completed.length;
    const percent = Math.round((completedCount / totalModules) * 100);
    
    // Update Progress Card
    const elText = document.getElementById('saas-progress-percent');
    if(elText) elText.innerText = `${percent}%`;
    
    const elDone = document.getElementById('saas-progress-done-text');
    if(elDone) elDone.innerText = `${completedCount} module${completedCount > 1 ? 's' : ''} terminé${completedCount > 1 ? 's' : ''}`;
    
    const elLeft = document.getElementById('saas-progress-left-text');
    const leftCount = totalModules - completedCount;
    if(elLeft) elLeft.innerText = `${leftCount} module${leftCount > 1 ? 's' : ''} restant${leftCount > 1 ? 's' : ''}`;
    
    const elFill = document.getElementById('saas-progress-fill');
    if(elFill) elFill.style.width = `${percent}%`;
    
    const elCta = document.getElementById('saas-progress-cta');
    if(elCta) {
        if(completedCount === totalModules) {
            elCta.innerHTML = `<span class="material-icons-round">emoji_events</span> Formation terminée !`;
            elCta.onclick = null;
            elCta.style.background = 'var(--success)';
            elCta.style.color = 'white';
            elCta.className = 'btn-primary';
        } else {
            elCta.innerHTML = `<span class="material-icons-round">play_circle</span> Reprendre le module ${progress.current}`;
            elCta.onclick = () => openTrainingModule(progress.current);
            elCta.style.background = '';
            elCta.style.color = '';
            elCta.className = 'btn-primary';
        }
    }

    // Update Timeline & Cards
    for(let i=1; i<=totalModules; i++) {
        const isDone = progress.completed.includes(i);
        const isActive = progress.current === i;
        const isLocked = !isDone && !isActive;

        // Timeline
        const tlItem = document.getElementById(`tl-item-${i}`);
        if(tlItem) {
            tlItem.className = 'saas-timeline-item ' + (isDone ? 'done' : isActive ? 'active' : 'locked');
        }
        if(i < totalModules) {
            const tlConn = document.getElementById(`tl-conn-${i}`);
            if(tlConn) tlConn.className = 'saas-timeline-connector ' + (isDone ? 'done' : '');
        }

        // Card
        const card = document.getElementById(`saas-mod-${i}`);
        if(card) {
            card.className = 'saas-module-card ' + (isDone ? 'done' : isActive ? 'active' : 'locked');
            
            const badge = card.querySelector('.saas-status-badge');
            const footerBtn = card.querySelector('.btn-secondary, .saas-btn-continue');
            const footer = document.getElementById(`saas-mod-footer-${i}`);
            
            if(isDone) {
                if(badge) badge.innerHTML = `<span class="material-icons-round" style="font-size:12px; vertical-align:-2px;">check_circle</span> Terminé`;
                if(!footerBtn && footer) {
                    const btn = document.createElement('button');
                    btn.className = 'btn-secondary';
                    btn.style = 'padding: 0.4rem 0.8rem; font-size: 0.8rem;';
                    btn.innerText = 'Revoir';
                    btn.onclick = () => openTrainingModule(i);
                    footer.appendChild(btn);
                } else if(footerBtn) {
                    footerBtn.className = 'btn-secondary';
                    footerBtn.style = 'padding: 0.4rem 0.8rem; font-size: 0.8rem;';
                    footerBtn.innerText = 'Revoir';
                    footerBtn.onclick = () => openTrainingModule(i);
                }
            } else if(isActive) {
                if(badge) badge.innerHTML = `<span class="material-icons-round" style="font-size:12px; vertical-align:-2px;">play_arrow</span> En cours`;
                if(!footerBtn && footer) {
                    const btn = document.createElement('button');
                    btn.className = 'saas-btn-continue';
                    btn.innerText = 'Continuer';
                    btn.onclick = () => openTrainingModule(i);
                    footer.appendChild(btn);
                } else if(footerBtn) {
                    footerBtn.className = 'saas-btn-continue';
                    footerBtn.style = '';
                    footerBtn.innerText = 'Continuer';
                    footerBtn.onclick = () => openTrainingModule(i);
                }
            } else {
                if(badge) badge.innerHTML = `<span class="material-icons-round" style="font-size:12px; vertical-align:-2px;">lock</span> Verrouillé`;
                if(footerBtn) footerBtn.remove();
            }
        }
    }
};

window.nextTrainingModule = function() {
    // Mark current module as completed when clicking next
    if (currentTrainingModule > 0) {
        markModuleAsCompleted(currentTrainingModule);
    }

    if(currentTrainingModule > 0 && currentTrainingModule < 4) {
        openTrainingModule(currentTrainingModule + 1);
    } else {
        closeTrainingModule();
    }
};

window.finishTraining = function() {
    if (currentTrainingModule === 4) {
        markModuleAsCompleted(4);
        closeTrainingModule();
        showNotification("Félicitations ! Vous avez terminé la formation.", "success");
    }
};

function renderClientStats() {
    const db = getDB();
    const banner = document.getElementById('client-stats-banner');
    if (!banner) return;
    
    const activeSuppliers = (db.users || []).filter(u => u.role === 'supplier' && u.status === 'active');
    const activeClients = (db.users || []).filter(u => u.role === 'client' && u.status === 'active');
    
    const catCounts = {};
    activeSuppliers.forEach(s => {
        if(s.categories) {
            s.categories.forEach(c => {
                catCounts[c] = (catCounts[c] || 0) + 1;
            });
        }
    });
    let html = `
        <div style="display: flex; align-items: center; gap: 12px; background: rgba(15, 23, 30, 0.6); border: 1px solid var(--accent-gold); border-radius: 9999px; padding: 6px 20px 6px 6px;">
            <div style="background: var(--accent-gold); color: #000; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-round" style="font-size: 20px;">inventory_2</span>
            </div>
            <div style="display: flex; flex-direction: column; line-height: 1.1;">
                <span style="font-size: 1.2rem; font-weight: 800; color: #fff;">${activeSuppliers.length}</span>
                <span style="font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Fournisseurs</span>
            </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px; background: rgba(15, 23, 30, 0.6); border: 1px solid #38bdf8; border-radius: 9999px; padding: 6px 20px 6px 6px;">
            <div style="background: #38bdf8; color: #000; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-round" style="font-size: 20px;">groups</span>
            </div>
            <div style="display: flex; flex-direction: column; line-height: 1.1;">
                <span style="font-size: 1.2rem; font-weight: 800; color: #fff;">${activeClients.length}</span>
                <span style="font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Membres</span>
            </div>
        </div>
    `;

    const sortedCats = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a]);
    if (sortedCats.length > 0) {
        let catText = sortedCats.slice(0, 3).map(c => {
            const catObj = db.categories.find(x => x.id === c);
            return `<span style="font-weight:700; color:#fff;">${catObj ? catObj.name : c}</span> <span style="opacity:0.6; font-size:0.7rem;">(${catCounts[c]})</span>`;
        }).join('<span style="margin: 0 6px; opacity:0.3;">|</span>');
        
        html += `
        <div style="display: flex; align-items: center; gap: 12px; background: rgba(15, 23, 30, 0.6); border: 1px solid #a855f7; border-radius: 9999px; padding: 6px 20px 6px 6px;">
            <div style="background: #a855f7; color: #fff; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span class="material-icons-round" style="font-size: 20px;">category</span>
            </div>
            <div style="display: flex; flex-direction: column; line-height: 1.2;">
                <span style="font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Top Catégories</span>
                <div style="font-size: 0.8rem; display: flex; align-items: center;">${catText}</div>
            </div>
        </div>`;
    }

    banner.innerHTML = html;
}

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
    
    let filtered = (db.users || []).filter(u => u.role === 'supplier' && u.status === 'active');
    
    if (categoryId) {
        filtered = filtered.filter(s => 
            s.categoryId === categoryId || 
            (s.categories && s.categories.includes(categoryId))
        );
    }
    
    if (searchTerm) {
        filtered = filtered.filter(s => 
            (s.name && s.name.toLowerCase().includes(searchTerm)) || 
            (s.firstname && s.firstname.toLowerCase().includes(searchTerm)) ||
            (s.description && s.description.toLowerCase().includes(searchTerm))
        );
    }
    
    currentSupplierList = filtered;
    supplierDisplayCount = 0;
    container.innerHTML = ''; // Reset
    
    const trigger = document.getElementById('load-more-trigger');
    
    // Skeleton Loaders
    if (!db._isLoaded && filtered.length === 0) {
        let skeletons = '';
        for (let i = 0; i < 6; i++) {
            skeletons += `
            <div class="supplier-card glass-panel" style="pointer-events:none;">
                <div class="card-header skeleton" style="height:24px; width:40%; border-radius:12px;"></div>
                <div class="supplier-info">
                    <div class="skeleton" style="height:60px; width:60px; border-radius:50%; margin-right:1rem;"></div>
                    <div style="flex:1;">
                        <div class="skeleton skeleton-text"></div>
                        <div class="skeleton skeleton-text skeleton-text-short"></div>
                    </div>
                </div>
                <div class="skeleton skeleton-btn"></div>
            </div>`;
        }
        container.innerHTML = skeletons;
        if (trigger) trigger.style.display = 'none';
        return;
    }

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
        const catId = sup.categoryId || (sup.categories && sup.categories.length > 0 ? sup.categories[0] : null);
        const cat = db.categories.find(c => c.id === catId);
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
                    <h3>${sup.name || sup.firstname || 'Fournisseur'}</h3>
                    <p class="desc-preview">${(sup.description || 'Fournisseur vérifié').substring(0, 80)}${(sup.description || '').length > 80 ? '...' : ''}</p>
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
    const sup = (db.users || []).find(s => s.id === id && s.role === 'supplier');
    if(!sup) return;
    
    // Start 60-second view timer
    if (supplierViewTimer) clearTimeout(supplierViewTimer);
    supplierViewTimer = setTimeout(async () => {
        await incrementSupplierViews(id);
    }, 60000); // 60 seconds
    
    const catId = sup.categoryId || (sup.categories && sup.categories.length > 0 ? sup.categories[0] : null);
    const cat = db.categories.find(c => c.id === catId);
    
    document.getElementById('modal-sup-name').textContent = sup.name || sup.firstname || 'Fournisseur';
    document.getElementById('modal-sup-cat').innerHTML = `<span class="material-icons-round text-sm">${cat ? cat.icon : 'store'}</span> ${cat ? cat.name : 'Autre'}`;
    document.getElementById('modal-sup-desc').textContent = sup.description || 'Fournisseur vérifié';
    
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

    // driverObj.drive();
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


// ==========================================
// BOUTIQUE E-COMMERCE (CLIENT)
// ==========================================

let currentBoutiqueCategory = 'all';

function renderClientBoutique() {
    const db = getDB();
    
    // 1. Render Categories Filter
    const filterContainer = document.getElementById('boutique-categories-filter');
    if (filterContainer) {
        let filterHtml = `<button class="${currentBoutiqueCategory === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.4rem 1rem; border-radius: 50px;" onclick="filterBoutique('all')">Toutes</button>`;
        
        if (db.boutique_categories) {
            db.boutique_categories.forEach(cat => {
                const isActive = currentBoutiqueCategory === cat.id;
                filterHtml += `<button class="${isActive ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.4rem 1rem; border-radius: 50px;" onclick="filterBoutique('${cat.id}')">${cat.name}</button>`;
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
        htmlStr += `
        <div class="glass-panel" style="padding: 15px; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s;" onclick="openBoutiqueProductDetail('${prod.id}')" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="height: 180px; overflow: hidden; border-radius: 8px; margin-bottom: 15px;">
                <img src="${prod.image || 'https://via.placeholder.com/300'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <div style="flex-grow: 1;">
                <p class="text-muted text-sm" style="margin: 0 0 5px 0;">${cat ? cat.name : 'Divers'}</p>
                <h4 style="margin: 0 0 10px 0; font-size: 1.1rem;">${prod.title}</h4>
            </div>
            <div class="flex justify-between items-center" style="margin-top: auto;">
                <span style="font-weight: 900; color: var(--accent-gold); font-size: 1.2rem;">${prod.price}</span>
                <button class="btn-primary" style="padding: 0.4rem 0.8rem; border-radius: 8px;">Voir</button>
            </div>
        </div>`;
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
    
    const waMessage = encodeURIComponent(`Bonjour, je souhaite commander le produit suivant depuis votre boutique SourcingPro :\n\n*Produit :* ${prod.title}\n*Prix :* ${prod.price}\n\nMerci de m'indiquer la marche à suivre pour le paiement et la livraison.`);
    const adminPhone = "33600000000"; // IMPORTANT: L'utilisateur devra configurer son numéro
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; padding: 0; overflow: hidden; background: #1e293b;">
            <div class="flex flex-col md:flex-row">
                <!-- Image -->
                <div style="flex: 1; background: #000; display: flex; align-items: center; justify-content: center; min-height: 300px;">
                    <img src="${prod.image || 'https://via.placeholder.com/600'}" style="max-width: 100%; max-height: 500px; object-fit: contain;" onerror="this.src='https://via.placeholder.com/600'">
                </div>
                <!-- Details -->
                <div style="flex: 1; padding: 2rem; display: flex; flex-direction: column;">
                    <button class="material-icons-round text-muted hover-glow" style="background: none; border: none; align-self: flex-end; cursor: pointer; position: absolute; top: 1rem; right: 1rem; z-index: 10;" onclick="document.getElementById('modal-boutique-detail').style.display='none'">close</button>
                    
                    <p class="text-muted text-sm" style="margin: 0 0 5px 0;">${cat ? cat.name : 'Divers'}</p>
                    <h2 style="margin: 0 0 15px 0; font-weight: 800; font-size: 1.8rem; line-height: 1.2;">${prod.title}</h2>
                    <div style="font-weight: 900; color: var(--accent-gold); font-size: 1.5rem; margin-bottom: 20px;">${prod.price}</div>
                    
                    <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 25px; flex-grow: 1;">
                        <h4 class="text-sm text-muted mb-2">Description du produit</h4>
                        <p style="white-space: pre-wrap; margin: 0; font-size: 0.95rem; line-height: 1.5;">${prod.description}</p>
                    </div>
                    
                    <a href="https://wa.me/${adminPhone}?text=${waMessage}" target="_blank" class="btn-primary w-full" style="text-decoration: none; justify-content: center; padding: 1rem; font-size: 1.1rem; gap: 10px;">
                        <span class="material-icons-round">whatsapp</span>
                        Commander sur WhatsApp
                    </a>
                    <p class="text-center text-muted text-xs mt-3">Paiement sécurisé et livraison rapide.</p>
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}
