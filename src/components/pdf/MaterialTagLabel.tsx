import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { GateEntry } from '../../types';

export interface MaterialTagLabelProps {
  entry: GateEntry;
  companyName?: string;
}

export const MaterialTagLabel: React.FC<MaterialTagLabelProps> = ({
  entry,
  companyName = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // Generate high-contrast real scannable QR code
    const payload = JSON.stringify({
      code: entry.code,
      type: 'HAND_IN',
      party: entry.party,
      items: entry.items.map(i => `${i.desc}: ${i.qty} ${i.unit}`),
      amount: entry.amount,
      at: entry.at
    });

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 160,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => setQrDataUrl(url))
      .catch(err => {
        console.warn('QR generation error:', err);
        // Fallback to simple code string
        QRCode.toDataURL(entry.code, { margin: 1, width: 160 })
          .then(setQrDataUrl)
          .catch(console.error);
      });
  }, [entry]);

  const items = entry.items || [];
  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  return (
    <div
      id="material-tag-label"
      className="material-tag-label w-full max-w-[420px] mx-auto bg-white text-black p-3.5 border-2 border-black rounded-xs font-sans text-xs select-none shadow-sm"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        color: '#000000'
      }}
    >
      {/* Top Company Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-1.5 gap-2">
        <div className="flex items-center gap-2">
          <img src="/icon.svg" alt="Logo" className="w-7 h-7 object-contain rounded-xs border border-black p-0.5" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-tight leading-tight">
              {companyName}
            </div>
            <div className="text-[8px] font-bold text-neutral-600 uppercase">
              Security Gate · Verified Parcel Tag
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="inline-block px-1.5 py-0.5 border border-black font-black text-[9px] uppercase tracking-wider bg-black text-white">
            HAND-CARRIED TAG
          </span>
        </div>
      </div>

      {/* Main Tag Header: Huge Entry Code + Scannable QR Code */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2 gap-3">
        <div className="flex-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">
            Entry Code / ٹیگ نمبر
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black tracking-tight text-black leading-none my-1">
            {entry.code}
          </div>
          <div className="text-[9.5px] font-bold">
            <span className="text-neutral-500">Date/Time:</span> {entry.at.slice(0, 16)}
          </div>
        </div>

        {/* High-Resolution QR Code */}
        <div className="shrink-0 text-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR"
              className="w-18 h-18 border border-black p-0.5 rounded-xs mx-auto"
            />
          ) : (
            <div className="w-18 h-18 border border-black flex items-center justify-center text-[9px] font-mono">
              QR
            </div>
          )}
          <span className="text-[8px] font-mono font-bold block mt-0.5">SCAN TO VERIFY</span>
        </div>
      </div>

      {/* Primary Verification Details (Supplier, Bill #, Amount, Dept) */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] border-b border-black pb-2 mb-2">
        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            Supplier / Coming From (کہاں سے آیا):
          </span>
          <span className="font-extrabold text-black text-[11px] truncate block" title={entry.party}>
            {entry.party}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            Bill Amount (بل کی رقم - گارڈ تصدیق شدہ):
          </span>
          <span className="font-mono font-black text-black text-[11px] block">
            {entry.amount ? `Rs. ${entry.amount.toLocaleString()}` : 'Bill Checked (No Amount)'}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            Document (انوائس / بلٹی نمبر):
          </span>
          <span className="font-mono font-bold text-black block">
            {entry.doc_type} #{entry.doc_no || 'N/A'}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            Purpose (مقصد):
          </span>
          <span className="font-bold text-black block">
            {entry.purpose}
            {entry.personal_purpose ? ` (${entry.personal_purpose})` : ''}
          </span>
        </div>

        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            For Department (شعبہ):
          </span>
          <span className="font-bold text-black block">
            {entry.dept || 'General Store'}
          </span>
        </div>

        {entry.purchaser_name ? (
          <div>
            <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
              Purchaser (خریدار کا نام):
            </span>
            <span className="font-bold text-black block">
              {entry.purchaser_name}
            </span>
          </div>
        ) : entry.vehicle_no && entry.vehicle_no.toLowerCase() !== 'hand carried' ? (
          <div>
            <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
              Vehicle & Driver (گاڑی و ڈرائیور):
            </span>
            <span className="font-bold text-black block font-mono text-[9px]">
              {entry.vehicle_no} <span className="font-sans font-normal text-neutral-600">({entry.vehicle_type})</span>
              {entry.driver && ` · ${entry.driver}`}
            </span>
          </div>
        ) : null}

        <div>
          <span className="text-neutral-500 font-bold block text-[8.5px] uppercase">
            Received By / For (نام وصول کنندہ):
          </span>
          <span className="font-bold text-black block">
            {entry.person || 'Department Officer'}
          </span>
        </div>
      </div>

      {/* Material Items List & Counted Quantities Table */}
      <div className="border border-black mb-2">
        <div className="bg-neutral-100 border-b border-black px-2 py-0.5 flex items-center justify-between text-[9px] font-black uppercase">
          <span>Items Verified & Counted (اشیاء کی گنتی)</span>
          <span>Total: {totalQty} Units ({items.length} items)</span>
        </div>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-black text-left font-bold text-[8.5px] bg-neutral-50">
              <th className="py-1 px-1.5 w-6 text-center">#</th>
              <th className="py-1 px-1.5">Description</th>
              <th className="py-1 px-1.5 text-right w-24">Verified Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-neutral-300 last:border-b-0 leading-tight">
                <td className="py-1 px-1.5 text-center font-mono font-bold text-[9px] text-neutral-600">
                  {idx + 1}
                </td>
                <td className="py-1 px-1.5 font-semibold text-black">
                  {item.desc}
                </td>
                <td className="py-1 px-1.5 text-right font-mono font-bold text-black">
                  {item.qty} {item.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Remarks Note */}
      {entry.remarks && (
        <div className="text-[9px] border-b border-black pb-1 mb-1.5">
          <span className="font-bold text-neutral-500">Gate Note:</span>{' '}
          <span className="italic">{entry.remarks}</span>
        </div>
      )}

      {/* Guard Verification Footer */}
      <div className="flex items-center justify-between pt-1 text-[9px] font-mono">
        <div>
          <span className="font-bold">Duty Guard:</span>{' '}
          <span className="font-bold uppercase text-black">{entry.guard_name || 'Checked'}</span>
        </div>
        <div>
          <span>GateMaster 3D Verified</span>
        </div>
      </div>
    </div>
  );
};
