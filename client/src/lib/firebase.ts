// client/src/lib/firebase.ts
// This module handles Firebase Authentication ONLY.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User
} from "firebase/auth";

// REMOVE THIS LINE: import { getFirestore } from 'firebase/firestore'; // <<< REMOVE THIS LINE!

const firebaseConfig = {
  apiKey: "AIzaSyBP9AphbkcdxqF3pCp02VOSI-5-SzEqTdw",
  authDomain: "the-ribbat-times.firebaseapp.com",
  projectId: "the-ribbat-times",
  storageBucket: "the-ribbat-times.firebasestorage.app",
  messagingSenderId: "794303435548",
  appId: "1:794303435548:web:a0c9eb78083955225e20d9"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.error("Firebase configuration is incomplete. Please check environment variables.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');

export const checkRedirectResult = async () => { /* ... */ };
export const sendUserToBackend = async (user: User) => { /* ... */ };
export const signInWithGoogle = async () => { /* ... */ };
export const signOutUser = async () => { /* ... */ };

export { auth }; // KEEP this line.
// REMOVE THIS LINE: export const db = getFirestore(app); // <<< REMOVE THIS LINE!
