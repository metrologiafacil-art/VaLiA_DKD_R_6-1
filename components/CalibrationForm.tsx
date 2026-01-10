
import React, { useState, useEffect, useRef } from 'react';
import { CalibrationSession, CalibrationPoint, Instrument, Unit, ReferenceStandard, CalibrationFluid, CIPMParams, StandardType } from '../types';
import { calculateWaterDensity, calculateAirDensityCIPM, calculateLocalGravity, GRAVITY_BOGOTA } from '../services/mathUtils';
import { calculateResults, playSound } from '../services/calibrationLogic';
import { Play, Save, Activity, Beaker, Wind, Timer, AlertTriangle, ExternalLink, Globe, User, Tag, PenTool } from 'lucide-react';

interface Props {
  standards: ReferenceStandard[];
  onSave: (session: CalibrationSession) => void;
}

const ScientificInput = ({ value, onChange, className, placeholder, ...props }: any) => {
    const [localStr, setLocalStr] = useState(value !== undefined && value !== null ? value.toString() : '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (document.activeElement === inputRef.current) return;
        if (value !== undefined && value !== null) {
            setLocalStr(value.toString());
        } else {
            setLocalStr('');
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9.,-]*$/.test(val)) {
            setLocalStr(val);
            const normalized = val.replace(/,/g, '.');
            if (normalized === '' || normalized === '-') return;
            const parsed = parseFloat(normalized);
            if (!isNaN(parsed)) {
                onChange(parsed);
            }
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (value !== undefined && value !== null) {
            setLocalStr(value.toString());
        }
        if (props.onBlur) props.onBlur(e);
    };

    return (
        <input 
            ref={inputRef}
            type="text" 
            inputMode="decimal" 
            className={className} 
            placeholder={placeholder} 
            value={localStr} 
            onChange={handleChange}
            onBlur={handleBlur}
            {...props} 
        />
    );
};

const SmartChronometer = ({ isActive }: { isActive: boolean }) => {
    const [time, setTime] = useState(0);
    useEffect(() => {
        let i: any;
        if (isActive) i = setInterval(() => setTime(t => t+1), 1000);
        return () => clearInterval(i);
    }, [isActive]);
    return (
        <div className="flex items-center gap-2 bg-slate-900 text-brand-cyan px-4 py-2 rounded-lg font-mono text-xl shadow-lg border border-brand-cyan/20">
            <Timer size={20} className={isActive ? "animate-pulse" : ""} />
            {new Date(time*1000).toISOString().substring(11, 19)}
        </div>
    );
};

