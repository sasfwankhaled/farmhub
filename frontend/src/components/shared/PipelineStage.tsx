import { LucideIcon, ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  label: string;
  value: number;
  color: 'amber' | 'blue' | 'green' | 'purple' | 'gray';
  icon: LucideIcon;
  isFirst?: boolean;
  isLast?: boolean;
}

export function PipelineStage({ label, value, color, icon: Icon, isLast }: Props) {
  const colorMap: Record<string, { bg: string, text: string, border: string }> = {
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  };

  const theme = colorMap[color];

  return (
    <div className="flex flex-col md:flex-row items-center gap-4 relative flex-1">
      <div className={cn(
        "flex-1 w-full flex flex-col items-center justify-center p-4 rounded-3xl border shadow-sm transition-transform hover:-translate-y-1 bg-white relative z-10",
        theme.border
      )}>
        <div className={cn("p-2.5 rounded-xl mb-2", theme.bg, theme.text)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn("text-2xl font-black mb-1", theme.text)}>{value}</div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</div>
      </div>
      
      {!isLast && (
        <div className="hidden md:flex text-gray-300 absolute left-[-1.5rem] top-1/2 -translate-y-1/2 z-20">
          <ChevronLeft className="w-6 h-6" />
        </div>
      )}
      
      {/* Mobile connector */}
      {!isLast && <div className="md:hidden h-4 w-px bg-gray-200" />}
    </div>
  );
}
