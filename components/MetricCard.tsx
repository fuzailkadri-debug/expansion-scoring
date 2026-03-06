import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'default' | 'green' | 'yellow' | 'red' | 'blue';
  className?: string;
}

const COLOR_MAP = {
  default: 'border-gray-200',
  green: 'border-green-300 bg-green-50',
  yellow: 'border-yellow-300 bg-yellow-50',
  red: 'border-red-300 bg-red-50',
  blue: 'border-blue-300 bg-blue-50',
};

export default function MetricCard({ label, value, sub, color = 'default', className }: MetricCardProps) {
  return (
    <div className={cn('bg-white border rounded-xl p-4 shadow-sm', COLOR_MAP[color], className)}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
