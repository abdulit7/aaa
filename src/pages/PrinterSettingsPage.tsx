import React, { useState, useEffect } from 'react';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import {
  isMobileDevice,
  isBluetoothConnected,
  getSavedPrinterConfig,
  savePrinterConfig,
  connectBluetoothPrinter,
  printTestSlip,
  getBluetoothDiagnostics,
  PrintMethod,
  BluetoothPrinterConfig
} from '../utils/bluetoothPrinter';

export const PrinterSettingsPage: React.FC = () => {
  const [config, setConfig] = useState<BluetoothPrinterConfig | null>(null);
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [printMethod, setPrintMethod] = useState<PrintMethod>('rawbt');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    const diag = getBluetoothDiagnostics();
    const saved = getSavedPrinterConfig();
    if (saved) {
      setConfig(saved);
      setPaperWidth(saved.paperWidth || '58mm');
      setPrintMethod(saved.printMethod || (diag.isMobile ? 'rawbt' : 'system'));
    } else {
      setPrintMethod(diag.isMobile ? 'rawbt' : 'system');
    }
  }, []);

  const handleMethodChange = (method: PrintMethod) => {
    setPrintMethod(method);
    const updated = savePrinterConfig({ printMethod: method, paperWidth });
    setConfig(updated);
    setStatusMessage({
      type: 'info',
      text: `Printing mode set to ${
        method === 'rawbt'
          ? 'Direct Android Bluetooth (RawBT)'
          : method === 'web_bluetooth'
          ? 'Web Bluetooth (BLE)'
          : 'System Print Spooler'
      }`
    });
  };

  const handlePaperWidthChange = (val: '58mm' | '80mm') => {
    setPaperWidth(val);
    const updated = savePrinterConfig({ paperWidth: val, printMethod });
    setConfig(updated);
  };

  const handleWebBluetoothConnect = async () => {
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Scanning for Bluetooth Low Energy printer...' });

    try {
      const res = await connectBluetoothPrinter(paperWidth);
      if (res.success) {
        const updated = getSavedPrinterConfig();
        setConfig(updated);
        setStatusMessage({
          type: 'success',
          text: `Connected to ${res.deviceName}`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to connect. Try RawBT mode for Bluetooth Classic printers.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Bluetooth connection failed.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setLoading(true);
    setStatusMessage({ type: 'info', text: 'Sending test slip...' });

    try {
      const res = await printTestSlip(printMethod);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Test print sent successfully.'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Test print failed.'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to send test print.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageMotion className="w-full space-y-4 pb-16">
      <div className="border-b border-[#dde1e6] pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24] flex items-center gap-2">
          <span>🖨️</span>
          <span>Thermal Printer Settings</span>
        </h1>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-between gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-sky-50 border-sky-300 text-sky-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      <Card3D className="p-4 sm:p-5 space-y-4 bg-white">
        <div>
          <label className="form-label">Print Method</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleMethodChange('rawbt')}
              className={`p-3 rounded-lg border text-left text-xs font-bold transition-all ${
                printMethod === 'rawbt'
                  ? 'border-[#15803d] bg-emerald-50 text-[#15803d] ring-1 ring-[#15803d]'
                  : 'border-[#dde1e6] bg-slate-50 text-[#1b1f24] hover:bg-white'
              }`}
            >
              Direct Android Bluetooth (RawBT)
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('web_bluetooth')}
              className={`p-3 rounded-lg border text-left text-xs font-bold transition-all ${
                printMethod === 'web_bluetooth'
                  ? 'border-[#15803d] bg-emerald-50 text-[#15803d] ring-1 ring-[#15803d]'
                  : 'border-[#dde1e6] bg-slate-50 text-[#1b1f24] hover:bg-white'
              }`}
            >
              Web Bluetooth (BLE)
            </button>

            <button
              type="button"
              onClick={() => handleMethodChange('system')}
              className={`p-3 rounded-lg border text-left text-xs font-bold transition-all ${
                printMethod === 'system'
                  ? 'border-[#15803d] bg-emerald-50 text-[#15803d] ring-1 ring-[#15803d]'
                  : 'border-[#dde1e6] bg-slate-50 text-[#1b1f24] hover:bg-white'
              }`}
            >
              System Print Dialog
            </button>
          </div>
        </div>

        <div>
          <label className="form-label">Paper Width</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePaperWidthChange('58mm')}
              className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                paperWidth === '58mm'
                  ? 'bg-[#15803d] text-white border-[#15803d]'
                  : 'bg-white text-[#1b1f24] border-[#c5ccd4] hover:bg-slate-50'
              }`}
            >
              58mm (POS-58)
            </button>
            <button
              type="button"
              onClick={() => handlePaperWidthChange('80mm')}
              className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all text-center ${
                paperWidth === '80mm'
                  ? 'bg-[#15803d] text-white border-[#15803d]'
                  : 'bg-white text-[#1b1f24] border-[#c5ccd4] hover:bg-slate-50'
              }`}
            >
              80mm (POS-80)
            </button>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {printMethod === 'web_bluetooth' && (
            <Button3D
              type="button"
              variant="in"
              size="md"
              onClick={handleWebBluetoothConnect}
              disabled={loading}
              className="flex-1 justify-center py-3 text-sm font-bold"
            >
              {loading ? 'Scanning...' : '🔍 Connect BLE Printer'}
            </Button3D>
          )}

          <Button3D
            type="button"
            variant="sec"
            size="md"
            onClick={handleTestPrint}
            disabled={loading}
            className="flex-1 justify-center py-3 text-sm font-bold text-[#15803d]"
          >
            📄 Test Print
          </Button3D>
        </div>
      </Card3D>
    </PageMotion>
  );
};
