import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

// Coordenadas de prueba (Tonalá / GDL)
const centrosDeAcopio = [
  { id: '1', nombre: 'Centro Reciclaje Tonalá', lat: 20.6243, lng: -103.2439, tipo: 'Plástico' },
  { id: '2', nombre: 'Acopio Centro GDL', lat: 20.6766, lng: -103.3475, tipo: 'Cartón' }
];

export default function MapaEcoRuta() {
  const posicionInicial = { lat: 20.6500, lng: -103.3000 };

  return (
    <div className="w-full h-screen">
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={posicionInicial}
          defaultZoom={12}
          style={{ width: '100%', height: '100%' }}
        >
          {centrosDeAcopio.map((centro) => (
            <AdvancedMarker
              key={centro.id}
              position={{ lat: centro.lat, lng: centro.lng }}
              title={centro.nombre}
            >
              <Pin background={'#22c55e'} borderColor={'#166534'} glyphColor={'#ffffff'} />
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}