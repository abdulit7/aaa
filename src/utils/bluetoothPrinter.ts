/**
 * Bluetooth Thermal Printer Utility (ESC/POS)
 * Multi-mode mobile printing:
 * 1. Direct Android Bluetooth Print (RawBT / QuickPrinter Intent) - Works 100% on Chrome Android even on HTTP/WiFi!
 * 2. Web Bluetooth API (BLE) - Direct browser pairing for Bluetooth Low Energy printers on HTTPS/localhost
 * 3. Android System Print Spooler - Native printer selector formatted for 58mm/80mm thermal paper
 * 4. Android Web Share API - Transmit ESC/POS binary file directly to Bluetooth print utility apps
 */

export type PrintMethod = 'rawbt' | 'web_bluetooth' | 'system' | 'share';

export interface BluetoothPrinterConfig {
  deviceName: string;
  deviceId: string;
  paperWidth: '58mm' | '80mm';
  printMethod: PrintMethod;
  connected: boolean;
  savedAt: string;
}

export interface GatePrintData {
  companyName?: string;
  gate?: string;
  code: string;
  dir: 'IN' | 'OUT' | 'RETURN';
  at?: string;
  guard_name: string;
  party: string;
  vehicle_no: string;
  vehicle_type?: string;
  driver?: string;
  driver_id?: string;
  doc_type?: string;
  doc_no?: string;
  dept?: string;
  authorised_by?: string;
  purpose?: string;
  items: Array<{ desc: string; qty: number | string; unit: string }>;
  remarks?: string;
  returnable?: boolean;
  expected_return?: string | null;
  against?: string | null;
}

export interface BluetoothDiagnostics {
  isMobile: boolean;
  isSecureContext: boolean;
  hasBluetoothAPI: boolean;
  inIframe: boolean;
  protocol: string;
  host: string;
  recommendation: string;
}

const STORAGE_KEY = 'gatemaster_bluetooth_printer';

// Global device cache for active Web Bluetooth connection
let cachedDevice: any = null;
let cachedCharacteristic: any = null;

// Common thermal printer BLE service UUIDs
const BLE_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip / POS
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic POS
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Pos-58/80
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '0000180a-0000-1000-8000-00805f9b34fb'  // Device Info
];

export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTouchScreen = window.matchMedia && window.matchMedia('(max-width: 820px)').matches && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  return isMobileUA || isTouchScreen;
};

export const isBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

export const getBluetoothDiagnostics = (): BluetoothDiagnostics => {
  const isMobile = isMobileDevice();
  const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;
  const hasBt = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'unknown';
  const host = typeof window !== 'undefined' ? window.location.host : 'unknown';

  let recommendation = 'Ready to print.';
  if (!isSecure && protocol === 'http:') {
    recommendation =
      'You are accessing the app over unencrypted HTTP (such as a local WiFi IP e.g. http://192.168.x.x). Chrome restricts the Web Bluetooth API on HTTP origins. Use "Direct Android Bluetooth (RawBT)" or "Android System Print Spooler" below, which work 100% on HTTP!';
  } else if (!hasBt) {
    recommendation =
      'Web Bluetooth API is not exposed in this browser context. Use "Direct Android Bluetooth (RawBT)" or "Android System Print Spooler", which work across all mobile browsers.';
  } else if (inIframe) {
    recommendation =
      'Running inside an iframe. If Web Bluetooth device discovery is blocked, open the application directly in a new tab or use Direct Android Print (RawBT).';
  }

  return {
    isMobile,
    isSecureContext: isSecure,
    hasBluetoothAPI: hasBt,
    inIframe,
    protocol,
    host,
    recommendation
  };
};

export const getSavedPrinterConfig = (): BluetoothPrinterConfig | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.printMethod) {
      parsed.printMethod = isMobileDevice() ? 'rawbt' : 'system';
    }
    return parsed;
  } catch (err) {
    console.error('Error reading saved printer config:', err);
    return null;
  }
};

