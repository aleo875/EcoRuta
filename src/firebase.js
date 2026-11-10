import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Reemplaza esto con los datos de TU proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCfpbW9vQHRUD0e-oB7IanSrKH88uaPWRg",
  authDomain: "ecorutabd.firebaseapp.com",
  projectId: "ecorutabd",
  storageBucket: "ecorutabd.firebasestorage.app",
  messagingSenderId: "605031175505",
  appId: "1:605031175505:web:20a9d11aa3b0d079326f70"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la base de datos para usarla en App.jsx
export const db = getFirestore(app);