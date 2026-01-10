
export type Theme = 'light' | 'dark';

export enum SequenceType {
  A = 'A', // High accuracy
  B = 'B', // Medium accuracy
  C = 'C'  // Low accuracy
}

export enum Unit {
  Bar = 'bar',
  Psi = 'psi',
  Pascal = 'Pa',
  KPa = 'kPa',
  MPa = 'MPa',
  HPa = 'hPa',
  MBar = 'mbar',
  Celcius = '°C',
  PercentRH = '%RH',
  Millimeter = 'mm',
  Centimeter = 'cm',
  Meter = 'm'
}

export enum StandardType {
  Pressure = 'pressure',
  AtmosphericPressure = 'atmospheric_pressure',
  Temperature = 'temperature',
  Humidity = 'humidity',
  Dimensional = 'dimensional',
  Thermohygrometer = 'thermohygrometer'
}

export enum CalibrationFluid {
  Air = 'air',
  Water = 'water',
  Oil = 'oil'
}

export type CurveModel = 
  | 'linear_pearson'    
  | 'linear_theil_sen'  
  | 'piecewise_linear' // Regresión Doble (Split)
  | 'polynomial_2nd' 
  | 'polynomial_3rd' 
  | 'power'             
  | 'exponential'       
  | 'logarithmic';

export type ProbabilityDistribution = 'Normal' | 'Rectangular' | 'Triangular' | 'U-Shaped';

export interface StandardCalibrationPoint {
  id: string;
  nominal: number;       
  indication: number;    
  referenceValue: number;
  uncertainty: number;
  coverageFactor: number;
  confidenceLevel: number;
  distribution: ProbabilityDistribution;
}

export interface CheckPointResult {
    nominal: number;
    readings: number[];
    mean: number;
    stdDev: number;
    range: number;
}

export interface IntermediateCheck {
  id: string;
  date: string;
  technician: string;
  results: CheckPointResult[];
  globalResult: 'PASS' | 'FAIL' | 'WARNING';
}

export interface StandardCheckConfig {
    checkPoints: number[];
    limits: {
        [nominal: number]: {
            ucl: number;
            lcl: number;
        }
    };
}

export interface AnovaResult {
  sse: number;
  ssr: number;
  sst: number;
  dfReg: number;
  dfRes: number;
  msReg: number;
  msRes: number;
  fStatistic: number;
  pValue?: number;
  recommendation?: string;
}

export interface RegressionResult {
  coefficients: number[]; 
  rSquared: number;
  residualStdDev: number; 
  equationString: string;
  validationSteps: string;
  xBar: number; 
  sumSqDiffX: number; 
  n: number;
  durbinWatson: number;
  anova?: AnovaResult;
  isParametricValid?: boolean;
  
  // Statistical Criteria
  aic: number;  // Akaike Information Criterion
  aicc: number; // Corrected AIC for small sample sizes
  bic: number;  // Bayesian Information Criterion

  // Recommendation Engine
  modelQuality: 'EXCELLENT' | 'GOOD' | 'POOR' | 'INVALID';
  recommendationText: string;
  isBestFit?: boolean;
}

export interface ReferenceStandard {
  id: string;
  type: StandardType;
  name: string;
  serialNumber: string;
  certificateNumber: string;
  calibratedBy: string;
  calibrationDate: string;
  expiryDate: string;
  rangeMin: number;
  rangeMax: number;
  unit: Unit;
  resolution: number; 
  valueModelType: CurveModel;
  valueRegression?: RegressionResult;
  uncertaintyModelType: CurveModel;
  uncertaintyRegression?: RegressionResult;
  calibrationPoints: StandardCalibrationPoint[];
  checkConfig?: StandardCheckConfig;
  intermediateChecks?: IntermediateCheck[]; 
}

export interface Instrument {
  manufacturer: string;
  model: string;
  serialNumber: string;
  applicantName: string;
  identificationId: string;
  rangeMin: number;
  rangeMax: number;
  resolution: number;
  accuracyClass: number; 
  unit: Unit;
  type: 'analog' | 'digital' | 'transmitter' | 'other';
  connectionType: string;
  sensorLocation: string;
  conditionReceived: string;
}

export interface CalibrationPoint {
  nominal: number;
  standardReading: number; 
  run1Up?: number;
  run1Down?: number;
  run2Up?: number;
  run2Down?: number;
}

export interface CalibrationResult {
  nominal: number;
  trueValue: number;      
  meanError: number;
  hysteresis: number;
  repeatability: number;
  expandedUncertainty: number;
  uncertaintyContributors: {
    ref: number; 
    model: number; 
    res: number; 
    rep: number; 
    hys: number;
  };
  compliance: boolean;
}

export interface EnvReading {
  temp: number;
  humidity: number;
  pressure: number;
}

export interface CIPMParams {
  moleFractionCO2: number;
  latitude: number;
  heightAboveSea: number;
}

export interface CalibrationSession {
  id: string;
  date: string;
  technician: string;
  standardId: string;
  envStandardId?: string;
  sequence: SequenceType;
  instrument: Instrument;
  envReadings: {
    start: EnvReading;
    middle: EnvReading;
    end: EnvReading;
  };
  fluid: CalibrationFluid;
  fluidDensity: number;
  cipmParams?: CIPMParams;
  heightDifference: number;
  gravityLocal?: number; 
  points: CalibrationPoint[];
  results?: CalibrationResult[];
}

export interface LaboratoryProfile {
    name: string;
    addressLine1: string;
    addressLine2: string;
    contactInfo: string;
    accreditationInfo?: string;
    logo?: string;
    isCustomized: boolean;
}
