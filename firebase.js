import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAdOlIbJaXzMymN3MlekGcFRexvIzm5woo",
  authDomain: "loopz-c8941.firebaseapp.com",
  projectId: "loopz-c8941",
  storageBucket: "loopz-c8941.firebasestorage.app",
  messagingSenderId: "1094837904577",
  appId: "1:1094837904577:web:989d0381716e132feea040",
  measurementId: "G-ZP53H4CZ9L"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Google Auth Handler
export async function signUpWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        alert(`Welcome, ${result.user.displayName || 'Creator'}!`);
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'none';
    } catch (error) {
        alert("Google Sign-In Error: " + error.message);
    }
}

// Email Auth Handler
export async function signUpWithEmail(email, password, username) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        alert(`Account created! Welcome @${username}`);
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'none';
    } catch (error) {
        alert("Sign-Up Error: " + error.message);
    }
}
