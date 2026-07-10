import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCqnI3qtcu5j7opH83uzJABZ4-faglimWg",
  authDomain: "goalchain-15dce.firebaseapp.com",
  projectId: "goalchain-15dce",
  storageBucket: "goalchain-15dce.firebasestorage.app",
  messagingSenderId: "849083355742",
  appId: "1:849083355742:web:00d51b1c8b03b9fb11dacf",
  measurementId: "G-SS6CP68H8Z"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
