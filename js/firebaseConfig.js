export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDwVkQ6e1XT1URi9q83iefJilTQuiHxAq0",
  authDomain: "glot-60788.firebaseapp.com",
  projectId: "glot-60788",
  storageBucket: "glot-60788.firebasestorage.app",
  messagingSenderId: "756536891533",
  appId: "1:756536891533:web:316150e36f56ba769e2ac4",
  measurementId: "G-72MJV1RJL4",
};

export async function initFirebase() {
  try {
    const [
      { initializeApp, getApps },
      { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, signInWithCustomToken, createUserWithEmailAndPassword },
      { getFirestore, doc, getDoc, setDoc },
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"),
    ]);

    let app;
    if (!getApps().length) {
      app = initializeApp(FIREBASE_CONFIG);
    } else {
      app = getApps()[0];
    }

    let analytics = null;
    if (FIREBASE_CONFIG.measurementId) {
      try {
        const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js");
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Analytics init failed:", e);
      }
    }

    const auth = getAuth();
    const db = getFirestore();

    return {
      app, analytics, auth, db,
      onAuthStateChanged,
      signInAnonymously,
      signInWithEmailAndPassword,
      signOut,
      signInWithCustomToken,
      createUserWithEmailAndPassword,
      doc, getDoc, setDoc,
    };
  } catch (e) {
    console.warn("Firebase init error:", e);
    return null;
  }
}