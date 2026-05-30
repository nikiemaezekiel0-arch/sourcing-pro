// --- Currency Conversion System ---
// This handles fetching exchange rates and dynamically converting prices.

const EXCHANGE_RATES_KEY = 'SourcingPro_ExchangeRates';
const USER_CURRENCY_KEY = 'SourcingPro_UserCurrency';

// Base currency is always CNY for products sourced from China
let exchangeRates = {
    CNY: 1, // Base
    EUR: 0.13, // Fallback rates
    USD: 0.14,
    XOF: 85.0
};

let currentCurrency = localStorage.getItem(USER_CURRENCY_KEY) || 'EUR';

async function fetchExchangeRates() {
    // Try to load from cache first
    const cached = localStorage.getItem(EXCHANGE_RATES_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            // Cache valid for 12 hours
            if (Date.now() - data.timestamp < 12 * 60 * 60 * 1000) {
                exchangeRates = data.rates;
                return;
            }
        } catch (e) {}
    }

    // Fetch fresh rates (using a free API, base EUR or USD then calculate CNY)
    try {
        // Fallback to static rates if API is not available or rate limited
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
        if (response.ok) {
            const data = await response.json();
            exchangeRates = {
                CNY: 1,
                EUR: data.rates.EUR,
                USD: data.rates.USD,
                XOF: data.rates.XOF || (data.rates.EUR * 655.957)
            };
            localStorage.setItem(EXCHANGE_RATES_KEY, JSON.stringify({
                timestamp: Date.now(),
                rates: exchangeRates
            }));
        }
    } catch (error) {
        console.warn("Failed to fetch exchange rates, using fallbacks.", error);
    }
}

// Convert a price from CNY to the selected currency
function convertPrice(priceCNY) {
    const rate = exchangeRates[currentCurrency] || 1;
    return (priceCNY * rate).toFixed(2);
}

// Format the price with the correct symbol
function formatPrice(priceCNY) {
    const converted = convertPrice(priceCNY);
    const symbols = { CNY: '¥', EUR: '€', USD: '$', XOF: 'FCFA' };
    
    if (currentCurrency === 'XOF') {
        // XOF doesn't use decimals typically
        return Math.round(converted).toLocaleString('fr-FR') + ' ' + symbols.XOF;
    }
    
    if (currentCurrency === 'EUR') {
        return converted.replace('.', ',') + ' ' + symbols.EUR;
    }
    
    return symbols[currentCurrency] + converted;
}

// Update currency preference
function setCurrency(currencyCode) {
    if (['CNY', 'EUR', 'USD', 'XOF'].includes(currencyCode)) {
        currentCurrency = currencyCode;
        localStorage.setItem(USER_CURRENCY_KEY, currentCurrency);
        window.dispatchEvent(new Event('currency_updated'));
    }
}

// Initialize
fetchExchangeRates();

document.addEventListener('DOMContentLoaded', () => {
    const curSelect = document.getElementById('currency-selector');
    if (curSelect) curSelect.value = currentCurrency;
});
