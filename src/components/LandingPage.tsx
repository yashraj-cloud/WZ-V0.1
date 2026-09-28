import { ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0f1117] text-[#f0f2f8] font-sans antialiased flex flex-col justify-between select-none relative overflow-hidden">
      {/* Subtle animated background blobs: 5-8% opacity in deep purple (#7c6af7) and cyan (#00d4ff) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-[120px] animate-blob-1"
          style={{
            background: 'radial-gradient(circle, rgba(124, 106, 247, 0.07) 0%, rgba(124, 106, 247, 0) 70%)',
          }}
        />
        <div
          className="absolute top-1/2 right-1/4 translate-x-1/3 -translate-y-1/3 w-[600px] h-[600px] rounded-full blur-[140px] animate-blob-2"
          style={{
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.06) 0%, rgba(0, 212, 255, 0) 70%)',
          }}
        />
      </div>

      {/* Top Navigation Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-4 flex items-center justify-between z-10">
        <div
          onClick={() => onNavigate('/')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* Logo 32px gradient square */}
          <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-[#00d4ff] to-[#7c6af7] flex items-center justify-center text-white font-bold font-mono text-sm tracking-wide shadow-sm group-hover:opacity-90 transition-opacity">
            W
          </div>
          <span className="font-bold text-sm text-white tracking-tight font-sans">
            WorkerZero
          </span>
        </div>

        <nav className="flex items-center gap-3 font-sans text-xs">
          <button
            onClick={() => onNavigate('/integrate')}
            className="px-3 py-1.5 rounded-[6px] text-[#8b92a8] hover:text-[#f0f2f8] transition-colors cursor-pointer"
          >
            INTEGRATE
          </button>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-3.5 py-1.5 rounded-[6px] bg-[#1a1d27] hover:bg-[#212435] text-[#00d4ff] border border-[#2a2d3e] hover:border-[#00d4ff]/40 font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>DASHBOARD</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </nav>
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-6 py-12 z-10">
        {/* Logo — a rounded square 56px with a gradient fill from #00d4ff to #7c6af7, white W inside bold */}
        <div className="w-14 h-14 rounded-[12px] bg-gradient-to-br from-[#00d4ff] to-[#7c6af7] flex items-center justify-center text-white font-bold font-mono text-2xl shadow-[0_4px_24px_rgba(0,212,255,0.25)] mb-7 select-none">
          W
        </div>

        {/* Headline — "WorkerZero" in 64px bold Inter, white. Letter spacing -0.03em */}
        <h1 className="text-[48px] sm:text-[64px] font-bold text-white tracking-[-0.03em] font-sans leading-none mb-4">
          WorkerZero
        </h1>

        {/* Subheadline — "Runtime Policy Enforcement for Autonomous Enterprises" in 20px, secondary text color */}
        <h2 className="text-[18px] sm:text-[20px] font-normal text-[#8b92a8] font-sans tracking-normal mb-5 max-w-xl">
          Runtime Policy Enforcement for Autonomous Enterprises
        </h2>

        {/* Description paragraph — 16px, secondary text, max width 560px centered */}
        <p className="text-[15px] sm:text-[16px] text-[#8b92a8] leading-relaxed max-w-[560px] mx-auto mb-10 font-sans">
          WorkerZero intercepts every AI agent tool call before it executes — blocking
          dangerous actions, redacting sensitive data, and logging everything with
          cryptographic audit trails.
        </p>

        {/* Button — "Launch Live Demo →" large pill button, gradient background from #00d4ff to #7c6af7, white text bold, 52px height, 32px horizontal padding. Subtle glow on hover: box-shadow: 0 0 32px rgba(0,212,255,0.3) */}
        <button
          onClick={() => onNavigate('/dashboard')}
          className="group h-[52px] px-[32px] rounded-full bg-gradient-to-r from-[#00d4ff] to-[#7c6af7] hover:from-[#00d4ff] hover:to-[#6d5af0] text-white font-bold font-sans text-sm tracking-wide transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.18)] hover:shadow-[0_0_32px_rgba(0,212,255,0.3)] flex items-center gap-2.5 cursor-pointer mb-10 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>Launch Live Demo</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Three stat pills below button — each pill has a thin border #2a2d3e, background #1a1d27, text in cyan. Arranged in a row with gap */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="px-4 py-1.5 rounded-full bg-[#1a1d27] border border-[#2a2d3e] text-xs font-mono text-[#8b92a8] wz-card-shadow">
            <span className="text-[#00d4ff] font-bold">&lt; 5ms</span> latency
          </div>
          <div className="px-4 py-1.5 rounded-full bg-[#1a1d27] border border-[#2a2d3e] text-xs font-mono text-[#8b92a8] wz-card-shadow">
            <span className="text-[#00d4ff] font-bold">100%</span> tool calls intercepted
          </div>
          <div className="px-4 py-1.5 rounded-full bg-[#1a1d27] border border-[#2a2d3e] text-xs font-mono text-[#8b92a8] wz-card-shadow">
            <span className="text-[#00d4ff] font-bold">Zero</span> agent bypasses
          </div>
        </div>
      </main>

      {/* Footer — "workerzero.ai" in muted text, small */}
      <footer className="text-center py-5 z-10">
        <span className="text-xs font-mono text-[#4a5070] hover:text-[#8b92a8] transition-colors tracking-wider">
          workerzero.ai
        </span>
      </footer>
    </div>
  );
}
