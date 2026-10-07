import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GateEntry } from '../types';
import { useSettings } from '../context/SettingsContext';
import { downloadDaybookPDF } from '../components/pdf/pdfGenerator';
import { ReportPreviewModal } from '../components/pdf/ReportPreviewModal';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';

export const RegisterPage: React.FC = () => {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'auto' | 'table' | 'cards'>('auto');

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [dir, setDir] = useState<'ALL' | 'IN' | 'OUT'>((searchParams.get('dir') as any) || 'ALL');
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
  const [toDate, setToDate] = useState(searchParams.get('to') || '');
  const [movementType, setMovementType] = useState<string>('ALL');
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (dir !== 'ALL') params.set('dir', dir);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (movementType !== 'ALL') params.set('movement_type', movementType);
      if (includeCancelled) params.set('cancelled', 'true');

      const res = await fetch(`/api/entries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.warn('Error fetching register entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [dir, fromDate, toDate, movementType, includeCancelled]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEntries();
  };

  const handleExportCSV = () => {
    const headers = [
      'Code',
      'Direction',
      'Date/Time',
      'Party / Supplier',
      'Vehicle / Purchaser',
      'Document',
      'Materials / Goods',
      'Amount'
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = entries.map(e => [
      e.code,
      e.dir,
      e.at.slice(5, 16),
      e.party,
      e.purchaser_name || (e.inward_type === 'purchaser_hand' && e.person) || (e.vehicle_no && e.vehicle_no.toLowerCase() !== 'hand carried' ? e.vehicle_no : (e.person || 'Hand')),
      `${e.doc_type} ${e.doc_no || ''}`,
      e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; '),
      e.amount ? `Rs ${e.amount.toLocaleString()}` : '-'
    ]);

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gate_Register_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIn = entries.filter(e => e.dir === 'IN' && !e.cancelled).length;
  const totalOut = entries.filter(e => e.dir === 'OUT' && !e.cancelled).length;
  const totalVal = entries
    .filter(e => !e.cancelled && e.amount)
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  // Dynamic party avatar colors
  const getPartyAvatar = (name: string) => {
    const colors = [
      'bg-emerald-600',
      'bg-blue-600',
      'bg-indigo-600',
      'bg-purple-600',
      'bg-amber-600',
      'bg-rose-600',
      'bg-teal-600',
      'bg-cyan-600',
      'bg-violet-600'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  const renderStatusBadge = (stage: string, cancelled?: any) => {
    if (cancelled) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
          CANCELLED
        </span>
      );
    }
    const s = stage?.toLowerCase() || '';
    if (s.includes('out') || s.includes('complete') || s.includes('left')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
          ✓ COMPLETED
        </span>
      );
    }
    if (s.includes('load') || s.includes('unload')) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
          ⚡ {stage.replace('_', ' ').toUpperCase()}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-300">
        ⏳ {stage.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  return (
    <PageMotion className="space-y-4 pb-20 md:pb-10">
      {/* Header Row */}
      <div className="register-page-header no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24] flex items-center gap-2">
            <span>📋</span>
            <span>Gate Register</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time material gate log · Click anywhere on any record to open full details
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile view mode toggle */}
          <div className="sm:hidden flex items-center bg-[#e5ece6] p-0.5 rounded-lg border border-[#c5ccd4]">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                viewMode === 'cards' || viewMode === 'auto'
                  ? 'bg-white text-[#15803d] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              📱 Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-[#15803d] shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              📊 Table
            </button>
          </div>

          <motion.div whileTap={{ scale: 0.96 }}>
            <Button3D variant="in" size="sm" onClick={() => setIsPreviewOpen(true)} className="font-bold">
              <span>🖨️</span>
              <span className="hidden sm:inline">Preview & Print Register</span>
              <span className="sm:hidden">Print</span>
            </Button3D>
          </motion.div>

          <motion.div whileTap={{ scale: 0.96 }}>
            <Button3D variant="sec" size="sm" onClick={handleExportCSV} className="font-bold">
              <span>⬇</span>
              <span>CSV</span>
            </Button3D>
          </motion.div>
        </div>
      </div>

      {/* Filter Card */}
      <Card3D className="register-filter-card no-print p-4 sm:p-5">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="form-label">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            />
          </div>

          <div>
            <label className="form-label">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            />
          </div>

          <div>
            <label className="form-label">Direction</label>
            <select
              value={dir}
              onChange={e => setDir(e.target.value as any)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            >
              <option value="ALL">Both IN & OUT</option>
              <option value="IN">IN only (Inward)</option>
              <option value="OUT">OUT only (Outward)</option>
            </select>
          </div>

          <div>
            <label className="form-label">Movement Type</label>
            <select
              value={movementType}
              onChange={e => setMovementType(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-medium"
            >
              <option value="ALL">All Movements</option>
              <option value="Inter-Location Transfer">🏢 Inter-Location Transfer</option>
              <option value="External / Supplier">External / Supplier</option>
              <option value="Customer / Sale">Customer / Sale</option>
              <option value="Repair / Maintenance">Repair / Maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="form-label">Search Keywords</label>
            <input
              type="text"
              placeholder="Party, vehicle, document, item..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Button3D type="submit" variant="in" size="sm" className="flex-1 font-bold min-h-[46px] sm:min-h-[38px]">
              Apply Filter
            </Button3D>
            <label className="flex items-center gap-2 text-xs font-bold text-[#5f6b7a] cursor-pointer bg-[#f8fafc] px-3 py-2.5 rounded-lg border border-[#dde1e6] min-h-[46px] sm:min-h-[38px]">
              <input
                type="checkbox"
                checked={includeCancelled}
                onChange={e => setIncludeCancelled(e.target.checked)}
                className="w-4 h-4 rounded text-[#15803d]"
              />
              <span>Cancelled</span>
            </label>
          </div>
        </form>
      </Card3D>

      {/* Colorful, Interactive Table / Cards Card */}
      <Card3D className="register-table-card overflow-hidden p-0 bg-white border border-[#cbd5e1] rounded-xl shadow-md">
        {/* Mobile Cards View (displayed on mobile when viewMode is 'auto' or 'cards') */}
        <div className={`p-3 space-y-3 ${viewMode === 'table' ? 'hidden' : 'sm:hidden'}`}>
          {loading ? (
            <div className="py-10 text-center text-slate-500 font-medium">
              <span className="inline-block animate-spin mr-2">🔄</span>
              Loading records...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <div className="text-3xl mb-1">📭</div>
              <div className="font-semibold text-slate-700">No entries recorded matching criteria.</div>
            </div>
          ) : (
            entries.map(e => (
              <div
                key={e.code}
                onClick={() => navigate(`/e/${e.code}`)}
                className={`p-3.5 rounded-xl border bg-white shadow-xs cursor-pointer active:scale-[0.99] transition-all space-y-2.5 ${
                  e.dir === 'IN'
                    ? 'border-l-4 border-l-emerald-500 border-slate-200'
                    : 'border-l-4 border-l-blue-500 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-xs bg-slate-900 text-amber-300">
                    <span>🎫</span>
                    <span>{e.code}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {e.dir === 'IN' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        ↓ IN
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                        ↑ OUT
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500">{e.at.slice(5, 16)}</span>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{e.party}</div>
                    {e.movement_type === 'Inter-Location Transfer' && (
                      <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1 mt-1">
                        <span>🏢</span>
                        <span>Inter-Location: {e.from_branch || e.location} ➔ {e.to_branch || e.party}</span>
                      </div>
                    )}
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-semibold text-slate-700">
                        {e.purchaser_name
                          ? `🛍️ ${e.purchaser_name}`
                          : e.inward_type === 'purchaser_hand'
                          ? `🛍️ ${e.person || 'Purchaser'}`
                          : `🚛 ${e.vehicle_no && e.vehicle_no.toLowerCase() !== 'hand carried' ? e.vehicle_no : 'Vehicle'}`}
                      </span>
                      <span>·</span>
                      <span>{e.doc_type} {e.doc_no ? `#${e.doc_no}` : ''}</span>
                    </div>
                  </div>
                  {e.amount && (
                    <div className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      Rs {e.amount.toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg truncate">
                  <span className="font-semibold text-slate-700">Items: </span>
                  {e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; ')}
                </div>

                <div className="flex items-center justify-end pt-1 border-t border-slate-100 text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span>View Details</span>
                    <span>➔</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Full Desktop Table View */}
        <div className={`overflow-x-auto ${viewMode === 'cards' ? 'hidden' : viewMode === 'auto' ? 'hidden sm:block' : 'block'}`}>
          <table className="w-full min-w-[900px] text-xs text-left border-collapse">
            <thead className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white text-[11px] font-bold uppercase tracking-wider border-b-2 border-emerald-500">
              <tr>
                <th className="py-3 px-3 whitespace-nowrap">Gate Code</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">Direction</th>
                <th className="py-3 px-3 whitespace-nowrap">Date / Time</th>
                <th className="py-3 px-3">Party / Supplier</th>
                <th className="py-3 px-3 whitespace-nowrap">Vehicle / Purchaser</th>
                <th className="py-3 px-3 whitespace-nowrap">Document</th>
                <th className="py-3 px-3">Materials / Items</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Declared Value</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-900 text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-medium">
                    <span className="inline-block animate-spin mr-2">🔄</span>
                    Loading gate register records...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="text-3xl mb-2">📭</div>
                    <div className="font-semibold text-slate-700">No entries recorded matching the selected criteria.</div>
                    <div className="text-xs text-slate-400 mt-1">Try adjusting the date range or clearing search keywords.</div>
                  </td>
                </tr>
              ) : (
                entries.map((e, index) => (
                  <tr
                    key={e.code}
                    onClick={() => navigate(`/e/${e.code}`)}
                    className={`cursor-pointer transition-all duration-150 group border-b border-slate-200/80 ${
                      e.dir === 'IN'
                        ? 'border-l-4 border-l-emerald-500 hover:bg-emerald-50/80'
                        : 'border-l-4 border-l-blue-500 hover:bg-blue-50/80'
                    } ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                    role="button"
                    tabIndex={0}
                    title={`Click anywhere on row to view full details of ${e.code}`}
                    onKeyDown={(evt) => {
                      if (evt.key === 'Enter' || evt.key === ' ') {
                        evt.preventDefault();
                        navigate(`/e/${e.code}`);
                      }
                    }}
                  >
                    {/* Gate Code Badge */}
                    <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-slate-900 text-amber-300 border border-slate-700 shadow-xs group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                        <span>🎫</span>
                        <span>{e.code}</span>
                      </div>
                    </td>

                    {/* Direction Badge */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {e.dir === 'IN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                          ↓ IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-300 shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          ↑ OUT
                        </span>
                      )}
                    </td>

                    {/* Date / Time */}
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      <span className="font-bold text-slate-900">{e.at.slice(5, 10)}</span>
                      <span className="ml-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                        {e.at.slice(11, 16)}
                      </span>
                    </td>

                    {/* Party / Supplier */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-extrabold text-white shadow-xs shrink-0 ${getPartyAvatar(
                            e.party
                          )}`}
                        >
                          {e.party ? e.party.charAt(0).toUpperCase() : 'P'}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors line-clamp-1">
                            {e.party}
                          </span>
                          {e.movement_type === 'Inter-Location Transfer' && (
                            <div className="text-[10px] text-blue-700 font-bold flex items-center gap-1 mt-0.5">
                              <span>🏢 Inter-Location</span>
                              {e.from_branch && e.to_branch && <span>({e.from_branch} ➔ {e.to_branch})</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Vehicle / Purchaser */}
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {e.purchaser_name || (e.inward_type === 'purchaser_hand' && e.person) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-teal-50 text-[#0f766e] border border-teal-200 shadow-xs">
                          <span>🛍️</span>
                          <span className="font-sans font-bold">{e.purchaser_name || e.person}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-xs">
                          <span>{e.vehicle_no && e.vehicle_no.toLowerCase() !== 'hand carried' ? '🚛' : '📦'}</span>
                          <span>{e.vehicle_no && e.vehicle_no.toLowerCase() !== 'hand carried' ? e.vehicle_no : (e.person || '—')}</span>
                        </span>
                      )}
                    </td>

                    {/* Document */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                        <span>📄</span>
                        <span>{e.doc_type} {e.doc_no ? `#${e.doc_no}` : ''}</span>
                      </span>
                    </td>

                    {/* Materials / Items */}
                    <td className="py-2.5 px-3 text-slate-700 max-w-[220px]">
                      <div className="truncate font-medium text-slate-800" title={e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; ')}>
                        {e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; ')}
                      </div>
                    </td>

                    {/* Declared Value */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {e.amount ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                          Rs {e.amount.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>

                    {/* Interactive Action Indicator */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs">
                        <span>Open</span>
                        <span>➔</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Colorful Summary Line */}
        <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-b-xl flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-300">Register Summary:</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-bold">
              {entries.length} Total Records
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold">
              ↓ {totalIn} Inward
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-700 font-bold">
              ↑ {totalOut} Outward
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Value:</span>
            <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700 font-bold font-mono">
              Rs {totalVal.toLocaleString()}
            </span>
          </div>
        </div>
      </Card3D>

      {/* Official Register Print Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        entries={entries}
        fromDate={fromDate}
        toDate={toDate}
        reportTitle="OFFICIAL GATE REGISTER DAYBOOK"
        onExportCSV={handleExportCSV}
      />
    </PageMotion>
  );
};
