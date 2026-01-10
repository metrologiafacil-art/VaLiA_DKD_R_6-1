
import { IntermediateCheck, RegressionResult, AnovaResult, CurveModel, StandardCalibrationPoint } from '../types';

export const GRAVITY_BOGOTA = 9.7739; 

// --- DENSITY FUNCTIONS ---
export const calculateWaterDensity = (tempC: number): number => {
  const a1 = -3.983035; const a2 = 301.797; const a3 = 522528.9; const a4 = 69.34881; const a5 = 999.974950;
  const term = ((tempC + a1) * (tempC + a1) * (tempC + a2)) / (a3 * (tempC + a4));
  return a5 * (1 - term);
};

export const calculateLocalGravity = (latitude: number, heightMeters: number): number => {
    const latRad = latitude * (Math.PI / 180);
    const sinLat = Math.sin(latRad);
    const sin2Lat = Math.sin(2 * latRad);
    const g_lat = 9.780327 * (1 + 0.0053024 * (sinLat * sinLat) - 0.0000058 * (sin2Lat * sin2Lat));
    return parseFloat((g_lat - (0.000003086 * heightMeters)).toFixed(5));
};

export const calculateAirDensityCIPM = (tempC: number, pressureHPa: number, humidityRel: number, ppmCO2: number = 400): number => {
  const T = tempC + 273.15; const p = pressureHPa * 100; const h = humidityRel / 100; const xCO2 = ppmCO2 / 1e6; 
  const Mv = 18.01528e-3; const R = 8.314472; 
  const Ma = (28.96546 + 12.011 * (xCO2 - 0.0004)) * 1e-3;
  const A = 1.2378847e-5; const B = -1.9121316e-2; const C = 33.93711047; const D = -6.3431645e3;
  const es = 1 * Math.exp(A*Math.pow(T, 2) + B*T + C + D/T);
  const alpha = 1.00062; const beta = 3.14e-8; const gamma = 5.6e-7;
  const f = alpha + beta * p + gamma * Math.pow(tempC, 2);
  const xv = (h * f * es) / p;
  const Z = 1 - (p/T) * (1.58123e-6 + -2.9331e-8*tempC + 1.1043e-10*Math.pow(tempC,2) + (5.707e-6 + -2.051e-8*tempC)*xv + (1.9898e-4 + -2.376e-6*tempC)*Math.pow(xv,2)) + (p*p/Math.pow(T,2))*(1.83e-11 + -0.765e-8*Math.pow(xv,2));
  return (p * Ma / (Z * R * T)) * (1 - xv * (1 - Mv/Ma));
};

export const calculateCumulativeStats = (checks: IntermediateCheck[], nominal: number) => {
    let allReadings: number[] = [];
    checks.forEach(check => {
        const pointResult = check.results.find(r => r.nominal === nominal);
        if (pointResult) allReadings = [...allReadings, ...pointResult.readings];
    });
    if (allReadings.length < 2) return null;
    const n = allReadings.length;
    const mean = allReadings.reduce((a, b) => a + b, 0) / n;
    const variance = allReadings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    return { mean, stdDev: Math.sqrt(variance), n, allReadings };
};

// --- STATISTICAL HELPERS ---

const solveLinearSystem = (A: number[][], B: number[]): number[] => {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]), maxRow = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
    for (let k = i; k < n; k++) { const tmp = A[maxRow][k]; A[maxRow][k] = A[i][k]; A[i][k] = tmp; }
    const tmp = B[maxRow]; B[maxRow] = B[i]; B[i] = tmp;
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) i === j ? A[k][j] = 0 : A[k][j] += c * A[i][j];
      B[k] += c * B[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
};

const calculateDurbinWatson = (residuals: number[]): number => {
  if (residuals.length < 2) return 0;
  let num = 0, den = 0;
  for (let i = 1; i < residuals.length; i++) num += Math.pow(residuals[i] - residuals[i - 1], 2);
  for (let i = 0; i < residuals.length; i++) den += Math.pow(residuals[i], 2);
  return den === 0 ? 0 : num / den;
};

