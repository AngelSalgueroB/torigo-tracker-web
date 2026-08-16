import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { createClient } from '@supabase/supabase-js';
import L from 'leaflet';

// --- CONFIGURACIÓN DE ICONOS ---
const iconMototaxi = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2163/2163350.png', // Ícono de Tuk-Tuk / Mototaxi
  iconSize: [45, 45],
  iconAnchor: [22, 22]
});

const iconDestino = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149059.png', // Pin rojo clásico
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});

// --- 🚨 REEMPLAZA ESTO CON TUS CREDENCIALES DE SUPABASE 🚨 ---
const supabaseUrl = 'https://bapuddbafgcvetndwlrv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcHVkZGJhZmdjdmV0bmR3bHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTkzMjAsImV4cCI6MjA5Mjg3NTMyMH0.pqdw99navJ118xkaQZhj-QAQ01Y8ld0f94zWSd_DFnw';

const supabase = createClient(supabaseUrl, supabaseKey);

// Componente para que el mapa siga a la mototaxi automáticamente
const MapUpdater = ({ ubicacion }: { ubicacion: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([ubicacion.lat, ubicacion.lng], map.getZoom(), { animate: true, duration: 1 });
  }, [ubicacion, map]);
  return null;
};

export default function App() {
  const [viajeId, setViajeId] = useState<string | null>(null);
  const [viaje, setViaje] = useState<any>(null);
  const [ubicacionConductor, setUbicacionConductor] = useState<{ lat: number, lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Obtener el ID del viaje desde la URL (ej: rastreo.com/?id=12345)
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) {
      setError('Enlace inválido. No se encontró el viaje.');
      return;
    }
    setViajeId(id);

    // 2. Cargar los datos del viaje desde Supabase
    const cargarViaje = async () => {
      const { data, error } = await supabase
        .from('viajes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setError('Viaje no encontrado o ya ha finalizado.');
        return;
      }
      
      setViaje(data);
      // Ubicación inicial (Origen del viaje)
      setUbicacionConductor({ lat: data.origen_lat, lng: data.origen_lng });
    };

    cargarViaje();
  }, []);

  useEffect(() => {
    if (!viajeId) return;

    // 3. 🚨 LA MAGIA: Escuchar el GPS del conductor en tiempo real 🚨
    const canalGps = supabase.channel(`gps_${viajeId}`)
      .on('broadcast', { event: 'gps_mototaxi' }, (payload) => {
        // Cada vez que el celular del conductor envíe su GPS, lo vemos aquí:
        console.log("Nueva ubicación:", payload.payload);
        setUbicacionConductor({
          lat: payload.payload.lat,
          lng: payload.payload.lng
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalGps);
    };
  }, [viajeId]);

  // Pantallas de Carga y Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-darkBg text-white px-5 text-center">
        <h1 className="text-4xl font-black text-brand mb-2">Tori<span className="bg-brand text-white px-2 py-0.5 rounded ml-1">Go!</span></h1>
        <p className="text-gray-400 mt-5">{error}</p>
      </div>
    );
  }

  if (!viaje || !ubicacionConductor) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-darkBg text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mb-4"></div>
        <p className="text-gray-400 animate-pulse">Buscando la mototaxi...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-darkBg flex flex-col">
      {/* Cabecera Flotante */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="bg-[#19191c] border border-gray-800 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-black text-white">Tori<span className="bg-brand px-1.5 py-0.5 rounded ml-0.5">Go!</span></h1>
            <span className="bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              En Vivo
            </span>
          </div>
          <p className="text-gray-400 text-sm">Pasajero: <span className="text-white font-bold">{viaje.pasajero_nombre}</span></p>
          <p className="text-gray-400 text-sm">Destino: <span className="text-white font-bold">{viaje.destino_direccion}</span></p>
        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="flex-1 w-full z-0">
        <MapContainer 
          center={[ubicacionConductor.lat, ubicacionConductor.lng]} 
          zoom={16} 
          style={{ height: '100%', width: '100%', backgroundColor: '#0A0A0A' }}
          zoomControl={false}
        >
          {/* Capa de Mapa Oscuro (Estilo ToriGo) */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          <MapUpdater ubicacion={ubicacionConductor} />

          {/* Marcador del Destino */}
          <Marker position={[viaje.destino_lat, viaje.destino_lng]} icon={iconDestino}>
            <Popup className="font-bold">Destino Final</Popup>
          </Marker>

          {/* Marcador de la Mototaxi (Moviéndose) */}
          <Marker position={[ubicacionConductor.lat, ubicacionConductor.lng]} icon={iconMototaxi}>
            <Popup className="font-bold text-center">¡Aquí va {viaje.pasajero_nombre}!</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}