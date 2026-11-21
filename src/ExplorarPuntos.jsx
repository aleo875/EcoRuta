import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase'; 
import { Link } from 'react-router-dom';

const ExplorarPuntos = () => {
  const [puntos, setPuntos] = useState([]);
  // 1. Agregamos un estado para saber qué filtro está activo
  const [filtroActivo, setFiltroActivo] = useState('Todos');

  useEffect(() => {
    const fetchTodosLosPuntos = async () => {
      try {
        // OJO AQUÍ: Revisa que esta ruta sea EXACTAMENTE la misma que usas en tu mapa
        // Si en tu mapa usas solo collection(db, 'puntos_reciclaje'), cámbialo aquí también.
        const ref = collection(db, "puntos_reciclaje");
        
        const snapshot = await getDocs(ref);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPuntos(data);
      } catch (error) {
        console.error("Error al cargar los puntos:", error);
      }
    };
    fetchTodosLosPuntos();
  }, []);

  // 2. Lógica para filtrar los puntos antes de mostrarlos
  const puntosFiltrados = puntos.filter(punto => {
    if (filtroActivo === 'Todos') return true;
    // Asume que tus puntos en Firebase tienen un campo "tipo" (ej. "Plástico")
    return punto.material === filtroActivo; 
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to="/" className="text-gray-500 hover:text-green-600 flex items-center gap-2 mb-6 transition-colors">
        ← Volver al inicio
      </Link>
      
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Directorio de Puntos de Reciclaje</h1>
      
      {/* 3. Botones de filtro dinámicos */}
       <div className="flex flex-wrap gap-3 mb-8">
        {['Todos', 'Plástico', 'Electrónicos', 'Cartón', 'Vidrio'].map(categoria => (
          <button 
            key={categoria}
            onClick={() => setFiltroActivo(categoria)}
            className={`px-4 py-2 rounded-full font-medium transition-all ${
              filtroActivo === categoria 
                ? 'bg-green-600 text-white shadow-md' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {categoria}
          </button>
        ))}
      </div>

      {/* 4. Lista de tarjetas filtradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {puntosFiltrados.length > 0 ? (
          puntosFiltrados.map(punto => (
            <div key={punto.id} className="border border-gray-200 bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-bold text-lg text-gray-800 mb-1">{punto.nombre || 'Punto sin nombre'}</h3>
              <p className="text-gray-500 text-sm mb-4">{punto.direccion || 'Dirección no disponible'}</p>
              
              <div className="flex justify-between items-center">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                  {punto.tipo || 'General'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 col-span-full">No se encontraron puntos de reciclaje para esta categoría.</p>
        )}
      </div>
    </div>
  );
};

export default ExplorarPuntos;