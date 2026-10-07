import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GateEntry } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { Button3D } from '../../styles/emotion';
import { OutgoingMaterialGatePass } from './OutgoingMaterialGatePass';
import { downloadGateSlipPDF } from './pdfGenerator';
import { motion, AnimatePresence } from 'motion/react';

interface OutgoingGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: GateEntry;
}

export const OutgoingGatePassModal: React.FC<OutgoingGatePassModalProps> = ({
  isOpen,
  onClose,
  entry
}) => {
  const { settings } = useSettings();
  const [copyMode, setCopyMode] = React.useState<'triplicate' | 'single'>('triplicate');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('report-preview-open');
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
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

  const handlePrint = () => {
    const passElement = document.getElementById('outgoing-material-gate-pass');
    if (!passElement) {
      window.print();
      return;
    }

    try {
      const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

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
            <title>Outgoing Material Gate Pass (3 Copies) - ${entry.code}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans+Arabic:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
            ${headStyles}
            <style>
              @page {
                size: A4 portrait;
                margin: 4mm 6mm;
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
              #outgoing-material-gate-pass,
              .outgoing-material-gate-pass {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                display: block !important;
              }
              .gate-slip-single {
                width: 100% !important;
                margin: 0 auto !important;
                padding: 4px 8px !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                border: 2px solid #000000 !important;
                border-radius: 2px !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .perforation-line {
                margin: 2px 0 !important;
                padding: 1px 0 !important;
                color: #000000 !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
                font-family: 'Plus Jakarta Sans', sans-serif !important;
              }
              th, td {
                border-color: #000000 !important;
                color: #000000 !important;
              }
              .font-mono {
                font-family: 'JetBrains Mono', Consolas, monospace !important;
              }
            </style>
          </head>
          <body>
            ${passElement.outerHTML}
          </body>
        </html>
      `);
      doc.close();

      const printAction = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Iframe print error', e);
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
        doc.fonts.ready.then(() => setTimeout(printAction, 150));
      } else {
        setTimeout(printAction, 250);
      }
    } catch {
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    downloadGateSlipPDF(entry, settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD', 'GFI');
  };

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="relative flex flex-col w-full max-w-4xl rounded-2xl bg-white border border-[#dde1e6] shadow-2xl overflow-hidden my-auto max-h-[96vh]"
        >
          {/* Sleek Floating Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-950 text-white flex items-center justify-center text-sm font-bold shadow-lg transition-all cursor-pointer hover:scale-105"
            aria-label="Close"
            title="Close Preview (Esc)"
          >
            ✕
          </button>

          {/* Document Content Viewport */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-200/80">
            <div className="bg-white shadow-xl p-2 sm:p-4 rounded-lg max-w-[820px] mx-auto overflow-x-auto">
              <OutgoingMaterialGatePass
                entry={entry}
                companyName={settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'}
                companyAddress={settings.company_address || '53-B, Small Industries Estate, Gujranwala, Pakistan'}
                logoUrl={settings.logo_url}
                mode={copyMode}
              />
            </div>
          </div>

          {/* Footer Controls & Actions */}
          <div className="flex flex-wrap items-center justify-between border-t border-[#dde1e6] px-4 py-3 bg-white gap-3 shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Format:
              </span>
              <select
                value={copyMode}
                onChange={(e) => setCopyMode(e.target.value as any)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-900 focus:outline-none cursor-pointer shadow-2xs"
              >
                <option value="triplicate">3 Copies on 1 Page (Tear-Off for Security, Dept & Workshop)</option>
                <option value="single">Single Copy (Original)</option>
              </select>

              <span className="text-xs text-slate-300">|</span>
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${
                entry.returnable
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-800 border-slate-300'
              }`}>
                {entry.returnable ? '★ RETURNABLE MATERIAL' : 'NON-RETURNABLE'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button3D variant="sec" size="sm" onClick={handleDownloadPDF} className="font-bold">
                <span>📥</span>
                <span>Download PDF (3 Copies)</span>
              </Button3D>

              <Button3D variant="out" size="md" onClick={handlePrint} className="font-bold shadow-md">
                <span>🖨️</span>
                <span>Print 3 Copies (1 Page)</span>
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
