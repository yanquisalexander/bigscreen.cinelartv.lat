import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { classNames } from '@/utils/helpers';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  focusKey: string;
  label: string;
  description?: string;
  onArrowPress?: (direction: string) => boolean;
}

function Toggle({ checked, onChange, focusKey, label, description, onArrowPress }: ToggleProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: () => onChange(!checked),
    onArrowPress,
  });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={classNames(
        'flex items-center justify-between py-[clamp(0.75rem,1.5vh,1rem)] px-[clamp(0.75rem,1.5vw,1rem)] rounded-xl transition-colors cursor-pointer',
        focused ? 'bg-white/10' : 'bg-transparent',
      )}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col pr-4">
        <span className="text-white text-[clamp(0.9rem,1.25vw,1.05rem)] font-medium">{label}</span>
        {description && (
          <span className="text-text-secondary text-[clamp(0.75rem,1vw,0.85rem)] mt-0.5">{description}</span>
        )}
      </div>

      <div
        className={classNames(
          'relative w-[clamp(2.75rem,4.5vw,3.25rem)] h-[clamp(1.5rem,2.5vw,1.75rem)] rounded-full flex-shrink-0 transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-white/20',
        )}
      >
        <div
          className={classNames(
            'absolute top-1/2 -translate-y-1/2 w-[clamp(1.1rem,1.8vw,1.3rem)] h-[clamp(1.1rem,1.8vw,1.3rem)] rounded-full bg-white shadow-md transition-all duration-200',
            checked ? 'left-[clamp(1.4rem,2.3vw,1.7rem)]' : 'left-[clamp(0.2rem,0.35vw,0.3rem)]',
          )}
        />
      </div>
    </div>
  );
}

export { Toggle };
