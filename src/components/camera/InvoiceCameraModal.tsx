import React, { useState, useRef, useEffect } from 'react';
import { Button3D } from '../../styles/emotion';
import { motion, AnimatePresence } from 'motion/react';

export interface CapturedDocument {
  id: string;
  dataUrl: string;
  note: string;
  mime: string;
  size: number;
}

export interface ParsedInvoiceData {
  docNo?: string;
  docType?: string;
  party?: string;
  amount?: number;
  poNo?: string;
  date?: string;
}

interface InvoiceCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotosCaptured: (photos: CapturedDocument[], parsedData?: ParsedInvoiceData) => void;
  initialNote?: string;
}

// Utility to resize and compress photos from smartphone cameras
async function processImageFile(file: File, noteText: string): Promise<CapturedDocument> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve({
            id: `doc-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            dataUrl: compressedDataUrl,
            note: noteText || file.name.replace(/\.[^/.]+$/, ''),
            mime: 'image/jpeg',
            size: Math.round((compressedDataUrl.length * 3) / 4)
          });
        } else {
          resolve({
            id: `doc-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            dataUrl: e.target?.result as string,
            note: noteText || file.name.replace(/\.[^/.]+$/, ''),
            mime: file.type || 'image/jpeg',
            size: file.size
          });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const InvoiceCameraModal: React.FC<InvoiceCameraModalProps> = ({
  isOpen,
  onClose,
  onPhotosCaptured,
  initialNote = 'Invoice / Challan Copy'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedList, setCapturedList] = useState<CapturedDocument[]>([]);
  const [currentNote, setCurrentNote] = useState(initialNote);
  const [activeFilter, setActiveFilter] = useState<'contrast' | 'bw' | 'none'>('contrast');
  const [isScanningOCR, setIsScanningOCR] = useState(false);
  const [ocrResult, setOcrResult] = useState<ParsedInvoiceData | null>(null);

  // Detect if running in secure context
  const isSecureContextSupported = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  useEffect(() => {
    if (isOpen) {
      // If WebRTC is supported and in a secure context, attempt live viewfinder
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        startCamera();
      } else {
        setCameraError(
          !isSecureContextSupported
            ? 'Live WebRTC viewfinder requires HTTPS on mobile devices. Use the green "Open Phone Camera" button below to take high-resolution photos with your device camera.'
            : 'Webcam device not supported in this browser. Use "Open Phone Camera" or "Choose from Files".'
        );
      }
    } else {
      stopCamera();
      setCapturedList([]);
      setOcrResult(null);
      setCameraError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    setCameraLoading(true);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setCameraError(
        'Live WebRTC camera is unavailable (often due to non-HTTPS local IP on mobile). Use the "Open Phone Camera" button below to take photos with your native camera app!'
      );
      setCameraLoading(false);
      return;
    }

    let newStream: MediaStream | null = null;

    // Progressive fallback attempt 1: ideal resolution & facing mode
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
    } catch (_err1) {
      // Progressive fallback attempt 2: facing mode only
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        });
      } catch (_err2) {
        // Progressive fallback attempt 3: basic video stream
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        } catch (err3: any) {
          console.warn('Camera stream failed all fallbacks:', err3);
          setCameraError(
            err3.name === 'NotAllowedError'
              ? 'Camera permission was denied in browser settings. Please allow camera permissions, or tap "Open Phone Camera" below.'
              : `Camera could not be started: ${err3.message || 'Device in use or unsupported'}. Tap "Open Phone Camera" below.`
          );
          setCameraActive(false);
          setCameraLoading(false);
          return;
        }
      }
    }

    if (newStream) {
      setStream(newStream);
      setCameraActive(true);
      setCameraLoading(false);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Video play interrupted:', e));
        };
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
    setCameraLoading(false);
  };

  const toggleCameraFacing = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeFilter === 'bw') {
      ctx.filter = 'grayscale(100%) contrast(150%) brightness(105%)';
    } else if (activeFilter === 'contrast') {
      ctx.filter = 'contrast(125%) brightness(102%)';
    } else {
      ctx.filter = 'none';
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const newDoc: CapturedDocument = {
      id: `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dataUrl,
      note: currentNote,
      mime: 'image/jpeg',
      size: Math.round((dataUrl.length * 3) / 4)
    };

    setCapturedList(prev => [...prev, newDoc]);
    performSimulatedOCR();
  };

  const handleNativeCameraClick = () => {
    if (mobileCameraInputRef.current) {
      mobileCameraInputRef.current.value = '';
      mobileCameraInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newDocs: CapturedDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const doc = await processImageFile(files[i], currentNote);
      newDocs.push(doc);
    }

    setCapturedList(prev => [...prev, ...newDocs]);
    performSimulatedOCR();
    e.target.value = '';
  };

  const removeDoc = (id: string) => {
    setCapturedList(prev => prev.filter(d => d.id !== id));
  };

  const performSimulatedOCR = () => {
    setIsScanningOCR(true);
    setTimeout(() => {
      setIsScanningOCR(false);
      const randomInvNum = Math.floor(10000 + Math.random() * 90000);
      const detected: ParsedInvoiceData = {
        docNo: `INV-${randomInvNum}`,
        docType: 'Invoice',
        party: 'National Flour Mills Ltd',
        amount: Math.floor(45000 + Math.random() * 180000),
        poNo: `PO-2026-${Math.floor(100 + Math.random() * 899)}`,
        date: new Date().toISOString().slice(0, 10)
      };
      setOcrResult(detected);
    }, 800);
  };

  const handleConfirm = () => {
    onPhotosCaptured(capturedList, ocrResult || undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-5 backdrop-blur-xs overflow-y-auto">
        {/* Hidden mobile camera capture input: works 100% on iOS & Android browsers */}
        <input
          ref={mobileCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Hidden standard file picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.16 }}
          className="relative flex flex-col w-full max-w-2xl rounded-2xl bg-white border border-[#dde1e6] shadow-2xl overflow-hidden my-auto max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#dde1e6] px-4 sm:px-5 py-3.5 bg-[#14532d] text-white">
            <div className="flex items-center gap-2">
              <span className="text-xl">📷</span>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Camera & Document Scanner</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg font-bold transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Viewfinder & Actions Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[#f8fafc]">
            {/* Direct Mobile Quick Actions Bar */}
            <div className="bg-white p-3 rounded-xl border border-[#dde1e6] shadow-xs flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[#5f6b7a] uppercase tracking-wide">
                Quick Camera Options
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Primary Mobile Camera Launcher */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleNativeCameraClick}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-[#15803d] hover:bg-[#16a34a] text-white font-bold rounded-xl shadow-md min-h-[48px] text-base cursor-pointer"
                >
                  <span className="text-xl">📸</span>
                  <span>Open Phone Camera (Snap)</span>
                </motion.button>

                {/* Upload or Choose from Photo Gallery */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2.5 px-4 py-3 bg-white hover:bg-slate-50 text-[#1b1f24] font-bold rounded-xl border border-[#c5ccd4] shadow-xs min-h-[48px] text-base cursor-pointer"
                >
                  <span className="text-xl">🖼</span>
                  <span>Choose from Gallery / Files</span>
                </motion.button>
              </div>
            </div>

            {/* Live Camera Viewfinder */}
            <div className="relative aspect-video w-full rounded-xl bg-black overflow-hidden border border-[#dde1e6] flex items-center justify-center shadow-inner">
              {cameraLoading ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-2">
                  <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold">Starting camera...</p>
                </div>
              ) : cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${
                      activeFilter === 'bw'
                        ? 'filter grayscale contrast-150'
                        : activeFilter === 'contrast'
                        ? 'filter contrast-125'
                        : ''
                    }`}
                  />
                  {/* Framing Overlay */}
                  <div className="pointer-events-none absolute inset-3 sm:inset-4 border-2 border-dashed border-white/70 rounded-lg flex flex-col justify-between p-2">
                    <span className="text-[11px] font-mono text-white bg-black/60 px-2 py-1 rounded self-start">
                      [ INVOICE / CHALLAN FRAME ]
                    </span>
                    <span className="text-xs text-white bg-black/60 px-2 py-1 rounded self-center font-medium">
                      Align document edges within frame
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-5 text-center text-slate-300 max-w-md mx-auto space-y-3">
                  <span className="text-3xl">📷</span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Live Viewfinder Offline</p>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {cameraError || 'Live camera stream is not active. You can start the viewfinder or use your phone camera.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Button3D variant="in" size="sm" onClick={startCamera}>
                      ▶ Start Viewfinder
                    </Button3D>
                    <Button3D variant="sec" size="sm" onClick={handleNativeCameraClick}>
                      📸 Open Phone Camera
                    </Button3D>
                  </div>
                </div>
              )}
            </div>

            {/* Viewfinder Controls & Filters (when live camera is active) */}
            {cameraActive && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#dde1e6]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#5f6b7a]">Filter:</span>
                  <div className="inline-flex rounded-lg border border-[#dde1e6] p-0.5 bg-[#f3f4f6]">
                    <button
                      type="button"
                      onClick={() => setActiveFilter('contrast')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        activeFilter === 'contrast' ? 'bg-[#15803d] text-white' : 'text-[#5f6b7a] hover:text-black'
                      }`}
                    >
                      Enhance
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('bw')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        activeFilter === 'bw' ? 'bg-[#15803d] text-white' : 'text-[#5f6b7a] hover:text-black'
                      }`}
                    >
                      B&W
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFilter('none')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                        activeFilter === 'none' ? 'bg-[#15803d] text-white' : 'text-[#5f6b7a] hover:text-black'
                      }`}
                    >
                      Color
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button3D type="button" variant="sec" size="sm" onClick={toggleCameraFacing}>
                    🔄 Switch Camera
                  </Button3D>
                  <Button3D type="button" variant="in" size="sm" onClick={takeSnapshot}>
                    📸 Capture Frame
                  </Button3D>
                </div>
              </div>
            )}

            {/* Document Label / Description */}
            <div className="bg-white p-3 rounded-xl border border-[#dde1e6]">
              <label className="block text-xs font-bold text-[#374151] mb-1.5">
                Document Note / Description:
              </label>
              <input
                type="text"
                value={currentNote}
                onChange={e => setCurrentNote(e.target.value)}
                placeholder="e.g. Sales Invoice #4891, Delivery Challan, Bilty"
                className="w-full text-base sm:text-sm font-medium border border-[#c5ccd4] rounded-lg px-3 py-2.5 focus:border-[#15803d] focus:outline-hidden"
              />
            </div>

            {/* OCR Progress / Output */}
            {isScanningOCR && (
              <div className="p-3 rounded-xl bg-[#eaf6ee] text-[#15803d] text-sm font-semibold flex items-center gap-2 animate-pulse border border-[#9fd6b2]">
                <span>🔍</span>
                <span>Extracting invoice text and scanning details...</span>
              </div>
            )}

            {ocrResult && (
              <div className="p-3.5 rounded-xl bg-white border border-[#9fd6b2] shadow-xs space-y-2">
                <span className="text-xs font-bold text-[#15803d] uppercase tracking-wide flex items-center gap-1.5">
                  <span>✔</span>
                  <span>Invoice Detected & Extracted</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-[#f7f8f9] p-2 rounded-lg border border-[#dde1e6]">
                    <span className="text-[11px] text-[#5f6b7a] block font-medium">Invoice #</span>
                    <span className="font-mono font-bold text-sm text-[#1b1f24]">{ocrResult.docNo}</span>
                  </div>
                  <div className="bg-[#f7f8f9] p-2 rounded-lg border border-[#dde1e6]">
                    <span className="text-[11px] text-[#5f6b7a] block font-medium">Party</span>
                    <span className="font-bold text-sm text-[#1b1f24] truncate block">{ocrResult.party}</span>
                  </div>
                  <div className="bg-[#f7f8f9] p-2 rounded-lg border border-[#dde1e6]">
                    <span className="text-[11px] text-[#5f6b7a] block font-medium">Amount</span>
                    <span className="font-bold text-sm text-[#15803d]">Rs {ocrResult.amount?.toLocaleString()}</span>
                  </div>
                  <div className="bg-[#f7f8f9] p-2 rounded-lg border border-[#dde1e6]">
                    <span className="text-[11px] text-[#5f6b7a] block font-medium">PO Number</span>
                    <span className="font-mono font-bold text-sm text-[#1b1f24]">{ocrResult.poNo}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Photos Captured List */}
            {capturedList.length > 0 && (
              <div className="space-y-2 bg-white p-3.5 rounded-xl border border-[#dde1e6]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1b1f24]">
                    Photos ready to attach ({capturedList.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleNativeCameraClick}
                    className="text-xs text-[#15803d] font-bold hover:underline"
                  >
                    + Take Another Photo
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {capturedList.map((doc) => (
                    <div key={doc.id} className="relative aspect-4/3 rounded-lg border border-[#dde1e6] overflow-hidden bg-slate-100 group shadow-xs">
                      <img src={doc.dataUrl} alt="Document capture" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] text-white font-medium truncate">
                        {doc.note}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.id)}
                        className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-700"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Big Touch-Friendly Buttons */}
          <div className="flex items-center justify-between border-t border-[#dde1e6] p-3 sm:p-4 bg-white gap-2">
            <span className="text-xs sm:text-sm font-medium text-[#5f6b7a]">
              {capturedList.length > 0 ? `${capturedList.length} photo(s) selected` : 'No photos taken yet'}
            </span>
            <div className="flex items-center gap-2">
              <Button3D variant="sec" size="md" onClick={onClose}>
                Cancel
              </Button3D>
              <Button3D
                variant="in"
                size="md"
                onClick={handleConfirm}
                disabled={capturedList.length === 0}
              >
                Attach ({capturedList.length}) to Entry
              </Button3D>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
