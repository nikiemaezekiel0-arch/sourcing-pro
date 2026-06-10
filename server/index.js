require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase Admin
// You must provide FIREBASE_SERVICE_ACCOUNT as a JSON string in your .env file
// Or point to a local file.
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require('./firebase-service-account.json');
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin initialized successfully.");
} catch (e) {
    console.error("⚠️ Failed to initialize Firebase Admin. Please ensure FIREBASE_SERVICE_ACCOUNT is set in .env or firebase-service-account.json exists.", e.message);
}

const db = admin.firestore ? admin.firestore() : null;

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

// PHASE 2: Triggered by frontend when a user registers
app.post('/api/v1/notify-registration', async (req, res) => {
    try {
        const { id, name, email } = req.body;
        
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) {
            return res.status(500).json({ error: "Telegram config missing in .env" });
        }

        const message = `🔔 <b>Nouvelle Inscription sur le Site !</b>\n👤 <b>Nom :</b> ${name}\n📧 <b>Email :</b> ${email}\n⏳ <b>Statut :</b> En attente de validation`;

        const reply_markup = {
            inline_keyboard: [
                [
                    { text: "✅ Valider le compte", callback_data: `user_approve:${id}` },
                    { text: "❌ Refuser", callback_data: `user_reject:${id}` }
                ]
            ]
        };

        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_ADMIN_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            reply_markup: reply_markup
        });

        res.status(200).json({ success: true, messageId: response.data.result.message_id });
    } catch (error) {
        console.error("Error sending Telegram notification:", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Failed to send notification" });
    }
});

// PHASE 3: Webhook triggered by Telegram when button is clicked
app.post('/api/v1/telegram/webhook', async (req, res) => {
    // Always respond 200 to Telegram to prevent retries
    res.status(200).send('OK');

    try {
        const update = req.body;

        if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const data = callbackQuery.data; // e.g. "user_approve:12345"
            const message = callbackQuery.message;
            const chatId = message.chat.id;
            
            // Security check: ensure action comes from the Admin
            if (chatId.toString() !== TELEGRAM_ADMIN_CHAT_ID.toString()) {
                console.warn(`Unauthorized action attempt from chat_id: ${chatId}`);
                return;
            }

            const [action, userId] = data.split(':');
            let newStatus = '';
            let replyText = '';

            if (action === 'user_approve') {
                newStatus = 'active';
                replyText = `✅ <b>Compte Validé !</b>\nL'utilisateur a été approuvé avec succès.`;
            } else if (action === 'user_reject') {
                newStatus = 'rejected';
                replyText = `❌ <b>Compte Refusé.</b>\nL'utilisateur a été rejeté.`;
            }

            if (newStatus && db) {
                // Update Firestore
                await db.collection('users').doc(userId).update({
                    status: newStatus
                });

                // Edit the original message to remove buttons and show result
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                    chat_id: chatId,
                    message_id: message.message_id,
                    text: message.text + '\n\n' + replyText,
                    parse_mode: 'HTML'
                });
                
                // Answer callback query to stop the loading spinner on the button
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
                    callback_query_id: callbackQuery.id,
                    text: newStatus === 'active' ? "Utilisateur validé" : "Utilisateur refusé"
                });
            }
        }
    } catch (error) {
        console.error("Webhook processing error:", error.response ? error.response.data : error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Telegram Backend running on port ${PORT}`);
    console.log(`👉 Webhook URL to register: YOUR_DOMAIN/api/v1/telegram/webhook`);
});
