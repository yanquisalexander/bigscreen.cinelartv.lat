import { memo } from 'react';

interface DetailOverviewProps {
  description?: string;
  className?: string;
}

export const DetailOverview = memo(function DetailOverview({
  description,
  className,
}: DetailOverviewProps) {
  if (!description) return null;

  return (
    <section className={className}>
      <h2 className="text-[clamp(1.125rem,1.6vw,1.375rem)] font-bold text-white mb-[clamp(0.75rem,2vh,1rem)]">
        Sinopsis
      </h2>
      <p className="text-[clamp(0.9375rem,1.35vw,1.125rem)] text-text-secondary leading-relaxed max-w-[clamp(40rem,55vw,65rem)]">
        {description}
      </p>
    </section>
  );
});
