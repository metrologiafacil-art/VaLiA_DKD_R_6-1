
import { IntermediateCheck, RegressionResult, AnovaResult, CurveModel, StandardCalibrationPoint, ValidationStepResult, RegressionValidation } from '../types';

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

const getTStudentCrit = (df: number): number => {
    if (df <= 1) return 12.706; if (df <= 2) return 4.303; if (df <= 3) return 3.182;
    if (df <= 4) return 2.776; if (df <= 5) return 2.571; if (df <= 10) return 2.228;
    if (df <= 20) return 2.086; if (df <= 60) return 2.000; return 1.960;
};

const getFCrit = (df2: number, df1: number = 1): number => {
    if (df1 === 1) {
        if (df2 <= 1) return 161.45; if (df2 <= 2) return 18.51; if (df2 <= 3) return 10.13;
        if (df2 <= 4) return 7.71; if (df2 <= 5) return 6.61; if (df2 <= 10) return 4.96;
        if (df2 <= 20) return 4.35; if (df2 <= 60) return 4.00; return 3.84;
    }
    return 3.00; 
};

const calculateAIC = (n: number, k: number, sse: number) => {
    if (sse <= 1e-15) sse = 1e-15; 
    const aic = n * Math.log(sse / n) + 2 * k;
    const aicc = aic + (2 * k * (k + 1)) / (n - k - 1);
    const bic = n * Math.log(sse / n) + k * Math.log(n);
    return { aic, aicc, bic };
};

// --- ROBUST STATISTICS (NON-PARAMETRIC) ---

// Spearman Rank Correlation for Theil-Sen
function calculateSpearmanRank(x: number[], y: number[]): ValidationStepResult {
    const n = x.length;
    if (n < 3) return { passed: false, label: 'Corr. Spearman', statisticName: 'rho', statisticValue: 0, criticalValue: 0, details: 'N < 3', isNotApplicable: false };

    const getRanks = (arr: number[]) => {
        const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
        const ranks = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            let j = i;
            while (j < n - 1 && sorted[j + 1].v === sorted[j].v) j++;
            const rank = (i + j) / 2 + 1;
            for (let k = i; k <= j; k++) ranks[sorted[k].i] = rank;
            i = j;
        }
        return ranks;
    };

    const xRanks = getRanks(x);
    const yRanks = getRanks(y);

    let d2Sum = 0;
    for (let i = 0; i < n; i++) d2Sum += Math.pow(xRanks[i] - yRanks[i], 2);

    const rho = 1 - (6 * d2Sum) / (n * (n * n - 1));
    const tCalc = Math.abs(rho) * Math.sqrt((n - 2) / (1 - rho * rho));
    const tCrit = getTStudentCrit(n - 2);
    const passed = tCalc > tCrit;

    return {
        passed,
        label: 'Correlación de Spearman (No Paramétrica)',
        statisticName: 'rho',
        statisticValue: parseFloat(rho.toFixed(4)),
        criticalValue: tCrit, 
        details: passed ? `Asociación monótona significativa (t=${tCalc.toFixed(2)})` : `Sin asociación significativa`,
        isNotApplicable: false
    };
}

