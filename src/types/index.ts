export type GateStage = 'at_gate' | 'dock_weighbridge' | 'inspection_unloading' | 'cleared';

export type MovementType =
  | 'External / Supplier'
  | 'Repair / Maintenance'
  | 'Customer / Sale'
  | 'Inter-Location Transfer'
  | 'Inter-Branch Transfer'
  | 'Other';

export type InterBranchStatus =
  | 'AWAITING_DISPATCH'
  | 'ISSUED'
  | 'DRAFT'
  | 'GATE_OUT_VERIFIED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'RECEIVED_WITH_DIFFERENCE'
  | 'RECEIVED_WITH_DAMAGE'
  | 'PENDING_RETURN'
  | 'RETURN_IN_TRANSIT'
  | 'COMPLETED'
  | 'GATE_HOLD'
  | 'CANCELLED'
  | 'in_transit'
  | 'received'
  | 'pending_return'
  | 'return_in_transit'
  | 'completed';

export interface InterBranchItem {
  id?: string;
  item_code?: string;
  description: string;
  unit: string;
  dispatch_qty: number;
  received_qty?: number;
  damaged_qty?: number;
  returned_qty?: number;
  difference?: number;
  damage_notes?: string;
  remarks?: string;
  batch_no?: string;
  serial_no?: string;
}

export interface InterBranchGatePass {
  id: string;
  gate_pass_no: string;
  pass_no?: string;
  code?: string;
  from_branch: string;
  to_branch: string;
  movement_type?: MovementType;
  status: InterBranchStatus;
  department?: string;
  purpose: string;
  vehicle_no: string;
  vehicle_type?: string;
  driver_name: string;
  driver_id?: string;
  driver_mobile?: string;
  returnable: boolean;
  expected_return_date?: string | null;
  items: InterBranchItem[];
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  remarks?: string;
  // gate out dispatch
  gate_out_at?: string | null;
  gate_out_by?: string | null;
  gate_out_by_name?: string | null;
  gate_out_gate?: string | null;
  gate_out_checklist?: Record<string, boolean>;
  gate_out_remarks?: string | null;
  // gate in receipt
  gate_in_at?: string | null;
  gate_in_by?: string | null;
  gate_in_by_name?: string | null;
  gate_in_gate?: string | null;
  gate_in_checklist?: Record<string, boolean>;
  gate_in_remarks?: string | null;
  has_difference?: boolean;
  has_damage?: boolean;
  // return info
  return_dispatched_at?: string | null;
  return_dispatched_by?: string | null;
  return_vehicle_no?: string | null;
  return_vehicle_type?: string | null;
  return_driver?: string | null;
  return_driver_id?: string | null;
  return_driver_mobile?: string | null;
  return_remarks?: string | null;
  return_received_at?: string | null;
  return_received_by?: string | null;
  return_received_remarks?: string | null;
  // hold & cancel
  hold_reason?: string | null;
  hold_by?: string | null;
  hold_at?: string | null;
  cancel_reason?: string | null;
  cancel_by?: string | null;
  cancel_at?: string | null;
}

export interface InterBranchStats {
  total: number;
  draft: number;
  gate_out_pending: number;
  pendingGateOut?: number;
  in_transit: number;
  expectedInTransit?: number;
  received: number;
  completed: number;
  pending_return: number;
  return_in_transit: number;
  holds: number;
  onHold?: number;
  with_differences: number;
  with_damage: number;
}

export interface LocationNotification {
  id: string;
  target_location: string;
  from_location: string;
  gate_pass_code?: string;
  code?: string;
  type: 'new_incoming' | 'in_transit' | 'received' | 'pending_return' | 'return_in_transit' | 'return_received' | 'completed';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  metadata?: any;
  details?: {
    materials?: string;
    returnable?: boolean;
    vehicle_no?: string;
    driver_name?: string;
    status?: string;
    returned_by?: string;
  };
}

export interface InterBranchItemTracking {
  item_id: string;
  desc: string;
  sent_qty: number;
  received_qty: number;
  returned_qty: number;
  unit: string;
}

export interface InterBranchDetails {
  from_branch: string;
  to_branch: string;
  status: InterBranchStatus;

  // Sent Gate Info
  dispatched_at: string;
  dispatched_guard: string;

