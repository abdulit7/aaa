import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card3D, Button3D } from '../../styles/emotion';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { MovementType } from '../../types';
import { printGatePass } from '../../utils/bluetoothPrinter';

interface LocationMaterialOutModalProps {
  locationName: string;
  onClose: () => void;
  onSuccess?: (code: string) => void;
}

interface ItemRow {
  desc: string;
  qty: string;
  unit: string;
}

const COMMON_UNITS = ['Bags', 'Cartons', 'Drums', 'Pcs', 'KG', 'Tons', 'Litre', 'Rolls', 'Bundles', 'Pallets', 'Boxes', 'Sets'];
const VEHICLE_TYPES = ['Truck', 'Mazda / Shehzore', 'Pickup / Loader', 'Car', 'Rickshaw / Loader rickshaw', 'Motorcycle', 'Hand carried', 'Other'];
const MOVEMENT_TYPES: MovementType[] = [
  'Inter-Location Transfer',
  'External / Supplier',
  'Repair / Maintenance',
  'Customer / Sale',
  'Other'
];
const OUT_PURPOSES = [
  'Inter-branch transfer',
  'Finished goods / Sale',
  'Return to supplier',
  'Contractor Repair',
  'Temporary equipment transfer',
  'Job work',
  'Scrap',
  'Sample',
  'Company asset',
  'Other'
];

