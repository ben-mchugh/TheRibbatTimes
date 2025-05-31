// client/src/firebase.ts
// This module handles Firebase Firestore ONLY.

import { initializeApp } from 'firebase/app';
// REMOVE THIS LINE: //import { getAuth } from 'firebase/auth'; // ONLY import if your app uses Firebase Authentication
import { getFirestore } from 'firebase/firestore'; // <<< UNCOMMENT THIS LINE!

const firebaseConfig = {
  apiKey: "AIzaSyBP9AphbkcdxqF3pCp02VOSI-5-SzEqTdw",
  authDomain: "the-ribbat-times.firebaseapp.com",
  projectId: "the-ribbat-times",
  storageBucket: "the-ribbat-times.firebasestorage.app",
  messagingSenderId: "794303435548",
  appId: "1:794303435548:web:a0c9eb78083955225e20d9"
};

const app = initializeApp(firebaseConfig);

// REMOVE THIS LINE: //export const auth = getAuth(app);
export const db = getFirestore(app); // <<< UNCOMMENT THIS LINE!