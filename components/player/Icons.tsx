type P = { size?: number; className?: string };

const box = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24" });

export const PlayIcon = ({ size = 20, className = "" }: P) => (
  <svg {...box(size)} fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 5.2v13.6L19 12 8 5.2Z" />
  </svg>
);

export const PauseIcon = ({ size = 20, className = "" }: P) => (
  <svg {...box(size)} fill="currentColor" aria-hidden="true" className={className}>
    <path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" />
  </svg>
);

export const NextIcon = ({ size = 20, className = "" }: P) => (
  <svg {...box(size)} fill="currentColor" aria-hidden="true" className={className}>
    <path d="M6 5.5 15 12l-9 6.5v-13ZM16.6 5H19v14h-2.4z" />
  </svg>
);

export const PrevIcon = ({ size = 20, className = "" }: P) => (
  <svg {...box(size)} fill="currentColor" aria-hidden="true" className={className}>
    <path d="M18 5.5 9 12l9 6.5v-13ZM5 5h2.4v14H5z" />
  </svg>
);

export const ShuffleIcon = ({ size = 18, className = "" }: P) => (
  <svg {...box(size)} fill="none" aria-hidden="true" className={className}>
    <path
      d="M3 7h3.2c1.5 0 2.4.8 3.3 2l3.9 6c.9 1.2 1.8 2 3.3 2H21M3 17h3.2c1.5 0 2.4-.8 3.3-2M14.4 9c.9-1.2 1.8-2 3.3-2H21"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <path d="m18.4 4 2.9 3-2.9 3M18.4 14l2.9 3-2.9 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const VolumeIcon = ({ size = 18, className = "", muted = false }: P & { muted?: boolean }) => (
  <svg {...box(size)} fill="none" aria-hidden="true" className={className}>
    <path
      d="M4 9.2h3L11 5.5v13L7 14.8H4a1 1 0 0 1-1-1V10.2a1 1 0 0 1 1-1Z"
      fill="currentColor"
    />
    {muted ? (
      <path d="m15 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    ) : (
      <>
        <path d="M14.4 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M17.4 6.6a8 8 0 0 1 0 10.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.6" />
      </>
    )}
  </svg>
);

export const LockIcon = ({ size = 18, className = "" }: P) => (
  <svg {...box(size)} fill="none" aria-hidden="true" className={className}>
    <rect x="4.5" y="10" width="15" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10V7.6a4 4 0 0 1 8 0V10" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);

export const CheckIcon = ({ size = 16, className = "" }: P) => (
  <svg {...box(size)} fill="none" aria-hidden="true" className={className}>
    <path d="m4.5 12.5 4.6 4.6L19.5 6.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
  </svg>
);
