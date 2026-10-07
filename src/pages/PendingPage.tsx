import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GateEntry } from '../types';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import {
  RotateCcw,
  Truck,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Search
} from 'lucide-react';

export const PendingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'our_returnables' | 'we_have_to_return' | 'vehicles_inside'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departingCode, setDepartingCode] = useState<string | null>(null);

  const fetchPendingData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/entries');
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error('Failed to fetch pending entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, []);

  const handleVehicleDeparture = async (code: string) => {
    setDepartingCode(code);
    try {
      const res = await fetch(`/api/entries/${code}/vehicle-left`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        }
      });
      if (res.ok) {
        await fetchPendingData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDepartingCode(null);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // 1. OUR RETURNABLES: Material sent OUT with returnable = true that has not returned yet
  const ourReturnables = entries.filter(e => {
    if (e.cancelled) return false;
    return e.dir === 'OUT' && e.returnable && !e.returned_at;
  }).sort((a, b) => (a.expected_return || '').localeCompare(b.expected_return || ''));

  // 2. PENDING THAT WE HAVE TO RETURN: Material received IN that is returnable and must be returned back
  const weHaveToReturn = entries.filter(e => {
    if (e.cancelled) return false;
    // Direct IN returnable materials or destination inter-location transfers pending return
    const isDirectInReturnable = e.dir === 'IN' && e.returnable && !e.returned_at;
    const isInterLocationToUs = (e.movement_type === 'Inter-Location Transfer' || e.movement_type === 'Inter-Branch Transfer') &&
      e.returnable &&
      !e.returned_at &&
      user?.location &&
      e.to_branch?.toLowerCase() === user.location.toLowerCase();
    return isDirectInReturnable || isInterLocationToUs;
  }).sort((a, b) => (a.expected_return || '').localeCompare(b.expected_return || ''));

  // 3. VEHICLES STILL INSIDE FACTORY: Checked IN vehicles without vehicle_out_at
  const insideVehicles = entries.filter(e => {
    if (e.cancelled) return false;
    return e.dir === 'IN' && !e.vehicle_out_at && e.vehicle_type !== 'Hand carried';
  }).sort((a, b) => b.at.localeCompare(a.at));

  // Search filter
  const filterBySearch = (list: GateEntry[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(e =>
      e.code.toLowerCase().includes(q) ||
      e.party.toLowerCase().includes(q) ||
      (e.vehicle_no && e.vehicle_no.toLowerCase().includes(q)) ||
      (e.driver && e.driver.toLowerCase().includes(q)) ||
      e.items.some(i => i.desc.toLowerCase().includes(q))
    );
  };

  const filteredOurReturnables = filterBySearch(ourReturnables);
  const filteredWeHaveToReturn = filterBySearch(weHaveToReturn);
  const filteredInsideVehicles = filterBySearch(insideVehicles);

  const getDurationInside = (entryTime: string) => {
    try {
      const start = new Date(entryTime).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `${hours}h ${mins}m`;
      return `${mins}m`;
    } catch {
      return '--';
    }
  };

  return (
    <PageMotion className="space-y-5 pb-20 md:pb-10">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dde1e6] pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24] flex items-center gap-2">
            <span>⏳</span>
            <span>Pending Operations</span>
          </h1>
          <p className="text-xs text-[#5f6b7a] mt-0.5">
            Active factory pending items: Returnables awaiting return back, material we must return, and vehicles inside premises.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, party, vehicle..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Filter Tabs / Quick Stat Badges */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Pending ({ourReturnables.length + weHaveToReturn.length + insideVehicles.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('our_returnables')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === 'our_returnables'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Our Returnables</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-current font-mono font-bold">
            {ourReturnables.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('we_have_to_return')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === 'we_have_to_return'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Pending That We Have To Return</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-current font-mono font-bold">
            {weHaveToReturn.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFilterTab('vehicles_inside')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === 'vehicles_inside'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Vehicles Still Inside Factory</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-current font-mono font-bold">
            {insideVehicles.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-semibold text-sm">
          <span className="inline-block animate-spin mr-2">🔄</span>
          Loading pending factory operations...
        </div>
      ) : (
        <div className="space-y-6">
          {/* ======================================================== */}
          {/* 1. OUR RETURNABLES: Material Dispatched Out Awaiting Return */}
          {/* ======================================================== */}
          {(filterTab === 'all' || filterTab === 'our_returnables') && (
            <Card3D className="p-4 sm:p-5 space-y-3.5 border-l-4 border-l-blue-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    <span>Our Returnables ({filteredOurReturnables.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Items sent out from our facility (repair, machinery on loan, contractor equipment, pallets) that are pending return back.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <table className="w-full min-w-[760px] text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                      <th className="py-2.5 px-3">Gate Pass</th>
                      <th className="py-2.5 px-3">Dispatched Date</th>
                      <th className="py-2.5 px-3">Recipient Party / Vendor</th>
                      <th className="py-2.5 px-3">Returnable Materials</th>
                      <th className="py-2.5 px-3">Expected Return</th>
                      <th className="py-2.5 px-3 text-center">Return Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOurReturnables.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No outward returnable items pending return back.
                        </td>
                      </tr>
                    ) : (
                      filteredOurReturnables.map(e => {
                        const isOverdue = Boolean(e.expected_return && e.expected_return < todayStr);
                        const itemsSummary = e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ');

                        return (
                          <tr key={e.code} className="hover:bg-blue-50/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                              <Link to={`/e/${e.code}`} className="text-blue-700 hover:underline flex items-center gap-1 font-bold">
                                <span>🎫</span>
                                <span>{e.code}</span>
                              </Link>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              {e.at.slice(0, 16)}
                            </td>

                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              <div>{e.party}</div>
                              {e.movement_type && (
                                <span className="text-[10px] font-semibold text-blue-700">
                                  {e.movement_type}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 max-w-[260px] truncate text-slate-700" title={itemsSummary}>
                              {itemsSummary}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                isOverdue ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-slate-700'
                              }`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{e.expected_return || 'Not specified'}</span>
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>OVERDUE</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                  <Clock className="w-3 h-3" />
                                  <span>PENDING BACK</span>
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => navigate(`/return?against=${e.code}`)}
                                className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-xs transition-colors cursor-pointer mr-1.5"
                              >
                                Receive Return
                              </button>
                              <Link
                                to={`/e/${e.code}`}
                                className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-100 inline-block"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card3D>
          )}

          {/* ======================================================== */}
          {/* 2. PENDING THAT WE HAVE TO RETURN (Inward Returnables)   */}
          {/* ======================================================== */}
          {(filterTab === 'all' || filterTab === 'we_have_to_return') && (
            <Card3D className="p-4 sm:p-5 space-y-3.5 border-l-4 border-l-amber-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <span>Pending That We Have To Return ({filteredWeHaveToReturn.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Materials received at our facility (supplier cylinders, rented tools, trial machinery, inter-location items) that we must return back to the sender.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <table className="w-full min-w-[760px] text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                      <th className="py-2.5 px-3">Gate Pass</th>
                      <th className="py-2.5 px-3">Received Date</th>
                      <th className="py-2.5 px-3">Owner / Supplier Party</th>
                      <th className="py-2.5 px-3">Materials to Return</th>
                      <th className="py-2.5 px-3">Due Return Date</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredWeHaveToReturn.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No inward returnable materials currently held at our facility.
                        </td>
                      </tr>
                    ) : (
                      filteredWeHaveToReturn.map(e => {
                        const isOverdue = Boolean(e.expected_return && e.expected_return < todayStr);
                        const itemsSummary = e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ');

                        return (
                          <tr key={e.code} className="hover:bg-amber-50/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                              <Link to={`/e/${e.code}`} className="text-amber-800 hover:underline flex items-center gap-1 font-bold">
                                <span>🎫</span>
                                <span>{e.code}</span>
                              </Link>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              {e.at.slice(0, 16)}
                            </td>

                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              <div>{e.party}</div>
                              {e.from_branch && (
                                <span className="text-[10px] font-semibold text-emerald-700">
                                  From: {e.from_branch}
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 max-w-[260px] truncate text-slate-700" title={itemsSummary}>
                              {itemsSummary}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-medium">
                              <span className={`inline-flex items-center gap-1 font-bold ${
                                isOverdue ? 'text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-slate-700'
                              }`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{e.expected_return || 'Not specified'}</span>
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>RETURN OVERDUE</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                  <Clock className="w-3 h-3" />
                                  <span>MUST RETURN</span>
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => navigate(`/out?purpose=Return+to+supplier&party=${encodeURIComponent(e.party)}`)}
                                className="px-2.5 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-xs transition-colors cursor-pointer mr-1.5"
                              >
                                Dispatch Return OUT
                              </button>
                              <Link
                                to={`/e/${e.code}`}
                                className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-100 inline-block"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card3D>
          )}

          {/* ======================================================== */}
          {/* 3. VEHICLES STILL INSIDE FACTORY                          */}
          {/* ======================================================== */}
          {(filterTab === 'all' || filterTab === 'vehicles_inside') && (
            <Card3D className="p-4 sm:p-5 space-y-3.5 border-l-4 border-l-emerald-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>Vehicles Still Inside Factory ({filteredInsideVehicles.length})</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vehicles that entered through gate check-in and are currently parked, loading, or unloading on premises.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <table className="w-full min-w-[760px] text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                      <th className="py-2.5 px-3">Vehicle No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Driver / Contact</th>
                      <th className="py-2.5 px-3">Party / Supplier</th>
                      <th className="py-2.5 px-3">Gate In Time</th>
                      <th className="py-2.5 px-3">Time Inside</th>
                      <th className="py-2.5 px-3 text-right">Gate Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInsideVehicles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          No vehicles currently recorded inside factory grounds.
                        </td>
                      </tr>
                    ) : (
                      filteredInsideVehicles.map(e => {
                        const duration = getDurationInside(e.at);
                        const isLongStay = duration.includes('h');

                        return (
                          <tr key={e.code} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap text-slate-900">
                              <div className="text-sm">{e.vehicle_no}</div>
                              <Link to={`/e/${e.code}`} className="text-[10px] text-slate-500 font-normal hover:underline">
                                Entry: {e.code}
                              </Link>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                {e.vehicle_type || 'Vehicle'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800">{e.driver || 'Driver'}</div>
                              {e.driver_id && <div className="text-[10px] text-slate-400 font-mono">ID: {e.driver_id}</div>}
                            </td>

                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {e.party}
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                              {e.at.slice(11, 16)} <span className="text-[10px] text-slate-400">({e.at.slice(5, 10)})</span>
                            </td>

                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isLongStay ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                <Clock className="w-3 h-3" />
                                <span>{duration}</span>
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <Button3D
                                type="button"
                                variant="out"
                                size="sm"
                                disabled={departingCode === e.code}
                                onClick={() => handleVehicleDeparture(e.code)}
                                className="font-bold text-xs"
                              >
                                {departingCode === e.code ? 'Departing...' : 'Mark Vehicle Left →'}
                              </Button3D>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card3D>
          )}
        </div>
      )}
    </PageMotion>
  );
};