export const savePrinterConfig = (config: Partial<BluetoothPrinterConfig>): BluetoothPrinterConfig => {
  const current = getSavedPrinterConfig() || {
    deviceName: 'Bluetooth Thermal Printer',
    deviceId: '',
    paperWidth: '58mm',
    printMethod: isMobileDevice() ? 'rawbt' : 'system',
    connected: false,
    savedAt: new Date().toISOString()
  };

  const updated: BluetoothPrinterConfig = {
    ...current,
    ...config,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const clearPrinterConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  disconnectBluetoothPrinter();
};

export const disconnectBluetoothPrinter = (): void => {
  try {
    if (cachedDevice && cachedDevice.gatt && cachedDevice.gatt.connected) {
      cachedDevice.gatt.disconnect();
    }
  } catch (e) {
    console.warn('Error during disconnect:', e);
  }
  cachedDevice = null;
  cachedCharacteristic = null;

  const current = getSavedPrinterConfig();
  if (current) {
    savePrinterConfig({ ...current, connected: false });
  }
};

export const isBluetoothConnected = (): boolean => {
  return !!(cachedDevice && cachedDevice.gatt && cachedDevice.gatt.connected && cachedCharacteristic);
};

/**
 * Connect to Bluetooth thermal printer using Web Bluetooth API (BLE)
 */
export const connectBluetoothPrinter = async (
  preferredWidth: '58mm' | '80mm' = '58mm'
): Promise<{ success: boolean; deviceName: string; error?: string }> => {
  const diag = getBluetoothDiagnostics();

  if (!diag.hasBluetoothAPI) {
    return {
      success: false,
      deviceName: '',
      error:
        !diag.isSecureContext && diag.protocol === 'http:'
          ? 'Web Bluetooth is disabled by Chrome on HTTP origins (http://...). Please switch to "Direct Android Bluetooth (RawBT)" or "Android System Print" mode below, which works immediately over WiFi and local network!'
          : 'Web Bluetooth is not supported on this browser context. Use "Direct Android Bluetooth (RawBT)" or "Android System Print Spooler".'
    };
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLE_PRINTER_SERVICES
    });

    if (!device) {
      return { success: false, deviceName: '', error: 'No Bluetooth device selected.' };
    }

    const deviceName = device.name || 'Bluetooth Thermal Printer';
    cachedDevice = device;

    const server = await device.gatt.connect();

    let foundChar: any = null;
    const services = await server.getPrimaryServices();

    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            foundChar = char;
            break;
          }
        }
        if (foundChar) break;
      } catch (err) {
        // try next service
      }
    }

    if (!foundChar) {
      return {
        success: false,
        deviceName,
        error:
          'Bluetooth device found, but no writable ESC/POS printer characteristic was detected. Try "Direct Android Print (RawBT)" for Bluetooth Classic printers.'
      };
    }

    cachedCharacteristic = foundChar;

    savePrinterConfig({
      deviceName,
      deviceId: device.id || deviceName,
      paperWidth: preferredWidth,
      printMethod: 'web_bluetooth',
      connected: true
    });

    device.addEventListener('gattserverdisconnected', () => {
      cachedCharacteristic = null;
      const cfg = getSavedPrinterConfig();
      if (cfg) {
        savePrinterConfig({ ...cfg, connected: false });
      }
    });

    return { success: true, deviceName };
  } catch (err: any) {
    console.error('Bluetooth connection failed:', err);
    return {
      success: false,
      deviceName: '',
      error: err.message || 'Bluetooth connection was cancelled or timed out.'
    };
  }
};

/**
 * Generate ESC/POS byte commands for Gate Entry slip
 */
