import React from 'react';
import { FlowMode } from '../types/cfd';
import { translations, Language } from '../locales/translations';
import { RotateCcw, BookOpen, Waves, Wind, Beaker, Maximize2, Minimize2, Expand, Shrink } from 'lucide-react';

interface TopNavProps {
  currentMode: FlowMode;
  onSelectMode: (mode: FlowMode) => void;
  lang: Language;
  onToggleLang: () => void;
  onReset: () => void;
  onOpenTheory: () => void;
  isWideLayout: boolean;
  onToggleWideLayout: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentMode,
  onSelectMode,
  lang,
  onToggleLang,
  onReset,
  onOpenTheory,
  isWideLayout,
  onToggleWideLayout,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const t = translations[lang];

  return (
    <header className="w-full bg-white border-b border-sky-200 px-4 lg:px-6 py-2.5 shadow-xs sticky top-0 z-30">
      <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
        {/* Left: Studio Title & Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-600 flex items-center justify-center text-white shadow-xs">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-extrabold text-slate-950 tracking-tight leading-none whitespace-nowrap">
              {t.appTitle}
            </h1>
            <p className="text-[11px] font-medium text-slate-500 hidden sm:block leading-tight mt-0.5">
              {t.appSubtitle}
            </p>
          </div>
        </div>

        {/* Center: 3 Interactive Experiment Modes */}
        <nav className="flex items-center gap-1.5 p-1 bg-sky-50/90 border border-sky-200 rounded-xl overflow-x-auto">
          <button
            onClick={() => onSelectMode('pipe')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              currentMode === 'pipe'
                ? 'bg-white text-emerald-800 shadow-xs border border-sky-200/60'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
            }`}
            title={t.modes.pipe.desc}
          >
            <Wind className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.modes.pipe.shortTitle}</span>
          </button>

          <button
            onClick={() => onSelectMode('vortex')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              currentMode === 'vortex'
                ? 'bg-white text-emerald-800 shadow-xs border border-sky-200/60'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
            }`}
            title={t.modes.vortex.desc}
          >
            <Waves className="w-3.5 h-3.5 text-sky-600" />
            <span>{t.modes.vortex.shortTitle}</span>
          </button>

          <button
            onClick={() => onSelectMode('sandbox')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              currentMode === 'sandbox'
                ? 'bg-white text-emerald-800 shadow-xs border border-sky-200/60'
                : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
            }`}
            title={t.modes.sandbox.desc}
          >
            <Beaker className="w-3.5 h-3.5 text-amber-600" />
            <span>{t.modes.sandbox.shortTitle}</span>
          </button>
        </nav>

        {/* Right: Language Switcher, Reset, Theory & Institution Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Simulation Zone Expansion / Wide View Button */}
          <button
            onClick={onToggleWideLayout}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isWideLayout
                ? 'bg-sky-100 border-sky-300 text-sky-900 shadow-2xs'
                : 'bg-white border-sky-200 text-slate-700 hover:text-slate-950 hover:bg-sky-50'
            }`}
            title={isWideLayout ? t.actions.layoutStandard : t.actions.layoutWide}
          >
            {isWideLayout ? <Shrink className="w-3.5 h-3.5 text-sky-700" /> : <Expand className="w-3.5 h-3.5 text-sky-700" />}
            <span className="hidden sm:inline">
              {isWideLayout ? t.actions.layoutStandard : t.actions.layoutWide}
            </span>
          </button>

          {/* Full Screen Mode Button */}
          <button
            onClick={onToggleFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              isFullscreen
                ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                : 'bg-white border-sky-200 text-slate-700 hover:text-slate-950 hover:bg-sky-50'
            }`}
            title={isFullscreen ? t.actions.exitFullscreen : t.actions.fullscreen}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-emerald-700" />}
            <span className="hidden sm:inline">
              {isFullscreen ? t.actions.exitFullscreen : t.actions.fullscreen}
            </span>
          </button>

          {/* Theory Modal Button */}
          <button
            onClick={onOpenTheory}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-sky-50 hover:bg-sky-100 hover:text-slate-950 rounded-lg border border-sky-200 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-700" />
            <span>{t.actions.theoryModal}</span>
          </button>

          {/* Reset Fluid Field button */}
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-sky-200 transition-colors"
            title={t.actions.reset}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t.actions.reset}</span>
          </button>

          {/* Instant Language Switcher ("বাংলা" default / "English" toggle) */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
            title="Switch Language / ভাষা পরিবর্তন"
          >
            <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>

          {/* Bold Red Institution Badge as specified */}
          <span className="bg-rose-50 border border-rose-300 text-rose-600 font-extrabold px-3 py-1 rounded-full text-sm shrink-0">
            {t.institutionBadge}
          </span>
        </div>
      </div>
    </header>
  );
};
