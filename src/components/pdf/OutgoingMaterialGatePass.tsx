import React from 'react';
import { GateEntry } from '../../types';

export interface OutgoingMaterialGatePassProps {
  entry: GateEntry;
  companyName?: string;
  companyAddress?: string;
  logoUrl?: string;
  mode?: 'triplicate' | 'single';
}

interface SingleSlipProps {
  entry: GateEntry;
  companyName: string;
  copyTitleUrdu: string;
  copyTitleEng: string;
  logoUrl?: string;
  isCompact?: boolean;
}

const SingleSlip: React.FC<SingleSlipProps> = ({
  entry,
  companyName,
  copyTitleUrdu,
  copyTitleEng,
  logoUrl,
  isCompact = true
}) => {
  const formatOutDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 10);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  const isReturnable = !!entry.returnable;
  const expectedReturnDate = isReturnable ? formatOutDate(entry.expected_return || '') : '---';
  const outDate = formatOutDate(entry.at);

  const items = entry.items || [];
  const minRows = isCompact ? 2 : 5;
  const emptyRowsCount = Math.max(0, minRows - items.length);

  // Urdu typography class for clean, perfectly aligned Arabic/Urdu Naskh
  const urduClass = "font-medium leading-none";
  const urduStyle: React.CSSProperties = {
    fontFamily: "'Noto Sans Arabic', 'Segoe UI', Tahoma, -apple-system, sans-serif"
  };

  return (
    <div
      className="gate-slip-single bg-white text-black p-2 sm:p-2.5 border-2 border-black rounded-xs font-sans text-xs w-full"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        borderColor: '#000000',
        color: '#000000',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}
    >
      {/* 1. Header: Application Logo, Main Gate Pass Title & Serial No */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1 mb-1 gap-2">
        {/* Left: Application Logo & Company */}
        <div className="flex items-center gap-2 shrink-0">
          <img
            src={logoUrl || "/icon.svg"}
            alt="GateMaster"
            className="w-8 h-8 object-contain shrink-0 rounded-xs"
          />
          <div>
            <div className="text-[10px] font-black text-black tracking-tight leading-tight uppercase">
              {companyName}
            </div>
            <div className="text-[8px] font-semibold text-neutral-600 leading-none">
              Gate & Logistics Management
            </div>
          </div>
        </div>

        {/* Center: Title (ONLY "GATE PASS / گیٹ پاس", NO "ورکشاپ آرڈر") */}
        <div className="text-center flex-1 px-1">
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-base sm:text-lg font-black text-black tracking-tight"
              style={urduStyle}
              dir="rtl"
            >
              گیٹ پاس (آؤٹ ورڈ)
            </span>
            <span className="text-xs sm:text-sm font-black text-black uppercase tracking-wider">
              · OUTWARD GATE PASS
            </span>
          </div>

          {/* Copy Designation Tag (Black & White border) */}
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <span className="inline-block px-2 py-0.2 rounded-xs text-[8.5px] font-bold border border-black text-black uppercase tracking-wider bg-neutral-100">
              <span style={urduStyle} dir="rtl">{copyTitleUrdu}</span> · {copyTitleEng}
            </span>
          </div>
        </div>

        {/* Right: Serial No & Gate Entry Code */}
        <div className="text-right shrink-0 flex flex-col items-end">
          <div className="border border-black bg-white px-2 py-0.5 rounded-xs text-center">
            <span className="text-[7.5px] font-bold text-black mr-1" style={urduStyle}>نمبر شمار:</span>
            <span className="text-xs font-mono font-black text-black">
              {entry.pass_no || entry.doc_no || entry.code.slice(-5) || '5824'}
            </span>
          </div>
          <div className="text-[8px] font-mono text-neutral-700 font-bold mt-0.5">
            {entry.code}
          </div>
        </div>
      </div>

      {/* 2. PROMINENT RETURNABLE / NON-RETURNABLE NOTICE BANNER (HEIGHTENED & BOLD) */}
      <div className="mb-1">
        {isReturnable ? (
          <div className="border-2 border-black bg-black text-white px-2 py-1 text-center flex items-center justify-between font-black text-[11px] tracking-wide rounded-xs">
            <span className="uppercase tracking-wider">★ RETURNABLE GATE PASS</span>
            <span style={urduStyle} dir="rtl" className="text-[12px]">
              قابل واپسی سامان — متوقع واپسی تاریخ: {expectedReturnDate}
            </span>
            <span className="font-mono text-[10px] bg-white text-black px-1.5 py-0.2 rounded-xs">
              DUE: {expectedReturnDate}
            </span>
          </div>
        ) : (
          <div className="border border-black bg-neutral-100 text-black px-2 py-0.5 text-center flex items-center justify-between font-extrabold text-[10px] tracking-wide rounded-xs">
            <span className="uppercase">NON-RETURNABLE GATE PASS</span>
            <span style={urduStyle} dir="rtl" className="text-[11px] text-neutral-800">
              غیر قابل واپسی سامان (مستقل اخراج)
            </span>
            <span className="text-[9px] uppercase font-mono">PERMANENT OUT</span>
          </div>
        )}
      </div>

      {/* 3. Meta Bar: Date, Dept, Party / Workshop Name, Vehicle & Gate */}
      <div className="grid grid-cols-12 gap-1 mb-1 text-[9.5px] items-center bg-white p-1 rounded-xs border border-black">
        {/* Date (تاریخ) */}
        <div className="col-span-3 flex items-center gap-1 truncate">
          <span className={urduClass} style={urduStyle} dir="rtl">تاریخ:</span>
          <span className="font-mono font-bold">{outDate}</span>
        </div>

        {/* Department (ڈیپارٹمنٹ) */}
        <div className="col-span-3 flex items-center gap-1 truncate">
          <span className={urduClass} style={urduStyle} dir="rtl">ڈیپارٹمنٹ:</span>
          <span className="font-bold truncate">{entry.dept || 'Plant / Store'}</span>
        </div>

        {/* Party / Workshop (نام پارٹی / ورکشاپ) */}
        <div className="col-span-3 flex items-center gap-1 truncate">
          <span className={urduClass} style={urduStyle} dir="rtl">پارٹی:</span>
          <span className="font-bold truncate" title={entry.party}>{entry.party || 'Consignee / Party'}</span>
        </div>

        {/* Gate & Vehicle */}
        <div className="col-span-3 text-right font-mono font-bold truncate">
          {entry.gate || 'Main Gate'} · {entry.vehicle_no || 'Hand'}
        </div>
      </div>

      {/* 4. Table (Monochrome, Black borders): تعداد | تفصیل سامان بمعہ مشین نمبر | تاریخ واپسی | ریمارکس */}
      <div className="overflow-hidden border border-black bg-white mb-1">
        <table className="w-full border-collapse text-[9.5px] text-black table-fixed">
          <thead>
            <tr className="bg-neutral-100 border-b border-black text-center font-bold">
              {/* Qty */}
              <th className="py-1 px-1 border-r border-black w-[14%] text-center">
                <div style={urduStyle} dir="rtl" className="text-[10px] leading-tight">تعداد</div>
                <div className="text-[7.5px] uppercase font-mono">Qty</div>
              </th>

              {/* Description */}
              <th className="py-1 px-1.5 border-r border-black w-[50%] text-center">
                <div style={urduStyle} dir="rtl" className="text-[10px] leading-tight">تفصیل سامان بمعہ مشین نمبر</div>
                <div className="text-[7.5px] uppercase font-mono">Description & Machine No.</div>
              </th>

              {/* Return Date */}
              <th className="py-1 px-1 border-r border-black w-[18%] text-center">
                <div style={urduStyle} dir="rtl" className="text-[10px] leading-tight">تاریخ واپسی</div>
                <div className="text-[7.5px] uppercase font-mono">Return Due</div>
              </th>

              {/* Remarks */}
              <th className="py-1 px-1 w-[18%] text-center">
                <div style={urduStyle} dir="rtl" className="text-[10px] leading-tight">ریمارکس</div>
                <div className="text-[7.5px] uppercase font-mono">Remarks</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-black leading-tight">
                <td className="p-0.5 border-r border-black text-center font-mono font-bold text-[9px]">
                  {item.qty} {item.unit}
                </td>
                <td className="p-0.5 border-r border-black text-left font-semibold text-[9px] truncate">
                  #{idx + 1} {item.desc} {entry.purpose && idx === 0 ? `[${entry.purpose}]` : ''}
                </td>
                <td className="p-0.5 border-r border-black text-center font-mono font-bold text-[8.5px] whitespace-nowrap">
                  {isReturnable ? expectedReturnDate : 'N/A'}
                </td>
                <td className="p-0.5 text-left text-[8.5px] truncate" title={entry.remarks || ''}>
                  {idx === 0 ? (entry.remarks || (isReturnable ? 'Returnable' : 'Dispatched')) : ''}
                </td>
              </tr>
            ))}

            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="border-b border-black h-4.5">
                <td className="p-0.5 border-r border-black text-center">&nbsp;</td>
                <td className="p-0.5 border-r border-black text-left">&nbsp;</td>
                <td className="p-0.5 border-r border-black text-center font-mono text-[8.5px]">
                  {isReturnable ? expectedReturnDate : '---'}
                </td>
                <td className="p-0.5 text-left">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5. Four Bottom Signatures: درخواست کنندہ | انچارج | روانگی کلرک | وصول کلرک */}
      <div className="grid grid-cols-4 gap-1 pt-0.5 border-t border-black text-center">
        {/* 1. درخواست کنندہ */}
        <div className="flex flex-col items-center">
          <div className="h-5 w-full border-b border-dashed border-black flex items-end justify-center pb-0.5">
            <span className="text-[7px] font-mono text-neutral-500">(Sign)</span>
          </div>
          <div className="text-[9px] font-bold text-black mt-0.5 leading-none" style={urduStyle} dir="rtl">
            درخواست کنندہ
          </div>
          <div className="text-[6.5px] font-bold uppercase font-mono">Requested By</div>
        </div>

        {/* 2. انچارج */}
        <div className="flex flex-col items-center">
          <div className="h-5 w-full border-b border-dashed border-black flex items-end justify-center pb-0.5">
            <span className="text-[7px] font-mono text-neutral-500">(Stamp)</span>
          </div>
          <div className="text-[9px] font-bold text-black mt-0.5 leading-none" style={urduStyle} dir="rtl">
            انچارج
          </div>
          <div className="text-[6.5px] font-bold uppercase font-mono">Incharge / HOD</div>
        </div>

        {/* 3. روانگی کلرک */}
        <div className="flex flex-col items-center">
          <div className="h-5 w-full border-b border-dashed border-black flex items-end justify-center pb-0.5">
            <span className="text-[7.5px] font-mono text-black font-bold truncate max-w-full px-1">
              {entry.guard_name || 'Gate Officer'}
            </span>
          </div>
          <div className="text-[9px] font-bold text-black mt-0.5 leading-none" style={urduStyle} dir="rtl">
            روانگی کلرک
          </div>
          <div className="text-[6.5px] font-bold uppercase font-mono">Gate Clerk</div>
        </div>

        {/* 4. وصول کلرک */}
        <div className="flex flex-col items-center">
          <div className="h-5 w-full border-b border-dashed border-black flex items-end justify-center pb-0.5">
            <span className="text-[7px] font-mono text-neutral-500">(Sign & Date)</span>
          </div>
          <div className="text-[9px] font-bold text-black mt-0.5 leading-none" style={urduStyle} dir="rtl">
            وصول کلرک
          </div>
          <div className="text-[6.5px] font-bold uppercase font-mono">Receiver</div>
        </div>
      </div>
    </div>
  );
};

