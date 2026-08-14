const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

// We will add a setInterval that checks if db.users is loaded, and if so, forces a render!
const pollScript = `
    let lastUserCount = -1;
    setInterval(() => {
        const db = getDB();
        if (db && db.users && db.users.length !== lastUserCount) {
            lastUserCount = db.users.length;
            renderAdminUsers();
            renderAdminCategories();
            renderAdminSuppliers();
            if(typeof renderAdminTrainings === 'function') renderAdminTrainings();
            if(typeof renderAdminAgentProducts === 'function') renderAdminAgentProducts();
        }
    }, 1000);
`;

code = code.replace(/window\.addEventListener\('db_updated'/g, pollScript + "\n    window.addEventListener('db_updated'");

fs.writeFileSync('js/admin.js', code);
console.log("Added polling to admin.js");
