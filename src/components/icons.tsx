/* Ícones autorais do FácilMed — traço 1.7, cantos arredondados, currentColor */
import React from "react";

type P = { className?: string };
const S = ({ className, children, vb = "0 0 24 24" }: P & { children: React.ReactNode; vb?: string }) => (
  <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IcLogo = ({ className }: P) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="#123b32" />
    <path d="M16 8.5v15M8.5 16h15" stroke="#cbe7d9" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="23.2" cy="8.8" r="4.1" fill="#0c8a64" />
    <path d="M21.2 8.8h1.2l.8-1.6 1 3 .8-1.4h1" stroke="#f3f7f3" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const IcHeart = ({ className }: P) => (
  <S className={className}><path d="M12 20.2S4 15.2 4 9.6C4 6.9 6 5 8.4 5c1.6 0 3 .9 3.6 2.1C12.6 5.9 14 5 15.6 5 18 5 20 6.9 20 9.6c0 5.6-8 10.6-8 10.6Z" /><path d="M6.5 12h3l1.2-2.2 1.8 3.8 1.2-1.6h3.8" /></S>
);
export const IcTooth = ({ className }: P) => (
  <S className={className}><path d="M7.2 4.6c-2.5 0-3.9 2.2-3.6 4.7.3 2.7 1.5 4 2 6.4.4 2 .7 4.7 2.3 4.7 1.8 0 1-4 4.1-4s2.3 4 4.1 4c1.6 0 1.9-2.7 2.3-4.7.5-2.4 1.7-3.7 2-6.4.3-2.5-1.1-4.7-3.6-4.7-2.1 0-2.6 1.2-4.8 1.2s-2.7-1.2-4.8-1.2Z" /></S>
);
export const IcBone = ({ className }: P) => (
  <S className={className}><path d="M8.6 6.2a2.3 2.3 0 1 0-3.3 3.2 2.3 2.3 0 1 0 3.3 3.2l6.8 3.4a2.3 2.3 0 1 0 3.2-3.3 2.3 2.3 0 1 0-3.2-3.3L8.6 6.2Z" transform="rotate(18 12 12)" /><path d="m9.5 9.5 5 5" /></S>
);
export const IcClinica = ({ className }: P) => (
  <S className={className}><rect x="5" y="4.5" width="14" height="16" rx="2.5" /><path d="M9 4.5V3.2M15 4.5V3.2M12 10v5M9.5 12.5h5" /></S>
);
export const IcSkin = ({ className }: P) => (
  <S className={className}><path d="M12 4.5 13.4 9l4.6 1.3-4.6 1.4L12 16.2l-1.4-4.5L6 10.3 10.6 9 12 4.5Z" /><path d="M18.5 16.5v3M17 18h3M6.5 17.5v2M5.5 18.5h2" /></S>
);
export const IcKid = ({ className }: P) => (
  <S className={className}><circle cx="10.5" cy="13.5" r="5.5" /><path d="M8.3 13.2h.01M12.7 13.2h.01M8.8 15.6c.9.8 2.5.8 3.4 0M14.8 9.2c1.4-1.7 3.4-2 4.6-.8 1.2 1.2.8 3-.7 4.1" /></S>
);
export const IcChat = ({ className }: P) => (
  <S className={className}><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H9.5L5.8 19.3c-.6.5-1.3.1-1.3-.6V6.5Z" /><path d="M11 7.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" /></S>
);
export const IcCalendar = ({ className }: P) => (
  <S className={className}><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M8 5.5V3.5M16 5.5V3.5M4 10h16M8.5 14h2M13.5 14h2M8.5 17h2" /></S>
);
export const IcClock = ({ className }: P) => (
  <S className={className}><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5V12l3 2" /></S>
);
export const IcBell = ({ className }: P) => (
  <S className={className}><path d="M12 4a5.4 5.4 0 0 0-5.4 5.4c0 4.4-1.6 5.6-1.6 5.6h14s-1.6-1.2-1.6-5.6A5.4 5.4 0 0 0 12 4Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></S>
);
export const IcGear = ({ className }: P) => (
  <S className={className}><circle cx="12" cy="12" r="3" /><path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7" /></S>
);
export const IcBack = ({ className }: P) => <S className={className}><path d="M14.5 5.5 8 12l6.5 6.5" /></S>;
export const IcCheck = ({ className }: P) => <S className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const IcX = ({ className }: P) => <S className={className}><path d="m6 6 12 12M18 6 6 18" /></S>;
export const IcLock = ({ className }: P) => (
  <S className={className}><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" /></S>
);
export const IcQueue = ({ className }: P) => (
  <S className={className}><circle cx="8" cy="8.5" r="2.8" /><path d="M3.5 19.5c.4-3.4 2.2-5.3 4.5-5.3s4.1 1.9 4.5 5.3" /><circle cx="16.5" cy="9.5" r="2.2" /><path d="M14.6 14.6c.6-.3 1.2-.4 1.9-.4 2 0 3.5 1.7 3.9 4.6" /></S>
);
export const IcChip = ({ className }: P) => (
  <S className={className}><rect x="7" y="7" width="10" height="10" rx="2.5" /><path d="M12 3.5V7M12 17v3.5M3.5 12H7M17 12h3.5M6 6l1.6 1.6M18 6l-1.6 1.6M6 18l1.6-1.6M18 18l-1.6-1.6" /><circle cx="12" cy="12" r="1.6" /></S>
);
export const IcDb = ({ className }: P) => (
  <S className={className}><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></S>
);
export const IcDoc = ({ className }: P) => (
  <S className={className}><path d="M7 3.8h7L18.5 8v11a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8V5.6A1.8 1.8 0 0 1 7 3.8Z" /><path d="M14 3.8V8h4.5M9 12h6M9 15h6M9 18h4" /></S>
);
export const IcPhone = ({ className }: P) => (
  <S className={className}><rect x="7" y="3" width="10" height="18" rx="3" /><path d="M10.5 5.2h3M11 18.5h2" /></S>
);
export const IcWallet = ({ className }: P) => (
  <S className={className}><rect x="3.8" y="6" width="16.4" height="13" rx="2.5" /><path d="M3.8 10h16.4M16.5 14.5h.01M7 6V5a1.5 1.5 0 0 1 1.5-1.5H17" /></S>
);
export const IcIdCard = ({ className }: P) => (
  <S className={className}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><circle cx="8.5" cy="11" r="1.8" /><path d="M6 15.5c.4-1.6 1.4-2.4 2.5-2.4s2.1.8 2.5 2.4M14 9.5h4M14 12.5h4M14 15.5h2.5" /></S>
);
export const IcAlert = ({ className }: P) => (
  <S className={className}><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 16.8h.01" /></S>
);
export const IcChevL = ({ className }: P) => <S className={className}><path d="M14.5 6 8.5 12l6 6" /></S>;
export const IcChevR = ({ className }: P) => <S className={className}><path d="m9.5 6 6 6-6 6" /></S>;
export const IcChevD = ({ className }: P) => <S className={className}><path d="m6 9.5 6 6 6-6" /></S>;
export const IcPulse = ({ className }: P) => <S className={className}><path d="M3 12h4l2-5 4 10 2.5-5H21" /></S>;
export const IcShield = ({ className }: P) => (
  <S className={className}><path d="M12 3.8 5 6.5v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9v-5L12 3.8Z" /><path d="m8.8 12 2.3 2.3 4.2-4.6" /></S>
);
export const IcEdit = ({ className }: P) => (
  <S className={className}><path d="m14.5 5.5 4 4L8 20l-4.7 1 1-4.7L14.5 5.5Z" /><path d="m12.5 7.5 4 4" /></S>
);
export const IcPlus = ({ className }: P) => <S className={className}><path d="M12 5v14M5 12h14" /></S>;
export const IcSend = ({ className }: P) => <S className={className}><path d="M4.5 11 19.5 4.5 15 19.5l-3.6-5.4L4.5 11Z" /><path d="m11.4 14.1 3.2-3.2" /></S>;
export const IcSpark = ({ className }: P) => (
  <S className={className}><path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3L12 4Z" /><path d="M18.5 16.5v3M17 18h3" /></S>
);
export const IcDownload = ({ className }: P) => (
  <S className={className}><path d="M12 4v10M8 10.5l4 4 4-4M5 19h14" /></S>
);
