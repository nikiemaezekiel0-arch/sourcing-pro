const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    try {
        console.log("Navigating...");
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2' });
        
        await page.type('#login-email', 'admin');
        await page.type('#login-password', 'admin');
        await page.click('#login-form button[type="submit"]');
        
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        await new Promise(r => setTimeout(r, 8000));
        
        const count = await page.evaluate(() => {
            const el = document.getElementById('admin-count-suppliers');
            return el ? el.innerText : 'NOT_FOUND';
        });
        
        console.log("Supplier count on screen:", count);
        
        const dbUsers = await page.evaluate(() => {
            return window.getDB().users.length;
        });
        console.log("DB Users array length:", dbUsers);
        
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
