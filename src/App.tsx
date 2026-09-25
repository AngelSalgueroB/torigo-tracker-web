import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { createClient } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Asegura que los estilos de Leaflet carguen

// --- 🚨 SEGURIDAD: LLAVES PROTEGIDAS MEDIANTE .ENV 🚨 ---
// Cambia "VITE_" por "NEXT_PUBLIC_" o "REACT_APP_" según el framework web que uses
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// --- CONFIGURACIÓN DE ICONOS ---
const iconMototaxi = new L.Icon({
  iconUrl: '/logo.png', // Asegúrate de tener este logo en tu carpeta public
  iconSize: [32, 32], 
  iconAnchor: [16, 16],
  className: 'drop-shadow-lg' // Sombra mediante CSS para que resalte
});

// 📌 PIN DE DESTINO MEJORADO (Con sombra real para que no se pierda en el mapa)
const iconDestino = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Componente para que el mapa siga a la mototaxi automáticamente
const MapUpdater = ({ ubicacion }: { ubicacion: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([ubicacion.lat, ubicacion.lng], map.getZoom(), { animate: true, duration: 1.5 });
  }, [ubicacion, map]);
  return null;
};

export default function App() {
  const [viajeId, setViajeId] = useState<string | null>(null);
  const [viaje, setViaje] = useState<any>(null);
  const [ubicacionConductor, setUbicacionConductor] = useState<{ lat: number, lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    
    if (!id) {
      setError('Enlace inválido. No se encontró el viaje.');
      return;
    }
    setViajeId(id);

    const cargarViaje = async () => {
      // 1. Cargamos el viaje base
      const { data: dataViaje, error: errViaje } = await supabase
        .from('viajes')
        .select('*')
        .eq('id', id)
        .single();

      if (errViaje || !dataViaje) {
        setError('Viaje no encontrado.');
        return;
      }
      
      if (dataViaje.estado === 'completado' || dataViaje.estado === 'cancelado') {
        setError('Este viaje ya ha finalizado. ¡Llegó a su destino a salvo!');
        return;
      }

      // 2. Cargamos los datos extra del conductor asignado
      let perfilConductor = null;
      if (dataViaje.conductor_id) {
        const { data: dataConductor } = await supabase
          .from('perfiles')
          .select('nombre_completo, vehiculo_placa')
          .eq('id', dataViaje.conductor_id)
          .single();
        perfilConductor = dataConductor;
      }
      
      setViaje({ ...dataViaje, perfil_conductor: perfilConductor });
      setUbicacionConductor({ lat: dataViaje.origen_lat, lng: dataViaje.origen_lng });
    };

    cargarViaje();
  }, []);

  useEffect(() => {
    if (!viajeId) return;

    const canalGps = supabase.channel(`gps_${viajeId}`)
      .on('broadcast', { event: 'gps_mototaxi' }, (payload) => {
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

  // Utilidad para formatear la fecha
  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '---';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-PE', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

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
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-gray-400 animate-pulse">Conectando con la mototaxi...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[#0a0a0a] flex flex-col font-sans">
      
      {/* 🚨 CABECERA FLOTANTE MEJORADA (Grid de 2 columnas) */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-3 md:p-5 pointer-events-none">
        <div className="bg-[#111111]/95 backdrop-blur-md border border-gray-800/60 rounded-2xl p-4 md:p-5 shadow-2xl pointer-events-auto max-w-2xl mx-auto w-full">
          
          <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Tori<span className="bg-red-600 text-white px-1.5 py-0.5 rounded ml-0.5">Go!</span>
            </h1>
            <span className="bg-green-500/10 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full border border-green-500/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              En Vivo
            </span>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {/* Fila 1: Nombres */}
            <div>
              <p className="text-gray-500 text-[11px] uppercase font-bold tracking-wider mb-0.5">Pasajero</p>
              <p className="text-white font-medium text-sm truncate">{viaje.pasajero_nombre}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[11px] uppercase font-bold tracking-wider mb-0.5">Conductor</p>
              <p className="text-white font-medium text-sm truncate">
                {viaje.perfil_conductor?.nombre_completo || 'Buscando...'}
              </p>
            </div>

            {/* Fila 2: Placa y Fecha */}
            <div>
              <p className="text-gray-500 text-[11px] uppercase font-bold tracking-wider mb-0.5">Placa</p>
              {viaje.perfil_conductor?.vehiculo_placa ? (
                <span className="bg-[#facc15] text-black font-bold text-xs px-2 py-0.5 rounded-sm shadow-sm inline-block border border-yellow-400">
                  {viaje.perfil_conductor.vehiculo_placa}
                </span>
              ) : (
                <span className="text-gray-500 text-sm">--</span>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-[11px] uppercase font-bold tracking-wider mb-0.5">Inicio del viaje</p>
              <p className="text-gray-300 text-sm">{formatearFecha(viaje.created_at)}</p>
            </div>

            {/* Fila 3: Rutas (Ocupan ancho completo) */}
            <div className="col-span-2 bg-[#1a1a1a] rounded-lg p-2.5 border border-gray-800/50 mt-1">
              <div className="flex items-start gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Punto de Recojo</p>
                  <p className="text-gray-200 text-xs truncate">{viaje.origen_direccion}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">Destino</p>
                  <p className="text-white font-medium text-xs truncate">{viaje.destino_direccion}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="flex-1 w-full z-0">
        <MapContainer 
          center={[ubicacionConductor.lat, ubicacionConductor.lng]} 
          zoom={16.5} 
          style={{ height: '100%', width: '100%', backgroundColor: '#0A0A0A' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          <MapUpdater ubicacion={ubicacionConductor} />

          <Marker position={[viaje.destino_lat, viaje.destino_lng]} icon={iconDestino}>
            <Popup className="font-bold">Destino Final</Popup>
          </Marker>

          <Marker position={[ubicacionConductor.lat, ubicacionConductor.lng]} icon={iconMototaxi}>
            <Popup className="font-bold text-center">¡Aquí va {viaje.pasajero_nombre}!</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}