import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GateEntry, DashboardStats } from '../types';
import { BigActionCard3D, KpiCard, StatusBadge } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';
import {
  ShoppingBag,
  ArrowUpRight,
  RotateCcw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Car,
  AlertTriangle,
  ClipboardList,
  Database,
  Truck,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowLeftRight
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'today'>('all');

  const userLocation = user?.location || 'Estate 1';

  const fetchDashboardData = async () => {
    try {
      const [statsRes, entriesRes] = await Promise.all([
        fetch(`/api/dashboard/stats?location=${encodeURIComponent(userLocation)}`),
        fetch(`/api/entries?limit=50&location=${encodeURIComponent(userLocation)}`)
      ]);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        setEntries(entriesData);
      }
    } catch (err) {
      console.warn('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 12000);
    return () => clearInterval(interval);
  }, [userLocation]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayEntries = entries.filter(e => e.at && e.at.startsWith(todayStr) && !e.cancelled);
  const displayedEntries = (activeTab === 'today' && todayEntries.length > 0) ? todayEntries : entries;

  return (
    <PageMotion className="w-full space-y-6 pb-16">
      {/* Big 3D Action Buttons with larger icons and bold fonts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4.5">
        {/* 1. Purchase / Inward */}
        <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}>
          <BigActionCard3D dir="purchase" onClick={() => navigate('/purchase-in')}>
            <div className="flex flex-col items-center justify-center text-center gap-2.5 py-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
                <ShoppingBag className="w-7 h-7 sm:w-9 sm:h-9 text-white" strokeWidth={2.4} />
              </div>
              <div className="space-y-0.5">
                <span className="block font-black text-lg sm:text-xl lg:text-2xl tracking-tight leading-tight">
                  Purchase IN
                </span>
                <span className="block text-xs sm:text-sm font-medium text-cyan-100 opacity-95">
                  Purchaser / Vehicles Inward
                </span>
              </div>
            </div>
          </BigActionCard3D>
        </motion.div>

        {/* 2. Outward */}
        <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}>
          <BigActionCard3D dir="out" onClick={() => navigate('/out')}>
            <div className="flex flex-col items-center justify-center text-center gap-2.5 py-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
                <ArrowUpRight className="w-7 h-7 sm:w-9 sm:h-9 text-white" strokeWidth={2.4} />
              </div>
              <div className="space-y-0.5">
                <span className="block font-black text-lg sm:text-xl lg:text-2xl tracking-tight leading-tight">
                  Material OUT
                </span>
                <span className="block text-xs sm:text-sm font-medium text-blue-100 opacity-95">
                  Dispatch & Returnable
                </span>
              </div>
            </div>
          </BigActionCard3D>
        </motion.div>

        {/* 3. Return */}
        <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.98 }}>
          <BigActionCard3D dir="return" onClick={() => navigate('/return')}>
            <div className="flex flex-col items-center justify-center text-center gap-2.5 py-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
                <RotateCcw className="w-7 h-7 sm:w-9 sm:h-9 text-white" strokeWidth={2.4} />
              </div>
              <div className="space-y-0.5">
                <span className="block font-black text-lg sm:text-xl lg:text-2xl tracking-tight leading-tight">
                  Return BACK
                </span>
                <span className="block text-xs sm:text-sm font-medium text-amber-100 opacity-95">
                  Returnable Item Return
                </span>
              </div>
            </div>
          </BigActionCard3D>
        </motion.div>
      </div>

      {/* KPI Stats Strip with Large Values, Clear Labels & Large Themed Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
        <KpiCard className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="kpi-val text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-[#1b1f24] tracking-tight leading-none">
              {stats ? (stats.totalEntries ?? entries.length) : (entries.length || '--')}
            </div>
            <div className="text-sm sm:text-base font-bold text-[#1f2937] mt-1.5 leading-snug">
              Total Database Entries
            </div>
            <div className="text-xs text-[#5f6b7a] font-medium mt-0.5">
              Live in MySQL database
            </div>
          </div>
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#eaf6ee] text-[#15803d] flex items-center justify-center shrink-0 border border-emerald-200/60 shadow-xs">
            <Database className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.3} />
          </div>
        </KpiCard>

        <KpiCard className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="kpi-val text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-[#1b1f24] tracking-tight leading-none">
              {stats ? stats.todayIn : '--'}
            </div>
            <div className="text-sm sm:text-base font-bold text-[#1f2937] mt-1.5 leading-snug">
              IN entries today
            </div>
            <div className="text-xs text-[#5f6b7a] font-medium mt-0.5">
              Live inbound gate entries
            </div>
          </div>
          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#e9effd] text-[#1d4ed8] flex items-center justify-center shrink-0 border border-blue-200/60 shadow-xs">
            <ArrowDownToLine className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.3} />
          </div>
        </KpiCard>

        <Link to="/pending" className="block text-inherit no-underline">
          <KpiCard alert={stats && stats.vehiclesInside > 0 ? 'warn' : undefined} className="flex items-center justify-between gap-3 h-full">
            <div className="min-w-0">
              <div className="kpi-val text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-[#1b1f24] tracking-tight leading-none">
                {stats ? stats.vehiclesInside : '--'}
              </div>
              <div className="text-sm sm:text-base font-bold text-[#1f2937] mt-1.5 leading-snug">
                Vehicles inside
              </div>
              <div className="text-xs text-[#5f6b7a] font-medium mt-0.5">
                Pending gate departure
              </div>
            </div>
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#fdf6e3] text-[#b45309] flex items-center justify-center shrink-0 border border-amber-200/60 shadow-xs">
              <Car className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.3} />
            </div>
          </KpiCard>
        </Link>

        <Link to="/pending" className="block text-inherit no-underline">
          <KpiCard alert={stats && stats.overdueReturnables > 0 ? 'bad' : undefined} className="flex items-center justify-between gap-3 h-full">
            <div className="min-w-0">
              <div className="kpi-val text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-[#1b1f24] tracking-tight leading-none">
                {stats ? stats.overdueReturnables : '--'}
              </div>
              <div className="text-sm sm:text-base font-bold text-[#1f2937] mt-1.5 leading-snug">
                Overdue returnables
              </div>
              <div className="text-xs text-[#5f6b7a] font-medium mt-0.5">
                Past scheduled return date
              </div>
            </div>
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#fdecec] text-[#b91c1c] flex items-center justify-center shrink-0 border border-red-200/60 shadow-xs">
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2.3} />
            </div>
          </KpiCard>
        </Link>
      </div>

      {/* Inter-Location Notifications for Location User */}
      <div className="gate-card p-4 sm:p-5.5 bg-gradient-to-br from-white to-blue-50/40 border-2 border-blue-200 rounded-[14px] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Inter-Location Material Notifications
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold border border-blue-200">
                  {userLocation}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Live dispatch & inward alerts for transfers scheduled, dispatched, or arriving at <strong>{userLocation}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/register"
              className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span>View All in Register</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {(() => {
          // Find all inter-location entries for this user's location
          const interLocationEntries = entries.filter(e => {
            if (e.cancelled) return false;
            const isInter = e.movement_type === 'Inter-Location Transfer' || e.movement_type === 'Inter-Branch Transfer' || e.inter_branch_details;
            if (!isInter) return false;
            const loc = userLocation.toLowerCase();
            const from = (e.from_branch || e.location || '').toLowerCase();
            const to = (e.to_branch || e.party || '').toLowerCase();
            return from === loc || to === loc;
          });

          if (interLocationEntries.length === 0) {
            return (
              <div className="p-6 text-center text-slate-400 bg-white/80 rounded-xl border border-dashed border-slate-300 text-xs space-y-1">
                <Building2 className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-bold text-slate-700">No Inter-Location Alerts for {userLocation}</p>
                <p className="text-[11px] text-slate-500">
                  When someone creates an inter-location material transfer for or from {userLocation}, instant notifications appear here.
                </p>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto -mx-1 sm:mx-0">
              <table className="w-full min-w-[700px] text-xs text-left border-collapse bg-white rounded-xl border border-blue-100 overflow-hidden shadow-2xs">
                <thead>
                  <tr className="bg-blue-50/80 border-b border-blue-200/70 text-blue-950 uppercase text-[11px] font-bold tracking-wider">
                    <th className="py-2.5 px-3">Gate Pass</th>
                    <th className="py-2.5 px-3">Transfer Route</th>
                    <th className="py-2.5 px-3">Material Description</th>
                    <th className="py-2.5 px-2 text-center">Returnable</th>
                    <th className="py-2.5 px-3">Vehicle / Driver</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {interLocationEntries.slice(0, 5).map(e => {
                    const itemsSummary = (e.items || []).map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ');
                    const isOutgoing = (e.from_branch || e.location || '').toLowerCase() === userLocation.toLowerCase();
                    const otherLocation = isOutgoing ? (e.to_branch || e.party) : (e.from_branch || e.location);

                    return (
                      <tr key={e.code} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-800">
                          <Link to={`/e/${e.code}`} className="hover:underline flex items-center gap-1">
                            <span>🎫</span>
                            <span>{e.code}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isOutgoing ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              {isOutgoing ? 'OUT TO SEND' : 'INCOMING'}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {isOutgoing ? `➔ ${otherLocation}` : `From ${otherLocation}`}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 max-w-[240px] truncate text-slate-800 font-semibold" title={itemsSummary}>
                          {itemsSummary || 'General Materials'}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide ${
                            e.returnable
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {e.returnable ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <div className="font-mono font-bold text-slate-900">{e.vehicle_no || 'NO VEHICLE'}</div>
                          <div className="text-[10px] text-slate-500">{e.driver || 'Driver'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {e.stage ? e.stage.replace('_', ' ').toUpperCase() : 'REGISTERED'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/e/${e.code}`)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded shadow-2xs transition-colors cursor-pointer"
                          >
                            Open Details →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Database Entries Table Card */}
      <div className="gate-card p-4 sm:p-5.5 bg-white border border-[#dde1e6] rounded-[12px] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#15803d] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#1b1f24] tracking-tight">
                {activeTab === 'today' ? `${userLocation} Today's Entries — ${todayStr}` : `${userLocation} Gate Entries (${entries.length})`}
              </h2>
              <div className="text-xs text-[#5f6b7a]">Facility records and operational activity for <strong>{userLocation}</strong></div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeTab === 'all' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All Recent ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('today')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${activeTab === 'today' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Today ({todayEntries.length})
              </button>
            </div>

            <Link to="/register" className="text-xs sm:text-sm font-bold text-[#15803d] hover:underline flex items-center gap-1 ml-2">
              <span>Full Register</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full min-w-[620px] text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] uppercase text-[11px] font-semibold tracking-wider">
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-2 text-center">Dir</th>
                <th className="py-2.5 px-3">Date / Time</th>
                <th className="py-2.5 px-3">Party / Supplier</th>
                <th className="py-2.5 px-3">Vehicle / Purchaser</th>
                <th className="py-2.5 px-3">Document</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dde1e6]">
              {displayedEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#5f6b7a]">
                    No entries logged in database yet. Click "Purchase IN" above to create an entry.
                  </td>
                </tr>
              ) : (
                displayedEntries.map(e => (
                  <tr key={e.code} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <Link to={`/e/${e.code}`} className="text-[#15803d] hover:underline">
                        {e.code}
                      </Link>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <StatusBadge variant={e.dir === 'IN' ? 'in' : 'out'}>
                        {e.dir === 'IN' ? 'IN ⬇' : 'OUT ⬆'}
                      </StatusBadge>
                    </td>
                    <td className="py-2.5 px-3 text-[#555] font-mono whitespace-nowrap">
                      {e.at || '--'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1b1f24] max-w-[180px] truncate" title={e.party}>
                      {e.party}
                    </td>
                    <td className="py-2.5 px-3">
                      {e.inward_type === 'purchaser_hand' || e.purchaser_name ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px] block truncate">
                            👤 {e.purchaser_name || e.person || 'Hand carried'}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {e.vehicle_no || 'NO VEHICLE'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#555] max-w-[130px] truncate">
                      {e.doc_no ? `${e.doc_type || 'Doc'}: ${e.doc_no}` : (e.doc_type || '—')}
                    </td>
                    <td className="py-2.5 px-3 text-[#333] max-w-[180px] truncate" title={e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ')}>
                      {e.items && e.items.length > 0 ? (
                        <span>
                          {e.items[0].desc} <span className="font-semibold">({e.items[0].qty} {e.items[0].unit})</span>
                          {e.items.length > 1 && <span className="text-[#888] font-mono"> +{e.items.length - 1}</span>}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        e.stage === 'cleared'
                          ? 'bg-emerald-100 text-emerald-800'
                          : e.stage === 'at_gate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {e.stage ? e.stage.replace('_', ' ').toUpperCase() : 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageMotion>
  );
};
