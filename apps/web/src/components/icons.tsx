import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

function base(props: IconProps) {
  const { className = "w-3.5 h-3.5 shrink-0", fill = "none", stroke = "currentColor", strokeWidth = 2, ...rest } = props;
  return { className, fill, stroke, strokeWidth, ...rest };
}

export function IconLayers(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

export function IconRocket(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.52 2.52 14.98 14.98 0 002.4 8.64 14.98 14.98 0 008.64 21.76m0-4.8v4.8" />
    </svg>
  );
}

export function IconActivity(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/** Build / work-in-progress */
export function IconWrench(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
      />
    </svg>
  );
}

export function IconAlertCircle(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function IconServer(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="2" y="3" width="20" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="14" width="20" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M6 6h.01M6 17h.01" />
    </svg>
  );
}

export function IconGitBranch(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
    </svg>
  );
}

export function IconExternalLink(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 5v14l11-7-11-7z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function IconStop(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <rect x="6" y="6" width="12" height="12" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function IconLayoutGrid(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

export function IconTerminal(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h4M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}

export function IconMaximize2(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

export function IconInbox(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
}

export function IconFilter(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  const p = base(props);
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...p}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}
