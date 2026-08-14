const { initializeApp } = require('firebase/app');
const { getFirestore, getDocs, collection } = require('firebase/firestore');

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

async function check() {
    const snap = await getDocs(collection(db, 'users'));
    const suppliers = snap.docs.map(d => d.data()).filter(u => u.role === 'supplier');
    console.log("Suppliers status:");
    suppliers.slice(0, 5).forEach(s => console.log(s.name, s.status));
    process.exit(0);
}

check();
