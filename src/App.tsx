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
    // panTo es mucho más ligero que flyTo para no trabar el mapa con animaciones largas
    map.panTo([ubicacion.lat, ubicacion.lng], { animate: true, duration: 0.5 });
  }, [ubicacion, map]);
  return null;
};

export default function App() {
  const [viajeId, setViajeId] = useState<string | null>(null);
  const [viaje, setViaje] = useState<any>(null);
  const [ubicacionConductor, setUbicacionConductor] = useState<{ lat: number, lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSenial, setUltimaSenial] = useState<Date | null>(null); 

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

  // 1. Reemplazamos la configuración del useEffect del canal GPS
  useEffect(() => {
    if (!viajeId) return;

    // Le decimos a Supabase explícitamente que este canal recibe Broadcasts
    const canalGps = supabase.channel(`gps_${viajeId}`, {
      config: { broadcast: { ack: false } }
    })
      .on('broadcast', { event: 'gps_mototaxi' }, (payload) => {
        setUbicacionConductor({
          lat: payload.payload.lat,
          lng: payload.payload.lng
        });
        setUltimaSenial(new Date());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canalGps);
    };
  }, [viajeId]);

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
      
      {/*PANEL REDISEÑADO: Posicionado Arriba, más delgado y compacto */}
      <div className="absolute top-4 left-4 right-4 md:left-6 md:right-auto md:w-[320px] z-[1000] pointer-events-none transition-all duration-300">
        <div className="bg-[#111111]/95 backdrop-blur-xl border border-gray-800/80 rounded-xl p-3 shadow-2xl pointer-events-auto">
          
          {/* Cabecera */}
          <div className="flex justify-between items-center mb-2.5">
            <h1 className="text-lg font-black text-white tracking-tight">
              Tori<span className="bg-red-600 text-white px-1 rounded ml-0.5">Go!</span>
            </h1>
            <div className="flex flex-col items-end">
              <span className="bg-green-500/10 text-green-400 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border border-green-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                En Vivo
              </span>
              {ultimaSenial && (
                <span className="text-[8.5px] text-gray-400 mt-0.5 font-medium tracking-wider">
                  ⏱ {ultimaSenial.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {/* Caja Compacta del Conductor */}
          <div className="flex justify-between items-center bg-[#1a1a1c] p-2 rounded-lg border border-gray-800/60 mb-2.5">
            <div className="flex flex-col">
              <span className="text-gray-500 text-[8px] uppercase font-bold tracking-widest mb-0.5">Conductor</span>
              <span className="text-white text-xs font-bold truncate max-w-[160px]">
                {viaje.perfil_conductor?.nombre_completo || 'Asignando...'}
              </span>
            </div>
            {viaje.perfil_conductor?.vehiculo_placa ? (
              <div className="bg-[#facc15] text-black font-black text-[10px] px-1.5 py-0.5 rounded shadow-sm border border-yellow-400">
                {viaje.perfil_conductor.vehiculo_placa}
              </div>
            ) : (
              <span className="text-gray-600 text-xs font-bold">--</span>
            )}
          </div>

          {/* Rutas Minimalistas */}
          <div className="pl-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
              <p className="text-gray-300 text-[10px] truncate leading-none">{viaje.origen_direccion}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></div>
              <p className="text-white font-medium text-[10px] truncate leading-none">{viaje.destino_direccion}</p>
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
          {/*KEY DINÁMICO: Obliga a React Leaflet a forzar la actualización visual del TukTuk */}
          <Marker 
            position={[ubicacionConductor.lat, ubicacionConductor.lng]} 
            icon={iconMototaxi}
          >
            <Popup className="font-bold text-center">¡Aquí va {viaje.pasajero_nombre}!</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
}