// Returns critical t-value for 95% confidence (two-tailed)
const getTStudentCrit = (df: number): number => {
    if (df <= 1) return 12.706; if (df <= 2) return 4.303; if (df <= 3) return 3.182;
    if (df <= 4) return 2.776; if (df <= 5) return 2.571; if (df <= 10) return 2.228;
    if (df <= 20) return 2.086; if (df <= 60) return 2.000; return 1.960;
};

const getFCrit = (df2: number, df1: number = 1): number => {
    // Simplified Critical F-value table for alpha = 0.05
    if (df1 === 1) {
        if (df2 <= 1) return 161.45;
        if (df2 <= 2) return 18.51;
        if (df2 <= 3) return 10.13;
        if (df2 <= 4) return 7.71;
        if (df2 <= 5) return 6.61;
        if (df2 <= 10) return 4.96;
        if (df2 <= 20) return 4.35;
        if (df2 <= 60) return 4.00;
        return 3.84;
    }
    if (df1 === 2) {
        if (df2 <= 1) return 199.5;
        if (df2 <= 2) return 19.00;
        if (df2 <= 5) return 5.79;
        if (df2 <= 10) return 4.10;
        if (df2 <= 20) return 3.49;
        if (df2 <= 60) return 3.15;
        return 3.00;
    }
    // Generic fallback for higher orders
    return 2.6; 
};

// Returns AIC and AICc
// n: sample size, k: number of parameters (including intercept & error variance), sse: sum of squared errors
const calculateAIC = (n: number, k: number, sse: number) => {
    if (sse <= 0) sse = 1e-10; // Prevent log(0)
    const aic = n * Math.log(sse / n) + 2 * k;
    const aicc = aic + (2 * k * (k + 1)) / (n - k - 1);
    const bic = n * Math.log(sse / n) + k * Math.log(n);
    return { aic, aicc, bic };
};

// Helper for Simple Linear Regression used in Split Models
const calculateSimpleLinearFull = (x: number[], y: number[]) => {
    const n = x.length;
    if (n < 2) return null;
    const sumX = x.reduce((a,b)=>a+b,0);
    const sumY = y.reduce((a,b)=>a+b,0);
    const sumXY = x.reduce((s,xi,i)=>s+xi*y[i],0);
    const sumXX = x.reduce((s,xi)=>s+xi*xi,0);
    
    const slope = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    
    const residuals = y.map((yi,i) => yi - (slope*x[i] + intercept));
    const ssRes = residuals.reduce((s,r)=>s+r*r,0);
    const sRes = Math.sqrt(ssRes / (n-2));
    const xBar = sumX/n;
    const sumSqDiffX = x.reduce((s,xi)=>s+Math.pow(xi-xBar,2),0);

    return { m: slope, b: intercept, ssRes, sRes, xBar, sumSqDiffX, n, residuals };
};

// --- MAIN REGRESSION FUNCTION ---

