import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FlowMode,
  ObstacleType,
  FluidPresetKey,
  FluidPhysicalParams,
  VisualizationLayers,
  InteractiveTool,
  TelemetryData,
  VelocityProfilePoint,
} from './types/cfd';
import { NavierStokesSolver } from './physics/NavierStokesSolver';
import { ParticleSystem } from './physics/ParticleSystem';
import { TelemetryEngine } from './physics/TelemetryEngine';
import { TopNav } from './components/TopNav';
import { LeftSidebar } from './components/LeftSidebar';
import { CFDCanvas } from './components/CFDCanvas';
import { RightTelemetry } from './components/RightTelemetry';
import { TheoryModal } from './components/TheoryModal';
import { Language } from './locales/translations';

// Initial Physical presets
const PRESET_VALUES: Record<FluidPresetKey, Partial<FluidPhysicalParams>> = {
  air: { density: 1.225, viscosity: 1.81e-5 },
  water: { density: 1000, viscosity: 1.0e-3 },
  oil: { density: 880, viscosity: 0.29 },
  glycerin: { density: 1260, viscosity: 1.49 },
  custom: {},
};

export default function App() {
  // Global Language state ("বাংলা" default as requested)
  const [lang, setLang] = useState<Language>('bn');
  const [isTheoryOpen, setIsTheoryOpen] = useState(false);

  // Simulation mode
  const [mode, setMode] = useState<FlowMode>('pipe');
  const [obstacle, setObstacle] = useState<ObstacleType>('none');
  const [preset, setPreset] = useState<FluidPresetKey>('water');

  // Interactive tool
  const [activeTool, setActiveTool] = useState<InteractiveTool>('stir');

  // Probe coordinates (0..1)
  const [probeX, setProbeX] = useState(0.55);
  const [probeY, setProbeY] = useState(0.50);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);

  // Layout expansion & Fullscreen state
  const [isWideLayout, setIsWideLayout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeftInWide, setShowLeftInWide] = useState(false);
  const [showRightInWide, setShowRightInWide] = useState(false);

  // Physical parameters
  const [params, setParams] = useState<FluidPhysicalParams>({
    velocity: 1.2,
    diameter: 0.05,
    viscosity: 1.0e-3,
    density: 1000,
    roughness: 0,
    particleCount: 3500,
  });

  // Visualization layers (all enabled by default as requested)
  const [layers, setLayers] = useState<VisualizationLayers>({
    showDye: true,
    showParticles: true,
    showVorticity: true,
    showRotationSpinners: true,
    showVectors: true,
    showPressure: true,
  });

  // Core Physics instances (persistent across renders)
  const solverRef = useRef<NavierStokesSolver | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const telemetryEngineRef = useRef<TelemetryEngine | null>(null);

  if (!solverRef.current) {
    solverRef.current = new NavierStokesSolver(160, 90);
  }
  if (!particlesRef.current) {
    particlesRef.current = new ParticleSystem(params.particleCount);
  }
  if (!telemetryEngineRef.current) {
    telemetryEngineRef.current = new TelemetryEngine();
  }

  const solver = solverRef.current;
  const particles = particlesRef.current;
  const telemetryEngine = telemetryEngineRef.current;

  // Telemetry state
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    reynolds: 60000,
    criticalReLower: 2000,
    criticalReUpper: 4000,
    regime: 'turbulent',
    inertialForce: 1440,
    viscousForce: 24,
    inertialPercent: 98.4,
    viscousPercent: 1.6,
    turbulenceIntensity: 8.2,
    wallShearStress: 0.035,
    frictionFactor: 0.02,
    strouhalNumber: 0.21,
    sheddingFrequency: 5.0,
    probeX: 0.55,
    probeY: 0.50,
    probeU: 1.2,
    probeV: 0.0,
    probeSpeed: 1.2,
    probeVorticity: 0.0,
    probePressure: 0.0,
    fps: 60,
    simTime: 0,
    cfl: 0.8,
  });

  const [profilePoints, setProfilePoints] = useState<VelocityProfilePoint[]>([]);

  // Sync particle count
  useEffect(() => {
    particles.setCount(params.particleCount);
  }, [params.particleCount, particles]);

  // Mode Selection Handler
  const handleSelectMode = (newMode: FlowMode) => {
    setMode(newMode);
    let newObs: ObstacleType = 'none';
    if (newMode === 'vortex') {
      newObs = 'cylinder';
    } else if (newMode === 'sandbox') {
      newObs = 'cylinder';
    }
    setObstacle(newObs);
    solver.initMode(newMode, newObs);
    solver.setPhysicalParams(
      params.density,
      params.viscosity,
      params.velocity,
      params.roughness / 100
    );
    particles.initParticles();
  };

  // Obstacle Selection Handler
  const handleSelectObstacle = (newObs: ObstacleType) => {
    setObstacle(newObs);
    solver.initMode(mode, newObs);
    solver.setPhysicalParams(
      params.density,
      params.viscosity,
      params.velocity,
      params.roughness / 100
    );
    particles.initParticles();
  };

  // Preset Selection Handler
  const handleSelectPreset = (key: FluidPresetKey) => {
    setPreset(key);
    if (key !== 'custom') {
      const vals = PRESET_VALUES[key];
      setParams((prev) => ({
        ...prev,
        density: vals.density ?? prev.density,
        viscosity: vals.viscosity ?? prev.viscosity,
      }));
    }
  };

  // Reset Simulation Field
  const handleReset = useCallback(() => {
    solver.initMode(mode, obstacle);
    solver.setPhysicalParams(
      params.density,
      params.viscosity,
      params.velocity,
      params.roughness / 100
    );
    particles.initParticles();
  }, [solver, mode, obstacle, params, particles]);

  // Clear Dye only
  const handleClearDye = useCallback(() => {
    solver.clearDye();
  }, [solver]);

  // Single Frame Step (when paused)
  const handleStepFrame = useCallback(() => {
    solver.setPhysicalParams(
      params.density,
      params.viscosity,
      params.velocity,
      params.roughness / 100
    );
    solver.step(0.02);
    particles.update(solver, 0.02);

    const { telemetry: newTelem, profilePoints: newPts } =
      telemetryEngine.computeTelemetry(
        params,
        mode,
        obstacle,
        solver,
        probeX,
        probeY,
        60,
        0.02
      );
    setTelemetry(newTelem);
    setProfilePoints(newPts);
  }, [solver, params, particles, telemetryEngine, mode, obstacle, probeX, probeY]);

  // Probe coordinate update
  const handleSetProbePosition = (x: number, y: number) => {
    setProbeX(x);
    setProbeY(y);
  };

  // Main Simulation Animation Loop
  const simTimeRef = useRef(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const currentFpsRef = useRef(60);

  useEffect(() => {
    let animId: number;

    const tick = () => {
      // Always update physical parameters in solver
      solver.setPhysicalParams(
        params.density,
        params.viscosity,
        params.velocity,
        params.roughness / 100
      );

      if (isPlaying) {
        simTimeRef.current += 0.02;
        solver.step(simTimeRef.current);
        particles.update(solver, 0.02);
      }

      // FPS tracking
      frameCountRef.current++;
      const now = performance.now();
      if (now - lastFpsTimeRef.current >= 600) {
        const delta = (now - lastFpsTimeRef.current) / 1000;
        currentFpsRef.current = Math.round(frameCountRef.current / delta);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;

        // Compute telemetry & velocity profile at throttled interval
        const { telemetry: telem, profilePoints: pts } =
          telemetryEngine.computeTelemetry(
            params,
            mode,
            obstacle,
            solver,
            probeX,
            probeY,
            currentFpsRef.current,
            simTimeRef.current
          );

        setTelemetry(telem);
        setProfilePoints(pts);
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    isPlaying,
    solver,
    particles,
    telemetryEngine,
    params,
    mode,
    obstacle,
    probeX,
    probeY,
  ]);

  // Fullscreen Listener & Toggle
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          setIsFullscreen((prev) => !prev);
        });
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  const handleToggleWideLayout = useCallback(() => {
    setIsWideLayout((prev) => !prev);
  }, []);

  return (
    <div className={`min-h-screen flex flex-col bg-sky-50/60 text-slate-900 ${isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : ''}`}>
      {/* 1. Top Navigation Bar (Hidden in pure fullscreen if desired, or compact) */}
      {!isFullscreen && (
        <TopNav
          currentMode={mode}
          onSelectMode={handleSelectMode}
          lang={lang}
          onToggleLang={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
          onReset={handleReset}
          onOpenTheory={() => setIsTheoryOpen(true)}
          isWideLayout={isWideLayout}
          onToggleWideLayout={handleToggleWideLayout}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}

      {/* 2. Main Dashboard Layout - Expanded downward height */}
      <main
        className={`flex-1 w-full mx-auto p-2 sm:p-3 lg:p-4 flex flex-col lg:flex-row gap-3 lg:gap-4 ${
          isFullscreen
            ? 'h-screen p-2 overflow-hidden'
            : 'min-h-[calc(100vh-62px)] lg:h-[calc(100vh-62px)] lg:min-h-[780px] max-w-[1850px] overflow-y-auto lg:overflow-hidden'
        }`}
      >
        {/* Left Sidebar (Collapsible in Wide View) */}
        {!isWideLayout ? (
          <LeftSidebar
            params={params}
            setParams={setParams}
            preset={preset}
            onSelectPreset={handleSelectPreset}
            layers={layers}
            setLayers={setLayers}
            mode={mode}
            obstacle={obstacle}
            setObstacle={handleSelectObstacle}
            telemetry={telemetry}
            lang={lang}
          />
        ) : (
          showLeftInWide && (
            <div className="fixed inset-y-16 left-4 z-40 w-[340px] shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="relative h-full flex flex-col">
                <button
                  onClick={() => setShowLeftInWide(false)}
                  className="absolute -right-3 top-3 z-50 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shadow-md"
                >
                  ✕
                </button>
                <LeftSidebar
                  params={params}
                  setParams={setParams}
                  preset={preset}
                  onSelectPreset={handleSelectPreset}
                  layers={layers}
                  setLayers={setLayers}
                  mode={mode}
                  obstacle={obstacle}
                  setObstacle={handleSelectObstacle}
                  telemetry={telemetry}
                  lang={lang}
                />
              </div>
            </div>
          )
        )}

        {/* Center CFD Viewport Canvas - Clean, maximized downwards layout */}
        <div className="relative flex-1 h-full flex flex-col min-w-0 min-h-[560px] lg:min-h-[640px]">
          <CFDCanvas
            solver={solver}
            particleSystem={particles}
            layers={layers}
            mode={mode}
            obstacle={obstacle}
            telemetry={telemetry}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            probeX={probeX}
            probeY={probeY}
            setProbePosition={handleSetProbePosition}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            onStepFrame={handleStepFrame}
            onReset={handleReset}
            onClearDye={handleClearDye}
            lang={lang}
            isWideLayout={isWideLayout}
            onToggleWideLayout={handleToggleWideLayout}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleLayer={(key) => setLayers((l) => ({ ...l, [key]: !l[key] }))}
            onToggleLeftDrawer={() => setShowLeftInWide(!showLeftInWide)}
            onToggleRightDrawer={() => setShowRightInWide(!showRightInWide)}
            showLeftDrawer={showLeftInWide}
            showRightDrawer={showRightInWide}
          />
        </div>

        {/* Right Telemetry & Prediction Panel (Collapsible in Wide View) */}
        {!isWideLayout ? (
          <RightTelemetry
            telemetry={telemetry}
            profilePoints={profilePoints}
            mode={mode}
            lang={lang}
          />
        ) : (
          showRightInWide && (
            <div className="fixed inset-y-16 right-4 z-40 w-[330px] shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="relative h-full flex flex-col">
                <button
                  onClick={() => setShowRightInWide(false)}
                  className="absolute -left-3 top-3 z-50 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shadow-md"
                >
                  ✕
                </button>
                <RightTelemetry
                  telemetry={telemetry}
                  profilePoints={profilePoints}
                  mode={mode}
                  lang={lang}
                />
              </div>
            </div>
          )
        )}
      </main>

      {/* 3. Physics & Equations Theory Modal */}
      <TheoryModal
        isOpen={isTheoryOpen}
        onClose={() => setIsTheoryOpen(false)}
        lang={lang}
      />
    </div>
  );
}
