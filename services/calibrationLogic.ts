
import { CalibrationPoint, CalibrationResult, Instrument, ReferenceStandard, SequenceType, StandardCalibrationPoint, CalibrationFluid, Unit, StandardType, CalibrationSession, IntermediateCheck, CheckPointResult, StandardCheckConfig } from '../types';
import { fitStandardModels, calculateInterpolationUncertainty, predictValue, GRAVITY_BOGOTA } from './mathUtils';

// --- Sound Helper ---
export const playSound = (type: 'click' | 'success' | 'error' | 'timer' | 'alarm') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'timer') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'alarm') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
    }
  } catch (e) {
    // Ignore audio errors
  }
};

export const calculateResults = (points: CalibrationPoint[], instrument: Instrument, standard: ReferenceStandard, sequence: SequenceType, fluidDensity: number, heightDiff: number, localGravity: number): CalibrationResult[] => {
    // Head Correction P = rho * g * h
    const headCorrPa = fluidDensity * localGravity * (heightDiff / 100);
    const headCorrBar = headCorrPa / 100000; 

    if (!standard.valueRegression || !standard.uncertaintyRegression) {
        const fitted = fitStandardModels(standard.calibrationPoints, standard.valueModelType, standard.uncertaintyModelType);
        standard.valueRegression = fitted.valueReg;
        standard.uncertaintyRegression = fitted.uncReg;
    }

    return points.map(p => {
        const correctedReading = p.standardReading + headCorrBar;
        
        const trueValue = predictValue(correctedReading, standard.valueModelType, standard.valueRegression!.coefficients);
        const u_model = calculateInterpolationUncertainty(correctedReading, standard.valueRegression!, standard.valueModelType);
        
        const r1Up = p.run1Up || 0;
        const r1Down = p.run1Down || 0;
        const readings = [r1Up, r1Down];
        const meanReading = readings.reduce((a, b) => a + b, 0) / readings.length;
        const meanError = meanReading - trueValue;
        
        const u_ref_std = predictValue(trueValue, standard.uncertaintyModelType, standard.uncertaintyRegression!.coefficients);
        const u_ref = Math.sqrt(Math.pow(u_ref_std, 2) + Math.pow(u_model, 2));
        const u_c = Math.sqrt( Math.pow(u_ref, 2) + Math.pow(instrument.resolution/Math.sqrt(12), 2) );
        const k = 2;

        return {
            nominal: p.nominal,
            trueValue,
            meanError,
            hysteresis: Math.abs(r1Up - r1Down),
            repeatability: 0,
            expandedUncertainty: u_c * k,
            uncertaintyContributors: { ref: u_ref*k, model: u_model*k, res: 0, rep: 0, hys: 0},
            compliance: (Math.abs(meanError) + u_c*k) < (instrument.rangeMax * instrument.accuracyClass / 100)
        };
    });
};

// --- Random Data Generators ---

interface GenStandardOptions {
    forceExpirySoon?: boolean;
    forcePendingCheck?: boolean;
}

