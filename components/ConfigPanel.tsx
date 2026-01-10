
import React, { useRef } from 'react';
import { LaboratoryProfile } from '../types';
import { Settings, Upload, Save, Building, MapPin, Phone, Award, Image as ImageIcon } from 'lucide-react';
import { playSound } from '../services/calibrationLogic';

interface Props {
    profile: LaboratoryProfile;
    setProfile: (p: LaboratoryProfile) => void;
}

export const ConfigPanel: React.FC<Props> = ({ profile, setProfile }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfile({ ...profile, logo: reader.result as string, isCustomized: true });
                playSound('success');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        playSound('success');
        alert('Datos guardados correctamente.\n\nEl certificado y la consola ahora utilizan su identidad corporativa.');
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
                <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white flex items-center gap-3">
                    <Settings className="text-slate-400" size={32} />
                    CONFIGURACIÓN DE IDENTIDAD
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">
                    Personalice el software para cumplir con los requisitos de gestión de <strong>ISO/IEC 17025:2017</strong>.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LOGO UPLOAD SECTION */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-panel p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
                        <h3 className="font-bold text-brand-blue dark:text-brand-cyan mb-4 flex items-center gap-2">
                            <ImageIcon size={20}/> LOGOTIPO DEL LABORATORIO
                        </h3>
                        
                        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 flex items-center justify-center min-h-[200px] border border-slate-200 dark:border-slate-700 mb-4">
                            {profile.logo ? (
                                <img src={profile.logo} alt="Vista previa logo" className="max-w-full max-h-[180px] object-contain shadow-sm" />
                            ) : (
                                <div className="text-center text-slate-400">
                                    <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-full inline-block mb-2">
                                        <Upload size={32} />
                                    </div>
                                    <p className="text-sm font-bold">Sin Logotipo Cargado</p>
                                    <p className="text-xs">Se usará el logo por defecto</p>
                                </div>
                            )}
                        </div>

                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/png, image/jpeg, image/svg+xml" 
                            onChange={handleImageUpload} 
                        />
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-brand-blue hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Upload size={20}/>
                            {profile.logo ? 'CAMBIAR LOGOTIPO' : 'SUBIR LOGOTIPO'}
                        </button>
                        
                        <p className="text-[10px] text-slate-500 mt-2 text-center">
                            Formatos recomendados: PNG Transparente o JPG Alta Calidad.
                            Este logo aparecerá en el encabezado de los certificados.
                        </p>
                    </div>
                </div>

                {/* FORM SECTION */}
                <div className="lg:col-span-8">
                    <div className="glass-panel p-8 rounded-2xl">
                        <h3 className="font-bold text-brand-dark dark:text-white mb-6 flex items-center gap-2 text-xl border-b border-slate-200 dark:border-slate-700 pb-2">
                            <Building size={24} className="text-brand-orange"/> DATOS DEL LABORATORIO (EMISOR)
                        </h3>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Razón Social / Nombre del Laboratorio</label>
                                <input 
                                    className="sci-input text-lg font-bold" 
                                    value={profile.name} 
                                    onChange={e => setProfile({...profile, name: e.target.value, isCustomized: true})} 
                                    placeholder="Ej: Laboratorio de Metrología Avanzada S.A. de C.V."
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Aparecerá como título principal del emisor en el certificado.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dirección (Calle y Número)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            className="sci-input pl-10" 
                                            value={profile.addressLine1} 
                                            onChange={e => setProfile({...profile, addressLine1: e.target.value, isCustomized: true})} 
                                            placeholder="Av. Principal 123"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dirección (Ciudad, Estado, CP)</label>
                                    <input 
                                        className="sci-input" 
                                        value={profile.addressLine2} 
                                        onChange={e => setProfile({...profile, addressLine2: e.target.value, isCustomized: true})} 
                                        placeholder="Ciudad de México, CP 00000"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contacto (Teléfono / Email / Web)</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            className="sci-input pl-10" 
                                            value={profile.contactInfo} 
                                            onChange={e => setProfile({...profile, contactInfo: e.target.value, isCustomized: true})} 
                                            placeholder="contacto@laboratorio.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Acreditación (Opcional)</label>
                                    <div className="relative">
                                        <Award className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            className="sci-input pl-10" 
                                            value={profile.accreditationInfo} 
                                            onChange={e => setProfile({...profile, accreditationInfo: e.target.value, isCustomized: true})} 
                                            placeholder="Acreditación No. P-123"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                            <button 
                                onClick={handleSave} 
                                className="bg-brand-orange text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-brand-orange/30 hover:-translate-y-1 transition-all flex items-center gap-3 text-sm"
                            >
                                <Save size={20}/> GUARDAR CONFIGURACIÓN
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .sci-input {
                    width: 100%;
                    background-color: #fff;
                    border: 1px solid #cbd5e1;
                    color: #1e293b;
                    padding: 0.75rem;
                    border-radius: 0.75rem;
                    outline: none;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .dark .sci-input {
                    background-color: #0f172a; 
                    border-color: #334155;
                    color: #e2e8f0;
                }
                .sci-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 4px rgba(14,165,233,0.1); }
            `}</style>
        </div>
    );
};
