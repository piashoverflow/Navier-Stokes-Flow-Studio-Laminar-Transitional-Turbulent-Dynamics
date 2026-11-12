import React from 'react';
import { translations, Language } from '../locales/translations';
import { X, BookOpen, Atom, Activity, Zap } from 'lucide-react';

interface TheoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const TheoryModal: React.FC<TheoryModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-sky-200 shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100 bg-sky-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">
                {lang === 'bn'
                  ? 'পদার্থবিজ্ঞান নির্দেশিকা: ফ্লুইড ডায়নামিক্স ও রেনল্ডস সংখ্যা'
                  : 'Physics Guide: Fluid Dynamics & Reynolds Number Theory'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'bn'
                  ? 'গাণিতিক ভিত্তি, বাস্তব প্রয়োগ ও ল্যামিনার-টার্বুলেন্ট রূপান্তর'
                  : 'Mathematical Foundations, Transition Mechanisms & Governing Laws'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-sm text-slate-800 leading-relaxed">
          {/* Section 1: Navier-Stokes System */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <Atom className="w-4 h-4 text-sky-600" />
              <span>
                {lang === 'bn'
                  ? '১. ইনকম্প্রেসিবল ন্যাভিয়ার-স্টোকস সমীকরণ (Incompressible Navier-Stokes)'
                  : '1. Incompressible Navier-Stokes Equations'}
              </span>
            </h3>

            <div className="p-4 bg-slate-900 rounded-xl text-white font-mono text-xs space-y-2 border border-slate-800">
              <div className="text-sky-300 font-bold">
                ∂u/∂t + (u · ∇)u = -¹/ρ ∇p + ν ∇²u + f
              </div>
              <div className="text-emerald-300 font-bold">∇ · u = 0 (Continuity)</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                <span className="font-bold text-slate-900 font-mono">(u · ∇)u</span>
                <p className="text-slate-600 mt-0.5">
                  {lang === 'bn'
                    ? 'কনভেক্টিভ জড়তা ত্বরণ (Inertial Convection): প্রবাহী কণার নিজস্ব ভরবেগ সঞ্চালন, যা উচ্চ গতিতে অশান্ত ঘূর্ণি তৈরি করে।'
                    : 'Convective Inertial Acceleration: Transports momentum and drives non-linear turbulence energy cascades.'}
                </p>
              </div>

              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-100">
                <span className="font-bold text-slate-900 font-mono">ν ∇²u</span>
                <p className="text-slate-600 mt-0.5">
                  {lang === 'bn'
                    ? 'সান্দ্র ব্যাপন (Viscous Diffusion): অভ্যন্তরীণ ঘর্ষণজনিত প্রতিরোধ, যা যেকোনো বিশৃঙ্খলা বা ঘূর্ণিকে মিলিয়ে দিয়ে শান্ত প্রবাহ রক্ষা করে।'
                    : 'Viscous Diffusion: Friction damping term that diffuses momentum and suppresses instabilities in laminar regimes.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Reynolds Number Definition */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>
                {lang === 'bn'
                  ? '২. রেনল্ডস সংখ্যার ভৌত অর্থ (Physical Significance of Reynolds Number)'
                  : '2. Physical Significance of Reynolds Number'}
              </span>
            </h3>

            <p className="text-xs text-slate-600">
              {lang === 'bn'
                ? '১৮৮৩ সালে বিজ্ঞানী অসবর্ন রেনল্ডস (Osborne Reynolds) কাচের নলের ভেতর পানির সাথে কালির সরু রেখা প্রবেশ করিয়ে প্রথম দেখান যে, প্রবাহ শান্ত থাকবে নাকি অশান্ত হয়ে যাবে তা একটি মাত্র মাত্রাহীন রাশি দ্বারা নির্ধারিত হয়:'
                : 'In 1883, Osborne Reynolds famously demonstrated that the transition from smooth laminar flow to turbulent chaos depends strictly on a single dimensionless parameter:'}
            </p>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between font-mono text-xs">
              <span className="font-bold text-emerald-950 text-sm">
                Re = (ρ · v · D) / μ = (v · D) / ν
              </span>
              <span className="text-emerald-800 font-sans text-xs">
                = (জড়তা বল / সান্দ্র বল)
              </span>
            </div>

            <ul className="text-xs space-y-1.5 list-disc pl-5 text-slate-700">
              <li>
                <strong>{lang === 'bn' ? 'ল্যামিনার (শান্ত প্রবাহ, Re < 2000):' : 'Laminar Flow (Re < 2000):'}</strong>{' '}
                {lang === 'bn'
                  ? 'সান্দ্র বল জড়তা বল অপেক্ষা অত্যন্ত শক্তিশালী। প্রবাহ সমান্তরাল স্তরে স্তরে প্রবাহিত হয়, কোনো ক্রস-মিক্সিং হয় না।'
                  : 'Viscous forces completely dominate. Fluid particles move along smooth, non-crossing streamlines.'}
              </li>
              <li>
                <strong>{lang === 'bn' ? 'ক্রান্তীয় (Transitional, 2000 ≤ Re ≤ 4000):' : 'Transitional Flow (2000 ≤ Re ≤ 4000):'}</strong>{' '}
                {lang === 'bn'
                  ? 'সংকট রেনল্ডস সংখ্যা অতিক্রম করায় ছোট ব্যাঘাতগুলো সান্দ্রতা পুরোপুরি থামাতে পারে না। পর্যায়ক্রমিক দোলন দেখা দেয়।'
                  : 'Critical threshold where small perturbations are no longer fully damped, causing growing wave oscillations.'}
              </li>
              <li>
                <strong>{lang === 'bn' ? 'বিক্ষুব্ধ (Turbulent, Re > 4000):' : 'Turbulent Flow (Re > 4000):'}</strong>{' '}
                {lang === 'bn'
                  ? 'জড়তা বলের তীব্র প্রাধান্য। কলমোগোরভ স্কেল অনুযায়ী বিশৃঙ্খল 3D ঘূর্ণির ভাঙন ও তীব্র মিশ্রণ ঘটে।'
                  : 'Inertia dominates; flow undergoes chaotic mixing, boundary layer separation, and multi-scale vortex cascades.'}
              </li>
            </ul>
          </div>

          {/* Section 3: Parabolic Poiseuille vs Blunt Turbulent Profile */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>
                {lang === 'bn'
                  ? '৩. বেগ প্রোফাইল: প্যারাবোলিক বনাম ব্লান্ট টার্বুলেন্ট প্রোফাইল'
                  : '3. Velocity Profiles: Parabolic Poiseuille vs Blunt Turbulent Profile'}
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-emerald-700 font-mono">
                  Laminar Poiseuille: u(r) = u_max(1 - r²/R²)
                </span>
                <p className="text-slate-600 mt-1">
                  {lang === 'bn'
                    ? 'নলের দেয়ালে বেগ শূন্য (No-slip boundary) এবং কেন্দ্রে বেগ সর্বোচ্চ। সান্দ্রতার কারণে প্রোফাইলটি নিখুঁত প্যারাবোলা হয়।'
                    : 'Viscosity enforces zero slip at walls and parabolic curvature with peak velocity at the pipe centerline (u_max = 2*u_avg).'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-rose-700 font-mono">
                  Turbulent: u(y) = u_max (y/R)^(1/7)
                </span>
                <p className="text-slate-600 mt-1">
                  {lang === 'bn'
                    ? 'টার্বুলেন্ট এডিগুলোর তীব্র আড়াআড়ি মিশ্রণের কারণে কেন্দ্রের বেগ পুরো নলে ছড়িয়ে পড়ে ফ্ল্যাট বা ব্লান্ট প্রোফাইল তৈরি করে।'
                    : 'Intense cross-stream eddy mixing homogenizes the core, producing a steep wall gradient and blunt flat velocity plateau.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-sky-100 bg-sky-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            {lang === 'bn' ? 'বুঝেছি (Close)' : 'Close Guide'}
          </button>
        </div>
      </div>
    </div>
  );
};