export const CalibrationForm: React.FC<Props> = ({ standards, onSave }) => {
  const [step, setStep] = useState(1);
  const [instrument, setInstrument] = useState<Instrument>({
    manufacturer: '',
    model: '', 
    serialNumber: '', 
    rangeMin: 0, 
    rangeMax: 100, 
    resolution: 0.1, 
    accuracyClass: 1.0, 
    unit: Unit.Bar,
    applicantName: '',
    identificationId: '',
    type: 'analog',
    connectionType: '1/4 NPT',
    sensorLocation: 'Bottom',
    conditionReceived: 'Adecuada'
  });

  const [envStage, setEnvStage] = useState<'start'|'middle'|'end'>('start');
  const [envReadings, setEnvReadings] = useState({
      start: { temp: 20, humidity: 45, pressure: 1013 },
      middle: { temp: 20, humidity: 45, pressure: 1013 },
      end: { temp: 20, humidity: 45, pressure: 1013 }
  });

  const [fluid, setFluid] = useState<CalibrationFluid>(CalibrationFluid.Air);
  const [fluidDensity, setFluidDensity] = useState(1.2); 
  const [cipm, setCipm] = useState<CIPMParams>({ moleFractionCO2: 400, latitude: 45, heightAboveSea: 100 });
  const [heightDiff, setHeightDiff] = useState(0);
  
  // GRAVITY STATE
  const [useBogotaGravity, setUseBogotaGravity] = useState(true);
  const [calculatedGravity, setCalculatedGravity] = useState(GRAVITY_BOGOTA);
  
  const [stdIds, setStdIds] = useState({ pressure: '', env: '' });
  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Density Calculation
  useEffect(() => {
      const avgTemp = (envReadings.start.temp + envReadings.middle.temp + envReadings.end.temp) / 3;
      const avgHum = (envReadings.start.humidity + envReadings.middle.humidity + envReadings.end.humidity) / 3;
      const avgPress = (envReadings.start.pressure + envReadings.middle.pressure + envReadings.end.pressure) / 3;

      if (fluid === CalibrationFluid.Water) {
          setFluidDensity(calculateWaterDensity(avgTemp));
      } else if (fluid === CalibrationFluid.Air) {
          setFluidDensity(calculateAirDensityCIPM(avgTemp, avgPress, avgHum, cipm.moleFractionCO2));
      }
  }, [fluid, envReadings, cipm.moleFractionCO2]);

  // Gravity Calculation
  useEffect(() => {
      if (useBogotaGravity) {
          setCalculatedGravity(GRAVITY_BOGOTA);
      } else {
          setCalculatedGravity(calculateLocalGravity(cipm.latitude, cipm.heightAboveSea));
      }
  }, [useBogotaGravity, cipm.latitude, cipm.heightAboveSea]);

  const initSequence = () => {
      if(!instrument.manufacturer || !instrument.serialNumber || !instrument.applicantName) {
          alert("Por favor complete los datos obligatorios del instrumento (Solicitante, Marca, Serie).");
          return;
      }

      playSound('click');
      const count = 6;
      const stepSize = (instrument.rangeMax - instrument.rangeMin) / (count - 1);
      const pts = [];
      for(let i=0; i<count; i++) {
          const nom = parseFloat((instrument.rangeMin + (i*stepSize)).toFixed(4));
          pts.push({ nominal: nom, standardReading: nom });
      }
      setPoints(pts);
      setStep(2);
      setIsCalibrating(true);
  };

  const handleFinish = () => {
      const std = standards.find(s => s.id === stdIds.pressure);
      if(!std) return;

      const results = calculateResults(
          points, 
          instrument, 
          std, 
          'B' as any, 
          fluidDensity, 
          heightDiff,
          calculatedGravity
      );

      const session: CalibrationSession = {
          id: `CAL-${Date.now()}`,
          date: new Date().toISOString(),
          technician: 'Admin User',
          standardId: stdIds.pressure,
          envStandardId: stdIds.env,
          sequence: 'B' as any,
          instrument,
          envReadings,
          fluid,
          fluidDensity,
          heightDifference: heightDiff,
          gravityLocal: calculatedGravity,
          points,
          results
      };

      onSave(session);
      playSound('success');
  };

  if (step === 1) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
         <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white">CONFIGURACIÓN DE MISIÓN</h2>
         
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
             {/* LEFT COLUMN: Instrument Details (Expanded) */}
             <div className="lg:col-span-8 glass-panel p-6 rounded-2xl space-y-6">
                 <h3 className="font-bold text-brand-blue border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                     <PenTool size={18}/> Datos del Instrumento (Ítem)
                 </h3>
                 
                 {/* Section 1: Identification & Applicant */}
                 <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="md:col-span-2">
                             <label className="label-sci flex items-center gap-1"><User size={12}/> Solicitante / Cliente</label>
                             <input className="sci-input font-bold" placeholder="Nombre de la empresa o cliente" value={instrument.applicantName} onChange={e => setInstrument({...instrument, applicantName: e.target.value})} />
                         </div>
                         <div>
                            <label className="label-sci">Marca / Fabricante</label>
                            <input className="sci-input" placeholder="Ej: WIKA, Fluke" value={instrument.manufacturer} onChange={e => setInstrument({...instrument, manufacturer: e.target.value})} />
                         </div>
                         <div>
                            <label className="label-sci">Modelo</label>
                            <input className="sci-input" placeholder="Ej: 232.50" value={instrument.model} onChange={e => setInstrument({...instrument, model: e.target.value})} />
                         </div>
                         <div>
                            <label className="label-sci">Número de Serie</label>
                            <input className="sci-input font-mono" placeholder="S/N" value={instrument.serialNumber} onChange={e => setInstrument({...instrument, serialNumber: e.target.value})} />
                         </div>
                         <div>
                            <label className="label-sci flex items-center gap-1"><Tag size={12}/> Identificación Interna (TAG)</label>
                            <input className="sci-input font-mono text-brand-blue" placeholder="Ej: PI-1001" value={instrument.identificationId} onChange={e => setInstrument({...instrument, identificationId: e.target.value})} />
                         </div>
                     </div>
                 </div>

                 <hr className="border-slate-100 dark:border-slate-700"/>

                 {/* Section 2: Metrological Specifications */}
                 <div className="space-y-4">
                     <h4 className="text-xs font-bold uppercase text-slate-400">Especificaciones Metrológicas</h4>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="label-sci">Tipo</label>
                            <select className="sci-input" value={instrument.type} onChange={e => setInstrument({...instrument, type: e.target.value as any})}>
                                <option value="analog">Analógico</option>
                                <option value="digital">Digital</option>
                                <option value="transmitter">Transmisor</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-sci">Unidad</label>
                            <select className="sci-input" value={instrument.unit} onChange={e => setInstrument({...instrument, unit: e.target.value as Unit})}>
                                {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="label-sci">Rango Min</label>
                            <ScientificInput className="sci-input" value={instrument.rangeMin} onChange={(val: number) => setInstrument({...instrument, rangeMin: val})} />
                        </div>
                        <div>
                            <label className="label-sci">Rango Max</label>
                            <ScientificInput className="sci-input" value={instrument.rangeMax} onChange={(val: number) => setInstrument({...instrument, rangeMax: val})} />
                        </div>
                        <div>
                            <label className="label-sci">Resolución</label>
                            <ScientificInput className="sci-input" value={instrument.resolution} onChange={(val: number) => setInstrument({...instrument, resolution: val})} />
                        </div>
                        <div>
                            <label className="label-sci">Clase Exactitud</label>
                            <ScientificInput className="sci-input" value={instrument.accuracyClass} onChange={(val: number) => setInstrument({...instrument, accuracyClass: val})} />
                        </div>
                     </div>
                 </div>

                 <hr className="border-slate-100 dark:border-slate-700"/>

                 {/* Section 3: Physical & Condition */}
                 <div className="space-y-4">
                     <h4 className="text-xs font-bold uppercase text-slate-400">Estado y Conexiones</h4>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label-sci">Conexión</label>
                            <input className="sci-input" placeholder="Ej: 1/4 NPT" value={instrument.connectionType} onChange={e => setInstrument({...instrument, connectionType: e.target.value})} />
                        </div>
                        <div>
                            <label className="label-sci">Ubicación Sensor</label>
                            <select className="sci-input" value={instrument.sensorLocation} onChange={e => setInstrument({...instrument, sensorLocation: e.target.value})}>
                                <option value="Bottom">Inferior (Bottom)</option>
                                <option value="Back">Posterior (Back)</option>
                                <option value="Inline">En línea</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-sci">Condición Recepción</label>
                            <select className="sci-input font-bold text-emerald-600" value={instrument.conditionReceived} onChange={e => setInstrument({...instrument, conditionReceived: e.target.value})}>
                                <option value="Adecuada">Adecuada / Operativa</option>
                                <option value="Dañado">Dañado / Golpeado</option>
                                <option value="Sucio">Sucio / Contaminado</option>
                                <option value="Incompleto">Incompleto</option>
                            </select>
                        </div>
                     </div>
                 </div>
             </div>

             {/* RIGHT COLUMN: Setup & Standards */}
             <div className="lg:col-span-4 space-y-6">
                 <div className="glass-panel p-6 rounded-2xl space-y-6">
                     <h3 className="font-bold text-brand-orange border-b border-slate-200 dark:border-slate-700 pb-2">2. Patrón & Configuración</h3>
                     
                     <div>
                        <label className="label-sci">Patrón de Referencia</label>
                        <select className="sci-input" value={stdIds.pressure} onChange={e => setStdIds({...stdIds, pressure: e.target.value})}>
                            <option value="">Seleccionar Principal...</option>
                            {standards.filter(s => s.type === StandardType.Pressure).map(s => <option key={s.id} value={s.id}>{s.name} ({s.rangeMax} {s.unit})</option>)}
                        </select>
                     </div>

                     <div className="space-y-4">
                         <div className="flex gap-2 mb-2">
                             {[CalibrationFluid.Air, CalibrationFluid.Water, CalibrationFluid.Oil].map(f => (
                                 <button key={f} onClick={() => setFluid(f)} className={`px-4 py-2 rounded-lg font-bold capitalize transition-all flex-1 ${fluid === f ? 'bg-brand-blue text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:bg-slate-200'}`}>
                                     {f === 'water' ? 'Agua' : f}
                                 </button>
                             ))}
                         </div>
                     </div>

                     {fluid === CalibrationFluid.Air && (
                         <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-sm border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-2 opacity-10">
                                 <ExternalLink size={60} className="text-brand-blue"/>
                             </div>
                             <h4 className="font-bold text-brand-blue dark:text-brand-cyan mb-2 text-xs uppercase flex items-center gap-2">
                                 <Beaker size={14}/> Densidad del Aire
                             </h4>
                             <div className="grid grid-cols-3 gap-2 mb-2">
                                 <div><label className="label-xs">Temp.</label><ScientificInput className="sci-input-sm" value={envReadings.start.temp} onChange={(val: number) => setEnvReadings({...envReadings, start: {...envReadings.start, temp: val}})}/></div>
                                 <div><label className="label-xs">Pres.</label><ScientificInput className="sci-input-sm" value={envReadings.start.pressure} onChange={(val: number) => setEnvReadings({...envReadings, start: {...envReadings.start, pressure: val}})}/></div>
                                 <div><label className="label-xs">Hum.</label><ScientificInput className="sci-input-sm" value={envReadings.start.humidity} onChange={(val: number) => setEnvReadings({...envReadings, start: {...envReadings.start, humidity: val}})}/></div>
                             </div>
                         </div>
                     )}
                     
                     <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-sm border border-slate-200 dark:border-slate-700">
                         <h4 className="font-bold text-slate-600 dark:text-slate-400 mb-3 text-xs uppercase flex items-center gap-2">
                             <Globe size={14} /> Gravedad Local
                         </h4>
                         
                         <div className="flex items-center gap-2 mb-4 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                             <div className={`w-10 h-5 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors ${useBogotaGravity ? 'bg-brand-blue' : ''}`} onClick={() => setUseBogotaGravity(!useBogotaGravity)}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform duration-300 ease-in-out ${useBogotaGravity ? 'translate-x-5' : ''}`}></div>
                             </div>
                             <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                 {useBogotaGravity ? 'Gravedad Bogotá' : 'Calcular Específica'}
                             </span>
                         </div>

                         {!useBogotaGravity && (
                             <div className="grid grid-cols-2 gap-3 mb-3 animate-appear">
                                 <div><label className="label-xs">Latitud (°)</label><ScientificInput className="sci-input-sm" value={cipm.latitude} onChange={(val: number) => setCipm({...cipm, latitude: val})}/></div>
                                 <div><label className="label-xs">Altura (m)</label><ScientificInput className="sci-input-sm" value={cipm.heightAboveSea} onChange={(val: number) => setCipm({...cipm, heightAboveSea: val})}/></div>
                             </div>
                         )}

                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                 <label className="label-xs text-brand-orange">Gravedad</label>
                                 <div className="font-mono font-bold text-lg text-brand-orange">{calculatedGravity.toFixed(4)} <span className="text-xs">m/s²</span></div>
                            </div>
                            <div>
                                 <label className="label-xs">Dif. Altura (cm)</label>
                                 <ScientificInput className="sci-input-sm text-center" value={heightDiff} onChange={(val: number) => setHeightDiff(val)} />
                            </div>
                         </div>
                     </div>
                 </div>
                 
                 <button onClick={initSequence} className="w-full btn-primary py-4 text-xl shadow-xl shadow-brand-orange/20 flex justify-center items-center gap-2">
                     INICIAR <Play size={24} />
                 </button>
             </div>
         </div>
         
         <style>{`
            .sci-input { width: 100%; background: #fff; border: 1px solid #cbd5e1; padding: 0.75rem; border-radius: 0.5rem; outline: none; font-weight: 500; color: #1e293b; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
            .dark .sci-input { background: #1e293b; border-color: #475569; color: #f1f5f9; box-shadow: none; }
            .sci-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

            .sci-input-sm { width: 100%; background: #fff; border: 1px solid #cbd5e1; padding: 0.4rem; border-radius: 0.3rem; color: #334155; }
            .dark .sci-input-sm { background: #334155; border-color: #475569; color: #f8fafc; }

            .label-sci { display: block; color: #64748b; font-size: 0.8rem; margin-bottom: 0.3rem; font-weight: 700; }
            .dark .label-sci { color: #94a3b8; }
            .btn-primary { background: #f97316; color: white; border-radius: 0.75rem; font-weight: 700; transition: all 0.2s; }
            .btn-primary:hover { background: #ea580c; }
         `}</style>
      </div>
    );
  }

  // Running Step
  return (
      <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-start mb-6">
              <div>
                  <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white">{instrument.model} <span className="text-lg text-slate-400 font-normal">({instrument.serialNumber})</span></h2>
                  <div className="flex gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-bold"><User size={14}/> {instrument.applicantName}</span>
                      <span className="flex items-center gap-1"><Beaker size={14}/> {fluid} ({fluidDensity.toFixed(5)})</span>
                      <span className="flex items-center gap-1 text-brand-orange font-bold"><Globe size={14}/> g: {calculatedGravity.toFixed(4)}</span>
                  </div>
              </div>
              <SmartChronometer isActive={isCalibrating} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
              <div className="lg:col-span-2 glass-panel rounded-xl overflow-hidden flex flex-col shadow-xl">
                  <div className="overflow-auto flex-1 p-1">
                      <table className="w-full text-sm border-collapse">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                  <th className="p-4 text-left">Nominal</th>
                                  <th className="p-4 text-left">Patrón</th>
                                  <th className="p-4 text-left border-l border-slate-200 dark:border-slate-700">Ascenso 1</th>
                                  <th className="p-4 text-left">Descenso 1</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                              {points.map((p, i) => (
                                  <tr key={i} className="hover:bg-brand-blue/5 dark:hover:bg-brand-blue/10 transition-colors">
                                      <td className="p-4 font-mono font-bold text-lg text-slate-700 dark:text-slate-200">{p.nominal}</td>
                                      <td className="p-2"><ScientificInput className="table-input" value={p.standardReading} onChange={(val: number) => { const n = [...points]; n[i].standardReading = val; setPoints(n); }} /></td>
                                      <td className="p-2 border-l border-slate-100 dark:border-slate-700"><ScientificInput className="table-input text-brand-blue dark:text-brand-cyan" value={p.run1Up} onChange={(val: number) => { const n = [...points]; n[i].run1Up = val; setPoints(n); }} /></td>
                                      <td className="p-2"><ScientificInput className="table-input text-brand-orange" value={p.run1Down} onChange={(val: number) => { const n = [...points]; n[i].run1Down = val; setPoints(n); }} /></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="glass-panel p-4 rounded-xl">
                      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-brand-dark dark:text-white"><Activity size={16}/> Monitoreo Ambiental</h3>
                      <div className="flex gap-2 mb-3 bg-slate-50 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-600">
                          {['start', 'middle', 'end'].map(s => (
                              <button key={s} onClick={() => setEnvStage(s as any)} className={`flex-1 py-1 text-xs font-bold rounded capitalize transition-all ${envStage === s ? 'bg-white dark:bg-slate-600 shadow text-brand-blue dark:text-white' : 'text-slate-400'}`}>
                                  {s === 'start' ? 'Inicio' : s === 'middle' ? '50%' : 'Final'}
                              </button>
                          ))}
                      </div>
                      <div className="space-y-2">
                          <div><label className="label-xs">Temp (°C)</label><ScientificInput className="sci-input-sm" value={envReadings[envStage].temp} onChange={(val: number) => setEnvReadings({...envReadings, [envStage]: {...envReadings[envStage], temp: val}})} /></div>
                          <div><label className="label-xs">Humedad (%)</label><ScientificInput className="sci-input-sm" value={envReadings[envStage].humidity} onChange={(val: number) => setEnvReadings({...envReadings, [envStage]: {...envReadings[envStage], humidity: val}})} /></div>
                          <div><label className="label-xs">Presión (hPa)</label><ScientificInput className="sci-input-sm" value={envReadings[envStage].pressure} onChange={(val: number) => setEnvReadings({...envReadings, [envStage]: {...envReadings[envStage], pressure: val}})} /></div>
                      </div>
                      <div className="mt-3 text-xs text-center text-slate-400 font-mono">
                          AVG: {((envReadings.start.temp + envReadings.middle.temp + envReadings.end.temp)/3).toFixed(2)} °C
                      </div>
                  </div>

                  <button className="w-full btn-primary py-3 flex justify-center items-center gap-2" onClick={handleFinish}>
                      <Save size={18} /> FINALIZAR MISIÓN
                  </button>
              </div>
          </div>
          <style>{`
            .table-input { width: 100%; background: transparent; border: 1px solid transparent; border-bottom: 1px solid #cbd5e1; padding: 0.5rem; text-align: right; font-family: monospace; font-size: 1.1rem; font-weight: 600; color: #334155; outline: none; transition: all 0.2s; }
            .dark .table-input { border-bottom-color: #475569; color: #f8fafc; }
            .table-input:focus { border-bottom-color: #0ea5e9; background: rgba(14,165,233,0.05); }
          `}</style>
      </div>
  );
};
