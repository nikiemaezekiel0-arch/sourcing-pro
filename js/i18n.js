// --- Internationalization (i18n) System ---

const USER_LANG_KEY = 'SourcingPro_Language';
let currentLang = localStorage.getItem(USER_LANG_KEY) || 'fr';

const translations = {
    fr: {
        "nav_catalogue": "Catalogue Produits",
        "nav_suppliers": "Fournisseurs",
        "nav_favorites": "Mes Favoris",
        "nav_trainings": "Ma Formation",
        "nav_cart": "Panier",
        "btn_logout": "Déconnexion",
        "btn_view_product": "Voir le produit",
        "btn_order": "Commander",
        "txt_price_calculated": "Prix affiché inclut la commission (10%)",
        "lbl_color": "Couleur",
        "lbl_size": "Taille",
        "lbl_quantity": "Quantité",
        "txt_total": "Total à payer :"
    },
    en: {
        "nav_catalogue": "Product Catalog",
        "nav_suppliers": "Suppliers",
        "nav_favorites": "My Favorites",
        "nav_trainings": "My Training",
        "nav_cart": "Cart",
        "btn_logout": "Logout",
        "btn_view_product": "View Product",
        "btn_order": "Order Now",
        "txt_price_calculated": "Displayed price includes commission (10%)",
        "lbl_color": "Color",
        "lbl_size": "Size",
        "lbl_quantity": "Quantity",
        "txt_total": "Total to pay:"
    }
};

function t(key) {
    return translations[currentLang][key] || key;
}

function setLanguage(langCode) {
    if (translations[langCode]) {
        currentLang = langCode;
        localStorage.setItem(USER_LANG_KEY, langCode);
        applyTranslations();
        window.dispatchEvent(new Event('lang_updated'));
    }
}

function applyTranslations() {
    // Finds all elements with data-i18n attribute and replaces their text
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLang][key]) {
            // Check if it's an input placeholder
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translations[currentLang][key];
            } else {
                el.textContent = translations[currentLang][key];
            }
        }
    });
}

// Initial application on load
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    const langSelect = document.getElementById('lang-selector');
    if (langSelect) langSelect.value = currentLang;
});
