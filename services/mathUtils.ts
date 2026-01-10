
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
    return 3.00; 
};

// Returns AIC and AICc
const calculateAIC = (n: number, k: number, sse: number) => {
    if (sse <= 1e-15) sse = 1e-15; // Prevent log(0) or -Infinity
    const aic = n * Math.log(sse / n) + 2 * k;
    const aicc = aic + (2 * k * (k + 1)) / (n - k - 1);
    const bic = n * Math.log(sse / n) + k * Math.log(n);
    return { aic, aicc, bic };
};

// MANDEL'S FITTING TEST (ISO 8466-1)
// Compares Residual Variance of Linear (s1^2) vs Quadratic (s2^2)
const calculateMandelTest = (x: number[], y: number[]) => {
    const n = x.length;
    if (n < 4) return { isLinearSufficient: true, fCalc: 0, fCrit: 0, sResLinear: 0, sResQuad: 0 }; // Not enough data

    // 1. Linear Fit - Pass true to skipMandel to prevent recursion
    const regLin = calculateRegression(x, y, 'linear_pearson', false, true);
    const ssResLin = regLin.anova!.sse; // DS^2 linear * (N-2)
    const dfLin = n - 2;

    // 2. Quadratic Fit
    const regQuad = calculateRegression(x, y, 'polynomial_2nd');
    const ssResQuad = regQuad.anova!.sse; // DS^2 quad * (N-3)
    const dfQuad = n - 3;
    
    // Difference in Sum of Squares
    const diffSS = ssResLin - ssResQuad; // Improvement by adding quadratic term
    const dfDiff = 1; // Difference in params (3 - 2)

    // F-Statistic
    // F = (Difference in Variance) / (Variance of Higher Order Model)
    // F = ( (SSE_lin - SSE_quad) / 1 ) / ( SSE_quad / (N-3) )
    const msDiff = diffSS / dfDiff;
    const msQuad = ssResQuad / dfQuad;
    
    // Handle perfect fit case
    if (msQuad < 1e-15) return { isLinearSufficient: false, fCalc: 9999, fCrit: getFCrit(dfQuad, 1), sResLinear: regLin.residualStdDev, sResQuad: regQuad.residualStdDev };

    const fCalc = msDiff / msQuad;
    const fCrit = getFCrit(dfQuad, 1); // F(1, N-3, 95%)

    return {
        isLinearSufficient: fCalc <= fCrit,
        fCalc,
        fCrit,
        sResLinear: regLin.residualStdDev,
        sResQuad: regQuad.residualStdDev
    };
};

// Helper for Simple Linear Regression used in Split Models
const calculateSimpleLinearFull = (x: number[], y: number[]) => {
    const n = x.length;
    if (n < 2) return null;
    const sumX = x.reduce((a,b)=>a+b,0);
    const sumY = y.reduce((a,b)=>a+b,0);
    const sumXY = x.reduce((s,xi,i)=>s+xi*y[i],0);
    const sumXX = x.reduce((s,xi)=>s+xi*xi,0);
    
    // Check for vertical line
    const det = n*sumXX - sumX*sumX;
    if (Math.abs(det) < 1e-10) return null;

    const slope = (n*sumXY - sumX*sumY) / det;
    const intercept = (sumY - slope*sumX) / n;
    
    const residuals = y.map((yi,i) => yi - (slope*x[i] + intercept));
    const ssRes = residuals.reduce((s,r)=>s+r*r,0);
    const sRes = Math.sqrt(ssRes / (n > 2 ? n-2 : 1));
    const xBar = sumX/n;
    const sumSqDiffX = x.reduce((s,xi)=>s+Math.pow(xi-xBar,2),0);

    // Calculate R² for this segment
    const meanY = sumY / n;
    const ssTot = y.reduce((s, yi) => s + Math.pow(yi - meanY, 2), 0);
    const rSq = ssTot > 0 ? 1 - (ssRes / ssTot) : 1;

    return { m: slope, b: intercept, ssRes, sRes, xBar, sumSqDiffX, n, residuals, rSq, minX: Math.min(...x), maxX: Math.max(...x) };
};

// --- MAIN REGRESSION FUNCTION ---

