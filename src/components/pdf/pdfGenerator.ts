import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { GateEntry } from '../../types';

// Minimal offline QR Code SVG to DataURL converter for embedding in jsPDF
function createQrSvgDataUrl(text: string): string {
  // Simple clean SVG placeholder for QR code in PDF
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#ffffff" />
    <rect x="5" y="5" width="30" height="30" fill="#000000" />
    <rect x="10" y="10" width="20" height="20" fill="#ffffff" />
    <rect x="15" y="15" width="10" height="10" fill="#000000" />
    <rect x="65" y="5" width="30" height="30" fill="#000000" />
    <rect x="70" y="10" width="20" height="20" fill="#ffffff" />
    <rect x="75" y="15" width="10" height="10" fill="#000000" />
    <rect x="5" y="65" width="30" height="30" fill="#000000" />
    <rect x="10" y="70" width="20" height="20" fill="#ffffff" />
    <rect x="15" y="75" width="10" height="10" fill="#000000" />
    <rect x="45" y="10" width="10" height="10" fill="#000000" />
    <rect x="45" y="30" width="10" height="10" fill="#000000" />
    <rect x="25" y="45" width="10" height="10" fill="#000000" />
    <rect x="45" y="45" width="10" height="10" fill="#000000" />
    <rect x="65" y="45" width="10" height="10" fill="#000000" />
    <rect x="45" y="65" width="10" height="10" fill="#000000" />
    <rect x="45" y="80" width="10" height="10" fill="#000000" />
    <rect x="70" y="70" width="15" height="15" fill="#000000" />
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function downloadGateSlipPDF(entry: GateEntry, companyName: string, companyShort: string) {
  const isIn = entry.dir === 'IN';

  if (!isIn) {
    // ----------------------------------------------------
    // TRIPLICATE WORKSHOP ORDER (3 COPIES ON 1 A4 PAGE - TEAR-OFF)
    // ----------------------------------------------------
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const isReturnable = !!entry.returnable;
    const outDate = entry.at ? entry.at.slice(0, 10) : '';
    const expectedReturnDate = isReturnable ? (entry.expected_return || '---') : 'N/A';
    const serialNo = entry.pass_no || entry.doc_no || entry.code.slice(-5) || '5824';

    const copies = [
      { urdu: 'گیٹ کاپی (سیکورٹی ریکارڈ)', eng: 'GATE 1 / SECURITY COPY', note: 'Security Gate Record' },
      { urdu: 'ڈیپارٹمنٹ کاپی (آفس ریکارڈ)', eng: 'DEPARTMENT / OFFICE COPY', note: 'Department File Record' },
      { urdu: 'ورکشاپ و ڈرائیور کاپی', eng: 'WORKSHOP & CARRIER COPY', note: 'Carrier / Return with Goods' }
    ];

    copies.forEach((copy, copyIndex) => {
      const topY = 6 + copyIndex * 94;

      // Outer Slip Rect
      doc.setDrawColor(30, 58, 138); // Navy blue
      doc.setLineWidth(0.4);
      doc.setFillColor(242, 248, 254); // Soft blue ledger tint
      doc.rect(7, topY, 196, 88, 'FD');

      // Header row
      // Left: Logo & Company
      doc.setTextColor(30, 58, 138);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('JOJO TREATS · ' + (companyName || 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'), 10, topY + 4.5);

      // Center: Title & Copy Designation
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text('WORKSHOP ORDER / OUTWARD GATE PASS (ورکشاپ آرڈر)', 105, topY + 5, { align: 'center' });

      // Copy Badge
      doc.setFillColor(224, 237, 251);
      doc.rect(70, topY + 6.5, 70, 4, 'F');
      doc.setFontSize(7);
      doc.setTextColor(30, 58, 138);
      doc.text(`${copy.urdu} · ${copy.eng}`, 105, topY + 9.5, { align: 'center' });

      // Right: Serial No
      doc.setDrawColor(30, 58, 138);
      doc.setFillColor(255, 255, 255);
      doc.rect(170, topY + 2.5, 30, 7.5, 'FD');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('No. نمبر شمار', 178, topY + 5.5);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(220, 38, 38);
      doc.text(serialNo, 194, topY + 7.5, { align: 'right' });

      // Meta Bar: Date, Dept, Workshop, Returnable Status
      autoTable(doc, {
        startY: topY + 11.5,
        margin: { left: 9, right: 9 },
        theme: 'plain',
        styles: { fontSize: 7, cellPadding: 1, lineColor: [30, 58, 138], lineWidth: 0.2, textColor: [15, 23, 42] },
        columnStyles: {
          0: { cellWidth: 38, fontStyle: 'bold' },
          1: { cellWidth: 44, fontStyle: 'bold' },
          2: { cellWidth: 50, fontStyle: 'bold' },
          3: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
        },
        body: [
          [
            `Date (تاریخ): ${outDate}`,
            `Dept (ڈیپارٹمنٹ): ${entry.dept || 'Engineering'}`,
            `Workshop (ورکشاپ): ${entry.party || 'Workshop'}`,
            isReturnable
              ? `★ قابل واپسی (RETURNABLE: ${expectedReturnDate}) ★`
              : 'غیر قابل واپسی (NON-RETURNABLE)'
          ]
        ]
      });

      // Secondary row: Vehicle & Gate
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY,
        margin: { left: 9, right: 9 },
        theme: 'plain',
        styles: { fontSize: 6.5, cellPadding: 0.8, lineColor: [203, 213, 225], lineWidth: 0.15, textColor: [71, 85, 105] },
        body: [
          [
            `Gate: ${entry.gate || 'Main Gate'}  ·  Vehicle: ${entry.vehicle_no || 'Hand Carried'} (${entry.vehicle_type || 'Vehicle'})  ·  Carrier: ${entry.driver || entry.person || '-'}  ·  Pass Code: ${entry.code}`
          ]
        ]
      });

      // Compact 4-Column Table: تعداد | تفصیل سامان بمعہ مشین نمبر | تاریخ واپسی | ریمارکس
      const itemsList = (entry.items || []).slice(0, 3).map((item, i) => [
        `${item.qty} ${item.unit}`,
        `#${i + 1} ${item.desc} ${entry.purpose && i === 0 ? `[${entry.purpose}]` : ''}`,
        isReturnable ? expectedReturnDate : 'N/A',
        i === 0 ? (entry.remarks || (isReturnable ? 'For Repair' : 'Dispatch')) : ''
      ]);

      while (itemsList.length < 2) {
        itemsList.push(['', '', isReturnable ? expectedReturnDate : '---', '']);
      }

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 0.5,
        margin: { left: 9, right: 9 },
        theme: 'grid',
        headStyles: {
          fillColor: [226, 238, 251],
          textColor: [30, 58, 138],
          fontStyle: 'bold',
          fontSize: 6.5,
          halign: 'center',
          lineColor: [30, 58, 138],
          lineWidth: 0.2
        },
        styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [30, 58, 138], lineWidth: 0.2, textColor: [15, 23, 42] },
        head: [
          [
            'Quantity (تعداد)',
            'Description of Material & Machine No. (تفصیل سامان بمعہ مشین نمبر)',
            'Return Due (تاریخ واپسی)',
            'Remarks (ریمارکس)'
          ]
        ],
        body: itemsList,
        columnStyles: {
          0: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 92 },
          2: { cellWidth: 36, halign: 'center' },
          3: { cellWidth: 38 }
        }
      });

      // 4 Bottom Signatures
      const sigStartY = (doc as any).lastAutoTable.finalY + 1;
      autoTable(doc, {
        startY: sigStartY,
        margin: { left: 9, right: 9 },
        theme: 'grid',
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [30, 58, 138],
          fontStyle: 'bold',
          fontSize: 6,
          halign: 'center',
          lineColor: [30, 58, 138],
          lineWidth: 0.15
        },
        styles: { fontSize: 6, cellPadding: 0.6, lineColor: [30, 58, 138], lineWidth: 0.15, textColor: [15, 23, 42] },
        head: [
          [
            'Requested By (درخواست کنندہ)',
            'Incharge / HOD (انچارج)',
            'Dispatch Clerk (روانگی کلرک)',
            'Receiving Clerk (وصول کلرک)'
          ]
        ],
        body: [
          [
            { content: '(Sign)', styles: { halign: 'center', minCellHeight: 8 } },
            { content: '(Stamp)', styles: { halign: 'center', minCellHeight: 8 } },
            { content: `${entry.guard_name || 'Gate Officer'}`, styles: { halign: 'center', minCellHeight: 8 } },
            { content: '(Sign & Date)', styles: { halign: 'center', minCellHeight: 8 } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 48 },
          2: { cellWidth: 48 },
          3: { cellWidth: 48 }
        }
      });

      // Dotted Perforated Cut/Tear Line between copies
      if (copyIndex < 2) {
        const tearY = topY + 91;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.2);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(7, tearY, 203, tearY);
        doc.setLineDashPattern([], 0);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - TEAR HERE (یہاں سے الگ کریں) - - - - - - - - - - - - - - - - - - - - - - - - - - ✂', 105, tearY + 1.8, { align: 'center' });
      }
    });

    doc.save(`${entry.code}_GatePass_3Copies.pdf`);
    return;
  }

  // ----------------------------------------------------
  // INWARD (MATERIAL IN) PASS FORMAT
  // ----------------------------------------------------
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });
  const primaryColor: [number, number, number] = [20, 83, 45];

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 148, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(companyName, 74, 8, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`GATE ${isIn ? 'INWARD (MATERIAL IN)' : 'OUTWARD (MATERIAL OUT)'} PASS`, 74, 15, { align: 'center' });

  // Code & Date Box
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.text(entry.code, 10, 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Gate: ${entry.gate}`, 10, 36);
  doc.text(`Security Officer: ${entry.guard_name}`, 10, 41);
  doc.text(`Timestamp: ${entry.at}`, 10, 46);

  // Status Badge
  doc.setFillColor(isIn ? 234 : 233, isIn ? 246 : 239, isIn ? 238 : 253);
  doc.rect(105, 24, 33, 10, 'F');
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(isIn ? 'MATERIAL IN ⬇' : 'MATERIAL OUT ⬆', 121.5, 30.5, { align: 'center' });

  // Summary Metadata Table
  const metaBody = [
    [isIn ? 'Source / Party' : 'Destination / Consignee', entry.party],
    ['Purpose of Movement', entry.purpose],
    ['Vehicle Details', `${entry.vehicle_no || 'Hand Carried'} (${entry.vehicle_type})`],
    ['Driver Name & CNIC/Mobile', `${entry.driver || '-'} / ${entry.driver_id || '-'}`],
    ['Document Type & Number', `${entry.doc_type} : ${entry.doc_no || '-'}`],
    ['Declared Document Value', entry.amount ? `Rs ${entry.amount.toLocaleString()}` : '-'],
    ['Purchase Order / Work Order', entry.po_no || '-'],
    [isIn ? 'Department / Received By' : 'Authorized By', isIn ? `${entry.dept} - ${entry.person}` : entry.authorised_by || '-'],
    ['Gross Weight / Packages', `${entry.weight ? entry.weight + ' KG' : '-'} / ${entry.packages ? entry.packages + ' Units' : '-'}`]
  ];

  if (entry.returnable) {
    metaBody.push(['Returnable Status', `YES - Expected Return Date: ${entry.expected_return || 'TBD'}`]);
  }

  autoTable(doc, {
    startY: 50,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 46, fillColor: [248, 250, 252] },
      1: { cellWidth: 82 }
    },
    body: metaBody
  });

  // Items Table
  const itemsStartY = (doc as any).lastAutoTable.finalY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Material / Consignment Item List:', 10, itemsStartY);

  const itemsTableData = entry.items.map((item, index) => [
    index + 1,
    item.desc,
    item.qty.toLocaleString(),
    item.unit
  ]);

  autoTable(doc, {
    startY: itemsStartY + 2,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    head: [['#', 'Description of Goods', 'Qty', 'Unit']],
    body: itemsTableData,
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 78 },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20 }
    }
  });

  // Signatures section at bottom
  const sigY = 188;
  doc.setDrawColor(150, 150, 150);
  doc.line(10, sigY, 45, sigY);
  doc.line(55, sigY, 93, sigY);
  doc.line(103, sigY, 138, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text('Security Guard Sign', 27.5, sigY + 4, { align: 'center' });
  doc.text('Driver / Carrier Sign', 74, sigY + 4, { align: 'center' });
  doc.text(isIn ? 'Store Receiver Sign' : 'Authorizing Officer', 120.5, sigY + 4, { align: 'center' });

  // Verification footer
  doc.setFontSize(6.5);
  doc.text(`GateMaster 3D Verified Pass · ${companyShort} Logistics Hub · Print Count: ${entry.prints + 1}`, 74, 204, { align: 'center' });

  doc.save(`${entry.code}_GateSlip.pdf`);
}

export function downloadThermalLabelPDF(entry: GateEntry, companyShort: string) {
  // 75mm x 50mm Thermal Label format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [50, 75]
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 75, 9, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${companyShort} · GATE ${entry.dir}`, 37.5, 6, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(entry.code, 4, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Date: ${entry.at.slice(0, 16)}`, 4, 21);
  doc.text(`Party: ${entry.party.slice(0, 32)}`, 4, 26);
  doc.text(`Veh: ${entry.vehicle_no || 'Hand Carried'} (${entry.vehicle_type})`, 4, 31);
  doc.text(`Doc: ${entry.doc_type} ${entry.doc_no || ''}`, 4, 36);

  if (entry.items[0]) {
    doc.text(`Item: ${entry.items[0].desc.slice(0, 24)} - ${entry.items[0].qty} ${entry.items[0].unit}`, 4, 41);
  }

  // Barcode simulation
  doc.setFillColor(0, 0, 0);
  for (let i = 4; i < 71; i += 2.5) {
    const barWidth = (i % 5 === 0) ? 1.5 : 0.8;
    doc.rect(i, 44, barWidth, 4, 'F');
  }

  doc.save(`${entry.code}_ThermalLabel_75x50.pdf`);
}

export async function downloadMaterialTagPDF(entry: GateEntry, companyName: string = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD') {
  // 80mm x 120mm parcel sticker/tag
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 120]
  });

  // Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.6);
  doc.rect(2, 2, 76, 116);

  // Top Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(companyName.slice(0, 34), 40, 7, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.text('SECURITY GATE · VERIFIED PARCEL TAG', 40, 10.5, { align: 'center' });
  doc.line(2, 12, 78, 12);

  // Entry Code & QR Code
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text(entry.code, 4, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Date: ${entry.at.slice(0, 16)}`, 4, 22.5);
  doc.text(`Guard: ${(entry.guard_name || 'Checked').slice(0, 22)}`, 4, 26);

  // Real Scannable QR Code
  try {
    const qrPayload = JSON.stringify({
      code: entry.code,
      party: entry.party,
      items: entry.items.map(i => `${i.desc}: ${i.qty} ${i.unit}`),
      amount: entry.amount,
      at: entry.at
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 120 });
    doc.addImage(qrDataUrl, 'PNG', 56, 13, 20, 20);
  } catch (err) {
    console.warn('QR error in PDF:', err);
  }

  doc.line(2, 34, 78, 34);

  // Verification details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Supplier:', 4, 38);
  doc.setFont('helvetica', 'normal');
  doc.text((entry.party || '-').slice(0, 32), 20, 38);

  doc.setFont('helvetica', 'bold');
  doc.text('Doc Type & No:', 4, 42);
  doc.setFont('helvetica', 'normal');
  doc.text(`${entry.doc_type} ${entry.doc_no || ''}`.slice(0, 30), 24, 42);

  doc.setFont('helvetica', 'bold');
  doc.text('Bill Amount:', 4, 46);
  doc.setFont('courier', 'bold');
  doc.text(entry.amount ? `Rs. ${entry.amount.toLocaleString()}` : 'Checked (No Amount)', 20, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('For Dept / Sec:', 4, 50);
  doc.setFont('helvetica', 'normal');
  doc.text((entry.dept || 'General Store').slice(0, 32), 24, 50);

  doc.setFont('helvetica', 'bold');
  doc.text('Received By/For:', 4, 54);
  doc.setFont('helvetica', 'normal');
  doc.text((entry.person || '-').slice(0, 32), 26, 54);

  doc.setFont('helvetica', 'bold');
  doc.text('Purpose:', 4, 58);
  doc.setFont('helvetica', 'normal');
  doc.text(`${entry.purpose}${entry.personal_purpose ? ` (${entry.personal_purpose})` : ''}`.slice(0, 32), 18, 58);

  doc.line(2, 61, 78, 61);

  // Items table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('VERIFIED ITEMS LIST (اشیاء کی گنتی)', 4, 65);

  const itemsData = entry.items.map((it, idx) => [
    idx + 1,
    it.desc,
    `${it.qty} ${it.unit}`
  ]);

  autoTable(doc, {
    startY: 67,
    margin: { left: 3, right: 3 },
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1.2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
    head: [['#', 'Item Description', 'Count']],
    body: itemsData,
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 46 },
      2: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 96;
  if (entry.remarks && finalY < 106) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.text(`Gate Note: ${entry.remarks}`.slice(0, 50), 4, finalY + 4);
  }

  // Footer verified line
  doc.line(2, 110, 78, 110);
  doc.setFont('courier', 'bold');
  doc.setFontSize(6.5);
  doc.text(`Guard: ${(entry.guard_name || 'Duty Guard').slice(0, 24)}  [VERIFIED & STAMPED]`, 4, 114);

  doc.save(`${entry.code}_MaterialTag.pdf`);
}

export function downloadDaybookPDF(entries: GateEntry[], fromDate: string, toDate: string, companyName: string) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName, 148.5, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Official Gate Register & Daybook Report (${fromDate} to ${toDate})`, 148.5, 18, { align: 'center' });

  const tableData = entries.map(e => [
    e.code,
    e.dir,
    e.at.slice(5, 16),
    e.party,
    e.vehicle_no || 'Hand',
    `${e.doc_type} ${e.doc_no || ''}`,
    e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join('; '),
    e.amount ? `Rs ${e.amount.toLocaleString()}` : '-',
    e.stage.replace('_', ' ').toUpperCase()
  ]);

  autoTable(doc, {
    startY: 30,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2 },
    head: [['Code', 'Dir', 'Date/Time', 'Party / Supplier', 'Vehicle', 'Document', 'Materials / Goods', 'Amount', 'Status']],
    body: tableData,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 22 },
      3: { cellWidth: 46 },
      4: { cellWidth: 22 },
      5: { cellWidth: 32 },
      6: { cellWidth: 70 },
      7: { cellWidth: 25, halign: 'right' },
      8: { cellWidth: 22 }
    }
  });

  const totalIn = entries.filter(e => e.dir === 'IN').length;
  const totalOut = entries.filter(e => e.dir === 'OUT').length;
  const totalVal = entries.reduce((acc, e) => acc + (e.amount || 0), 0);

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Records: ${entries.length}   |   Inward Shipments: ${totalIn}   |   Outward Shipments: ${totalOut}   |   Total Declared Value: Rs ${totalVal.toLocaleString()}`, 14, finalY);

  doc.save(`Gate_Register_Daybook_${fromDate}_${toDate}.pdf`);
}