export const LocationMaterialOutModal: React.FC<LocationMaterialOutModalProps> = ({
  locationName,
  onClose,
  onSuccess
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();

  const [entryCode, setEntryCode] = useState('');
  const [guardName, setGuardName] = useState(user?.name || '');
  const [gate, setGate] = useState(user?.gate || 'Main Gate');
  const [purpose, setPurpose] = useState('Inter-branch transfer');
  const [movementType, setMovementType] = useState<MovementType>('Inter-Location Transfer');
  const [toBranch, setToBranch] = useState('Kamonki');
  const [party, setParty] = useState('');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driver, setDriver] = useState('');
  const [driverId, setDriverId] = useState('');
  const [docType, setDocType] = useState('Gate pass');
  const [docNo, setDocNo] = useState('');
  const [dept, setDept] = useState('Logistics');
  const [authorisedBy, setAuthorisedBy] = useState(user?.name || '');
  const [remarks, setRemarks] = useState('');
  const [returnable, setReturnable] = useState(false);
  const [expectedReturn, setExpectedReturn] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const [items, setItems] = useState<ItemRow[]>([
    { desc: '', qty: '', unit: 'Cartons' }
  ]);

  const [autoPrint, setAutoPrint] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [dbLocations, setDbLocations] = useState<string[]>([]);

  // Fetch registered locations from Users & Locations database
  useEffect(() => {
    const token = localStorage.getItem('gatemaster_token');
    fetch('/api/users/locations', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const names = data.map((l: any) => typeof l === 'string' ? l : l.name).filter(Boolean);
          if (names.length > 0) {
            setDbLocations(names);
          }
        }
      })
      .catch(err => console.warn('Could not fetch locations:', err));
  }, []);

  // Strictly use locations from the database
  const activeBranches = dbLocations.length > 0
    ? dbLocations
    : (settings?.locations ? settings.locations.split(',').map(s => s.trim()).filter(Boolean) : []);

  useEffect(() => {
    // Pick first destination different from current location
    if (activeBranches.length > 0) {
      const other = activeBranches.find(b => b.trim().toLowerCase() !== locationName.trim().toLowerCase()) || activeBranches[0];
      setToBranch(other);
      setParty(other);
    }

    // Fetch next sequential code
    fetch('/api/entries/next-code')
      .then(res => res.json())
      .then(d => {
        if (d.code) setEntryCode(d.code);
      })
      .catch(console.error);
  }, [locationName, activeBranches]);

  const updateItem = (idx: number, field: keyof ItemRow, val: string) => {
    setItems(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const addItemRow = () => {
    setItems(prev => [...prev, { desc: '', qty: '', unit: 'Cartons' }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleMovementChange = (newType: MovementType) => {
    setMovementType(newType);
    if (newType === 'Inter-Location Transfer' || newType === 'Inter-Branch Transfer') {
      const destination = activeBranches.find(b => b.trim().toLowerCase() !== locationName.trim().toLowerCase()) || 'Kamonki';
      setToBranch(destination);
      setParty(destination);
      setPurpose('Inter-branch transfer');
    } else {
      setPurpose('Finished goods / Sale');
      if (party === toBranch) setParty('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!guardName.trim()) {
      setErrorMsg('Please enter guard name.');
      return;
    }

    const isInterLocation = movementType === 'Inter-Location Transfer' || movementType === 'Inter-Branch Transfer';

    if (isInterLocation) {
      if (!toBranch.trim()) {
        setErrorMsg('Please select destination (To Location).');
        return;
      }
      if (locationName.trim().toLowerCase() === toBranch.trim().toLowerCase()) {
        setErrorMsg('From Location and To Location cannot be identical.');
        return;
      }
    } else if (!party.trim()) {
      setErrorMsg('Please enter recipient/party.');
      return;
    }

    if (vehicleType !== 'Hand carried' && !vehicleNo.trim()) {
      setErrorMsg('Please enter vehicle number.');
      return;
    }

    const validItems = items.filter(i => i.desc.trim() && Number(i.qty) > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one item description and positive quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actualParty = isInterLocation ? toBranch.trim() : party.trim();

      const payload = {
        code: entryCode.trim() || undefined,
        dir: 'OUT',
        movement_type: movementType,
        from_branch: isInterLocation ? locationName.trim() : undefined,
        to_branch: isInterLocation ? toBranch.trim() : undefined,
        inter_branch_details: isInterLocation ? {
          from_branch: locationName.trim(),
          to_branch: toBranch.trim(),
          status: 'in_transit' as const,
          dispatched_at: new Date().toISOString(),
          dispatched_guard: guardName.trim(),
          items_tracking: validItems.map((i, idx) => ({
            item_id: `itm-${Date.now()}-${idx}`,
            desc: i.desc.trim(),
            sent_qty: Number(i.qty),
            received_qty: 0,
            returned_qty: 0,
            unit: i.unit
          }))
        } : null,
        gate: gate || 'Main Gate',
        location: locationName.trim(),
        device_type: user?.device_type || 'web',
        guard_name: guardName.trim(),
        purpose,
        party: actualParty,
        vehicle_type: vehicleType,
        vehicle_no: vehicleNo.trim().toUpperCase(),
        driver: driver.trim(),
        driver_id: driverId.trim(),
        doc_type: docType,
        doc_no: docNo.trim(),
        amount: null,
        po_no: '',
        authorised_by: authorisedBy.trim(),
        dept: dept.trim(),
        person: driver.trim(),
        remarks: remarks.trim(),
        returnable,
        expected_return: returnable ? expectedReturn : null,
        items: validItems.map(i => ({ desc: i.desc.trim(), qty: Number(i.qty), unit: i.unit })),
        photos: []
      };

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch outward material');

      setSuccessCode(data.code);

      if (autoPrint) {
        try {
          await printGatePass({
            code: data.code,
            dir: 'OUT',
            gate,
            guard_name: guardName.trim(),
            party: actualParty,
            vehicle_no: vehicleNo.trim().toUpperCase(),
            driver: driver.trim(),
            purpose,
            items: validItems.map(i => ({ id: '', desc: i.desc.trim(), qty: Number(i.qty), unit: i.unit })),
            at: new Date().toISOString(),
            expected_return: returnable ? expectedReturn : null
          });
        } catch (_) {}
      }

      if (onSuccess) onSuccess(data.code);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating material out pass');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openInFullPage = () => {
    navigate(`/out?location=${encodeURIComponent(locationName)}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-blue-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 bg-white/15 rounded-xl">⬆</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Material OUT Dispatch Form</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-400/30 text-white border border-blue-300/40 text-[11px] font-bold">
                  📍 {locationName}
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium">
                Outward gate pass generator dedicated for facility location <strong>{locationName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openInFullPage}
              className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all cursor-pointer flex items-center gap-1"
              title="Open full page"
            >
              <span>↗️ Full Screen</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 text-lg font-bold cursor-pointer rounded-lg hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1">
          {successCode ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 text-3xl rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300">
                ✔
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Material OUT Gate Pass Saved!
              </h3>
              <p className="text-sm text-slate-600">
                Dispatch code: <span className="font-mono font-bold text-blue-700 text-base">{successCode}</span> from{' '}
                <span className="font-bold text-slate-800">{locationName}</span>
              </p>
              <div className="flex justify-center gap-3 pt-3">
                <Button3D
                  variant="sec"
                  size="md"
                  onClick={() => {
                    setSuccessCode(null);
                    setItems([{ desc: '', qty: '', unit: 'Cartons' }]);
                    setVehicleNo('');
                    fetch('/api/entries/next-code').then(r => r.json()).then(d => d.code && setEntryCode(d.code));
                  }}
                >
                  ➕ Create Another Pass
                </Button3D>
                <Button3D
                  variant="in"
                  size="md"
                  onClick={onClose}
                >
                  Done & Close
                </Button3D>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold border border-rose-200">
                  {errorMsg}
                </div>
              )}

              {/* Facility Origin & Movement Bar */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                    From Location (اصل مقام)
                  </label>
                  <div className="px-3 py-2 bg-white border border-blue-300 rounded-lg text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                    <span>🏢</span>
                    <span className="truncate">{locationName}</span>
                    <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">LOCKED</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                    Movement Type
                  </label>
                  <select
                    value={movementType}
                    onChange={e => handleMovementChange(e.target.value as MovementType)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-bold text-slate-800 focus:border-blue-600"
                  >
                    {MOVEMENT_TYPES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                    {movementType === 'Inter-Location Transfer' ? 'To Destination Location' : 'Party / Destination'}
                  </label>
                  {movementType === 'Inter-Location Transfer' ? (
                    <select
                      value={toBranch}
                      onChange={e => {
                        setToBranch(e.target.value);
                        setParty(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-white border-2 border-blue-400 rounded-lg text-xs font-bold text-blue-900 focus:border-blue-600"
                    >
                      {activeBranches
                        .filter(b => b.trim().toLowerCase() !== locationName.trim().toLowerCase())
                        .map(b => (
                          <option key={b} value={b}>📍 {b}</option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vendor name, customer"
                      value={party}
                      onChange={e => setParty(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-semibold focus:border-blue-600"
                    />
                  )}
                </div>
              </div>

              {/* Code, Guard Name, Gate, Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="form-label text-xs">Entry Code</label>
                  <input
                    type="text"
                    readOnly
                    value={entryCode}
                    placeholder="000001"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-800"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Guard Name *</label>
                  <input
                    type="text"
                    required
                    value={guardName}
                    onChange={e => setGuardName(e.target.value)}
                    placeholder="Guard name"
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Checkpoint Gate</label>
                  <input
                    type="text"
                    value={gate}
                    onChange={e => setGate(e.target.value)}
                    placeholder="Main Gate"
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Purpose</label>
                  <select
                    value={purpose}
                    onChange={e => setPurpose(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs"
                  >
                    {OUT_PURPOSES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vehicle & Driver */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="form-label text-xs">Vehicle Type</label>
                  <select
                    value={vehicleType}
                    onChange={e => setVehicleType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-semibold"
                  >
                    {VEHICLE_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label text-xs">Vehicle Number *</label>
                  <input
                    type="text"
                    required={vehicleType !== 'Hand carried'}
                    placeholder="e.g. LES-1234"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-mono uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Driver Name"
                    value={driver}
                    onChange={e => setDriver(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="form-label text-xs">Driver Mobile/CNIC</label>
                  <input
                    type="text"
                    placeholder="0300-xxxxxxx"
                    value={driverId}
                    onChange={e => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>📦</span>
                    <span>Dispatched Material Items</span>
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2 py-1 rounded cursor-pointer"
                  >
                    ➕ Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <span className="text-xs font-mono text-slate-400 w-5 text-center">{idx + 1}</span>
                      <input
                        type="text"
                        required
                        placeholder="Item Description (e.g. Finished Cartons)"
                        value={it.desc}
                        onChange={e => updateItem(idx, 'desc', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-blue-500"
                      />
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Qty"
                        value={it.qty}
                        onChange={e => updateItem(idx, 'qty', e.target.value)}
                        className="w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                      />
                      <select
                        value={it.unit}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        className="w-24 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded"
                      >
                        {COMMON_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded text-xs font-bold disabled:opacity-30 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Returnable & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={returnable}
                      onChange={e => setReturnable(e.target.checked)}
                      className="rounded border-amber-400 text-amber-700"
                    />
                    <span>Returnable Material (واپسی والا سامان)</span>
                  </label>
                  {returnable && (
                    <div>
                      <span className="text-[10px] text-amber-800 block mb-1">Expected Return Date:</span>
                      <input
                        type="date"
                        required={returnable}
                        value={expectedReturn}
                        onChange={e => setExpectedReturn(e.target.value)}
                        className="w-full px-2 py-1 text-xs bg-white border border-amber-300 rounded"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="form-label text-xs">Remarks / Dispatch Note</label>
                  <input
                    type="text"
                    placeholder="Remarks or reason"
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#c5ccd4] rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={e => setAutoPrint(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>🖨️ Auto-print gate pass on save</span>
                </label>

                <div className="flex items-center gap-2">
                  <Button3D
                    type="button"
                    variant="sec"
                    size="sm"
                    onClick={onClose}
                  >
                    Cancel
                  </Button3D>
                  <Button3D
                    type="submit"
                    variant="out"
                    size="md"
                    disabled={isSubmitting}
                    className="font-bold px-5"
                  >
                    {isSubmitting ? 'Saving Outward Entry...' : `✔ Dispatch Out from ${locationName}`}
                  </Button3D>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
