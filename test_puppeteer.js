const puppeteer = require('puppeteer-core');
(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: 'new'
        });
        const page = await browser.newPage();
        page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
        page.on('pageerror', err => console.log('BROWSER_ERR:', err.toString()));
        await page.goto('file://' + __dirname + '/index.html', {waitUntil: 'networkidle0'});
        console.log('Page loaded');
        await browser.close();
    } catch (e) {
        console.log('PUPPETEER_ERROR:', e);
    }
})();
