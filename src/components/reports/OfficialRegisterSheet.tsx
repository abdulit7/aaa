import React from 'react';
import { GateEntry } from '../../types';

export interface OfficialRegisterSheetProps {
  entries: GateEntry[];
  mode?: 'outward' | 'inward' | 'daybook';
  companyName?: string;
  showCompanyHeader?: boolean;
  minRows?: number;
  fromDate?: string;
  toDate?: string;
  gateName?: string;
}

export const OfficialRegisterSheet: React.FC<OfficialRegisterSheetProps> = ({
  entries,
  mode = 'outward',
  companyName = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
  showCompanyHeader = false,
  minRows = 15,
  fromDate,
  toDate,
  gateName
}) => {
  // Determine register title based on mode
  const isOutward = mode === 'outward';
  const isInward = mode === 'inward';

  const titlePrefix = isOutward ? 'Material Out' : isInward ? 'Material In' : 'Gate Daybook';
  const titleSuffix = isOutward || isInward ? 'ward Register' : ' Register';

  const colNoLabel = isOutward ? 'Outward\nNo' : isInward ? 'Inward\nNo' : 'Entry\nNo';
  const colTimeLabel = isOutward ? 'Out time' : isInward ? 'In time' : 'Time';

  // Format date helper
  const formatDate = (dateStr: string) => {
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

  // Format time helper
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(11, 16);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return dateStr.slice(11, 16);
    }
  };

  // Calculate empty rows needed to fill minRows (matching user's ledger sheet layout)
  const emptyRowCount = Math.max(0, minRows - entries.length);

  return (
    <div
      id="official-register-sheet"
      className="official-register-sheet bg-white text-black p-4 sm:p-8 font-sans w-full max-w-[1100px] mx-auto"
      style={{ minWidth: '760px' }}
    >
      {/* Optional Company Header */}
      {showCompanyHeader && companyName && (
        <div className="text-center mb-1">
          <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider text-black">
            {companyName}
          </h2>
          {(fromDate || toDate) && (
            <p className="text-[11px] text-neutral-600 font-mono">
              {fromDate && `From: ${fromDate}`} {toDate && ` To: ${toDate}`} {gateName && ` · Gate: ${gateName}`}
            </p>
          )}
        </div>
      )}

      {/* Main Title - Matches exact layout: "Material Out" (bold, large) + "ward Register" */}
      <div className="text-center mb-4 pt-1">
        <h1 className="inline-block text-2xl sm:text-3xl tracking-tight text-black">
          <span className="font-extrabold text-black">{titlePrefix}</span>
          <span className="font-normal text-black text-xl sm:text-2xl ml-0.5">{titleSuffix}</span>
        </h1>
      </div>

      {/* The Official Register Table */}
      <div className="w-full overflow-x-auto">
        <table
          className="w-full border-collapse text-xs text-black border-2 border-black"
          style={{ border: '2px solid #000', borderCollapse: 'collapse', tableLayout: 'fixed' }}
        >
          <thead>
            <tr className="bg-white border-b-2 border-black text-center font-bold text-black" style={{ borderBottom: '2px solid #000' }}>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '8%' }}
              >
                <div className="leading-tight whitespace-pre-line">{colNoLabel}</div>
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '9%' }}
              >
                Date
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '11%' }}
              >
                Driver's<br />Name
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '11%' }}
              >
                Vehicle /<br />Purchaser
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '15%' }}
              >
                Name of company
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '10%' }}
              >
                Gate Pass<br />No.
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '18%' }}
              >
                Material Description
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '8%' }}
              >
                Quantity
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '8%' }}
              >
                <div className="leading-tight whitespace-pre-line">{colTimeLabel}</div>
              </th>
              <th
                className="p-2 border border-black align-middle text-center font-bold"
                style={{ border: '1px solid #000', width: '9%' }}
              >
                Security<br />signature
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Populated Entry Rows */}
            {entries.map((entry, idx) => {
              const materialDesc = entry.items && entry.items.length > 0
                ? entry.items.map(i => i.desc).join(', ')
                : entry.purpose || '---';

              const quantityStr = entry.items && entry.items.length > 0
                ? entry.items.map(i => `${i.qty} ${i.unit || ''}`.trim()).join(', ')
                : '---';

              const gatePassNo = entry.pass_no || entry.doc_no || entry.code;

              return (
                <tr
                  key={entry.id || entry.code || idx}
                  className="hover:bg-neutral-50 transition-colors"
                  style={{ minHeight: '32px' }}
                >
                  {/* Outward / Inward No */}
                  <td
                    className="p-1.5 border border-black text-center font-mono font-semibold text-[11px]"
                    style={{ border: '1px solid #000' }}
                  >
                    {entry.code || `#${idx + 1}`}
                  </td>

                  {/* Date */}
                  <td
                    className="p-1.5 border border-black text-center whitespace-nowrap text-[11px]"
                    style={{ border: '1px solid #000' }}
                  >
                    {formatDate(entry.at)}
                  </td>

                  {/* Driver's Name */}
                  <td
                    className="p-1.5 border border-black text-left text-[11px] truncate max-w-[110px]"
                    style={{ border: '1px solid #000' }}
                    title={entry.driver || '---'}
                  >
                    {entry.driver || '---'}
                  </td>

                  {/* Vehicle / Purchaser */}
                  <td
                    className="p-1.5 border border-black text-center font-mono text-[11px] whitespace-nowrap"
                    style={{ border: '1px solid #000' }}
                  >
                    {entry.purchaser_name || (entry.inward_type === 'purchaser_hand' && entry.person) ? (
                      <span className="font-sans font-bold">{entry.purchaser_name || entry.person}</span>
                    ) : (
                      entry.vehicle_no || 'Hand / N/A'
                    )}
                  </td>

                  {/* Name of company */}
                  <td
                    className="p-1.5 border border-black text-left font-medium text-[11px] truncate max-w-[150px]"
                    style={{ border: '1px solid #000' }}
                    title={entry.party}
                  >
                    {entry.party}
                  </td>

                  {/* Gate Pass No. */}
                  <td
                    className="p-1.5 border border-black text-center font-mono text-[11px]"
                    style={{ border: '1px solid #000' }}
                  >
                    {gatePassNo}
                  </td>

                  {/* Material Description */}
                  <td
                    className="p-1.5 border border-black text-left text-[11px]"
                    style={{ border: '1px solid #000', wordBreak: 'break-word' }}
                    title={materialDesc}
                  >
                    <div className="line-clamp-2">{materialDesc}</div>
                  </td>

                  {/* Quantity */}
                  <td
                    className="p-1.5 border border-black text-center font-mono text-[11px] whitespace-nowrap"
                    style={{ border: '1px solid #000' }}
                  >
                    {quantityStr}
                  </td>

                  {/* Out / In Time */}
                  <td
                    className="p-1.5 border border-black text-center font-mono text-[11px] whitespace-nowrap"
                    style={{ border: '1px solid #000' }}
                  >
                    {formatTime(entry.at)}
                  </td>

                  {/* Security signature */}
                  <td
                    className="p-1.5 border border-black text-center text-[10px] text-neutral-600 align-bottom"
                    style={{ border: '1px solid #000', minHeight: '34px' }}
                  >
                    <div className="h-6 flex items-end justify-center">
                      <span className="text-[10px] font-sans text-neutral-700 italic border-t border-neutral-300 w-full inline-block pt-0.5">
                        {entry.guard_name || ''}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Empty Rows to match standard physical register ledger format from user photo */}
            {Array.from({ length: emptyRowCount }).map((_, idx) => (
              <tr key={`empty-row-${idx}`} style={{ height: '32px' }}>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
                <td className="p-1.5 border border-black text-center" style={{ border: '1px solid #000' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Notes & Verification */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
        <span>Verified Gate Ledger Record</span>
        <span>Page 1 of 1</span>
        <span>Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};
