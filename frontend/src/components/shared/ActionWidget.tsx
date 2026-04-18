import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color: string;
  hover: string;
}

export function ActionWidget({ to, icon: Icon, title, subtitle, color, hover }: Props) {
  return (
    <Link
      to={to}
      className={cn(
        "text-white p-6 rounded-[2rem] shadow-lg transition-all transform hover:-translate-y-1 active:translate-y-0 group flex items-center justify-between",
        color, hover
      )}
    >
      <div className="text-right" dir="rtl">
        <h3 className="font-black text-xl mb-1">{title}</h3>
        <p className="text-white/80 text-sm font-bold group-hover:text-white transition-colors">{subtitle}</p>
      </div>
      <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center -rotate-3 group-hover:rotate-3 transition-transform">
        <Icon className="w-7 h-7" />
      </div>
    </Link>
  );
}
