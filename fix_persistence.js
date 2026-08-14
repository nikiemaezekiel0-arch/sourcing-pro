const fs = require('fs');
let code = fs.readFileSync('js/db.js', 'utf8');

const persistenceCode = `
const firestore = firebase.firestore();
try {
    firestore.enablePersistence({ synchronizeTabs: true })
        .catch(err => console.error("Firebase persistence error:", err));
} catch (e) {
    console.error(e);
}
const storage = firebase.storage();
`;

code = code.replace(/const firestore = firebase\.firestore\(\);\nconst storage = firebase\.storage\(\);/, persistenceCode);

fs.writeFileSync('js/db.js', code);
console.log("Enabled Firebase persistence in db.js");
