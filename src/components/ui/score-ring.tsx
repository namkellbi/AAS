import { cn } from '@/lib/utils';

export function ScoreRing({ value, className }: { value: number; className?: string }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#facc15' : '#7dd3fc';
  return (
    <div
      className={cn('grid size-12 place-items-center rounded-full text-sm font-semibold', className)}
      style={{
        background: `conic-gradient(${color} ${value * 3.6}deg, #252a33 0deg)`
      }}
      title={`Trending score ${value}`}
    >
      <div className="grid size-9 place-items-center rounded-full bg-background">{value}</div>
    </div>
  );
}
