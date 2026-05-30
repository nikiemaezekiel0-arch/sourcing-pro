# État du Projet : SourcingDirectory Pro

**Dernière mise à jour :** Mai 2026

Ce fichier sert de "mémoire" pour le projet. Si vous ouvrez une nouvelle conversation avec l'IA, demandez-lui simplement de **"Lire le fichier PROJECT_STATE.md"** pour qu'elle comprenne immédiatement tout le contexte.

## 1. Architecture Actuelle (Version V1)
Le projet est une application web front-end sans serveur complexe, conçue pour être hébergée sur Netlify.
- **HTML/JS/CSS pur** : Pas de framework lourd (pas de React/Vue), pour une maintenance très simple.
- **Base de données** : Google Firebase (Firestore) en version "compat" (via CDN).
- **Fichiers principaux** :
  - `index.html` : Contient toute la structure (Authentification, Dashboard Admin, Dashboard Client).
  - `css/style.css` : Design ultra-moderne (Dark mode, Glassmorphism, Navigation mobile en bas de l'écran).
  - `js/db.js` : Logique de base de données Firebase et écouteurs en temps réel (`onSnapshot`).
  - `js/auth.js` : Logique de connexion et d'inscription.
  - `js/admin.js` : Logique du tableau de bord Administrateur.
  - `js/client.js` : Logique du tableau de bord Client.

## 2. Décisions Techniques Importantes
- **Firebase sur Netlify** : Nous avons eu un blocage initial sur Netlify à cause des règles de sécurité Firebase. Cela a été résolu en appliquant la règle Firestore `allow read, write: if true;` (Mode test ouvert).
- **Tentative Supabase** : Nous avons brièvement essayé de passer sur Supabase, mais nous avons finalement fait un "Rollback" (retour en arrière) vers Firebase car c'était beaucoup plus simple et ça fonctionnait déjà bien.
- **Responsive Design** : Le site a été optimisé pour mobile avec une barre de navigation fixée en bas de l'écran (`bottom: 0`), typique des applications mobiles natives.

## 3. Identifiants de Test
- **Compte Admin par défaut** : 
  - Numéro / ID : `admin`
  - Mot de passe : `admin`

## 4. Prochaines Étapes Possibles (Idées)
- **Système de commande** : Permettre aux clients de simuler des commandes avec quantités, adresse de livraison et méthode de paiement.
- **Sécurisation Firebase** : Actuellement, la base de données est ouverte. À terme, il faudra peut-être restreindre les écritures uniquement aux utilisateurs connectés.
- **Upload d'images réel** : Connecter l'upload d'images (pour les fournisseurs ou formations) à Firebase Storage au lieu de garder de simples liens ou base64.
