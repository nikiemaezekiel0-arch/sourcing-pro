const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
async function run() {
  const snap = await db.collection('trainings').where('type', '==', 'ebook').get();
  snap.forEach(doc => {
      console.log(doc.id, "=>", doc.data().fileUrl);
  });
}
run();
