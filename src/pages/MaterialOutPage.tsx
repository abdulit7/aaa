import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GateEntry, MovementType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { printGatePass } from '../utils/bluetoothPrinter';
import { motion } from 'motion/react';
import { optimizeMobileImage } from '../utils/imageOptimizer';

interface ItemRow {
  desc: string;
  qty: string;
  unit: string;
}

const COMMON_UNITS = ['Bags', 'Cartons', 'Drums', 'Pcs', 'KG', 'Tons', 'Litre', 'Rolls', 'Bundles', 'Pallets', 'Boxes', 'Sets'];
const VEHICLE_TYPES = ['Truck', 'Mazda / Shehzore', 'Pickup / Loader', 'Car', 'Rickshaw / Loader rickshaw', 'Motorcycle', 'Hand carried', 'Other'];
const MOVEMENT_TYPES: MovementType[] = [
  'External / Supplier',
  'Repair / Maintenance',
  'Customer / Sale',
  'Inter-Location Transfer',
  'Other'
];
const OUT_PURPOSES = [
  'Finished goods / Sale',
  'Return to supplier',
  'Contractor Repair',
  'Temporary equipment transfer',
  'Inter-branch transfer',
  'Job work',
  'Scrap',
  'Sample',
  'Company asset',
  'Empty containers',
  'Personal item',
  'Other'
];
const DOC_TYPES = ['Gate pass', 'Delivery challan', 'Sales invoice', 'No document'];

interface LocalPhoto {
  id: string;
  dataUrl: string;
  note: string;
  mime: string;
}