export const calculateRegression = (x: number[], y: number[], type: CurveModel, isUncertaintyModel: boolean = false): RegressionResult => {
  let stepText = `VALIDACIÓN Y CRITERIO DE AKAIKE (AIC)\n`;
  stepText += `==============================================\n`;
  
  // Data Filtering
  let validIndices = x.map((_, i) => i);
  if (type === 'power' || type === 'logarithmic' || type === 'exponential') {
    validIndices = x.map((val, i) => {
       if (type === 'logarithmic' && val <= 0) return -1;
       if (type === 'power' && (val <= 0 || y[i] <= 0)) return -1;
       if (type === 'exponential' && y[i] <= 0) return -1;
       return i;
    }).filter(i => i !== -1);
  }
  const xFiltered = validIndices.map(i => x[i]);
  const yFiltered = validIndices.map(i => y[i]);
  const n = xFiltered.length;

  if (n < 3) {
      return { 
          coefficients: [0], rSquared: 0, residualStdDev: 0, equationString: "Datos insuficientes (N<3)", 
          validationSteps: "Error: N < 3", xBar: 0, sumSqDiffX: 1, n: 0, durbinWatson: 0, isParametricValid: false,
          aic: 9999, aicc: 9999, bic: 9999, modelQuality: 'INVALID', recommendationText: "Datos Insuficientes"
      };
  }

  // --- SPLIT REGRESSION (DOBLE MODELADO) ---
  if (type === 'piecewise_linear') {
      stepText += `MÉTODO: REGRESIÓN DOBLE (SPLIT REGRESSION)\n`;
      stepText += `Objetivo: Minimizar el Error Cuadrático Total combinando dos modelos lineales independientes.\n`;
      stepText += `Criterio: Se busca el punto de corte (Split Point) óptimo iterativamente.\n\n`;

      if (n < 6) {
          // Not enough points to split meaningfully (need at least 3 points per side for decent stats)
          return calculateRegression(x, y, 'linear_pearson', isUncertaintyModel);
      }

      let bestSplitIdx = -1;
      let minTotalSSE = Infinity;
      let bestReg1 = null;
      let bestReg2 = null;

      // Iterate potential split points. Keep at least 3 points on each side.
      // Assuming sorted X
      for (let i = 2; i < n - 3; i++) {
          const x1 = xFiltered.slice(0, i + 1);
          const y1 = yFiltered.slice(0, i + 1);
          const x2 = xFiltered.slice(i + 1);
          const y2 = yFiltered.slice(i + 1);

          const r1 = calculateSimpleLinearFull(x1, y1);
          const r2 = calculateSimpleLinearFull(x2, y2);

          if (r1 && r2) {
              const totalSSE = r1.ssRes + r2.ssRes;
              if (totalSSE < minTotalSSE) {
                  minTotalSSE = totalSSE;
                  bestSplitIdx = i;
                  bestReg1 = r1;
                  bestReg2 = r2;
              }
          }
      }

      if (bestReg1 && bestReg2) {
          const splitX = xFiltered[bestSplitIdx];
          // PACKING COEFFICIENTS:
          // [0] SplitX
          // [1] m1, [2] b1, [3] sRes1, [4] xBar1, [5] Sxx1, [6] n1
          // [7] m2, [8] b2, [9] sRes2, [10] xBar2, [11] Sxx2, [12] n2
          const coeffs = [
              splitX,
              bestReg1.m, bestReg1.b, bestReg1.sRes, bestReg1.xBar, bestReg1.sumSqDiffX, bestReg1.n,
              bestReg2.m, bestReg2.b, bestReg2.sRes, bestReg2.xBar, bestReg2.sumSqDiffX, bestReg2.n
          ];

          // Calculate Global Stats
          const meanY = yFiltered.reduce((a,b)=>a+b,0)/n;
          const ssTot = yFiltered.reduce((s, yi) => s + Math.pow(yi - meanY, 2), 0);
          const rSquared = 1 - (minTotalSSE / ssTot);
          
          // AIC Calculation for Split Model
          // k = (2 params + 1 var) * 2 models + 1 split_param = 7 parameters roughly? 
          // Let's treat it as sum of AICs or a complex model with k=5 (2 slopes, 2 intercepts, 1 split) + 1 var = 6
          const k_split = 6; 
          const { aic, aicc, bic } = calculateAIC(n, k_split, minTotalSSE);

          stepText += `RESULTADOS DEL DOBLE MODELADO:\n`;
          stepText += `> Corte Óptimo en: ${splitX}\n`;
          stepText += `> Rango Bajo (N=${bestReg1.n}): y = ${bestReg1.m.toExponential(4)}x + ${bestReg1.b.toExponential(4)}\n`;
          stepText += `  s_res: ${bestReg1.sRes.toExponential(4)} | Incertidumbre calculada con estadística local.\n`;
          stepText += `> Rango Alto (N=${bestReg2.n}): y = ${bestReg2.m.toExponential(4)}x + ${bestReg2.b.toExponential(4)}\n`;
          stepText += `  s_res: ${bestReg2.sRes.toExponential(4)} | Incertidumbre calculada con estadística local.\n\n`;
          stepText += `ESTADÍSTICA GLOBAL:\n`;
          stepText += `> AICc: ${aicc.toFixed(2)} (Menor es mejor)\n`;
          stepText += `> R² Global: ${rSquared.toFixed(5)}\n`;

          return {
              coefficients: coeffs,
              rSquared,
              residualStdDev: Math.sqrt(minTotalSSE/(n-4)), // Approx pooled
              equationString: `Doble Tendencia (Corte @ ${splitX})`,
              validationSteps: stepText,
              xBar: 0, sumSqDiffX: 0, n, durbinWatson: 2, // Placeholders
              aic, aicc, bic,
              modelQuality: rSquared > 0.999 ? 'EXCELLENT' : 'GOOD',
              recommendationText: "Modelo dividido optimizado. Minimiza el error en extremos.",
              isParametricValid: true
          };
      }
  }

  // --- STANDARD MODELS ---
  let coeffs: number[] = [];
  let residuals: number[] = [];
  let ssRes = 0; 
  let numParams = 2; // Default linear (m, b) + variance implicit in AIC formula usually k includes variance, but calculateAIC handles k as params.
                     // Linear: y=mx+b (2 params). +1 for error var = 3.
  
  let xCalc = [...xFiltered];
  let yCalc = [...yFiltered];

  // Transformations
  if (type === 'power') { xCalc = xFiltered.map(Math.log); yCalc = yFiltered.map(Math.log); } 
  else if (type === 'exponential') { yCalc = yFiltered.map(Math.log); } 
  else if (type === 'logarithmic') { xCalc = xFiltered.map(Math.log); }

  let eqStr = "";

  if (type.includes('polynomial')) {
    const order = type === 'polynomial_3rd' ? 3 : 2;
    numParams = order + 1; // Intercept + coeffs
    const m = order + 1;
    
    // Poly Fit logic...
    const XSums = new Array(2 * order + 1).fill(0);
    for (let i = 0; i < 2 * order + 1; i++) XSums[i] = xCalc.reduce((s, xi) => s + Math.pow(xi, i), 0);
    const YSums = new Array(m).fill(0);
    for (let i = 0; i < m; i++) YSums[i] = xCalc.reduce((s, xi, idx) => s + Math.pow(xi, i) * yCalc[idx], 0);
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    const B = new Array(m).fill(0);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < m; j++) A[i][j] = XSums[i + j];
      B[i] = YSums[i];
    }
    coeffs = solveLinearSystem(A, B);
    residuals = yCalc.map((yi, i) => {
      const pred = coeffs.reduce((acc, c, p) => acc + c * Math.pow(xCalc[i], p), 0);
      return yi - pred;
    });
    eqStr = type === 'polynomial_2nd' ? `Polinomio 2º Orden` : `Polinomio 3º Orden`;

  } else if (type === 'linear_theil_sen') {
    // Theil Sen Logic
    const slopes: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (xCalc[j] !== xCalc[i]) slopes.push((yCalc[j] - yCalc[i]) / (xCalc[j] - xCalc[i]));
      }
    }
    slopes.sort((a, b) => a - b);
    const slope = slopes[Math.floor(slopes.length / 2)];
    const intercepts = yCalc.map((y, i) => y - slope * xCalc[i]);
    intercepts.sort((a, b) => a - b);
    const intercept = intercepts[Math.floor(intercepts.length / 2)];
    coeffs = [intercept, slope];
    residuals = yCalc.map((yi, i) => yi - (intercept + slope * xCalc[i]));
    eqStr = `Lineal Robusta (Theil-Sen)`;

  } else {
    // Linear / Log / Exp / Power (Least Squares)
    const sumX = xCalc.reduce((a, b) => a + b, 0);
    const sumY = yCalc.reduce((a, b) => a + b, 0);
    const sumXY = xCalc.reduce((s, xi, i) => s + xi * yCalc[i], 0);
    const sumXX = xCalc.reduce((s, xi) => s + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    coeffs = [intercept, slope];
    if (type === 'power' || type === 'exponential') coeffs[0] = Math.exp(intercept);
    
    residuals = yCalc.map((yi, i) => yi - (intercept + slope * xCalc[i]));
    eqStr = type === 'linear_pearson' ? "Lineal (Mínimos Cuadrados)" : type;
  }

  // Stats Calculation
  ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const meanY = yCalc.reduce((a, b) => a + b, 0) / n;
  const ssTot = yCalc.reduce((s, yi) => s + Math.pow(yi - meanY, 2), 0);
  const rSquared = 1 - (ssRes / (ssTot || 1)); 
  const dfRes = n - numParams;
  const residualStdDev = Math.sqrt(ssRes / (dfRes > 0 ? dfRes : 1));
  
  // ANOVA F-Test
  const ssReg = ssTot - ssRes;
  const dfReg = numParams - 1;
  const msReg = ssReg / (dfReg || 1);
  const msRes = ssRes / (dfRes || 1);
  const fCalc = msReg / (msRes || 1);
  const fCrit = getFCrit(dfRes, dfReg);
  const durbinWatson = calculateDurbinWatson(residuals);

  // AIC Calculation (k = numParams + 1 for variance)
  const k_aic = numParams + 1;
  const { aic, aicc, bic } = calculateAIC(n, k_aic, ssRes);

  let isValid = fCalc > fCrit;
  if (type === 'linear_theil_sen') isValid = true; // Non-parametric assumption

  // Reporting
  stepText += `Estadística Avanzada:\n`;
  stepText += `> Akaike (AICc): ${aicc.toFixed(2)} [Criterio Principal]\n`;
  stepText += `> Bayesian (BIC): ${bic.toFixed(2)}\n`;
  stepText += `> R² Ajustado: ${rSquared.toFixed(5)}\n`;
  stepText += `> Prueba F (ANOVA): ${fCalc.toFixed(2)} vs Crit ${fCrit.toFixed(2)} (${fCalc > fCrit ? 'Pasa' : 'Falla'})\n`;
  stepText += `> Durbin-Watson: ${durbinWatson.toFixed(2)} (Independencia)\n`;

  let modelQuality: 'EXCELLENT'|'GOOD'|'POOR'|'INVALID' = 'POOR';
  if (rSquared > 0.99 && isValid) modelQuality = 'EXCELLENT';
  else if (rSquared > 0.95 && isValid) modelQuality = 'GOOD';
  
  // Specific penalties
  if (durbinWatson < 1 || durbinWatson > 3) {
      stepText += `ALERTA: Posible autocorrelación en residuos.\n`;
      if (modelQuality === 'EXCELLENT') modelQuality = 'GOOD';
  }

  const xBar = xCalc.reduce((a,b)=>a+b,0) / n;
  const sumSqDiffX = xCalc.reduce((s, xi) => s + Math.pow(xi - xBar, 2), 0);

  return {
    coefficients: coeffs,
    rSquared,
    residualStdDev,
    equationString: eqStr,
    validationSteps: stepText,
    xBar,
    sumSqDiffX,
    n,
    durbinWatson,
    anova: { sse: ssRes, ssr: ssReg, sst: ssTot, dfReg, dfRes, msReg, msRes, fStatistic: fCalc },
    isParametricValid: isValid,
    aic, aicc, bic,
    modelQuality,
    recommendationText: "" // Populated by comparison logic later
  };
};