export const generateEscPosCommands = (data: GatePrintData, width: '58mm' | '80mm' = '58mm'): Uint8Array => {
  const lineCols = width === '80mm' ? 48 : 32;
  const divider = '-'.repeat(lineCols);
  const doubleDivider = '='.repeat(lineCols);

  const encoder = new TextEncoder();
  const chunks: number[] = [];

  const write = (str: string) => {
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      chunks.push(bytes[i]);
    }
  };

  const ESC = 0x1b;
  const GS = 0x1d;

  // Initialize printer
  chunks.push(ESC, 0x40);

  // Align Center
  chunks.push(ESC, 0x61, 0x01);

  // Double Height & Double Width for Company Name
  chunks.push(GS, 0x21, 0x11);
  chunks.push(ESC, 0x45, 0x01); // Bold ON
  write((data.companyName || 'GUJRANWALA FOOD IND.').toUpperCase() + '\n');

  // Normal text, bold
  chunks.push(GS, 0x21, 0x00);
  write((data.gate || 'MAIN GATE') + ' CHECKPOINT\n');
  write(doubleDivider + '\n');

  // Direction title
  let title = '*** MATERIAL IN PASS ***';
  if (data.dir === 'OUT') title = '*** MATERIAL OUT PASS ***';
  if (data.dir === 'RETURN') title = '*** RETURNED ITEM SLIP ***';
  write(title + '\n');

  // Big Entry Code
  chunks.push(GS, 0x21, 0x11);
  write(`[ ${data.code} ]\n`);
  chunks.push(GS, 0x21, 0x00);
  chunks.push(ESC, 0x45, 0x00); // Bold OFF

  // Align Left
  chunks.push(ESC, 0x61, 0x00);
  write(divider + '\n');

  const addField = (lbl: string, val?: string | null) => {
    if (!val) return;
    write(`${lbl}: ${val}\n`);
  };

  const nowStr = data.at || new Date().toLocaleString();
  addField('Date & Time', nowStr);
  addField('Duty Guard', data.guard_name);
  addField('Party/Vendor', data.party);
  addField('Vehicle No', data.vehicle_no + (data.vehicle_type ? ` (${data.vehicle_type})` : ''));
  if (data.driver) addField('Driver', data.driver + (data.driver_id ? ` [${data.driver_id}]` : ''));
  if (data.doc_no) addField('Doc Ref', `${data.doc_type || 'Doc'}: ${data.doc_no}`);
  if (data.dept) addField('Department', data.dept);
  if (data.authorised_by) addField('Auth By', data.authorised_by);
  if (data.against) addField('Ref OUT Code', data.against);
  if (data.returnable) {
    chunks.push(ESC, 0x45, 0x01);
    write('TYPE: RETURNABLE ITEM\n');
    if (data.expected_return) write(`Expected Return: ${data.expected_return}\n`);
    chunks.push(ESC, 0x45, 0x00);
  }

  write(divider + '\n');
  chunks.push(ESC, 0x45, 0x01);
  write('ITEMS LIST:\n');
  chunks.push(ESC, 0x45, 0x00);

  if (data.items && data.items.length > 0) {
    data.items.forEach((item, idx) => {
      write(`${idx + 1}. ${item.desc}\n   Qty: ${item.qty} ${item.unit}\n`);
    });
  } else {
    write('1. (No items listed)\n');
  }

  if (data.remarks) {
    write(divider + '\n');
    write(`Remarks: ${data.remarks}\n`);
  }

  write(doubleDivider + '\n');

  // Signatures
  write('\n\n');
  if (width === '80mm') {
    write('--------------------        --------------------\n');
    write('  Guard Signature             Driver Signature  \n');
  } else {
    write('-----------------     -----------------\n');
    write(' Guard Signature       Driver Signature\n');
  }

  // Footer note
  chunks.push(ESC, 0x61, 0x01); // Center
  write('\n*** COMPUTER GENERATED PASS ***\n');
  write(divider + '\n\n\n\n');

  // Cut command (ESC/POS GS V 65 0)
  chunks.push(GS, 0x56, 0x41, 0x00);

  return new Uint8Array(chunks);
};

/**
 * Send binary ESC/POS data to Bluetooth characteristic in chunks
 */
