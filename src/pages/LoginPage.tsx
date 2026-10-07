import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';
import { Building2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSettings();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-login mobile users so they do not have to perform web login
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && (
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
    if (isMobile) {
      handleMobileQuickEnter();
    }
  }, []);

  const handleMobileQuickEnter = async () => {
    setIsSubmitting(true);
    setError(null);
    const result = await login('guard', 'guard123', 'Mobile Terminal', 'tablet');
    setIsSubmitting(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Failed to auto-sign in mobile terminal.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(username, password, 'Gate Console', 'web');
    setIsSubmitting(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Wrong username or password.');
    }
  };

  return (
    <PageMotion className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 my-auto">
        <Card3D className="p-6 sm:p-7 space-y-4">
          <div className="text-center space-y-2">
            {settings.logo_url ? (
              <div className="flex justify-center pb-1">
                <img
                  src={settings.logo_url}
                  alt={settings.app_name || 'Logo'}
                  className="h-14 w-auto max-w-[200px] object-contain rounded"
                />
              </div>
            ) : (
              <div className="flex justify-center pb-0.5">
                <Building2 className="h-10 w-10 text-emerald-700" />
              </div>
            )}
            <h1 className="text-xl font-bold text-[#1b1f24] tracking-tight">
              {settings.company_name || 'GUJRANWALA FOOD INDUSTRIES'}
            </h1>
            <p className="text-xs text-[#5f6b7a]">
              Gate Register & Material Management System
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-[#fdecec] text-[#b91c1c] text-xs font-semibold border border-[#efa5a5]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#1f2937] mb-1.5">Username</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-3 text-base bg-white border border-[#c5ccd4] rounded-lg focus:border-[#15803d] focus:outline-hidden min-h-[48px]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#1f2937] mb-1.5">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 text-base bg-white border border-[#c5ccd4] rounded-lg focus:border-[#15803d] focus:outline-hidden min-h-[48px]"
              />
            </div>

            <motion.div whileTap={{ scale: 0.98 }}>
              <Button3D
                type="submit"
                variant="in"
                size="lg"
                disabled={isSubmitting}
                className="w-full font-bold min-h-[48px] text-base"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </Button3D>
            </motion.div>
          </form>

          {/* Location-Based Quick Login Chips */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Multi-Location Test Accounts (Click to Fill):
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-emerald-900">admin</div>
                <div className="text-[10px] text-emerald-700">Estate 1 · Admin</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('guard01');
                  setPassword('guard123');
                }}
                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-blue-900">guard01 (Ahmed Khan)</div>
                <div className="text-[10px] text-blue-700">Estate 1 · Security</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('guard02');
                  setPassword('guard123');
                }}
                className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-purple-900">guard02 (Bilal)</div>
                <div className="text-[10px] text-purple-700">Estate 2 · Security</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('guard03');
                  setPassword('guard123');
                }}
                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-amber-900">guard03 (Imran)</div>
                <div className="text-[10px] text-amber-700">Kamonki · Security</div>
              </button>
            </div>
          </div>
        </Card3D>
      </div>
    </PageMotion>
  );
};