export const OutgoingMaterialGatePass: React.FC<OutgoingMaterialGatePassProps> = ({
  entry,
  companyName = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
  logoUrl,
  mode = 'triplicate'
}) => {
  if (mode === 'single') {
    return (
      <div id="outgoing-material-gate-pass" className="w-full max-w-[800px] mx-auto bg-white">
        <SingleSlip
          entry={entry}
          companyName={companyName}
          copyTitleUrdu="اصل گیٹ پاس"
          copyTitleEng="ORIGINAL PASS"
          logoUrl={logoUrl}
          isCompact={false}
        />
      </div>
    );
  }

  // 3 COPIES ON ONE PAGE (TRIPLICATE FOR TEAR-OFF, BLACK & WHITE MONOCHROME)
  const COPIES = [
    {
      id: 'gate',
      urdu: 'گیٹ کاپی (سیکورٹی ریکارڈ)',
      eng: 'GATE 1 / SECURITY COPY',
      purposeNote: 'Leave at Security Gate on Exit'
    },
    {
      id: 'dept',
      urdu: 'ڈیپارٹمنٹ کاپی (آفس ریکارڈ)',
      eng: 'DEPARTMENT / OFFICE COPY',
      purposeNote: 'Retain in Issuing Department File'
    },
    {
      id: 'carrier',
      urdu: 'ڈرائیور و پارٹی کاپی',
      eng: 'CARRIER & PARTY COPY',
      purposeNote: 'Hand to Carrier / Return with Goods'
    }
  ];

  return (
    <div
      id="outgoing-material-gate-pass"
      className="outgoing-material-gate-pass w-full max-w-[800px] mx-auto space-y-1.5 select-none bg-white p-1"
      style={{
        boxSizing: 'border-box',
        backgroundColor: '#ffffff'
      }}
    >
      {COPIES.map((copy, index) => (
        <React.Fragment key={copy.id}>
          {/* Slip */}
          <SingleSlip
            entry={entry}
            companyName={companyName}
            copyTitleUrdu={copy.urdu}
            copyTitleEng={copy.eng}
            logoUrl={logoUrl}
            isCompact={true}
          />

          {/* Dotted Perforated Cut/Tear Line between copies */}
          {index < COPIES.length - 1 && (
            <div className="perforation-line flex items-center justify-between text-black font-mono text-[9px] py-0.5 select-none">
              <span className="flex-1 border-b border-dashed border-black" />
              <span className="px-2 font-black text-black flex items-center gap-1.5 shrink-0">
                <span>✂</span>
                <span>TEAR HERE (یہاں سے الگ کریں)</span>
                <span className="text-[8px] font-normal text-neutral-600">· {copy.purposeNote}</span>
              </span>
              <span className="flex-1 border-b border-dashed border-black" />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