export const predictValue = (xInput: number, model: CurveModel, coeffs: number[]): number => {
  if (model === 'piecewise_linear') {
      // Coeffs: [SplitX, m1, b1, sRes1, xBar1, Sxx1, n1, m2, b2, sRes2, xBar2, Sxx2, n2]
      const splitX = coeffs[0];
      const m1 = coeffs[1]; const b1 = coeffs[2];
      const m2 = coeffs[7]; const b2 = coeffs[8];
      
      if (xInput <= splitX) return m1 * xInput + b1;
      return m2 * xInput + b2;
  }

  const c0 = coeffs[0] || 0; const c1 = coeffs[1] || 0; const c2 = coeffs[2] || 0; const c3 = coeffs[3] || 0;

  switch (model) {
    case 'linear_pearson': case 'linear_theil_sen': return c0 + c1 * xInput;
    case 'polynomial_2nd': return c0 + c1 * xInput + c2 * xInput * xInput;
    case 'polynomial_3rd': return c0 + c1 * xInput + c2 * Math.pow(xInput, 2) + c3 * Math.pow(xInput, 3);
    case 'power': return c0 * Math.pow(xInput, c1);
    case 'exponential': return c0 * Math.exp(c1 * xInput);
    case 'logarithmic': return c0 + c1 * Math.log(xInput);
    default: return xInput;
  }
};