export function downloadOfficialRegisterPDF(
  entries: GateEntry[],
  mode: 'outward' | 'inward' | 'daybook' = 'outward',
  companyName: string = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
  showCompanyHeader: boolean = false,
  minRows: number = 15
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const isOutward = mode === 'outward';
  const isInward = mode === 'inward';

  const titlePrefix = isOutward ? 'Material Out' : isInward ? 'Material In' : 'Gate Daybook';
  const titleSuffix = isOutward || isInward ? 'ward Register' : ' Register';

  const colNoLabel = isOutward ? 'Outward\nNo' : isInward ? 'Inward\nNo' : 'Entry\nNo';
  const colTimeLabel = isOutward ? 'Out time' : isInward ? 'In time' : 'Time';

  let startY = 14;

  if (showCompanyHeader && companyName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(companyName.toUpperCase(), 148.5, startY, { align: 'center' });
    startY += 6;
  }

  // Large Bold Title: "Material Out" + "ward Register"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  const prefixWidth = doc.getTextWidth(titlePrefix);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  const suffixWidth = doc.getTextWidth(titleSuffix);

  const totalWidth = prefixWidth + suffixWidth;
  const startX = 148.5 - totalWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(titlePrefix, startX, startY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(titleSuffix, startX + prefixWidth + 1, startY);

  startY += 5;

  // Format table rows
  const tableData: string[][] = entries.map((e, idx) => {
    let dateStr = '';
    try {
      const d = new Date(e.at);
      dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      dateStr = e.at.slice(0, 10);
    }

    let timeStr = '';
    try {
      const d = new Date(e.at);
      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      timeStr = e.at.slice(11, 16);
    }

    const materialDesc = e.items && e.items.length > 0
      ? e.items.map(i => i.desc).join(', ')
      : e.purpose || '-';

    const quantityStr = e.items && e.items.length > 0
      ? e.items.map(i => `${i.qty} ${i.unit || ''}`.trim()).join(', ')
      : '-';

    const gatePassNo = e.pass_no || e.doc_no || e.code;
    const vehicleOrPurchaser = e.purchaser_name || (e.inward_type === 'purchaser_hand' && e.person) || e.vehicle_no || 'Hand / N/A';

    return [
      e.code || `#${idx + 1}`,
      dateStr,
      e.driver || '---',
      vehicleOrPurchaser,
      e.party || '---',
      gatePassNo,
      materialDesc,
      quantityStr,
      timeStr,
      e.guard_name ? `Sig: ${e.guard_name}` : ''
    ];
  });

  // Pad empty rows to match authentic register ledger appearance
  const emptyRowsNeeded = Math.max(0, minRows - tableData.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    tableData.push(['', '', '', '', '', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: startY,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.25,
      lineColor: [0, 0, 0]
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontSize: 7.5,
      lineWidth: 0.2,
      lineColor: [0, 0, 0],
      minCellHeight: 6.8
    },
    styles: {
      cellPadding: 1.5,
      overflow: 'linebreak'
    },
    tableLineColor: [0, 0, 0],
    tableLineWidth: 0.4,
    head: [[
      colNoLabel,
      'Date',
      "Driver's\nName",
      'Vehicle /\nPurchaser',
      'Name of company',
      'Gate Pass\nNo.',
      'Material Description',
      'Quantity',
      colTimeLabel,
      'Security\nsignature'
    ]],
    body: tableData,
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 28, halign: 'left' },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 42, halign: 'left' },
      5: { cellWidth: 25, halign: 'center' },
      6: { cellWidth: 50, halign: 'left' },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 22, halign: 'center' }
    }
  });

  const filename = isOutward
    ? `Material_Outward_Register_${new Date().toISOString().slice(0, 10)}.pdf`
    : isInward
    ? `Material_Inward_Register_${new Date().toISOString().slice(0, 10)}.pdf`
    : `Gate_Daybook_Register_${new Date().toISOString().slice(0, 10)}.pdf`;

  doc.save(filename);
}

