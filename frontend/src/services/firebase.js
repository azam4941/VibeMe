import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBdZg-q8Ua133heBl_Y0ifh9WuqSjzTQ5s",
  authDomain: "vibeme-bce95.firebaseapp.com",
  projectId: "vibeme-bce95",
  storageBucket: "vibeme-bce95.firebasestorage.app",
  messagingSenderId: "565797946033",
  appId: "1:565797946033:web:cc2a9ce107438351839890",
  measurementId: "G-BMP7C2KWTP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
