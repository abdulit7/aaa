import React, { useState, useEffect } from 'react';
import { GateEntry } from '../types';
import { useSettings } from '../context/SettingsContext';
import { downloadDaybookPDF, downloadOfficialRegisterPDF } from '../components/pdf/pdfGenerator';
import { ReportPreviewModal } from '../components/pdf/ReportPreviewModal';
import { Card3D, Button3D, StatusBadge } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';

export const ReportsPage: React.FC = () => {
  const { settings } = useSettings();
  const [entries, setEntries] = useState<GateEntry[]>([]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState<'all' | 'in' | 'out' | 'overdue'>('all');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetch('/api/entries')
      .then(res => res.json())
      .then(data => setEntries(data))
      .catch(console.error);
  }, []);

  const getFilteredEntries = () => {
    let filtered = entries.filter(e => {
      const entryDate = e.at.slice(0, 10);
      return entryDate >= fromDate && entryDate <= toDate && !e.cancelled;
    });

    if (reportType === 'in') {
      filtered = filtered.filter(e => e.dir === 'IN');
    } else if (reportType === 'out') {
      filtered = filtered.filter(e => e.dir === 'OUT');
    } else if (reportType === 'overdue') {
      const today = new Date().toISOString().slice(0, 10);
      filtered = filtered.filter(e => e.returnable && !e.returned_at && e.expected_return && e.expected_return < today);
    }

    return filtered;
  };

  const handleDownloadPDF = () => {
    const filtered = getFilteredEntries();
    const mode = reportType === 'out' ? 'outward' : reportType === 'in' ? 'inward' : 'daybook';
    downloadOfficialRegisterPDF(filtered, mode, settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD');
  };

  const handleExportCSV = () => {
    const filtered = getFilteredEntries();
    const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
    const headers = ['Register Code', 'Direction', 'Date/Time', 'Party', 'Vehicle No', 'Driver', 'Items', 'Doc No', 'Security Guard'];
    const rows = filtered.map(e => [
      e.code,
      e.dir,
      e.at,
      e.party,
      e.vehicle_no || 'Hand',
      e.driver || '',
      e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; '),
      e.doc_no || '',
      e.guard_name
    ]);

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gate_Register_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredEntries = getFilteredEntries();
  const totalIn = entries.filter(e => e.dir === 'IN' && !e.cancelled).length;
  const totalOut = entries.filter(e => e.dir === 'OUT' && !e.cancelled).length;
  const totalDeclaredAmount = entries
    .filter(e => !e.cancelled && e.amount)
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const reportTitle =
    reportType === 'in'
      ? 'Material Inward Movements Daybook'
      : reportType === 'out'
      ? 'Material Outward Dispatches Daybook'
      : reportType === 'overdue'
      ? 'Overdue Returnable Consignments Audit'
      : 'Comprehensive Gate Register Daybook';

  return (
    <PageMotion className="w-full space-y-5 pb-16">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#dde1e6] pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24] flex items-center gap-2">
            <span>📊</span>
            <span>Summary & Reports</span>
          </h1>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card3D className="p-4">
          <span className="text-xs text-[#5f6b7a] block">Total entries in system</span>
          <div className="text-2xl font-bold font-mono text-[#1b1f24] mt-1">{entries.length}</div>
        </Card3D>
        <Card3D className="p-4">
          <span className="text-xs text-[#5f6b7a] block">Material IN movements</span>
          <div className="text-2xl font-bold font-mono text-[#15803d] mt-1">{totalIn}</div>
        </Card3D>
        <Card3D className="p-4">
          <span className="text-xs text-[#5f6b7a] block">Total declared value</span>
          <div className="text-2xl font-bold font-mono text-[#1d4ed8] mt-1">
            Rs {totalDeclaredAmount.toLocaleString()}
          </div>
        </Card3D>
      </div>

      {/* Report Filter & Generator Card */}
      <Card3D className="no-print p-5 space-y-4 bg-white">
        <h2 className="text-sm font-bold text-[#1b1f24] uppercase tracking-wide flex items-center gap-2">
          <span>📋</span>
          <span>Generate Daybook & Material Report</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Report Type</label>
            <select
              value={reportType}
              onChange={e => setReportType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            >
              <option value="all">Comprehensive Gate Register (All)</option>
              <option value="in">Inward Movements Log (Material IN)</option>
              <option value="out">Outward Dispatches Log (Material OUT)</option>
              <option value="overdue">Overdue Returnable Consignments Audit</option>
            </select>
          </div>

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
        </div>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#dde1e6]">
          <span className="text-xs text-[#5f6b7a]">
            {filteredEntries.length} record{filteredEntries.length === 1 ? '' : 's'} found for selected date range and filter.
          </span>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Print & Preview Register Button */}
            <motion.div whileTap={{ scale: 0.96 }} className="flex-1 sm:flex-initial">
              <Button3D
                type="button"
                variant="in"
                size="md"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full justify-center font-bold"
              >
                <span>🖨️</span>
                <span>Print & Preview Register</span>
              </Button3D>
            </motion.div>

            <motion.div whileTap={{ scale: 0.96 }} className="flex-1 sm:flex-initial">
              <Button3D
                type="button"
                variant="sec"
                size="md"
                onClick={handleDownloadPDF}
                className="w-full justify-center font-bold"
              >
                <span>📥</span>
                <span>Save PDF</span>
              </Button3D>
            </motion.div>

            <motion.div whileTap={{ scale: 0.96 }} className="flex-1 sm:flex-initial">
              <Button3D
                type="button"
                variant="sec"
                size="md"
                onClick={handleExportCSV}
                className="w-full justify-center font-medium"
              >
                <span>📊</span>
                <span>CSV</span>
              </Button3D>
            </motion.div>
          </div>
        </div>
      </Card3D>

      {/* Official Register Print Preview Modal */}
      <ReportPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        entries={filteredEntries}
        fromDate={fromDate}
        toDate={toDate}
        reportTitle={reportTitle}
        initialMode={reportType === 'out' ? 'outward' : reportType === 'in' ? 'inward' : 'daybook'}
        onExportCSV={handleExportCSV}
      />
    </PageMotion>
  );
};
