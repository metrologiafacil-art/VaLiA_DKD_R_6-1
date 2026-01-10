
import React from 'react';
import { LayoutDashboard, Gauge, ClipboardList, Database, Moon, Sun, FlaskConical, Settings } from 'lucide-react';
import { playSound } from '../services/calibrationLogic';
import { LaboratoryProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  toggleTheme: () => void;
  isDark: boolean;
  onGenerateRandom: () => void;
  labProfile: LaboratoryProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, toggleTheme, isDark, onGenerateRandom, labProfile }) => {
  const menuItems = [
    { id: 'dashboard', label: 'PANEL GENERAL', icon: LayoutDashboard },
    { id: 'standards', label: 'PATRONES', icon: Database },
    { id: 'calibration', label: 'CALIBRACIÓN', icon: Gauge },
    { id: 'certificates', label: 'REPORTES', icon: ClipboardList },
    { id: 'config', label: 'CONFIGURACIÓN', icon: Settings },
  ];

  return (
    <div className="w-64 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto glass-panel shadow-2xl z-50 border-r border-white/50 dark:border-slate-800 dark:bg-[#020617] transition-all">
      <div className="p-6 border-b border-brand-blue/10 dark:border-slate-800 relative flex flex-col items-center">
        
        {/* LOGO AREA - DYNAMIC */}
        <div className="mb-6 mt-2 relative cursor-default select-none flex justify-center w-full">
            {labProfile.isCustomized && labProfile.logo ? (
                // USER CUSTOM LOGO
                <div className="flex flex-col items-center">
                    <img 
                        src={labProfile.logo} 
                        alt="Lab Logo" 
                        className="max-w-[160px] max-h-[80px] object-contain mb-2 filter drop-shadow-sm" 
                    />
                </div>
            ) : (
                // DEFAULT VaLiA BRANDING
                <div className="text-center">
                    <h1 className="text-6xl font-display font-black tracking-tighter leading-none flex items-baseline justify-center filter drop-shadow-sm">
                        <span className="text-[#005596] dark:text-cyan-500">Va</span>
                        <span className="text-[#f97316]">L</span>
                        <span className="text-[#005596] dark:text-cyan-500">iA</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-[0.2em] uppercase mt-1">
                        by Metrología Fácil
                    </p>
                </div>
            )}
        </div>

        {/* Validation Text */}
        <div className="text-center mb-4 px-2 w-full">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase leading-tight font-medium">
                    Diseñado y validado para el<br/>
                    <span className="font-bold text-slate-600 dark:text-slate-300 block mt-1">Ing. Marco Estrada</span>
                </p>
            </div>
        </div>
        
        <p className="text-[9px] text-slate-300 dark:text-slate-700 font-mono text-center">v3.1 Release Candidate</p>
      </div>
      
      <nav className="flex-1 p-4 space-y-3 mt-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { playSound('click'); setActiveTab(item.id); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                isActive
                  ? 'bg-gradient-to-r from-[#005596] to-cyan-500 text-white shadow-lg shadow-blue-900/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800/50 hover:text-orange-500 hover:shadow-md'
              }`}
            >
              <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="font-bold tracking-wide font-sans">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex gap-2">
            <button onClick={toggleTheme} className="w-full p-2 rounded-xl bg-white dark:bg-[#1e293b] shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-3 text-slate-500 dark:text-brand-cyan hover:text-brand-orange transition-colors">
                {isDark ? <Sun size={18}/> : <Moon size={18}/>}
                <span className="text-xs font-bold uppercase">{isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>
        </div>
        <button onClick={onGenerateRandom} className="w-full p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 text-[10px] font-bold flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-sm uppercase tracking-wide">
            <FlaskConical size={14}/> SIMULAR DATOS DE PRUEBA
        </button>
        
        {/* Credits Footer */}
        <div className="pt-2 text-center">
             <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight">
                Desarrollado por<br/>
                <span className="font-bold text-slate-600 dark:text-slate-300">Ing. Luis Albeiro Vieira</span>
             </p>
        </div>
      </div>
    </div>
  );
};
