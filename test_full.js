const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log("Navigating...");
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2' });
        
        console.log("Logging in via UI...");
        await page.type('#login-email', 'admin');
        await page.type('#login-password', 'admin');
        await page.click('#login-form button[type="submit"]');
        
        console.log("Waiting for navigation/reload...");
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        console.log("Waiting for DB to load...");
        await new Promise(r => setTimeout(r, 6000));
        
        console.log("Taking screenshot of Admin Users...");
        await page.screenshot({path: 'admin_users_full.png'});
        
        console.log("Switching to suppliers...");
        await page.evaluate(() => { switchAdminTab('suppliers'); });
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.evaluate(() => {
            const el = document.getElementById('admin-suppliers-list');
            return el ? el.innerHTML : 'NOT_FOUND';
        });
        
        console.log("Suppliers HTML length:", html.length);
        if (html.length < 500) {
            console.log(html);
        }
        
        await page.screenshot({path: 'admin_suppliers_full.png'});
        
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
