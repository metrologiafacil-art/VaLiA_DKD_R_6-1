import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ReferenceStandard, Unit, CurveModel, StandardCalibrationPoint, StandardType, IntermediateCheck, RegressionResult, CheckPointResult } from '../types';
import { fitStandardModels, calculateInterpolationUncertainty, predictValue, calculateCumulativeStats } from '../services/mathUtils';
import { playSound } from '../services/calibrationLogic';
import { Plus, X, FileText, Activity, Save, History, LineChart as ChartIcon, Settings, AlertTriangle, CheckCircle2, Sigma, TrendingUp, ThumbsUp, ThumbsDown, Trophy, Table2, Calculator, Info, Split } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, ComposedChart, ReferenceLine, Legend } from 'recharts';

interface Props {
  standards: ReferenceStandard[];
  setStandards: React.Dispatch<React.SetStateAction<ReferenceStandard[]>>;
}

const EmptyStandard: ReferenceStandard = {
  id: '',
  type: StandardType.Pressure,
  name: '',
  serialNumber: '',
  certificateNumber: '',
  calibratedBy: '',
  calibrationDate: new Date().toISOString().split('T')[0],
  expiryDate: '',
  rangeMin: 0,
  rangeMax: 100,
  unit: Unit.Bar,
  resolution: 0.01,
  valueModelType: 'linear_pearson',
  valueSubModels: { low: 'linear_pearson', high: 'linear_pearson' },
  uncertaintyModelType: 'linear_pearson',
  uncertaintySubModels: { low: 'linear_pearson', high: 'linear_pearson' },
  calibrationPoints: []
};

// --- Helper Component: Scientific Input ---
const ScientificInput = ({ value, onChange, className, placeholder, ...props }: any) => {
    const [localStr, setLocalStr] = useState(value !== undefined && value !== null ? value.toString() : '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (document.activeElement === inputRef.current) return;
        setLocalStr(value !== undefined && value !== null ? value.toString() : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9.,-]*$/.test(val)) {
            setLocalStr(val);
            const normalized = val.replace(/,/g, '.');
            if (normalized === '' || normalized === '-') return;
            const parsed = parseFloat(normalized);
            if (!isNaN(parsed)) onChange(parsed);
        }
    };

    return (
        <input 
            ref={inputRef} type="text" inputMode="decimal" className={className} 
            placeholder={placeholder} value={localStr} onChange={handleChange} {...props} 
        />
    );
};

