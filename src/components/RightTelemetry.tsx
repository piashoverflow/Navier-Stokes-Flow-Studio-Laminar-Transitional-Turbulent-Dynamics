import React from 'react';
import { TelemetryData, VelocityProfilePoint, FlowMode } from '../types/cfd';
import { translations, Language } from '../locales/translations';
import {
  Activity,
  Gauge,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Info,
} from 'lucide-react';

interface RightTelemetryProps {
  telemetry: TelemetryData;
  profilePoints: VelocityProfilePoint[];
  mode: FlowMode;
  lang: Language;
}

export const RightTelemetry: React.FC<RightTelemetryProps> = ({
  telemetry,
  profilePoints,
  mode,
  lang,
}) => {
  const t = translations[lang];
  const { reynolds, regime, inertialPercent, viscousPercent } = telemetry;

  // Format Reynolds number neatly
  const formatRe = (num: number) => {
    if (num >= 1000000) {
      return num.toExponential(2);
    }
    return Math.round(num).toLocaleString();
  };

  // Helper for regime colors
  const getRegimeTheme = () => {
    if (regime === 'laminar') {
      return {
        badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        data: t.telemetry.regimes.laminar,
      };
    } else if (regime === 'transitional') {
      return {
        badgeBg: 'bg-amber-50 border-amber-300 text-amber-800',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        data: t.telemetry.regimes.transitional,
      };
    } else {
      return {
        badgeBg: 'bg-rose-50 border-rose-300 text-rose-800',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: <Zap className="w-4 h-4 text-rose-600" />,
        data: t.telemetry.regimes.turbulent,
      };
    }
  };

  const theme = getRegimeTheme();

  // SVG dimensions for the cross-sectional velocity profile graph
  const svgWidth = 280;
  const svgHeight = 160;
  const padding = { top: 12, right: 16, bottom: 22, left: 32 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  // Max U for scaling the graph
  let maxU = 0.1;
  profilePoints.forEach((p) => {
    if (p.actualU > maxU) maxU = p.actualU;
    if (p.laminarTheoryU > maxU) maxU = p.laminarTheoryU;
    if (p.turbulentTheoryU > maxU) maxU = p.turbulentTheoryU;
  });
  maxU = Math.max(0.5, maxU * 1.15);

  // Path generators for SVG
  // yNorm goes from -1 (bottom wall) to +1 (top wall)
  // svgY: -1 -> svgHeight - padding.bottom, +1 -> padding.top
  const getY = (yNorm: number) => {
    const norm01 = (yNorm + 1) / 2; // 0 (bottom) to 1 (top)
    return padding.top + (1 - norm01) * plotH;
  };

  const getX = (uVal: number) => {
    return padding.left + (Math.max(0, uVal) / maxU) * plotW;
  };

  // Measured curve path
  const measuredPath = profilePoints.reduce((acc, pt, i) => {
    const x = getX(pt.actualU);
    const y = getY(pt.yNorm);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Laminar theoretical curve path
  const laminarPath = profilePoints.reduce((acc, pt, i) => {
    const x = getX(pt.laminarTheoryU);
    const y = getY(pt.yNorm);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  // Turbulent theoretical curve path
  const turbulentPath = profilePoints.reduce((acc, pt, i) => {
    const x = getX(pt.turbulentTheoryU);
    const y = getY(pt.yNorm);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  return (
    <aside className="w-full lg:w-[330px] shrink-0 flex flex-col gap-3.5 overflow-y-auto custom-scrollbar pl-1 pb-4">
      {/* 1. Live Flow Nature Predictor Card */}
      <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            {t.telemetry.title}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {mode === 'pipe' ? 'PIPE Re' : 'WAKE Re'}
          </span>
        </div>

        {/* Huge High-Contrast Reynolds Number Readout */}
        <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200/80">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-slate-700 tracking-wide uppercase">
              {t.telemetry.reynoldsNum}
            </span>
            <span className="text-xs font-mono text-slate-500">Re = ρvD/μ</span>
          </div>

          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-slate-950 tracking-tight">
              {formatRe(reynolds)}
            </span>
            {reynolds > 10000 && (
              <span className="text-xs font-mono text-slate-500">
                ({reynolds.toExponential(2)})
              </span>
            )}
          </div>

          {/* Dynamic Regime Classification Badge */}
          <div className="mt-2.5 pt-2 border-t border-sky-200/60 flex items-center justify-between">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${theme.badgeBg}`}
            >
              {theme.icon}
              <span>{theme.data.badge}</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {regime === 'laminar'
                ? `< ${telemetry.criticalReLower}`
                : regime === 'transitional'
                ? `${telemetry.criticalReLower} - ${telemetry.criticalReUpper}`
                : `> ${telemetry.criticalReUpper}`}
            </span>
          </div>

          <p className="mt-2 text-[11px] text-slate-600 leading-snug">
            {theme.data.desc}
          </p>
        </div>

        {/* Ratio Breakdown Bar: Inertial vs Viscous forces */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
            <span>{t.telemetry.forcesBreakdown}</span>
            <span className="text-slate-500 font-mono text-[10px]">Ratio: (ρv²)/(μv/D)</span>
          </div>

          <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
            {/* Viscous part (Emerald) */}
            <div
              style={{ width: `${viscousPercent}%` }}
              title={`Viscous force: ${viscousPercent.toFixed(1)}%`}
              className="h-full bg-emerald-600 rounded-l-full transition-all duration-300"
            />
            {/* Inertial part (Crimson/Rose) */}
            <div
              style={{ width: `${inertialPercent}%` }}
              title={`Inertial force: ${inertialPercent.toFixed(1)}%`}
              className="h-full bg-rose-600 rounded-r-full transition-all duration-300"
            />
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono">
            <span className="text-emerald-700 font-medium">
              {t.telemetry.viscousLabel}: {viscousPercent.toFixed(0)}%
            </span>
            <span className="text-rose-700 font-medium">
              {t.telemetry.inertialLabel}: {inertialPercent.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Live Cross-Sectional Velocity Profile Graph u(y) */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            {t.telemetry.profileGraphTitle}
          </span>
          <span className="text-[10px] font-mono text-sky-700 font-medium">
            X = {telemetry.probeX.toFixed(2)}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-tight">
          {t.telemetry.profileSubtitle}
        </p>

        {/* SVG Plot */}
        <div className="relative bg-slate-50 rounded-xl border border-sky-200/80 p-1 flex justify-center">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible font-mono text-[9px]"
          >
            {/* Coordinate Grid lines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={svgHeight - padding.bottom}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />
            <line
              x1={padding.left}
              y1={svgHeight - padding.bottom}
              x2={svgWidth - padding.right}
              y2={svgHeight - padding.bottom}
              stroke="#94a3b8"
              strokeWidth="1.5"
            />

            {/* Horizontal centerline */}
            <line
              x1={padding.left}
              y1={padding.top + plotH / 2}
              x2={svgWidth - padding.right}
              y2={padding.top + plotH / 2}
              stroke="#cbd5e1"
              strokeDasharray="2,2"
            />

            {/* Axis Labels */}
            <text x={padding.left - 4} y={padding.top + 4} textAnchor="end" fill="#64748b">
              +R
            </text>
            <text x={padding.left - 4} y={padding.top + plotH / 2 + 3} textAnchor="end" fill="#64748b">
              0
            </text>
            <text
              x={padding.left - 4}
              y={svgHeight - padding.bottom}
              textAnchor="end"
              fill="#64748b"
            >
              -R
            </text>

            <text
              x={svgWidth - padding.right}
              y={svgHeight - padding.bottom + 14}
              textAnchor="end"
              fill="#64748b"
            >
              u (m/s)
            </text>
            <text x={padding.left} y={svgHeight - padding.bottom + 14} fill="#64748b">
              0
            </text>
            <text
              x={padding.left + plotW / 2}
              y={svgHeight - padding.bottom + 14}
              textAnchor="middle"
              fill="#64748b"
            >
              {(maxU * 0.5).toFixed(1)}
            </text>

            {/* Theoretical Laminar Parabola (Green Dashed) */}
            <path
              d={laminarPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              opacity={regime === 'laminar' ? 0.9 : 0.4}
            />

            {/* Theoretical Turbulent Power Law (Red Dashed) */}
            <path
              d={turbulentPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              opacity={regime === 'turbulent' ? 0.9 : 0.4}
            />

            {/* Actual Instantaneous Measured Profile (Navy/Cyan Solid Line) */}
            <path
              d={measuredPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono text-slate-600 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-sky-600 rounded-full" />
            <span>{t.telemetry.profileMeasured}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-emerald-600" />
            <span>{t.telemetry.profileLaminarCurve}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-rose-600" />
            <span>{t.telemetry.profileTurbulentCurve}</span>
          </div>
        </div>
      </div>

      {/* 3. Quantitative Telemetry Gauges */}
      <div className="bg-white rounded-2xl border border-sky-200 p-3.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-sky-100 pb-2">
          <span className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-sky-600" />
            পরিমাণগত পরিমাপক (Diagnostics)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Turbulence Intensity */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] text-slate-500 font-medium">
              {t.telemetry.gauges.turbulenceIntensity}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {telemetry.turbulenceIntensity.toFixed(1)}
              </span>
              <span className="text-[10px] font-mono text-slate-500">%</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  telemetry.turbulenceIntensity > 15
                    ? 'bg-rose-500'
                    : telemetry.turbulenceIntensity > 5
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, telemetry.turbulenceIntensity * 3)}%` }}
              />
            </div>
          </div>

          {/* Darcy Friction Factor */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] text-slate-500 font-medium">
              {t.telemetry.gauges.frictionFactor}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {telemetry.frictionFactor.toFixed(4)}
              </span>
              <span className="text-[10px] font-mono text-slate-500">f</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {regime === 'laminar' ? 'f = 64/Re' : 'Blasius / Colebrook'}
            </div>
          </div>

          {/* Wall Shear Stress */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] text-slate-500 font-medium">
              {t.telemetry.gauges.wallShear}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {telemetry.wallShearStress < 0.01
                  ? telemetry.wallShearStress.toExponential(2)
                  : telemetry.wallShearStress.toFixed(3)}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Pa</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">τw = (f/8)ρv²</div>
          </div>

          {/* Vortex Shedding Frequency / Strouhal */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="text-[10px] text-slate-500 font-medium">
              {t.telemetry.gauges.sheddingFreq}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                {telemetry.sheddingFrequency > 0
                  ? telemetry.sheddingFrequency.toFixed(1)
                  : '0.0'}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Hz</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              St = {telemetry.strouhalNumber.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