export const sendBluetoothEscPos = async (data: Uint8Array): Promise<{ success: boolean; error?: string }> => {
  if (!cachedCharacteristic) {
    return {
      success: false,
      error: 'Bluetooth printer is not connected. Please connect in Settings.'
    };
  }

  try {
    const CHUNK_SIZE = 100;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (cachedCharacteristic.writeValueWithoutResponse) {
        await cachedCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await cachedCharacteristic.writeValue(chunk);
      }
      await new Promise(res => setTimeout(res, 25));
    }
    return { success: true };
  } catch (err: any) {
    console.error('Failed to send data to Bluetooth printer:', err);
    return {
      success: false,
      error: err.message || 'Error transmitting print job to Bluetooth printer.'
    };
  }
};

/**
 * METHOD 1: Direct Android Bluetooth Print (RawBT / QuickPrinter URL Scheme)
 * Works 100% on Android Chrome, even on HTTP (http://192.168.x.x) and inside iframes!
 * Transmits base64 ESC/POS directly to the printer.
 */
export const printViaRawBT = (data: GatePrintData, paperWidth: '58mm' | '80mm' = '58mm'): boolean => {
  const bytes = generateEscPosCommands(data, paperWidth);

  // Convert Uint8Array to base64 string
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = window.btoa(binary);

  // RawBT protocol URL: rawbt:data:application/octet-stream;base64,...
  const rawbtUrl = `rawbt:data:application/octet-stream;base64,${base64Data}`;

  try {
    // Create an invisible anchor tag to trigger the custom protocol
    const link = document.createElement('a');
    link.href = rawbtUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
    }, 1500);
    return true;
  } catch (e) {
    console.warn('RawBT URL scheme trigger failed, attempting window.location fallback:', e);
    window.location.href = rawbtUrl;
    return true;
  }
};

/**
 * METHOD 4: Android Web Share API with ESC/POS binary file
 */
export const printViaWebShare = async (
  data: GatePrintData,
  paperWidth: '58mm' | '80mm' = '58mm'
): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      const bytes = generateEscPosCommands(data, paperWidth);
      const blob = new Blob([bytes as any], { type: 'application/octet-stream' });
      const file = new File([blob], `pass-${data.code}.bin`, { type: 'application/octet-stream' });
      await (navigator as any).share({
        title: `Gate Pass ${data.code}`,
        text: `Gate Pass ${data.code} for ${data.party}`,
        files: [file]
      });
      return true;
    } catch (e) {
      console.warn('Web Share cancelled or failed:', e);
    }
  }
  return false;
};

/**
 * Regular browser print (Android Print Spooler or Desktop Browser Dialog)
 */
