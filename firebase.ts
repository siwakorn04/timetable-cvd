// firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 🔥 ใช้ config ที่ได้จาก Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBjWksdgF6XkVx026hhWMMLfKmgJFPgAWk",
  authDomain: "timetable-cvd-84dba.firebaseapp.com",
  projectId: "timetable-cvd-84dba",
  storageBucket: "timetable-cvd-84dba.appspot.com",
  messagingSenderId: "697573369216",
  appId: "1:697573369216:web:47c2196176fd97660d6d65",
  measurementId: "G-ENY8566D03"
};

// 🚀 เริ่มต้น Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
