import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;
const base = (props: Props) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
});

export const IconSearch = (p: Props) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconPlus = (p: Props) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconClose = (p: Props) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconCheck = (p: Props) => <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>;
export const IconTrash = (p: Props) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
);
export const IconEdit = (p: Props) => (
  <svg {...base(p)}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m13.5 6.5 3 3" /></svg>
);
export const IconCopy = (p: Props) => (
  <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
);
export const IconUp = (p: Props) => <svg {...base(p)}><path d="m6 15 6-6 6 6" /></svg>;
export const IconDown = (p: Props) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const IconBack = (p: Props) => <svg {...base(p)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
export const IconFilter = (p: Props) => <svg {...base(p)}><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg>;
export const IconGrid = (p: Props) => (
  <svg {...base(p)}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
);
export const IconList = (p: Props) => <svg {...base(p)}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>;
export const IconImage = (p: Props) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
);
export const IconVideo = (p: Props) => (
  <svg {...base(p)}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>
);
export const IconDownload = (p: Props) => <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>;
export const IconUpload = (p: Props) => <svg {...base(p)}><path d="M12 15V4M7 9l5-5 5 5M5 20h14" /></svg>;
export const IconExternal = (p: Props) => <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>;
export const IconLogout = (p: Props) => <svg {...base(p)}><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" /></svg>;
export const IconMore = (p: Props) => <svg {...base(p)}><circle cx="5" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="19" cy="12" r="1.4" fill="currentColor" /></svg>;
export const IconWarn = (p: Props) => <svg {...base(p)}><path d="M12 3 2 21h20zM12 10v5M12 18h.01" /></svg>;
export const IconInfo = (p: Props) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;

/* Navigation */
export const IconExercises = (p: Props) => (
  <svg {...base(p)}><circle cx="12" cy="5" r="2" /><path d="M12 7v6M12 13l-4 7M12 13l4 7M7 10l5-2 5 2" /></svg>
);
export const IconTags = (p: Props) => (
  <svg {...base(p)}><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" /></svg>
);
export const IconSheet = (p: Props) => (
  <svg {...base(p)}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
);
export const IconSettings = (p: Props) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>
);
