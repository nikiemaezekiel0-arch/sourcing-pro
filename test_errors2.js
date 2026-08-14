const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('response', response => {
        if (!response.ok()) {
            console.log("404 ERROR ON:", response.url());
        }
    });
    
    try {
        await page.goto('http://localhost:8085', { waitUntil: 'networkidle2' });
    } catch(e) {}
    
    await browser.close();
    process.exit(0);
})();
