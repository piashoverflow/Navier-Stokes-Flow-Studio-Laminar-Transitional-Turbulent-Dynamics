import {
  FluidPhysicalParams,
  FlowMode,
  ObstacleType,
  TelemetryData,
  VelocityProfilePoint,
} from '../types/cfd';
import { NavierStokesSolver } from './NavierStokesSolver';

export class TelemetryEngine {
  private velocityHistory: number[] = [];
  private historySize = 60;

  public computeTelemetry(
    params: FluidPhysicalParams,
    mode: FlowMode,
    obstacle: ObstacleType,
    solver: NavierStokesSolver,
    probeX: number,
    probeY: number,
    fps: number,
    simTime: number
  ): { telemetry: TelemetryData; profilePoints: VelocityProfilePoint[] } {
    const rho = params.density;
    const v = params.velocity;
    const D = params.diameter;
    const mu = params.viscosity;

    // Reynolds Number calculation
    const reynolds = (rho * v * D) / (mu + 1e-12);

    // Regime thresholds depending on mode
    let criticalReLower = 2000;
    let criticalReUpper = 4000;

    if (mode === 'vortex' && obstacle === 'cylinder') {
      criticalReLower = 40;
      criticalReUpper = 350;
    } else if (mode === 'vortex' && obstacle === 'square') {
      criticalReLower = 50;
      criticalReUpper = 300;
    } else if (mode === 'vortex' && obstacle === 'airfoil') {
      criticalReLower = 100;
      criticalReUpper = 1200;
    }

    let regime: 'laminar' | 'transitional' | 'turbulent' = 'laminar';
    if (reynolds < criticalReLower) {
      regime = 'laminar';
    } else if (reynolds <= criticalReUpper) {
      regime = 'transitional';
    } else {
      regime = 'turbulent';
    }

    // Inertial vs Viscous Force Scales
    const inertialScale = rho * v * v;
    const viscousScale = (mu * v) / Math.max(0.001, D);
    const sumScale = inertialScale + viscousScale + 1e-12;
    const inertialPercent = Math.min(99.9, Math.max(0.1, (inertialScale / sumScale) * 100));
    const viscousPercent = 100 - inertialPercent;

    // Probe point sampling
    const probeSample = solver.sampleVelocity(probeX, probeY);
    const probeGridI = Math.min(solver.nx - 2, Math.max(1, Math.floor(probeX * solver.nx)));
    const probeGridJ = Math.min(solver.ny - 2, Math.max(1, Math.floor(probeY * solver.ny)));
    const probeIdx = solver.IX(probeGridI, probeGridJ);
    const probeVorticity = solver.vorticity[probeIdx];
    const probePressure = solver.pressure[probeIdx] * rho;

    // Turbulence Intensity tracking
    this.velocityHistory.push(probeSample.speed);
    if (this.velocityHistory.length > this.historySize) {
      this.velocityHistory.shift();
    }

    let meanSpeed = 0;
    for (let i = 0; i < this.velocityHistory.length; i++) {
      meanSpeed += this.velocityHistory[i];
    }
    meanSpeed = meanSpeed / Math.max(1, this.velocityHistory.length);

    let variance = 0;
    for (let i = 0; i < this.velocityHistory.length; i++) {
      const diff = this.velocityHistory[i] - meanSpeed;
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / Math.max(1, this.velocityHistory.length));
    
    // Theoretical baseline + actual fluctuation
    let baseIntensity = 0.5;
    if (regime === 'transitional') {
      baseIntensity = 3.5 + (params.roughness / 100) * 8.0;
    } else if (regime === 'turbulent') {
      baseIntensity = 8.0 + Math.min(25, Math.log10(reynolds + 1) * 3) + (params.roughness / 100) * 15;
    }
    const dynamicFluctuation = (stdDev / (meanSpeed + 1e-4)) * 100;
    const turbulenceIntensity = Math.min(45, Math.max(0.2, baseIntensity + dynamicFluctuation * 0.4));

    // Friction factor f and Wall Shear Stress
    let frictionFactor = 0.02;
    if (regime === 'laminar') {
      frictionFactor = Math.min(0.5, 64 / Math.max(1, reynolds));
    } else if (regime === 'transitional') {
      const fLam = 64 / Math.max(1, criticalReLower);
      const fTurb = 0.3164 * Math.pow(criticalReUpper, -0.25);
      const tRatio = (reynolds - criticalReLower) / (criticalReUpper - criticalReLower);
      frictionFactor = fLam + tRatio * (fTurb - fLam);
    } else {
      // Blasius formula for turbulent flow + roughness correction
      const smoothF = 0.3164 * Math.pow(Math.max(4000, reynolds), -0.25);
      const roughF = 0.25 / Math.pow(Math.log10(Math.max(1e-4, params.roughness / 1000) / 3.7 + 5.74 / Math.pow(reynolds, 0.9)), 2);
      frictionFactor = Math.min(0.12, Math.max(0.015, smoothF + (roughF - smoothF) * (params.roughness / 100)));
    }
    const wallShearStress = (frictionFactor / 8) * rho * v * v;

    // Strouhal number and Shedding Frequency
    let strouhalNumber = 0.21;
    let sheddingFrequency = 0;
    if (mode === 'vortex' || obstacle !== 'none') {
      if (reynolds > 40) {
        // Fey / Roshko empirical curve for circular cylinder
        strouhalNumber = 0.212 * (1 - 21.2 / Math.max(40.1, reynolds));
        strouhalNumber = Math.max(0.12, Math.min(0.24, strouhalNumber));
        sheddingFrequency = (strouhalNumber * v) / Math.max(0.01, D);
      }
    }

    // CFL Number: cfl = u * dt / dx
    const cfl = (Math.max(v, probeSample.speed) * solver.dt) / solver.h;

    // -------------------------------------------------------------
    // Velocity Profile Points across sensor line probeX
    // -------------------------------------------------------------
    const profilePoints: VelocityProfilePoint[] = [];
    const numSamples = 31;
    const sensorI = Math.min(solver.nx - 2, Math.max(1, Math.floor(probeX * solver.nx)));
    
    // Find maximum velocity along profile to normalize
    let maxMeasuredU = 0.001;
    for (let k = 0; k < numSamples; k++) {
      const yRatio = k / (numSamples - 1);
      const sample = solver.sampleVelocity(probeX, yRatio);
      if (sample.u > maxMeasuredU) maxMeasuredU = sample.u;
    }

    for (let k = 0; k < numSamples; k++) {
      const yNorm = (k / (numSamples - 1)) * 2 - 1; // -1 to +1
      const yRatio = k / (numSamples - 1);
      const sample = solver.sampleVelocity(probeX, yRatio);

      // Check if inside wall or solid
      const sampleJ = Math.floor(yRatio * solver.ny);
      const isSolid = solver.solid[solver.IX(sensorI, sampleJ)] === 1;

      const actualU = isSolid ? 0 : Math.max(0, sample.u);

      // Theoretical Laminar Poiseuille Parabola: u(r) = u_max * (1 - (r/R)^2)
      const rRatio = Math.abs(yNorm);
      const laminarTheoryU = isSolid ? 0 : v * 1.5 * Math.max(0, 1 - rRatio * rRatio);

      // Theoretical Turbulent 1/7th Power Law: u(y) = u_max * (dist_to_wall / R)^(1/7)
      const distFromWall = Math.max(0, 1 - rRatio);
      const turbulentTheoryU = isSolid ? 0 : v * 1.2 * Math.pow(distFromWall, 1 / 7);

      profilePoints.push({
        yNorm,
        actualU,
        laminarTheoryU,
        turbulentTheoryU,
      });
    }

    const telemetry: TelemetryData = {
      reynolds,
      criticalReLower,
      criticalReUpper,
      regime,
      inertialForce: inertialScale,
      viscousForce: viscousScale,
      inertialPercent,
      viscousPercent,
      turbulenceIntensity,
      wallShearStress,
      frictionFactor,
      strouhalNumber,
      sheddingFrequency,
      probeX,
      probeY,
      probeU: probeSample.u,
      probeV: probeSample.v,
      probeSpeed: probeSample.speed,
      probeVorticity,
      probePressure,
      fps,
      simTime,
      cfl,
    };

    return { telemetry, profilePoints };
  }
}
