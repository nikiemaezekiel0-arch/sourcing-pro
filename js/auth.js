// --- Authentication Logic ---

const auth = firebase.auth();

function switchAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const supplierForm = document.getElementById('supplier-register-form');
    const supplierSuccess = document.getElementById('supplier-register-success');
    
    // Hide all forms first
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    if (forgotForm) forgotForm.classList.add('hidden');
    if (supplierForm) supplierForm.classList.add('hidden');
    if (supplierSuccess) supplierSuccess.classList.add('hidden');
    
    // Show requested form
    if (mode === 'register') {
        registerForm.classList.remove('hidden');
    } else if (mode === 'forgot') {
        forgotForm.classList.remove('hidden');
    } else if (mode === 'supplier-register') {
        supplierForm.classList.remove('hidden');
    } else {
        loginForm.classList.remove('hidden');
    }
}

// Password Validation Logic
function isPasswordRobust(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    
    if (password.length < minLength) return "Le mot de passe doit contenir au moins 8 caractères.";
    if (!hasUppercase) return "Le mot de passe doit contenir au moins une lettre majuscule.";
    if (!hasNumber) return "Le mot de passe doit contenir au moins un chiffre.";
    return null; // Null means no error (robust)
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value.trim();
    
    if (!email || !pass) {
        return showNotification('Veuillez remplir tous les champs.', 'error');
    }
    
    // Validate email format, except if it's the 'admin', 'client', or 'fournisseur' backdoor
    if (email !== 'admin' && email !== 'client' && email !== 'fournisseur') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return showNotification('Veuillez entrer une adresse email valide.', 'error');
        }
    }
    
    // BACKDOOR: Local Admin Login for development
    if (email === 'admin' && pass === 'admin') {
        const adminDoc = { id: 'usr_admin1', name: 'Administrateur', role: 'admin', status: 'active' };
        setCurrentUser(adminDoc);
        showNotification('Connexion Administrateur réussie !', 'success');
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    
    // BACKDOOR: Local Client Login for development
    if (email === 'client' && pass === 'client') {
        const clientDoc = { id: 'usr_client_demo', name: 'Client Test', email: 'client@test.com', role: 'client', status: 'active', favorites: [] };
        setCurrentUser(clientDoc);
        showNotification('Connexion Client de test réussie !', 'success');
        setTimeout(() => window.location.reload(), 1000);
        return;
    }

    // BACKDOOR: Local Supplier Login for development
    if (email === 'fournisseur' && pass === 'fournisseur') {
        const supplierDoc = { id: 'usr_supplier_demo', name: 'Fournisseur Test', email: 'fournisseur@test.com', role: 'supplier', status: 'active' };
        setCurrentUser(supplierDoc);
        showNotification('Connexion Fournisseur de test réussie !', 'success');
        setTimeout(() => window.location.reload(), 1000);
        return;
    }
    
    const btn = event.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Connexion...';
    btn.disabled = true;

    try {
        // Authenticate with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, pass);
        const userEmail = userCredential.user.email;
        
        // Fetch user data from local Firestore cache
        const db = getDB();
        const userDoc = db.users.find(u => u.email === userEmail || u.email === email);
        
        if (!userDoc) {
            throw new Error("Compte introuvable dans la base de données. Veuillez vous réinscrire.");
        }
        
        if (userDoc.status === 'pending') {
            await auth.signOut();
            btn.innerHTML = ogText;
            btn.disabled = false;
            return showNotification("Votre compte est en attente de validation par l'administrateur.", 'error');
        }
        
        if (userDoc.status === 'rejected') {
            await auth.signOut();
            btn.innerHTML = ogText;
            btn.disabled = false;
            return showNotification("Votre demande d'inscription a été refusée.", 'error');
        }
        
        // --- DEMO ACCESS LOGIC ---
        if (userDoc.planType === 'demo') {
            let localDeviceId = localStorage.getItem('demoDeviceId');
            if (!localDeviceId) {
                localDeviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('demoDeviceId', localDeviceId);
            }

            if (userDoc.demoStatus === 'unused') {
                // Intercept first login, ask for name
                window.pendingDemoUser = userDoc;
                document.getElementById('demo-name-modal').classList.remove('hidden');
                btn.innerHTML = ogText;
                btn.disabled = false;
                return; // Stop login flow until name is provided
            } else if (userDoc.demoStatus === 'active') {
                // Device check
                if (userDoc.demoDeviceId && userDoc.demoDeviceId !== localDeviceId) {
                    await auth.signOut();
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    return showNotification("Cet accès Démo est déjà utilisé sur un autre appareil.", 'error');
                }

                // Check expiration
                if (Date.now() > userDoc.demoExpiresAt) {
                    await auth.signOut();
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    document.getElementById('demo-expired-overlay').classList.remove('hidden');
                    return; // Block login
                }
            }
        }
        
        // Success
        setCurrentUser(userDoc);
        showNotification('Connexion réussie !', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
    } catch (error) {
        console.error("Login error:", error);
        let errorMsg = "Identifiants incorrects.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMsg = "Email ou mot de passe incorrect.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMsg = "Trop de tentatives. Veuillez réessayer plus tard.";
        } else if (error.message) {
            errorMsg = error.message;
        }
        showNotification(errorMsg, 'error');
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

window.activateDemoSession = async function(event) {
    event.preventDefault();
    const nameInput = document.getElementById('demo-name-input').value.trim();
    if (!nameInput || !window.pendingDemoUser) return;

    const userDoc = window.pendingDemoUser;
    const localDeviceId = localStorage.getItem('demoDeviceId');

    try {
        const btn = event.target.querySelector('button[type="submit"]');
        btn.innerHTML = '<span class="material-icons-round rotate">sync</span> Activation...';
        btn.disabled = true;

        userDoc.name = nameInput;
        userDoc.demoStatus = 'active';
        userDoc.demoExpiresAt = Date.now() + (1 * 60 * 60 * 1000); // 1 hour
        userDoc.demoDeviceId = localDeviceId;

        await saveDoc('users', userDoc);

        document.getElementById('demo-name-modal').classList.add('hidden');
        setCurrentUser(userDoc);
        showNotification('Session Démo activée !', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch(e) {
        console.error(e);
        alert("Erreur d'activation. Veuillez réessayer.");
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const firstname = document.getElementById('reg-firstname').value.trim();
    const lastname = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const country = document.getElementById('reg-country').value;
    const countryCode = document.getElementById('reg-country-code').value;
    const phoneNum = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-password').value.trim();
    
    if (!firstname || !lastname || !email || !country || !phoneNum || !pass) {
        return showNotification('Veuillez remplir tous les champs.', 'error');
    }
    
    // Validate password robustness
    const passwordError = isPasswordRobust(pass);
    if (passwordError) {
        return showNotification(passwordError, 'error');
    }
    
    const db = getDB();
    const fullPhone = countryCode + " " + phoneNum;
    
    if (db.users.some(u => u.email === email)) {
        return showNotification('Cet email est déjà utilisé.', 'error');
    }
    
    const btn = event.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Création en cours...';
    btn.disabled = true;

    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;
        
        // Save user profile to Firestore
        const newUser = {
            id: uid, // Use Firebase Auth UID as document ID
            name: firstname + " " + lastname,
            email: email,
            country: country,
            phone: fullPhone,
            role: 'client',
            status: 'pending', // Requires manual validation by admin
            favorites: []
        };
        
        await saveDoc('users', newUser);
        
        // Notify Telegram via backend
        try {
            // For production, change to your actual deployed backend URL
            const BACKEND_URL = window.TELEGRAM_BACKEND_URL || 'http://localhost:3000';
            await fetch(`${BACKEND_URL}/api/v1/notify-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: uid,
                    name: newUser.name,
                    email: newUser.email
                })
            });
        } catch (webhookErr) {
            console.error("Failed to notify Telegram backend:", webhookErr);
        }
        
        // Sign out the newly created user immediately since they are pending approval
        await auth.signOut();
        
        // Clear form
        event.target.reset();
        
        alert("Inscription réussie ! 🎉\n\nVotre compte a été créé avec succès, mais il est EN ATTENTE d'approbation.\n\nVous ne pourrez vous connecter qu'une fois validé par l'administrateur.");
        switchAuthMode('login');
        
    } catch (error) {
        console.error("Register error:", error);
        let errorMsg = "Erreur lors de l'inscription.";
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = "Cet email est déjà enregistré.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Format d'email invalide.";
        } else if (error.code === 'auth/weak-password') {
            errorMsg = "Le mot de passe est trop faible.";
        } else if (error.code === 'auth/operation-not-allowed') {
            errorMsg = "L'authentification par email n'est pas activée sur Firebase !";
        } else if (error.code === 'permission-denied') {
            errorMsg = "Base de données bloquée : Vérifiez les règles Firestore.";
        } else if (error.message) {
            errorMsg = "Erreur: " + error.message;
        }
        showNotification(errorMsg, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    
    if (!email) {
        return showNotification('Veuillez entrer votre adresse email.', 'error');
    }
    
    const btn = event.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Envoi...';
    btn.disabled = true;

    try {
        await auth.sendPasswordResetEmail(email);
        alert("Un lien de réinitialisation sécurisé vient d'être envoyé à votre adresse email.\n\nVérifiez vos courriers indésirables (spams) s'il n'apparaît pas dans votre boîte de réception principale.");
        switchAuthMode('login');
    } catch (error) {
        console.error("Reset password error:", error);
        let errorMsg = "Erreur lors de l'envoi de l'email.";
        if (error.code === 'auth/user-not-found') {
            errorMsg = "Aucun compte n'est associé à cette adresse email.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Adresse email invalide.";
        }
        showNotification(errorMsg, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

// Handle Supplier Registration (English)
async function handleSupplierRegister(event) {
    event.preventDefault();
    const company = document.getElementById('sup-company').value.trim();
    const contact = document.getElementById('sup-contact').value.trim();
    const email = document.getElementById('sup-email').value.trim();
    const countryCode = document.getElementById('sup-country-code').value;
    const phoneNum = document.getElementById('sup-phone').value.trim();
    const pass = document.getElementById('sup-password').value.trim();
    const vipCode = document.getElementById('sup-vip-code').value.trim();
    
    const db = typeof getDB === 'function' ? getDB() : {users: [], suppliers: []};
    
    // Check VIP Code
    let linkedSupplierProfile = null;
    
    if (vipCode !== 'CHINA-VIP-888') {
        linkedSupplierProfile = db.suppliers.find(s => s.vipCode === vipCode);
        if (!linkedSupplierProfile) {
            return showNotification('Invalid VIP Invitation Code. Registration rejected.', 'error');
        }
    }
    
    if (!company || !contact || !email || !phoneNum || !pass) {
        return showNotification('Please fill in all fields.', 'error');
    }
    
    // Validate password robustness
    const passwordError = isPasswordRobust(pass);
    if (passwordError) {
        return showNotification(passwordError, 'error');
    }
    
    const fullPhone = countryCode + " " + phoneNum;
    
    if (db.users.some(u => u.email === email)) {
        return showNotification('This email is already in use.', 'error');
    }
    
    const btn = event.target.querySelector('button[type="submit"]');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Submitting...';
    btn.disabled = true;

    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const uid = userCredential.user.uid;
        
        // Save user profile to Firestore
        const newUser = {
            id: uid,
            name: contact,
            company: company,
            email: email,
            phone: fullPhone,
            role: 'supplier',
            status: 'pending', // Requires manual validation by admin
            favorites: []
        };
        
        await saveDoc('users', newUser);
        
        // Link to existing profile or create an empty draft
        if (linkedSupplierProfile) {
            // Delete the phantom user if it exists
            if (linkedSupplierProfile.userId) {
                const phantomUser = db.users.find(u => u.id === linkedSupplierProfile.userId && u.isManual);
                if (phantomUser) {
                    await deleteDoc('users', phantomUser.id);
                }
            }
            // Assign the real uid
            linkedSupplierProfile.userId = uid;
            // Clear the VIP code so it can't be reused
            linkedSupplierProfile.vipCode = null;
            await saveDoc('suppliers', linkedSupplierProfile);
            
            // Auto-activate user since they were pre-approved by admin
            newUser.status = 'active';
            await saveDoc('users', newUser);
        } else {
            const newSupplierProfile = {
                id: 'sup_' + uid,
                userId: uid,
                name: company,
                categoryId: '',
                description: '',
                wechat: '',
                whatsapp: fullPhone,
                images: [],
                pdfCatalog: '',
                views: 0
            };
            await saveDoc('suppliers', newSupplierProfile);
        }
        
        // Sign out
        await auth.signOut();
        
        event.target.reset();
        
        // Hide the form and show the success message
        document.getElementById('supplier-register-form').classList.add('hidden');
        document.getElementById('supplier-register-success').classList.remove('hidden');
        
    } catch (error) {
        console.error("Register error:", error);
        let errorMsg = "Registration error.";
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = "Email already registered.";
        } else if (error.message) {
            errorMsg = "Error: " + error.message;
        }
        showNotification(errorMsg, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}
