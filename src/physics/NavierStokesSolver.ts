import { FlowMode, ObstacleType } from '../types/cfd';

export class NavierStokesSolver {
  public nx: number;
  public ny: number;
  public size: number;
  public h: number; // grid cell spacing

  // Velocity fields
  public u: Float32Array;
  public v: Float32Array;
  public u_prev: Float32Array;
  public v_prev: Float32Array;

  // Scalar fields
  public dye: Float32Array;
  public dye_prev: Float32Array;
  public pressure: Float32Array;
  public divergence: Float32Array;
  public vorticity: Float32Array;

  // Obstacle / boundary flags
  public solid: Uint8Array; // 1 if solid, 0 if fluid

  // Physical parameters
  public dt: number = 0.02;
  public density: number = 1000;      // kg/m³
  public dynamicViscosity: number = 0.001; // Pa·s
  public kinematicViscosity: number = 1e-6; // m²/s
  public inletVelocity: number = 1.0;  // m/s
  public roughness: number = 0.0;      // 0..1
  public mode: FlowMode = 'pipe';
  public obstacleType: ObstacleType = 'none';

  // Obstacle geometry parameters (normalized 0..1)
  public obstacleX: number = 0.28;
  public obstacleY: number = 0.50;
  public obstacleRadius: number = 0.08;

  constructor(nx = 160, ny = 80) {
    this.nx = nx;
    this.ny = ny;
    this.size = nx * ny;
    this.h = 1.0 / ny;

    this.u = new Float32Array(this.size);
    this.v = new Float32Array(this.size);
    this.u_prev = new Float32Array(this.size);
    this.v_prev = new Float32Array(this.size);

    this.dye = new Float32Array(this.size);
    this.dye_prev = new Float32Array(this.size);
    this.pressure = new Float32Array(this.size);
    this.divergence = new Float32Array(this.size);
    this.vorticity = new Float32Array(this.size);

    this.solid = new Uint8Array(this.size);

    this.initMode('pipe', 'none');
  }

  public IX(i: number, j: number): number {
    return i + j * this.nx;
  }

  public initMode(mode: FlowMode, obstacle: ObstacleType) {
    this.mode = mode;
    this.obstacleType = obstacle;
    this.buildObstacleMask();
    this.resetFields();
  }

  public setPhysicalParams(
    density: number,
    viscosity: number,
    velocity: number,
    roughness: number
  ) {
    this.density = Math.max(1, density);
    this.dynamicViscosity = Math.max(1e-5, viscosity);
    this.kinematicViscosity = this.dynamicViscosity / this.density;
    this.inletVelocity = velocity;
    this.roughness = roughness;
  }