  // Destination First Receipt Info
  destination_received_at?: string | null;
  destination_received_gate?: string | null;
  destination_received_guard?: string | null;
  destination_receipt_remarks?: string | null;

  // Return Dispatch Info (when destination branch returns the material)
  return_dispatched_at?: string | null;
  return_dispatched_guard?: string | null;
  return_by?: string | null;
  return_vehicle_type?: string | null;
  return_vehicle_no?: string | null;
  return_driver?: string | null;
  return_driver_id?: string | null;
  return_remarks?: string | null;

  // Final Receipt back at origin branch
  origin_received_at?: string | null;
  origin_received_guard?: string | null;
  origin_receipt_remarks?: string | null;

  // Per-item tracking table for partial returns
  items_tracking?: InterBranchItemTracking[];
}

export interface GateItem {
  id: string;
  desc: string;
  qty: number;
  unit: string;
}

export interface GatePhoto {
  id: string;
  entry_id: string;
  data_url: string;
  note: string;
  mime: string;
  size: number;
  sha256: string;
  captured_by: string;
  at: string;
}

export interface GateCorrection {
  at: string;
  by: string;
  by_name: string;
  field: string;
  old: string;
  new: string;
  reason: string;
}

export interface ReturnDetails {
  returned_at: string;
  guard_id: string;
  guard_name: string;
  vehicle_type?: string;
  vehicle_no?: string;
  driver?: string;
  driver_id?: string;
  doc_type?: string;
  doc_no?: string;
  items: GateItem[];
  remarks?: string;
  photos_count?: number;
}

export interface GateEntry {
  id: string;
  code: string;
  dir: 'IN' | 'OUT';
  movement_type?: MovementType;
  from_branch?: string;
  to_branch?: string;
  inter_branch_details?: InterBranchDetails | null;
  inward_type?: 'vehicle' | 'purchaser_hand';
  purchaser_name?: string;
  personal_purpose?: string;
  at: string;
  gate: string;
  location?: string;
  device_type?: string;
  guard_id: string;
  guard_name: string;
  purpose: string;
  party: string;
  vehicle_type: string;
  vehicle_no: string;
  driver: string;
  driver_id: string;
  doc_type: string;
  doc_no: string;
  pass_no?: string;
  amount: number | null;
  po_no: string;
  authorised_by: string;
  dept: string;
  items: GateItem[];
  weight: number | null;
  packages: number | null;
  person: string;
  remarks: string;
  returnable: boolean;
  expected_return: string | null;
  returned_at: string | null;
  return_code: string | null;
  return_details?: ReturnDetails | null;
  against: string | null;
  duplicate_of: string[];
  vehicle_out_at: string | null;
  stage: GateStage;
  prints: number;
  corrections: GateCorrection[];
  cancelled: { at: string; by: string; by_name: string; reason: string } | null;
}

export interface AuditLog {
  id: number;
  ts: string;
  user_id: string;
  user_name: string;
  action: string;
  code: string | null;
  details: string;
  prev_hash: string;
  hash: string;
}

export interface FacilityLocation {
  id: string;
  name: string;
  code?: string;
  address?: string;
  active: boolean;
  user_count?: number;
  guards_count?: number;
  supervisors_count?: number;
  admins_count?: number;
}

export interface AppUser {
  id: string;
  name: string;
  login: string;
  role: 'guard' | 'supervisor' | 'admin';
  gate: string;
  location?: string;
  device_type?: 'tablet' | 'web';
  active: boolean;
  must_change: boolean;
}

export interface SystemSettings {
  company_name: string;
  company_short: string;
  company_address?: string;
  app_name?: string;
  logo_url?: string;
  gates: string;
  locations?: string;
  units: string;
  in_purposes: string;
  out_purposes: string;
  photo_required_in: boolean;
  photo_required_out: boolean;
  idle_logout_minutes: number;
  mysql_host?: string;
  mysql_port?: number;
  mysql_user?: string;
  mysql_database?: string;
}

export interface DashboardStats {
  todayIn: number;
  todayOut: number;
  vehiclesInside: number;
  overdueReturnables: number;
  totalEntries: number;
  stageBreakdown: {
    at_gate: number;
    dock_weighbridge: number;
    inspection_unloading: number;
    cleared: number;
  };
}
