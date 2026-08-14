const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log("Navigating to live site...");
        await page.goto('https://sourcingpro.vercel.app/', { waitUntil: 'networkidle2' });
        
        await page.screenshot({ path: 'live_home.png', fullPage: true });
        console.log("Home screenshot saved.");
        
        // Let's try to login
        const emailInput = await page.$('#login-email');
        if (emailInput) {
            await page.type('#login-email', 'admin');
            await page.type('#login-password', 'admin');
            await page.click('#login-form button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
            
            await new Promise(r => setTimeout(r, 5000));
            await page.screenshot({ path: 'live_admin.png', fullPage: true });
            console.log("Admin screenshot saved.");
            
            await page.evaluate(() => { switchAdminTab('suppliers'); });
            await new Promise(r => setTimeout(r, 2000));
            await page.screenshot({ path: 'live_suppliers.png', fullPage: true });
            console.log("Suppliers screenshot saved.");
        } else {
            console.log("No login form found.");
        }
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