function erf(x: number) {
  const a1 =  0.254829592; const a2 = -0.284496736; const a3 =  1.421413741;
  const a4 = -1.453152027; const a5 =  1.061405429; const p  =  0.3275911;
  let sign = 1; if (x < 0) sign = -1; x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(x: number, mean: number, std: number): number {
    const z = (x - mean) / (std * Math.SQRT2);
    return 0.5 * (1 + erf(z));
}

// Anderson-Darling for Parametric Models
function calculateAndersonDarling(data: number[]): ValidationStepResult {
    const n = data.length;
    if (n < 3) return { passed: false, label: 'Anderson-Darling', statisticName: 'A²', statisticValue: 0, criticalValue: 0, details: 'N insuficiente (<3)' };

    const mean = data.reduce((a, b) => a + b, 0) / n;
    const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const std = Math.sqrt(variance);
    const sorted = [...data].sort((a, b) => a - b);
    
    let sum = 0;
    for (let i = 0; i < n; i++) {
        let cdf_i = normalCDF(sorted[i], mean, std);
        let cdf_rev = normalCDF(sorted[n - 1 - i], mean, std);
        if(cdf_i <= 0) cdf_i = 1e-15; if(cdf_i >= 1) cdf_i = 1 - 1e-15;
        if(cdf_rev <= 0) cdf_rev = 1e-15; if(cdf_rev >= 1) cdf_rev = 1 - 1e-15;
        sum += (2 * (i + 1) - 1) * (Math.log(cdf_i) + Math.log(1 - cdf_rev));
    }

    let A2 = -n - (sum / n);
    const A2_adj = A2 * (1 + 0.75/n + 2.25/(n*n));
    const criticalValue = 0.752; 
    const passed = A2_adj < criticalValue;

    return {
        passed,
        label: 'Prueba de Normalidad (Anderson-Darling)',
        statisticName: 'A²*',
        statisticValue: parseFloat(A2_adj.toFixed(4)),
        criticalValue,
        details: passed ? 'Distribución Normal' : 'No Normal'
    };
}

function calculateCorrelationSignificance(r: number, n: number): ValidationStepResult {
    if (n < 3) return { passed: false, label: 'Significancia Correlación', statisticName: 't', statisticValue: 0, criticalValue: 0, details: 'N insuficiente' };
    if (Math.abs(r) >= 0.999999) return { passed: true, label: 'Correlación', statisticName: 't', statisticValue: 999, criticalValue: 0, details: 'Correlación perfecta' };

    const tCalc = Math.abs(r) * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
    const tCrit = getTStudentCrit(n - 2);
    const passed = tCalc > tCrit;

    return {
        passed,
        label: 'Prueba de Correlación (t-Student)',
        statisticName: 't_calc',
        statisticValue: parseFloat(tCalc.toFixed(4)),
        criticalValue: tCrit,
        details: passed ? `Significativa` : `No Significativa`
    };
}

function calculateIndependenceTest(yPred: number[], residuals: number[]): ValidationStepResult {
    const n = yPred.length;
    if (n < 3) return { passed: false, label: 'Independencia Residuos', statisticName: 't', statisticValue: 0, criticalValue: 0, details: 'N insuficiente' };

    const meanY = yPred.reduce((a,b)=>a+b,0)/n;
    const meanR = residuals.reduce((a,b)=>a+b,0)/n;
    let num = 0, den1 = 0, den2 = 0;
    for(let i=0; i<n; i++){
        num += (yPred[i] - meanY) * (residuals[i] - meanR);
        den1 += Math.pow(yPred[i] - meanY, 2);
        den2 += Math.pow(residuals[i] - meanR, 2);
    }
    
    let r = 0;
    if(den1 > 0 && den2 > 0) r = num / Math.sqrt(den1 * den2);
    
    const tCalc = Math.abs(r) * Math.sqrt(n - 2) / Math.sqrt(1 - r * r || 1); 
    const tCrit = getTStudentCrit(n - 2);
    const passed = tCalc < tCrit;

    return {
        passed,
        label: 'Independencia (Residuos vs Ajuste)',
        statisticName: 't_corr',
        statisticValue: parseFloat(tCalc.toFixed(4)),
        criticalValue: tCrit,
        details: passed ? 'Independientes' : 'Dependientes'
    };
}

const calculateMandelTest = (x: number[], y: number[]): ValidationStepResult => {
    const n = x.length;
    if (n < 4) return { passed: true, label: 'Test Mandel', statisticName: 'F', statisticValue: 0, criticalValue: 0, details: 'N < 4' };

    const regLin = calculateRegression(x, y, 'linear_pearson', false, { low: 'linear_pearson', high: 'linear_pearson' }, true);
    const ssResLin = regLin.anova ? regLin.anova.sse : 0; 
    const regQuad = calculateRegression(x, y, 'polynomial_2nd');
    const ssResQuad = regQuad.anova ? regQuad.anova.sse : 0;
    const dfQuad = n - 3;
    
    const diffSS = ssResLin - ssResQuad; 
    const msDiff = diffSS / 1;
    const msQuad = ssResQuad / dfQuad;
    
    if (msQuad < 1e-15) return { passed: false, label: 'Test de Mandel', statisticName: 'F', statisticValue: 9999, criticalValue: getFCrit(dfQuad, 1), details: 'Ajuste cuadrático perfecto' };

    const fCalc = msDiff / msQuad;
    const fCrit = getFCrit(dfQuad, 1); 
    const passed = fCalc <= fCrit;

    return {
        passed,
        label: 'Test de Mandel (Linealidad ISO 8466)',
        statisticName: 'F',
        statisticValue: parseFloat(fCalc.toFixed(4)),
        criticalValue: fCrit,
        details: passed ? 'Linealidad aceptada' : 'No lineal'
    };
};

// --- MAIN REGRESSION FUNCTION ---

export const calculateRegression = (
    x: number[], 
    y: number[], 
    type: CurveModel, 
    isUncertaintyModel: boolean = false, 
    subModels: { low: CurveModel, high: CurveModel } = { low: 'linear_pearson', high: 'linear_pearson' },
    skipMandel: boolean = false
): RegressionResult => {
  let stepText = `ANÁLISIS DE REGRESIÓN Y VALIDACIÓN\n`;
  
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

  // --- PIECEWISE MIXED MODEL (REGRESIÓN DOBLE FLEXIBLE) ---
  if (type === 'piecewise_mixed') {
      stepText += `MÉTODO: REGRESIÓN DOBLE FLEXIBLE (SPLIT)\n`;
      
      // Calculate split index (middle)
      const mid = Math.floor(n / 2);
      let endIdx1 = mid + 1;
      let startIdx2 = mid - 1;
      
      // Overlap adjustments
      if (n <= 4) {
           return calculateRegression(x, y, 'linear_pearson', isUncertaintyModel);
      } else {
           if (startIdx2 < 0) startIdx2 = 0;
           if (endIdx1 >= n) endIdx1 = n - 1;
           // Force min 3 points per side if possible
           if (endIdx1 < 2) endIdx1 = 2;
           if (startIdx2 > n - 3) startIdx2 = n - 3;
      }

      const x1 = xFiltered.slice(0, endIdx1 + 1);
      const y1 = yFiltered.slice(0, endIdx1 + 1);
      const x2 = xFiltered.slice(startIdx2);
      const y2 = yFiltered.slice(startIdx2);

      // Recursive call for sub-models
      const type1 = subModels.low === 'piecewise_mixed' ? 'linear_pearson' : subModels.low;
      const type2 = subModels.high === 'piecewise_mixed' ? 'linear_pearson' : subModels.high;

      const r1 = calculateRegression(x1, y1, type1, isUncertaintyModel, {low:'linear_pearson', high:'linear_pearson'}, true);
      const r2 = calculateRegression(x2, y2, type2, isUncertaintyModel, {low:'linear_pearson', high:'linear_pearson'}, true);

      // Split Limit Logic
      const splitStart = xFiltered[startIdx2];
      const splitEnd = xFiltered[endIdx1];
      
      let ssTot = 0;
      let ssRes = 0;
      const globalMean = yFiltered.reduce((a,b)=>a+b,0)/n;
      
      yFiltered.forEach((yi, i) => {
          const xi = xFiltered[i];
          let yPred = 0;
          if (xi <= splitStart) yPred = predictValue(xi, type1, r1.coefficients);
          else if (xi >= splitEnd) yPred = predictValue(xi, type2, r2.coefficients);
          else {
              // Interpolation in overlap
              const y1p = predictValue(xi, type1, r1.coefficients);
              const y2p = predictValue(xi, type2, r2.coefficients);
              const alpha = (xi - splitStart) / (splitEnd - splitStart);
              yPred = (1 - alpha) * y1p + alpha * y2p;
          }
          ssRes += Math.pow(yi - yPred, 2);
          ssTot += Math.pow(yi - globalMean, 2);
      });

      const rSquared = 1 - (ssRes / (ssTot || 1));
      const k_split = r1.coefficients.length + r2.coefficients.length + 1; 
      const { aic, aicc, bic } = calculateAIC(n, k_split, ssRes);

      return {
          coefficients: [], 
          rSquared,
          residualStdDev: Math.sqrt(ssRes/(n - 4)), 
          equationString: `Split: [${type1}] / [${type2}]`,
          validationSteps: stepText,
          xBar: 0, sumSqDiffX: 0, n, durbinWatson: 2, 
          aic, aicc, bic,
          modelQuality: rSquared > 0.99 ? 'EXCELLENT' : 'GOOD',
          recommendationText: "Modelo optimizado flexible (Mixed Split).",
          isParametricValid: true,
          subModels: {
              low: { type: type1, coeffs: r1.coefficients, limit: splitEnd },
              high: { type: type2, coeffs: r2.coefficients, limit: splitStart }
          }
      };
  }

  // --- STANDARD MODELS ---
  let coeffs: number[] = [];
  let residuals: number[] = [];
  let yPreds: number[] = [];
  let ssRes = 0; 
  let numParams = 2;
  const isNonParametric = type === 'linear_theil_sen';
  
  let xCalc = [...xFiltered];
  let yCalc = [...yFiltered];

  if (type === 'power') { xCalc = xFiltered.map(Math.log); yCalc = yFiltered.map(Math.log); } 
  else if (type === 'exponential') { yCalc = yFiltered.map(Math.log); } 
  else if (type === 'logarithmic') { xCalc = xFiltered.map(Math.log); }

  let eqStr = "";

  if (type.includes('polynomial')) {
    const order = type === 'polynomial_3rd' ? 3 : 2;
    numParams = order + 1; 
    const m = order + 1;
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
      yPreds.push(pred);
      return yi - pred;
    });
    
    eqStr = "y = " + coeffs.map((c, i) => {
        if(i===0) return c.toExponential(3);
        const val = Math.abs(c).toExponential(3);
        const sign = c >= 0 ? " + " : " - ";
        if(i===1) return `${sign}${val}x`;
        return `${sign}${val}x^${i}`;
    }).join("");

  } else if (type === 'linear_theil_sen') {
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
    residuals = yCalc.map((yi, i) => {
        const pred = intercept + slope * xCalc[i];
        yPreds.push(pred);
        return yi - pred;
    });
    eqStr = `y = ${coeffs[1].toExponential(4)}x ${coeffs[0] >= 0 ? '+' : '-'} ${Math.abs(coeffs[0]).toExponential(4)}`;

  } else {
    // Least Squares
    const sumX = xCalc.reduce((a, b) => a + b, 0);
    const sumY = yCalc.reduce((a, b) => a + b, 0);
    const sumXY = xCalc.reduce((s, xi, i) => s + xi * yCalc[i], 0);
    const sumXX = xCalc.reduce((s, xi) => s + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    coeffs = [intercept, slope];
    if (type === 'power' || type === 'exponential') coeffs[0] = Math.exp(intercept);
    
    residuals = yCalc.map((yi, i) => {
        const pred = intercept + slope * xCalc[i];
        yPreds.push(pred);
        return yi - pred;
    });
    
    const c0 = coeffs[0];
    const c1 = coeffs[1];
    if (type === 'linear_pearson') eqStr = `y = ${c1.toExponential(4)}x ${c0 >= 0 ? '+' : '-'} ${Math.abs(c0).toExponential(4)}`;
    else if (type === 'power') eqStr = `y = ${c0.toExponential(4)} · x^${c1.toExponential(4)}`;
    else if (type === 'exponential') eqStr = `y = ${c0.toExponential(4)} · e^(${c1.toExponential(4)}x)`;
    else if (type === 'logarithmic') eqStr = `y = ${c0.toExponential(4)} ${c1 >= 0 ? '+' : '-'} ${Math.abs(c1).toExponential(4)} · ln(x)`;
    else eqStr = type;
  }

  // Stats
  ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const meanY = yCalc.reduce((a, b) => a + b, 0) / n;
  const ssTot = yCalc.reduce((s, yi) => s + Math.pow(yi - meanY, 2), 0);
  const rSquared = 1 - (ssRes / (ssTot || 1)); 
  const dfRes = n - numParams;
  const residualStdDev = Math.sqrt(ssRes / (dfRes > 0 ? dfRes : 1));
  
  const ssReg = ssTot - ssRes;
  const dfReg = numParams - 1;
  const msReg = ssReg / (dfReg || 1);
  const msRes = ssRes / (dfRes || 1);
  const fCalc = msReg / msRes;

  const fCrit = getFCrit(dfRes, dfReg);
  const durbinWatson = calculateDurbinWatson(residuals);

  const k_aic = numParams + 1;
  const { aic, aicc, bic } = calculateAIC(n, k_aic, ssRes);

  let isValid = fCalc > fCrit;
  if (isNonParametric) isValid = true; 

  // --- VALIDATION LOGIC REWRITE ---
  const notApplicable: ValidationStepResult = { passed: true, label: '', statisticName: 'N/A', statisticValue: 0, criticalValue: 0, details: 'No aplica (No Paramétrico)', isNotApplicable: true };

  const validation: RegressionValidation = {
      // Step 1: Correlation (Spearman for Theil-Sen, Pearson for others)
      correlation: isNonParametric 
          ? calculateSpearmanRank(xCalc, yCalc)
          : calculateCorrelationSignificance(Math.sqrt(rSquared), n),
      
      // Step 2 & 5: Normality (Skip for Theil-Sen)
      normalityX: isNonParametric ? { ...notApplicable, label: 'Normalidad en X' } : calculateAndersonDarling(xCalc),
      normalityY: isNonParametric ? { ...notApplicable, label: 'Normalidad en Y' } : calculateAndersonDarling(yCalc),
      normalityResiduals: isNonParametric ? { ...notApplicable, label: 'Normalidad Residuos' } : calculateAndersonDarling(residuals),

      // Step 3 & 4: Model Significance & Independence
      modelSignificance: isNonParametric 
          ? { ...notApplicable, label: 'Significancia del Modelo (F-Test)' } 
          : {
              passed: fCalc > fCrit,
              label: 'Significancia del Modelo (F-Test)',
              statisticName: 'F',
              statisticValue: parseFloat(fCalc.toFixed(4)),
              criticalValue: fCrit,
              details: (fCalc > fCrit) ? 'Modelo significativo' : 'No significativo'
          },
      independence: isNonParametric 
          ? { ...notApplicable, label: 'Independencia Residuos' }
          : calculateIndependenceTest(yPreds, residuals),
  };

  if (type === 'linear_pearson' && n >= 4 && !skipMandel) {
      validation.mandelLinearity = calculateMandelTest(xFiltered, yFiltered);
  }

  let modelQuality: 'EXCELLENT'|'GOOD'|'POOR'|'INVALID' = 'GOOD';
  let recommendationText = "Modelo válido.";

  if (isNonParametric) {
      if (!validation.correlation.passed) {
          modelQuality = 'POOR';
          recommendationText = "Correlación de rangos no significativa.";
      } else {
          modelQuality = 'GOOD';
          recommendationText = "Modelo robusto no paramétrico. Supuestos de normalidad no requeridos.";
      }
  } else {
      if (!validation.modelSignificance.passed) {
          modelQuality = 'INVALID';
          recommendationText = "El modelo no es significativo (F-Test).";
      } else if (validation.mandelLinearity && !validation.mandelLinearity.passed) {
          modelQuality = 'POOR';
          recommendationText = "Test de Mandel sugiere no linealidad.";
      } else if (rSquared > 0.999) {
          modelQuality = 'EXCELLENT';
      }
  }

  const xBar = xCalc.reduce((a,b)=>a+b,0) / n;
  const sumSqDiffX = xCalc.reduce((s, xi) => s + Math.pow(xi - xBar, 2), 0);

  return {
    coefficients: coeffs,
    rSquared,
    residualStdDev,
    equationString: eqStr,
    validationSteps: stepText,
    extendedValidation: validation, 
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

export const predictValue = (xInput: number, model: CurveModel, coeffs: number[], subModels?: any): number => {
  if (model === 'piecewise_mixed' && subModels) {
      const low = subModels.low;
      const high = subModels.high;
      const splitStart = high.limit; 
      const splitEnd = low.limit;

      if (xInput <= splitStart) return predictValue(xInput, low.type, low.coeffs);
      if (xInput >= splitEnd) return predictValue(xInput, high.type, high.coeffs);
      
      const y1 = predictValue(xInput, low.type, low.coeffs);
      const y2 = predictValue(xInput, high.type, high.coeffs);
      
      // Interpolation logic for smooth transition
      const alpha = (xInput - splitStart) / (splitEnd - splitStart);
      return (1 - alpha) * y1 + alpha * y2;
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

  if (model === 'piecewise_mixed' && reg.subModels) {
      // Conservative estimate for split models
      return reg.residualStdDev; 
  }

  let xTrans = xInput;
  if (model === 'power' || model === 'logarithmic') {
      if (xInput <= 0) return reg.residualStdDev * 2;
      xTrans = Math.log(xInput);
  }

  const { residualStdDev, xBar, sumSqDiffX, n, anova } = reg;
  // If Anova is undefined (Theil-Sen), use n-2
  const df = anova ? anova.dfRes : n - 2;
  const t = getTStudentCrit(df);

  if (sumSqDiffX === 0) return residualStdDev;

  const term = 1 + (1/n) + (Math.pow(xTrans - xBar, 2) / sumSqDiffX);
  let u = t * residualStdDev * Math.sqrt(term);
  
  if (model === 'power' || model === 'exponential') {
    const yPred = predictValue(xInput, model, reg.coefficients);
    u = Math.abs(yPred * u);
  }
  return u;
};

export const fitStandardModels = (
    points: StandardCalibrationPoint[], 
    valModel: CurveModel, 
    uncModel: CurveModel,
    valSubModels: { low: CurveModel, high: CurveModel } = { low: 'linear_pearson', high: 'linear_pearson' },
    uncSubModels: { low: CurveModel, high: CurveModel } = { low: 'linear_pearson', high: 'linear_pearson' }
) => {
  const xVal = points.map(p => p.indication);
  const yVal = points.map(p => p.referenceValue);
  
  let minAICc = Infinity;

  // Auto-compare basic models for recommendation
  ['linear_pearson', 'polynomial_2nd'].forEach(m => {
      const reg = calculateRegression(xVal, yVal, m as CurveModel, false);
      if (reg.isParametricValid && reg.modelQuality !== 'INVALID') {
          if (reg.aicc < minAICc) minAICc = reg.aicc;
      }
  });

  // Calculate Selected Value Model
  // Important: Pass submodels configuration!
  let valueReg = calculateRegression(xVal, yVal, valModel, false, valSubModels);
  
  if (valueReg.isParametricValid && valModel !== 'piecewise_mixed' && valModel !== 'linear_theil_sen') {
      const valDeltaAIC = valueReg.aicc - minAICc;
      if (valDeltaAIC <= 4 && valueReg.rSquared > 0.95) {
          valueReg.isBestFit = true;
          valueReg.recommendationText = valueReg.recommendationText || "MODELO ESTADÍSTICAMENTE ROBUSTO.";
      } else {
          valueReg.isBestFit = false;
          valueReg.recommendationText = valueReg.recommendationText || `Existen modelos con mejor ajuste (ΔAICc = ${valDeltaAIC.toFixed(2)}).`;
      }
  }

  // Calculate Selected Uncertainty Model
  const xUnc = points.map(p => p.referenceValue);
  const yUnc = points.map(p => p.uncertainty / (p.coverageFactor || 2)); 
  const uncReg = calculateRegression(xUnc, yUnc, uncModel, true, uncSubModels);

  return { valueReg, uncReg };
};
