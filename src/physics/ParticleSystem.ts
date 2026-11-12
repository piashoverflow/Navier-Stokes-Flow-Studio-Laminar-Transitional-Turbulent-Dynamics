import { NavierStokesSolver } from './NavierStokesSolver';

export interface Particle {
  x: number;      // 0..1
  y: number;      // 0..1
  vx: number;     // current velocity x
  vy: number;     // current velocity y
  speed: number;  // magnitude
  age: number;    // frames alive
  maxAge: number; // lifetime
  historyX: Float32Array; // short trail
  historyY: Float32Array;
  trailLen: number;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public maxParticles: number = 4000;
  private trailMax: number = 6;

  constructor(count = 3500) {
    this.maxParticles = count;
    this.initParticles();
  }

  public setCount(count: number) {
    this.maxParticles = count;
    if (this.particles.length > count) {
      this.particles.length = count;
    } else {
      while (this.particles.length < count) {
        this.particles.push(this.createParticle(Math.random(), Math.random(), true));
      }
    }
  }

  public initParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      // Seed randomly throughout the domain initially
      this.particles.push(this.createParticle(Math.random(), Math.random(), true));
    }
  }

  private createParticle(x?: number, y?: number, randomAge = false): Particle {
    const px = x !== undefined ? x : 0.01 + Math.random() * 0.05;
    // Concentrate some near inlet centerlines
    const py = y !== undefined ? y : 0.08 + Math.random() * 0.84;
    const maxAge = 250 + Math.floor(Math.random() * 300);

    const historyX = new Float32Array(this.trailMax);
    const historyY = new Float32Array(this.trailMax);
    historyX.fill(px);
    historyY.fill(py);

    return {
      x: px,
      y: py,
      vx: 0,
      vy: 0,
      speed: 0,
      age: randomAge ? Math.floor(Math.random() * maxAge) : 0,
      maxAge,
      historyX,
      historyY,
      trailLen: 0,
    };
  }

  public update(solver: NavierStokesSolver, dt: number) {
    const particles = this.particles;
    const len = particles.length;
    const trailMax = this.trailMax;

    for (let i = 0; i < len; i++) {
      const p = particles[i];

      // Update trail history
      for (let t = trailMax - 1; t > 0; t--) {
        p.historyX[t] = p.historyX[t - 1];
        p.historyY[t] = p.historyY[t - 1];
      }
      p.historyX[0] = p.x;
      p.historyY[0] = p.y;
      if (p.trailLen < trailMax) p.trailLen++;

      // RK2 Integration (Midpoint method):
      // Step 1: Evaluate velocity at current position
      const v1 = solver.sampleVelocity(p.x, p.y);
      const k1x = v1.u * 0.6; // normalized speed factor
      const k1y = v1.v * 0.6;

      // Midpoint position
      const midX = p.x + 0.5 * k1x * dt;
      const midY = p.y + 0.5 * k1y * dt;

      // Step 2: Evaluate velocity at midpoint
      const v2 = solver.sampleVelocity(midX, midY);
      p.vx = v2.u;
      p.vy = v2.v;
      p.speed = v2.speed;

      // Final position update
      p.x += v2.u * 0.6 * dt;
      p.y += v2.v * 0.6 * dt;
      p.age++;

      // Check boundaries & solid collisions
      let respawn = false;

      // Left/Right exits
      if (p.x >= 0.99 || p.x < 0.005) {
        respawn = true;
      }

      // Top/Bottom boundaries
      if (solver.mode === 'pipe') {
        if (p.y <= 0.04 || p.y >= 0.96) {
          respawn = true;
        }
      } else {
        if (p.y <= 0.02 || p.y >= 0.98) {
          respawn = true;
        }
      }

      // Solid collision check
      const gridI = Math.floor(p.x * solver.nx);
      const gridJ = Math.floor(p.y * solver.ny);
      if (
        gridI >= 0 &&
        gridI < solver.nx &&
        gridJ >= 0 &&
        gridJ < solver.ny
      ) {
        if (solver.solid[solver.IX(gridI, gridJ)] === 1) {
          respawn = true;
        }
      }

      // Age expiry
      if (p.age >= p.maxAge) {
        respawn = true;
      }

      if (respawn) {
        // Re-inject at inlet
        p.x = 0.005 + Math.random() * 0.03;
        // Bias slightly towards streamline ribbons for beautiful laminar banding
        if (Math.random() < 0.65) {
          const ribbon = Math.floor(Math.random() * 7);
          p.y = 0.12 + (ribbon / 6) * 0.76 + (Math.random() - 0.5) * 0.04;
        } else {
          p.y = 0.06 + Math.random() * 0.88;
        }
        p.age = 0;
        p.trailLen = 0;
        p.historyX.fill(p.x);
        p.historyY.fill(p.y);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    regime: 'laminar' | 'transitional' | 'turbulent'
  ) {
    const particles = this.particles;
    const len = particles.length;

    ctx.save();
    ctx.lineWidth = 1.2;

    // Draw particle streaks
    for (let i = 0; i < len; i++) {
      const p = particles[i];
      if (p.trailLen < 2) continue;

      const px = p.x * width;
      const py = p.y * height;

      // Color mapping based on velocity and regime
      const speedNorm = Math.min(1.0, p.speed / 2.0);
      let strokeColor: string;
      let alpha = Math.min(0.85, (1 - p.age / p.maxAge) * 0.9);

      if (regime === 'laminar') {
        // Crisp teal / emerald streamlines
        strokeColor = `rgba(16, 185, 129, ${alpha * 0.75})`;
      } else if (regime === 'transitional') {
        // Vibrant cyan to amber dynamic
        if (speedNorm > 0.6) {
          strokeColor = `rgba(245, 158, 11, ${alpha * 0.8})`;
        } else {
          strokeColor = `rgba(6, 182, 212, ${alpha * 0.75})`;
        }
      } else {
        // Turbulent: high-contrast multi-colored fiery / electric tracers
        if (speedNorm > 0.7) {
          strokeColor = `rgba(239, 68, 68, ${alpha * 0.85})`;
        } else if (speedNorm > 0.35) {
          strokeColor = `rgba(249, 115, 22, ${alpha * 0.8})`;
        } else {
          strokeColor = `rgba(59, 130, 246, ${alpha * 0.75})`;
        }
      }

      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.moveTo(p.historyX[0] * width, p.historyY[0] * height);
      for (let t = 1; t < p.trailLen; t++) {
        ctx.lineTo(p.historyX[t] * width, p.historyY[t] * height);
      }
      ctx.stroke();

      // Lead particle dot
      ctx.fillStyle = regime === 'laminar' ? '#047857' : (regime === 'transitional' ? '#0284c7' : '#dc2626');
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