  public buildObstacleMask() {
    this.solid.fill(0);
    const nx = this.nx;
    const ny = this.ny;

    // 1. External Boundaries
    if (this.mode === 'pipe') {
      // Pipe walls at top and bottom (2 cells thick)
      for (let i = 0; i < nx; i++) {
        this.solid[this.IX(i, 0)] = 1;
        this.solid[this.IX(i, 1)] = 1;
        this.solid[this.IX(i, ny - 2)] = 1;
        this.solid[this.IX(i, ny - 1)] = 1;
      }
    } else {
      // Channel walls at top and bottom (1 cell boundary)
      for (let i = 0; i < nx; i++) {
        this.solid[this.IX(i, 0)] = 1;
        this.solid[this.IX(i, ny - 1)] = 1;
      }
    }

    // 2. Obstacle Geometry for Mode 2 / 3
    if (this.mode === 'vortex' || this.mode === 'sandbox') {
      const type = this.obstacleType;
      const cx = this.obstacleX * nx;
      const cy = this.obstacleY * ny;
      const r = this.obstacleRadius * ny;

      if (type === 'cylinder') {
        const r2 = r * r;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const dx = i - cx;
            const dy = j - cy;
            if (dx * dx + dy * dy <= r2) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'square') {
        const half = r * 0.85;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            if (Math.abs(i - cx) <= half && Math.abs(j - cy) <= half) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'airfoil') {
        // Symmetric NACA 0015 airfoil representation
        const chord = r * 3.2;
        const xStart = cx - chord * 0.35;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const xRel = (i - xStart) / chord;
            if (xRel >= 0 && xRel <= 1) {
              const yt = 5 * 0.15 * chord * (
                0.2969 * Math.sqrt(xRel) -
                0.1260 * xRel -
                0.3516 * xRel * xRel +
                0.2843 * Math.pow(xRel, 3) -
                0.1015 * Math.pow(xRel, 4)
              );
              if (Math.abs(j - cy) <= yt) {
                this.solid[this.IX(i, j)] = 1;
              }
            }
          }
        }
      } else if (type === 'venturi') {
        // Venturi constriction walls
        const throatCenter = cx;
        const throatLen = r * 2.5;

        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const dist = Math.abs(i - throatCenter);
            let wallDist = 0;
            if (dist < throatLen) {
              // Smooth cosine constriction
              const factor = 0.5 * (1 + Math.cos((Math.PI * dist) / throatLen));
              wallDist = (ny * 0.28) * factor;
            }
            if (j < wallDist + 2 || j > ny - 3 - wallDist) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'wedge') {
        // Triangular wedge pointing upstream
        const hWedge = r * 1.6;
        const bWedge = r * 1.1;
        const xApex = cx - hWedge * 0.5;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const xRel = (i - xApex) / hWedge;
            if (xRel >= 0 && xRel <= 1) {
              const halfHAtX = xRel * bWedge;
              if (Math.abs(j - cy) <= halfHAtX) {
                this.solid[this.IX(i, j)] = 1;
              }
            }
          }
        }
      } else if (type === 'dual_cylinder') {
        // Dual tandem / side-by-side cylinders
        const rSmall = r * 0.72;
        const r2Small = rSmall * rSmall;
        const cy1 = cy - r * 1.35;
        const cy2 = cy + r * 1.35;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const dx = i - cx;
            const dy1 = j - cy1;
            const dy2 = j - cy2;
            if (dx * dx + dy1 * dy1 <= r2Small || dx * dx + dy2 * dy2 <= r2Small) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'flat_plate') {
        // Perpendicular 90-degree flat barrier plate
        const plateHalfH = r * 1.3;
        const plateThick = Math.max(1, Math.round(r * 0.22));
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            if (Math.abs(i - cx) <= plateThick && Math.abs(j - cy) <= plateHalfH) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'baffle') {
        // Staggered top and bottom baffle plates (S-curve deflection)
        const baffle1X = cx - r * 1.4;
        const baffle2X = cx + r * 1.4;
        const bThick = Math.max(1, Math.round(r * 0.2));
        const bH = ny * 0.58;
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            if (Math.abs(i - baffle1X) <= bThick && j < bH) {
              this.solid[this.IX(i, j)] = 1;
            }
            if (Math.abs(i - baffle2X) <= bThick && j > ny - bH) {
              this.solid[this.IX(i, j)] = 1;
            }
          }
        }
      } else if (type === 'porous_grid') {
        // Multi-slit perforated screen generating turbulent micro-jets
        const gridThick = Math.max(1, Math.round(r * 0.22));
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            if (Math.abs(i - cx) <= gridThick) {
              const seg = Math.floor((j / ny) * 11);
              if (seg % 2 === 0) {
                this.solid[this.IX(i, j)] = 1;
              }
            }
          }
        }
      }
    }
  }

  public resetFields() {
    this.u.fill(0);
    this.v.fill(0);
    this.u_prev.fill(0);
    this.v_prev.fill(0);
    this.dye.fill(0);
    this.dye_prev.fill(0);
    this.pressure.fill(0);
    this.divergence.fill(0);
    this.vorticity.fill(0);

    const nx = this.nx;
    const ny = this.ny;

    // Seed initial flow
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) continue;

        if (this.mode === 'pipe') {
          // Poiseuille parabolic profile
          const yNorm = (j - ny / 2) / (ny / 2 - 2);
          const uP = Math.max(0, this.inletVelocity * (1 - yNorm * yNorm));
          this.u[idx] = uP;
        } else {
          // Uniform flow
          this.u[idx] = this.inletVelocity;
          // small seed perturbation near obstacle for shedding
          if (this.obstacleType !== 'none') {
            const dy = (j - ny / 2) / ny;
            this.v[idx] = Math.sin(i * 0.2) * 0.05 * this.inletVelocity * Math.exp(-dy * dy * 10);
          }
        }
      }
    }

    this.seedTracerDyeRibbons();
  }

  public clearDye() {
    this.dye.fill(0);
    this.dye_prev.fill(0);
  }

  public seedTracerDyeRibbons() {
    const nx = this.nx;
    const ny = this.ny;
    // Inject 5-7 continuous colored tracer ribbons along channel
    const ribbons = 7;
    for (let r = 0; r < ribbons; r++) {
      const jRibbon = Math.round(((r + 1) / (ribbons + 1)) * (ny - 4) + 2);
      for (let i = 0; i < Math.floor(nx * 0.4); i++) {
        for (let dj = -1; dj <= 1; dj++) {
          const j = jRibbon + dj;
          if (j >= 0 && j < ny) {
            const idx = this.IX(i, j);
            if (this.solid[idx] === 0) {
              this.dye[idx] = dj === 0 ? 1.0 : 0.6;
            }
          }
        }
      }
    }
  }

  public injectDyeAt(
    xRatio: number,
    yRatio: number,
    radiusRatio: number = 0.04,
    amount: number = 2.0
  ) {
    const cx = xRatio * this.nx;
    const cy = yRatio * this.ny;
    const r = radiusRatio * this.ny;
    const r2 = r * r;

    const minI = Math.max(1, Math.floor(cx - r));
    const maxI = Math.min(this.nx - 2, Math.ceil(cx + r));
    const minJ = Math.max(1, Math.floor(cy - r));
    const maxJ = Math.min(this.ny - 2, Math.ceil(cy + r));

    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) continue;
        const d2 = (i - cx) * (i - cx) + (j - cy) * (j - cy);
        if (d2 <= r2) {
          const falloff = Math.cos((Math.sqrt(d2) / r) * (Math.PI / 2));
          this.dye[idx] = Math.min(2.5, this.dye[idx] + amount * falloff);
        }
      }
    }
  }

  public applyForceAt(
    xRatio: number,
    yRatio: number,
    fx: number,
    fy: number,
    radiusRatio: number = 0.05
  ) {
    const cx = xRatio * this.nx;
    const cy = yRatio * this.ny;
    const r = radiusRatio * this.ny;
    const r2 = r * r;

    const minI = Math.max(1, Math.floor(cx - r));
    const maxI = Math.min(this.nx - 2, Math.ceil(cx + r));
    const minJ = Math.max(1, Math.floor(cy - r));
    const maxJ = Math.min(this.ny - 2, Math.ceil(cy + r));

    for (let j = minJ; j <= maxJ; j++) {
      for (let i = minI; i <= maxI; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) continue;
        const d2 = (i - cx) * (i - cx) + (j - cy) * (j - cy);
        if (d2 <= r2) {
          const falloff = Math.exp(-d2 / (r2 * 0.5));
          this.u[idx] += fx * falloff;
          this.v[idx] += fy * falloff;
          // Also inject a small burst of dye when stirring
          this.dye[idx] = Math.min(2.0, this.dye[idx] + 0.3 * falloff);
        }
      }
    }
  }

  public step(simTime: number) {
    const nx = this.nx;
    const ny = this.ny;
    const dt = this.dt;

    // 1. Maintain Inlet Boundary Condition & Continuous Streamlines
    this.applyInletCondition(simTime);

    // 2. Viscous Diffusion (scaled by physical kinematic viscosity nu = mu/rho)
    // Physical nu ranges from 1e-6 (water) to 1e-3 (oil/glycerin).
    // Normalize to simulation grid units:
    const reynoldsGrid = (this.inletVelocity * (ny * this.h)) / (this.kinematicViscosity + 1e-8);
    const simDiff = Math.max(0.0001, Math.min(0.2, 1.0 / (reynoldsGrid + 1.0)));

    this.diffuse(1, this.u_prev, this.u, simDiff, dt);
    this.diffuse(2, this.v_prev, this.v, simDiff, dt);

    // 3. Vorticity Confinement (to preserve turbulent swirling vortices and von Kármán street)
    if (reynoldsGrid > 40) {
      this.applyVorticityConfinement(dt, reynoldsGrid);
    }

    // 4. Helmholtz-Hodge Projection to enforce incompressibility (div u = 0)
    this.project(this.u_prev, this.v_prev, this.pressure, this.divergence);

    // 5. Semi-Lagrangian Advection
    this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev, dt);
    this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev, dt);

    // 6. Second Projection to clean up advection numerical divergence
    this.project(this.u, this.v, this.pressure, this.divergence);

    // 7. Scalar Dye Advection & Mild Dissipation
    this.advectDye(this.dye, this.dye_prev, this.u, this.v, dt);

    // 8. Calculate Vorticity Field: omega = dv/dx - du/dy
    this.computeVorticity();

    // 9. Enforce Solid Boundary Conditions
    this.enforceSolidBoundaries();
  }

  private applyInletCondition(time: number) {
    const nx = this.nx;
    const ny = this.ny;
    const uIn = this.inletVelocity;
    const rough = this.roughness;

    // Inlet column (i = 0, 1)
    for (let j = 0; j < ny; j++) {
      const idx = this.IX(0, j);
      const idx1 = this.IX(1, j);
      if (this.solid[idx] === 1) {
        this.u[idx] = 0;
        this.v[idx] = 0;
        continue;
      }

      let baseU = uIn;
      if (this.mode === 'pipe') {
        const yNorm = (j - ny / 2) / (ny / 2 - 2);
        baseU = Math.max(0, uIn * (1 - yNorm * yNorm));
      }

      // Add perturbation if roughness > 0
      let pert = 0;
      if (rough > 0.01) {
        // Multi-frequency disturbance to trigger bypass transition
        pert = (
          Math.sin(time * 12 + j * 0.4) * 0.5 +
          Math.sin(time * 23 + j * 0.8) * 0.3 +
          Math.cos(time * 41 + j * 1.5) * 0.2
        ) * (rough * 0.35 * uIn);
      }

      this.u[idx] = Math.max(0, baseU + pert);
      this.u[idx1] = this.u[idx];
      this.v[idx] = pert * 0.5;
      this.v[idx1] = this.v[idx];

      // Continuously re-feed dye at 5 distinct ribbon heights
      const ribbons = 7;
      for (let r = 0; r < ribbons; r++) {
        const jRibbon = Math.round(((r + 1) / (ribbons + 1)) * (ny - 4) + 2);
        if (Math.abs(j - jRibbon) <= 1) {
          this.dye[idx] = 1.0;
          this.dye[idx1] = 1.0;
        }
      }
    }

    // Outlet convective condition (right edge)
    for (let j = 0; j < ny; j++) {
      const idx = this.IX(nx - 1, j);
      const idxNear = this.IX(nx - 2, j);
      this.u[idx] = this.u[idxNear];
      this.v[idx] = this.v[idxNear];
    }
  }

  private diffuse(
    b: number,
    x: Float32Array,
    x0: Float32Array,
    diff: number,
    dt: number
  ) {
    const a = dt * diff * this.nx * this.ny;
    const c = 1 + 4 * a;
    const nx = this.nx;
    const ny = this.ny;

    // Gauss-Seidel relaxation (12 iterations for crisp convergence)
    for (let k = 0; k < 12; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.IX(i, j);
          if (this.solid[idx] === 1) {
            x[idx] = 0;
            continue;
          }
          x[idx] = (x0[idx] + a * (
            x[this.IX(i - 1, j)] +
            x[this.IX(i + 1, j)] +
            x[this.IX(i, j - 1)] +
            x[this.IX(i, j + 1)]
          )) / c;
        }
      }
      this.setBoundary(b, x);
    }
  }

  private advect(
    b: number,
    d: Float32Array,
    d0: Float32Array,
    u: Float32Array,
    v: Float32Array,
    dt: number
  ) {
    const nx = this.nx;
    const ny = this.ny;
    const dt0 = dt * ny; // scale with grid units

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          d[idx] = 0;
          continue;
        }

        let x = i - dt0 * u[idx];
        let y = j - dt0 * v[idx];

        // Clamp inside domain
        if (x < 0.5) x = 0.5;
        if (x > nx - 1.5) x = nx - 1.5;
        const i0 = Math.floor(x);
        const i1 = i0 + 1;

        if (y < 0.5) y = 0.5;
        if (y > ny - 1.5) y = ny - 1.5;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;

        d[idx] =
          s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
          s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
      }
    }

    this.setBoundary(b, d);
  }

  private advectDye(
    d: Float32Array,
    d0: Float32Array,
    u: Float32Array,
    v: Float32Array,
    dt: number
  ) {
    // Copy current dye to d0
    d0.set(d);
    const nx = this.nx;
    const ny = this.ny;
    const dt0 = dt * ny;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          d[idx] = 0;
          continue;
        }

        let x = i - dt0 * u[idx];
        let y = j - dt0 * v[idx];

        if (x < 0.5) x = 0.5;
        if (x > nx - 1.5) x = nx - 1.5;
        const i0 = Math.floor(x);
        const i1 = i0 + 1;

        if (y < 0.5) y = 0.5;
        if (y > ny - 1.5) y = ny - 1.5;
        const j0 = Math.floor(y);
        const j1 = j0 + 1;

        const s1 = x - i0;
        const s0 = 1 - s1;
        const t1 = y - j0;
        const t0 = 1 - t1;

        // Slight decay to prevent saturation
        const interpolated =
          s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
          s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);

        d[idx] = interpolated * 0.998;
      }
    }
  }

  private project(
    u: Float32Array,
    v: Float32Array,
    p: Float32Array,
    div: Float32Array
  ) {
    const nx = this.nx;
    const ny = this.ny;

    // 1. Calculate divergence: div = -0.5 * h * (du/dx + dv/dy)
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          div[idx] = 0;
          p[idx] = 0;
          continue;
        }

        div[idx] =
          -0.5 *
          (u[this.IX(i + 1, j)] -
            u[this.IX(i - 1, j)] +
            v[this.IX(i, j + 1)] -
            v[this.IX(i, j - 1)]) /
          ny;
        p[idx] = 0;
      }
    }

    this.setBoundary(0, div);
    this.setBoundary(0, p);

    // 2. Solve Poisson equation for pressure: laplacian(p) = div
    for (let k = 0; k < 20; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.IX(i, j);
          if (this.solid[idx] === 1) {
            continue;
          }

          let neighbors = 0;
          let sumP = 0;

          const idxL = this.IX(i - 1, j);
          const idxR = this.IX(i + 1, j);
          const idxB = this.IX(i, j - 1);
          const idxT = this.IX(i, j + 1);

          sumP += this.solid[idxL] ? p[idx] : p[idxL];
          neighbors++;
          sumP += this.solid[idxR] ? p[idx] : p[idxR];
          neighbors++;
          sumP += this.solid[idxB] ? p[idx] : p[idxB];
          neighbors++;
          sumP += this.solid[idxT] ? p[idx] : p[idxT];
          neighbors++;

          p[idx] = (div[idx] + sumP) / 4;
        }
      }
      this.setBoundary(0, p);
    }

    // 3. Subtract pressure gradient: u -= dp/dx, v -= dp/dy
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          u[idx] = 0;
          v[idx] = 0;
          continue;
        }

        u[idx] -=
          0.5 * ny * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]);
        v[idx] -=
          0.5 * ny * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]);
      }
    }

    this.setBoundary(1, u);
    this.setBoundary(2, v);
  }

  private applyVorticityConfinement(dt: number, reynolds: number) {
    const nx = this.nx;
    const ny = this.ny;

    // First compute vorticity
    this.computeVorticity();

    // Confinement strength scales with Reynolds number (stronger in turbulent, zero in laminar)
    const confinementFactor = Math.min(
      0.08,
      Math.max(0, (reynolds - 40) / 3000) * 0.05
    );
    if (confinementFactor <= 0.0001) return;

    // Compute magnitude of vorticity |omega|
    const mag = new Float32Array(this.size);
    for (let idx = 0; idx < this.size; idx++) {
      mag[idx] = Math.abs(this.vorticity[idx]);
    }

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) continue;

        // Gradient of vorticity magnitude
        const dx = (mag[this.IX(i + 1, j)] - mag[this.IX(i - 1, j)]) * 0.5;
        const dy = (mag[this.IX(i, j + 1)] - mag[this.IX(i, j - 1)]) * 0.5;
        const len = Math.sqrt(dx * dx + dy * dy) + 1e-6;

        const Nx = dx / len;
        const Ny = dy / len;
        const omega = this.vorticity[idx];

        // Force f = epsilon * (N x omega)
        const fx = Ny * omega * confinementFactor;
        const fy = -Nx * omega * confinementFactor;

        this.u[idx] += fx * dt;
        this.v[idx] += fy * dt;
      }
    }
  }

  private computeVorticity() {
    const nx = this.nx;
    const ny = this.ny;
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          this.vorticity[idx] = 0;
          continue;
        }

        // omega = dv/dx - du/dy
        const dv_dx =
          (this.v[this.IX(i + 1, j)] - this.v[this.IX(i - 1, j)]) * 0.5 * ny;
        const du_dy =
          (this.u[this.IX(i, j + 1)] - this.u[this.IX(i, j - 1)]) * 0.5 * ny;

        this.vorticity[idx] = dv_dx - du_dy;
      }
    }
  }

  private enforceSolidBoundaries() {
    const nx = this.nx;
    const ny = this.ny;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = this.IX(i, j);
        if (this.solid[idx] === 1) {
          this.u[idx] = 0;
          this.v[idx] = 0;
          this.dye[idx] = 0;
        }
      }
    }
  }

  private setBoundary(b: number, x: Float32Array) {
    const nx = this.nx;
    const ny = this.ny;

    // Mode 1: No-slip at top and bottom walls
    for (let i = 1; i < nx - 1; i++) {
      x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : (this.mode === 'pipe' ? 0 : x[this.IX(i, 1)]);
      x[this.IX(i, ny - 1)] = b === 2 ? -x[this.IX(i, ny - 2)] : (this.mode === 'pipe' ? 0 : x[this.IX(i, ny - 2)]);
    }

    // Left and right edges
    for (let j = 1; j < ny - 1; j++) {
      if (b === 1) {
        // Inlet on left
        // Right outflow
        x[this.IX(nx - 1, j)] = x[this.IX(nx - 2, j)];
      } else if (b === 2) {
        x[this.IX(nx - 1, j)] = x[this.IX(nx - 2, j)];
      }
    }

    // Corners
    x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
    x[this.IX(0, ny - 1)] = 0.5 * (x[this.IX(1, ny - 1)] + x[this.IX(0, ny - 2)]);
    x[this.IX(nx - 1, 0)] = 0.5 * (x[this.IX(nx - 2, 0)] + x[this.IX(nx - 1, 1)]);
    x[this.IX(nx - 1, ny - 1)] = 0.5 * (x[this.IX(nx - 2, ny - 1)] + x[this.IX(nx - 1, ny - 2)]);
  }

  // Bilinear velocity sample at normalized coordinates (0..1)
  public sampleVelocity(xNorm: number, yNorm: number): { u: number; v: number; speed: number } {
    const x = Math.max(0, Math.min(1, xNorm)) * (this.nx - 1);
    const y = Math.max(0, Math.min(1, yNorm)) * (this.ny - 1);

    const i0 = Math.floor(x);
    const j0 = Math.floor(y);
    const i1 = Math.min(this.nx - 1, i0 + 1);
    const j1 = Math.min(this.ny - 1, j0 + 1);

    const sx = x - i0;
    const sy = y - j0;

    const u00 = this.u[this.IX(i0, j0)];
    const u10 = this.u[this.IX(i1, j0)];
    const u01 = this.u[this.IX(i0, j1)];
    const u11 = this.u[this.IX(i1, j1)];

    const v00 = this.v[this.IX(i0, j0)];
    const v10 = this.v[this.IX(i1, j0)];
    const v01 = this.v[this.IX(i0, j1)];
    const v11 = this.v[this.IX(i1, j1)];

    const uVal = (1 - sx) * ((1 - sy) * u00 + sy * u01) + sx * ((1 - sy) * u10 + sy * u11);
    const vVal = (1 - sx) * ((1 - sy) * v00 + sy * v01) + sx * ((1 - sy) * v10 + sy * v11);

    return { u: uVal, v: vVal, speed: Math.sqrt(uVal * uVal + vVal * vVal) };
  }
}
