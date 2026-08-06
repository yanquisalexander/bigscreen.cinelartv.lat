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
      <p className="text-[clamp(0.9375rem,1.3vw,1.125rem)] text-white/60 leading-[1.7] max-w-[clamp(40rem,55vw,64rem)]">
        {description}
      </p>
    </section>
  );
});