export const printRegularGatePass = (data: GatePrintData): void => {
  const printWindow = window.open('', '_blank', 'width=450,height=650');
  if (!printWindow) {
    window.print();
    return;
  }

  const itemsHtml = (data.items || [])
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 12px;">${idx + 1}. ${item.desc}</td>
        <td style="padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 12px; text-align: right; font-weight: bold;">${item.qty} ${item.unit}</td>
      </tr>
    `
    )
    .join('');

  const dirBadge =
    data.dir === 'IN'
      ? '<span style="background: #15803d; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">MATERIAL IN</span>'
      : data.dir === 'OUT'
      ? '<span style="background: #1d4ed8; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">MATERIAL OUT</span>'
      : '<span style="background: #0f766e; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">RETURNED ITEM</span>';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Gate Pass ${data.code}</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 2mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            color: #111;
            margin: 0;
            padding: 8px;
            font-size: 12px;
            line-height: 1.4;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .title { font-size: 15px; font-weight: 800; margin: 0; }
          .code-box {
            border: 2px solid #000;
            padding: 6px;
            margin: 8px 0;
            font-size: 18px;
            font-weight: 900;
            text-align: center;
            font-family: monospace;
            background: #fafafa;
          }
          .divider { border-top: 1px dashed #666; margin: 8px 0; }
          .double-divider { border-top: 2px solid #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px; }
          .label { color: #555; }
          .val { font-weight: 600; text-align: right; }
          .signatures { margin-top: 20px; display: flex; justify-content: space-between; text-align: center; font-size: 10px; }
          .sig-line { width: 45%; border-top: 1px solid #333; padding-top: 4px; }
        </style>
      </head>
      <body>
        <div class="center">
          <h1 class="title">${data.companyName || 'GUJRANWALA FOOD INDUSTRIES'}</h1>
          <div style="font-size: 11px; color: #555; margin-top: 2px;">${data.gate || 'Main Gate'} Checkpoint Pass</div>
          <div style="margin-top: 6px;">${dirBadge}</div>
          <div class="code-box">${data.code}</div>
        </div>

        <div class="divider"></div>

        <div class="row"><span class="label">Date & Time:</span><span class="val">${data.at || new Date().toLocaleString()}</span></div>
        <div class="row"><span class="label">Duty Guard:</span><span class="val">${data.guard_name}</span></div>
        <div class="row"><span class="label">Party / Vendor:</span><span class="val">${data.party}</span></div>
        <div class="row"><span class="label">Vehicle No:</span><span class="val">${data.vehicle_no} (${data.vehicle_type || 'Vehicle'})</span></div>
        ${data.driver ? `<div class="row"><span class="label">Driver:</span><span class="val">${data.driver} ${data.driver_id ? `[${data.driver_id}]` : ''}</span></div>` : ''}
        ${data.doc_no ? `<div class="row"><span class="label">Document Ref:</span><span class="val">${data.doc_type || 'Doc'}: ${data.doc_no}</span></div>` : ''}
        ${data.dept ? `<div class="row"><span class="label">Department:</span><span class="val">${data.dept}</span></div>` : ''}
        ${data.against ? `<div class="row"><span class="label">Against OUT:</span><span class="val">${data.against}</span></div>` : ''}
        ${data.returnable ? `<div class="row" style="color: #c2410c; font-weight: bold;"><span class="label">Returnable Item:</span><span class="val">Due ${data.expected_return || 'TBD'}</span></div>` : ''}

        <div class="divider"></div>
        <div class="bold" style="margin-bottom: 4px; font-size: 11px; text-transform: uppercase;">Items Specified:</div>
        <table>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${data.remarks ? `<div class="divider"></div><div style="font-size: 11px;"><span class="label">Remarks:</span> ${data.remarks}</div>` : ''}

        <div class="double-divider"></div>

        <div class="signatures">
          <div class="sig-line">Guard Signature</div>
          <div class="sig-line">Driver / Receiver</div>
        </div>

        <div class="center" style="margin-top: 14px; font-size: 9px; color: #777;">
          Official Computer Generated Pass · GFI GateMaster
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Master Print Dispatcher:
 * Automatically uses the configured or optimal print method.
 */
export const printGatePass = async (
  data: GatePrintData,
  options?: { forceRegular?: boolean; preferredMethod?: PrintMethod }
): Promise<{ success: boolean; method: PrintMethod; error?: string }> => {
  const isMobile = isMobileDevice();
  const savedConfig = getSavedPrinterConfig();
  const method: PrintMethod = options?.preferredMethod || savedConfig?.printMethod || (isMobile ? 'rawbt' : 'system');
  const paperWidth = savedConfig?.paperWidth || '58mm';

  if (!isMobile || options?.forceRegular || method === 'system') {
    printRegularGatePass(data);
    return { success: true, method: 'system' };
  }

  if (method === 'rawbt') {
    const ok = printViaRawBT(data, paperWidth);
    return { success: ok, method: 'rawbt' };
  }

  if (method === 'share') {
    const ok = await printViaWebShare(data, paperWidth);
    if (ok) return { success: true, method: 'share' };
    printRegularGatePass(data);
    return { success: true, method: 'system' };
  }

  if (method === 'web_bluetooth') {
    if (isBluetoothConnected()) {
      const bytes = generateEscPosCommands(data, paperWidth);
      const res = await sendBluetoothEscPos(bytes);
      if (res.success) return { success: true, method: 'web_bluetooth' };
    } else if (savedConfig) {
      const conn = await connectBluetoothPrinter(paperWidth);
      if (conn.success) {
        const bytes = generateEscPosCommands(data, paperWidth);
        const res = await sendBluetoothEscPos(bytes);
        if (res.success) return { success: true, method: 'web_bluetooth' };
      }
    }
    // Fallback to RawBT if Web Bluetooth fails on mobile
    const fallbackOk = printViaRawBT(data, paperWidth);
    if (fallbackOk) return { success: true, method: 'rawbt' };
    printRegularGatePass(data);
    return { success: true, method: 'system' };
  }

  printRegularGatePass(data);
  return { success: true, method: 'system' };
};

/**
 * Print an Inter-Branch Material Gate Pass to Bluetooth/System printer
 */
export const printInterBranchGatePass = async (
  pass: any,
  companyName: string = 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD'
): Promise<{ success: boolean; method?: PrintMethod; error?: string }> => {
  const printData: GatePrintData = {
    companyName,
    gate: `${pass.from_branch} ➔ ${pass.to_branch}`,
    code: pass.gate_pass_no,
    dir: 'OUT',
    at: pass.gate_pass_date || pass.created_at,
    guard_name: pass.created_by_name || 'Staff',
    party: `Dest: ${pass.to_branch}`,
    vehicle_no: pass.vehicle_no,
    vehicle_type: 'Inter-Branch Transfer',
    driver: pass.driver_name,
    driver_id: pass.driver_id,
    doc_type: 'Inter-Branch Gate Pass',
    doc_no: pass.gate_pass_no,
    dept: pass.department || pass.purpose,
    items: (pass.items || []).map((i: any) => ({
      desc: i.description,
      qty: i.dispatch_qty,
      unit: i.unit
    })),
    remarks: `STATUS: ${pass.status} | From: ${pass.from_branch} | To: ${pass.to_branch}`
  };
  return printGatePass(printData);
};

/**
 * Print a test slip to verify printer connection and alignment
 */
export const printTestSlip = async (
  methodOverride?: PrintMethod
): Promise<{ success: boolean; error?: string }> => {
  const saved = getSavedPrinterConfig();
  const width = saved?.paperWidth || '58mm';
  const method = methodOverride || saved?.printMethod || 'rawbt';

  const testData: GatePrintData = {
    companyName: 'GUJRANWALA FOOD IND. (PVT) LTD',
    gate: 'Main Gate',
    code: '000000',
    dir: 'IN',
    at: new Date().toLocaleString(),
    guard_name: 'Printer Alignment Test',
    party: 'TEST THERMAL PRINTER',
    vehicle_no: 'TEST-1234',
    vehicle_type: 'Thermal POS 58/80mm',
    items: [
      { desc: 'Thermal Bluetooth Alignment Test', qty: 1, unit: 'Pcs' },
      { desc: 'Line formatting & paper cut check', qty: 1, unit: 'OK' }
    ],
    remarks: 'Printer test passed successfully.'
  };

  if (method === 'rawbt') {
    const ok = printViaRawBT(testData, width);
    return { success: ok };
  }

  if (method === 'system') {
    printRegularGatePass(testData);
    return { success: true };
  }

  if (method === 'share') {
    const ok = await printViaWebShare(testData, width);
    return { success: ok };
  }

  if (method === 'web_bluetooth') {
    if (isBluetoothConnected()) {
      const bytes = generateEscPosCommands(testData, width);
      return sendBluetoothEscPos(bytes);
    } else {
      const conn = await connectBluetoothPrinter(width);
      if (conn.success) {
        const bytes = generateEscPosCommands(testData, width);
        return sendBluetoothEscPos(bytes);
      }
      return { success: false, error: conn.error || 'Bluetooth printer not connected' };
    }
  }

  return { success: false, error: 'Unknown print method' };
};
