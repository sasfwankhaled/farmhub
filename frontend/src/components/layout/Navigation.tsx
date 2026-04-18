import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  Moon,
  Sun,
  Package,
  DollarSign,
  Users,
  Archive,
  Sprout,
  Truck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from './NotificationBell';

export const Navigation = () => {
  const { farmerSession, logOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });


  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const navItems = farmerSession ? [
    { name: 'إدارة المزرعة', path: '/farm', icon: Sprout },
  ] : [
    { name: 'لوحة التحكم', path: '/', icon: LayoutDashboard },
    { name: 'الطرود المرسلة', path: '/shipments', icon: Package },
    { name: 'تحصيلات الطرود', path: '/shipment-collections', icon: DollarSign },
    { name: 'تسليم المزارعين', path: '/farmer-delivery', icon: Users },
    { name: 'إدارة المزرعة', path: '/farm', icon: Sprout },
    { name: 'الإعدادات', path: '/settings', icon: SettingsIcon },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="p-6 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-100">
            <Sprout className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-xl text-gray-900 tracking-tight">FarmHub</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
            title={isDarkMode ? 'تفعيل الوضع المنير' : 'تفعيل الوضع الليلي'}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <NotificationBell />
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200",
              location.pathname === item.path
                ? "bg-green-600 text-white shadow-lg shadow-green-100"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "text-white" : "text-gray-400")} />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-50">
        <button
          onClick={() => logOut()}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 right-0 w-64 flex-col z-50 overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40 px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-green-600 p-1.5 rounded-lg">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900">FarmHub</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <NotificationBell />
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-[280px] sm:w-80 bg-white z-[70] lg:hidden shadow-2xl flex flex-col"
            >
              <div className="absolute top-4 left-4 z-[80]">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2.5 rounded-2xl bg-gray-50 text-gray-400 hover:text-gray-600 transition-all active:scale-95 shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
