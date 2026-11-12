import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  VisualizationLayers,
  InteractiveTool,
  FlowMode,
  ObstacleType,
  TelemetryData,
} from '../types/cfd';
import { NavierStokesSolver } from '../physics/NavierStokesSolver';
import { ParticleSystem } from '../physics/ParticleSystem';
import { translations, Language } from '../locales/translations';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Sparkles,
  MousePointer2,
  Crosshair,
  Droplet,
} from 'lucide-react';

interface CFDCanvasProps {
  solver: NavierStokesSolver;
  particleSystem: ParticleSystem;
  layers: VisualizationLayers;
  mode: FlowMode;
  obstacle: ObstacleType;
  telemetry: TelemetryData;
  activeTool: InteractiveTool;
  setActiveTool: (tool: InteractiveTool) => void;
  probeX: number;
  probeY: number;
  setProbePosition: (x: number, y: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  onStepFrame: () => void;
  onReset: () => void;
  onClearDye: () => void;
  lang: Language;
  isWideLayout: boolean;
  onToggleWideLayout: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onToggleLayer?: (key: keyof VisualizationLayers) => void;
  onToggleLeftDrawer?: () => void;
  onToggleRightDrawer?: () => void;
  showLeftDrawer?: boolean;
  showRightDrawer?: boolean;
}

export const CFDCanvas: React.FC<CFDCanvasProps> = ({
  solver,
  particleSystem,
  layers,
  mode,
  obstacle,
  telemetry,
  activeTool,
  setActiveTool,
  probeX,
  probeY,
  setProbePosition,
  isPlaying,
  setIsPlaying,
  onStepFrame,
  onReset,
  onClearDye,
  lang,
  isWideLayout,
  onToggleWideLayout,
  isFullscreen,
  onToggleFullscreen,
  onToggleLayer,
  onToggleLeftDrawer,
  onToggleRightDrawer,
  showLeftDrawer,
  showRightDrawer,
}) => {
  const t = translations[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const isDraggingSensorRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Persistent rotor angles for physical rotation visualization
  const rotorAnglesRef = useRef<Float32Array | null>(null);

  // Offscreen canvas for fast pixel scalar field rendering
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Resize listener
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Sync canvas size and pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;

    // Offscreen buffer matches grid resolution for zero-alloc texture blitting
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    offscreenCanvasRef.current.width = solver.nx;
    offscreenCanvasRef.current.height = solver.ny;
  }, [dimensions, solver.nx, solver.ny]);

  // Main Render Loop callback triggered by requestAnimationFrame from parent
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = dimensions.height;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear background: luminous soft sky-blue
    ctx.fillStyle = '#f0f9ff'; // sky-50
    ctx.fillRect(0, 0, width, height);

