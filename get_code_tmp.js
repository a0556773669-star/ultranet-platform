const {initializeApp,cert}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({credential:cert(sa)});
getFirestore().collection('n_device_codes').doc('a0556773669@gmail.com').get().then(d=>{
  console.log(d.exists ? JSON.stringify(d.data()) : 'NO DOC');
});
