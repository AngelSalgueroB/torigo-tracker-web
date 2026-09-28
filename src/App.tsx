import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { createClient } from '@supabase/supabase-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const iconMototaxi = new L.Icon({
  iconUrl: '/logo.png', 
  iconSize: [32, 32], 
  iconAnchor: [16, 16],
  className: 'drop-shadow-lg' 
});

const iconDestino = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MapUpdater = ({ ubicacion }: { ubicacion: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    // Usamos panTo en lugar de flyTo para no trabar el mapa con animaciones largas
    map.panTo([ubicacion.lat, ubicacion.lng], { animate: true, duration: 0.5 });
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
        setError('Este viaje ha finalizado.');
        return;
      }

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

    console.log("Conectando al canal GPS:", `gps_${viajeId}`);

    const canalGps = supabase.channel(`gps_${viajeId}`)
      .on('broadcast', { event: 'gps_mototaxi' }, (payload) => {
        console.log("📡 Nuevo GPS del Conductor recibido:", payload.payload);
        setUbicacionConductor({
          lat: payload.payload.lat,
          lng: payload.payload.lng
        });
      })
      .subscribe((status) => {
        console.log("Estado del canal Realtime:", status);
      });

    return () => {
      console.log("🔌 Desconectando del canal GPS...");
      supabase.removeChannel(canalGps);
    };
  }, [viajeId]);

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return '---';
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-PE', { 
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white px-5 text-center">
        <h1 className="text-4xl font-black mb-2">Tori<span className="bg-red-600 text-white px-2 py-0.5 rounded ml-1">Go!</span></h1>
        <p className="text-gray-400 mt-5">{error}</p>
      </div>
    );
  }

  if (!viaje || !ubicacionConductor) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mb-4"></div>
        <p className="text-gray-400 animate-pulse text-sm">Conectando al mapa...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[#0a0a0a] flex flex-col font-sans overflow-hidden">
      
      {/* 🚨 PANEL RESPONSIVO: Abajo en Móvil, Arriba a la Izquierda en PC */}
      <div className="absolute bottom-4 left-4 right-4 md:top-6 md:bottom-auto md:left-6 md:right-auto md:w-[340px] z-[1000] pointer-events-none transition-all duration-300">
        <div className="bg-[#111111]/95 backdrop-blur-xl border border-gray-800/80 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          
          {/* Cabecera */}
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-black text-white tracking-tight">
              Tori<span className="bg-red-600 text-white px-1.5 py-0.5 rounded ml-0.5">Go!</span>
            </h1>
            <span className="bg-green-500/10 text-green-400 text-[10px] uppercase font-bold px-2 py-1 rounded-full border border-green-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              En Vivo
            </span>
          </div>

          {/* Grid Compacto de Datos */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Pasajero</p>
              <p className="text-white font-medium text-sm truncate">{viaje.pasajero_nombre}</p>
            </div>
            <div>
              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Conductor</p>
              <p className="text-white font-medium text-sm truncate">
                {viaje.perfil_conductor?.nombre_completo || 'Asignando...'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Placa</p>
              {viaje.perfil_conductor?.vehiculo_placa ? (
                <span className="bg-[#facc15] text-black font-bold text-[11px] px-1.5 py-0.5 rounded shadow-sm border border-yellow-400 inline-block mt-0.5">
                  {viaje.perfil_conductor.vehiculo_placa}
                </span>
              ) : (
                <span className="text-gray-500 text-xs">--</span>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Hora de inicio</p>
              <p className="text-gray-300 text-xs mt-0.5">{formatearFecha(viaje.created_at)}</p>
            </div>
          </div>

          {/* Caja de Rutas */}
          <div className="bg-[#1a1a1c] rounded-xl p-3 border border-gray-800/60">
            <div className="flex items-start gap-2.5 mb-2.5">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Punto de Recojo</p>
                <p className="text-gray-200 text-[11px] leading-tight truncate">{viaje.origen_direccion}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">Destino</p>
                <p className="text-white font-medium text-xs leading-tight truncate">{viaje.destino_direccion}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Mapa de Fondo */}
      <div className="flex-1 w-full z-0">
        <MapContainer 
          center={[ubicacionConductor.lat, ubicacionConductor.lng]} 
          zoom={16.5} 
          style={{ height: '100%', width: '100%', backgroundColor: '#0A0A0A' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
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