    // Subtle technical grid pattern
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)'; // sky-200/45
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // 2. Render Scalar Field (Vorticity, Dye, or Pressure) onto Offscreen Canvas
    const offCanvas = offscreenCanvasRef.current;
    if (offCanvas) {
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        const imgData = offCtx.createImageData(solver.nx, solver.ny);
        const data = imgData.data;
        const nx = solver.nx;
        const ny = solver.ny;

        const showVort = layers.showVorticity;
        const showDye = layers.showDye;
        const showPress = layers.showPressure;

        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const idx = solver.IX(i, j);
            const pixelIdx = (j * nx + i) * 4;

            if (solver.solid[idx] === 1) {
              // Solid cell handled in vector pass
              data[pixelIdx + 3] = 0;
              continue;
            }

            let r = 240;
            let g = 249;
            let b = 255;
            let alpha = 0;

            // Layer: Vorticity Heatmap (Red/Blue counter-rotating eddies)
            if (showVort) {
              const omega = solver.vorticity[idx];
              // Normalized vorticity: [-1, +1]
              const normOmega = Math.max(-1, Math.min(1, omega / 4.0));
              if (normOmega > 0) {
                // Clockwise: Red / Crimson
                r = 239;
                g = Math.floor(68 * (1 - normOmega) + 249 * (1 - normOmega * 0.8));
                b = Math.floor(68 * (1 - normOmega) + 255 * (1 - normOmega * 0.8));
                alpha = Math.floor(Math.abs(normOmega) * 190);
              } else {
                // Counter-clockwise: Deep Blue / Cyan
                r = Math.floor(37 * (1 - Math.abs(normOmega)) + 240 * (1 - Math.abs(normOmega) * 0.8));
                g = Math.floor(99 * (1 - Math.abs(normOmega)) + 249 * (1 - Math.abs(normOmega) * 0.8));
                b = 235;
                alpha = Math.floor(Math.abs(normOmega) * 190);
              }
            }

            // Layer: Dye Streamlines overlay
            if (showDye) {
              const dyeVal = Math.min(1.0, solver.dye[idx]);
              if (dyeVal > 0.02) {
                // Royal cobalt / indigo dye
                const dyeR = 30;
                const dyeG = 64;
                const dyeB = 175;
                const dyeAlpha = Math.floor(dyeVal * 210);

                if (alpha > 0) {
                  // Blend with vorticity
                  r = Math.floor((r + dyeR) * 0.5);
                  g = Math.floor((g + dyeG) * 0.5);
                  b = Math.floor((b + dyeB) * 0.5);
                  alpha = Math.max(alpha, dyeAlpha);
                } else {
                  r = dyeR;
                  g = dyeG;
                  b = dyeB;
                  alpha = dyeAlpha;
                }
              }
            }

            // Layer: Pressure contours overlay (blends smoothly even if vorticity is active)
            if (showPress) {
              const p = solver.pressure[idx];
              const normP = Math.max(-1, Math.min(1, p * 8.0));
              let pressR = 245;
              let pressG = 158;
              let pressB = 11;
              const pressAlpha = Math.floor(Math.abs(normP) * 140);

              if (normP <= 0) {
                // Low pressure: cool teal
                pressR = 13;
                pressG = 148;
                pressB = 136;
              } else {
                pressG = Math.floor(158 * (1 - normP * 0.4));
              }

              if (alpha > 0) {
                // Smooth composite with vorticity & dye
                r = Math.floor(r * 0.7 + pressR * 0.3);
                g = Math.floor(g * 0.7 + pressG * 0.3);
                b = Math.floor(b * 0.7 + pressB * 0.3);
                alpha = Math.max(alpha, pressAlpha);
              } else {
                r = pressR;
                g = pressG;
                b = pressB;
                alpha = pressAlpha;
              }
            }

            data[pixelIdx + 0] = r;
            data[pixelIdx + 1] = g;
            data[pixelIdx + 2] = b;
            data[pixelIdx + 3] = alpha;
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        // Blit offscreen buffer smoothly scaled to main canvas
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offCanvas, 0, 0, width, height);
      }
    }

    // 3. Render Lagrangian Tracer Particles
    if (layers.showParticles) {
      particleSystem.render(ctx, width, height, telemetry.regime);
    }

    // 4. Render Velocity Vector Field Arrows (sub-sampled)
    if (layers.showVectors) {
      ctx.save();
      const stepI = 8;
      const stepJ = 6;
      const cellW = width / solver.nx;
      const cellH = height / solver.ny;

      for (let j = 3; j < solver.ny - 3; j += stepJ) {
        for (let i = 4; i < solver.nx - 4; i += stepI) {
          const idx = solver.IX(i, j);
          if (solver.solid[idx] === 1) continue;

          const cx = (i + 0.5) * cellW;
          const cy = (j + 0.5) * cellH;

          const u = solver.u[idx];
          const v = solver.v[idx];
          const speed = Math.sqrt(u * u + v * v);
          if (speed < 0.03) continue;

          const angle = Math.atan2(v, u);
          const arrowLen = Math.min(22, Math.max(5, speed * 12));

          ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)'; // slate-900/65
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.lineWidth = 1.2;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          const endX = cx + Math.cos(angle) * arrowLen;
          const endY = cy + Math.sin(angle) * arrowLen;
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Arrowhead
          const headLen = 3.5;
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle - Math.PI / 6),
            endY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - headLen * Math.cos(angle + Math.PI / 6),
            endY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 4B. Render Fluid Rotation Micro-Rotors & Swirl Spinners
    if (layers.showRotationSpinners) {
      ctx.save();
      const stepI = 8;
      const stepJ = 7;
      const numRotorsX = Math.floor(solver.nx / stepI);
      const numRotorsY = Math.floor(solver.ny / stepJ);
      const totalRotors = numRotorsX * numRotorsY;

      if (!rotorAnglesRef.current || rotorAnglesRef.current.length !== totalRotors) {
        rotorAnglesRef.current = new Float32Array(totalRotors);
      }
      const angles = rotorAnglesRef.current;

      const cellW = width / solver.nx;
      const cellH = height / solver.ny;

      for (let rj = 1; rj < numRotorsY - 1; rj++) {
        const j = Math.floor((rj + 0.5) * stepJ);
        for (let ri = 1; ri < numRotorsX - 1; ri++) {
          const i = Math.floor((ri + 0.5) * stepI);
          const idx = solver.IX(i, j);
          if (solver.solid[idx] === 1) continue;

          const omega = solver.vorticity[idx];
          const rotorIdx = ri + rj * numRotorsX;

          // Angular velocity Omega = 0.5 * omega
          if (isPlaying) {
            angles[rotorIdx] += 0.5 * omega * 0.15;
          }
          const theta = angles[rotorIdx];

          const cx = (i + 0.5) * cellW;
          const cy = (j + 0.5) * cellH;
          const absOmega = Math.abs(omega);

          if (absOmega < 0.05) continue;

          const isClockwise = omega > 0;
          const armLen = Math.min(10, Math.max(4.5, 4 + absOmega * 1.5));
          const color = isClockwise ? 'rgba(244, 63, 94, 0.88)' : 'rgba(14, 165, 233, 0.88)';

          // If strong vortex core, draw concentric swirl ring
          if (absOmega > 0.8) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            const ringR = Math.min(18, 9 + absOmega * 2.2);
            const startArc = theta;
            const endArc = theta + (isClockwise ? Math.PI * 1.5 : -Math.PI * 1.5);
            ctx.arc(cx, cy, ringR, startArc, endArc, !isClockwise);
            ctx.stroke();

            // Direction arrow head on swirl ring
            const arrowTipX = cx + Math.cos(endArc) * ringR;
            const arrowTipY = cy + Math.sin(endArc) * ringR;
            const tangentAngle = endArc + (isClockwise ? Math.PI / 2 : -Math.PI / 2);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(
              arrowTipX - 4 * Math.cos(tangentAngle - Math.PI / 6),
              arrowTipY - 4 * Math.sin(tangentAngle - Math.PI / 6)
            );
            ctx.lineTo(
              arrowTipX - 4 * Math.cos(tangentAngle + Math.PI / 6),
              arrowTipY - 4 * Math.sin(tangentAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }

          // Draw 4-blade spinning micro paddle-wheel
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          // Blade 1 & 2
          ctx.moveTo(cx - Math.cos(theta) * armLen, cy - Math.sin(theta) * armLen);
          ctx.lineTo(cx + Math.cos(theta) * armLen, cy + Math.sin(theta) * armLen);
          // Blade 3 & 4 (perpendicular)
          ctx.moveTo(
            cx - Math.cos(theta + Math.PI / 2) * armLen,
            cy - Math.sin(theta + Math.PI / 2) * armLen
          );
          ctx.lineTo(
            cx + Math.cos(theta + Math.PI / 2) * armLen,
            cy + Math.sin(theta + Math.PI / 2) * armLen
          );
          ctx.stroke();

          // Center pin
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 5. Render Solid Obstacle & Boundary Walls with crisp technical styling
    ctx.save();
    const cellW = width / solver.nx;
    const cellH = height / solver.ny;

    // External pipe/channel boundary styling
    if (mode === 'pipe') {
      const wallHeight = cellH * 2;
      // Top wall
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, wallHeight);
      // Bottom wall
      ctx.fillRect(0, height - wallHeight, width, wallHeight);

      // Metallic hatched border line
      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, wallHeight);
      ctx.lineTo(width, wallHeight);
      ctx.moveTo(0, height - wallHeight);
      ctx.lineTo(width, height - wallHeight);
      ctx.stroke();

      // No-slip wall label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '500 10px JetBrains Mono';
      ctx.fillText('NO-SLIP PIPE BOUNDARY (u = 0, v = 0)', 16, wallHeight - 5);
      ctx.fillText('NO-SLIP PIPE BOUNDARY (u = 0, v = 0)', 16, height - 5);
    } else {
      // Channel walls
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, width, cellH);
      ctx.fillRect(0, height - cellH, width, cellH);
    }

    // Bluff body obstacle rendering
    if ((mode === 'vortex' || mode === 'sandbox') && obstacle !== 'none') {
      const cx = solver.obstacleX * width;
      const cy = solver.obstacleY * height;
      const r = solver.obstacleRadius * height;

      ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;

      if (obstacle === 'cylinder') {
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, '#64748b'); // slate-500
        grad.addColorStop(0.85, '#1e293b'); // slate-800
        grad.addColorStop(1, '#0f172a'); // slate-900

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#38bdf8'; // sky-400
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Stagnation point marker
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx - r, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle === 'square') {
        const half = r * 0.85;
        const grad = ctx.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
        grad.addColorStop(0, '#475569');
        grad.addColorStop(1, '#0f172a');

        ctx.fillStyle = grad;
        ctx.fillRect(cx - half, cy - half, half * 2, half * 2);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      } else if (obstacle === 'airfoil') {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const chord = r * 3.2;
        const xStart = cx - chord * 0.35;
        for (let step = 0; step <= 60; step++) {
          const xRel = step / 60;
          const px = xStart + xRel * chord;
          const yt = 5 * 0.15 * chord * (
            0.2969 * Math.sqrt(xRel) -
            0.1260 * xRel -
            0.3516 * xRel * xRel +
            0.2843 * Math.pow(xRel, 3) -
            0.1015 * Math.pow(xRel, 4)
          );
          if (step === 0) ctx.moveTo(px, cy - yt);
          else ctx.lineTo(px, cy - yt);
        }
        for (let step = 60; step >= 0; step--) {
          const xRel = step / 60;
          const px = xStart + xRel * chord;
          const yt = 5 * 0.15 * chord * (
            0.2969 * Math.sqrt(xRel) -
            0.1260 * xRel -
            0.3516 * xRel * xRel +
            0.2843 * Math.pow(xRel, 3) -
            0.1015 * Math.pow(xRel, 4)
          );
          ctx.lineTo(px, cy + yt);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obstacle === 'venturi') {
        // Render Venturi smooth wall blocks
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;

        const throatCenter = cx;
        const throatLen = r * 2.5;

        // Top venturi constriction
        ctx.beginPath();
        ctx.moveTo(throatCenter - throatLen, 0);
        for (let x = throatCenter - throatLen; x <= throatCenter + throatLen; x += 4) {
          const dist = Math.abs(x - throatCenter);
          const factor = 0.5 * (1 + Math.cos((Math.PI * dist) / throatLen));
          const wallY = (height * 0.28) * factor;
          ctx.lineTo(x, wallY);
        }
        ctx.lineTo(throatCenter + throatLen, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bottom venturi constriction
        ctx.beginPath();
        ctx.moveTo(throatCenter - throatLen, height);
        for (let x = throatCenter - throatLen; x <= throatCenter + throatLen; x += 4) {
          const dist = Math.abs(x - throatCenter);
          const factor = 0.5 * (1 + Math.cos((Math.PI * dist) / throatLen));
          const wallY = height - (height * 0.28) * factor;
          ctx.lineTo(x, wallY);
        }
        ctx.lineTo(throatCenter + throatLen, height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (obstacle === 'wedge') {
        // Triangular wedge pointing upstream
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        const hWedge = r * 1.6;
        const bWedge = r * 1.1;
        const xApex = cx - hWedge * 0.5;
        ctx.beginPath();
        ctx.moveTo(xApex, cy);
        ctx.lineTo(cx + hWedge * 0.5, cy - bWedge);
        ctx.lineTo(cx + hWedge * 0.5, cy + bWedge);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Stagnation point
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(xApex, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle === 'dual_cylinder') {
        // Dual side-by-side cylinders
        const rSmall = r * 0.72;
        const cy1 = cy - r * 1.35;
        const cy2 = cy + r * 1.35;

        // Top cylinder
        let grad1 = ctx.createRadialGradient(cx - rSmall * 0.3, cy1 - rSmall * 0.3, rSmall * 0.1, cx, cy1, rSmall);
        grad1.addColorStop(0, '#64748b');
        grad1.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad1;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy1, rSmall, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bottom cylinder
        let grad2 = ctx.createRadialGradient(cx - rSmall * 0.3, cy2 - rSmall * 0.3, rSmall * 0.1, cx, cy2, rSmall);
        grad2.addColorStop(0, '#64748b');
        grad2.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(cx, cy2, rSmall, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (obstacle === 'flat_plate') {
        // 90-degree flat perpendicular barrier
        const plateHalfH = r * 1.3;
        const plateThick = Math.max(3, r * 0.22);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.fillRect(cx - plateThick, cy - plateHalfH, plateThick * 2, plateHalfH * 2);
        ctx.strokeRect(cx - plateThick, cy - plateHalfH, plateThick * 2, plateHalfH * 2);

        // Stagnation line
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx - plateThick, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (obstacle === 'baffle') {
        // Staggered top and bottom baffle plates
        const baffle1X = cx - r * 1.4;
        const baffle2X = cx + r * 1.4;
        const bThick = Math.max(3, r * 0.2);
        const bH = height * 0.58;

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        // Baffle 1 from top
        ctx.fillRect(baffle1X - bThick, 0, bThick * 2, bH);
        ctx.strokeRect(baffle1X - bThick, 0, bThick * 2, bH);
        // Baffle 2 from bottom
        ctx.fillRect(baffle2X - bThick, height - bH, bThick * 2, bH);
        ctx.strokeRect(baffle2X - bThick, height - bH, bThick * 2, bH);
      } else if (obstacle === 'porous_grid') {
        // Perforated screen with vertical bars and gaps
        const gridThick = Math.max(3, r * 0.22);
        const segs = 11;
        const segH = height / segs;
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.2;

        for (let s = 0; s < segs; s++) {
          if (s % 2 === 0) {
            ctx.fillRect(cx - gridThick, s * segH, gridThick * 2, segH);
            ctx.strokeRect(cx - gridThick, s * segH, gridThick * 2, segH);
          }
        }
      }
    }
    ctx.restore();

    // 6. Render Draggable Vertical Sensor Probe Line for Live Profile
    ctx.save();
    const sensorX = probeX * width;
    const sensorY = probeY * height;

    // Guideline
    ctx.strokeStyle = '#0284c7'; // sky-600
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sensorX, 0);
    ctx.lineTo(sensorX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top grab handle
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(sensorX - 28, 4, 56, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 9px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('SENSOR', sensorX, 16);

    // Crosshair target circle at probe coordinates
    ctx.strokeStyle = '#059669'; // emerald-600
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sensorX, sensorY, 7, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(sensorX, sensorY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.restore();
  }, [
    dimensions,
    solver,
    particleSystem,
    layers,
    mode,
    obstacle,
    telemetry.regime,
    probeX,
    probeY,
  ]);

  // Animation Frame Hook
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderFrame]);

  // Pointer / Mouse Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Check if clicked near sensor line
    const distToSensor = Math.abs(x - probeX);
    if (distToSensor < 0.04 || activeTool === 'probe') {
      isDraggingSensorRef.current = true;
      setProbePosition(Math.max(0.05, Math.min(0.95, x)), Math.max(0.05, Math.min(0.95, y)));
    } else {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x, y };

      if (activeTool === 'inject') {
        solver.injectDyeAt(x, y, 0.05, 2.5);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    if (isDraggingSensorRef.current) {
      setProbePosition(Math.max(0.05, Math.min(0.95, x)), Math.max(0.05, Math.min(0.95, y)));
      return;
    }

    if (!isDraggingRef.current) return;

    if (activeTool === 'stir' && lastMousePosRef.current) {
      const dx = (x - lastMousePosRef.current.x) * 45;
      const dy = (y - lastMousePosRef.current.y) * 45;
      solver.applyForceAt(x, y, dx, dy, 0.06);
    } else if (activeTool === 'inject') {
      solver.injectDyeAt(x, y, 0.04, 1.8);
    }

    lastMousePosRef.current = { x, y };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    isDraggingRef.current = false;
    isDraggingSensorRef.current = false;
    lastMousePosRef.current = null;
  };

  return (
    <div className="flex-1 h-full flex flex-col gap-2.5 min-w-0">
      {/* 1. TOP CONTROL DECK: Placed above the simulation screen in a single continuous line */}
      <div className="shrink-0 bg-white rounded-2xl border border-sky-200 px-3 py-1.5 shadow-xs flex items-center justify-between gap-2 overflow-x-auto flex-nowrap scrollbar-none">
        {/* Left: Interactive Tools Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-sky-50/90 border border-sky-200/80 rounded-xl shadow-2xs shrink-0 flex-nowrap">
          <button
            onClick={() => setActiveTool('stir')}
            title={t.actions.stirTool}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTool === 'stir'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>{t.actions.stirTool}</span>
          </button>
          <button
            onClick={() => setActiveTool('inject')}
            title={t.actions.injectTool}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTool === 'inject'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Droplet className="w-3.5 h-3.5" />
            <span>{t.actions.injectTool}</span>
          </button>
          <button
            onClick={() => setActiveTool('probe')}
            title={t.actions.probeTool}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTool === 'probe'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{t.actions.probeTool}</span>
          </button>

          <span className="w-px h-4 bg-sky-200 mx-0.5" />

          {/* Quick Rotation Spinners Toggle Button */}
          {onToggleLayer && (
            <button
              onClick={() => onToggleLayer('showRotationSpinners')}
              title={lang === 'bn' ? 'পানির ঘূর্ণন চাকা ও ঘূর্ণি বলয় দেখুন' : 'Visualize Fluid Rotation & Vortex Spinners'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                layers.showRotationSpinners
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white'
              }`}
            >
              <span className={layers.showRotationSpinners ? 'animate-spin' : ''}>⚙️</span>
              <span>{lang === 'bn' ? 'ঘূর্ণন স্পিনার' : 'Rotation Spinners'}</span>
            </button>
          )}

          {/* Quick Vorticity Map Toggle Button */}
          {onToggleLayer && (
            <button
              onClick={() => onToggleLayer('showVorticity')}
              title={lang === 'bn' ? 'ঘূর্ণন / ভর্টিসিটি ম্যাপ টগল' : 'Toggle Vorticity Heatmap'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                layers.showVorticity
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white'
              }`}
            >
              <span>🌀</span>
              <span>{lang === 'bn' ? 'ভর্টিসিটি' : 'Vorticity'}</span>
            </button>
          )}
        </div>

        {/* Right: Simulation Stepper & Clear Buttons on the exact same single row */}
        <div className="flex items-center gap-1.5 p-1 bg-sky-50/90 border border-sky-200/80 rounded-xl shadow-2xs shrink-0 flex-nowrap">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              isPlaying
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-xs'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? t.actions.pause : t.actions.play}</span>
          </button>

          <button
            onClick={onStepFrame}
            disabled={isPlaying}
            title={t.actions.step}
            className="p-1.5 text-slate-700 hover:text-slate-950 hover:bg-white rounded-lg disabled:opacity-40 transition-colors shrink-0"
          >
            <StepForward className="w-4 h-4" />
          </button>

          <button
            onClick={onClearDye}
            title={t.actions.clearDye}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 hover:text-slate-950 hover:bg-white rounded-lg transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>{t.actions.clearDye}</span>
          </button>

          <button
            onClick={onReset}
            title={t.actions.reset}
            className="p-1.5 text-slate-700 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Quick Drawers Toggles in Wide Mode */}
          {isWideLayout && onToggleLeftDrawer && (
            <>
              <span className="w-px h-4 bg-sky-200 mx-0.5" />
              <button
                onClick={onToggleLeftDrawer}
                title={lang === 'bn' ? 'কন্ট্রোল প্যানেল খুলুন/বন্ধ করুন' : 'Toggle Controls Panel'}
                className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 ${
                  showLeftDrawer
                    ? 'bg-sky-200/90 text-sky-950 font-bold'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white'
                }`}
              >
                <span>⚙️</span>
                <span className="text-[11px]">{lang === 'bn' ? 'কন্ট্রোল' : 'Controls'}</span>
              </button>
            </>
          )}

          {isWideLayout && onToggleRightDrawer && (
            <button
              onClick={onToggleRightDrawer}
              title={lang === 'bn' ? 'টেলিমেট্রি প্যানেল খুলুন/বন্ধ করুন' : 'Toggle Telemetry Panel'}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 ${
                showRightDrawer
                  ? 'bg-sky-200/90 text-sky-950 font-bold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white'
              }`}
            >
              <span>📊</span>
              <span className="text-[11px]">{lang === 'bn' ? 'টেলিমেট্রি' : 'Telemetry'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. CENTER SIMULATION SCREEN: 100% Clean, enlarged downward vertical space */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full min-h-[520px] lg:min-h-[580px] xl:min-h-[660px] bg-sky-50 rounded-2xl border border-sky-200 overflow-hidden shadow-xs flex flex-col"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full block cursor-crosshair touch-none"
        />
      </div>

      {/* 3. BOTTOM TELEMETRY HUD: Placed below the simulation screen, sleek and compact */}
      <div className="shrink-0 bg-white rounded-2xl border border-sky-200 px-3.5 py-1.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Probing point live metrics */}
        <div className="flex items-center flex-wrap gap-3.5 text-slate-950 font-mono tabular-nums">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-sans font-medium">{t.hud.probeSpeed}</span>
            <span className="font-bold text-sky-700">{telemetry.probeSpeed.toFixed(2)} m/s</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 font-sans font-medium">{t.hud.probeVorticity}</span>
            <span className={`font-bold ${telemetry.probeVorticity >= 0 ? 'text-rose-600' : 'text-blue-600'}`}>
              {telemetry.probeVorticity.toFixed(2)} s⁻¹
            </span>
          </div>
          <span className="text-slate-300">|</span>
          {/* Angular Spin Speed & Direction */}
          <div className="flex items-center gap-1.5" title="Fluid Angular Velocity Omega = 0.5 * vorticity">
            <span className="text-slate-600 font-sans font-medium">{lang === 'bn' ? 'ঘূর্ণন দ্রুতি Ω:' : 'Spin Ω:'}</span>
            <span className={`font-bold ${telemetry.probeVorticity >= 0 ? 'text-rose-600' : 'text-sky-600'}`}>
              {(Math.abs(telemetry.probeVorticity) * 0.5).toFixed(1)} rad/s ({Math.abs(Math.round((telemetry.probeVorticity * 0.5 * 60) / (2 * Math.PI)))} RPM {telemetry.probeVorticity >= 0 ? '↻' : '↺'})
            </span>
          </div>
          <span className="text-slate-300 hidden md:inline">|</span>
          <div className="hidden md:flex items-center gap-1.5">
            <span className="text-slate-600 font-sans font-medium">Pos (X,Y):</span>
            <span className="text-slate-800">
              ({telemetry.probeX.toFixed(2)}, {telemetry.probeY.toFixed(2)})
            </span>
          </div>
        </div>

        {/* Solver Engine status */}
        <div className="flex items-center gap-3 text-slate-700 font-mono tabular-nums">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500 font-sans">{t.hud.fps}</span>
            <span className="font-semibold text-emerald-700">{telemetry.fps}</span>
          </div>
          <span className="text-slate-300">·</span>
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-500 font-sans">{t.hud.cfl}</span>
            <span className={`font-semibold ${telemetry.cfl > 1.2 ? 'text-amber-600' : 'text-slate-800'}`}>
              {telemetry.cfl.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
