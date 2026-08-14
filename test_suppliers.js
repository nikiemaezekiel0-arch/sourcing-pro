const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error('PAGE ERROR:', msg.text());
        } else {
            console.log('PAGE LOG:', msg.text());
        }
    });

    try {
        console.log("Navigating to file://...");
        await page.goto('file://' + __dirname + '/index.html', { waitUntil: 'networkidle0' });
        
        console.log("Attempting login via backdoor...");
        // Bypassing handleLogin completely and setting session manually
        await page.evaluate(() => {
            const adminDoc = { id: 'usr_admin1', name: 'Administrateur', role: 'admin', status: 'active' };
            localStorage.setItem('sourcing_user', JSON.stringify(adminDoc));
        });
        
        // Reload to apply local storage
        await page.reload({ waitUntil: 'networkidle0' });
        
        console.log("Waiting for db_updated event...");
        await page.waitForTimeout(5000);
        
        console.log("Switching to suppliers tab...");
        await page.evaluate(() => {
            switchAdminTab('suppliers');
        });
        
        await page.waitForTimeout(2000);
        
        const html = await page.evaluate(() => {
            return document.getElementById('admin-suppliers-list').innerHTML;
        });
        
        console.log("Suppliers list HTML:");
        console.log(html.substring(0, 500) + "...");
        
        await page.screenshot({path: 'admin_dashboard_local.png'});
        
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
