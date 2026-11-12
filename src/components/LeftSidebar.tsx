import React from 'react';
import {
  FluidPhysicalParams,
  FluidPresetKey,
  VisualizationLayers,
  FlowMode,
  ObstacleType,
  TelemetryData,
} from '../types/cfd';
import { translations, Language } from '../locales/translations';
import {
  Eye,
  Layers,
  Sliders,
  Flame,
  Circle,
  Square,
  Compass,
  GitCommit,
  Check,
  Triangle,
  Columns,
  Minus,
  SlidersHorizontal,
  Grid,
  Gauge,
} from 'lucide-react';

interface LeftSidebarProps {
  params: FluidPhysicalParams;
  setParams: React.Dispatch<React.SetStateAction<FluidPhysicalParams>>;
  preset: FluidPresetKey;
  onSelectPreset: (key: FluidPresetKey) => void;
  layers: VisualizationLayers;
  setLayers: React.Dispatch<React.SetStateAction<VisualizationLayers>>;
  mode: FlowMode;
  obstacle: ObstacleType;
  setObstacle: (obs: ObstacleType) => void;
  telemetry: TelemetryData;
  lang: Language;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  params,
  setParams,
  preset,
  onSelectPreset,
  layers,
  setLayers,
  mode,
  obstacle,
  setObstacle,
  telemetry,
  lang,
}) => {
  const t = translations[lang];

  // Helper for progressive emerald slider track gradient
  const getSliderStyle = (val: number, min: number, max: number) => {
    const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    return {
      background: `linear-gradient(to right, #059669 0%, #059669 ${percent}%, #d1fae5 ${percent}%, #d1fae5 100%)`,
    };
  };

  // Viscosity uses logarithmic mapping for comfortable slider scrubbing across 1e-5 to 2.0
  const logMin = Math.log10(1e-5);
  const logMax = Math.log10(2.0);
  const currentLogVisc = Math.log10(Math.max(1e-5, params.viscosity));
  const viscPercent = ((currentLogVisc - logMin) / (logMax - logMin)) * 100;
  const viscSliderStyle = {
    background: `linear-gradient(to right, #059669 0%, #059669 ${viscPercent}%, #d1fae5 ${viscPercent}%, #d1fae5 100%)`,
  };

  const handleViscosityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseFloat(e.target.value); // 0 to 100
    const logVal = logMin + (pos / 100) * (logMax - logMin);
    const newVisc = Math.pow(10, logVal);
    setParams((prev) => ({ ...prev, viscosity: newVisc }));
  };

  // Direct Reynolds Number mapping across Re = 10 to 200,000
  const logReMin = Math.log10(10);
  const logReMax = Math.log10(200000);
  const currentLogRe = Math.log10(Math.max(10, telemetry.reynolds));
  const rePercent = Math.max(0, Math.min(100, ((currentLogRe - logReMin) / (logReMax - logReMin)) * 100));
  const reSliderStyle = {
    background: `linear-gradient(to right, #059669 0%, #059669 ${rePercent}%, #d1fae5 ${rePercent}%, #d1fae5 100%)`,
  };

  const handleDirectReynoldsChange = (targetRe: number) => {
    const currentRho = params.density;
    const currentD = params.diameter;
    // Re = rho * v * D / mu => v = (Re * mu) / (rho * D)
    const targetV = (targetRe * params.viscosity) / (currentRho * currentD);

    if (targetV >= 0.05 && targetV <= 10.0) {
      setParams((prev) => ({ ...prev, velocity: parseFloat(targetV.toFixed(2)) }));
    } else if (targetV > 10.0) {
      // Adjust viscosity when velocity would exceed 10 m/s
      const vFixed = 6.0;
      const neededVisc = (currentRho * vFixed * currentD) / targetRe;
      setParams((prev) => ({
        ...prev,
        velocity: vFixed,
        viscosity: Math.max(1e-5, Math.min(2.0, neededVisc)),
      }));
    } else {
      const vFixed = 0.5;
      const neededVisc = (currentRho * vFixed * currentD) / targetRe;
      setParams((prev) => ({
        ...prev,
        velocity: vFixed,
        viscosity: Math.max(1e-5, Math.min(2.0, neededVisc)),
      }));
    }
  };

  const handleReSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pos = parseFloat(e.target.value);
    const logVal = logReMin + (pos / 100) * (logReMax - logReMin);
    const newRe = Math.pow(10, logVal);
    handleDirectReynoldsChange(newRe);
  };

  return (
    <aside className="w-full lg:w-[340px] shrink-0 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar pr-1 pb-4">
      {/* 1. Fluid Physical Presets */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            {t.presets.label}
          </span>
          <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            {preset.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onSelectPreset('air')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left border transition-all ${
              preset === 'air'
                ? 'bg-sky-50/80 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-bold">{t.presets.air}</div>
            <div className="text-[10px] text-slate-500 font-mono">ρ: 1.2 · μ: 1.8e-5</div>
          </button>

          <button
            onClick={() => onSelectPreset('water')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left border transition-all ${
              preset === 'water'
                ? 'bg-sky-50/80 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-bold">{t.presets.water}</div>
            <div className="text-[10px] text-slate-500 font-mono">ρ: 1000 · μ: 0.001</div>
          </button>

          <button
            onClick={() => onSelectPreset('oil')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left border transition-all ${
              preset === 'oil'
                ? 'bg-sky-50/80 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-bold">{t.presets.oil}</div>
            <div className="text-[10px] text-slate-500 font-mono">ρ: 880 · μ: 0.29</div>
          </button>

          <button
            onClick={() => onSelectPreset('glycerin')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left border transition-all ${
              preset === 'glycerin'
                ? 'bg-sky-50/80 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-slate-50'
            }`}
          >
            <div className="text-[11px] font-bold">{t.presets.glycerin}</div>
            <div className="text-[10px] text-slate-500 font-mono">ρ: 1260 · μ: 1.49</div>
          </button>
        </div>
      </div>

      {/* 2. Governing Physical Parameters (Progressive Deep-Green Sliders) */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-emerald-600" />
            {t.parameters.title}
          </span>
        </div>

        {/* Velocity Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.velocity}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.velocity.toFixed(2)} m/s
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="10.0"
            step="0.05"
            value={params.velocity}
            style={getSliderStyle(params.velocity, 0.05, 10.0)}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, velocity: parseFloat(e.target.value) }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0.05 m/s</span>
            <span>10.0 m/s</span>
          </div>
        </div>

        {/* Characteristic Diameter / Width D */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.diameter}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.diameter.toFixed(2)} m
            </span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.50"
            step="0.01"
            value={params.diameter}
            style={getSliderStyle(params.diameter, 0.01, 0.5)}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, diameter: parseFloat(e.target.value) }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0.01 m</span>
            <span>0.50 m</span>
          </div>
        </div>

        {/* Dynamic Viscosity (Logarithmic) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.viscosity}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.viscosity < 0.001
                ? params.viscosity.toExponential(2)
                : params.viscosity.toFixed(3)}{' '}
              Pa·s
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={viscPercent}
            style={viscSliderStyle}
            onChange={handleViscosityChange}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>10⁻⁵ Pa·s (Air)</span>
            <span>2.0 Pa·s (Heavy)</span>
          </div>
        </div>

        {/* Fluid Density rho */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.density}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.density.toFixed(0)} kg/m³
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="1500"
            step="10"
            value={params.density}
            style={getSliderStyle(params.density, 1, 1500)}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, density: parseFloat(e.target.value) }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>1 kg/m³</span>
            <span>1500 kg/m³</span>
          </div>
        </div>

        {/* Surface Roughness / Perturbation */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.roughness}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.roughness.toFixed(0)} %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={params.roughness}
            style={getSliderStyle(params.roughness, 0, 100)}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, roughness: parseFloat(e.target.value) }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>0% (Smooth Wall)</span>
            <span>100% (High Disturbance)</span>
          </div>
        </div>

        {/* Active Tracer Particle Count */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.particleCount}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-[13px]">
              {params.particleCount}
            </span>
          </div>
          <input
            type="range"
            min="500"
            max="8000"
            step="250"
            value={params.particleCount}
            style={getSliderStyle(params.particleCount, 500, 8000)}
            onChange={(e) =>
              setParams((prev) => ({ ...prev, particleCount: parseInt(e.target.value) }))
            }
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>500</span>
            <span>8,000</span>
          </div>
        </div>
      </div>

      {/* 2B. Direct Reynolds Number (Re) Control Card */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-sky-600" />
            {t.parameters.directReTitle}
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            Re = {Math.round(telemetry.reynolds).toLocaleString()}
          </span>
        </div>

        {/* Direct Logarithmic Reynolds Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800">{t.parameters.reynoldsControl}</label>
            <span className="font-mono tabular-nums font-bold text-emerald-800 text-xs">
              {telemetry.reynolds > 9999 ? telemetry.reynolds.toExponential(2) : Math.round(telemetry.reynolds)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={rePercent}
            style={reSliderStyle}
            onChange={handleReSliderChange}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-slate-600 font-mono">
            <span>Re = 10 (Laminar)</span>
            <span>Re = 200,000 (Turbulent)</span>
          </div>
        </div>

        {/* Quick Re Preset Buttons */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {lang === 'bn' ? 'তাত্ক্ষণিক Re মান প্রিসেট' : 'Quick Reynolds Presets'}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => handleDirectReynoldsChange(120)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Creeping laminar flow"
            >
              Re = 120
            </button>
            <button
              onClick={() => handleDirectReynoldsChange(800)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Poiseuille laminar pipe flow"
            >
              Re = 800
            </button>
            <button
              onClick={() => handleDirectReynoldsChange(2800)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
              title="Critical transition threshold"
            >
              Re = 2,800
            </button>
            <button
              onClick={() => handleDirectReynoldsChange(8500)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors"
              title="Early turbulent mixing"
            >
              Re = 8,500
            </button>
            <button
              onClick={() => handleDirectReynoldsChange(35000)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors"
              title="High Reynolds turbulence"
            >
              Re = 35k
            </button>
            <button
              onClick={() => handleDirectReynoldsChange(120000)}
              className="px-1.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-colors"
              title="Fully developed chaotic turbulence"
            >
              Re = 120k
            </button>
          </div>
        </div>
      </div>

      {/* 3. Obstacle Selector (Mode 2 & 3) */}
      {(mode === 'vortex' || mode === 'sandbox') && (
        <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              {t.parameters.obstacles}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setObstacle('cylinder')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'cylinder'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Circle className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.cylinder}</span>
            </button>

            <button
              onClick={() => setObstacle('airfoil')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'airfoil'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.airfoil}</span>
            </button>

            <button
              onClick={() => setObstacle('square')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'square'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Square className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.square}</span>
            </button>

            <button
              onClick={() => setObstacle('venturi')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'venturi'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <GitCommit className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.venturi}</span>
            </button>

            {/* Additional Obstacles */}
            <button
              onClick={() => setObstacle('wedge')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'wedge'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Triangle className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.wedge}</span>
            </button>

            <button
              onClick={() => setObstacle('dual_cylinder')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'dual_cylinder'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.dual_cylinder}</span>
            </button>

            <button
              onClick={() => setObstacle('flat_plate')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'flat_plate'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Minus className="w-3.5 h-3.5 text-sky-600 rotate-90" />
              <span>{t.parameters.flat_plate}</span>
            </button>

            <button
              onClick={() => setObstacle('baffle')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'baffle'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.baffle}</span>
            </button>

            <button
              onClick={() => setObstacle('porous_grid')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'porous_grid'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.parameters.porous_grid}</span>
            </button>

            <button
              onClick={() => setObstacle('none')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                obstacle === 'none'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold shadow-2xs'
                  : 'border-slate-200 text-slate-700 hover:border-sky-300'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full border border-dashed border-slate-400" />
              <span>{t.parameters.none}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Visualization Layer Switches */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            {t.layers.title}
          </span>
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs">
            <span className="font-medium text-slate-800">{t.layers.dye}</span>
            <button
              type="button"
              onClick={() => setLayers((l) => ({ ...l, showDye: !l.showDye }))}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showDye ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs">
            <span className="font-medium text-slate-800">{t.layers.particles}</span>
            <button
              type="button"
              onClick={() => setLayers((l) => ({ ...l, showParticles: !l.showParticles }))}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showParticles ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs">
            <span className="font-medium text-slate-800">{t.layers.vorticity}</span>
            <button
              type="button"
              onClick={() => setLayers((l) => ({ ...l, showVorticity: !l.showVorticity }))}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showVorticity ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>

          {/* Fluid Rotation Micro-Rotors & Swirl Spinners */}
          <label className="flex items-center justify-between p-2 rounded-xl border border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/70 cursor-pointer transition-colors text-xs">
            <div className="flex flex-col">
              <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span className="text-emerald-700 animate-spin">⚙️</span>
                <span>{t.layers.rotations}</span>
              </span>
              <span className="text-[10px] text-emerald-700/80">
                {lang === 'bn' ? 'ঘূর্ণন গতিশীল স্পিনার ও ঘূর্ণি বলয়' : 'Spinning micro-rotors & vortex rings'}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setLayers((l) => ({ ...l, showRotationSpinners: !l.showRotationSpinners }))
              }
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showRotationSpinners ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs">
            <span className="font-medium text-slate-800">{t.layers.vectors}</span>
            <button
              type="button"
              onClick={() => setLayers((l) => ({ ...l, showVectors: !l.showVectors }))}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showVectors ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-sky-50/50 cursor-pointer transition-colors text-xs">
            <span className="font-medium text-slate-800">{t.layers.pressure}</span>
            <button
              type="button"
              onClick={() => setLayers((l) => ({ ...l, showPressure: !l.showPressure }))}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                layers.showPressure ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
            </button>
          </label>
        </div>
      </div>

      {/* 5. Live Governing Navier-Stokes Equations Card */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-sky-600" />
            {t.equations.title}
          </span>
        </div>

        <div className="p-3 bg-slate-900 rounded-xl text-white font-mono text-[11px] space-y-2 border border-slate-800 shadow-inner">
          {/* Momentum Equation */}
          <div>
            <div className="text-[10px] text-slate-400 font-sans mb-1 font-semibold">
              {t.equations.momentum}:
            </div>
            <div className="flex items-center flex-wrap gap-1 leading-relaxed">
              <span className="text-slate-300">∂u/∂t +</span>
              <span
                className={`px-1 py-0.5 rounded transition-colors ${
                  telemetry.regime === 'turbulent'
                    ? 'bg-rose-500/30 text-rose-300 font-bold border border-rose-500/40'
                    : 'text-amber-300'
                }`}
                title="Convective Inertial Acceleration (u·∇)u"
              >
                (u·∇)u
              </span>
              <span className="text-slate-300">= -¹/ρ ∇p +</span>
              <span
                className={`px-1 py-0.5 rounded transition-colors ${
                  telemetry.regime === 'laminar'
                    ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40'
                    : 'text-slate-300'
                }`}
                title="Viscous Diffusion ν ∇²u"
              >
                ν ∇²u
              </span>
              <span className="text-slate-400">+ f</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-1.5 flex justify-between items-center text-[10px]">
            <span className="text-slate-400 font-sans">{t.equations.continuity}:</span>
            <span className="text-sky-300 font-bold">∇ · u = 0</span>
          </div>

          {/* Dynamic Dominance indicator */}
          <div className="bg-slate-800/80 p-1.5 rounded-lg text-[10px] flex items-center gap-2">
            <span className="text-slate-400">প্রভাবশালী বল:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                telemetry.regime === 'laminar'
                  ? 'text-emerald-400'
                  : telemetry.regime === 'transitional'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              <Check className="w-3 h-3" />
              {telemetry.regime === 'laminar'
                ? 'সান্দ্র বল (Viscous Damping ν∇²u)'
                : telemetry.regime === 'transitional'
                ? 'উভয় বল সমান (Equilibrium & Instability)'
                : 'জড়তা বল (Inertial Convection (u·∇)u)'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
