import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { Link } from 'react-router-dom';
import { Gift, Award, CheckCircle } from 'lucide-react';

const recompensas = [
  { id: 1, titulo: "Cupón 10% en cafetería local", costo: 50, icono: "☕" },
  { id: 2, titulo: "Bolsa ecológica reutilizable", costo: 150, icono: "🛍️" },
  { id: 3, titulo: "Termo de bambú EcoRuta", costo: 300, icono: "🥤" }
];

export default function CanjearPuntos() {
  const [misPuntos, setMisPuntos] = useState(0);
  const [mensaje, setMensaje] = useState("");
  // Añadimos un estado para guardar el usuario una vez que Firebase lo confirme
  const [currentUser, setCurrentUser] = useState(null); 
  const auth = getAuth();

  // 1. Escuchar los cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); 
    });
    return () => unsubscribe(); // Limpiamos el observador
  }, [auth]);

  // 2. Cargar puntos SOLO cuando currentUser ya tiene los datos reales
  useEffect(() => {
    const cargarPuntos = async () => {
      if (currentUser) {
        const userRef = doc(db, 'usuarios', currentUser.uid); // Asegúrate de que tu colección se llame 'usuarios'
        const docSnap = await getDoc(userRef);
        if (docSnap.exists() && docSnap.data().puntosEco) {
          setMisPuntos(docSnap.data().puntosEco);
        } else {
          setMisPuntos(0);
        }
      }
    };
    cargarPuntos();
  }, [currentUser]); // Este efecto se ejecuta cada que currentUser cambia

  const manejarCanje = async (premio) => {
    if (!currentUser) return; // Protección extra
    
    if (misPuntos < premio.costo) {
      setMensaje(`No tienes suficientes puntos para: ${premio.titulo}`);
      setTimeout(() => setMensaje(""), 3000);
      return;
    }

    try {
      const nuevosPuntos = misPuntos - premio.costo;
      const userRef = doc(db, 'usuarios', currentUser.uid);
      
      await updateDoc(userRef, { puntosEco: nuevosPuntos });
      
      setMisPuntos(nuevosPuntos);
      setMensaje(`¡Felicidades! Has canjeado: ${premio.titulo}`);
      setTimeout(() => setMensaje(""), 3000);
    } catch (error) {
      console.error("Error al canjear:", error);
      setMensaje("Hubo un error al procesar tu canje.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/" className="text-gray-500 hover:text-green-600 flex items-center gap-2 mb-6">
        ← Volver al inicio
      </Link>
      
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-900 flex items-center gap-2">
            <Award className="text-green-600" /> Mis Puntos Eco
          </h1>
          <p className="text-green-700 mt-1">Sigue reciclando para ganar más recompensas.</p>
        </div>
        <div className="text-4xl font-black text-green-600">
          {misPuntos} <span className="text-lg font-medium text-green-800">pts</span>
        </div>
      </div>

      {mensaje && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-lg flex items-center gap-2 font-medium">
          <CheckCircle size={20} /> {mensaje}
        </div>
      )}

      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Gift className="text-gray-500" /> Catálogo de recompensas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recompensas.map((premio) => (
          <div key={premio.id} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center">
            <div className="text-4xl mb-4">{premio.icono}</div>
            <h3 className="font-bold text-gray-800 mb-2">{premio.titulo}</h3>
            <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 font-bold rounded-full mb-4">
              {premio.costo} pts
            </span>
            <button
              onClick={() => manejarCanje(premio)}
              disabled={misPuntos < premio.costo}
              className={`w-full py-2 rounded-lg font-medium transition-colors ${
                misPuntos >= premio.costo 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {misPuntos >= premio.costo ? 'Canjear ahora' : 'Puntos insuficientes'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}