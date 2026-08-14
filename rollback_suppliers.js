const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, getDocs, collection } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCTiKIsqa6Fe1ejIG3dLK9dl6kqAbO4Z7E",
  authDomain: "sourcingpro-36ec2.firebaseapp.com",
  projectId: "sourcingpro-36ec2",
  storageBucket: "sourcingpro-36ec2.firebasestorage.app",
  messagingSenderId: "541744405333",
  appId: "1:541744405333:web:4e1f7407f79c07188d2ddc",
  measurementId: "G-VXQMNBCJMZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function rollback() {
    try {
        console.log("Fetching all users...");
        const usersSnap = await getDocs(collection(db, 'users'));
        let deleteCount = 0;
        
        for (const userDoc of usersSnap.docs) {
            const data = userDoc.data();
            // Check if this was imported by our script
            if (data.role === 'supplier' && data.email && data.email.startsWith('import_') && data.email.endsWith('@fournisseur.com')) {
                await deleteDoc(doc(db, 'users', userDoc.id));
                deleteCount++;
                process.stdout.write(`\rDeleted: ${deleteCount}`);
            }
        }
        console.log(`\nRollback complete. Deleted ${deleteCount} imported suppliers.`);
        
        console.log("Fetching backups history...");
        const histSnap = await getDocs(collection(db, 'backups_history'));
        let histDeleteCount = 0;
        
        for (const histDoc of histSnap.docs) {
            const data = histDoc.data();
            if (data.snapshot && data.snapshot.email && data.snapshot.email.startsWith('import_')) {
                await deleteDoc(doc(db, 'backups_history', histDoc.id));
                histDeleteCount++;
                process.stdout.write(`\rDeleted history: ${histDeleteCount}`);
            }
        }
        console.log(`\nDeleted ${histDeleteCount} history records.`);
        
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

rollback();
