import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// --- KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAJm9_47pNSrSP4hy8uyrVsnW4HdzBMHfM",
  authDomain: "biomedexam.firebaseapp.com",
  projectId: "biomedexam",
  storageBucket: "biomedexam.firebasestorage.app",
  messagingSenderId: "401256288904",
  appId: "1:401256288904:web:43fa30c21d15f1530b053d",
  measurementId: "G-FG76NW6MB9"
};

// Cek status konfigurasi
export const isFirebaseConfigured = true;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (Hanya di browser environment)
if (typeof window !== 'undefined') {
  try {
    getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics warning:", e);
  }
}