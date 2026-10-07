import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { GateEntry, GatePhoto, AuditLog } from '../types';
import { downloadGateSlipPDF, downloadThermalLabelPDF } from '../components/pdf/pdfGenerator';
import { OutgoingGatePassModal } from '../components/pdf/OutgoingGatePassModal';
import { MaterialTagModal } from '../components/pdf/MaterialTagModal';
import { printGatePass, isMobileDevice, isBluetoothConnected } from '../utils/bluetoothPrinter';
import { useAuth } from '../context/AuthContext';
import { Card3D, StatusBadge, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { motion } from 'motion/react';

export const EntryDetailPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === '1';
  const { user, isSupervisor } = useAuth();

  const [entry, setEntry] = useState<GateEntry | null>(null);
  const [photos, setPhotos] = useState<GatePhoto[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewPhoto, setPreviewPhoto] = useState<GatePhoto | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(searchParams.get('tag') === '1');

  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [corrField, setCorrField] = useState('vehicle_no');
  const [corrNewValue, setCorrNewValue] = useState('');
  const [corrReason, setCorrReason] = useState('');

  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const directCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Inter-Branch Transfer workflow state & modals
  const [isAckModalOpen, setIsAckModalOpen] = useState(false);
  const [ackGuard, setAckGuard] = useState(user?.name || '');
  const [ackGate, setAckGate] = useState(user?.gate || 'Main Gate');
  const [ackRemarks, setAckRemarks] = useState('');
  const [ackQuantities, setAckQuantities] = useState<{ [itemId: string]: number }>({});

  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnBy, setReturnBy] = useState(user?.name || '');
  const [returnVehicleType, setReturnVehicleType] = useState('Truck');
  const [returnVehicleNo, setReturnVehicleNo] = useState('');
  const [returnDriver, setReturnDriver] = useState('');
  const [returnDriverId, setReturnDriverId] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<{ [itemId: string]: number }>({});

  const [isReceiveReturnModalOpen, setIsReceiveReturnModalOpen] = useState(false);
  const [receiveGuard, setReceiveGuard] = useState(user?.name || '');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState<{ [itemId: string]: number }>({});

  const [isSubmittingInterBranch, setIsSubmittingInterBranch] = useState(false);

  const handleDirectSnap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const docs: Array<{ dataUrl: string; note: string; mime: string }> = [];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        docs.push({
          dataUrl: reader.result as string,
          note: 'Direct camera snap',
          mime: file.type || 'image/jpeg'
        });
        if (docs.length === files.length) {
          handleAddPhotos(docs);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const fetchEntry = async () => {
    if (!code) return;
    try {
      const res = await fetch(`/api/entries/${code}`);
      if (!res.ok) throw new Error('Entry not found');
      const data = await res.json();
      setEntry(data.entry);
      setPhotos(data.photos);
      setAudit(data.audit);
    } catch (err: any) {
      setError(err.message || 'Failed to load entry details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntry();
  }, [code]);

  useEffect(() => {
    if (entry) {
      if (entry.vehicle_type) setReturnVehicleType(entry.vehicle_type);
      if (entry.vehicle_no) setReturnVehicleNo(entry.vehicle_no);
      if (entry.driver) setReturnDriver(entry.driver);
      if (entry.driver_id) setReturnDriverId(entry.driver_id);

      const initialAck: { [k: string]: number } = {};
      const initialRet: { [k: string]: number } = {};
      const initialRecRet: { [k: string]: number } = {};

      entry.items.forEach(i => {
        initialAck[i.id] = i.qty;
        const trk = entry.inter_branch_details?.items_tracking?.find(t => t.item_id === i.id);
        const pending = trk ? Math.max(0, (trk.received_qty || trk.sent_qty) - (trk.returned_qty || 0)) : i.qty;
        initialRet[i.id] = pending;
        initialRecRet[i.id] = pending;
      });

      setAckQuantities(initialAck);
      setReturnQuantities(initialRet);
      setReceiveQuantities(initialRecRet);

      const act = searchParams.get('action');
      if (act === 'ack') setIsAckModalOpen(true);
      else if (act === 'return') setIsReturnModalOpen(true);
      else if (act === 'receive_return') setIsReceiveReturnModalOpen(true);
    }
  }, [entry, searchParams]);

  const handleAcknowledgeReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    setIsSubmittingInterBranch(true);
    try {
      const received_items = entry.items.map(i => ({
        item_id: i.id,
        qty: Number(ackQuantities[i.id] !== undefined ? ackQuantities[i.id] : i.qty)
      }));
      const res = await fetch(`/api/entries/${entry.code}/acknowledge-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          guard_name: ackGuard.trim() || user?.name,
          receiving_branch: entry.to_branch,
          receiving_gate: ackGate,
          received_items,
          remarks: ackRemarks.trim()
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to acknowledge receipt');
      }
      const updated = await res.json();
      setEntry(updated);
      setIsAckModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error acknowledging receipt');
    } finally {
      setIsSubmittingInterBranch(false);
    }
  };

  const handleDispatchReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    setIsSubmittingInterBranch(true);
    try {
      const return_items = entry.items.map(i => ({
        item_id: i.id,
        return_qty: Number(returnQuantities[i.id] !== undefined ? returnQuantities[i.id] : i.qty)
      })).filter(i => i.return_qty > 0);

      if (return_items.length === 0) {
        alert('Please specify at least one quantity to return.');
        setIsSubmittingInterBranch(false);
        return;
      }

      const res = await fetch(`/api/entries/${entry.code}/dispatch-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          returned_by: returnBy.trim() || user?.name,
          vehicle_type: returnVehicleType,
          vehicle_no: returnVehicleNo.trim().toUpperCase(),
          driver: returnDriver.trim(),
          driver_id: returnDriverId.trim(),
          return_items,
          remarks: returnRemarks.trim(),
          guard_name: user?.name
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to dispatch return');
      }
      const updated = await res.json();
      setEntry(updated);
      setIsReturnModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error dispatching return');
    } finally {
      setIsSubmittingInterBranch(false);
    }
  };

  const handleReceiveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    setIsSubmittingInterBranch(true);
    try {
      const received_items = entry.items.map(i => ({
        item_id: i.id,
        qty: Number(receiveQuantities[i.id] !== undefined ? receiveQuantities[i.id] : i.qty)
      }));

      const res = await fetch(`/api/entries/${entry.code}/receive-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          guard_name: receiveGuard.trim() || user?.name,
          received_items,
          remarks: receiveRemarks.trim()
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to receive returned material');
      }
      const updated = await res.json();
      setEntry(updated);
      setIsReceiveReturnModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Error receiving return');
    } finally {
      setIsSubmittingInterBranch(false);
    }
  };

  const handleMarkVehicleLeft = async () => {
    if (!entry) return;
    try {
      const res = await fetch(`/api/entries/${entry.code}/vehicle-left`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        }
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadPDF = async (type: 'slip' | 'label') => {
    if (!entry) return;
    if (type === 'slip') {
      downloadGateSlipPDF(entry, 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD', 'GFI');
    } else {
      downloadThermalLabelPDF(entry, 'GFI');
    }

    try {
      const res = await fetch(`/api/entries/${entry.code}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({ format: type })
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDirectPrint = async () => {
    if (!entry) return;
    try {
      await printGatePass({
        code: entry.code,
        dir: entry.dir,
        gate: entry.gate,
        guard_name: entry.guard_name,
        party: entry.party,
        vehicle_no: entry.vehicle_no,
        vehicle_type: entry.vehicle_type,
        driver: entry.driver,
        driver_id: entry.driver_id,
        doc_type: entry.doc_type,
        doc_no: entry.doc_no,
        dept: entry.dept,
        authorised_by: entry.authorised_by,
        against: entry.against,
        returnable: entry.returnable,
        expected_return: entry.expected_return,
        items: entry.items,
        remarks: entry.remarks
      });

      const res = await fetch(`/api/entries/${entry.code}/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({ format: 'bluetooth_or_regular' })
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
      }
    } catch (err) {
      console.error('Print error:', err);
    }
  };

  const handleAddPhotos = async (captured: Array<{ dataUrl: string; note: string; mime: string }>) => {
    if (!entry) return;
    for (const c of captured) {
      try {
        const res = await fetch(`/api/entries/${entry.code}/photos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
          },
          body: JSON.stringify({
            data_url: c.dataUrl,
            note: c.note,
            mime: c.mime
          })
        });
        if (res.ok) {
          const newPhoto = await res.json();
          setPhotos(prev => [...prev, newPhoto]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    try {
      const res = await fetch(`/api/entries/${entry.code}/correct`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          field: corrField,
          newValue: corrNewValue,
          reason: corrReason
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
        setShowCorrectionForm(false);
        setCorrNewValue('');
        setCorrReason('');
        fetchEntry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    if (!window.confirm(`Are you sure you want to cancel ${entry.code}? It will remain permanently archived in the register marked as CANCELLED.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/entries/${entry.code}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({ reason: cancelReason })
      });
      if (res.ok) {
        const updated = await res.json();
        setEntry(updated);
        setShowCancelForm(false);
        fetchEntry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-[#5f6b7a]">Loading entry {code}...</div>;
  }

  if (error || !entry) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-lg bg-white border border-[#dde1e6] text-center space-y-4">
        <h2 className="text-xl font-bold text-[#1b1f24]">Entry not found</h2>
        <p className="text-sm text-[#5f6b7a]">{error || 'This record does not exist.'}</p>
        <Link to="/" className="inline-block px-4 py-2 bg-[#15803d] text-white rounded-lg text-xs font-semibold">
          Home
        </Link>
      </div>
    );
  }

  const isIn = entry.dir === 'IN';
  const isCancelled = !!entry.cancelled;
  const isHandCarriedIn = isIn && (entry.vehicle_type === 'Hand carried' || entry.inward_type === 'purchaser_hand');
  const isOverdue =
    entry.returnable &&
    !entry.returned_at &&
    entry.expected_return &&
    entry.expected_return < new Date().toISOString().slice(0, 10);

  return (
    <PageMotion className="w-full space-y-5 pb-16">
      {/* Banner on successful save */}
      {isNew && (
        <div className="p-4 rounded-xl bg-[#e8f6ed] border-2 border-[#9fd6b2] text-[#15803d] flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-extrabold text-base block">✔ Entry saved</span>
            <span className="text-xs text-[#1b1f24]">
              {isHandCarriedIn
                ? 'Purchaser hand delivery recorded. Print the parcel identification tag to stick on the parcel.'
                : 'Write this code on the document, or print the gate pass and attach it.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isIn ? (
              <Button3D variant="out" size="sm" onClick={() => setIsPassModalOpen(true)} className="font-bold">
                📄 Print Gate Pass (3 Copies)
              </Button3D>
            ) : isHandCarriedIn ? (
              <Button3D variant="in" size="sm" onClick={() => setIsTagModalOpen(true)} className="font-bold bg-[#0f766e]">
                🏷️ Print Material Tag (QR & Item Qty)
              </Button3D>
            ) : (
              <Button3D variant="in" size="sm" onClick={() => handleDownloadPDF('slip')}>
                🧾 Print Slip
              </Button3D>
            )}
          </div>
        </div>
      )}

      {/* Cancellation Notice */}
      {isCancelled && (
        <div className="p-4 rounded-xl bg-[#fdecec] border-2 border-[#efa5a5] text-[#b91c1c]">
          <span className="font-extrabold text-base block">CANCELLED</span>
          <span className="text-xs text-[#1b1f24]">
            Cancelled on {entry.cancelled?.at} by {entry.cancelled?.by_name} — Reason: {entry.cancelled?.reason}
          </span>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Main Entry Card */}
        <div className="lg:col-span-2 space-y-4">
          <Card3D variant={isIn ? (isHandCarriedIn ? 'purchase' : 'in') : 'out'} className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#1b1f24] tracking-tight">
                  {entry.code}
                </div>
                {isHandCarriedIn && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-md text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300">
                    <span>🛍️</span>
                    <span>Purchaser Hand-Carried (دستی آمد)</span>
                  </span>
                )}
                {entry.movement_type === 'Inter-Branch Transfer' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-md text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
                    <span>🏢</span>
                    <span>Inter-Branch Transfer: {entry.from_branch || entry.location} ➔ {entry.to_branch || entry.party}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge variant={isIn ? 'in' : 'out'}>
                  {isIn ? 'IN ⬇' : 'OUT ⬆'}
                </StatusBadge>
                {isCancelled ? (
                  <StatusBadge variant="mut">CANCELLED</StatusBadge>
                ) : entry.movement_type === 'Inter-Branch Transfer' ? (
                  entry.inter_branch_details?.status === 'in_transit' ? (
                    <span className="px-2.5 py-1 rounded-md text-xs font-black bg-amber-500 text-white animate-pulse">
                      🚚 IN TRANSIT
                    </span>
                  ) : entry.inter_branch_details?.status === 'pending_return' ? (
                    <span className="px-2.5 py-1 rounded-md text-xs font-black bg-amber-600 text-white">
                      ⏳ PENDING RETURN
                    </span>
                  ) : entry.inter_branch_details?.status === 'return_in_transit' ? (
                    <span className="px-2.5 py-1 rounded-md text-xs font-black bg-indigo-600 text-white animate-pulse">
                      🔄 RETURN IN TRANSIT
                    </span>
                  ) : (
                    <StatusBadge variant="ok">✔ COMPLETED</StatusBadge>
                  )
                ) : isOverdue ? (
                  <StatusBadge variant="bad">NOT RETURNED – OVERDUE</StatusBadge>
                ) : entry.returnable && !entry.returned_at ? (
                  <StatusBadge variant="warn">RETURNABLE – OUT</StatusBadge>
                ) : (
                  <StatusBadge variant="ok">DONE</StatusBadge>
                )}
              </div>
            </div>

            {/* Key-Value details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-[#5f6b7a] block">Date / time</span>
                <span className="font-semibold text-[#1b1f24]">{entry.at} · {entry.gate}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">Guard</span>
                <span className="font-semibold text-[#1b1f24]">{entry.guard_name}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">Purpose</span>
                <span className="font-semibold text-[#1b1f24]">{entry.purpose}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">{isIn ? 'Coming from' : 'Going to'}</span>
                <span className="font-bold text-[#1b1f24] text-sm">{entry.party}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">
                  {entry.purchaser_name || entry.inward_type === 'purchaser_hand' ? 'Vehicle / Purchaser' : 'Vehicle'}
                </span>
                <span className="font-mono font-bold text-[#1b1f24]">
                  {entry.purchaser_name ? (
                    <span className="text-[#0f766e] flex items-center gap-1 font-sans font-bold">
                      <span>🛍️</span>
                      <span>{entry.purchaser_name}</span>
                      <span className="font-normal text-xs text-slate-500">(Purchaser)</span>
                    </span>
                  ) : (
                    <>
                      {entry.vehicle_no || 'Hand Carried'} <span className="font-sans font-normal text-[#5f6b7a]">({entry.vehicle_type})</span>
                    </>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">Driver</span>
                <span className="font-semibold text-[#1b1f24]">{entry.driver || '-'} · {entry.driver_id || '-'}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">Document</span>
                <span className="font-semibold text-[#1b1f24]">
                  {entry.doc_type} <span className="font-mono font-bold">{entry.doc_no || ''}</span>
                  {entry.amount ? ` · Rs ${entry.amount.toLocaleString()}` : ''}
                </span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">PO / Work Order</span>
                <span className="font-mono font-semibold text-[#1b1f24]">{entry.po_no || '-'}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">{isIn ? 'Received by / for' : 'Authorised by'}</span>
                <span className="font-semibold text-[#1b1f24]">{isIn ? `${entry.dept} - ${entry.person}` : entry.authorised_by || '-'}</span>
              </div>

              <div>
                <span className="text-[#5f6b7a] block">Weight & Packages</span>
                <span className="font-mono font-semibold text-[#1b1f24]">
                  {entry.weight ? `${entry.weight} KG` : '-'} · {entry.packages ? `${entry.packages} pkgs` : '-'}
                </span>
              </div>

              {entry.remarks && (
                <div className="sm:col-span-2">
                  <span className="text-[#5f6b7a] block">Remarks</span>
                  <span className="text-[#1b1f24]">{entry.remarks}</span>
                </div>
              )}

              {/* Inter-Branch Transfer Lifecycle Card */}
              {entry.movement_type === 'Inter-Branch Transfer' ? (
                <div className="sm:col-span-2 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/60 border-2 border-blue-300 space-y-4">
                  {/* Header Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏢</span>
                      <div>
                        <h4 className="font-extrabold text-sm text-blue-950 uppercase tracking-wide">
                          Inter-Branch Transfer Lifecycle
                        </h4>
                        <p className="text-xs text-blue-800">
                          Transfer from <strong className="text-blue-950">{entry.from_branch || entry.location}</strong> ➔ <strong className="text-blue-950">{entry.to_branch || entry.party}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase ${
                        entry.returnable
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      }`}>
                        {entry.returnable ? '🔄 Returnable Transfer' : '📦 Permanent / Non-Returnable'}
                      </span>
                    </div>
                  </div>

                  {/* 4-Step Visual Progress Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* Step 1: Dispatched */}
                    <div className={`p-2.5 rounded-lg border ${
                      entry.inter_branch_details?.dispatched_at ? 'bg-white border-blue-300 text-blue-950 shadow-xs' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}>
                      <div className="font-bold flex items-center justify-between">
                        <span>1. Sent Gate Out</span>
                        <span>✔</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 truncate">
                        From: {entry.from_branch || entry.location}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {entry.at.slice(5, 16)}
                      </div>
                    </div>

                    {/* Step 2: Destination Receipt */}
                    <div className={`p-2.5 rounded-lg border ${
                      entry.inter_branch_details?.destination_received_at
                        ? 'bg-white border-blue-300 text-blue-950 shadow-xs'
                        : entry.inter_branch_details?.status === 'in_transit'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 animate-pulse'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}>
                      <div className="font-bold flex items-center justify-between">
                        <span>2. Received at Dest</span>
                        {entry.inter_branch_details?.destination_received_at && <span>✔</span>}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 truncate">
                        At: {entry.to_branch || entry.party}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {entry.inter_branch_details?.destination_received_at ? entry.inter_branch_details.destination_received_at.slice(5, 16) : 'In Transit...'}
                      </div>
                    </div>

                    {/* Step 3: Return Dispatched (only if returnable) */}
                    {entry.returnable && (
                      <div className={`p-2.5 rounded-lg border ${
                        entry.inter_branch_details?.return_dispatched_at
                          ? 'bg-white border-blue-300 text-blue-950 shadow-xs'
                          : entry.inter_branch_details?.status === 'pending_return'
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>3. Return Sent</span>
                          {entry.inter_branch_details?.return_dispatched_at && <span>✔</span>}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 truncate">
                          {entry.inter_branch_details?.return_vehicle_no ? `Veh: ${entry.inter_branch_details.return_vehicle_no}` : 'Pending Return'}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {entry.inter_branch_details?.return_dispatched_at ? entry.inter_branch_details.return_dispatched_at.slice(5, 16) : '-'}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Final Receipt at Origin (only if returnable) */}
                    {entry.returnable && (
                      <div className={`p-2.5 rounded-lg border ${
                        entry.inter_branch_details?.status === 'completed'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}>
                        <div className="font-bold flex items-center justify-between">
                          <span>4. Return Received</span>
                          {entry.inter_branch_details?.status === 'completed' && <span>✔</span>}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1 truncate">
                          Back at: {entry.from_branch || entry.location}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {entry.inter_branch_details?.origin_received_at ? entry.inter_branch_details.origin_received_at.slice(5, 16) : 'Pending Final'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Partial Return & Item Tracking Table */}
                  {entry.returnable && entry.inter_branch_details?.items_tracking && (
                    <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-xs text-blue-950 uppercase tracking-wide">
                          Material Item Status & Partial Return Tracking
                        </span>
                        {entry.inter_branch_details.destination_received_at && (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            {Math.max(0, Math.floor((new Date().getTime() - new Date(entry.inter_branch_details.destination_received_at).getTime()) / (1000 * 60 * 60 * 24)))} days since destination receipt
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="bg-blue-50/70 text-blue-900 border-b border-blue-200 text-[11px]">
                              <th className="py-1.5 px-2">Material Description</th>
                              <th className="py-1.5 px-2 text-center">Originally Sent</th>
                              <th className="py-1.5 px-2 text-center">Received at Dest</th>
                              <th className="py-1.5 px-2 text-center">Returned</th>
                              <th className="py-1.5 px-2 text-center font-bold text-amber-900">Pending Return</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-blue-100">
                            {entry.inter_branch_details.items_tracking.map((trk, tIdx) => {
                              const pending = Math.max(0, (trk.received_qty || trk.sent_qty) - (trk.returned_qty || 0));
                              return (
                                <tr key={tIdx} className="hover:bg-slate-50">
                                  <td className="py-2 px-2 font-semibold text-slate-800">{trk.desc}</td>
                                  <td className="py-2 px-2 text-center font-mono">{trk.sent_qty} {trk.unit}</td>
                                  <td className="py-2 px-2 text-center font-mono font-semibold text-blue-800">{trk.received_qty} {trk.unit}</td>
                                  <td className="py-2 px-2 text-center font-mono font-semibold text-emerald-700">{trk.returned_qty || 0} {trk.unit}</td>
                                  <td className="py-2 px-2 text-center font-mono font-bold">
                                    {pending > 0 ? (
                                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                                        {pending} {trk.unit}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 font-semibold">Fully Returned ✔</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Contextual Action Buttons */}
                  <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                    {/* Action 1: Destination Acknowledge Receipt */}
                    {entry.inter_branch_details?.status === 'in_transit' && (
                      <Button3D
                        type="button"
                        variant="in"
                        size="sm"
                        onClick={() => setIsAckModalOpen(true)}
                        className="font-bold bg-[#15803d] text-white px-4 py-2"
                      >
                        📥 Acknowledge Receipt at {entry.to_branch || 'Destination Branch'}
                      </Button3D>
                    )}

                    {/* Action 2: Destination Return Material */}
                    {entry.returnable && entry.inter_branch_details?.status === 'pending_return' && (
                      <Button3D
                        type="button"
                        variant="out"
                        size="sm"
                        onClick={() => setIsReturnModalOpen(true)}
                        className="font-bold bg-[#d97706] hover:bg-[#b45309] text-white px-4 py-2"
                      >
                        🔄 Return Material to {entry.from_branch || 'Sending Branch'}
                      </Button3D>
                    )}

                    {/* Action 3: Origin Receive Returned Material Back */}
                    {entry.returnable && entry.inter_branch_details?.status === 'return_in_transit' && (
                      <Button3D
                        type="button"
                        variant="in"
                        size="sm"
                        onClick={() => setIsReceiveReturnModalOpen(true)}
                        className="font-bold bg-[#0f766e] text-white px-4 py-2"
                      >
                        ✔ Receive Returned Material back at {entry.from_branch || 'Origin Branch'}
                      </Button3D>
                    )}

                    {entry.inter_branch_details?.status === 'completed' && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1.5 rounded-lg border border-emerald-300">
                        <span>✔</span>
                        <span>Inter-Branch Transfer Lifecycle Closed & Fully Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : entry.returnable && (
                <div className="sm:col-span-2 p-3 sm:p-4 rounded-xl bg-[#fdf6e3] border border-[#f59e0b] text-[#9a6700] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm block">🔄 Returnable Material Lifecycle Record</span>
                    <span className="text-xs bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-mono">
                      Ref Code: {entry.code}
                    </span>
                  </div>

                  <div className="text-xs text-[#78350f]">
                    <span>Expected Return Date: <strong>{entry.expected_return || 'Not specified'}</strong></span>
                  </div>

                  {entry.returned_at ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900 space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-sm">
                        <span>✔</span>
                        <span>RETURNED BACK TO FACTORY</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-emerald-700 block">Returned On:</span>
                          <strong className="font-mono">{entry.returned_at}</strong>
                        </div>
                        {entry.return_details?.guard_name && (
                          <div>
                            <span className="text-emerald-700 block">Received By Duty Guard:</span>
                            <strong>{entry.return_details.guard_name}</strong>
                          </div>
                        )}
                        {entry.return_details?.vehicle_no && (
                          <div>
                            <span className="text-emerald-700 block">Returning Vehicle:</span>
                            <strong className="font-mono">{entry.return_details.vehicle_no}</strong> ({entry.return_details.vehicle_type || 'Vehicle'})
                          </div>
                        )}
                        {entry.return_details?.driver && (
                          <div>
                            <span className="text-emerald-700 block">Returning Driver:</span>
                            <strong>{entry.return_details.driver}</strong> {entry.return_details.driver_id ? `[${entry.return_details.driver_id}]` : ''}
                          </div>
                        )}
                        {entry.return_details?.doc_no && (
                          <div>
                            <span className="text-emerald-700 block">Return Document:</span>
                            <strong>{entry.return_details.doc_type || 'Doc'} #{entry.return_details.doc_no}</strong>
                          </div>
                        )}
                        {entry.return_details?.remarks && (
                          <div className="sm:col-span-2">
                            <span className="text-emerald-700 block">Inspection & Return Remarks:</span>
                            <em>{entry.return_details.remarks}</em>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <Link
                        to="/return"
                        state={{ preselectedOutCode: entry.code }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold rounded-lg no-underline shadow-xs transition-colors"
                      >
                        <span>🔄</span>
                        <span>Receive & Confirm Return of This Item (Returning Back)</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="pt-3 border-t border-[#dde1e6] space-y-2">
              <h3 className="font-bold text-xs text-[#1b1f24] uppercase tracking-wide">
                Items ({entry.items.length})
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#f7f8f9] text-[#555] uppercase text-[10px] border-b border-[#dde1e6]">
                    <th className="py-2 px-2 text-left w-8">#</th>
                    <th className="py-2 px-2 text-left">Description</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-left">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde1e6]">
                  {entry.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-2 text-[#5f6b7a] font-mono">{idx + 1}</td>
                      <td className="py-2 px-2 font-semibold text-[#1b1f24]">{item.desc}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-[#15803d]">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-[#5f6b7a]">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card3D>

          {/* Attached Photos Gallery */}
          <Card3D className="p-4 sm:p-5 space-y-3">
            <input
              ref={directCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleDirectSnap}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-sm text-[#1b1f24] uppercase tracking-wide">
                Photos ({photos.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => directCameraInputRef.current?.click()}
                  className="font-bold text-[#15803d]"
                >
                  <span>📷</span>
                  <span>Capture Photo</span>
                </Button3D>
              </div>
            </div>

            {photos.length === 0 ? (
              <p className="text-xs text-[#5f6b7a] py-2">No photos captured.</p>
            ) : (
              <div className="flex flex-wrap gap-2.5 pt-1">
                {photos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setPreviewPhoto(p)}
                    className="cursor-pointer group relative w-32 h-24 rounded-lg overflow-hidden border border-[#dde1e6] bg-slate-50 shadow-xs hover:border-[#15803d]"
                  >
                    <img src={p.data_url} alt={p.note} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                      <span className="text-[10px] text-white truncate font-medium">{p.note}</span>
                      <span className="text-[9px] text-slate-300 font-mono">{p.at.slice(11, 16)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card3D>
        </div>

        {/* Right 1 Col: Actions, Printing & Supervisor Controls */}
        <div className="space-y-4">
          {/* Printing 3D Buttons Card */}
          <Card3D className="p-5 text-center space-y-3">
            <div className="text-xs text-[#5f6b7a]">Printed {entry.prints} time(s)</div>
            {!isCancelled && (
              <div className="flex flex-col gap-2.5">
                {isHandCarriedIn ? (
                  /* ======================================================== */
                  /* ONLY PRINT OPTION FOR HAND-CARRIED: PRINT MATERIAL TAG   */
                  /* (Contains Entry Code, Item Qty & QR Code)                */
                  /* ======================================================== */
                  <>
                    <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-left">
                      <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>Purchaser Parcel Tag</span>
                      </div>
                      <div className="text-[11px] text-teal-700 mt-1 leading-snug">
                        Print identification tag to stick on parcel with Entry Code, verified item quantity, and scannable QR code.
                      </div>
                    </div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="in"
                        size="lg"
                        onClick={() => setIsTagModalOpen(true)}
                        className="w-full font-bold flex items-center justify-center gap-2 py-3.5 shadow-lg bg-[#0f766e] hover:bg-[#115e59] text-white"
                      >
                        <span>🏷️</span>
                        <span>Print Material Tag (QR & Qty)</span>
                      </Button3D>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="sec"
                        size="md"
                        onClick={() => setIsTagModalOpen(true)}
                        className="w-full font-bold flex items-center justify-center gap-2 text-teal-900"
                      >
                        <span>👁️</span>
                        <span>Preview & Print Tag</span>
                      </Button3D>
                    </motion.div>
                  </>
                ) : !isIn ? (
                  /* ======================================================== */
                  /* OUTGOING MATERIAL PASS (Workshop Order / Gate Pass)       */
                  /* ======================================================== */
                  <>
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="out"
                        size="lg"
                        onClick={() => setIsPassModalOpen(true)}
                        className="w-full font-bold flex items-center justify-center gap-2 py-3 shadow-md bg-blue-700 hover:bg-blue-600 text-white"
                      >
                        <span>📄</span>
                        <span>گیٹ پاس / Gate Pass (3 Copies · {entry.returnable ? 'Returnable' : 'Non-Returnable'})</span>
                      </Button3D>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="sec"
                        size="md"
                        onClick={handleDirectPrint}
                        className="w-full font-bold flex items-center justify-center gap-2"
                      >
                        <span>🖨️</span>
                        <span>Thermal Slip (Bluetooth)</span>
                      </Button3D>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="sec"
                        size="md"
                        onClick={() => handleDownloadPDF('slip')}
                        className="w-full font-bold"
                      >
                        <span>🧾</span>
                        <span>Download Gate Slip (PDF)</span>
                      </Button3D>
                    </motion.div>
                  </>
                ) : (
                  /* ======================================================== */
                  /* COMMERCIAL VEHICLE INWARD PRINT OPTIONS                   */
                  /* ======================================================== */
                  <>
                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="in"
                        size="md"
                        onClick={handleDirectPrint}
                        className="w-full font-bold flex items-center justify-center gap-2"
                      >
                        <span>🖨️</span>
                        <span>Thermal Slip (Bluetooth)</span>
                      </Button3D>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="sec"
                        size="md"
                        onClick={() => handleDownloadPDF('slip')}
                        className="w-full font-bold"
                      >
                        <span>🧾</span>
                        <span>Download Gate Slip (PDF)</span>
                      </Button3D>
                    </motion.div>

                    <motion.div whileTap={{ scale: 0.97 }}>
                      <Button3D
                        variant="sec"
                        size="md"
                        onClick={() => handleDownloadPDF('label')}
                        className="w-full font-bold"
                      >
                        <span>🏷</span>
                        <span>Download Label 75×50 (PDF)</span>
                      </Button3D>
                    </motion.div>
                  </>
                )}
              </div>
            )}
          </Card3D>

          {/* Vehicle Left Action Card */}
          {!isCancelled && isIn && !entry.vehicle_out_at && entry.vehicle_type !== 'Hand carried' && (
            <Card3D className="p-4 space-y-2">
              <span className="text-xs text-[#5f6b7a] block">Vehicle is currently inside factory.</span>
              <Button3D
                variant="sec"
                size="md"
                onClick={handleMarkVehicleLeft}
                className="w-full text-[#15803d] font-bold"
              >
                🚚 Vehicle Has Left Now
              </Button3D>
            </Card3D>
          )}

          {/* Supervisor Controls */}
          {isSupervisor && !isCancelled && (
            <Card3D className="p-4 space-y-3">
              <h3 className="font-bold text-xs text-[#1b1f24] uppercase tracking-wide">
                Supervisor Controls
              </h3>

              <div className="space-y-2">
                <Button3D
                  variant="sec"
                  size="sm"
                  onClick={() => setShowCorrectionForm(!showCorrectionForm)}
                  className="w-full justify-between"
                >
                  <span>✏️ Correct Entry Field</span>
                  <span>{showCorrectionForm ? '▲' : '▼'}</span>
                </Button3D>

                {showCorrectionForm && (
                  <form onSubmit={handleSaveCorrection} className="p-3 bg-[#f8fafc] border border-[#dde1e6] rounded-xl space-y-3 text-xs">
                    <div>
                      <label className="form-label">Field to Correct</label>
                      <select
                        value={corrField}
                        onChange={e => setCorrField(e.target.value)}
                        className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[44px]"
                      >
                        <option value="party">Party Name</option>
                        <option value="vehicle_no">Vehicle Plate</option>
                        <option value="driver">Driver Name</option>
                        <option value="driver_id">Driver Contact / CNIC</option>
                        <option value="doc_no">Document Number</option>
                        <option value="po_no">PO Number</option>
                        <option value="remarks">Remarks</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Corrected Value</label>
                      <input
                        type="text"
                        required
                        value={corrNewValue}
                        onChange={e => setCorrNewValue(e.target.value)}
                        className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[44px]"
                      />
                    </div>

                    <div>
                      <label className="form-label">Audit Reason</label>
                      <input
                        type="text"
                        required
                        placeholder="Documentation reason"
                        value={corrReason}
                        onChange={e => setCorrReason(e.target.value)}
                        className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[44px]"
                      />
                    </div>

                    <Button3D type="submit" variant="sec" size="sm" className="w-full text-[#15803d] font-bold min-h-[44px]">
                      Save Correction
                    </Button3D>
                  </form>
                )}

                <Button3D
                  variant="bad"
                  size="sm"
                  onClick={() => setShowCancelForm(!showCancelForm)}
                  className="w-full justify-between"
                >
                  <span>🛑 Void / Cancel Entry</span>
                  <span>{showCancelForm ? '▲' : '▼'}</span>
                </Button3D>

                {showCancelForm && (
                  <form onSubmit={handleCancelEntry} className="p-3 bg-[#fdecec] border border-[#efa5a5] rounded-xl space-y-3 text-xs">
                    <div>
                      <label className="block text-sm font-semibold text-[#b91c1c] mb-1">Cancellation Reason</label>
                      <input
                        type="text"
                        required
                        placeholder="Reason for cancellation"
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        className="w-full px-3 py-2 text-base sm:text-sm bg-white border border-[#efa5a5] rounded-lg min-h-[44px]"
                      />
                    </div>
                    <Button3D type="submit" variant="bad" size="sm" className="w-full min-h-[44px] font-bold">
                      Confirm Void
                    </Button3D>
                  </form>
                )}
              </div>
            </Card3D>
          )}

          {/* Audit History */}
          <Card3D className="p-4 space-y-2">
            <h3 className="font-bold text-xs text-[#1b1f24] uppercase tracking-wide">
              History
            </h3>
            <div className="space-y-2 text-xs">
              {audit.map(a => (
                <div key={a.id} className="text-[11px] border-l-2 border-[#dde1e6] pl-2.5 py-0.5">
                  <div className="font-mono text-[#5f6b7a]">{a.ts.slice(11, 16)}</div>
                  <div className="font-bold text-[#1b1f24]">{a.action.replace(/_/g, ' ')}</div>
                  <div className="text-[#5f6b7a]">{a.user_name}</div>
                </div>
              ))}
            </div>
          </Card3D>
        </div>
      </div>

      {/* Lightbox Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[88vh] bg-white rounded-xl overflow-hidden p-2">
            <img src={previewPhoto.data_url} alt={previewPhoto.note} className="max-h-[75vh] w-auto mx-auto object-contain rounded" />
            <div className="p-3 text-center text-xs text-[#1b1f24]">
              <span className="font-bold">{previewPhoto.note}</span> · {previewPhoto.at}
            </div>
          </div>
        </div>
      )}

      {/* Official Outgoing Material Gate Pass Modal */}
      {entry && (
        <OutgoingGatePassModal
          isOpen={isPassModalOpen}
          onClose={() => setIsPassModalOpen(false)}
          entry={entry}
        />
      )}

      {/* Official Material Tag Modal (Purchaser Hand Inward) */}
      {entry && (
        <MaterialTagModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          entry={entry}
        />
      )}

      {/* ======================================================== */}
      {/* 1. DESTINATION BRANCH: ACKNOWLEDGE RECEIPT MODAL         */}
      {/* ======================================================== */}
      {entry && isAckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#15803d] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  <span>📥</span>
                  <span>Acknowledge Receipt at Destination Gate</span>
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Gate Pass: <span className="font-mono font-bold text-amber-200">{entry.code}</span> · {entry.from_branch || entry.location} ➔ {entry.to_branch || entry.party}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAckModalOpen(false)}
                className="text-white/80 hover:text-white text-xl p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAcknowledgeReceipt} className="p-4 sm:p-6 space-y-4">
              {/* Branch & Gate Verification Notice */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🏢</span>
                  <span>Receiving Branch: {entry.to_branch || entry.party}</span>
                </div>
                <p className="text-emerald-800">
                  {entry.returnable ? (
                    <span>
                      🔄 <strong>Returnable Inter-Branch Transfer:</strong> Material has been physically received. Acknowledging receipt will update status to <strong>PENDING RETURN</strong>. Destination branch can later return material back to origin.
                    </span>
                  ) : (
                    <span>
                      ✔ <strong>Non-Returnable Transfer:</strong> Material is permanently transferred to {entry.to_branch || entry.party}. Acknowledging receipt will close this transfer as <strong>COMPLETED</strong>.
                    </span>
                  )}
                </p>
              </div>

              {/* Receiving Gate & Guard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-bold text-slate-800">
                    Receiving Security Guard Name <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ackGuard}
                    onChange={e => setAckGuard(e.target.value)}
                    placeholder="Guard name"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px] font-semibold"
                  />
                </div>

                <div>
                  <label className="form-label text-xs font-bold text-slate-800">
                    Receiving Gate
                  </label>
                  <input
                    type="text"
                    value={ackGate}
                    onChange={e => setAckGate(e.target.value)}
                    placeholder="Main Gate"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                  />
                </div>
              </div>

              {/* Physical Check & Items Verification */}
              <div className="space-y-2">
                <label className="form-label text-xs font-bold text-slate-800 block">
                  Material Verification & Received Quantities <span className="text-[#b91c1c]">*</span>
                </label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10.5px]">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center w-28">Sent Qty</th>
                        <th className="py-2 px-3 text-center w-36">Received Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.items.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {item.desc}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {item.qty} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                value={ackQuantities[item.id] !== undefined ? ackQuantities[item.id] : item.qty}
                                onChange={e => setAckQuantities(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                className="w-20 px-2 py-1 text-center text-xs font-bold font-mono border-2 border-emerald-500 rounded-md focus:outline-hidden"
                              />
                              <span className="text-[11px] text-slate-500">{item.unit}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="form-label text-xs font-semibold text-slate-800">
                  Receiving Gate Remarks
                </label>
                <input
                  type="text"
                  value={ackRemarks}
                  onChange={e => setAckRemarks(e.target.value)}
                  placeholder="Material physically checked and received in good condition."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => setIsAckModalOpen(false)}
                >
                  Cancel
                </Button3D>
                <Button3D
                  type="submit"
                  variant="in"
                  size="md"
                  disabled={isSubmittingInterBranch}
                  className="font-bold bg-[#15803d] text-white px-5"
                >
                  {isSubmittingInterBranch ? 'Saving...' : 'Acknowledge Receipt'}
                </Button3D>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DESTINATION BRANCH: RETURN MATERIAL MODAL             */}
      {/* ======================================================== */}
      {entry && isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#1d4ed8] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  <span>🔄</span>
                  <span>Return Material to Sending Branch</span>
                </h3>
                <p className="text-xs text-blue-100 mt-0.5">
                  Original Gate Pass: <span className="font-mono font-bold text-amber-200">{entry.code}</span> · {entry.to_branch || entry.party} ➔ {entry.from_branch || entry.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="text-white/80 hover:text-white text-xl p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchReturn} className="p-4 sm:p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-950 space-y-1">
                <div className="font-bold">
                  Destination: Returning back to {entry.from_branch || entry.location || 'Sending Branch'}
                </div>
                <p className="text-blue-800">
                  Select the quantity being returned. When dispatched, status will become <strong>RETURN IN TRANSIT</strong>. The original transaction will remain <strong>PENDING RETURN</strong> until the sending branch gate confirms receipt.
                </p>
              </div>

              {/* Return Personnel & Vehicle Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-bold text-slate-800">
                    Returned By (Staff / Engineer) <span className="text-[#b91c1c]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={returnBy}
                    onChange={e => setReturnBy(e.target.value)}
                    placeholder="e.g. Engr. Ahmed"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px] font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label text-xs font-semibold text-slate-700">Vehicle Type</label>
                    <select
                      value={returnVehicleType}
                      onChange={e => setReturnVehicleType(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                    >
                      <option value="Truck">Truck</option>
                      <option value="Mazda / Shehzore">Mazda / Shehzore</option>
                      <option value="Pickup / Loader">Pickup / Loader</option>
                      <option value="Car">Car</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Hand carried">Hand carried</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label text-xs font-bold text-slate-800">
                      Vehicle No <span className="text-[#b91c1c]">*</span>
                    </label>
                    <input
                      type="text"
                      required={returnVehicleType !== 'Hand carried'}
                      value={returnVehicleNo}
                      onChange={e => setReturnVehicleNo(e.target.value.toUpperCase())}
                      placeholder="e.g. RIR-6720"
                      className="w-full px-2.5 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[40px] uppercase font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Driver Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs font-semibold text-slate-700">Driver Name</label>
                  <input
                    type="text"
                    value={returnDriver}
                    onChange={e => setReturnDriver(e.target.value)}
                    placeholder="e.g. Muhammad Ali"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="form-label text-xs font-semibold text-slate-700">Driver CNIC / Mobile</label>
                  <input
                    type="text"
                    value={returnDriverId}
                    onChange={e => setReturnDriverId(e.target.value)}
                    placeholder="35201-xxxxxxx-x"
                    className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg font-mono min-h-[40px]"
                  />
                </div>
              </div>

              {/* Material Items to Return Table */}
              <div className="space-y-2">
                <label className="form-label text-xs font-bold text-slate-800 block">
                  Material Quantities to Return (Supports Partial Return)
                </label>
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10.5px]">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-2 text-center">Originally Sent</th>
                        <th className="py-2 px-2 text-center">Received</th>
                        <th className="py-2 px-2 text-center">Prev Returned</th>
                        <th className="py-2 px-2 text-center font-bold text-amber-900">Pending</th>
                        <th className="py-2 px-3 text-center w-28 font-bold text-blue-900">Return Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.items.map(item => {
                        const trk = entry.inter_branch_details?.items_tracking?.find(t => t.item_id === item.id);
                        const sent = trk ? trk.sent_qty : item.qty;
                        const rec = trk ? trk.received_qty : item.qty;
                        const prevRet = trk ? (trk.returned_qty || 0) : 0;
                        const pending = Math.max(0, rec - prevRet);
                        const currentReturnVal = returnQuantities[item.id] !== undefined ? returnQuantities[item.id] : pending;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {item.desc}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-slate-500">
                              {sent} {item.unit}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-semibold text-blue-800">
                              {rec} {item.unit}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono text-emerald-700">
                              {prevRet} {item.unit}
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-900">
                              {pending} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max={pending}
                                value={currentReturnVal}
                                onChange={e => setReturnQuantities(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                className="w-20 px-2 py-1 text-center text-xs font-bold font-mono border-2 border-blue-500 rounded-md focus:outline-hidden"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="form-label text-xs font-semibold text-slate-800">
                  Return Remarks / Reason
                </label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={e => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Pump motor returned after maintenance work."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => setIsReturnModalOpen(false)}
                >
                  Cancel
                </Button3D>
                <Button3D
                  type="submit"
                  variant="out"
                  size="md"
                  disabled={isSubmittingInterBranch}
                  className="font-bold bg-[#1d4ed8] text-white px-5"
                >
                  {isSubmittingInterBranch ? 'Dispatching...' : 'Verify Return & Dispatch'}
                </Button3D>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. SENDING BRANCH: RECEIVE RETURNED MATERIAL MODAL       */}
      {/* ======================================================== */}
      {entry && isReceiveReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#15803d] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                  <span>✔</span>
                  <span>Receive Returned Material back at Origin Branch</span>
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Return of <span className="font-mono font-bold text-amber-200">{entry.code}</span> · {entry.to_branch || entry.party} ➔ {entry.from_branch || entry.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReceiveReturnModalOpen(false)}
                className="text-white/80 hover:text-white text-xl p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReceiveReturn} className="p-4 sm:p-6 space-y-4">
              {/* Return Dispatch Info Snapshot */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Dispatched Return Carrier Details:</span>
                  <span className="font-mono text-slate-500">{entry.inter_branch_details?.return_dispatched_at?.slice(5, 16)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Vehicle:</span>
                    <span className="font-mono font-bold text-slate-800">{entry.inter_branch_details?.return_vehicle_no || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Driver:</span>
                    <span className="font-semibold text-slate-800">{entry.inter_branch_details?.return_driver || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Returned By:</span>
                    <span className="font-semibold text-slate-800">{entry.inter_branch_details?.return_by || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 uppercase">Dest Branch:</span>
                    <span className="font-semibold text-slate-800">{entry.to_branch || entry.party}</span>
                  </div>
                </div>
                {entry.inter_branch_details?.return_remarks && (
                  <div className="text-[11px] text-blue-900 bg-blue-50/80 p-1.5 rounded">
                    <strong>Destination Note:</strong> {entry.inter_branch_details.return_remarks}
                  </div>
                )}
              </div>

              {/* Receiving Guard */}
              <div>
                <label className="form-label text-xs font-bold text-slate-800">
                  Receiving Gate Guard Name <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={receiveGuard}
                  onChange={e => setReceiveGuard(e.target.value)}
                  placeholder="Guard name"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px] font-semibold"
                />
              </div>

              {/* Items Verification Table */}
              <div className="space-y-2">
                <label className="form-label text-xs font-bold text-slate-800 block">
                  Verify Physical Material Received Back
                </label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10.5px]">
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center w-32">Expected Return</th>
                        <th className="py-2 px-3 text-center w-36">Actually Received</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.items.map(item => {
                        const trk = entry.inter_branch_details?.items_tracking?.find(t => t.item_id === item.id);
                        const expected = trk ? (trk.returned_qty || trk.received_qty || item.qty) : item.qty;
                        const curVal = receiveQuantities[item.id] !== undefined ? receiveQuantities[item.id] : expected;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {item.desc}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-blue-900">
                              {expected} {item.unit}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  required
                                  value={curVal}
                                  onChange={e => setReceiveQuantities(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                  className="w-20 px-2 py-1 text-center text-xs font-bold font-mono border-2 border-emerald-500 rounded-md focus:outline-hidden"
                                />
                                <span className="text-[11px] text-slate-500">{item.unit}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="form-label text-xs font-semibold text-slate-800">
                  Receipt Remarks
                </label>
                <input
                  type="text"
                  value={receiveRemarks}
                  onChange={e => setReceiveRemarks(e.target.value)}
                  placeholder="Material received back in good physical condition."
                  className="w-full px-3 py-2 text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[40px]"
                />
              </div>

              {/* Status Note */}
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <span>ℹ️</span> <strong>Lifecycle rule:</strong> If all material items are received, the transfer will be marked as <strong>COMPLETED</strong> and closed. If fewer quantities are received, it will remain <strong>PENDING RETURN</strong>.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => setIsReceiveReturnModalOpen(false)}
                >
                  Cancel
                </Button3D>
                <Button3D
                  type="submit"
                  variant="in"
                  size="md"
                  disabled={isSubmittingInterBranch}
                  className="font-bold bg-[#15803d] text-white px-5"
                >
                  {isSubmittingInterBranch ? 'Saving...' : 'Receive Returned Material'}
                </Button3D>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageMotion>
  );
};
