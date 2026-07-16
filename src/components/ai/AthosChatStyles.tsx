// Kit de estilo visual do Athos (o "orbe" iridescente e o glow do composer) —
// extraído de DescompliqueiOS.tsx pra ser a ÚNICA fonte de verdade. Qualquer
// superfície de chat do Athos (principal, painéis embutidos, Athos CS) deve
// renderizar <AthosChatStyles /> uma vez e usar as classes os-* daqui, em vez
// de recriar o efeito com valores parecidos.
export function AthosChatStyles() {
  return (
    <style>{`
      @keyframes os-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      @keyframes os-morph {
        0%, 100% { border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%; }
        25% { border-radius: 70% 30% 46% 54% / 30% 29% 71% 70%; }
        50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
        75% { border-radius: 55% 45% 30% 70% / 65% 35% 55% 45%; }
      }
      @keyframes os-gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes os-pulse-ring { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.22; transform: scale(1.04); } }
      @keyframes os-pulse-ring-2 { 0%, 100% { opacity: 0.05; transform: scale(1); } 50% { opacity: 0.1; transform: scale(1.02); } }
      @keyframes os-orbit-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes os-particle-drift {
        0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
        25% { transform: translateY(-8px) translateX(4px); opacity: 0.7; }
        50% { transform: translateY(-4px) translateX(-3px); opacity: 0.3; }
        75% { transform: translateY(6px) translateX(5px); opacity: 0.6; }
      }
      .os-orb {
        border-radius: 50%;
        background-color: #0e0e12;
        background-image:
          radial-gradient(ellipse 45% 34% at 30% 24%, rgba(234,88,12,0.55), transparent 62%),
          radial-gradient(ellipse 30% 22% at 70% 66%, rgba(245,158,11,0.10), transparent 65%),
          radial-gradient(circle at 38% 30%, #1c1c22 0%, #14141a 45%, #0e0e12 100%);
        background-size: 100% 100%;
        animation: os-float 6s ease-in-out infinite, os-iridescent 14s ease infinite;
        box-shadow:
          0 0 70px rgba(234,88,12,0.14),
          0 14px 44px rgba(0,0,0,0.4),
          inset 0 -22px 42px rgba(0,0,0,0.55),
          inset 0 3px 10px rgba(255,255,255,0.08),
          inset -6px -12px 28px rgba(0,0,0,0.35);
      }
      @keyframes os-iridescent {
        0%, 100% { filter: saturate(1) brightness(1); }
        50% { filter: saturate(1.12) brightness(1.05); }
      }
      @keyframes os-spec-rotate {
        0%, 100% { transform: rotate(0deg) translateX(0); }
        50% { transform: rotate(180deg) translateX(2px); }
      }
      .os-orb-highlight {
        border-radius: 50%;
        background:
          radial-gradient(ellipse 60% 35% at 32% 22%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 65%),
          radial-gradient(ellipse 25% 15% at 28% 18%, rgba(255,255,255,0.7) 0%, transparent 70%);
        animation: os-float 6s ease-in-out infinite;
        animation-delay: -2s;
      }
      .os-orb-shimmer {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background:
          conic-gradient(from 0deg at 50% 50%,
            transparent 0deg,
            rgba(255,255,255,0.04) 60deg,
            transparent 120deg,
            rgba(234,88,12,0.05) 180deg,
            transparent 240deg,
            rgba(245,158,11,0.04) 300deg,
            transparent 360deg);
        animation: os-spec-rotate 8s linear infinite;
        mix-blend-mode: screen;
        pointer-events: none;
      }
      .os-orb-rim {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 50%, transparent 62%, rgba(255,255,255,0.08) 70%, transparent 78%);
        pointer-events: none;
      }
      .os-ring { border: 1px solid rgba(234,88,12,0.07); border-radius: 50%; animation: os-pulse-ring 4s ease-in-out infinite; }
      .os-ring-2 { border: 1px dashed rgba(255,255,255,0.05); border-radius: 50%; animation: os-pulse-ring-2 5s ease-in-out infinite; }
      .os-orbit { animation: os-orbit-spin 20s linear infinite; }
      .os-particle { animation: os-particle-drift 7s ease-in-out infinite; }
      .os-particle-2 { animation: os-particle-drift 9s ease-in-out infinite; animation-delay: -3s; }
      .os-particle-3 { animation: os-particle-drift 11s ease-in-out infinite; animation-delay: -6s; }
      .os-input-glow {
        position: relative;
        padding: 1.5px;
        border-radius: 18px;
        background: linear-gradient(135deg, rgba(234,88,12,0.10), rgba(234,88,12,0.02));
        transition: background 0.3s ease;
      }
      .os-input-glow::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 18px;
        background: inherit;
        filter: blur(10px);
        opacity: 0.3;
        z-index: -1;
      }
      .os-input-glow:focus-within {
        background: linear-gradient(135deg, rgba(234,88,12,0.45), rgba(245,158,11,0.15));
      }
      .os-input-glow:focus-within::before { opacity: 0.55; }
    `}</style>
  );
}
