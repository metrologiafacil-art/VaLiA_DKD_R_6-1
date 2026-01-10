
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { StandardsManager } from './components/StandardsManager';
import { CalibrationForm } from './components/CalibrationForm';
import { ConfigPanel } from './components/ConfigPanel';
import { ReferenceStandard, CalibrationSession, Unit, StandardType, LaboratoryProfile } from './types';
import { generateRandomSession, generateRandomStandard } from './services/calibrationLogic';

const INITIAL_STANDARDS: ReferenceStandard[] = [
  {
    id: '1',
    type: StandardType.Pressure,
    name: 'Fluke 7250',
    serialNumber: '98273',
    certificateNumber: 'PTB-12345',
    calibratedBy: 'PTB Germany',
    calibrationDate: '2023-12-01',
    expiryDate: '2025-12-31',
    rangeMin: 0,
    rangeMax: 200,
    unit: Unit.Bar,
    resolution: 0.001,
    valueModelType: 'linear_pearson',
    uncertaintyModelType: 'linear_pearson',
    calibrationPoints: [
      { id: '1', nominal: 0, indication: 0.000, referenceValue: 0.000, uncertainty: 0.001, coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' },
      { id: '2', nominal: 50, indication: 50.005, referenceValue: 50.000, uncertainty: 0.002, coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' },
      { id: '3', nominal: 100, indication: 100.012, referenceValue: 100.000, uncertainty: 0.003, coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' },
      { id: '4', nominal: 150, indication: 150.015, referenceValue: 150.000, uncertainty: 0.005, coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' },
      { id: '5', nominal: 200, indication: 200.020, referenceValue: 200.000, uncertainty: 0.006, coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' },
    ]
  }
];

const DEFAULT_PROFILE: LaboratoryProfile = {
    name: 'VaLiA Metrology Services S.A.',
    addressLine1: 'Av. Tecnológica 123, Parque Industrial Innovación',
    addressLine2: 'Ciudad de la Ciencia, CP 99999, México',
    contactInfo: 'Tel: +52 55 1234 5678 | Email: lab@valia-metrology.com',
    accreditationInfo: '',
    isCustomized: false
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [standards, setStandards] = useState<ReferenceStandard[]>(INITIAL_STANDARDS);
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [labProfile, setLabProfile] = useState<LaboratoryProfile>(DEFAULT_PROFILE);
  const [isDark, setIsDark] = useState(false);

  // Apply Theme
  useEffect(() => {
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const handleRandomData = () => {
      // Logic for "Simulate Absolutely Everything" - BATCH GENERATION
      
      // 1. Create a HEALTHY standard
      const stdHealthy = generateRandomStandard();

      // 2. Create an EXPIRING standard (Forces < 30 days)
      const stdExpiring = generateRandomStandard({ forceExpirySoon: true });
      stdExpiring.name += " (Vence Pronto)";

      // 3. Create a PENDING CHECK standard (Forces old check)
      const stdPending = generateRandomStandard({ forcePendingCheck: true });
      stdPending.name += " (Verificación Pendiente)";
      
      // Add all to pool
      const updatedStandards = [stdHealthy, stdExpiring, stdPending, ...standards];
      setStandards(updatedStandards);
      
      // 4. Create a few sessions linked to the healthy standard
      const session1 = generateRandomSession([stdHealthy]);
      const session2 = generateRandomSession([stdHealthy]); // Generate another one to fill table
      
      setSessions(prev => [session1, session2, ...prev]);

      // Feedback
      alert(`¡Simulación de Estrés Completada!\n\nSe generaron:\n- 1 Patrón Sano\n- 1 Patrón por Vencer (<10 días)\n- 1 Patrón con Verificación Pendiente (>6 meses)\n- 2 Sesiones de Calibración Completas`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard sessions={sessions} standards={standards} labProfile={labProfile} />;
      case 'standards':
        return <StandardsManager standards={standards} setStandards={setStandards} />;
      case 'calibration':
        return <CalibrationForm standards={standards} onSave={(s) => { setSessions([s, ...sessions]); setActiveTab('dashboard'); }} />;
      case 'config':
        return <ConfigPanel profile={labProfile} setProfile={setLabProfile} />;
      default:
        return <Dashboard sessions={sessions} standards={standards} labProfile={labProfile} />;
    }
  };

  return (
    <div className={`flex h-screen font-sans text-brand-dark dark:text-slate-200 overflow-hidden relative transition-colors duration-300`}>
      <div className="animated-bg"></div>
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        toggleTheme={() => setIsDark(!isDark)} 
        isDark={isDark}
        onGenerateRandom={handleRandomData}
        labProfile={labProfile}
      />
      
      <main className="flex-1 ml-64 overflow-y-auto relative z-10 flex flex-col h-full">
        {/* PERSISTENT BRANDING HEADER (THE CONSOLE) */}
        <header className="bg-white/50 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-3 flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-3">
                {labProfile.isCustomized && labProfile.logo ? (
                    <img src={labProfile.logo} alt="Lab Logo" className="h-8 w-auto object-contain" />
                ) : (
                    <div className="h-8 w-8 bg-brand-blue rounded flex items-center justify-center text-white font-bold text-xs">VL</div>
                )}
                <div>
                    <h1 className="text-sm font-bold text-slate-800 dark:text-white uppercase leading-tight">{labProfile.name}</h1>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Sistema de Gestión Metrológica 17025</p>
                </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                {activeTab === 'config' ? 'MODO CONFIGURACIÓN' : 'MODO OPERATIVO'}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
