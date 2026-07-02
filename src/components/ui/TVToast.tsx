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

const COLOR_MAP = {
  error: 'text-live',
  success: 'text-success',
  info: 'text-accent-light',
  warning: 'text-gold',
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
  const color = COLOR_MAP[type];

  return (
    <div
      className={classNames(
        'fixed top-6 right-6 z-[9999] max-w-sm w-full',
        animState === 'in' ? 'animate-toast-in' : 'animate-toast-out',
      )}
    >
      <div className={classNames(
        'rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 shadow-2xl px-5 py-4',
        'flex items-start gap-4',
      )}>
        <Icon size={24} className={classNames(color, 'mt-0.5 flex-shrink-0')} strokeWidth={2} />
        <p className="text-white text-base font-medium leading-relaxed flex-1 min-w-0">
          {message}
        </p>

      </div>
    </div>
  );
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
