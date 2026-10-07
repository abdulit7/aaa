import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Button3D } from '../../styles/emotion';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  Server,
  Bell,
  MapPin,
  ChevronDown,
  Check,
  ArrowRight,
  Package,
  Clock,
  ExternalLink,
  Shield
} from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

interface DbStatus {
  connected: boolean;
  host: string;
  port: number;
  database: string;
  user: string;
  error?: string;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { user, switchActiveLocation } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const locationPickerRef = useRef<HTMLDivElement | null>(null);

  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  // Fetch registered locations dynamically
  useEffect(() => {
    fetch('/api/users/locations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.map((l: any) => typeof l === 'string' ? l : l.name).filter(Boolean);
          if (names.length > 0) {
            setAvailableLocations(Array.from(new Set(names)));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Connection form state for custom database configuration
  const [hostInput, setHostInput] = useState('');
  const [portInput, setPortInput] = useState('3306');
  const [userInput, setUserInput] = useState('root');
  const [passInput, setPassInput] = useState('');
  const [dbInput, setDbInput] = useState('gateregister_db');
  const [connectMessage, setConnectMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const fetchNotifications = async () => {
    if (!user?.location) return;
    try {
      const res = await fetch(`/api/notifications?location=${encodeURIComponent(user.location)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.read).length);
      }
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user?.location]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (locationPickerRef.current && !locationPickerRef.current.contains(e.target as Node)) {
        setShowLocationPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    if (!user?.location) return;
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: user.location })
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      await fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
    setShowNotifDropdown(false);
    if (notif.code) {
      navigate(`/e/${encodeURIComponent(notif.code)}`);
    } else {
      navigate('/register');
    }
  };

  const checkDbStatus = async () => {
    try {
      const res = await fetch('/api/db-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        if (!hostInput && data.host) {
          setHostInput(data.host);
          setPortInput(String(data.port));
          setUserInput(data.user);
          setDbInput(data.database);
        }
      }
    } catch {
      setDbStatus(prev => prev ? { ...prev, connected: false } : null);
    }
  };

  useEffect(() => {
    checkDbStatus();
    const interval = setInterval(checkDbStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleRetryDb = async () => {
    setIsRetrying(true);
    setConnectMessage(null);
    try {
      const res = await fetch('/api/db-reconnect', { method: 'POST' });
      const data = await res.json();
      setDbStatus(data);
      if (data.connected) {
        setConnectMessage({ type: 'success', text: `Connected successfully to MySQL at ${data.host}:${data.port}/${data.database}` });
      } else {
        setConnectMessage({ type: 'error', text: data.error || 'Connection failed. Please check MySQL server and credentials.' });
      }
    } catch (err: any) {
      setConnectMessage({ type: 'error', text: err.message || 'Connection attempt failed' });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCustomConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRetrying(true);
    setConnectMessage(null);
    try {
      const res = await fetch('/api/mysql/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: hostInput.trim(),
          port: Number(portInput) || 3306,
          user: userInput.trim(),
          password: passInput,
          database: dbInput.trim()
        })
      });
      const data = await res.json();
      if (data.connected) {
        setDbStatus({
          connected: true,
          host: hostInput,
          port: Number(portInput),
          user: userInput,
          database: dbInput
        });
        setConnectMessage({ type: 'success', text: `Connected successfully to MySQL at ${hostInput}:${portInput}/${dbInput}` });
      } else {
        setConnectMessage({ type: 'error', text: data.error || 'Failed to connect with provided credentials.' });
      }
    } catch (err: any) {
      setConnectMessage({ type: 'error', text: err.message || 'Failed to connect to MySQL server' });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      {/* Top Banner when MySQL is Offline */}
      {dbStatus && !dbStatus.connected && (
        <div className="bg-rose-600 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm z-30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
            <span>
              <strong>MySQL Database Offline:</strong> Direct database connection required. Saving to JSON & Offline IndexedDB are disabled.
            </span>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="underline font-bold hover:text-amber-200 transition-colors cursor-pointer text-xs"
          >
            Configure & Reconnect →
          </button>
        </div>
      )}

      <header className="sticky top-0 z-20 w-full bg-white border-b border-[#dde1e6] shadow-xs px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Hamburger for mobile */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#dde1e6] bg-[#f3f4f6] text-[#1b1f24] hover:bg-slate-200 transition-colors"
            aria-label="Toggle menu"
          >
            ☰
          </button>

          <div className="flex items-center gap-2">
            {/* Assigned Gate Badge */}
            <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-300 flex items-center gap-1.5 shadow-2xs" title="Terminal Gate">
              <span>🚪</span>
              <span className="uppercase tracking-wide font-extrabold">{user?.gate || 'Main Gate'}</span>
            </span>

            {/* Interactive Location Badge / Switcher */}
            <div className="relative" ref={locationPickerRef}>
              <button
                type="button"
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                title="Active Location · Click to switch location"
              >
                <span>📍</span>
                <span className="font-semibold">{user?.location || 'Estate 1'}</span>
                <ChevronDown className="h-3 w-3 text-slate-500" />
              </button>

              <AnimatePresence>
                {showLocationPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1"
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Switch Location
                    </div>
                    {availableLocations.map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          switchActiveLocation(loc);
                          setShowLocationPicker(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          user?.location === loc ? 'text-emerald-700 bg-emerald-50/60 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{loc}</span>
                        </span>
                        {user?.location === loc && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifDropdownRef}>
            <button
              type="button"
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
              title={`Incoming Material Notifications (${unreadCount} unread)`}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-3 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-emerald-300" />
                      <div>
                        <h4 className="font-bold text-xs leading-none">Notifications · {user?.location || 'Estate 1'}</h4>
                        <span className="text-[10px] text-emerald-200">{unreadCount} unread incoming updates</span>
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-emerald-100 hover:text-white underline font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs space-y-1">
                        <Package className="h-8 w-8 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-600">No Notifications</p>
                        <p className="text-[11px]">No pending material transfers for {user?.location}.</p>
                      </div>
                    ) : (
                      notifications.slice(0, 15).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`p-3 text-xs transition-colors cursor-pointer hover:bg-slate-50 flex items-start gap-2.5 ${
                            !notif.read ? 'bg-emerald-50/40 font-medium' : 'text-slate-600'
                          }`}
                        >
                          <span className="text-base shrink-0 mt-0.5">
                            {notif.type === 'in_transit' ? '🚚' : notif.type === 'completed' ? '✅' : '🔔'}
                          </span>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-800 truncate text-[11px]">{notif.title}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-2 leading-tight">
                              {notif.message}
                            </p>
                            {notif.metadata?.returnable !== undefined && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                  notif.metadata.returnable ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  RETURNABLE: {notif.metadata.returnable ? 'YES' : 'NO'}
                                </span>
                                {notif.metadata?.vehicle && (
                                  <span className="text-[9px] text-slate-500 font-mono">
                                    🚗 {notif.metadata.vehicle}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center flex items-center justify-between">
                    <Link
                      to="/register"
                      onClick={() => setShowNotifDropdown(false)}
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1 mx-auto"
                    >
                      <span>View All Records in Gate Register</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Info */}
          <div className="hidden md:flex flex-col items-end text-right leading-tight">
            <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">{user?.name}</span>
            <span className="text-[10px] font-semibold text-slate-500 capitalize">{user?.role}</span>
          </div>
          {/* Live MySQL Database Connection Status Indicator */}
          {dbStatus && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors ${
                dbStatus.connected
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                  : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
              }`}
              title={
                dbStatus.connected
                  ? `Live MySQL Connected: ${dbStatus.user}@${dbStatus.host}:${dbStatus.port}/${dbStatus.database}`
                  : `MySQL Not Connected: ${dbStatus.host}:${dbStatus.port}/${dbStatus.database}. Click to configure and reconnect.`
              }
            >
              <span className={`h-2 w-2 rounded-full ${dbStatus.connected ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600 animate-ping'}`} />
              <span className="font-mono">{dbStatus.connected ? 'MySQL Live' : 'MySQL Offline'}</span>
            </button>
          )}

          <Link to="/settings/printer" className="no-underline">
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                className="text-[#15803d] font-bold flex items-center gap-1.5"
                title="Bluetooth Thermal Printer Settings"
              >
                <span>🖨️</span>
                <span className="hidden sm:inline text-xs">Printer</span>
              </Button3D>
            </motion.div>
          </Link>
        </div>
      </header>

      {/* MySQL Connection Management Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="bg-[#1b1f24] text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-base">Direct MySQL Database Hub</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                {/* Status Box */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  dbStatus?.connected
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {dbStatus?.connected ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-sm">
                      {dbStatus?.connected ? 'MySQL Database is Connected & Live' : 'MySQL Database is Disconnected'}
                    </p>
                    <p className="text-slate-600">
                      Target:{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {dbStatus?.user}@{dbStatus?.host}:{dbStatus?.port}/{dbStatus?.database}
                      </span>
                    </p>
                    {dbStatus?.error && (
                      <p className="text-rose-700 font-mono text-[11px] bg-rose-100/70 p-1.5 rounded">
                        {dbStatus.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Strict Direct Database Policy:</p>
                  <p>
                    Data is stored directly into MySQL tables. Saving to local JSON files (<code className="font-mono bg-amber-100 px-1 rounded">db.json</code>)
                    and offline IndexedDB caching have been removed to ensure 100% data consistency across mobile and desktop.
                  </p>
                </div>

                {connectMessage && (
                  <div className={`p-3 rounded-lg text-xs font-semibold ${
                    connectMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                  }`}>
                    {connectMessage.text}
                  </div>
                )}

                {/* Quick Retry Button */}
                <button
                  type="button"
                  onClick={handleRetryDb}
                  disabled={isRetrying}
                  className="w-full py-2.5 px-4 bg-[#15803d] hover:bg-[#166534] disabled:bg-slate-300 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer text-sm transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{isRetrying ? 'Connecting...' : 'Test & Reconnect MySQL Server'}</span>
                </button>

                {/* Custom Connection Settings Form */}
                <details className="border border-slate-200 rounded-xl p-3 bg-slate-50 text-xs">
                  <summary className="font-bold text-slate-700 cursor-pointer flex items-center gap-1.5 py-1">
                    <Server className="h-4 w-4 text-slate-500" />
                    <span>Change MySQL Server Parameters</span>
                  </summary>
                  <form onSubmit={handleCustomConnect} className="mt-3 space-y-3 pt-2 border-t border-slate-200">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 space-y-1">
                        <label className="font-semibold text-slate-600">Host</label>
                        <input
                          type="text"
                          value={hostInput}
                          onChange={e => setHostInput(e.target.value)}
                          placeholder="localhost"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">Port</label>
                        <input
                          type="number"
                          value={portInput}
                          onChange={e => setPortInput(e.target.value)}
                          placeholder="3306"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">Username</label>
                        <input
                          type="text"
                          value={userInput}
                          onChange={e => setUserInput(e.target.value)}
                          placeholder="root"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-600">Password</label>
                        <input
                          type="password"
                          value={passInput}
                          onChange={e => setPassInput(e.target.value)}
                          placeholder="Password"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-600">Database Name</label>
                      <input
                        type="text"
                        value={dbInput}
                        onChange={e => setDbInput(e.target.value)}
                        placeholder="gateregister_db"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isRetrying}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-bold rounded-lg text-xs transition-colors"
                    >
                      {isRetrying ? 'Connecting...' : 'Apply & Connect MySQL'}
                    </button>
                  </form>
                </details>
              </div>

              <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