export const calculateInterpolationUncertainty = (xInput: number, reg: RegressionResult, model: CurveModel): number => {
  if (reg.n < 3) return 0;

  // --- RIGOROUS SPLIT UNCERTAINTY ---
  if (model === 'piecewise_linear') {
      const splitX = reg.coefficients[0];
      
      // Determine which model to use stats from
      let m, b, sRes, xBar, Sxx, n;
      
      if (xInput <= splitX) {
          // Model 1 (Left)
          // [1] m1, [2] b1, [3] sRes1, [4] xBar1, [5] Sxx1, [6] n1
          sRes = reg.coefficients[3];
          xBar = reg.coefficients[4];
          Sxx = reg.coefficients[5];
          n = reg.coefficients[6];
      } else {
          // Model 2 (Right)
          // [7] m2, [8] b2, [9] sRes2, [10] xBar2, [11] Sxx2, [12] n2
          sRes = reg.coefficients[9];
          xBar = reg.coefficients[10];
          Sxx = reg.coefficients[11];
          n = reg.coefficients[12];
      }

      if (n < 3) return sRes * 2; // Fallback
      
      const t = getTStudentCrit(n - 2);
      const term = 1 + (1/n) + (Math.pow(xInput - xBar, 2) / Sxx);
      return t * sRes * Math.sqrt(term);
  }

  let xTrans = xInput;
  if (model === 'power' || model === 'logarithmic') {
      if (xInput <= 0) return reg.residualStdDev * 2;
      xTrans = Math.log(xInput);
  }

  const { residualStdDev, xBar, sumSqDiffX, n, anova } = reg;
  const df = anova ? anova.dfRes : n - 2;
  const t = getTStudentCrit(df);

  // ISO 8466-1 Prediction Interval
  const term = 1 + (1/n) + (Math.pow(xTrans - xBar, 2) / sumSqDiffX);
  
  let u = t * residualStdDev * Math.sqrt(term);
  
  if (model === 'power' || model === 'exponential') {
    const yPred = predictValue(xInput, model, reg.coefficients);
    u = Math.abs(yPred * u);
  }
  return u;
};