export const generateRandomStandard = (options: GenStandardOptions = {}): ReferenceStandard => {
    const types = [StandardType.Pressure, StandardType.Temperature, StandardType.Humidity];
    const type = types[Math.floor(Math.random() * types.length)];
    let rangeMax = 200;
    let unit = Unit.Bar;

    if (type === StandardType.Temperature) { rangeMax = 600; unit = Unit.Celcius; }
    else if (type === StandardType.Humidity) { rangeMax = 100; unit = Unit.PercentRH; }
    
    const points: StandardCalibrationPoint[] = [];
    const numPoints = 6;
    const slopeError = 1 + (Math.random() - 0.5) * 0.005; 
    const offset = (Math.random() - 0.5) * 0.1;
    
    for (let i = 0; i < numPoints; i++) {
        const nominal = parseFloat(((rangeMax / (numPoints - 1)) * i).toFixed(2));
        const trueVal = nominal; 
        const indication = (trueVal * slopeError) + offset + ((Math.random() - 0.5) * (rangeMax * 0.0005));
        
        points.push({
            id: Date.now().toString() + i,
            nominal,
            referenceValue: trueVal, 
            indication: parseFloat(indication.toFixed(4)), 
            uncertainty: parseFloat((rangeMax * 0.0001 * (1 + Math.random())).toFixed(5)),
            coverageFactor: 2,
            confidenceLevel: 95.45,
            distribution: 'Normal'
        });
    }

    const { valueReg, uncReg } = fitStandardModels(points, 'linear_pearson', 'linear_pearson');

    let expiryDate = new Date(Date.now() + 31536000000).toISOString().split('T')[0]; 
    if (options.forceExpirySoon) {
        expiryDate = new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0];
    }

    const checkPoints = [0, parseFloat((rangeMax * 0.5).toFixed(2)), rangeMax];
    const limits: any = {};
    checkPoints.forEach(p => {
        limits[p] = { ucl: rangeMax * 0.002, lcl: -(rangeMax * 0.002) };
    });
    
    const checkConfig: StandardCheckConfig = { checkPoints, limits };
    const intermediateChecks: IntermediateCheck[] = [];
    
    if (!options.forcePendingCheck) {
        for (let m = 6; m >= 1; m--) {
            const date = new Date(Date.now() - 86400000 * 30 * m).toISOString();
            const checkResults: CheckPointResult[] = [];
            
            checkPoints.forEach(nominal => {
                const readings: number[] = [];
                const drift = (Math.random() - 0.5) * (rangeMax * 0.0005) * m;
                const trueCenter = nominal + drift;
                const sigma = rangeMax * 0.0001; 

                for(let k=0; k<10; k++) {
                    const noise = (Math.random() - 0.5) * sigma;
                    readings.push(parseFloat((trueCenter + noise).toFixed(5)));
                }

                const mean = readings.reduce((a,b)=>a+b,0)/10;
                const min = Math.min(...readings);
                const max = Math.max(...readings);
                const s = Math.sqrt(readings.reduce((a,b)=>a+Math.pow(b-mean,2),0)/9);

                checkResults.push({ nominal, readings, mean, stdDev: s, range: max - min });
            });

            intermediateChecks.push({
                id: `hist-${m}`,
                date,
                technician: 'Simulated AI',
                results: checkResults,
                globalResult: 'PASS'
            });
        }
    }

    return {
        id: Date.now().toString() + Math.random().toString(),
        type,
        name: `SIMULATED ${type.toUpperCase()} ${Math.floor(Math.random()*1000)}`,
        serialNumber: `SIM-${Math.floor(Math.random()*99999)}`,
        certificateNumber: `CERT-${new Date().getFullYear()}-${Math.floor(Math.random()*1000)}`,
        calibratedBy: 'AI Simulation Lab',
        calibrationDate: new Date().toISOString().split('T')[0],
        expiryDate,
        rangeMin: 0,
        rangeMax,
        unit,
        resolution: 0.001,
        valueModelType: 'linear_pearson',
        uncertaintyModelType: 'linear_pearson',
        calibrationPoints: points,
        valueRegression: valueReg,
        uncertaintyRegression: uncReg,
        checkConfig,
        intermediateChecks
    };
};

export const generateRandomSession = (standards: ReferenceStandard[]): CalibrationSession => {
    let pressureStd = standards.filter(s => s.type === StandardType.Pressure)[0];
    if (!pressureStd) {
        pressureStd = generateRandomStandard();
        pressureStd.type = StandardType.Pressure;
    }

    const range = pressureStd.rangeMax;
    const points: CalibrationPoint[] = [];
    const steps = 6;
    const linearityError = (x: number) => Math.sin(x/range * Math.PI) * (range * 0.005);
    
    for(let i=0; i<steps; i++) {
        const nom = (range/(steps-1))*i;
        const systematic = linearityError(nom);
        const random = (Math.random() - 0.5) * (range * 0.001);
        
        points.push({
            nominal: parseFloat(nom.toFixed(2)),
            standardReading: parseFloat(nom.toFixed(4)), 
            run1Up: parseFloat((nom + systematic + random).toFixed(4)),
            run1Down: parseFloat((nom + systematic + random - (Math.random()*range*0.001)).toFixed(4)), 
        });
    }

    const instrument: Instrument = {
        manufacturer: 'Simulated Instruments',
        model: `SIM-GAUGE-${Math.floor(Math.random()*100)}`,
        serialNumber: Math.floor(Math.random()*100000).toString(),
        applicantName: 'Industrias de Prueba S.A. de C.V.',
        identificationId: `SIM-TAG-${Math.floor(Math.random()*1000)}`,
        rangeMin: pressureStd.rangeMin,
        rangeMax: pressureStd.rangeMax,
        resolution: pressureStd.resolution * 10,
        accuracyClass: 0.5,
        unit: pressureStd.unit,
        type: 'analog',
        connectionType: '1/2 NPT',
        sensorLocation: 'Bottom',
        conditionReceived: 'Adecuada'
    };

    const results = calculateResults(
        points, 
        instrument, 
        pressureStd, 
        SequenceType.B, 
        1.2, 
        5,
        GRAVITY_BOGOTA
    );

    return {
        id: `CAL-${Date.now()}`,
        date: new Date().toISOString(),
        technician: 'AI-Generated Test',
        standardId: pressureStd.id,
        sequence: SequenceType.B,
        instrument,
        envReadings: {
            start: { temp: 20, humidity: 45, pressure: 1013 },
            middle: { temp: 20.5, humidity: 46, pressure: 1013 },
            end: { temp: 21, humidity: 44, pressure: 1012 }
        },
        fluid: CalibrationFluid.Air,
        fluidDensity: 1.2,
        heightDifference: 5,
        points: points,
        results: results
    };
};
