import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { user, logout, isSupervisor, isAdmin } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState('');
  const [inwardCount, setInwardCount] = useState<number>(0);

  React.useEffect(() => {
    const loc = user?.location;
    if (!loc) return;
    const fetchCounts = async () => {
      try {
        const res = await fetch(`/api/notifications/unread-count?location=${encodeURIComponent(loc)}`);
        if (res.ok) {
          const data = await res.json();
          setInwardCount(data.count || 0);
        }
      } catch {}
    };
    fetchCounts();
    const timer = setInterval(fetchCounts, 15000);
    return () => clearInterval(timer);
  }, [user?.location]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/purchase-in') return location.pathname === '/purchase-in' || location.pathname.startsWith('/in') || location.pathname === '/purchase' || location.pathname === '/material-in';
    return location.pathname.startsWith(path);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    navigate(`/register?q=${encodeURIComponent(searchQ.trim())}`);
    onCloseMobile();
  };

  const NavItem = ({ to, label, icon, badge, color }: { to: string; label: string; icon: string; badge?: string; color?: string }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        onClick={onCloseMobile}
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
          active
            ? 'bg-[#15803d] text-white shadow-sm'
            : 'text-[#e3f1e8] hover:bg-white/10 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">{icon}</span>
          <span>{label}</span>
        </div>
        {badge && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              badge === 'IN'
                ? 'bg-[#eaf6ee] text-[#15803d]'
                : badge === 'PURCHASE'
                ? 'bg-teal-100 text-teal-800'
                : badge === 'OUT'
                ? 'bg-[#e9effd] text-[#1d4ed8]'
                : 'bg-white/20 text-white'
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const content = (
    <div className="flex flex-col h-full bg-[#14532d] text-white w-64 shadow-xl select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-white/15 flex items-center justify-between">
        <Link to="/" onClick={onCloseMobile} className="text-lg font-bold tracking-tight text-white flex items-center gap-2.5 truncate">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-6 w-6 rounded object-contain bg-white/20 p-0.5 shrink-0" />
          ) : (
            <span className="flex h-3 w-3 rounded-full bg-[#34d399] animate-pulse shrink-0" />
          )}
          <span className="truncate">{settings.app_name || 'Gate Register'}</span>
        </Link>
        <button
          onClick={onCloseMobile}
          className="md:hidden text-white/80 hover:text-white text-lg p-1 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Quick Search */}
      <div className="p-3 border-b border-white/10">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Scan QR / code / party..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full bg-white/15 text-white placeholder-emerald-200/60 border border-white/20 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:bg-white focus:text-[#1b1f24] focus:placeholder-slate-400 transition-all"
          />
        </form>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <NavItem to="/" label="Home" icon="🏠" />
        <NavItem to="/purchase-in" label="Purchase" icon="🛍️" badge="PURCHASE" />
        <NavItem to="/out" label="Material OUT" icon="⬆" badge="OUT" />
        <NavItem to="/return" label="Returning Back" icon="🔄" badge="RET" />
        <NavItem to="/register" label="Register" icon="📋" />
        <NavItem to="/pending" label="Pending" icon="⏳" />
        <NavItem to="/settings/printer" label="Bluetooth Printer" icon="🖨️" />
        {isSupervisor && <NavItem to="/reports" label="Summary & Reports" icon="📊" />}
        {isAdmin && <NavItem to="/users" label="Users & Locations" icon="👥" />}
        {isAdmin && <NavItem to="/admin" label="Admin" icon="⚙️" />}
      </div>

      {/* User Info & Footer */}
      {user && (
        <div className="p-3.5 bg-black/15 border-t border-white/15 space-y-2">
          <div className="text-xs text-emerald-100">
            <div className="font-bold text-white truncate">{user.name}</div>
            <div className="text-[11px] text-emerald-200/80 capitalize">
              {user.role} · {user.gate || 'Main Gate'}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
            <Link
              to="/admin"
              onClick={onCloseMobile}
              className="text-emerald-200 hover:text-white text-[11px] underline"
            >
              Password
            </Link>
            <button
              onClick={logout}
              className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 z-30">
        {content}
      </aside>

      {/* Mobile Drawer (Animated) */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="relative z-10"
            >
              {content}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
