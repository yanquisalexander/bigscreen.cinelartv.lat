import { useEffect, useState } from 'react';
import { useToastStore } from '@/stores/toastStore';
import {
  LucideAlertCircle,
  LucideCheckCircle,
  LucideInfo,
  LucideAlertTriangle,
} from 'lucide-react';

const ICON_MAP = {
  error: LucideAlertCircle,
  success: LucideCheckCircle,
  info: LucideInfo,
  warning: LucideAlertTriangle,
} as const;

// Filled badge background per type — the icon sits on a solid color
// circle rather than floating on dark, which is how most TV platforms
// (YouTube TV, Apple TV) signal severity at a glance.
const BADGE_COLOR_MAP = {
  error: 'bg-live',
  success: 'bg-success',
  info: 'bg-accent-light',
  warning: 'bg-gold',
} as const;

const LABEL_MAP = {
  error: 'Error',
  success: 'Listo',
  info: 'Información',
  warning: 'Advertencia',
} as const;

export function TVToast() {
  const { visible, message, type, hide } = useToastStore();
  const [animState, setAnimState] = useState<'in' | 'out' | 'hidden'>('hidden');

  useEffect(() => {
    if (visible) {
      setAnimState('in');
    } else if (animState === 'in') {
      setAnimState('out');
      const timer = setTimeout(() => setAnimState('hidden'), 250);
      return () => clearTimeout(timer);
    }
  }, [visible, animState]);

  if (animState === 'hidden') return null;

  const Icon = ICON_MAP[type];
  const badgeColor = BADGE_COLOR_MAP[type];
  const label = LABEL_MAP[type];

  return (
    <div
      className={classNames(
        'fixed top-0 right-0 z-[9999]',
        animState === 'in' ? 'animate-toast-in' : 'animate-toast-out',
      )}
      style={{
        marginTop: 'clamp(2rem, 5vh, 3rem)',
        marginRight: 'clamp(2rem, 4vw, 3rem)',
      }}
    >
      <div
        className="flex items-center bg-[#141414] border border-white/[0.08] rounded-full"
        style={{
          maxWidth: 'clamp(19rem, 27vw, 25rem)',
          gap: 'clamp(0.75rem, 1.4vw, 1rem)',
          paddingBlock: 'clamp(0.5rem, 1.1vh, 0.625rem)',
          paddingInline: 'clamp(0.625rem, 1.2vw, 0.75rem) clamp(1.25rem, 2.2vw, 1.5rem)',
        }}
      >
        <span
          className={classNames('flex items-center justify-center rounded-full flex-shrink-0', badgeColor)}
          style={{
            width: 'clamp(2rem, 3.6vh, 2.5rem)',
            height: 'clamp(2rem, 3.6vh, 2.5rem)',
          }}
        >
          <Icon size={18} className="text-black" strokeWidth={2.25} />
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="font-semibold text-white/50 uppercase tracking-wide leading-none"
            style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.6875rem)', marginBottom: 'clamp(0.1875rem, 0.4vh, 0.25rem)' }}
          >
            {label}
          </p>
          <p
            className="text-white font-medium leading-snug"
            style={{ fontSize: 'clamp(0.875rem, 1.15vw, 1rem)' }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}