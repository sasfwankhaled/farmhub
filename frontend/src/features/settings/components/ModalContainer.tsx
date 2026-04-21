import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ReactNode } from 'react';

interface ModalContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  themeColor: string;
  children: ReactNode;
}

export function ModalContainer({ isOpen, onClose, title, themeColor, children }: ModalContainerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
      >
        <div className={cn("p-8 flex items-center justify-between text-white", themeColor)}>
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl transition-all active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar text-right" dir="rtl">{children}</div>
      </motion.div>
    </div>
  );
}

export function ModalInput({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1.5 text-right" dir="rtl">
      <label className="text-xs font-black text-gray-500 mr-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all text-sm font-bold shadow-sm text-right"
      />
    </div>
  );
}

export function ModalButton({ onClick, label, color }: any) {
  return (
    <div className="pt-4">
      <button onClick={onClick} className={cn("w-full py-5 text-white rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95", color)}>
        {label}
      </button>
    </div>
  );
}