// Calculates all models and determines the winner based on AICc
export const fitStandardModels = (points: StandardCalibrationPoint[], valModel: CurveModel, uncModel: CurveModel) => {
  const xVal = points.map(p => p.indication);
  const yVal = points.map(p => p.referenceValue);
  
  const modelsToTest: CurveModel[] = ['linear_pearson', 'polynomial_2nd', 'polynomial_3rd', 'piecewise_linear', 'linear_theil_sen'];
  
  // 1. Calculate for VALUE
  let bestValReg: RegressionResult | null = null;
  let minAICc = Infinity;
  const valResults = new Map<CurveModel, RegressionResult>();

  // Compare all valid models
  modelsToTest.forEach(m => {
      const reg = calculateRegression(xVal, yVal, m, false);
      valResults.set(m, reg);
      // Logic for "Best": Valid parametric + Lowest AICc
      if (reg.isParametricValid && reg.aicc < minAICc && reg.modelQuality !== 'INVALID') {
          minAICc = reg.aicc;
      }
  });

  // Get selected model result
  const valueReg = calculateRegression(xVal, yVal, valModel, false);
  
  // Set comparison text
  const valDeltaAIC = valueReg.aicc - minAICc;
  if (valDeltaAIC <= 2) {
      valueReg.isBestFit = true;
      valueReg.recommendationText = "MODELO ÓPTIMO (Criterio Akaike). Balance ideal entre ajuste y complejidad.";
  } else {
      valueReg.isBestFit = false;
      valueReg.recommendationText = `No es el óptimo estadístico (ΔAICc = ${valDeltaAIC.toFixed(2)}). Considere modelos con menor AICc.`;
  }

  // 2. Calculate for UNCERTAINTY
  // For uncertainty, simpler is usually better (Linear or Poly 2), overcomplicating uncertainty models is risky.
  const xUnc = points.map(p => p.referenceValue);
  const yUnc = points.map(p => p.uncertainty / (p.coverageFactor || 2)); 
  const uncReg = calculateRegression(xUnc, yUnc, uncModel, true);

  return { valueReg, uncReg };
};
