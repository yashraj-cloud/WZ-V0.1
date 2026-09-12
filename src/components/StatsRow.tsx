import { useEffect, useState } from 'react';
import { AuditStats } from '../types';

interface StatsRowProps {
  stats: AuditStats;
}

function useAnimatedNumber(target: number, duration: number = 800) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setCurrent(0);
      return;
    }
    const start = current;
    const diff = target - start;
    const startTime = performance.now();

    let animationFrameId: number;

    const updateCount = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const nextVal = Math.round(start + diff * ease);
      setCurrent(nextVal);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration]);

  return current;
}

export default function StatsRow({ stats }: StatsRowProps) {
  const animTotal = useAnimatedNumber(stats.total);
  const animAllowed = useAnimatedNumber(stats.allowed);
  const animBlocked = useAnimatedNumber(stats.blocked);
  const animRedacted = useAnimatedNumber(stats.redacted);

  const blockRate = stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0;
  const animBlockRate = useAnimatedNumber(Math.round(blockRate * 10));
  const displayBlockRate = (animBlockRate / 10).toFixed(1);
  const isHighBlockRate = blockRate > 20;

  const statCards = [
    {
      label: 'TOTAL INTERCEPTED',
      value: animTotal.toLocaleString(),
      accent: '#00d4ff', // Cyan
      subtitle: 'All time evaluated calls',
    },
    {
      label: 'ALLOWED',
      value: animAllowed.toLocaleString(),
      accent: '#00e5a0', // Green
      subtitle: 'Passed all active policies',
    },
    {
      label: 'BLOCKED',
      value: animBlocked.toLocaleString(),
      accent: '#ff4d6a', // Red
      subtitle: 'Terminated before run',
    },
    {
      label: 'REDACTED',
      value: animRedacted.toLocaleString(),
      accent: '#ffb547', // Amber
      subtitle: 'Sensitive arguments masked',
    },
    {
      label: 'BLOCK RATE',
      value: `${displayBlockRate}%`,
      accent: isHighBlockRate ? '#ff4d6a' : '#8b92a8',
      subtitle: isHighBlockRate ? 'Above safe threshold (20%)' : 'Normal policy ratio',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
      {statCards.map((card, idx) => (
        <div
          key={idx}
          className="relative bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-[20px_24px] flex flex-col justify-between wz-card-shadow overflow-hidden transition-all duration-200 hover:border-[#383d54]"
        >
          {/* 3px colored vertical bar matching accent on the left edge */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ backgroundColor: card.accent }}
          />

          {/* Metric label in 11px caps muted Inter */}
          <div className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
            {card.label}
          </div>

          {/* Large number in 36px bold Inter in the accent color */}
          <div
            className="text-[36px] font-bold font-sans tracking-tight leading-none my-2.5"
            style={{ color: card.accent }}
          >
            {card.value}
          </div>

          {/* Small subtitle muted */}
          <div className="text-[11px] text-[#4a5070] font-sans truncate">
            {card.subtitle}
          </div>
        </div>
      ))}
    </div>
  );
}
