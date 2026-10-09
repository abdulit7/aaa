import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Download, FileSpreadsheet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { GateEntry } from '../types';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { downloadOfficialRegisterPDF } from '../components/pdf/pdfGenerator';
import { ReportPreviewModal } from '../components/pdf/ReportPreviewModal';
import { Card3D, Button3D, StatusBadge, KpiCard } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';

type ReportType = 'all' | 'in' | 'out' | 'overdue';

const TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'all', label: 'All movements' },
  { value: 'in', label: 'Material in' },
  { value: 'out', label: 'Material out' },
  { value: 'overdue', label: 'Overdue returns' }
];

const PREVIEW_ROWS = 50;

// Local calendar date (toISOString would shift the day for users ahead of UTC)
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
};

const monthStart = () => {
  const d = new Date();
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1));
};

const itemsText = (e: GateEntry) =>
  (e.items || []).map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; ');

export const ReportsPage: React.FC = () => {
  const { settings } = useSettings();
  const { user, isAdmin } = useAuth();

  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(() => daysAgo(7));
  const [toDate, setToDate] = useState(() => ymd(new Date()));
  const [reportType, setReportType] = useState<ReportType>('all');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetch('/api/entries')
      .then(async res => {
        if (!res.ok) throw new Error('Could not load entries');
        return res.json();
      })
      .then(data => setEntries(Array.isArray(data) ? data : []))
      .catch(err => setLoadError(err.message || 'Could not load entries'))
      .finally(() => setLoading(false));
  }, []);

  const today = ymd(new Date());

  const filtered = useMemo(() => {
    let list = entries.filter(e => {
      const day = (e.at || '').slice(0, 10);
      return day >= fromDate && day <= toDate && !e.cancelled;
    });
    if (reportType === 'in') list = list.filter(e => e.dir === 'IN');
    else if (reportType === 'out') list = list.filter(e => e.dir === 'OUT');
    else if (reportType === 'overdue') {
      list = list.filter(e => e.returnable && !e.returned_at && e.expected_return && e.expected_return < today);
    }
    return list;
  }, [entries, fromDate, toDate, reportType, today]);

  // Summary figures follow the date range, so they match the list below
  const inRange = useMemo(
    () => entries.filter(e => {
      const day = (e.at || '').slice(0, 10);
      return day >= fromDate && day <= toDate && !e.cancelled;
    }),
    [entries, fromDate, toDate]
  );
  const countIn = inRange.filter(e => e.dir === 'IN').length;
  const countOut = inRange.filter(e => e.dir === 'OUT').length;
  const overdueAll = entries.filter(
    e => !e.cancelled && e.returnable && !e.returned_at && e.expected_return && e.expected_return < today
  ).length;
  const declaredValue = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  const registerMode = reportType === 'out' ? 'outward' : reportType === 'in' ? 'inward' : 'daybook';

  const reportTitle =
    reportType === 'in'
      ? 'Material Inward Movements Daybook'
      : reportType === 'out'
      ? 'Material Outward Dispatches Daybook'
      : reportType === 'overdue'
      ? 'Overdue Returnable Consignments Audit'
      : 'Comprehensive Gate Register Daybook';

  const handleDownloadPDF = () => {
    downloadOfficialRegisterPDF(
      filtered,
      registerMode,
      settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'
    );
  };

  const handleExportCSV = () => {
    const escapeCsv = (str: any) => `"${String(str ?? '').replace(/"/g, '""')}"`;
    const headers = [
      'Register Code', 'Direction', 'Movement', 'Date/Time', 'Party', 'Vehicle No',
      'Driver', 'Items', 'Doc No', 'Security Guard'
    ];
    const rows = filtered.map(e => [
      e.code,
      e.dir,
      e.movement_type || '',
      e.at,
      e.party,
      e.vehicle_no || 'Hand',
      e.driver || '',
      itemsText(e),
      e.doc_no || '',
      e.guard_name
    ]);
    const csv =
      '\uFEFF' +
      [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gate_Register_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const quickRanges = [
    { label: 'Today', from: today, to: today },
    { label: 'Last 7 days', from: daysAgo(7), to: today },
    { label: 'This month', from: monthStart(), to: today }
  ];

  const shown = filtered.slice(0, PREVIEW_ROWS);
  const scopeLabel = isAdmin ? 'All branches' : user?.location || 'Your branch';

  const directionBadge = (e: GateEntry) =>
    e.dir === 'IN' ? (
      <StatusBadge variant="in">
        <span className="inline-flex items-center gap-1">
          <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden /> In
        </span>
      </StatusBadge>
    ) : (
      <StatusBadge variant="out">
        <span className="inline-flex items-center gap-1">
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Out
        </span>
      </StatusBadge>
    );

  const isTransfer = (e: GateEntry) => (e.movement_type || '').includes('Transfer');

  return (
    <PageMotion className="w-full space-y-5 pb-20 md:pb-16">
      <div className="no-print border-b border-[#dde1e6] pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24]">Reports</h1>
        <p className="text-sm text-[#5f6b7a] mt-0.5">
          Showing entries for <strong className="text-[#1b1f24]">{scopeLabel}</strong>
        </p>
      </div>

      {/* Summary for the chosen dates */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard>
          <span className="text-xs text-[#5f6b7a] block">Movements in range</span>
          <div className="kpi-val text-2xl font-bold font-mono text-[#1b1f24] mt-1">{inRange.length}</div>
        </KpiCard>
        <KpiCard>
          <span className="text-xs text-[#5f6b7a] block">Material in</span>
          <div className="kpi-val text-2xl font-bold font-mono text-[#15803d] mt-1">{countIn}</div>
        </KpiCard>
        <KpiCard>
          <span className="text-xs text-[#5f6b7a] block">Material out</span>
          <div className="kpi-val text-2xl font-bold font-mono text-[#1d4ed8] mt-1">{countOut}</div>
        </KpiCard>
        <KpiCard alert={overdueAll > 0 ? 'bad' : undefined}>
          <span className="text-xs text-[#5f6b7a] block">Overdue returns</span>
          <div className="kpi-val text-2xl font-bold font-mono text-[#1b1f24] mt-1">{overdueAll}</div>
        </KpiCard>
      </div>

      {/* Filters */}
      <Card3D className="gm-fields no-print p-4 sm:p-5 space-y-4 bg-white">
        <div>
          <span className="form-label">Report type</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Report type">
            {TYPE_OPTIONS.map(opt => {
              const active = reportType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setReportType(opt.value)}
                  className={`min-h-[46px] px-3 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#14532d] border-[#14532d] text-white'
                      : 'bg-white border-[#c5ccd4] text-[#1b1f24] hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="form-label" htmlFor="rep-from">From</label>
            <input
              id="rep-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full px-3.5 bg-white border rounded-lg"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="rep-to">To</label>
            <input
              id="rep-to"
              type="date"
              value={toDate}
              min={fromDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full px-3.5 bg-white border rounded-lg"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickRanges.map(r => {
            const active = fromDate === r.from && toDate === r.to;
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => { setFromDate(r.from); setToDate(r.to); }}
                className={`min-h-[40px] px-3.5 rounded-full border text-sm font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'bg-emerald-50 border-[#15803d] text-[#15803d]'
                    : 'bg-white border-[#c5ccd4] text-[#344054] hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Card3D>

      {/* Actions: sits under the filters, pins to the bottom of the screen on phones */}
      <div className="gm-actionbar no-print">
        <Button3D
          type="button"
          variant="in"
          size="md"
          onClick={() => setIsPreviewOpen(true)}
          disabled={filtered.length === 0}
          className="justify-center font-bold sm:flex-none"
        >
          <Printer className="h-4 w-4" aria-hidden />
          <span>Print register</span>
        </Button3D>
        <Button3D
          type="button"
          variant="sec"
          size="md"
          onClick={handleDownloadPDF}
          disabled={filtered.length === 0}
          className="justify-center font-bold sm:flex-none"
        >
          <Download className="h-4 w-4" aria-hidden />
          <span>PDF</span>
        </Button3D>
        <Button3D
          type="button"
          variant="sec"
          size="md"
          onClick={handleExportCSV}
          disabled={filtered.length === 0}
          className="justify-center font-bold sm:flex-none"
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          <span>CSV</span>
        </Button3D>
      </div>

      {/* Results */}
      <Card3D className="no-print bg-white overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[#dde1e6] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-base font-bold text-[#1b1f24]">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </h2>
          <span className="text-sm text-[#5f6b7a]">
            {fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`}
            {declaredValue > 0 && <> · Declared value Rs {declaredValue.toLocaleString()}</>}
          </span>
        </div>

        {loading && <div className="p-8 text-center text-sm text-[#5f6b7a]">Loading entries…</div>}

        {!loading && loadError && (
          <div className="p-6 text-sm font-semibold text-[#b91c1c] bg-[#fdecec]">{loadError}. Reload the page to try again.</div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-semibold text-[#1b1f24]">No entries for these dates</p>
            <p className="text-sm text-[#5f6b7a] mt-1">Try a wider date range or a different report type.</p>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-[#f6f8fa] text-[#5f6b7a] text-xs font-semibold">
                    <th className="px-5 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Date and time</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Party</th>
                    <th className="px-3 py-2.5">Items</th>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-5 py-2.5">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(e => (
                    <tr key={e.id || e.code} className="border-t border-[#eef0f3] hover:bg-[#f9fafb]">
                      <td className="px-5 py-3 font-mono font-semibold whitespace-nowrap">
                        <Link to={`/e/${e.code}`} className="text-[#15803d] hover:underline">{e.code}</Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-[#344054]">{(e.at || '').slice(0, 16)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {directionBadge(e)}
                          {isTransfer(e) && <StatusBadge variant="mut">Transfer</StatusBadge>}
                        </span>
                      </td>
                      <td className="px-3 py-3 max-w-[220px] truncate font-medium" title={e.party}>{e.party}</td>
                      <td className="px-3 py-3 max-w-[260px] truncate text-[#344054]" title={itemsText(e)}>{itemsText(e) || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">{e.vehicle_no || 'Hand'}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-[#344054]">{e.doc_no || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="md:hidden divide-y divide-[#eef0f3]">
              {shown.map(e => (
                <li key={e.id || e.code}>
                  <Link to={`/e/${e.code}`} className="block px-4 py-3.5 active:bg-[#f3f5f7]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#15803d]">{e.code}</span>
                      <span className="inline-flex items-center gap-1.5">
                        {isTransfer(e) && <StatusBadge variant="mut">Transfer</StatusBadge>}
                        {directionBadge(e)}
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-[#1b1f24] truncate">{e.party}</div>
                    <div className="mt-0.5 text-sm text-[#5f6b7a] line-clamp-2">{itemsText(e) || 'No items listed'}</div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-[#5f6b7a]">
                      <span>{(e.at || '').slice(0, 16)}</span>
                      <span className="font-mono">{e.vehicle_no || 'Hand'}</span>
                      {e.doc_no && <span>Doc {e.doc_no}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {filtered.length > PREVIEW_ROWS && (
              <div className="px-4 sm:px-5 py-3 text-sm text-[#5f6b7a] border-t border-[#dde1e6] bg-[#f9fafb]">
                Showing the first {PREVIEW_ROWS} of {filtered.length}. Print, PDF and CSV include all of them.
              </div>
            )}
          </>
        )}
      </Card3D>

      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        entries={filtered}
        fromDate={fromDate}
        toDate={toDate}
        reportTitle={reportTitle}
        initialMode={registerMode}
        onExportCSV={handleExportCSV}
      />
    </PageMotion>
  );
};
