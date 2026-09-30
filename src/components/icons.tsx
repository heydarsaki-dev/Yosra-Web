import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
  </svg>
);

export const ListIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <circle cx="4" cy="6" r="1.2" />
    <circle cx="4" cy="12" r="1.2" />
    <circle cx="4" cy="18" r="1.2" />
  </svg>
);

export const ChartIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const DebtIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
    <path d="M2.5 10h19" />
    <path d="M6.5 14.5h4" />
  </svg>
);

export const GearIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-2-3.4-2 .8a7.6 7.6 0 0 0-2.6-1.5L14.2 2H9.8l-.3 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8-2 3.4 1.7 1.3a7.7 7.7 0 0 0 0 3l-1.7 1.3 2 3.4 2-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.1h4.4l.3-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 2-3.4z" />
  </svg>
);

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IncomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);

export const ExpenseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

export const WalletIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H18a2 2 0 0 1 2 2v1" />
    <rect x="3" y="8.5" width="18" height="10.5" rx="3" />
    <circle cx="16.5" cy="13.8" r="1.2" />
  </svg>
);

export const CalendarIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const ClockIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);

export const EditIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const ChevronLeftIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 19h16" />
  </svg>
);

export const UploadIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5" />
    <path d="M4 19h16" />
  </svg>
);

export const CloudUpIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.4 9.2 3.9 3.9 0 0 1 17 18h-2" />
    <path d="M12 20v-7M9.5 15.5 12 13l2.5 2.5" />
  </svg>
);

export const CloudDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17.4 9.2 3.9 3.9 0 0 1 17 18h-2" />
    <path d="M12 13v7M9.5 17.5 12 20l2.5-2.5" />
  </svg>
);

export const UsersIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
  </svg>
);

export const TagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2a2 2 0 0 1 1.4.6l6.7 6.7a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0L4.1 13.6a2 2 0 0 1-.6-1.4z" />
    <circle cx="8" cy="8" r="1.3" />
  </svg>
);

export const GripIcon = (p: P) => (
  <svg {...base(p)} strokeWidth={2.2}>
    <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />
  </svg>
);

export const ArrowUpIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19V6M7 11l5-5 5 5" />
  </svg>
);

export const ArrowDownIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v13M7 13l5 5 5-5" />
  </svg>
);

export const InfoIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
