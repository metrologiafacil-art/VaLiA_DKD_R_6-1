
import React, { useState } from 'react';
import { CalibrationSession, ReferenceStandard, LaboratoryProfile } from '../types';
import { CheckCircle, Clock, FileBarChart, Activity, X, FileText, Search, Microscope, ShieldCheck, TrendingUp, Stamp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Props {
  sessions: CalibrationSession[];
  standards: ReferenceStandard[];
  labProfile: LaboratoryProfile;
}

const StatCard = ({ title, value, sub, icon: Icon, colorClass, bgClass, shadowClass }: any) => (
  <div className={`glass-panel p-6 rounded-3xl relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 shadow-xl ${shadowClass} border border-white/50 dark:border-slate-700`}>
    <div className={`absolute -right-6 -top-6 p-10 rounded-full opacity-10 group-hover:opacity-20 transition-opacity ${bgClass}`}></div>
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-3 rounded-2xl ${bgClass} ${colorClass} bg-opacity-10 backdrop-blur-sm`}>
        <Icon size={24} className={colorClass}/>
      </div>
      {sub && <span className="text-xs font-bold text-slate-500 dark:text-slate-300 bg-white/50 dark:bg-slate-800/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-600">{sub}</span>}
    </div>
    <h3 className="text-4xl font-display font-bold text-brand-dark dark:text-white mb-1 relative z-10">{value}</h3>
    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold tracking-wide uppercase relative z-10">{title}</p>
  </div>
);

const CertificatePreviewModal = ({ session, standards, labProfile, onClose }: { session: CalibrationSession, standards: ReferenceStandard[], labProfile: LaboratoryProfile, onClose: () => void }) => {
    if (!session.results) return null;

    // Find the standard used to get traceability info
    const stdUsed = standards.find(s => s.id === session.standardId);

    const data = session.results.map(r => ({
        x: r.nominal,
        error: r.meanError,
        uncertainty: r.expandedUncertainty,
        upper: r.expandedUncertainty,
        lower: -r.expandedUncertainty
    }));

    const maxError = Math.max(...session.results.map(r => Math.abs(r.meanError)));
    const maxUnc = Math.max(...session.results.map(r => r.expandedUncertainty));
    const domainMax = Math.max(maxError, maxUnc) * 1.5;

    // ISO 17025 Requirement: Dates
    const calibrationDate = new Date(session.date);
    const issueDate = new Date(); // Today
    const receiptDate = new Date(calibrationDate);
    receiptDate.setDate(receiptDate.getDate() - 1); // Mock receipt 1 day before

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white dark:bg-[#0f172a] w-full max-w-[21cm] min-h-[29.7cm] my-8 shadow-2xl flex flex-col animate-appear relative print:shadow-none print:m-0 print:w-full" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute right-4 top-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500 z-50 no-print">
                        <X size={24} />
                </button>
                
                {/* ISO/IEC 17025:2017 COMPLIANT LAYOUT */}
                <div className="p-16 print:p-8 text-slate-800 dark:text-slate-200 font-sans text-[11px] leading-tight h-full relative">
                    
                    {/* 7.8.2.1 a) Title */}
                    <div className="flex justify-between items-start border-b-4 border-brand-blue pb-6 mb-8">
                        <div>
                             {/* DYNAMIC LOGO / BRANDING */}
                             {labProfile.isCustomized && labProfile.logo ? (
                                 <img src={labProfile.logo} alt="Logo" className="h-16 object-contain mb-2" />
                             ) : (
                                <h1 className="text-4xl font-display font-black tracking-tighter leading-none mb-2">
                                    <span className="text-[#005596] dark:text-cyan-500">Va</span>
                                    <span className="text-[#f97316]">L</span>
                                    <span className="text-[#005596] dark:text-cyan-500">iA</span>
                                </h1>
                             )}
                             {!labProfile.isCustomized && <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">by Metrología Fácil</p>}
                        </div>
                        <div className="text-right">
                             <h2 className="text-2xl font-bold uppercase text-slate-900 dark:text-white mb-1">Certificado de Calibración</h2>
                             {/* 7.8.2.1 d) Unique Identification */}
                             <div className="text-lg font-mono font-bold text-brand-orange">No. {session.id}</div>
                             <div className="text-[10px] text-slate-400 mt-1">Página 1 de 1</div>
                        </div>
                    </div>

                    {/* 7.8.2.1 b) & e) Laboratory and Customer Info */}
                    <div className="grid grid-cols-2 gap-12 mb-8">
                        <div className="space-y-2">
                            <h3 className="font-bold uppercase text-xs text-brand-blue border-b border-slate-200 pb-1 mb-2">Laboratorio (Emisor)</h3>
                            <p className="font-bold text-sm">{labProfile.name}</p>
                            <p>{labProfile.addressLine1}</p>
                            <p>{labProfile.addressLine2}</p>
                            <p>{labProfile.contactInfo}</p>
                            {labProfile.accreditationInfo && <p className="text-[9px] font-bold mt-1 text-slate-500">{labProfile.accreditationInfo}</p>}
                        </div>
                        <div className="space-y-2 text-right">
                            <h3 className="font-bold uppercase text-xs text-brand-blue border-b border-slate-200 pb-1 mb-2">Cliente / Solicitante</h3>
                            <p className="font-bold text-sm">{session.instrument.applicantName || 'Cliente No Registrado'}</p>
                            <p>Dirección no proporcionada</p>
                            <p>Ciudad, País</p>
                            <p>Atn: Departamento de Calidad</p>
                        </div>
                    </div>

                    {/* 7.8.2.1 g) Identification of the Item */}
                    <div className="mb-6 border border-slate-300 dark:border-slate-600">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 font-bold uppercase text-xs border-b border-slate-300 dark:border-slate-600 text-center">
                            Descripción del Ítem de Calibración
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-slate-300 dark:divide-slate-600">
                            <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Instrumento</span>
                                <span className="font-bold block">{session.instrument.manufacturer}</span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Modelo</span>
                                <span className="font-bold block">{session.instrument.model}</span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">No. de Serie</span>
                                <span className="font-bold block font-mono">{session.instrument.serialNumber}</span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Identificación (TAG)</span>
                                <span className="font-bold block">{session.instrument.identificationId || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 divide-x divide-slate-300 dark:divide-slate-600 border-t border-slate-300 dark:border-slate-600">
                             <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Rango de Medición</span>
                                <span className="font-bold block">{session.instrument.rangeMin} a {session.instrument.rangeMax} {session.instrument.unit}</span>
                            </div>
                            <div className="p-3">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Resolución</span>
                                <span className="font-bold block">{session.instrument.resolution} {session.instrument.unit}</span>
                            </div>
                            <div className="p-3 col-span-2">
                                <span className="block text-[9px] text-slate-500 uppercase mb-1">Condición de Recepción</span>
                                <span className="font-bold block text-emerald-600 dark:text-emerald-400">{session.instrument.conditionReceived || 'Adecuada'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 7.8.2.1 h), i), j) Dates & Location */}
                    <div className="grid grid-cols-4 gap-4 mb-6 text-center">
                        <div className="border p-2 rounded border-slate-200">
                            <span className="block text-[9px] text-slate-500 uppercase">Fecha de Recepción</span>
                            <span className="font-bold">{receiptDate.toLocaleDateString()}</span>
                        </div>
                        <div className="border p-2 rounded border-slate-200">
                            <span className="block text-[9px] text-slate-500 uppercase">Fecha de Calibración</span>
                            <span className="font-bold">{calibrationDate.toLocaleDateString()}</span>
                        </div>
                        <div className="border p-2 rounded border-slate-200">
                            <span className="block text-[9px] text-slate-500 uppercase">Fecha de Emisión</span>
                            <span className="font-bold">{issueDate.toLocaleDateString()}</span>
                        </div>
                         <div className="border p-2 rounded border-slate-200">
                            <span className="block text-[9px] text-slate-500 uppercase">Lugar de Calibración</span>
                            <span className="font-bold">Laboratorio Central</span>
                        </div>
                    </div>

                    {/* 7.8.2.1 f) Method & 7.8.4.1 c) Traceability */}
                    <div className="mb-6 space-y-4">
                        <div>
                             <h4 className="font-bold uppercase text-xs text-brand-blue mb-1">Método de Calibración</h4>
                             <p className="text-justify">
                                La calibración se realizó por el método de comparación directa contra patrones de trabajo de acuerdo con la directriz técnica 
                                <strong> DKD-R 6-1 "Calibración de instrumentos de medición de presión"</strong>, secuencia {session.sequence}.
                             </p>
                        </div>
                        <div>
                             <h4 className="font-bold uppercase text-xs text-brand-blue mb-1">Trazabilidad Metrológica</h4>
                             <p className="text-justify mb-2">
                                Los resultados de medición son trazables al Sistema Internacional de Unidades (SI) a través de patrones nacionales mantenidos por el CENAM (México), NIST (USA) o PTB (Alemania).
                             </p>
                             <table className="w-full text-xs border border-slate-300">
                                 <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-center">
                                     <tr>
                                         <td className="p-1 border-r">Patrón Utilizado</td>
                                         <td className="p-1 border-r">No. Serie</td>
                                         <td className="p-1 border-r">Certificado No.</td>
                                         <td className="p-1">Trazabilidad / Laboratorio</td>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     {stdUsed ? (
                                         <tr className="text-center">
                                             <td className="p-1 border-r border-t">{stdUsed.name}</td>
                                             <td className="p-1 border-r border-t font-mono">{stdUsed.serialNumber}</td>
                                             <td className="p-1 border-r border-t font-mono">{stdUsed.certificateNumber}</td>
                                             <td className="p-1 border-t">{stdUsed.calibratedBy}</td>
                                         </tr>
                                     ) : (
                                         <tr className="text-center"><td colSpan={4} className="p-1 border-t text-red-500">Información del patrón no disponible</td></tr>
                                     )}
                                 </tbody>
                             </table>
                        </div>
                    </div>

                    {/* 7.8.4.1 b) Environmental Conditions */}
                    <div className="mb-6">
                        <h4 className="font-bold uppercase text-xs text-brand-blue mb-1">Condiciones Ambientales</h4>
                        <div className="flex gap-8 text-xs">
                             <span><strong>Temperatura:</strong> {((session.envReadings.start.temp + session.envReadings.end.temp)/2).toFixed(1)} °C ± 0.5 °C</span>
                             <span><strong>Humedad Relativa:</strong> {((session.envReadings.start.humidity + session.envReadings.end.humidity)/2).toFixed(1)} %HR ± 3 %HR</span>
                             <span><strong>Presión Atmosférica:</strong> {((session.envReadings.start.pressure + session.envReadings.end.pressure)/2).toFixed(0)} hPa</span>
                        </div>
                    </div>

                    {/* 7.8.1.2 Results */}
                    <div className="mb-6">
                        <h4 className="font-bold uppercase text-xs text-brand-blue mb-2">Resultados de Medición</h4>
                        <table className="w-full text-xs border-collapse border border-slate-300 dark:border-slate-600">
                            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-[10px] text-center">
                                <tr>
                                    <th className="p-2 border border-slate-300">Presión Nominal<br/>({session.instrument.unit})</th>
                                    <th className="p-2 border border-slate-300">Valor del Patrón<br/>({session.instrument.unit})</th>
                                    <th className="p-2 border border-slate-300">Indicación IBC<br/>(Ascenso)</th>
                                    <th className="p-2 border border-slate-300 bg-orange-50 dark:bg-orange-900/10">Error de<br/>Indicación</th>
                                    <th className="p-2 border border-slate-300 bg-blue-50 dark:bg-blue-900/10">Incertidumbre<br/>Expandida <i>U</i></th>
                                    <th className="p-2 border border-slate-300">Factor<br/><i>k</i></th>
                                </tr>
                            </thead>
                            <tbody>
                                {session.results.map((r, i) => (
                                    <tr key={i} className="text-center font-mono hover:bg-slate-50">
                                        <td className="p-2 border border-slate-300">{r.nominal.toFixed(2)}</td>
                                        <td className="p-2 border border-slate-300">{r.trueValue.toFixed(4)}</td>
                                        <td className="p-2 border border-slate-300">{(r.trueValue + r.meanError).toFixed(4)}</td>
                                        <td className="p-2 border border-slate-300 font-bold text-slate-800 dark:text-white bg-orange-50 dark:bg-orange-900/10">{r.meanError.toFixed(4)}</td>
                                        <td className="p-2 border border-slate-300 font-bold text-brand-blue bg-blue-50 dark:bg-blue-900/10">± {r.expandedUncertainty.toFixed(4)}</td>
                                        <td className="p-2 border border-slate-300">2.00</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* 7.8.4.1 a) Statement on Uncertainty */}
                        <p className="mt-2 text-[10px] text-slate-500 text-justify">
                            La incertidumbre de medición reportada se declara como la incertidumbre estándar de medición multiplicada por el factor de cobertura <i>k</i>=2, el cual para una distribución normal corresponde a una probabilidad de cobertura de aproximadamente el 95%. La incertidumbre estándar de medición se ha determinado de acuerdo con la "Guía para la Expresión de la Incertidumbre de Medición" (GUM).
                        </p>
                    </div>

                    {/* Graph (Optional but good practice) */}
                    <div className="h-32 w-full border border-slate-200 dark:border-slate-700 mb-6 p-2 bg-white dark:bg-slate-900 opacity-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" hide />
                                <YAxis hide domain={[-domainMax, domainMax]} />
                                <ReferenceLine y={0} stroke="#94a3b8" />
                                <Line type="monotone" dataKey="error" stroke="#f97316" strokeWidth={2} dot={{r: 2}} />
                                <Line type="monotone" dataKey="upper" stroke="#0ea5e9" strokeDasharray="3 3" dot={false} strokeWidth={1}/>
                                <Line type="monotone" dataKey="lower" stroke="#0ea5e9" strokeDasharray="3 3" dot={false} strokeWidth={1}/>
                            </LineChart>
                         </ResponsiveContainer>
                    </div>

                    {/* 7.8.4.1 d) Adjustment Statement */}
                    <div className="mb-4 text-xs">
                        <strong>Ajuste del Instrumento:</strong> No se realizaron ajustes al instrumento. Los resultados corresponden al estado "como se recibió".
                    </div>

                    {/* 7.8.2.1 l) Disclaimer */}
                    <div className="mb-8 text-xs font-bold text-slate-600">
                        Nota: Los resultados contenidos en este certificado se refieren exclusivamente al ítem descrito y en el momento de la calibración.
                    </div>

                    {/* 7.8.2.1 o) Authorization / Signatures */}
                    <div className="flex justify-around mt-auto pt-8 border-t border-slate-300">
                        <div className="text-center">
                            <div className="mb-2 h-16 w-48 mx-auto flex items-end justify-center border-b border-slate-800">
                                <span className="font-signature text-2xl text-slate-600 italic">Luis A. Vieira</span>
                            </div>
                            <p className="font-bold text-xs uppercase">Ing. Luis Albeiro Vieira</p>
                            <p className="text-[10px] text-slate-500 uppercase">Metrólogo / Realizó</p>
                        </div>
                        <div className="text-center">
                             <div className="mb-2 h-16 w-48 mx-auto flex items-end justify-center border-b border-slate-800">
                                <span className="font-signature text-2xl text-slate-600 italic">Marco Estrada</span>
                            </div>
                            <p className="font-bold text-xs uppercase">Ing. Marco Estrada</p>
                            <p className="text-[10px] text-slate-500 uppercase">Gerente Técnico / Autorizó</p>
                        </div>
                    </div>

                    {/* 7.8.2.1 Reproduction warning */}
                    <div className="mt-8 text-center">
                        <p className="text-[9px] text-slate-400 uppercase">
                            Este certificado no podrá ser reproducido parcialmente sin la aprobación por escrito del laboratorio emisor.
                        </p>
                        {/* 7.8.2.1 d) End of Document */}
                        <p className="text-[9px] text-slate-800 font-bold mt-1 uppercase tracking-widest">--- Fin del Documento ---</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC<Props> = ({ sessions, standards, labProfile }) => {
  const [selectedSession, setSelectedSession] = useState<CalibrationSession | null>(null);
  const recentSessions = [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  // Expiring Standards Logic (Corrected)
  const expiringStandardsCount = standards.filter(s => {
      const expiry = new Date(s.expiryDate);
      const today = new Date();
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays >= 0; 
  }).length;

  // Pending Checks Logic (Corrected: Check if > 6 months since last check OR no checks)
  const pendingChecksCount = standards.filter(s => {
      if (!s.intermediateChecks || s.intermediateChecks.length === 0) return true; // Never checked -> Pending
      const lastCheck = s.intermediateChecks[s.intermediateChecks.length - 1];
      const lastCheckDate = new Date(lastCheck.date);
      const today = new Date();
      const diffDays = Math.ceil((today.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 180; // More than 6 months -> Pending
  }).length;

  // Healthy (Passes checks and not expired/pending too long)
  const healthyStandardsCount = standards.length - pendingChecksCount - expiringStandardsCount; // Simplified metric for demo

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {selectedSession && <CertificatePreviewModal session={selectedSession} standards={standards} labProfile={labProfile} onClose={() => setSelectedSession(null)} />}

      <div className="mb-8 flex items-center gap-4">
         <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-brand-orange/20 dark:shadow-none border border-slate-100 dark:border-slate-700">
           <Activity className="text-brand-orange animate-pulse" size={28} />
         </div>
         <div>
            <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white">PANEL GENERAL</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Gestión Metrológica & Aseguramiento de Calidad</p>
         </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="Calibraciones" 
          value={sessions.length} 
          icon={FileBarChart} 
          colorClass="text-brand-blue dark:text-brand-cyan" 
          bgClass="bg-brand-blue"
          shadowClass="shadow-brand-blue/10"
        />
        <StatCard 
          title="Patrones: Salud OK" 
          value={`${Math.round((healthyStandardsCount/standards.length)*100)}%`} 
          sub="ILAC G24"
          icon={ShieldCheck} 
          colorClass="text-emerald-500" 
          bgClass="bg-emerald-500"
          shadowClass="shadow-emerald-500/10"
        />
        <StatCard 
          title="Patrones Por Vencer" 
          value={expiringStandardsCount}
          sub="< 30 Días" 
          icon={Clock} 
          colorClass="text-brand-orange" 
          bgClass="bg-brand-orange"
          shadowClass="shadow-brand-orange/10"
        />
        <StatCard 
          title="Comprobaciones Pendientes" 
          value={pendingChecksCount} 
          sub="> 6 Meses"
          icon={TrendingUp} 
          colorClass="text-indigo-500" 
          bgClass="bg-indigo-500"
          shadowClass="shadow-indigo-500/10"
        />
      </div>

      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl shadow-brand-dark/5 dark:shadow-black/20 dark:bg-[#0f172a]/80 border border-white/50 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200/60 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 flex justify-between items-center">
          <h3 className="font-display font-bold text-lg text-brand-dark dark:text-white tracking-wide flex items-center gap-2">
            <Microscope size={20} className="text-slate-400"/>
            REGISTRO DE ACTIVIDAD RECIENTE
          </h3>
          <div className="relative">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
             <input type="text" placeholder="Buscar servicio..." className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 rounded-xl text-sm border border-slate-200 dark:border-slate-700 outline-none focus:border-brand-blue text-slate-600 dark:text-slate-200 w-64 shadow-sm" />
          </div>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th className="p-4 pl-6">Instrumento</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Secuencia</th>
              <th className="p-4">Técnico</th>
              <th className="p-4">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentSessions.map(session => {
                const isApproved = session.results?.every(r => r.compliance);
                return (
                  <tr 
                    key={session.id} 
                    onClick={() => setSelectedSession(session)}
                    className="hover:bg-brand-blue/5 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  >
                    <td className="p-4 pl-6">
                      <div className="font-bold text-brand-dark dark:text-slate-200 font-display tracking-wide group-hover:text-brand-blue transition-colors">{session.instrument.model}</div>
                      <div className="text-xs text-brand-blue dark:text-brand-cyan font-mono">{session.instrument.serialNumber}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 font-mono">{new Date(session.date).toLocaleDateString()}</td>
                    <td className="p-4"><span className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-sm">{session.sequence}</span></td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{session.technician}</td>
                    <td className="p-4">
                        <span className="text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-xs font-bold">FINALIZADO</span>
                    </td>
                  </tr>
                );
            })}
            {recentSessions.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-400 dark:text-slate-600 font-mono">SIN DATOS EN EL SISTEMA</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