export const MaterialOutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryLocation = searchParams.get('location');
  const { user } = useAuth();
  const { settings } = useSettings();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [entryCode, setEntryCode] = useState('');
  const [guardName, setGuardName] = useState(user?.name || '');
  const [gate, setGate] = useState(user?.gate || 'Main Gate');
  const [location, setLocation] = useState(queryLocation || user?.location || 'Estate 1');
  const [purpose, setPurpose] = useState('Finished goods / Sale');

  // Movement Type & Inter-Location state
  const [movementType, setMovementType] = useState<MovementType>('External / Supplier');
  const [fromBranch, setFromBranch] = useState(queryLocation || user?.location || 'Estate 1');
  const [toBranch, setToBranch] = useState('Kamonki');
  const [dbLocations, setDbLocations] = useState<string[]>([]);

  // Fetch registered locations from Users & Locations database
  const fetchLocations = () => {
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
      .catch(err => console.warn('Could not fetch locations from users/locations:', err));
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  // Strictly use locations from the database
  const activeBranches = dbLocations.length > 0
    ? dbLocations
    : (settings?.locations ? settings.locations.split(',').map(s => s.trim()).filter(Boolean) : []);

  useEffect(() => {
    if (activeBranches.length > 0) {
      if (queryLocation) {
        setLocation(queryLocation);
        setFromBranch(queryLocation);
        const other = activeBranches.find(b => b.trim().toLowerCase() !== queryLocation.trim().toLowerCase()) || activeBranches[0];
        setToBranch(other);
      } else {
        if (user?.gate) setGate(user.gate);
        const curLoc = (user?.location && activeBranches.some(b => b.toLowerCase() === user.location?.toLowerCase()))
          ? user.location
          : activeBranches[0];
        setLocation(curLoc);
        setFromBranch(curLoc);
        const other = activeBranches.find(b => b.trim().toLowerCase() !== curLoc.trim().toLowerCase()) || activeBranches[0];
        setToBranch(other);
      }
    }
    if (!guardName && user?.name) setGuardName(user.name);
  }, [user, queryLocation, activeBranches]);

  // Keep toBranch synced with available locations from database
  useEffect(() => {
    const diff = activeBranches.filter(b => b.trim().toLowerCase() !== fromBranch.trim().toLowerCase());
    if (diff.length > 0) {
      if (!toBranch || toBranch.trim().toLowerCase() === fromBranch.trim().toLowerCase() || !activeBranches.some(b => b.toLowerCase() === toBranch.toLowerCase())) {
        const chosen = diff[0];
        setToBranch(chosen);
        if (movementType === 'Inter-Location Transfer' || movementType === 'Inter-Branch Transfer') {
          setParty(chosen);
        }
      }
    } else if (activeBranches.length > 0 && !toBranch) {
      setToBranch(activeBranches[0]);
    }
  }, [fromBranch, activeBranches, movementType, toBranch]);

  const handleMovementTypeChange = (newType: MovementType) => {
    setMovementType(newType);
    if (newType === 'Inter-Location Transfer' || newType === 'Inter-Branch Transfer') {
      const destination = activeBranches.find(b => b.trim().toLowerCase() !== fromBranch.trim().toLowerCase()) || activeBranches[0] || '';
      setToBranch(destination);
      setParty(destination);
      setPurpose('Inter-Location Transfer');
    } else if (newType === 'Repair / Maintenance') {
      setPurpose('Contractor Repair');
      if (party === toBranch) setParty('');
    } else if (newType === 'Customer / Sale') {
      setPurpose('Finished goods / Sale');
      if (party === toBranch) setParty('');
    } else if (party === toBranch) {
      setParty('');
    }
  };
  const [party, setParty] = useState('');
  const [vehicleType, setVehicleType] = useState('Truck');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driver, setDriver] = useState('');
  const [driverId, setDriverId] = useState('');
  const [docType, setDocType] = useState('Gate pass');
  const [docNo, setDocNo] = useState('');
  const [amount, setAmount] = useState('');
  const [poNo, setPoNo] = useState('');
  const [authorisedBy, setAuthorisedBy] = useState('');
  const [dept, setDept] = useState('');
  const [person, setPerson] = useState('');
  const [weight, setWeight] = useState('');
  const [packages, setPackages] = useState('');
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

  const [attachedPhotos, setAttachedPhotos] = useState<LocalPhoto[]>([]);
  const [autoPrint, setAutoPrint] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate sequential entry code on open
  useEffect(() => {
    fetch('/api/entries/next-code')
      .then(res => res.json())
      .then(data => {
        if (data.code) setEntryCode(data.code);
      })
      .catch(console.error);
  }, []);

  // Sync user name into guardName if not yet set
  useEffect(() => {
    if (!guardName && user?.name) {
      setGuardName(user.name);
    }
  }, [user]);

  const addItemRow = () => {
    setItems(prev => [...prev, { desc: '', qty: '', unit: 'Cartons' }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
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
            id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            dataUrl: optimized.dataUrl,
            note: `Camera photo #${prev.length + 1}`,
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
              id: `photo-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              dataUrl,
              note: `Camera photo #${prev.length + 1}`,
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

    if (!guardName.trim()) {
      setErrorMessage('Please enter the guard name manually.');
      return;
    }

    const isInterLocationTransfer = movementType === 'Inter-Location Transfer' || movementType === 'Inter-Branch Transfer';

    if (!party.trim() && !isInterLocationTransfer) {
      setErrorMessage('Enter where the material is going (Recipient/Party).');
      return;
    }

    if (isInterLocationTransfer) {
      if (!toBranch.trim()) {
        setErrorMessage('Please select a destination (To Location).');
        return;
      }
      if (fromBranch.trim().toLowerCase() === toBranch.trim().toLowerCase()) {
        setErrorMessage('From Location and To Location cannot be the same. Please select a different destination location.');
        return;
      }
    }

    if (vehicleType !== 'Hand carried' && !vehicleNo.trim()) {
      setErrorMessage('Enter the vehicle number (or select "Hand carried").');
      return;
    }

    if (returnable && !expectedReturn) {
      setErrorMessage('Enter the expected return date for a returnable item.');
      return;
    }

    const validItems = items.filter(i => i.desc.trim() && Number(i.qty) > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please enter at least one item description and quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const actualParty = isInterLocationTransfer ? toBranch.trim() : party.trim();

      const payload = {
        code: entryCode.trim() || undefined,
        dir: 'OUT',
        movement_type: movementType,
        from_branch: isInterLocationTransfer ? fromBranch.trim() : undefined,
        to_branch: isInterLocationTransfer ? toBranch.trim() : undefined,
        inter_branch_details: isInterLocationTransfer ? {
          from_branch: fromBranch.trim(),
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
        location: isInterLocationTransfer ? fromBranch.trim() : (location || 'Estate 1'),
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
        amount: amount ? Number(amount) : null,
        po_no: poNo.trim(),
        authorised_by: authorisedBy.trim(),
        dept: dept.trim(),
        person: person.trim(),
        weight: weight ? Number(weight) : null,
        packages: packages ? Number(packages) : null,
        remarks: remarks.trim(),
        returnable,
        expected_return: returnable ? expectedReturn : null,
        items: validItems.map(i => ({ desc: i.desc.trim(), qty: Number(i.qty), unit: i.unit })),
        photos: attachedPhotos.map(p => ({ data_url: p.dataUrl, note: p.note, mime: p.mime }))
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
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save dispatch entry');
      }

      // If auto-print enabled, trigger Bluetooth or regular print
      if (autoPrint) {
        try {
          await printGatePass({
            code: data.code,
            dir: 'OUT',
            gate: user?.gate || 'Main Gate',
            guard_name: guardName.trim(),
            party: party.trim(),
            vehicle_no: vehicleNo.trim().toUpperCase(),
            vehicle_type: vehicleType,
            driver: driver.trim(),
            driver_id: driverId.trim(),
            doc_type: docType,
            doc_no: docNo.trim(),
            dept: dept.trim(),
            authorised_by: authorisedBy.trim(),
            returnable,
            expected_return: returnable ? expectedReturn : null,
            items: validItems.map(i => ({ desc: i.desc.trim(), qty: Number(i.qty), unit: i.unit })),
            remarks: remarks.trim()
          });
        } catch (printErr) {
          console.warn('Print trigger error:', printErr);
        }
      }

      navigate(`/e/${data.code}?new=1`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving outward entry');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageMotion className="w-full space-y-5 pb-16">
      {/* Hidden camera input for direct native phone camera capture (supports multiple photos) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCaptureImage}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dde1e6] pb-3">
        <h1 className="text-xl sm:text-2xl font-bold text-[#1d4ed8] flex items-center gap-2">
          <span>⬆</span>
          <span>Material OUT</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Dispatch Facility:</span>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 font-bold text-xs flex items-center gap-1.5 shadow-xs">
            <span>📍</span>
            <span>{location}</span>
          </span>
        </div>
      </div>

      {/* Location-specific banner */}
      <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-blue-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center text-xl shrink-0">
            🏢
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
              {queryLocation ? 'Location Material OUT Dispatch Form' : 'Active Facility Dispatch Point'}
            </div>
            <div className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>{location}</span>
              <span className="text-[11px] font-semibold bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded border border-emerald-400/40">
                Live Terminal
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-blue-200 font-semibold whitespace-nowrap">Switch Location:</label>
          <select
            value={location}
            onChange={e => {
              const newLoc = e.target.value;
              setLocation(newLoc);
              setFromBranch(newLoc);
              const other = activeBranches.find(b => b.trim().toLowerCase() !== newLoc.trim().toLowerCase()) || 'Kamonki';
              setToBranch(other);
            }}
            className="bg-white/20 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/30 focus:outline-hidden focus:bg-slate-900 cursor-pointer"
          >
            {activeBranches.map(b => (
              <option key={b} value={b} className="text-slate-900">{b}</option>
            ))}
          </select>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-[#fdecec] text-[#b91c1c] text-sm font-semibold border border-[#efa5a5]">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Entry Details Card */}
        <Card3D variant="out" className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Movement Type Section */}
          <div className="p-3.5 sm:p-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="form-label text-xs sm:text-sm font-bold text-blue-950 flex items-center gap-1.5">
                  <span>🚛</span>
                  <span>Movement Type (نقل و حرکت کی قسم)</span>
                  <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  value={movementType}
                  onChange={e => handleMovementTypeChange(e.target.value as MovementType)}
                  className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border-2 border-blue-400 rounded-lg focus:border-blue-600 focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-bold text-slate-900 shadow-xs"
                >
                  {MOVEMENT_TYPES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* If Inter-Location Transfer, display From Location & To Location */}
              {(movementType === 'Inter-Location Transfer' || movementType === 'Inter-Branch Transfer') ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>From Location (روانہ کرنے کا مقام)</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">Auto · Current Location</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={fromBranch}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-800 cursor-not-allowed min-h-[38px]"
                    />
                  </div>

                  <div>
                    <label className="form-label text-xs font-bold text-blue-950 flex items-center justify-between">
                      <span>To Location (منزل / وصول کنندہ مقام) <span className="text-[#b91c1c]">*</span></span>
                      <span className="text-[10px] text-blue-600 font-semibold">Different Location</span>
                    </label>
                    <select
                      value={toBranch}
                      onFocus={fetchLocations}
                      onChange={e => {
                        const val = e.target.value;
                        setToBranch(val);
                        setParty(val);
                      }}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-white border-2 border-blue-500 rounded-lg font-bold text-blue-900 focus:outline-hidden min-h-[38px]"
                    >
                      {activeBranches
                        .filter(b => b.trim().toLowerCase() !== fromBranch.trim().toLowerCase())
                        .map(b => (
                          <option key={b} value={b}>📍 {b}</option>
                        ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-blue-800 bg-white/70 p-2.5 rounded-lg border border-blue-100 hidden sm:block">
                  {movementType === 'Repair / Maintenance' && (
                    <span>🔧 <strong>Repair / Maintenance:</strong> Dispatched to outside workshop / vendor. Check <em>Returnable Material</em> below to track return lifecycle.</span>
                  )}
                  {movementType === 'External / Supplier' && (
                    <span>🏢 <strong>External / Supplier:</strong> Normal material outward dispatch to vendor or partner.</span>
                  )}
                  {movementType === 'Customer / Sale' && (
                    <span>💼 <strong>Customer / Sale:</strong> Finished goods dispatch to customer.</span>
                  )}
                  {movementType === 'Other' && (
                    <span>📦 <strong>Other Movement:</strong> General material movement outside premises.</span>
                  )}
                </div>
              )}
            </div>

            {(movementType === 'Inter-Location Transfer' || movementType === 'Inter-Branch Transfer') && (
              <div className="text-xs text-blue-900 bg-white/90 p-2.5 rounded-lg border border-blue-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-blue-950">
                  <span>🔔</span>
                  <span>Automatic Location Notification Enabled</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Upon dispatch, <strong>{toBranch}</strong> security & managers will immediately receive an automated inward notification and gate pass tracking.
                  {returnable
                    ? ' Since material is RETURNABLE, it will remain in PENDING RETURN status at destination until returned back.'
                    : ' Non-returnable transfer will automatically mark COMPLETED upon destination receipt verification.'}
                </p>
              </div>
            )}
          </div>

          {/* Top Row: Auto-Generated Sequential Entry Code (Read-Only) & Manual Guard Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">
                Entry Code
              </label>
              <input
                type="text"
                readOnly
                value={entryCode || ''}
                placeholder="000001"
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-gray-100 border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-mono font-extrabold text-[#1d4ed8] cursor-not-allowed select-all"
              />
            </div>

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
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-semibold text-[#1b1f24] focus:border-[#1d4ed8] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="form-label">
                Purpose <span className="text-[#b91c1c]">*</span>
              </label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#1d4ed8] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
              >
                {OUT_PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Party & Vehicle Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="form-label">
                {movementType === 'Repair / Maintenance'
                  ? 'Dispatched To / Repair Vendor'
                  : movementType === 'Inter-Branch Transfer'
                  ? 'Destination Branch'
                  : movementType === 'Customer / Sale'
                  ? 'Customer / Sale Recipient'
                  : 'Recipient / Dispatched To'} <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                disabled={movementType === 'Inter-Branch Transfer'}
                placeholder={
                  movementType === 'Repair / Maintenance'
                    ? 'e.g. ABC Engineering Workshop'
                    : movementType === 'Inter-Branch Transfer'
                    ? toBranch
                    : 'e.g. Siemens Industrial Automation'
                }
                value={movementType === 'Inter-Branch Transfer' ? toBranch : party}
                onChange={e => setParty(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#1d4ed8] focus:outline-hidden min-h-[46px] sm:min-h-[38px] disabled:bg-slate-100 disabled:font-bold disabled:text-blue-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#1d4ed8] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                >
                  {VEHICLE_TYPES.map(vt => (
                    <option key={vt} value={vt}>{vt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">
                  Vehicle No <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required={vehicleType !== 'Hand carried'}
                  placeholder="e.g. RIR-6720"
                  value={vehicleNo}
                  onChange={e => setVehicleNo(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono uppercase focus:border-[#1d4ed8] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                />
              </div>
            </div>
          </div>

          {/* Returnable Toggle Box */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-300 bg-amber-50/70 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="out-returnable-toggle"
                checked={returnable}
                onChange={e => setReturnable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="out-returnable-toggle" className="text-sm font-bold text-amber-900 cursor-pointer">
                🔄 Returnable Material (Item will come back to factory)
              </label>
            </div>

            {returnable && (
              <div className="pt-2 border-t border-amber-200">
                <label className="form-label text-amber-950">
                  Expected Return Date <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="date"
                  required={returnable}
                  value={expectedReturn}
                  onChange={e => setExpectedReturn(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-amber-300 rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
                />
              </div>
            )}
          </div>

          {/* Driver & Document Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Driver Name</label>
              <input
                type="text"
                placeholder="Driver full name"
                value={driver}
                onChange={e => setDriver(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Driver CNIC / Mobile</label>
              <input
                type="text"
                placeholder="35201-xxxxxxx-x"
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
                {DOC_TYPES.map(dt => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Gate Pass / Challan No</label>
              <input
                type="text"
                placeholder="Pass or Challan No"
                value={docNo}
                onChange={e => setDocNo(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          {/* Authorised By, Department, PO */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Authorised By (Manager / HOD)</label>
              <input
                type="text"
                placeholder="e.g. Maintenance Manager Engr. Bilal"
                value={authorisedBy}
                onChange={e => setAuthorisedBy(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Originating Department</label>
              <input
                type="text"
                placeholder="e.g. Engineering & Maintenance"
                value={dept}
                onChange={e => setDept(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Work Order / PO No</label>
              <input
                type="text"
                placeholder="e.g. WO-2026-44"
                value={poNo}
                onChange={e => setPoNo(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="pt-2 border-t border-[#dde1e6]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="font-bold text-sm sm:text-base text-[#1b1f24] block">
                  Material Items List <span className="text-[#b91c1c]">*</span>
                </label>
              </div>
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={addItemRow}
                className="font-bold text-[#1d4ed8]"
              >
                + Add Item
              </Button3D>
            </div>

            {/* Responsive Table / Card View for items */}
            <div className="space-y-3 sm:space-y-0 sm:border sm:border-[#dde1e6] sm:rounded-lg sm:overflow-hidden bg-white">
              <table className="hidden sm:table w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] font-semibold uppercase text-[11px]">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 w-32">Qty</th>
                    <th className="py-2.5 px-3 w-36">Unit</th>
                    <th className="py-2.5 px-2 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde1e6]">
                  {items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-[#5f6b7a] font-mono">{index + 1}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          required
                          placeholder="e.g. High Pressure Water Pump Motor 45kW"
                          value={item.desc}
                          onChange={e => updateItem(index, 'desc', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#c5ccd4] rounded-md"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="any"
                          required
                          placeholder="0"
                          value={item.qty}
                          onChange={e => updateItem(index, 'qty', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#c5ccd4] rounded-md font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.unit}
                          onChange={e => updateItem(index, 'unit', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#c5ccd4] rounded-md"
                        >
                          {COMMON_UNITS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length <= 1}
                          className="px-2.5 py-1.5 bg-[#f3f4f6] text-[#b91c1c] rounded-md hover:bg-[#fdecec] text-sm font-bold disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card view for items */}
              <div className="sm:hidden space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="p-3 border border-[#dde1e6] rounded-lg bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1d4ed8]">Item #{index + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="text-xs text-red-600 font-bold px-2 py-1 bg-red-50 rounded-md"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        required
                        placeholder="Item Description"
                        value={item.desc}
                        onChange={e => updateItem(index, 'desc', e.target.value)}
                        className="w-full px-3 py-2 text-base bg-white border border-[#c5ccd4] rounded-lg min-h-[46px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Quantity"
                        value={item.qty}
                        onChange={e => updateItem(index, 'qty', e.target.value)}
                        className="w-full px-3 py-2 text-base bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] font-mono"
                      />
                      <select
                        value={item.unit}
                        onChange={e => updateItem(index, 'unit', e.target.value)}
                        className="w-full px-3 py-2 text-base bg-white border border-[#c5ccd4] rounded-lg min-h-[46px]"
                      >
                        {COMMON_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weight, Packages, Person, Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#dde1e6]">
            <div>
              <label className="form-label">Total Weight (KG)</label>
              <input
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Packages Count</label>
              <input
                type="number"
                value={packages}
                onChange={e => setPackages(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[46px] sm:min-h-[38px]"
              />
            </div>

            <div>
              <label className="form-label">Handed Over By (Person)</label>
              <input
                type="text"
                placeholder="e.g. Engr. Bilal Maintenance"
                value={person}
                onChange={e => setPerson(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Remarks / Gate Note</label>
            <input
              type="text"
              placeholder="e.g. Motor armature rewinding under warranty"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px]"
            />
          </div>
        </Card3D>

        {/* =========================================================================
            CAPTURE IMAGE SECTION (PLACED ONLY DIRECTLY ABOVE SAVE BUTTON IN FORM)
            ========================================================================= */}
        <Card3D className="p-4 sm:p-5 space-y-3 bg-white border-2 border-dashed border-[#1d4ed8]/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="font-bold text-sm sm:text-base text-[#1b1f24] flex items-center gap-2">
              <span>📷</span>
              <span>Capture Images</span>
              {attachedPhotos.length > 0 && (
                <span className="text-xs bg-[#1d4ed8] text-white px-2 py-0.5 rounded-full font-mono">
                  {attachedPhotos.length} photo{attachedPhotos.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <Button3D
              type="button"
              variant="sec"
              size="md"
              onClick={() => cameraInputRef.current?.click()}
              className="font-bold text-[#1d4ed8] border-[#1d4ed8] flex items-center justify-center gap-2 py-3"
            >
              <span>📷</span>
              <span>Capture Image from Camera</span>
            </Button3D>
          </div>

          {/* Captured Photos Gallery Thumbnails */}
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

        {/* Print Option Checkbox */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#1b1f24] px-1">
          <input
            id="out-auto-print"
            type="checkbox"
            checked={autoPrint}
            onChange={e => setAutoPrint(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#1d4ed8] focus:ring-[#1d4ed8]"
          />
          <label htmlFor="out-auto-print" className="cursor-pointer font-semibold">
            🖨️ Automatically print gate pass label upon saving
          </label>
        </div>

        {/* Big 3D Save Button */}
        <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }}>
          <Button3D
            type="submit"
            variant="out"
            size="xl"
            disabled={isSubmitting}
            className="w-full font-extrabold text-base sm:text-lg py-4"
          >
            {isSubmitting ? 'SAVING OUTWARD ENTRY...' : '✔ SAVE OUTWARD ENTRY'}
          </Button3D>
        </motion.div>
      </form>
    </PageMotion>
  );
};
