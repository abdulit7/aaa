import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GateEntry } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';
import { optimizeMobileImage } from '../utils/imageOptimizer';

interface ItemRow {
  desc: string;
  qty: string;
  unit: string;
}

const COMMON_UNITS = ['Pcs', 'Cartons', 'Bags', 'KG', 'Boxes', 'Sets', 'Drums', 'Tons', 'Litre', 'Rolls', 'Bundles', 'Pallets'];
const HAND_PURPOSES = ['Purchase', 'Sample', 'Personal', 'Other'] as const;
const HAND_DOC_TYPES = ['Invoice', 'Bilty', 'No document'] as const;
const PURCHASE_VEHICLE_TYPES = ['Mazda / Shehzore', 'Pickup / Loader', 'Truck', 'Rickshaw / Loader rickshaw', 'Van / Carry', 'Car', 'Motorcycle', 'Other'] as const;

const QUICK_DEPTS = [
  'Production Flour Unit',
  'Engineering / Workshop',
  'Electrical & Maintenance',
  'Packaging & Printing',
  'General Store',
  'Quality Control / Lab',
  'Admin & Accounts',
  'Other'
];

interface LocalPhoto {
  id: string;
  dataUrl: string;
  note: string;
  mime: string;
}

export const PurchaseInPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [entryCode, setEntryCode] = useState('');
  const [guardName, setGuardName] = useState(user?.name || '');
  const [gate, setGate] = useState(user?.gate || 'Main Gate');
  const [location, setLocation] = useState(user?.location || 'Estate 1');

  // Purpose state
  const [purpose, setPurpose] = useState<string>('Purchase');
  const [personalPurpose, setPersonalPurpose] = useState('');
  const [otherPurpose, setOtherPurpose] = useState('');

  // Supplier / Coming From
  const [party, setParty] = useState('');

  // Material Brought By selection
  const [broughtBy, setBroughtBy] = useState<'purchaser' | 'vehicles'>('purchaser');

  // If Purchaser
  const [purchaserName, setPurchaserName] = useState('');
  const [knownPurchasers, setKnownPurchasers] = useState<string[]>([]);

  // If Vehicle
  const [vehicleType, setVehicleType] = useState('Mazda / Shehzore');
  const [vehicleNo, setVehicleNo] = useState('');
  const [driver, setDriver] = useState('');
  const [driverId, setDriverId] = useState('');

  // Document details
  const [docType, setDocType] = useState<string>('Invoice');
  const [docNo, setDocNo] = useState('');
  const [amount, setAmount] = useState('');

  // Department & Person
  const [dept, setDept] = useState('General Store');
  const [person, setPerson] = useState('');
  const [remarks, setRemarks] = useState('');

  // Items verification list
  const [items, setItems] = useState<ItemRow[]>([
    { desc: '', qty: '', unit: 'Pcs' }
  ]);

  const [attachedPhotos, setAttachedPhotos] = useState<LocalPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [knownParties, setKnownParties] = useState<string[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    if (user?.gate) setGate(user.gate);
    if (user?.location) setLocation(user.location);
    if (!guardName && user?.name) setGuardName(user.name);
  }, [user]);

  // Auto-generate sequential entry code on open
  useEffect(() => {
    fetch('/api/entries/next-code')
      .then(res => res.json())
      .then(data => {
        if (data.code) setEntryCode(data.code);
      })
      .catch(console.error);

    fetch('/api/entries')
      .then(res => res.json())
      .then((data: GateEntry[]) => {
        const parties = Array.from(new Set(data.map(e => e.party))).filter(Boolean);
        setKnownParties(parties);
        const purchasers = Array.from(
          new Set(
            data
              .map(e => e.purchaser_name || (e.inward_type === 'purchaser_hand' ? e.person : ''))
              .filter(Boolean)
          )
        );
        setKnownPurchasers(purchasers);
      })
      .catch(console.error);
  }, []);

  // Check duplicates for docNo and party
  useEffect(() => {
    if (!docNo.trim() || !party.trim() || docType === 'No document') {
      setDuplicateWarning(null);
      return;
    }
    const cleanDoc = docNo.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const cleanParty = party.toLowerCase().replace(/[^a-z0-9]/g, '');

    fetch(`/api/entries?q=${encodeURIComponent(docNo.trim())}`)
      .then(res => res.json())
      .then((entries: GateEntry[]) => {
        const matches = entries.filter(e => {
          const eDoc = (e.doc_no || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const eParty = e.party.toLowerCase().replace(/[^a-z0-9]/g, '');
          return eDoc === cleanDoc && eParty === cleanParty && !e.cancelled;
        });
        if (matches.length > 0) {
          setDuplicateWarning(`Document number already entered in: ${matches[0].code} (${matches[0].at.slice(0, 10)})`);
        } else {
          setDuplicateWarning(null);
        }
      })
      .catch(() => setDuplicateWarning(null));
  }, [docNo, party, docType]);

  const addItemRow = () => {
    setItems(prev => [...prev, { desc: '', qty: '', unit: 'Pcs' }]);
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
            note: `Bill/Parcel photo #${prev.length + 1}`,
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
              note: `Bill/Parcel photo #${prev.length + 1}`,
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

    // 1. Guard name validation (must be manually entered)
    if (!guardName.trim()) {
      setErrorMessage('Duty Guard Name is empty. The gate guard must type their name manually.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Material Brought By validation
    if (broughtBy === 'purchaser') {
      if (!purchaserName.trim()) {
        setErrorMessage('Please enter Purchaser Name (خریدار کا نام).');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } else {
      if (!vehicleNo.trim()) {
        setErrorMessage('Please enter Vehicle Number (گاڑی کا نمبر).');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!driver.trim()) {
        setErrorMessage('Please enter Driver Name (ڈرائیور کا نام).');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // 3. Supplier / Coming from
    if (!party.trim()) {
      setErrorMessage('Please enter Supplier / Coming From (کہاں سے خریدا یا لایا گیا).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 4. Purpose specific validation
    if (purpose === 'Personal' && !personalPurpose.trim()) {
      setErrorMessage('Please specify the details for Personal Purpose.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (purpose === 'Other' && !otherPurpose.trim()) {
      setErrorMessage('Please specify the details for Other Purpose.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!person.trim()) {
      setErrorMessage('Please enter who this material is received for (Received By / For Person).');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 5. Items validation
    const validItems = items.filter(i => i.desc.trim() && Number(i.qty) > 0);
    if (validItems.length === 0) {
      setErrorMessage('Please enter at least one verified item description and counted quantity.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    const actualPurpose =
      purpose === 'Personal'
        ? `Personal: ${personalPurpose.trim()}`
        : purpose === 'Other'
        ? `Other: ${otherPurpose.trim()}`
        : purpose;

    const isVehicle = broughtBy === 'vehicles';

    const payload = {
      code: entryCode.trim() || undefined,
      dir: 'IN' as const,
      inward_type: isVehicle ? ('vehicle' as const) : ('purchaser_hand' as const),
      gate: gate || 'Main Gate',
      location: location || 'Estate 1',
      device_type: user?.device_type || 'web',
      guard_name: guardName.trim(),
      party: party.trim(),
      purchaser_name: isVehicle ? '' : purchaserName.trim(),
      vehicle_type: isVehicle ? vehicleType : 'Hand carried',
      vehicle_no: isVehicle ? vehicleNo.trim().toUpperCase() : 'Hand carried',
      driver: isVehicle ? driver.trim() : purchaserName.trim(),
      driver_id: isVehicle ? driverId.trim() : '',
      doc_type: docType,
      doc_no: docType === 'No document' ? '' : docNo.trim(),
      amount: amount ? Number(amount) : null,
      po_no: '',
      dept: dept.trim(),
      person: person.trim(),
      weight: null,
      packages: validItems.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0) || null,
      purpose: actualPurpose,
      returnable: false,
      expected_return: null,
      items: validItems.map(i => ({
        desc: i.desc.trim(),
        qty: Number(i.qty),
        unit: i.unit
      })),
      remarks: remarks.trim(),
      photos: attachedPhotos.map(p => ({
        dataUrl: p.dataUrl,
        note: p.note,
        mime: p.mime
      }))
    };

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save hand-carried material entry');
      }
      const data = await res.json();

      // Automatically navigate to Entry Details with tag=1 to open Material Tag Print Preview!
      navigate(`/e/${data.code}?new=1&tag=1`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred while saving entry');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageMotion className="w-full space-y-4 sm:space-y-5 pb-16">
      {/* Hidden camera input for direct native phone camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleCaptureImage}
      />

      {/* Header Bar */}
      <div className="flex items-center gap-2 border-b border-[#dde1e6] pb-3.5">
        <span className="text-2xl">🛍️</span>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f766e]">
          Purchase
        </h1>
      </div>

      {/* Error & Warning Messages */}
      {errorMessage && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#fdecec] text-[#b91c1c] text-xs sm:text-sm font-semibold border border-[#efa5a5]">
          {errorMessage}
        </div>
      )}

      {duplicateWarning && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-[#fdf6e3] text-[#9a6700] text-xs sm:text-sm font-semibold border border-[#f59e0b]">
          {duplicateWarning}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Card3D variant="purchase" className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 border-2 border-[#0f766e]">
          {/* Row 1: Entry Code & Duty Guard Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="form-label text-xs sm:text-sm">
                Entry Code
              </label>
              <input
                type="text"
                readOnly
                value={entryCode || ''}
                placeholder="000001"
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-gray-100 border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] font-mono font-extrabold text-[#0f766e] cursor-not-allowed select-all"
              />
            </div>

            <div>
              <label className="form-label text-xs sm:text-sm">
                Guard Name <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter duty guard name..."
                value={guardName}
                onChange={e => setGuardName(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border-2 border-[#0f766e] rounded-lg min-h-[46px] sm:min-h-[38px] font-bold text-[#1b1f24] focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Row 2: Purpose & Dynamic Purpose Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="form-label text-xs sm:text-sm">
                  Purpose <span className="text-[#b91c1c]">*</span>
                </label>
                <select
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-semibold"
                >
                  {HAND_PURPOSES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Conditional Personal Purpose Details */}
              {purpose === 'Personal' && (
                <div>
                  <label className="form-label text-xs sm:text-sm">
                    Personal Purpose Details <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Employee personal tiffin / medicine / book..."
                    value={personalPurpose}
                    onChange={e => setPersonalPurpose(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-amber-50 border-2 border-amber-400 rounded-lg min-h-[46px] sm:min-h-[38px] font-medium text-amber-950 focus:outline-hidden"
                  />
                </div>
              )}

              {/* Conditional Other Purpose Details */}
              {purpose === 'Other' && (
                <div>
                  <label className="form-label text-xs sm:text-sm">
                    Other Purpose Details <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Donation / Temporary trial / Gift item..."
                    value={otherPurpose}
                    onChange={e => setOtherPurpose(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-amber-50 border-2 border-amber-400 rounded-lg min-h-[46px] sm:min-h-[38px] font-medium text-amber-950 focus:outline-hidden"
                  />
                </div>
              )}

              {/* If Purchase or Sample: show Supplier field in this row */}
              {(purpose === 'Purchase' || purpose === 'Sample') && (
                <div>
                  <label className="form-label text-xs sm:text-sm">
                    Supplier / Coming From <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="hand-parties-list"
                    placeholder="e.g. Allied Traders / City Market"
                    value={party}
                    onChange={e => setParty(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                  />
                  <datalist id="hand-parties-list">
                    {knownParties.map(p => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>

            {/* If Personal or Other, render Supplier/Origin on its own line */}
            {(purpose === 'Personal' || purpose === 'Other') && (
              <div>
                <label className="form-label text-xs sm:text-sm">
                  Supplier / Origin <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brought from Home / Market / Vendor Name"
                  value={party}
                  onChange={e => setParty(e.target.value)}
                  className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                />
              </div>
            )}
          </div>

          {/* Row 3: Material Brought By & Document Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="form-label text-xs sm:text-sm font-bold text-[#0f766e]">
                Material Brought By (سامان کون لایا) <span className="text-[#b91c1c]">*</span>
              </label>
              <select
                value={broughtBy}
                onChange={e => setBroughtBy(e.target.value as 'purchaser' | 'vehicles')}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border-2 border-[#0f766e] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-bold text-slate-900"
              >
                <option value="purchaser">🛍️ Purchaser</option>
                <option value="vehicles">🚚 Vehicles</option>
              </select>
            </div>

            <div>
              <label className="form-label text-xs sm:text-sm">
                Document Type <span className="text-[#b91c1c]">*</span>
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
              >
                {HAND_DOC_TYPES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional: If Purchaser, show Purchaser Name field */}
          {broughtBy === 'purchaser' && (
            <div className="p-3.5 sm:p-4 bg-teal-50/70 border border-teal-200 rounded-xl space-y-2">
              <label className="form-label text-xs sm:text-sm font-bold text-[#0f766e]">
                Purchaser Name (خریدار کا نام) <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                list="hand-purchasers-list"
                placeholder="e.g. Tariq Mehmood (Purchaser) / Buyer Name"
                value={purchaserName}
                onChange={e => setPurchaserName(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border-2 border-[#0f766e] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-bold text-slate-900"
              />
              <datalist id="hand-purchasers-list">
                {knownPurchasers.map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <p className="text-[11px] text-teal-800">
                Staff member or buyer bringing the purchased items into the facility by hand.
              </p>
            </div>
          )}

          {/* Conditional: If Vehicles, show Vehicle Type, Vehicle Number, Driver Name, Driver CNIC / Mobile */}
          {broughtBy === 'vehicles' && (
            <div className="p-3.5 sm:p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3 sm:space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 border-b border-blue-200 pb-1.5">
                <span>🚚</span>
                <span>Vehicle & Driver Information (گاڑی اور ڈرائیور کی معلومات)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="form-label text-xs sm:text-sm font-semibold text-slate-800">
                    Vehicle Type <span className="text-[#b91c1c]">*</span>
                  </label>
                  <select
                    value={vehicleType}
                    onChange={e => setVehicleType(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-medium"
                  >
                    {PURCHASE_VEHICLE_TYPES.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs sm:text-sm font-semibold text-slate-800">
                    Vehicle Number (گاڑی کا نمبر) <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LES-19-4821 / KHI-9912"
                    value={vehicleNo}
                    onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-mono uppercase font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="form-label text-xs sm:text-sm font-semibold text-slate-800">
                    Driver Name (ڈرائیور کا نام) <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Muhammad Aslam / Driver Name"
                    value={driver}
                    onChange={e => setDriver(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                  />
                </div>

                <div>
                  <label className="form-label text-xs sm:text-sm font-semibold text-slate-800">
                    Driver CNIC or Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 35201-1234567-1 / 0300-1234567"
                    value={driverId}
                    onChange={e => setDriverId(e.target.value)}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Invoice / Bill / Bilty Number & Bill Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="form-label text-xs sm:text-sm">
                Invoice / Bill / Bilty Number
              </label>
              <input
                type="text"
                disabled={docType === 'No document'}
                placeholder={docType === 'No document' ? 'No document available' : 'e.g. INV-98721'}
                value={docType === 'No document' ? '' : docNo}
                onChange={e => setDocNo(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="form-label text-xs sm:text-sm">
                Bill Amount (Rs.) <span className="text-[#b91c1c]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rs.</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 4500"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-mono font-bold text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Department */}
          <div>
            <label className="form-label text-xs sm:text-sm">
              Department / Section <span className="text-[#b91c1c]">*</span>
            </label>
            <input
              type="text"
              required
              list="hand-depts-list"
              placeholder="e.g. Engineering / Workshop"
              value={dept}
              onChange={e => setDept(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-semibold"
            />
            <datalist id="hand-depts-list">
              {QUICK_DEPTS.map(d => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {QUICK_DEPTS.slice(0, 4).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDept(d)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    dept === d
                      ? 'bg-[#0f766e] text-white border-[#0f766e]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Row 5: Material Items List */}
          <div className="space-y-3 pt-2 border-t border-[#dde1e6]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="form-label block text-xs sm:text-sm font-bold text-[#0f766e]">
                Material Items List <span className="text-[#b91c1c]">*</span>
              </label>
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={addItemRow}
                className="font-bold text-[#0f766e]"
              >
                + Add Item
              </Button3D>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-teal-50/40 p-2.5 sm:p-3 rounded-lg border border-teal-200/80 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 sm:items-center"
                >
                  <div className="flex items-center justify-between sm:col-span-1">
                    <span className="font-mono font-bold text-xs text-teal-800">#{idx + 1}</span>
                    {/* Mobile remove button */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="sm:hidden text-xs text-red-600 font-bold px-2 py-0.5 rounded bg-red-50 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      required
                      placeholder="Item Description (e.g. V-Belt B-48 / Bearing 6205 / Sample sugar)"
                      value={item.desc}
                      onChange={e => updateItem(idx, 'desc', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-md focus:border-[#0f766e] focus:outline-hidden font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="any"
                        required
                        placeholder="Count"
                        value={item.qty}
                        onChange={e => updateItem(idx, 'qty', e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-[#c5ccd4] rounded-md font-mono font-bold text-center focus:border-[#0f766e] focus:outline-hidden"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <select
                        value={item.unit}
                        onChange={e => updateItem(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-2 text-xs bg-white border border-[#c5ccd4] rounded-md focus:border-[#0f766e] focus:outline-hidden font-medium"
                      >
                        {COMMON_UNITS.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="hidden sm:block sm:col-span-1 text-center">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="w-7 h-7 mx-auto rounded-full text-red-600 hover:bg-red-100 flex items-center justify-center font-bold text-sm cursor-pointer"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 6: Received By & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2 border-t border-[#dde1e6]">
            <div>
              <label className="form-label text-xs sm:text-sm">
                Received By (Person) <span className="text-[#b91c1c]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Aslam Mechanical / Store Incharge"
                value={person}
                onChange={e => setPerson(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px] font-semibold"
              />
            </div>

            <div>
              <label className="form-label text-xs sm:text-sm">
                Remarks
              </label>
              <input
                type="text"
                placeholder="Notes or remarks..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg focus:border-[#0f766e] focus:outline-hidden min-h-[46px] sm:min-h-[38px]"
              />
            </div>
          </div>

          {/* Row 7: Attach Photo */}
          <div className="pt-2 border-t border-[#dde1e6] space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                Attached Photo
              </span>

              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                className="font-bold text-[#0f766e]"
              >
                <span>📷</span>
                <span>Take / Attach Photo</span>
              </Button3D>
            </div>

            {attachedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachedPhotos.map((photo, idx) => (
                  <div key={photo.id} className="relative w-20 sm:w-24 h-16 sm:h-20 rounded-lg overflow-hidden border border-[#c5ccd4] shadow-xs">
                    <img src={photo.dataUrl} alt="Capture" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setAttachedPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-red-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save & Print Material Tag Action Button */}
          <div className="pt-4 border-t border-[#dde1e6]">
            <Button3D
              type="submit"
              variant="purchase"
              size="lg"
              disabled={isSubmitting}
              className="w-full py-3.5 sm:py-4 text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <span>💾</span>
              <span>{isSubmitting ? 'Saving & Generating Tag...' : 'Save & Print Material Tag'}</span>
            </Button3D>
          </div>
        </Card3D>
      </form>
    </PageMotion>
  );
};
