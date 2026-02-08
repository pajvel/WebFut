type BootSplashProps = {
  progress: number;
  stage: string;
  canFastFinish?: boolean;
  onFastFinish?: () => void;
};

export function BootSplash({ progress, stage, canFastFinish = false, onFastFinish }: BootSplashProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={`fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden ${canFastFinish ? "cursor-pointer" : ""}`}
      onClick={canFastFinish ? onFastFinish : undefined}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="w-full h-[2px] bg-webfut-pink shadow-[0_0_15px_#FFB1CF] animate-[boot-scan_2s_linear_infinite]" />
      </div>

      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #FFF 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />

      <div className="relative text-center flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <h1 className="text-7xl lg:text-9xl text-900 italic tracking-tighter leading-none text-white mb-4">WEBFUT</h1>

        <div className="bg-webfut-pink text-black px-8 py-2 text-[10px] lg:text-sm text-900 uppercase tracking-[0.2em] inline-block italic transform mb-16">
          SYSTEM INITIALIZATION
        </div>

        <div className="w-72 lg:w-96 mx-auto">
          <div className="flex justify-between items-end mb-2 px-0.5">
            <span className="text-[10px] text-zinc-500 font-black tracking-[0.1em] uppercase italic">{stage}</span>
            <span className="text-[10px] text-webfut-pink font-mono italic">{safeProgress}%</span>
          </div>

          <div className="h-[3px] w-full bg-zinc-900 overflow-hidden relative border border-zinc-800/50">
            <div
              className="h-full bg-webfut-pink transition-all duration-300 ease-out shadow-[0_0_10px_rgba(255,177,207,0.5)]"
              style={{ width: `${safeProgress}%` }}
            />
          </div>

          <div className="mt-2.5 flex justify-between text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
            <span>Core v3.1</span>
            <span>{canFastFinish ? "Tap to finish" : "Loading..."}</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 left-0 w-full text-center px-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-px bg-zinc-800/50" />
          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[1.2em] italic opacity-80">PRODUCT BY PAJVEL</p>
        </div>
      </div>

      <style>{`
        @keyframes boot-scan {
          from { transform: translateY(-100%); }
          to { transform: translateY(1000%); }
        }
      `}</style>
    </div>
  );
}
