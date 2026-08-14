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
        
        console.log("Waiting 15 seconds for DB to fully load...");
        await new Promise(r => setTimeout(r, 15000));
        
        await page.evaluate(() => { switchAdminTab('suppliers'); });
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.evaluate(() => {
            const el = document.getElementById('admin-suppliers-list');
            return el ? el.innerHTML : 'NOT_FOUND';
        });
        
        console.log("Suppliers HTML length after 15s:", html.length);
        if (html.length < 500) {
            console.log(html);
        }
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
