import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// --- KONFIGURASI FIREBASE ---
// Mendukung Environment Variables (Vite standard) untuk keamanan Deployment.
// Menggunakan optional chaining (?.) untuk mencegah error jika import.meta.env undefined
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyAJm9_47pNSrSP4hy8uyrVsnW4HdzBMHfM", 
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "biomedexam.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "biomedexam",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "biomedexam.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "401256288904",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:401256288904:web:43fa30c21d15f1530b053d",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-FG76NW6MB9"
};

// Cek status konfigurasi
export const isFirebaseConfigured = true;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Debugging: Cek koneksi di Console Browser
console.log("🔥 Firebase Initialized:", firebaseConfig.projectId, import.meta.env?.VITE_FIREBASE_API_KEY ? "(Using Env)" : "(Using Fallback)");

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