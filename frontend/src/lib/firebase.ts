import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDbB0jUdKKqrjo-GqaDSlXI6DSxUuNjtHw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "aarogya-mitra-4e131.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "aarogya-mitra-4e131",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "aarogya-mitra-4e131.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "58006307613",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:58006307613:web:65a1a4983b8dcbdc1d97f4",
}

// Live Firebase Configuration Active
export const isFirebaseConfigured = true

// Initialize Firebase client safely across Next.js SSR and client re-renders
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
const auth: Auth = getAuth(app)

export { app, auth }
export default app
