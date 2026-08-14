const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(/async function addSupplier\(e\) \{/g, `async function addSupplier(e) {
    try {`);

code = code.replace(/    cancelEditSupplier\(\);\n    renderAdminSuppliers\(\);\n\}/g, `    cancelEditSupplier();
    renderAdminSuppliers();
    } catch (err) {
        console.error(err);
        alert("Erreur critique : " + err.message);
    }
}`);

fs.writeFileSync('js/admin.js', code);
console.log("Added try/catch to addSupplier");
