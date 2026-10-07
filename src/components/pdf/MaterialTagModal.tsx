import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GateEntry } from '../../types';
import { useSettings } from '../../context/SettingsContext';
import { Button3D } from '../../styles/emotion';
import { MaterialTagLabel } from './MaterialTagLabel';
import { downloadMaterialTagPDF } from './pdfGenerator';
import { motion, AnimatePresence } from 'motion/react';

interface MaterialTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: GateEntry;
}

export const MaterialTagModal: React.FC<MaterialTagModalProps> = ({
  isOpen,
  onClose,
  entry
}) => {
  const { settings } = useSettings();

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
    const tagElement = document.getElementById('material-tag-label');
    if (!tagElement) {
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
            <title>Material Tag - ${entry.code}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />
            ${headStyles}
            <style>
              @page {
                size: 80mm auto;
                margin: 3mm;
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
              #material-tag-label,
              .material-tag-label {
                width: 100% !important;
                max-width: 420px !important;
                margin: 0 auto !important;
                padding: 8px !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: block !important;
                border: 2px solid #000000 !important;
              }
              table {
                width: 100% !important;
                border-collapse: collapse !important;
                table-layout: fixed !important;
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
            ${tagElement.outerHTML}
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
    downloadMaterialTagPDF(entry, settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD');
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
          className="relative flex flex-col w-full max-w-lg rounded-2xl bg-white border border-[#dde1e6] shadow-2xl overflow-hidden my-auto max-h-[96vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#dde1e6] bg-[#f8fafc]">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏷️</span>
              <span className="font-extrabold text-sm text-slate-800">
                Material Inward Tag (QR & Item Qty)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Tag Preview Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 flex items-center justify-center">
            <div className="bg-white shadow-xl p-2 rounded-lg max-w-full">
              <MaterialTagLabel
                entry={entry}
                companyName={settings.company_name || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'}
              />
            </div>
          </div>

          {/* Footer Controls & Actions */}
          <div className="flex flex-wrap items-center justify-between border-t border-[#dde1e6] px-4 py-3 bg-white gap-3 shadow-md">
            <div className="text-xs font-mono font-bold text-slate-600">
              Code: <span className="text-blue-700">{entry.code}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button3D variant="sec" size="sm" onClick={handleDownloadPDF} className="font-bold">
                <span>📥</span>
                <span>Download Tag (PDF)</span>
              </Button3D>

              <Button3D variant="in" size="md" onClick={handlePrint} className="font-bold shadow-md">
                <span>🖨️</span>
                <span>Print Material Tag</span>
              </Button3D>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-300 transition-colors cursor-pointer"
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
