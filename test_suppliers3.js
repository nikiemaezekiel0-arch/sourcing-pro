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
        console.log("Navigating to http://localhost:8085...");
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2' });
        
        console.log("Attempting login via backdoor...");
        await page.evaluate(() => {
            const adminDoc = { id: 'usr_admin1', name: 'Administrateur', role: 'admin', status: 'active' };
            localStorage.setItem('sourcing_user', JSON.stringify(adminDoc));
        });
        
        await page.reload({ waitUntil: 'networkidle2' });
        
        console.log("Waiting for db_updated event...");
        await new Promise(r => setTimeout(r, 4000));
        
        console.log("Switching to suppliers tab...");
        await page.evaluate(() => {
            if (typeof switchAdminTab === 'function') switchAdminTab('suppliers');
        });
        
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.evaluate(() => {
            const el = document.getElementById('admin-suppliers-list');
            return el ? el.innerHTML : 'NOT_FOUND';
        });
        
        console.log("Suppliers list HTML length:", html.length);
        if (html.length < 500) {
             console.log(html);
        }
        await page.screenshot({path: 'admin_suppliers_3.png'});
        
    } catch(e) {
        console.error("Test failed:", e.message);
    }
    
    await browser.close();
    process.exit(0);
})();
