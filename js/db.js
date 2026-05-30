// --- Firebase Database Management ---

const firebaseConfig = {
  apiKey: "AIzaSyCTiKIsqa6Fe1ejIG3dLK9dl6kqAbO4Z7E",
  authDomain: "sourcingpro-36ec2.firebaseapp.com",
  projectId: "sourcingpro-36ec2",
  storageBucket: "sourcingpro-36ec2.firebasestorage.app",
  messagingSenderId: "541744405333",
  appId: "1:541744405333:web:4e1f7407f79c07188d2ddc",
  measurementId: "G-VXQMNBCJMZ"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();
const storage = firebase.storage();

// Helper to upload files to Firebase Storage
async function uploadFileToStorage(file, path) {
    if (!file) return null;
    const storageRef = storage.ref();
    const fileRef = storageRef.child(`${path}/${Date.now()}_${file.name}`);
    
    // Create a promise that rejects after 5 minutes (300000ms) to allow large 20MB uploads
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout: L'upload prend plus de 5 minutes. Vérifiez votre connexion ou que Firebase Storage est activé.")), 300000);
    });
    
    try {
        // Race the upload against the timeout
        const snapshot = await Promise.race([
            fileRef.put(file),
            timeoutPromise
        ]);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return downloadURL;
    } catch (e) {
        console.error("Storage upload error:", e);
        alert("Erreur Firebase Storage : " + (e.message || "Impossible d'uploader."));
        showNotification("Erreur lors de l'envoi du fichier : " + e.message, "error");
        throw e; // Rethrow to stop the save process
    }
}
// Local cache to keep synchronous functions working
let localDB = {
    users: [],
    categories: [],
    suppliers: [],
    trainings: [],
    agent_products: [],
    orders: []
};

// Initialize Database structure and real-time listeners
function initDB() {
    ['users', 'categories', 'suppliers', 'trainings', 'agent_products', 'orders'].forEach(collectionName => {
        firestore.collection(collectionName).onSnapshot(snapshot => {
            localDB[collectionName] = [];
            snapshot.forEach(doc => {
                localDB[collectionName].push({ ...doc.data(), id: doc.id });
            });
            window.dispatchEvent(new Event('db_updated'));
        }, error => {
            console.error("Firebase Snapshot Error:", error);
        });
    });

    // Populate initial test data if DB is completely empty (runs once)
    setTimeout(() => {
        if (localDB.users.length === 0) {
            saveDoc('users', { id: 'usr_admin1', name: 'Administrateur', phone: 'admin', password: 'admin', role: 'admin', status: 'active' });
            saveDoc('categories', { id: 'cat_1', name: 'Électronique', icon: 'devices' });
            saveDoc('categories', { id: 'cat_2', name: 'Vêtements & Mode', icon: 'checkroom' });
            saveDoc('categories', { id: 'cat_3', name: 'Maison & Décoration', icon: 'chair' });
            saveDoc('categories', { id: 'cat_4', name: 'Matériel Industriel', icon: 'factory' });
        }
    }, 5000);
}

// Get the full database object (synchronous)
function getDB() {
    return localDB;
}

// Helper to save a single document to Firebase
async function saveDoc(collectionName, docObj) {
    try {
        await firestore.collection(collectionName).doc(docObj.id).set(docObj);
        return true;
    } catch (e) {
        console.error("Error saving doc:", e);
        showNotification("Erreur de sauvegarde", "error");
        return false;
    }
}

// Helper to delete a single document
async function deleteDoc(collectionName, docId) {
    try {
        await firestore.collection(collectionName).doc(docId).delete();
        showNotification("Supprimé avec succès", "success");
    } catch (e) {
        console.error("Error deleting doc:", e);
    }
}

// Generate unique ID
function generateId(prefix = 'id_') {
    return prefix + Date.now() + Math.random().toString(36).substr(2, 9);
}

// --- Session Management ---
const CURRENT_USER_KEY = 'SourcingDirectory_CurrentUser';

function getCurrentUser() {
    const userJson = sessionStorage.getItem(CURRENT_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
}

function setCurrentUser(user) {
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function logout() {
    sessionStorage.removeItem(CURRENT_USER_KEY);
    window.location.reload();
}

// --- Utility: Notifications ---
function showNotification(message, type = 'success') {
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `
        <span class="material-icons-round">${type === 'success' ? 'check_circle' : 'info'}</span>
        <p>${message}</p>
    `;
    container.appendChild(notif);

    setTimeout(() => {
        notif.classList.add('hide');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Init on load
initDB();
