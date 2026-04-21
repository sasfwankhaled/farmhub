import { cn } from '../../../lib/utils';
import { LucideIcon } from 'lucide-react';

interface QuickStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  sub?: string;
}

export function QuickStatCard({ label, value, icon: Icon, color, bg, sub }: QuickStatCardProps) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-3 rounded-2xl", bg, color)}>
        <Icon className="w-5 h-5 text-current" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-black text-gray-900">{value}</p>
          {sub && <span className="text-[10px] font-bold text-gray-400">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
