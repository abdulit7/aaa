import React, { useState } from 'react';
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

        </Card3D>
      </div>
    </PageMotion>
  );
};
