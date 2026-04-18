import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Sprout, Mail, User as UserIcon, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

export const Login = () => {
  const { signInWithEmail, signInFarmer } = useAuth();
  const [loginMode, setLoginMode] = useState<'admin' | 'farmer'>('admin');
  const [rememberMe, setRememberMe] = useState(true);
  const [farmerEmail, setFarmerEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (loginMode === 'admin') {
        await signInWithEmail(email, password, rememberMe);
      } else {
        await signInFarmer(farmerEmail, password, rememberMe);
      }
    } catch (err: any) {
      if (loginMode === 'farmer') {
        if (String(err?.message || '').includes('farmer-account-not-linked')) {
          setError('هذا المستخدم غير مربوط بحساب مزارع مفعل في النظام.');
        } else {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
        }
      } else if (String(err?.message || '').includes('invalid-admin-credentials')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (String(err?.message || '').includes('admin-not-allowed')) {
        setError('هذا الحساب غير مخول كمدير.');
      } else {
        setError('حدث خطأ. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-[2.5rem] shadow-2xl border border-gray-100"
      >
        <div className="text-center">
          <div className="mx-auto bg-green-600 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-green-100">
            <Sprout className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">FarmHub</h2>
          <p className="mt-3 text-gray-500 font-medium">
            مرحباً بك مرة أخرى! يرجى تسجيل الدخول.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setLoginMode('admin')}
              className={cn(
                "py-2.5 rounded-xl text-sm font-bold transition-colors",
                loginMode === 'admin' ? "bg-white text-green-700 shadow-sm" : "text-gray-500"
              )}
            >
              دخول إداري
            </button>
            <button
              type="button"
              onClick={() => setLoginMode('farmer')}
              className={cn(
                "py-2.5 rounded-xl text-sm font-bold transition-colors",
                loginMode === 'farmer' ? "bg-white text-green-700 shadow-sm" : "text-gray-500"
              )}
            >
              دخول مزارع
            </button>
          </div>

          <div className="space-y-4">
            {loginMode === 'admin' ? (
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pr-11 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium text-right"
                  placeholder="البريد الإلكتروني"
                />
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={farmerEmail}
                  onChange={(e) => setFarmerEmail(e.target.value)}
                  className="block w-full pr-11 pl-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium text-right"
                  placeholder="البريد الإلكتروني للمزارع"
                />
              </div>
            )}
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pr-11 pl-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all font-medium text-right"
                placeholder="كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 font-medium">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              حفظ تسجيل الدخول
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-black rounded-2xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all shadow-xl shadow-green-100 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                'تسجيل الدخول'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
