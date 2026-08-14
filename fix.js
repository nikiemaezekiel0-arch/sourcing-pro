const fs = require('fs');
let code = fs.readFileSync('js/admin.js', 'utf8');

code = code.replace(/window\.addEventListener\('db_updated', async \(\) => \{\n        const db = getDB\(\);/, `let renderTimeout = null;
    window.addEventListener('db_updated', async () => {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            const db = getDB();`);

code = code.replace(/if\(typeof renderSaleRegistration === 'function'\) renderSaleRegistration\(\);\n        \n    \/\/ Update Charts if they exist\n        if \(typeof renderAdminCharts === 'function'\) \{\n            renderAdminCharts\(db\.users\);\n        \}\n    \}\);/, `if(typeof renderSaleRegistration === 'function') renderSaleRegistration();
        
    // Update Charts if they exist
        if (typeof renderAdminCharts === 'function') {
            renderAdminCharts(db.users);
        }
        }, 150);
    });`);

code = code.replace(/tbody\.innerHTML = '';\n    let usersList = db\.users\.filter/g, `tbody.innerHTML = '';\n    let htmlStr = '';\n    let usersList = db.users.filter`);

code = code.replace(/tbody\.innerHTML \+= `/g, `htmlStr += \``);

code = code.replace(/    \}\);\n\}\n\nasync function updateUserStatus/g, `    });\n    tbody.innerHTML = htmlStr;\n}\n\nasync function updateUserStatus`);

code = code.replace(/list\.innerHTML = '';\n    db\.categories\.forEach\(cat => \{\n        list\.innerHTML \+= `/g, `list.innerHTML = '';\n    let htmlCatStr = '';\n    db.categories.forEach(cat => {\n        htmlCatStr += \``);

code = code.replace(/        `;\n    \}\);\n    \n    if \(document\.getElementById/g, `        \`;\n    });\n    list.innerHTML = htmlCatStr;\n    \n    if (document.getElementById`);


code = code.replace(/list\.innerHTML = '';\n    if\(filtered\.length === 0\) \{/g, `list.innerHTML = '';\n    let htmlSupStr = '';\n    if(filtered.length === 0) {`);

code = code.replace(/list\.innerHTML \+= `/g, `htmlSupStr += \``);

code = code.replace(/        `;\n    \}\);\n\}\n\nfunction editSupplier/g, `        \`;\n    });\n    list.innerHTML = htmlSupStr;\n}\n\nfunction editSupplier`);

code = code.replace(/let history = db\.backups_history \|\| \[\];/g, `let history = db.backups_history || [];\n    let htmlBkpStr = '';`);

code = code.replace(/        const tr = document\.createElement\('tr'\);/g, `        `);

code = code.replace(/tr\.innerHTML = `/g, `htmlBkpStr += \`\n<tr>`);

code = code.replace(/            <\/td>\n        `;\n        tbody\.appendChild\(tr\);\n    \}\);/g, `            <\/td>\n        <\/tr>\`;\n    });\n    tbody.innerHTML = htmlBkpStr;`);


fs.writeFileSync('js/admin.js', code);
console.log("Done patching admin.js");