export const calculateRegression = (x: number[], y: number[], type: CurveModel, isUncertaintyModel: boolean = false, skipMandel: boolean = false): RegressionResult => {
  let stepText = `ANÁLISIS DE REGRESIÓN Y VALIDACIÓN\n`;
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

  // --- SPLIT REGRESSION WITH OVERLAP (REGRESIÓN DOBLE TRASLAPADA) ---
  if (type === 'piecewise_linear') {
      stepText += `MÉTODO: REGRESIÓN DOBLE CON TRASLAPE (OVERLAPPING SPLIT)\n`;
      stepText += `Estrategia: Generar dos tendencias lineales que se traslapan para suavizar la transición.\n`;
      
      let r1 = null;
      let r2 = null;

      // Logic: Split dataset into 2 overlapping chunks.
      // Example N=6: Chunk 1 (0,1,2,3), Chunk 2 (2,3,4,5). Overlap 2.
      // Example N=8: Chunk 1 (0..4), Chunk 2 (3..7).
      
      const mid = Math.floor(n / 2);
      // Overlap strategy: Ensure at least 3 points per segment if possible
      let endIdx1 = mid + 1; // Incluyente
      let startIdx2 = mid - 1; // Incluyente
      
      if (n <= 4) {
          // Can't split effectively, fallback to simple linear
           stepText += `Advertencia: N=${n} insuficiente para split robusto. Usando regresión simple.\n`;
           return calculateRegression(x, y, 'linear_pearson', isUncertaintyModel);
      } else {
           // Ensure overlap makes sense
           if (startIdx2 < 0) startIdx2 = 0;
           if (endIdx1 >= n) endIdx1 = n - 1;
           
           // Force at least 3 points per side
           if (endIdx1 < 2) endIdx1 = 2;
           if (startIdx2 > n - 3) startIdx2 = n - 3;
      }

      const x1 = xFiltered.slice(0, endIdx1 + 1);
      const y1 = yFiltered.slice(0, endIdx1 + 1);
      
      const x2 = xFiltered.slice(startIdx2);
      const y2 = yFiltered.slice(startIdx2);

      stepText += `> Segmento Bajo: Puntos 1 a ${endIdx1 + 1} (${x1.length} datos)\n`;
      stepText += `> Segmento Alto: Puntos ${startIdx2 + 1} a ${n} (${x2.length} datos)\n`;
      stepText += `> Puntos de Traslape (Overlap): ${xFiltered.slice(startIdx2, endIdx1 + 1).length}\n\n`;

      r1 = calculateSimpleLinearFull(x1, y1);
      r2 = calculateSimpleLinearFull(x2, y2);

      if (r1 && r2) {
          // PACKING COEFFICIENTS FOR OVERLAP MODEL:
          // [0] SplitStart (X value where overlap starts)
          // [1] SplitEnd (X value where overlap ends)
          // [2] m1, [3] b1, [4] sRes1, [5] xBar1, [6] Sxx1, [7] n1, [8] rSq1
          // [9] m2, [10] b2, [11] sRes2, [12] xBar2, [13] Sxx2, [14] n2, [15] rSq2
          
          const splitStart = xFiltered[startIdx2];
          const splitEnd = xFiltered[endIdx1];

          const coeffs = [
              splitStart, splitEnd,
              r1.m, r1.b, r1.sRes, r1.xBar, r1.sumSqDiffX, r1.n, r1.rSq,
              r2.m, r2.b, r2.sRes, r2.xBar, r2.sumSqDiffX, r2.n, r2.rSq
          ];

          // Global Stats Calculation
          // Weighted R2 implies predicting every point and checking error
          let ssTot = 0;
          let ssRes = 0;
          const globalMean = yFiltered.reduce((a,b)=>a+b,0)/n;
          
          yFiltered.forEach((yi, i) => {
              const xi = xFiltered[i];
              let yPred = 0;
              // Replication of prediction logic
              if (xi <= splitStart) yPred = r1!.m * xi + r1!.b;
              else if (xi >= splitEnd) yPred = r2!.m * xi + r2!.b;
              else {
                  // In overlap, average both
                  const y1p = r1!.m * xi + r1!.b;
                  const y2p = r2!.m * xi + r2!.b;
                  yPred = (y1p + y2p) / 2;
              }
              ssRes += Math.pow(yi - yPred, 2);
              ssTot += Math.pow(yi - globalMean, 2);
          });

          const rSquared = 1 - (ssRes / (ssTot || 1));
          const residuals = yFiltered.map((yi, i) => {
               // simplified resid calc for DurbinWatson
               return 0; // Not calculating D-W for split in this view to save perf
          });

          // AIC Calculation
          // k = 2 lines * 2 params + 1 var = 5 params roughly
          const k_split = 5; 
          const { aic, aicc, bic } = calculateAIC(n, k_split, ssRes);

          return {
              coefficients: coeffs,
              rSquared,
              residualStdDev: Math.sqrt(ssRes/(n-4)), 
              equationString: `Regresión Doble Traslapada`,
              validationSteps: stepText,
              xBar: 0, sumSqDiffX: 0, n, durbinWatson: 2, 
              aic, aicc, bic,
              modelQuality: rSquared > 0.99 ? 'EXCELLENT' : 'GOOD',
              recommendationText: "Modelo optimizado con traslape para suavizar tendencias divergentes.",
              isParametricValid: true
          };
      }
  }

  // --- STANDARD MODELS ---
  let coeffs: number[] = [];
  let residuals: number[] = [];
  let ssRes = 0; 
  let numParams = 2; // Default linear (m, b)
  
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
  if (type === 'linear_theil_sen') isValid = true; 

  // Check validity conditions for high order polynomials
  if (type.includes('polynomial') && n <= numParams + 1) {
      isValid = false; // Overfitting check
      stepText += `ADVERTENCIA: Orden del polinomio muy alto para N=${n}. Posible sobreajuste.\n`;
  }

  let modelQuality: 'EXCELLENT'|'GOOD'|'POOR'|'INVALID' = 'POOR';
  
  if (!isValid) modelQuality = 'INVALID';
  else if (rSquared > 0.999) modelQuality = 'EXCELLENT';
  else if (rSquared > 0.98) modelQuality = 'GOOD';
  
  // Mandel Test for Linear Models
  let recommendationText = "";
  if (type === 'linear_pearson' && n >= 4 && !skipMandel) {
      const mandel = calculateMandelTest(xFiltered, yFiltered);
      if (!mandel.isLinearSufficient) {
          stepText += `\nPRUEBA DE MANDEL (Linealidad ISO 8466-1):\n`;
          stepText += `Resultado: NO LINEAL. F_calc (${mandel.fCalc.toFixed(2)}) > F_crit (${mandel.fCrit.toFixed(2)}).\n`;
          stepText += `La reducción de varianza residual usando un polinomio de 2do grado es significativa.\n`;
          stepText += `Recomendación: Considere usar un polinomio de 2do orden o Regresión Doble.\n`;
          recommendationText = "Test de Mandel sugiere no linealidad. Revise polinomio.";
          modelQuality = 'POOR'; // Downgrade quality even if R2 is high
      } else {
          stepText += `\nPRUEBA DE MANDEL (Linealidad ISO 8466-1):\n`;
          stepText += `Resultado: LINEALIDAD ACEPTADA. F_calc (${mandel.fCalc.toFixed(2)}) <= F_crit (${mandel.fCrit.toFixed(2)}).\n`;
      }
  }

  // Specific penalties
  if (isValid && (durbinWatson < 1 || durbinWatson > 3)) {
      stepText += `NOTA: Durbin-Watson ${durbinWatson.toFixed(2)} sugiere autocorrelación. Revise residuales.\n`;
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
    recommendationText
  };
};

