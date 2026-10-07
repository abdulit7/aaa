import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GateEntry } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { Button3D } from '../../styles/emotion';
import { downloadOfficialRegisterPDF } from './pdfGenerator';
import { OfficialRegisterSheet } from '../reports/OfficialRegisterSheet';
import { motion, AnimatePresence } from 'motion/react';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: GateEntry[];
  fromDate: string;
  toDate: string;
  reportTitle?: string;
  initialMode?: 'outward' | 'inward' | 'daybook';
  onExportCSV?: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  entries,
  fromDate,
  toDate,
  initialMode,
  onExportCSV
}) => {
  const { settings } = useSettings();

  // Determine initial register mode
  const getInitialRegisterType = (): 'outward' | 'inward' | 'daybook' => {
    if (initialMode) return initialMode;
    const inCount = entries.filter(e => e.dir === 'IN').length;
    const outCount = entries.filter(e => e.dir === 'OUT').length;
    if (outCount > 0 && inCount === 0) return 'outward';
    if (inCount > 0 && outCount === 0) return 'inward';
    return 'daybook';
  };

  const [registerType, setRegisterType] = useState<'outward' | 'inward' | 'daybook'>(getInitialRegisterType);
  const [showCompanyHeader, setShowCompanyHeader] = useState(false);
  const [minRows, setMinRows] = useState(15);

  // Sync mode when initialMode changes
  useEffect(() => {
    if (initialMode) {
      setRegisterType(initialMode);
    }
  }, [initialMode]);

  // Manage print class on body to isolate print strictly to the preview sheet
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('report-preview-open');
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('report-preview-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('report-preview-open');
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrintDocument = () => {
    const sheet = document.getElementById('official-register-sheet');
    if (!sheet) {
      window.print();
      return;
    }

    try {
      // Gather all style elements and stylesheets from the main page to ensure identical layout
      const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      // Create an isolated hidden iframe for 100% clean, non-blank landscape printing
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Gate Daybook Register</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
            ${headStyles}
            <style>
              @page {
                size: landscape;
                margin: 6mm 6mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Plus Jakarta Sans', "Segoe UI", system-ui, -apple-system, sans-serif !important;
                -webkit-font-smoothing: antialiased;
              }
              #official-register-sheet,
              .official-register-sheet {
                width: 100% !important;
                max-width: 100% !important;
                min-width: 0 !important;
                margin: 0 auto !important;
                padding: 2px !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: block !important;
                font-family: 'Plus Jakarta Sans', "Segoe UI", system-ui, -apple-system, sans-serif !important;
              }
              h1 {
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-size: 24px !important;
                line-height: 1.2 !important;
                text-align: center !important;
                margin: 4px 0 10px 0 !important;
              }
              h1 span.font-extrabold {
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-weight: 800 !important;
                font-size: 24px !important;
                letter-spacing: -0.02em !important;
              }
              h1 span.font-normal {
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-weight: 400 !important;
                font-size: 20px !important;
              }
              h2 {
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-weight: 800 !important;
                font-size: 15px !important;
                text-transform: uppercase !important;
                letter-spacing: 0.05em !important;
                text-align: center !important;
                margin: 0 0 2px 0 !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                border: 2px solid #000000 !important;
                table-layout: fixed !important;
                font-family: 'Plus Jakarta Sans', sans-serif !important;
              }
              thead tr {
                background-color: #ffffff !important;
                border-bottom: 2px solid #000000 !important;
              }
              th {
                border: 1px solid #000000 !important;
                border-bottom: 2px solid #000000 !important;
                color: #000000 !important;
                background-color: #ffffff !important;
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                text-align: center !important;
                vertical-align: middle !important;
                line-height: 1.2 !important;
                padding: 5px 3px !important;
              }
              td {
                border: 1px solid #000000 !important;
                color: #000000 !important;
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                font-size: 10.5px !important;
                line-height: 1.25 !important;
                vertical-align: middle !important;
                padding: 4px 5px !important;
              }
              .font-mono,
              td.font-mono,
              th.font-mono {
                font-family: 'JetBrains Mono', Consolas, monospace !important;
                font-size: 10.5px !important;
                font-variant-numeric: tabular-nums !important;
              }
              .truncate {
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
              }
              .whitespace-nowrap {
                white-space: nowrap !important;
              }
            </style>
          </head>
          <body>
            ${sheet.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      const printAction = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Iframe print error, falling back to window.print', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      };

      if (doc.fonts) {
        doc.fonts.ready.then(() => {
          setTimeout(printAction, 150);
        });
      } else {
        setTimeout(printAction, 250);
      }
    } catch {
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    downloadOfficialRegisterPDF(
      entries,
      registerType,
      settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
      showCompanyHeader,
      minRows
    );
  };

  const modalContent = (
    <AnimatePresence>
      <div
        className="report-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="report-modal-container relative flex flex-col w-full max-w-6xl rounded-2xl bg-white border border-[#dde1e6] shadow-2xl overflow-hidden my-auto max-h-[96vh]"
        >
          {/* Top-Right Sleek Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="report-modal-close-btn absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-950 text-white flex items-center justify-center text-sm font-bold shadow-lg transition-all cursor-pointer hover:scale-105"
            aria-label="Close Preview"
            title="Close Preview (Esc)"
          >
            ✕
          </button>

          {/* Document Content Viewport */}
          <div className="report-modal-viewport flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/80">
            <div className="report-sheet-wrapper bg-white shadow-lg border border-slate-300 p-2 sm:p-6 rounded-lg max-w-[1050px] mx-auto overflow-x-auto">
              <OfficialRegisterSheet
                entries={entries}
                mode={registerType}
                companyName={settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'}
                showCompanyHeader={showCompanyHeader}
                minRows={minRows}
                fromDate={fromDate}
                toDate={toDate}
                gateName={settings.gates ? settings.gates.split(',')[0] : 'Main Gate'}
              />
            </div>
          </div>

          {/* Footer Controls & Actions */}
          <div className="report-modal-footer flex flex-wrap items-center justify-between border-t border-[#dde1e6] px-4 py-3 bg-white gap-3 shadow-md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-700">Register Type:</span>
                <select
                  value={registerType}
                  onChange={(e) => setRegisterType(e.target.value as any)}
                  className="bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
                >
                  <option value="outward">Material Outward Register</option>
                  <option value="inward">Material Inward Register</option>
                  <option value="daybook">Gate Daybook Register</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-slate-700 font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={showCompanyHeader}
                  onChange={(e) => setShowCompanyHeader(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Company Header</span>
              </label>

              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                <span>Rows:</span>
                <select
                  value={minRows}
                  onChange={(e) => setMinRows(Number(e.target.value))}
                  className="bg-slate-50 hover:bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer shadow-xs"
                >
                  <option value="10">10 Rows</option>
                  <option value="15">15 Rows</option>
                  <option value="20">20 Rows</option>
                  <option value="25">25 Rows</option>
                </select>
              </div>

              <span className="text-xs text-slate-300 hidden sm:inline">|</span>
              <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {entries.length} records
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onExportCSV && (
                <Button3D variant="sec" size="sm" onClick={onExportCSV} className="font-bold">
                  <span>📊</span>
                  <span>Export CSV</span>
                </Button3D>
              )}
              <Button3D variant="sec" size="sm" onClick={handleDownloadPDF} className="font-bold">
                <span>📥</span>
                <span>Save PDF</span>
              </Button3D>
              <Button3D variant="in" size="md" onClick={handlePrintDocument} className="font-bold shadow-md">
                <span>🖨️</span>
                <span>Print Document</span>
              </Button3D>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
