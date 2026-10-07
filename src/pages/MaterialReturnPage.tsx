import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GateEntry, GateItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { printGatePass } from '../utils/bluetoothPrinter';
import { motion } from 'motion/react';
import { optimizeMobileImage } from '../utils/imageOptimizer';

interface LocalPhoto {
  id: string;
  dataUrl: string;
  note: string;
  mime: string;
}

const VEHICLE_TYPES = ['Truck', 'Mazda / Shehzore', 'Pickup / Loader', 'Car', 'Rickshaw / Loader rickshaw', 'Motorcycle', 'Hand carried', 'Other'];
const RETURN_DOC_TYPES = ['Return note / Bilty', 'Delivery challan', 'Invoice / Repair Bill', 'Gate pass copy', 'No document'];

export const MaterialReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Outstanding returnable entries from previous OUT dispatches
  const [openOutEntries, setOpenOutEntries] = useState<GateEntry[]>([]);
  const [selectedOutEntry, setSelectedOutEntry] = useState<GateEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Return details
  const [guardName, setGuardName] = useState(user?.name || '');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driver, setDriver] = useState('');
  const [driverId, setDriverId] = useState('');
  const [docType, setDocType] = useState('Return note / Bilty');
  const [docNo, setDocNo] = useState('');
  const [returnItems, setReturnItems] = useState<GateItem[]>([]);
  const [remarks, setRemarks] = useState('');

  const [attachedPhotos, setAttachedPhotos] = useState<LocalPhoto[]>([]);
  const [autoPrint, setAutoPrint] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load outstanding returnable entries dispatched OUT
  useEffect(() => {
    fetch('/api/entries?returnable=true')
      .then(res => res.json())
      .then((data: GateEntry[]) => {
        const pendingReturns = data.filter(e => e.dir === 'OUT' && !e.returned_at && !e.cancelled);
        setOpenOutEntries(pendingReturns);

        const state = location.state as { preselectedOutCode?: string };
        if (state?.preselectedOutCode) {
          fetchAndSelectEntry(state.preselectedOutCode, pendingReturns);
        } else if (pendingReturns.length === 1) {
          populateFromEntry(pendingReturns[0]);
        }
      })
      .catch(console.error);
  }, [location.state]);

  // Sync user name into guardName if not yet set
  useEffect(() => {
    if (!guardName && user?.name) {
      setGuardName(user.name);
    }
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const populateFromEntry = (entry: GateEntry) => {
    setSelectedOutEntry(entry);
    setSearchQuery(`${entry.code} — ${entry.party}${entry.vehicle_no ? ` (${entry.vehicle_no})` : ''}`);
    setIsDropdownOpen(false);
    setVehicleType(entry.vehicle_type || 'Truck');
    setVehicleNo(entry.vehicle_no || '');
    setDriver(entry.driver || '');
    setDriverId(entry.driver_id || '');
    setRemarks(`Returned back in good condition. Ref OUT: ${entry.code}`);
    setReturnItems(entry.items ? JSON.parse(JSON.stringify(entry.items)) : []);
  };

  const fetchAndSelectEntry = async (code: string, preloadedList?: GateEntry[]) => {
    const list = preloadedList || openOutEntries;
    const existing = list.find(o => o.code === code);
    if (existing) {
      populateFromEntry(existing);
      return;
    }

    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/entries/${code}`);
      if (res.ok) {
        const entry: GateEntry = await res.json();
        populateFromEntry(entry);
      }
    } catch (err) {
      console.error('Failed to fetch entry details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectOutEntry = (entry: GateEntry) => {
    populateFromEntry(entry);
  };

  const handleClearSelection = () => {
    setSelectedOutEntry(null);
    setSearchQuery('');
    setVehicleNo('');
    setDriver('');
    setDriverId('');
    setDocNo('');
    setRemarks('');
    setReturnItems([]);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleUpdateItemQty = (index: number, newQty: number) => {
    setReturnItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], qty: newQty };
      return copy;
    });
  };

  const handleCaptureImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      try {
        const optimized = await optimizeMobileImage(file);
        setAttachedPhotos(prev => [
          ...prev,
          {
            id: `return-photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            dataUrl: optimized.dataUrl,
            note: `Photo #${prev.length + 1}`,
            mime: optimized.mime
          }
        ]);
      } catch {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setAttachedPhotos(prev => [
            ...prev,
            {
              id: `return-photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              dataUrl,
              note: `Photo #${prev.length + 1}`,
              mime: file.type || 'image/jpeg'
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    }
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedOutEntry) {
      setErrorMessage('Please pick the previous dispatched OUT item.');
      return;
    }

    if (!guardName.trim()) {
      setErrorMessage('Please enter the guard name.');
      return;
    }

    if (vehicleType !== 'Hand carried' && !vehicleNo.trim()) {
      setErrorMessage('Enter the returning vehicle number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        guard_name: guardName.trim(),
        vehicle_type: vehicleType,
        vehicle_no: vehicleNo.trim().toUpperCase(),
        driver: driver.trim(),
        driver_id: driverId.trim(),
        doc_type: docType,
        doc_no: docNo.trim(),
        returned_items: returnItems,
        remarks: remarks.trim(),
        photos: attachedPhotos.map(p => ({ data_url: p.dataUrl, note: p.note }))
      };

      const res = await fetch(`/api/entries/${selectedOutEntry.code}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record return');
      }

      if (autoPrint) {
        try {
          await printGatePass({
            code: selectedOutEntry.code,
            dir: 'RETURN',
            gate: user?.gate || 'Main Gate',
            guard_name: guardName.trim(),
            party: selectedOutEntry.party,
            vehicle_no: vehicleNo.trim().toUpperCase(),
            vehicle_type: vehicleType,
            driver: driver.trim(),
            driver_id: driverId.trim(),
            doc_type: docType,
            doc_no: docNo.trim(),
            items: returnItems.map(i => ({ desc: i.desc, qty: i.qty, unit: i.unit })),
            remarks: remarks.trim(),
            against: selectedOutEntry.code
          });
        } catch (printErr) {
          console.warn('Print slip error:', printErr);
        }
      }

      navigate(`/e/${selectedOutEntry.code}?returned=1`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving return');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEntries = openOutEntries.filter(e => {
    if (!searchQuery.trim() || selectedOutEntry) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.code.toLowerCase().includes(q) ||
      e.party.toLowerCase().includes(q) ||
      (e.vehicle_no && e.vehicle_no.toLowerCase().includes(q)) ||
      e.items.some(i => i.desc.toLowerCase().includes(q))
    );
  });

  return (
    <PageMotion className="w-full space-y-4 pb-16">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCaptureImage}
      />

      <div className="border-b border-[#dde1e6] pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0f766e] flex items-center gap-2">
          <span>🔄</span>
          <span>Returning Back</span>
        </h1>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#fdecec] text-[#b91c1c] text-sm font-semibold border border-[#efa5a5]">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card3D className="p-4 sm:p-6 space-y-4 border-t-4 border-[#0f766e]">
          {/* STEP 1: PICK PREVIOUS DISPATCHED OUT ITEM (SEARCH & SELECT FIELD) */}
          <div ref={dropdownRef} className="relative">
            <label className="form-label">
              Step 1: Pick Previous Dispatched OUT Item <span className="text-[#b91c1c]">*</span>
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                required
                readOnly={!!selectedOutEntry}
                placeholder="Search by OUT code, party, vehicle or item..."
                value={searchQuery}
                onFocus={() => {
                  if (!selectedOutEntry) setIsDropdownOpen(true);
                }}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className={`w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm border rounded-lg min-h-[46px] sm:min-h-[38px] font-semibold text-[#1b1f24] focus:outline-hidden pr-20 ${
                  selectedOutEntry
                    ? 'bg-emerald-50/60 border-emerald-500 font-mono text-[#0f766e]'
                    : 'bg-white border-[#c5ccd4] focus:border-[#0f766e]'
                }`}
              />

              {isLoadingDetail && (
                <div className="absolute right-20 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-semibold">
                  Loading...
                </div>
              )}

              {selectedOutEntry && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-red-600 hover:text-red-800 font-bold px-2 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                >
                  ✕ Change
                </button>
              )}
            </div>

            {/* Dropdown Menu */}
            {isDropdownOpen && !selectedOutEntry && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#0f766e] rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredEntries.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">
                    No matching returnable items found.
                  </div>
                ) : (
                  filteredEntries.map(e => (
                    <div
                      key={e.code}
                      onClick={() => handleSelectOutEntry(e)}
                      className="p-3 hover:bg-teal-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between font-mono font-bold text-xs text-[#0f766e]">
                        <span>Code: {e.code}</span>
                        <span className="font-sans font-normal text-slate-500 text-[11px]">{e.at.slice(0, 16)}</span>
                      </div>
                      <div className="text-xs font-semibold text-[#1b1f24] mt-0.5">
                        {e.party} {e.vehicle_no ? `· Vehicle: ${e.vehicle_no}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {e.items.map(i => `${i.desc} (${i.qty} ${i.unit})`).join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Guard Name (Manual) & Returning Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Guard Name <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter guard name"
                value={guardName}
                onChange={e => setGuardName(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-semibold text-[#1b1f24] focus:border-[#0f766e] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="form-label">Returning Vehicle Type</label>
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
              >
                {VEHICLE_TYPES.map(vt => (
                  <option key={vt} value={vt}>{vt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">
                Returning Vehicle No <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required={vehicleType !== 'Hand carried'}
                placeholder="e.g. LES-9421"
                value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono uppercase focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          {/* Returning Driver & Returning Document */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Driver Name</label>
              <input
                type="text"
                placeholder="Driver name"
                value={driver}
                onChange={e => setDriver(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Driver CNIC / Phone</label>
              <input
                type="text"
                placeholder="CNIC / Phone"
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Document Type</label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              >
                {RETURN_DOC_TYPES.map(dt => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Document No</label>
              <input
                type="text"
                placeholder="Challan / Bill No"
                value={docNo}
                onChange={e => setDocNo(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          {/* Items Table */}
          {returnItems.length > 0 && (
            <div className="pt-2 border-t border-[#dde1e6]">
              <label className="font-bold text-xs text-[#1b1f24] uppercase tracking-wide block mb-2">
                Returned Items
              </label>
              <div className="border border-[#dde1e6] rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] uppercase text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 w-32">Qty</th>
                      <th className="py-2.5 px-3 w-28">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dde1e6]">
                    {returnItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-[#5f6b7a] font-mono">{index + 1}</td>
                        <td className="py-2 px-3 font-semibold text-[#1b1f24]">{item.desc}</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="any"
                            value={item.qty}
                            onChange={e => handleUpdateItemQty(index, Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#c5ccd4] rounded-md font-mono font-bold text-[#0f766e]"
                          />
                        </td>
                        <td className="py-2 px-3 text-[#5f6b7a]">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="form-label">
              Remarks <span className="text-[#b91c1c]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Received intact and inspected"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-semibold text-[#1b1f24]"
            />
          </div>
        </Card3D>

        {/* Capture Image Section */}
        <Card3D className="p-4 sm:p-5 space-y-3 bg-white border-2 border-dashed border-[#0f766e]/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="font-bold text-sm sm:text-base text-[#1b1f24] flex items-center gap-2">
              <span>📷</span>
              <span>Capture Images</span>
              {attachedPhotos.length > 0 && (
                <span className="text-xs bg-[#0f766e] text-white px-2 py-0.5 rounded-full font-mono">
                  {attachedPhotos.length} photo{attachedPhotos.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <Button3D
              type="button"
              variant="sec"
              size="md"
              onClick={() => cameraInputRef.current?.click()}
              className="font-bold text-[#0f766e] border-[#0f766e] flex items-center justify-center gap-2 py-3"
            >
              <span>📷</span>
              <span>Capture Image from Camera</span>
            </Button3D>
          </div>

          {attachedPhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {attachedPhotos.map((p, idx) => (
                <div key={p.id} className="relative aspect-4/3 rounded-lg overflow-hidden border border-[#dde1e6] bg-slate-100 shadow-xs">
                  <img src={p.dataUrl} alt={`Captured photo ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-white truncate">
                    Photo #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedPhotos(prev => prev.filter(x => x.id !== p.id))}
                    className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-700"
                    title="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card3D>

        {/* Print Return Receipt Checkbox */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1b1f24] px-1">
          <input
            id="return-auto-print"
            type="checkbox"
            checked={autoPrint}
            onChange={e => setAutoPrint(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#0f766e] focus:ring-[#0f766e]"
          />
          <label htmlFor="return-auto-print" className="cursor-pointer font-semibold">
            🖨️ Automatically print return receipt slip upon saving
          </label>
        </div>

        {/* Save Button */}
        <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}>
          <Button3D
            type="submit"
            variant="brand"
            size="xl"
            disabled={isSubmitting || !selectedOutEntry}
            className="w-full font-extrabold text-base sm:text-lg py-4 bg-[#0f766e] hover:bg-[#115e59] text-white"
          >
            {isSubmitting
              ? 'SAVING RETURN RECORD...'
              : selectedOutEntry
              ? `✔ CONFIRM RETURN (REF: ${selectedOutEntry.code})`
              : 'SELECT ITEM ABOVE TO CONFIRM RETURN'}
          </Button3D>
        </motion.div>
      </form>
    </PageMotion>
  );
};