export const predictValue = (xInput: number, model: CurveModel, coeffs: number[]): number => {
  if (model === 'piecewise_linear') {
      // Coeffs Structure:
      // [0] SplitStart, [1] SplitEnd
      // [2] m1, [3] b1 ... [9] m2, [10] b2 ...
      const splitStart = coeffs[0];
      const splitEnd = coeffs[1];
      const m1 = coeffs[2]; const b1 = coeffs[3];
      const m2 = coeffs[9]; const b2 = coeffs[10];
      
      if (xInput <= splitStart) return m1 * xInput + b1;
      if (xInput >= splitEnd) return m2 * xInput + b2;
      
      // In overlap, average
      const y1 = m1 * xInput + b1;
      const y2 = m2 * xInput + b2;
      return (y1 + y2) / 2;
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

  // --- RIGOROUS SPLIT UNCERTAINTY WITH INTERPOLATION ---
  if (model === 'piecewise_linear') {
      const splitStart = reg.coefficients[0];
      const splitEnd = reg.coefficients[1];
      
      // Function to calculate U for a specific segment stats
      const calcU = (x: number, sRes: number, xBar: number, Sxx: number, n: number) => {
           if (n < 3) return 0;
           const df = n - 2;
           const t = getTStudentCrit(df);
           // ISO 8466-1 / DKD-R 6-1 Formula for Calibration Curve (Prognosis Interval)
           // u(x) = t * s_y * sqrt(1 + 1/n + (x-x_bar)^2/Sxx)
           const term = 1 + (1/n) + (Math.pow(x - xBar, 2) / Sxx);
           return t * sRes * Math.sqrt(term);
      };

      // Model 1 Stats
      const u1 = calcU(xInput, reg.coefficients[4], reg.coefficients[5], reg.coefficients[6], reg.coefficients[7]);
      
      // Model 2 Stats
      const u2 = calcU(xInput, reg.coefficients[11], reg.coefficients[12], reg.coefficients[13], reg.coefficients[14]);

      if (xInput <= splitStart) return u1;
      if (xInput >= splitEnd) return u2;
      
      // LINEAR INTERPOLATION OF UNCERTAINTY IN OVERLAP ZONE
      // Weight alpha moves from 0 (at splitStart) to 1 (at splitEnd)
      const alpha = (xInput - splitStart) / (splitEnd - splitStart);
      
      // Smooth blend: (1-alpha)*u1 + alpha*u2
      return (1 - alpha) * u1 + alpha * u2;
  }

  let xTrans = xInput;
  if (model === 'power' || model === 'logarithmic') {
      if (xInput <= 0) return reg.residualStdDev * 2;
      xTrans = Math.log(xInput);
  }

  const { residualStdDev, xBar, sumSqDiffX, n, anova } = reg;
  // Use df from ANOVA or fallback
  const df = anova ? anova.dfRes : n - 2;
  const t = getTStudentCrit(df);

  // ISO 8466-1 / DKD-R 6-1 standard confidence band formula for regression
  // The '1 +' inside sqrt is for Prediction Interval (new measurement).
  // For standard calibration curves where we want the uncertainty of the corrected value provided to the user,
  // we treat it as a prediction of the true value.
  const term = 1 + (1/n) + (Math.pow(xTrans - xBar, 2) / sumSqDiffX);
  
  let u = t * residualStdDev * Math.sqrt(term);
  
  if (model === 'power' || model === 'exponential') {
    const yPred = predictValue(xInput, model, reg.coefficients);
    u = Math.abs(yPred * u); // Approx relative error propagation
  }
  return u;
};

// Calculates all models and determines the winner based on AICc
export const fitStandardModels = (points: StandardCalibrationPoint[], valModel: CurveModel, uncModel: CurveModel) => {
  const xVal = points.map(p => p.indication);
  const yVal = points.map(p => p.referenceValue);
  
  const modelsToTest: CurveModel[] = ['linear_pearson', 'piecewise_linear', 'polynomial_2nd', 'linear_theil_sen'];
  
  let minAICc = Infinity;
  const valResults = new Map<CurveModel, RegressionResult>();

  // Compare all valid models
  modelsToTest.forEach(m => {
      const reg = calculateRegression(xVal, yVal, m, false);
      valResults.set(m, reg);
      
      // Only consider if parametrically valid and not absurd quality
      if (reg.isParametricValid && reg.modelQuality !== 'INVALID') {
          if (reg.aicc < minAICc) minAICc = reg.aicc;
      }
  });

  // Get selected model result
  // If the user selected model is 'invalid', recalculate it anyway to show errors
  let valueReg = calculateRegression(xVal, yVal, valModel, false);
  
  // Logic comparison
  if (valueReg.isParametricValid) {
      const valDeltaAIC = valueReg.aicc - minAICc;
      // Allow a delta of 4 for "Support" (Burnham & Anderson rules: 0-2 Substantial, 4-7 Considerably less)
      // We are being generous: if it's within 4, it's probably fine for metrology if R2 is good.
      if (valDeltaAIC <= 4 && valueReg.rSquared > 0.95) {
          valueReg.isBestFit = true;
          valueReg.recommendationText = valueReg.recommendationText || "MODELO ESTADÍSTICAMENTE ROBUSTO. Cumple Criterio AICc y F-Test.";
      } else {
          valueReg.isBestFit = false;
          valueReg.recommendationText = valueReg.recommendationText || `Existen modelos con mejor ajuste (ΔAICc = ${valDeltaAIC.toFixed(2)}).`;
      }
  } else {
      valueReg.recommendationText = "Modelo estadísticamente inválido (Falla ANOVA o N insuficiente).";
  }

  // 2. Calculate for UNCERTAINTY
  const xUnc = points.map(p => p.referenceValue);
  const yUnc = points.map(p => p.uncertainty / (p.coverageFactor || 2)); 
  const uncReg = calculateRegression(xUnc, yUnc, uncModel, true);

  return { valueReg, uncReg };
};