const Card: React.FC<{title: string, icon: any, children: React.ReactNode}> = ({ title, icon: Icon, children }) => (
  <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group transition-shadow bg-white/70 dark:bg-[#0f172a]/60 dark:border-slate-700">
    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-brand-blue to-brand-cyan"></div>
    <div className="flex items-center gap-2 mb-6 text-brand-blue dark:text-brand-cyan font-display tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">
      <Icon size={20} />
      <h3 className="uppercase text-sm font-bold">{title}</h3>
    </div>
    {children}
  </div>
);

const CoefficientTable = ({ regression, modelType }: { regression: RegressionResult, modelType: CurveModel }) => {
    if (!regression) return null;

    if (modelType === 'piecewise_mixed') {
        return (
             <div className="w-full text-xs overflow-hidden rounded border border-slate-200 dark:border-slate-700 mt-2">
                <div className="bg-slate-100 dark:bg-slate-800 p-2 font-bold text-slate-500 text-center">Coeficientes Regresión Doble</div>
                <div className="p-3 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 italic text-center">
                    Los coeficientes se calculan independientemente para cada tramo. Consulte los detalles del modelo compuesto.
                </div>
            </div>
        );
    }

    return (
        <div className="w-full text-xs overflow-hidden rounded border border-slate-200 dark:border-slate-700 mt-2">
            <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-500">
                    <tr><th className="p-2">Coeficiente</th><th className="p-2">Valor</th><th className="p-2">Descripción</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {regression.coefficients.map((val, idx) => (
                        <tr key={idx}>
                            <td className="p-2 font-bold font-mono">c{idx}</td>
                            <td className="p-2 font-mono text-slate-700 dark:text-slate-300">{val.toExponential(5)}</td>
                            <td className="p-2 text-slate-400 italic">
                                {modelType.includes('linear') && idx===0 ? 'Intercepto (b)' : 
                                 modelType.includes('linear') && idx===1 ? 'Pendiente (m)' : 
                                 `Orden ${idx}`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ValidationCard = ({ regression }: { regression?: RegressionResult }) => {
    if (!regression || !regression.extendedValidation) return null;
    
    const v = regression.extendedValidation;
    
    const ValidationRow = ({ result, step }: { result: any, step: number }) => (
        <div className="flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800/50 rounded transition-colors group">
            <div className="flex items-center gap-3">
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-500">{step}</span>
                <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{result.label}</div>
                    <div className="text-[10px] text-slate-400 hidden group-hover:block">{result.details}</div>
                </div>
            </div>
            <div className="text-right">
                {result.isNotApplicable ? (
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">N/A</span>
                ) : (
                    <>
                        <div className={`flex items-center justify-end gap-1 font-bold text-xs ${result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {result.passed ? 'CUMPLE' : 'NO CUMPLE'}
                            {result.passed ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">
                            {result.statisticName}={result.statisticValue} (Crit: {result.criticalValue.toFixed(2)})
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return (
        <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h4 className="text-xs font-bold text-brand-blue uppercase flex items-center gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <Calculator size={14}/> Validación Estadística (ILAC P14)
            </h4>
            <div className="flex flex-col gap-1">
                <ValidationRow step={1} result={v.correlation} />
                <div className="grid grid-cols-2 gap-2">
                    <ValidationRow step={2} result={v.normalityX} />
                    <ValidationRow step={2} result={v.normalityY} />
                </div>
                <ValidationRow step={3} result={v.modelSignificance} />
                <ValidationRow step={4} result={v.independence} />
                <ValidationRow step={5} result={v.normalityResiduals} />
                
                {v.mandelLinearity && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <ValidationRow step={6} result={v.mandelLinearity} />
                    </div>
                )}
            </div>
        </div>
    );
};

const ModelSelect = ({ value, onChange, label, className }: any) => (
    <div className={className}>
        <label className="label-xs mb-1 block text-slate-500">{label}</label>
        <select 
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-brand-blue text-xs" 
            value={value} 
            onChange={onChange}
        >
            <option value="linear_pearson">Lineal (Pearson)</option>
            <option value="linear_theil_sen">Lineal Robusta (Theil-Sen)</option>
            <option value="polynomial_2nd">Polinomio Grado 2</option>
            <option value="polynomial_3rd">Polinomio Grado 3</option>
            <option value="power">Potencial</option>
            <option value="exponential">Exponencial</option>
            <option value="logarithmic">Logarítmico</option>
        </select>
    </div>
);

const RegressionAnalysisView = ({ 
    label, subLabel, modelType, setModelType, subModels, setSubModels, regression, dataPoints, color, isUncertainty = false
}: { 
    label: string, subLabel: string, modelType: CurveModel, setModelType: (m: CurveModel) => void, 
    subModels?: { low: CurveModel, high: CurveModel }, setSubModels?: (sm: { low: CurveModel, high: CurveModel }) => void,
    regression?: RegressionResult, dataPoints: { x: number, y: number }[], color: string, isUncertainty?: boolean
}) => {
    
    // Simulate data for chart curve
    const simulationData = useMemo(() => {
        if (!regression || dataPoints.length < 2) return [];
        const xValues = dataPoints.map(p => p.x);
        const minX = isUncertainty ? 0 : Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const range = maxX - minX || 1;
        const step = range / 100; 
        
        const points = [];
        for (let x = minX; x <= maxX + step; x += step) {
            // Need to pass subModels for piecewise prediction
            let yPred = predictValue(x, modelType, regression.coefficients, regression.subModels);
            let u = 0;
            if (!isUncertainty) {
                 u = calculateInterpolationUncertainty(x, regression, modelType);
            }
            if (isUncertainty && yPred < 0) yPred = 0; 
            
            points.push({ x, yPred, upper: yPred + u, lower: yPred - u });
        }
        return points;
    }, [regression, modelType, dataPoints, isUncertainty]);

    const qualityColor = regression?.isBestFit ? 'bg-indigo-600 shadow-indigo-500/50' : 
                         regression?.modelQuality === 'EXCELLENT' ? 'bg-emerald-500' : 
                         regression?.modelQuality === 'GOOD' ? 'bg-blue-500' : 'bg-red-500';

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                    <div className="flex-1 w-full flex flex-col gap-2">
                        <label className="label-xs block">{label}</label>
                        <p className="text-[10px] text-slate-400 font-mono mb-2">{subLabel}</p>
                        <div className="relative mb-2">
                            <select 
                                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                                value={modelType} 
                                onChange={e => setModelType(e.target.value as CurveModel)}
                            >
                                <option value="linear_pearson">Lineal (Pearson)</option>
                                <option value="piecewise_mixed" className="font-bold text-indigo-600">★ Regresión Doble Flexible (Mix)</option>
                                <option value="linear_theil_sen">Lineal Robusta (Theil-Sen)</option>
                                <option value="polynomial_2nd">Polinomio Grado 2</option>
                                <option value="polynomial_3rd">Polinomio Grado 3</option>
                                <option value="power">Potencial (Power)</option>
                                <option value="exponential">Exponencial</option>
                                <option value="logarithmic">Logarítmico</option>
                            </select>
                        </div>

                        {modelType === 'piecewise_mixed' && subModels && setSubModels && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800 mb-2 grid grid-cols-2 gap-2 animate-appear">
                                <ModelSelect 
                                    label="Tramo Bajo" 
                                    value={subModels.low} 
                                    onChange={(e: any) => setSubModels({...subModels, low: e.target.value})} 
                                />
                                <ModelSelect 
                                    label="Tramo Alto" 
                                    value={subModels.high} 
                                    onChange={(e: any) => setSubModels({...subModels, high: e.target.value})} 
                                />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-[2] w-full bg-slate-50 dark:bg-[#1e293b] p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col justify-center relative overflow-hidden">
                        <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold text-white rounded-bl-lg shadow-lg flex items-center gap-1 ${qualityColor}`}>
                            {regression?.isBestFit && <Trophy size={10} />}
                            {regression?.isBestFit ? 'MEJOR OPCIÓN' : regression?.modelQuality}
                        </div>

                        <div className="flex gap-4 items-end mb-2">
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Bondad de Ajuste (AICc)</span>
                                <div className="text-lg font-mono font-bold text-slate-700 dark:text-white">
                                    {regression?.aicc.toFixed(2) || '---'}
                                </div>
                            </div>
                            <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Coef. Determinación (R²)</span>
                                <div className="text-lg font-mono font-bold" style={{ color }}>
                                    {regression?.rSquared.toFixed(5) || '---'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-200 dark:border-slate-700 pt-2">
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400">Durbin-Watson:</span>
                                <strong className={regression?.durbinWatson && (regression.durbinWatson < 1.5 || regression.durbinWatson > 2.5) ? "text-amber-500" : "text-emerald-500"}>
                                    {regression?.durbinWatson.toFixed(2)}
                                </strong>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-slate-400">Prueba F:</span>
                                <strong className={regression?.isParametricValid ? "text-emerald-500" : "text-red-500"}>
                                    {regression?.anova?.fStatistic ? regression.anova.fStatistic.toFixed(2) : 'N/A'}
                                </strong>
                            </div>
                        </div>
                        
                        {regression?.recommendationText && (
                            <div className={`mt-2 text-[10px] p-1.5 rounded border flex items-center gap-2 ${regression.isBestFit ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800' : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-600'}`}>
                                {regression.isBestFit ? <ThumbsUp size={12}/> : <Activity size={12}/>}
                                {regression.recommendationText}
                            </div>
                        )}
                    </div>
                </div>

                {regression && <CoefficientTable regression={regression} modelType={modelType} />}
                {regression && <ValidationCard regression={regression} />}
            </div>

            <div className="h-72 bg-white dark:bg-[#1e293b] rounded-lg border border-slate-200 dark:border-slate-700 p-2 shadow-inner relative group">
                
                {regression && (
                    <div className="absolute top-10 left-16 z-10 pointer-events-none">
                        <div className="flex flex-col gap-1 text-xs">
                             <span className="font-mono font-bold text-slate-800 dark:text-slate-100 bg-white/40 dark:bg-black/20 px-2 rounded">
                                {regression.equationString}
                            </span>
                            <span className="font-mono font-bold text-brand-orange bg-white/40 dark:bg-black/20 px-2 rounded w-fit">
                                R² = {regression.rSquared.toFixed(5)}
                            </span>
                        </div>
                    </div>
                )}

                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={simulationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" strokeOpacity={0.1} />
                        <XAxis dataKey="x" type="number" domain={['auto', 'auto']} stroke="#94a3b8" fontSize={10} tickFormatter={(val) => val.toFixed(1)} />
                        <YAxis type="number" domain={isUncertainty ? [0, 'auto'] : ['auto', 'auto']} stroke="#94a3b8" fontSize={10} />
                        <Tooltip contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', color: '#fff', fontSize: '12px', borderRadius: '8px'}} />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        
                        {modelType === 'piecewise_mixed' && regression?.subModels && (
                            <>
                                <ReferenceLine x={regression.subModels.low.limit} stroke="#6366f1" strokeDasharray="2 2" label={{value: 'Split', fill: '#6366f1', fontSize: 10}} />
                            </>
                        )}

                        <Line name="Modelo Matemático" dataKey="yPred" type="monotone" stroke={color} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false}/>
                        {!isUncertainty && <Line name="Banda Incertidumbre (Prognosis)" dataKey="upper" type="monotone" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} activeDot={false} isAnimationActive={false}/>}
                        {!isUncertainty && <Line name="Banda Inferior" dataKey="lower" type="monotone" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} activeDot={false} legendType="none" isAnimationActive={false}/>}
                        <Scatter name="Datos Reales" data={dataPoints} dataKey="y" fill="#000000" stroke="#ffffff" strokeWidth={2} shape="circle" r={5} isAnimationActive={false}/>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const StandardsManager: React.FC<Props> = ({ standards, setStandards }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'info'|'checks'>('info');
  const [analysisTab, setAnalysisTab] = useState<'value'|'uncertainty'>('value');
  const [currentStd, setCurrentStd] = useState<ReferenceStandard>(EmptyStandard);
  const [newPoint, setNewPoint] = useState<Partial<StandardCalibrationPoint>>({ coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' });
  
  // SPC Logic
  const [selectedSPCPoint, setSelectedSPCPoint] = useState<number | null>(null);
  const [spcReadings, setSpcReadings] = useState<number[]>(new Array(10).fill(0));
  const [spcDate, setSpcDate] = useState(new Date().toISOString().split('T')[0]);
  const [spcTech, setSpcTech] = useState('Admin');
  
  useEffect(() => {
    if (isEditing && currentStd.calibrationPoints.length >= 3) {
      const { valueReg, uncReg } = fitStandardModels(
          currentStd.calibrationPoints, 
          currentStd.valueModelType, 
          currentStd.uncertaintyModelType,
          currentStd.valueSubModels,
          currentStd.uncertaintySubModels
      );
      
      const valStr = JSON.stringify(valueReg.coefficients) + valueReg.equationString;
      const uncStr = JSON.stringify(uncReg.coefficients) + uncReg.equationString;
      const currValStr = JSON.stringify(currentStd.valueRegression?.coefficients) + currentStd.valueRegression?.equationString;
      const currUncStr = JSON.stringify(currentStd.uncertaintyRegression?.coefficients) + currentStd.uncertaintyRegression?.equationString;

      if(valStr !== currValStr || uncStr !== currUncStr) {
          setCurrentStd(prev => ({ ...prev, valueRegression: valueReg, uncertaintyRegression: uncReg }));
      }
    }
  }, [currentStd.calibrationPoints, currentStd.valueModelType, currentStd.uncertaintyModelType, currentStd.valueSubModels, currentStd.uncertaintySubModels, isEditing]);

  const handleSave = () => {
    playSound('success');
    setStandards(prev => {
      const idx = prev.findIndex(s => s.id === currentStd.id);
      if (idx >= 0) { const updated = [...prev]; updated[idx] = currentStd; return updated; }
      return [...prev, currentStd];
    });
    setIsEditing(false);
  };

  const addPoint = () => {
      if (newPoint.nominal === undefined) return;
      const pt: StandardCalibrationPoint = {
        id: Date.now().toString(),
        nominal: newPoint.nominal || 0,
        indication: newPoint.indication || 0,
        referenceValue: newPoint.referenceValue || 0,
        uncertainty: newPoint.uncertainty || 0,
        coverageFactor: newPoint.coverageFactor || 2,
        confidenceLevel: newPoint.confidenceLevel || 95.45,
        distribution: newPoint.distribution || 'Normal'
      };
      const updatedPoints = [...currentStd.calibrationPoints, pt].sort((a, b) => a.indication - b.indication);
      setCurrentStd({ ...currentStd, calibrationPoints: updatedPoints });
      setNewPoint({ coverageFactor: 2, confidenceLevel: 95.45, distribution: 'Normal' });
  };

  const initializeSPC = () => {
     const mid = (currentStd.rangeMax - currentStd.rangeMin)/2;
     const points = [currentStd.rangeMin, mid, currentStd.rangeMax];
     const limits: any = {};
     points.forEach(p => { limits[p] = { ucl: currentStd.rangeMax * 0.002, lcl: -(currentStd.rangeMax * 0.002) }; });
     setCurrentStd({ ...currentStd, checkConfig: { checkPoints: points, limits } });
     setSelectedSPCPoint(points[0]);
  };
  const updateSPCLimit = (nominal: number, type: 'ucl'|'lcl', val: number) => {
      if(!currentStd.checkConfig) return;
      const limits = { ...currentStd.checkConfig.limits };
      if (!limits[nominal]) limits[nominal] = { ucl: 0, lcl: 0 };
      limits[nominal] = { ...limits[nominal], [type]: val };
      setCurrentStd({ ...currentStd, checkConfig: { ...currentStd.checkConfig, limits } });
  };
  const saveSPCCheck = () => {
      if (selectedSPCPoint === null) return;
      const mean = spcReadings.reduce((a,b)=>a+b,0)/10;
      const s = Math.sqrt(spcReadings.reduce((a,b)=>a+Math.pow(b-mean,2),0)/9);
      const min = Math.min(...spcReadings); const max = Math.max(...spcReadings);
      const res: CheckPointResult = { nominal: selectedSPCPoint, readings: [...spcReadings], mean, stdDev: s, range: max - min };
      
      let checks = [...(currentStd.intermediateChecks || [])];
      let currentCheck = checks.find(c => c.date.startsWith(spcDate));
      if (!currentCheck) { currentCheck = { id: Date.now().toString(), date: new Date(spcDate).toISOString(), technician: spcTech, results: [], globalResult: 'PASS' }; checks.push(currentCheck); }
      const idx = currentCheck.results.findIndex(r => r.nominal === selectedSPCPoint);
      if (idx >= 0) currentCheck.results[idx] = res; else currentCheck.results.push(res);
      
      const lim = currentStd.checkConfig?.limits[selectedSPCPoint];
      const drift = mean - selectedSPCPoint; 
      if (lim && (drift > lim.ucl || drift < lim.lcl)) currentCheck.globalResult = 'FAIL';
      setCurrentStd({ ...currentStd, intermediateChecks: checks });
      playSound('success');
  };
  
  const { trendData, rawScatterData } = useMemo(() => {
      if (selectedSPCPoint === null || !currentStd.intermediateChecks) return { trendData: [], rawScatterData: [] };
      const lim = currentStd.checkConfig?.limits[selectedSPCPoint];
      const trends: any[] = []; const raws: any[] = [];
      const sortedChecks = [...currentStd.intermediateChecks].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      sortedChecks.forEach(c => {
          const res = c.results.find(r => r.nominal === selectedSPCPoint);
          if (!res) return;
          const timestamp = new Date(c.date).getTime();
          trends.push({ timestamp, dateStr: new Date(c.date).toLocaleDateString(), mean: res.mean, ucl: lim ? selectedSPCPoint + lim.ucl : null, lcl: lim ? selectedSPCPoint + lim.lcl : null, nominal: selectedSPCPoint });
          res.readings.forEach(val => raws.push({ timestamp, value: val }));
      });
      return { trendData: trends, rawScatterData: raws };
  }, [currentStd.intermediateChecks, selectedSPCPoint, currentStd.checkConfig]);

  const valuePoints = currentStd.calibrationPoints.map(p => ({ x: p.indication, y: p.referenceValue }));
  const uncertaintyPoints = currentStd.calibrationPoints.map(p => ({ x: p.referenceValue, y: p.uncertainty }));

  const handleCreate = () => { setCurrentStd({ ...EmptyStandard, id: Date.now().toString() }); setIsEditing(true); setActiveSubTab('info'); };
  const handleEdit = (std: ReferenceStandard) => { setCurrentStd({ ...std }); setIsEditing(true); setActiveSubTab('info'); };
  const deleteStd = (id: string) => { if (confirm('¿Eliminar?')) setStandards(s => s.filter(x => x.id !== id)); };

  return isEditing ? (
      <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
        <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
          <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white">EDITAR PATRÓN</h2>
          <div className="flex gap-4">
             <button onClick={() => setIsEditing(false)} className="px-6 py-2 border border-slate-300 rounded text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 font-bold transition-all">Cancelar</button>
             <button onClick={handleSave} className="px-6 py-2 bg-brand-blue text-white rounded shadow-lg hover:bg-sky-700 font-bold flex items-center gap-2"><Save size={18} /> Guardar</button>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
            <button onClick={() => setActiveSubTab('info')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${activeSubTab === 'info' ? 'bg-white dark:bg-slate-800 text-brand-blue shadow-md' : 'text-slate-500'}`}>
                <FileText size={18}/> Información Técnica
            </button>
            <button onClick={() => setActiveSubTab('checks')} className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${activeSubTab === 'checks' ? 'bg-white dark:bg-slate-800 text-brand-orange shadow-md' : 'text-slate-500'}`}>
                <History size={18}/> Carta de Control (SPC)
            </button>
        </div>

        {activeSubTab === 'info' ? (
        <div className="grid grid-cols-12 gap-6">
           <div className="col-span-12 lg:col-span-3 space-y-6">
            <Card title="Identificación" icon={FileText}>
              <div className="space-y-4">
                 <input className="sci-input" value={currentStd.name} onChange={e => setCurrentStd({...currentStd, name: e.target.value})} placeholder="Nombre / Modelo" />
                 <input className="sci-input" value={currentStd.serialNumber} onChange={e => setCurrentStd({...currentStd, serialNumber: e.target.value})} placeholder="Número de Serie" />
                 <div className="grid grid-cols-2 gap-4">
                     <div><label className="label-xs">Rango Min</label><ScientificInput className="sci-input" placeholder="Min" value={currentStd.rangeMin} onChange={(val: number) => setCurrentStd({...currentStd, rangeMin: val})} /></div>
                     <div><label className="label-xs">Rango Max</label><ScientificInput className="sci-input" placeholder="Max" value={currentStd.rangeMax} onChange={(val: number) => setCurrentStd({...currentStd, rangeMax: val})} /></div>
                 </div>
              </div>
            </Card>
          </div>
          <div className="col-span-12 lg:col-span-9 space-y-6">
             <Card title="Tabla de Puntos de Calibración (Certificado)" icon={Activity}>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm min-w-[600px]">
                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-xs uppercase text-center"><tr><th className="p-2">Nominal</th><th className="p-2">Lectura</th><th className="p-2">Ref</th><th className="p-2">U</th><th className="p-2">Acción</th></tr></thead>
                        <tbody className="bg-white dark:bg-slate-900/50">
                           {currentStd.calibrationPoints.map(p => (
                               <tr key={p.id}><td className="p-2 text-center">{p.nominal}</td><td className="p-2 text-center">{p.indication}</td><td className="p-2 text-center">{p.referenceValue}</td><td className="p-2 text-center">{p.uncertainty}</td><td className="p-2 text-center"><button onClick={() => setCurrentStd({...currentStd, calibrationPoints: currentStd.calibrationPoints.filter(x => x.id !== p.id)})}><X size={16}/></button></td></tr>
                           ))}
                           <tr>
                               <td className="p-2"><ScientificInput className="sci-input-sm" value={newPoint.nominal} onChange={(v:number)=>setNewPoint({...newPoint, nominal: v})}/></td>
                               <td className="p-2"><ScientificInput className="sci-input-sm" value={newPoint.indication} onChange={(v:number)=>setNewPoint({...newPoint, indication: v})}/></td>
                               <td className="p-2"><ScientificInput className="sci-input-sm" value={newPoint.referenceValue} onChange={(v:number)=>setNewPoint({...newPoint, referenceValue: v})}/></td>
                               <td className="p-2"><ScientificInput className="sci-input-sm" value={newPoint.uncertainty} onChange={(v:number)=>setNewPoint({...newPoint, uncertainty: v})}/></td>
                               <td className="p-2 text-center"><button onClick={addPoint} className="bg-blue-500 text-white p-1 rounded"><Plus size={16}/></button></td>
                           </tr>
                        </tbody>
                    </table>
                </div>
             </Card>
             <Card title="Modelado Matemático y Análisis" icon={TrendingUp}>
                 <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
                    <button onClick={() => setAnalysisTab('value')} className={`px-4 py-2 text-sm font-bold uppercase border-b-2 transition-colors ${analysisTab === 'value' ? 'border-brand-orange text-brand-orange' : 'border-transparent text-slate-400'}`}>Corrección</button>
                    <button onClick={() => setAnalysisTab('uncertainty')} className={`px-4 py-2 text-sm font-bold uppercase border-b-2 transition-colors ${analysisTab === 'uncertainty' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-slate-400'}`}>Incertidumbre</button>
                </div>
                {analysisTab === 'value' ? (
                    <RegressionAnalysisView 
                        label="Modelo de Corrección" 
                        subLabel="Ajuste de Lecturas vs Referencia" 
                        modelType={currentStd.valueModelType} 
                        setModelType={(m) => setCurrentStd({...currentStd, valueModelType: m})} 
                        subModels={currentStd.valueSubModels}
                        setSubModels={(sm) => setCurrentStd({...currentStd, valueSubModels: sm})}
                        regression={currentStd.valueRegression} 
                        dataPoints={valuePoints} 
                        color="#f97316"
                    />
                ) : (
                    <RegressionAnalysisView 
                        label="Modelo de Incertidumbre" 
                        subLabel="Ajuste de Incertidumbre vs Referencia" 
                        modelType={currentStd.uncertaintyModelType} 
                        setModelType={(m) => setCurrentStd({...currentStd, uncertaintyModelType: m})} 
                        subModels={currentStd.uncertaintySubModels}
                        setSubModels={(sm) => setCurrentStd({...currentStd, uncertaintySubModels: sm})}
                        regression={currentStd.uncertaintyRegression} 
                        dataPoints={uncertaintyPoints} 
                        color="#0ea5e9" 
                        isUncertainty={true} 
                    />
                )}
             </Card>
          </div>
        </div>
        ) : (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 space-y-6">
                <Card title="Configuración SPC" icon={Settings}>
                    {!currentStd.checkConfig ? (
                        <div className="text-center py-8"><button onClick={initializeSPC} className="bg-brand-blue text-white px-4 py-2 rounded">Inicializar SPC</button></div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {currentStd.checkConfig.checkPoints.map(p => (
                                    <button key={p} onClick={() => setSelectedSPCPoint(p)} className={`px-3 py-1 rounded border text-sm font-bold ${selectedSPCPoint === p ? 'bg-brand-blue text-white' : 'bg-white'}`}>{p}</button>
                                ))}
                            </div>
                            {selectedSPCPoint !== null && currentStd.checkConfig.limits[selectedSPCPoint] && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label-xs">LCS (+)</label><ScientificInput className="sci-input font-bold text-red-600" value={currentStd.checkConfig.limits[selectedSPCPoint].ucl} onChange={(v:number) => updateSPCLimit(selectedSPCPoint!, 'ucl', v)} /></div>
                                    <div><label className="label-xs">LCI (-)</label><ScientificInput className="sci-input font-bold text-red-600" value={currentStd.checkConfig.limits[selectedSPCPoint].lcl} onChange={(v:number) => updateSPCLimit(selectedSPCPoint!, 'lcl', v)} /></div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
                {selectedSPCPoint !== null && (
                    <Card title="Registrar Bloque" icon={Plus}>
                        <div className="grid grid-cols-5 gap-2 mb-4">
                            {spcReadings.map((val, idx) => (<ScientificInput key={idx} className="sci-input-sm text-center" value={val} onChange={(v: number) => { const n = [...spcReadings]; n[idx] = v; setSpcReadings(n); }} />))}
                        </div>
                        <button onClick={saveSPCCheck} className="w-full bg-brand-orange text-white py-3 rounded-lg font-bold">REGISTRAR</button>
                    </Card>
                )}
            </div>
            <div className="col-span-12 lg:col-span-8">
                <Card title="Gráfica de Tendencia" icon={ChartIcon}>
                    <div className="h-80 bg-white dark:bg-[#1e293b] rounded p-2">
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart margin={{top:10, right:30, left:10, bottom:0}}>
                                    <CartesianGrid strokeDasharray="3 3"/>
                                    <XAxis dataKey="timestamp" type="number" domain={['auto','auto']} scale="time" tickFormatter={(t)=>new Date(t).toLocaleDateString()}/>
                                    <YAxis domain={['auto','auto']}/>
                                    <Tooltip labelFormatter={(t)=>new Date(t).toLocaleDateString()}/>
                                    <Line data={trendData} type="monotone" dataKey="mean" stroke="#f97316" strokeWidth={2}/>
                                    <Scatter data={rawScatterData} fill="#3b82f6" r={3} opacity={0.6}/>
                                    <Line data={trendData} type="step" dataKey="ucl" stroke="#ef4444" strokeDasharray="5 5" dot={false}/>
                                    <Line data={trendData} type="step" dataKey="lcl" stroke="#ef4444" strokeDasharray="5 5" dot={false}/>
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <div className="text-center pt-20 text-slate-400">Sin datos</div>}
                    </div>
                </Card>
            </div>
        </div>
        )}
        
        <style>{`
          .sci-input { width: 100%; background: #fff; color: #1e293b; border: 1px solid #cbd5e1; padding: 0.75rem; border-radius: 0.5rem; outline: none; font-weight: 500; } .dark .sci-input { background: #020617; border-color: #334155; color: #e2e8f0; }
          .sci-input-sm { width: 100%; background: #fff; color: #1e293b; border: 1px solid #cbd5e1; padding: 0.4rem; font-size: 0.85rem; border-radius: 0.3rem; } .dark .sci-input-sm { background: #0f172a; border-color: #334155; color: #e2e8f0; }
          .label-xs { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; display: block; } .dark .label-xs { color: #94a3b8; }
        `}</style>
      </div>
    ) : (
      <div className="p-8 max-w-[1600px] mx-auto min-h-screen">
          <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-display font-bold text-brand-dark dark:text-white">LISTADO DE PATRONES</h2>
              <button onClick={handleCreate} className="px-6 py-3 bg-brand-blue text-white rounded-xl shadow-lg hover:bg-sky-700 font-bold flex items-center gap-2"><Plus size={20} /> NUEVO PATRÓN</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {standards.map(std => (
                  <div key={std.id} className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all group relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                      <div className="pl-4">
                          <h3 className="font-bold text-lg text-slate-800 dark:text-white">{std.name}</h3>
                          <p className="text-xs font-mono text-slate-500">{std.serialNumber}</p>
                          <div className="mt-4 flex gap-2">
                              <button onClick={() => handleEdit(std)} className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded text-xs font-bold">Editar</button>
                              <button onClick={() => deleteStd(std.id)} className="bg-red-50 dark:bg-red-900/20 text-red-500 px-3 py-1 rounded text-xs font-bold">Eliminar</button>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    );
};