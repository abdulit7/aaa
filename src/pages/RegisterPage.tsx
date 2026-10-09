import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Printer, FileSpreadsheet, Search, ArrowDownLeft, ArrowUpRight, ArrowRight } from 'lucide-react';
import { GateEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { ReportPreviewModal } from '../components/pdf/ReportPreviewModal';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';

type Tone = 'ok' | 'warn' | 'bad' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  ok: 'bg-emerald-50 text-emerald-800',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-800'
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isHandCarried = (v?: string) => !v || v.toLowerCase() === 'hand carried';
const isTransfer = (e: GateEntry) =>
  (e.movement_type || '').includes('Transfer') || !!e.inter_branch_details;

/** One plain-language status per entry, so the register shows what still needs attention. */
function statusOf(e: GateEntry, today: string): { label: string; tone: Tone } | null {
  if (e.cancelled) return { label: 'Cancelled', tone: 'bad' };

  if (isTransfer(e)) {
    switch (String(e.inter_branch_details?.status || '').toLowerCase()) {
      case 'in_transit': return { label: 'In transit', tone: 'info' };
      case 'pending_return': return { label: 'Return pending', tone: 'warn' };
      case 'return_in_transit': return { label: 'Returning', tone: 'info' };
      case 'received': return { label: 'Received', tone: 'ok' };
      case 'completed': return { label: 'Completed', tone: 'ok' };
    }
  }

  if (e.dir === 'OUT' && e.returnable && !e.returned_at) {
    return e.expected_return && e.expected_return < today
      ? { label: 'Return overdue', tone: 'bad' }
      : { label: 'Awaiting return', tone: 'warn' };
  }

  if (e.dir === 'IN' && !e.purchaser_name && !isHandCarried(e.vehicle_no) && !e.vehicle_out_at) {
    return { label: 'Vehicle inside', tone: 'warn' };
  }
  return null;
}

const itemsFull = (e: GateEntry) =>
  (e.items || []).map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; ');

function itemsShort(e: GateEntry): { first: string; more: number } {
  const items = e.items || [];
  if (items.length === 0) return { first: '—', more: 0 };
  return { first: `${items[0].desc} (${items[0].qty} ${items[0].unit})`, more: items.length - 1 };
}

const vehicleText = (e: GateEntry) =>
  e.purchaser_name ||
  (e.inward_type === 'purchaser_hand' && e.person) ||
  (!isHandCarried(e.vehicle_no) ? e.vehicle_no : e.person || 'By hand');

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [dir, setDir] = useState<'ALL' | 'IN' | 'OUT'>((searchParams.get('dir') as any) || 'ALL');
  const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
  const [toDate, setToDate] = useState(searchParams.get('to') || '');
  const [movementType, setMovementType] = useState<string>('ALL');
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const today = ymd(new Date());

  // Filters apply as you type or change them, there is no Apply button to forget
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (dir !== 'ALL') params.set('dir', dir);
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        if (movementType !== 'ALL') params.set('movement_type', movementType);
        if (includeCancelled) params.set('cancelled', 'true');
        const res = await fetch(`/api/entries?${params.toString()}`);
        if (!res.ok) throw new Error('Could not load the register');
        const data = await res.json();
        if (!cancelled) setEntries(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message || 'Could not load the register');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, dir, fromDate, toDate, movementType, includeCancelled]);

  const handleExportCSV = () => {
    const headers = [
      'Code', 'Direction', 'Date/Time', 'Party / Supplier', 'From', 'To', 'Status',
      'Vehicle / Purchaser', 'Document', 'Materials / Goods', 'Amount'
    ];
    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = entries.map(e => [
      e.code,
      e.dir,
      (e.at || '').slice(0, 16),
      e.party,
      isTransfer(e) ? e.from_branch || e.location || '' : '',
      isTransfer(e) ? e.to_branch || e.party || '' : '',
      statusOf(e, today)?.label || '',
      vehicleText(e),
      `${e.doc_type || ''} ${e.doc_no || ''}`.trim(),
      itemsFull(e),
      e.amount ? e.amount : ''
    ]);
    const csv =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gate_Register_${fromDate || 'start'}_to_${toDate || 'today'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    const live = entries.filter(e => !e.cancelled);
    return {
      all: entries.length,
      in: live.filter(e => e.dir === 'IN').length,
      out: live.filter(e => e.dir === 'OUT').length,
      value: live.reduce((sum, e) => sum + (e.amount || 0), 0)
    };
  }, [entries]);

  const filtersActive =
    !!query || dir !== 'ALL' || !!fromDate || !!toDate || movementType !== 'ALL' || includeCancelled;

  const clearFilters = () => {
    setQuery(''); setDir('ALL'); setFromDate(''); setToDate('');
    setMovementType('ALL'); setIncludeCancelled(false);
  };

  const open = (code: string) => navigate(`/e/${code}`);
  const scopeLabel = isAdmin ? 'All branches' : user?.location || 'Your branch';

  const DirectionMark: React.FC<{ e: GateEntry }> = ({ e }) =>
    e.dir === 'IN' ? (
      <span className="inline-flex items-center gap-1 font-semibold text-[#15803d]">
        <ArrowDownLeft className="h-4 w-4" aria-hidden /> In
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 font-semibold text-[#1d4ed8]">
        <ArrowUpRight className="h-4 w-4" aria-hidden /> Out
      </span>
    );

  const StatusPill: React.FC<{ e: GateEntry }> = ({ e }) => {
    const st = statusOf(e, today);
    if (!st) return <span className="text-slate-400">—</span>;
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE_CLASS[st.tone]}`}>
        {st.label}
      </span>
    );
  };

  const PartyBlock: React.FC<{ e: GateEntry }> = ({ e }) => {
    if (isTransfer(e)) {
      return (
        <>
          <div className="font-semibold text-[#1b1f24] flex flex-wrap items-center gap-x-1.5">
            <span>{e.from_branch || e.location}</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span>{e.to_branch || e.party}</span>
          </div>
          <div className="text-xs text-[#5f6b7a]">
            Branch transfer
            {e.returnable && <> · returnable{e.expected_return ? `, due ${e.expected_return}` : ''}</>}
          </div>
        </>
      );
    }
    return (
      <>
        <div className="font-semibold text-[#1b1f24] line-clamp-1">{e.party}</div>
        {e.dir === 'OUT' && e.movement_type && e.movement_type !== 'External / Supplier' && (
          <div className="text-xs text-[#5f6b7a]">{e.movement_type}</div>
        )}
      </>
    );
  };

  return (
    <PageMotion className="space-y-4 pb-24 md:pb-10">
      <div className="no-print flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24]">Gate register</h1>
          <p className="text-sm text-[#5f6b7a] mt-0.5">
            {scopeLabel} · tap a record to open it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button3D variant="in" size="sm" onClick={() => setIsPreviewOpen(true)} disabled={entries.length === 0} className="font-bold">
            <Printer className="h-4 w-4" aria-hidden />
            <span>Print register</span>
          </Button3D>
          <Button3D variant="sec" size="sm" onClick={handleExportCSV} disabled={entries.length === 0} className="font-bold">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            <span>CSV</span>
          </Button3D>
        </div>
      </div>

      {/* Filters */}
      <Card3D className="gm-fields no-print p-4 space-y-3 bg-white">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search code, party, vehicle, document or item"
              aria-label="Search the register"
              className="w-full pl-10 pr-3.5 bg-white border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#eef1f4] p-1 md:w-64" role="radiogroup" aria-label="Direction">
            {([['ALL', 'All'], ['IN', 'In'], ['OUT', 'Out']] as const).map(([val, label]) => (
              <button
                key={val}
                type="button"
                role="radio"
                aria-checked={dir === val}
                onClick={() => setDir(val)}
                className={`min-h-[42px] rounded-md text-sm font-semibold cursor-pointer transition-colors ${
                  dir === val ? 'bg-white text-[#14532d] shadow-xs' : 'text-[#5f6b7a] hover:text-[#1b1f24]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-end">
          <div>
            <label className="form-label" htmlFor="reg-from">From</label>
            <input id="reg-from" type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)} className="w-full px-3 bg-white border rounded-lg" />
          </div>
          <div>
            <label className="form-label" htmlFor="reg-to">To</label>
            <input id="reg-to" type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)} className="w-full px-3 bg-white border rounded-lg" />
          </div>
          <div className="col-span-2 lg:col-span-1">
            <label className="form-label" htmlFor="reg-move">Movement</label>
            <select id="reg-move" value={movementType} onChange={e => setMovementType(e.target.value)} className="w-full px-3 bg-white border rounded-lg">
              <option value="ALL">All movements</option>
              <option value="Inter-Location Transfer">Branch transfer</option>
              <option value="External / Supplier">External / supplier</option>
              <option value="Customer / Sale">Customer / sale</option>
              <option value="Repair / Maintenance">Repair / maintenance</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <label className="col-span-2 lg:col-span-1 flex items-center gap-2 text-sm font-medium text-[#344054] cursor-pointer min-h-[46px] md:min-h-[42px]">
            <input type="checkbox" checked={includeCancelled} onChange={e => setIncludeCancelled(e.target.checked)} className="rounded text-[#15803d]" />
            <span>Show cancelled</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setFromDate(today); setToDate(today); }}
            className={`min-h-[38px] px-3.5 rounded-full border text-sm font-semibold cursor-pointer transition-colors ${
              fromDate === today && toDate === today
                ? 'bg-emerald-50 border-[#15803d] text-[#15803d]'
                : 'bg-white border-[#c5ccd4] text-[#344054] hover:bg-slate-50'
            }`}
          >
            Today
          </button>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="min-h-[38px] px-2 text-sm font-semibold text-[#1d4ed8] hover:underline cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      </Card3D>

      {/* Records */}
      <Card3D className="register-table-card overflow-hidden p-0 bg-white">
        <div className="no-print px-4 py-3 border-b border-[#dde1e6] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="font-bold text-[#1b1f24]">
            {loading ? 'Loading…' : `${totals.all} record${totals.all === 1 ? '' : 's'}`}
          </span>
          {!loading && !loadError && (
            <span className="text-[#5f6b7a]">
              {totals.in} in · {totals.out} out
              {totals.value > 0 && <> · Rs {totals.value.toLocaleString()}</>}
            </span>
          )}
        </div>

        {loadError && <div className="p-5 text-sm font-semibold text-[#b91c1c] bg-[#fdecec]">{loadError}. Change a filter or reload the page to try again.</div>}

        {!loading && !loadError && entries.length === 0 && (
          <div className="p-10 text-center">
            <p className="font-semibold text-[#1b1f24]">No records match</p>
            <p className="text-sm text-[#5f6b7a] mt-1">
              {filtersActive ? 'Clear the filters or widen the dates.' : 'Entries will appear here as soon as they are saved.'}
            </p>
          </div>
        )}

        {!loadError && entries.length > 0 && (
          <>
            {/* Tablet and desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm text-left border-collapse">
                <thead className="bg-[#f6f8fa] text-[#5f6b7a] text-xs font-semibold border-b border-[#dde1e6]">
                  <tr>
                    <th className="py-2.5 pl-4 pr-3">Code</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Party or route</th>
                    <th className="py-2.5 px-3">Vehicle</th>
                    <th className="py-2.5 px-3">Document</th>
                    <th className="py-2.5 px-3">Items</th>
                    <th className="py-2.5 px-3 text-right">Value</th>
                    <th className="py-2.5 pl-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {entries.map(e => {
                    const it = itemsShort(e);
                    return (
                      <tr
                        key={e.code}
                        onClick={() => open(e.code)}
                        onKeyDown={evt => {
                          if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); open(e.code); }
                        }}
                        role="link"
                        tabIndex={0}
                        className={`cursor-pointer hover:bg-[#f6f9f7] focus-visible:bg-[#f6f9f7] border-l-[3px] ${
                          e.cancelled ? 'opacity-60' : ''
                        } ${e.dir === 'IN' ? 'border-l-[#15803d]' : 'border-l-[#1d4ed8]'}`}
                      >
                        <td className="py-3 pl-4 pr-3 font-mono font-semibold text-[#1b1f24] whitespace-nowrap">{e.code}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-[#1b1f24]">{(e.at || '').slice(0, 10)}</div>
                          <div className="text-xs text-[#5f6b7a] font-mono">{(e.at || '').slice(11, 16)}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap"><DirectionMark e={e} /></td>
                        <td className="py-3 px-3 max-w-[260px]"><PartyBlock e={e} /></td>
                        <td className="py-3 px-3 whitespace-nowrap font-mono text-xs text-[#344054]">{vehicleText(e)}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-[#344054]">
                          {e.doc_type}{e.doc_no ? ` #${e.doc_no}` : ''}
                        </td>
                        <td className="py-3 px-3 max-w-[240px]" title={itemsFull(e)}>
                          <div className="truncate text-[#1b1f24]">{it.first}</div>
                          {it.more > 0 && <div className="text-xs text-[#5f6b7a]">+{it.more} more</div>}
                        </td>
                        <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                          {e.amount ? `Rs ${e.amount.toLocaleString()}` : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="py-3 pl-3 pr-4"><StatusPill e={e} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phones: cards */}
            <ul className="md:hidden divide-y divide-[#eef0f3]">
              {entries.map(e => {
                const it = itemsShort(e);
                return (
                  <li key={e.code}>
                    <button
                      type="button"
                      onClick={() => open(e.code)}
                      className={`block w-full text-left px-4 py-3.5 active:bg-[#f3f5f7] border-l-[3px] cursor-pointer ${
                        e.cancelled ? 'opacity-60' : ''
                      } ${e.dir === 'IN' ? 'border-l-[#15803d]' : 'border-l-[#1d4ed8]'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#1b1f24]">{e.code}</span>
                        <StatusPill e={e} />
                      </div>
                      <div className="mt-1.5"><PartyBlock e={e} /></div>
                      <div className="mt-1 text-sm text-[#344054] truncate">
                        {it.first}{it.more > 0 && <span className="text-[#5f6b7a]"> +{it.more} more</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#5f6b7a]">
                        <DirectionMark e={e} />
                        <span>{(e.at || '').slice(5, 16)}</span>
                        <span className="font-mono">{vehicleText(e)}</span>
                        {e.amount ? <span className="font-mono">Rs {e.amount.toLocaleString()}</span> : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card3D>

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
