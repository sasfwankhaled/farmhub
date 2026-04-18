import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  subValue?: string;
  delay?: number;
}

export function StatCardPrimary({ label, value, icon: Icon, gradient, subValue, delay }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn("relative overflow-hidden p-6 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-between h-40 bg-gradient-to-br", gradient)}
    >
      <div className="absolute -right-6 -top-6 text-white/10 rotate-12 scale-150 pointer-events-none">
        <Icon className="w-32 h-32" />
      </div>
      
      <div className="relative z-10 flex justify-between items-start">
        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl shadow-inner">
          <Icon className="w-6 h-6" />
        </div>
      </div>
      
      <div className="relative z-10 mt-auto">
        <p className="text-white/80 font-black text-xs uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-2 text-right" dir="rtl">
          <h2 className="text-3xl font-black">{value}</h2>
          {subValue && <span className="text-white/70 font-bold text-xs">{subValue}</span>}
        </div>
      </div>
    </motion.div>
  );
}
