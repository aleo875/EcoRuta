import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase'; // Ajusta la ruta a tu config de Firebase
import { Link } from 'react-router-dom';

const ExplorarPuntos = () => {
    const [puntos, setPuntos] = useState([]);

    useEffect(() => {
        // Aquí puedes reciclar tu código para traer TODOS los puntos de Firebase
        const fetchTodosLosPuntos = async () => {
            // Ajusta tu appId o ruta de Firebase según tu proyecto
            const ref = collection(db, 'artifacts', 'TU_APP_ID', 'public', 'data', 'puntos_reciclaje');
            const snapshot = await getDocs(ref);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPuntos(data);
        };
        fetchTodosLosPuntos();
    }, []);

    return (
        <div className="p-6">
    // ... adentro de tu componente, antes del título:
            <Link to="/" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 mb-4">
                ← Volver al inicio
            </Link>
            <h1 className="text-2xl font-bold mb-4">Directorio de Puntos de Reciclaje</h1>

            {/* Espacio para futuros filtros */}
            <div className="flex gap-2 mb-6">
                <button className="px-4 py-2 bg-gray-200 rounded-full">Plástico</button>
                <button className="px-4 py-2 bg-gray-200 rounded-full">Electrónicos</button>
            </div>

            {/* Lista de tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {puntos.map(punto => (
                    <div key={punto.id} className="border p-4 rounded-lg shadow-sm">
                        <h3 className="font-bold text-lg">{punto.nombre}</h3>
                        <p className="text-gray-600 text-sm">{punto.direccion}</p>
                        <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            {punto.tipo}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExplorarPuntos;