export type FlowMode = 'pipe' | 'vortex' | 'sandbox';

export type ObstacleType =
  | 'cylinder'
  | 'airfoil'
  | 'square'
  | 'venturi'
  | 'wedge'
  | 'dual_cylinder'
  | 'flat_plate'
  | 'baffle'
  | 'porous_grid'
  | 'none';

export type ViewportLayout = 'standard' | 'wide' | 'fullscreen';

export type FluidPresetKey = 'air' | 'water' | 'oil' | 'glycerin' | 'custom';

export type FlowRegime = 'laminar' | 'transitional' | 'turbulent';

export type InteractiveTool = 'stir' | 'inject' | 'probe';

export interface FluidPhysicalParams {
  velocity: number;       // m/s (0.05 to 10.0)
  diameter: number;       // m (0.01 to 0.50)
  viscosity: number;      // Pa·s (1e-5 to 2.0)
  density: number;        // kg/m³ (1 to 1500)
  roughness: number;      // % (0 to 100)
  particleCount: number;  // count (500 to 8000)
}

export interface VisualizationLayers {
  showDye: boolean;
  showParticles: boolean;
  showVorticity: boolean;
  showVectors: boolean;
  showPressure: boolean;
  showRotationSpinners: boolean;
}

export interface VelocityProfilePoint {
  yNorm: number;          // -1 (bottom wall) to +1 (top wall)
  actualU: number;        // measured normalized horizontal velocity
  laminarTheoryU: number; // parabolic Poiseuille solution
  turbulentTheoryU: number; // 1/7th power law solution
}

export interface TelemetryData {
  reynolds: number;
  criticalReLower: number;
  criticalReUpper: number;
  regime: FlowRegime;
  inertialForce: number;      // ~ rho * v^2
  viscousForce: number;       // ~ mu * v / D
  inertialPercent: number;    // 0..100%
  viscousPercent: number;     // 0..100%
  turbulenceIntensity: number;// % (0 to 45%)
  wallShearStress: number;    // Pa
  frictionFactor: number;     // Darcy f
  strouhalNumber: number;     // dimensionless St
  sheddingFrequency: number;  // Hz
  probeX: number;             // 0..1
  probeY: number;             // 0..1
  probeU: number;             // m/s
  probeV: number;             // m/s
  probeSpeed: number;         // m/s
  probeVorticity: number;     // 1/s
  probePressure: number;      // Pa relative
  fps: number;
  simTime: number;            // seconds elapsed
  cfl: number;
}
