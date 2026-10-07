import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { saveBase64Image } from './utils/fileStorage.js';
import {
  initMySQL,
  mysqlSaveEntry,
  mysqlSaveUser,
  mysqlDeleteUser,
  mysqlSaveSettings,
  mysqlSaveAudit,
  mysqlSavePhoto,
  mysqlSaveSession,
  mysqlGetEntries,
  mysqlGetEntryByCode,
  mysqlGetAuditTrail,
  mysqlGetUsers,
  mysqlFindUserByLogin,
  mysqlFindUserById,
  mysqlGetSettings,
  mysqlGetLocations,
  mysqlSaveLocation,
  mysqlDeleteLocation,
  isMySQLConnected
} from './mysqlClient.js';

export interface FacilityLocationItem {
  id: string;
  name: string;
  code?: string;
  address?: string;
  active: boolean;
  user_count: number;
  guards_count: number;
  supervisors_count: number;
  admins_count: number;
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
  // gate out
  gate_out_at?: string | null;
  gate_out_by?: string | null;
  gate_out_by_name?: string | null;
  gate_out_gate?: string | null;
  gate_out_checklist?: Record<string, boolean>;
  gate_out_remarks?: string | null;
  // gate in
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

export interface AppNotification {
  id: string;
  created_at: string;
  target_location: string;
  from_location: string;
  code: string;
  type: 'new_incoming' | 'in_transit' | 'received' | 'pending_return' | 'return_in_transit' | 'return_received' | 'completed';
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
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
  dispatched_at: string;
  dispatched_guard: string;
  destination_received_at?: string | null;
  destination_received_gate?: string | null;
  destination_received_guard?: string | null;
  destination_receipt_remarks?: string | null;
  return_dispatched_at?: string | null;
  return_dispatched_guard?: string | null;
  return_by?: string | null;
  return_vehicle_type?: string | null;
  return_vehicle_no?: string | null;
  return_driver?: string | null;
  return_driver_id?: string | null;
  return_remarks?: string | null;
  origin_received_at?: string | null;
  origin_received_guard?: string | null;
  origin_receipt_remarks?: string | null;
  items_tracking?: InterBranchItemTracking[];
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

export interface AppUser {
  id: string;
  name: string;
  login: string;
  role: 'guard' | 'supervisor' | 'admin';
  gate: string;
  location?: string;
  device_type?: 'tablet' | 'web';
  salt: string;
  password_hash: string;
  active: boolean;
  must_change: boolean;
  failed: number;
}

export interface SystemSettings {
  company_name: string;
  company_short: string;
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

export interface UserSession {
  sessionId: string;
  userId: string;
  login: string;
  refreshToken: string;
  device?: string;
  device_type?: 'tablet' | 'web';
  gate?: string;
  location?: string;
  ip?: string;
  created_at: string;
  last_active_at: string;
  active: boolean;
}

export interface DatabaseState {
  version: number;
  created_at: string;
  system_key: string;
  settings: SystemSettings;
  seq: Record<string, number>;
  users: AppUser[];
  entries: GateEntry[];
  interbranch_passes?: InterBranchGatePass[];
  notifications?: AppNotification[];
  photos: GatePhoto[];
  audit: AuditLog[];
  sessions?: UserSession[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getFormattedNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DEFAULT_SETTINGS: SystemSettings = {
  company_name: 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
  company_short: '',
  app_name: 'Gate Register',
  logo_url: '',
  gates: 'Main Gate,Chocolate Gate,Workshop,Worldsweet,Gate 2 (Raw Material),Gate 3 (Dispatch)',
  locations: '',
  units: 'Bags,Cartons,Drums,Pcs,KG,Tons,Litre,Rolls,Bundles,Pallets,Boxes,Sets',
  in_purposes: 'Purchase,Raw Material,Packaging,Returnable Item Back,Customer Return,Sample,Job Work,Machinery Repair,General Store',
  out_purposes: 'Finished Goods / Sale,Return to Supplier,Contractor Repair,Job Work Dispatched,Scrap & Waste,Sample,Company Asset,Empty Pallets / Containers,Other',
  photo_required_in: true,
  photo_required_out: false,
  idle_logout_minutes: 30,
  mysql_host: 'localhost',
  mysql_port: 3306,
  mysql_user: 'root',
  mysql_database: 'gateregister_db'
};

class Database {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadOrInit();
    // Connect to MySQL as primary database and sync data directly
    initMySQL(this.state).catch(err => {
      console.warn('MySQL init deferred:', err?.message || err);
    });
  }

  private loadOrInit(): DatabaseState {
    // Strictly bypass JSON file if SAVE_DATA_TO_JSON is false (default)
    if (process.env.SAVE_DATA_TO_JSON === 'true' && fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        if (!parsed.interbranch_passes) parsed.interbranch_passes = [];
        if (!parsed.notifications) parsed.notifications = [];
        return parsed;
      } catch (err) {
        console.warn('Failed reading DB file', err);
      }
    }

    const saltAdmin = crypto.randomBytes(16).toString('hex');
    const saltGuard = crypto.randomBytes(16).toString('hex');
    const saltSupervisor = crypto.randomBytes(16).toString('hex');
    const saltChoc = crypto.randomBytes(16).toString('hex');
    const saltWork = crypto.randomBytes(16).toString('hex');
    const saltWorld = crypto.randomBytes(16).toString('hex');
    const saltG1 = crypto.randomBytes(16).toString('hex');
    const saltG2 = crypto.randomBytes(16).toString('hex');
    const saltG3 = crypto.randomBytes(16).toString('hex');
    const saltM1 = crypto.randomBytes(16).toString('hex');

    const adminUser: AppUser = {
      id: 'usr-1',
      name: 'Operations Manager',
      login: 'admin',
      role: 'admin',
      gate: 'Main Gate',
      location: 'Estate 1',
      device_type: 'web',
      salt: saltAdmin,
      password_hash: hashPassword('admin123', saltAdmin),
      active: true,
      must_change: false,
      failed: 0
    };

    // Location-based users as requested in specification
    const guard01: AppUser = {
      id: 'usr-guard01',
      name: 'Ahmed Khan',
      login: 'guard01',
      role: 'guard',
      gate: 'Main Gate',
      location: 'Estate 1',
      device_type: 'tablet',
      salt: saltG1,
      password_hash: hashPassword('guard123', saltG1),
      active: true,
      must_change: false,
      failed: 0
    };

    const guard02: AppUser = {
      id: 'usr-guard02',
      name: 'Bilal Ahmed',
      login: 'guard02',
      role: 'guard',
      gate: 'Main Gate',
      location: 'Estate 2',
      device_type: 'tablet',
      salt: saltG2,
      password_hash: hashPassword('guard123', saltG2),
      active: true,
      must_change: false,
      failed: 0
    };

    const guard03: AppUser = {
      id: 'usr-guard03',
      name: 'Imran',
      login: 'guard03',
      role: 'guard',
      gate: 'Main Gate',
      location: 'Kamonki',
      device_type: 'tablet',
      salt: saltG3,
      password_hash: hashPassword('guard123', saltG3),
      active: true,
      must_change: false,
      failed: 0
    };

    const manager01: AppUser = {
      id: 'usr-manager01',
      name: 'Ali',
      login: 'manager01',
      role: 'supervisor',
      gate: 'Main Gate',
      location: 'Estate 1',
      device_type: 'web',
      salt: saltM1,
      password_hash: hashPassword('manager123', saltM1),
      active: true,
      must_change: false,
      failed: 0
    };

    const supervisorUser: AppUser = {
      id: 'usr-2',
      name: 'Tariq Mehmood (Supervisor)',
      login: 'supervisor',
      role: 'supervisor',
      gate: 'Main Gate',
      location: 'Estate 1',
      device_type: 'web',
      salt: saltSupervisor,
      password_hash: hashPassword('super123', saltSupervisor),
      active: true,
      must_change: false,
      failed: 0
    };

    const guardUser: AppUser = {
      id: 'usr-3',
      name: 'Muhammad Aslam (Main Gate)',
      login: 'guard',
      role: 'guard',
      gate: 'Main Gate',
      location: 'Estate 1',
      device_type: 'tablet',
      salt: saltGuard,
      password_hash: hashPassword('guard123', saltGuard),
      active: true,
      must_change: false,
      failed: 0
    };

    const chocGuardUser: AppUser = {
      id: 'usr-4',
      name: 'Rashid Ali (Chocolate Gate)',
      login: 'chocolate_guard',
      role: 'guard',
      gate: 'Chocolate Gate',
      location: 'Estate 1',
      device_type: 'tablet',
      salt: saltChoc,
      password_hash: hashPassword('choc123', saltChoc),
      active: true,
      must_change: false,
      failed: 0
    };

    const workGuardUser: AppUser = {
      id: 'usr-5',
      name: 'Zahid Khan (Workshop Gate)',
      login: 'workshop_guard',
      role: 'guard',
      gate: 'Workshop',
      location: 'Estate 2',
      device_type: 'tablet',
      salt: saltWork,
      password_hash: hashPassword('work123', saltWork),
      active: true,
      must_change: false,
      failed: 0
    };

    const worldGuardUser: AppUser = {
      id: 'usr-6',
      name: 'Irfan Ahmed (Worldsweet Gate)',
      login: 'worldsweet_guard',
      role: 'guard',
      gate: 'Worldsweet',
      location: 'Estate 2',
      device_type: 'tablet',
      salt: saltWorld,
      password_hash: hashPassword('world123', saltWorld),
      active: true,
      must_change: false,
      failed: 0
    };

    const systemKey = crypto.randomBytes(32).toString('hex');
    const nowStr = getFormattedNow();

    const initialState: DatabaseState = {
      version: 1,
      created_at: nowStr,
      system_key: systemKey,
      settings: DEFAULT_SETTINGS,
      seq: {},
      users: [
        adminUser,
        guard01,
        guard02,
        guard03,
        manager01,
        supervisorUser,
        guardUser,
        chocGuardUser,
        workGuardUser,
        worldGuardUser
      ],
      entries: [],
      interbranch_passes: [],
      notifications: [],
      photos: [],
      audit: []
    };

    if (process.env.SAVE_DATA_TO_JSON === 'true') {
      this.saveState(initialState);
    }
    return initialState;
  }

  private save() {
    // Strictly bypass JSON saving when SAVE_DATA_TO_JSON is false
    if (process.env.SAVE_DATA_TO_JSON === 'true') {
      this.saveState(this.state);
    }
  }

  private saveState(state: DatabaseState) {
    if (process.env.SAVE_DATA_TO_JSON !== 'true') {
      return; // Direct database mode: do not write to db.json
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Notice writing DB_FILE:', err);
    }
  }

  // --- Helpers ---
  public getSettings(): SystemSettings {
    const s = { ...this.state.settings };
    if (s.company_short === 'GFI LOGISTICS') s.company_short = '';
    if (s.app_name === 'GFI · Gate Register') s.app_name = 'Gate Register';
    return s;
  }

  public async updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
    const cleanSettings = { ...newSettings };
    if (cleanSettings.logo_url && typeof cleanSettings.logo_url === 'string' && cleanSettings.logo_url.startsWith('data:image/')) {
      const savedPath = saveBase64Image(cleanSettings.logo_url, 'logo', 'logo');
      if (savedPath) {
        cleanSettings.logo_url = savedPath;
      }
    }
    this.state.settings = { ...this.state.settings, ...cleanSettings };
    if (isMySQLConnected()) {
      await mysqlSaveSettings(this.state.settings);
    }
    this.save();
    return this.state.settings;
  }

  public getUsers(): AppUser[] {
    return this.state.users.map(u => ({ ...u, password_hash: '' }));
  }

  public findUserByLogin(login: string): AppUser | undefined {
    return this.state.users.find(u => u.login.toLowerCase() === login.toLowerCase());
  }

  public findUserById(id: string): AppUser | undefined {
    return this.state.users.find(u => u.id === id);
  }

  public verifyPassword(user: AppUser, passwordAttempt: string): boolean {
    const hashed = hashPassword(passwordAttempt, user.salt);
    return hashed === user.password_hash;
  }

  public async updateUser(userId: string, updates: {
    name?: string;
    role?: 'guard' | 'supervisor' | 'admin';
    gate?: string;
    location?: string;
    device_type?: 'tablet' | 'web';
    active?: boolean;
    password?: string;
  }): Promise<AppUser | null> {
    const user = this.findUserById(userId);
    if (!user) return null;

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.gate !== undefined) user.gate = updates.gate.trim();
    if (updates.location !== undefined) user.location = updates.location.trim();
    if (updates.device_type !== undefined) user.device_type = updates.device_type;
    if (updates.active !== undefined) user.active = Boolean(updates.active);

    if (updates.password && updates.password.trim()) {
      user.salt = crypto.randomBytes(16).toString('hex');
      user.password_hash = hashPassword(updates.password.trim(), user.salt);
      user.must_change = false;
      user.failed = 0;
    }

    if (isMySQLConnected()) {
      await mysqlSaveUser(user);
    }
    this.save();
    return { ...user, password_hash: '', salt: '' };
  }

  public async deleteUser(userId: string): Promise<boolean> {
    const idx = this.state.users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    this.state.users.splice(idx, 1);
    if (isMySQLConnected()) {
      await mysqlDeleteUser(userId);
    }
    this.save();
    return true;
  }

  public async updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
    const user = this.findUserById(userId);
    if (!user) return false;
    user.salt = crypto.randomBytes(16).toString('hex');
    user.password_hash = hashPassword(newPassword, user.salt);
    user.must_change = false;
    user.failed = 0;
    if (isMySQLConnected()) {
      await mysqlSaveUser(user);
    }
    this.save();
    return true;
  }

  public recordFailedLogin(userId: string) {
    const user = this.findUserById(userId);
    if (!user) return;
    user.failed = (user.failed || 0) + 1;
    if (isMySQLConnected()) {
      mysqlSaveUser(user).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    this.save();
  }

  public resetFailedLogin(userId: string) {
    const user = this.findUserById(userId);
    if (!user) return;
    user.failed = 0;
    if (isMySQLConnected()) {
      mysqlSaveUser(user).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    this.save();
  }

  // --- Location Management & Grouping ---
  public getFacilityLocations(mysqlLocs?: any[]): FacilityLocationItem[] {
    // If MySQL locations are provided, strictly return only those locations
    if (Array.isArray(mysqlLocs) && mysqlLocs.length > 0) {
      return mysqlLocs.map(ml => {
        const usersAtLoc = this.state.users.filter(u => (u.location || '').trim().toLowerCase() === ml.name.toLowerCase());
        return {
          id: ml.id || `loc-${ml.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: ml.name,
          code: ml.code || ml.name.substring(0, 4).toUpperCase(),
          address: ml.address || `${ml.name} Checkpoint Facility`,
          active: ml.active !== false,
          user_count: usersAtLoc.length,
          guards_count: usersAtLoc.filter(u => u.role === 'guard').length,
          supervisors_count: usersAtLoc.filter(u => u.role === 'supervisor').length,
          admins_count: usersAtLoc.filter(u => u.role === 'admin').length
        };
      });
    }

    const rawSetting = (this.state.settings.locations || '').trim();
    const namesSet = new Set<string>();

    if (rawSetting) {
      rawSetting.split(',').map(s => s.trim()).filter(Boolean).forEach(n => namesSet.add(n));
    } else {
      // If no locations configured, look at registered users
      this.state.users.forEach(u => {
        if (u.location && u.location.trim()) {
          namesSet.add(u.location.trim());
        }
      });
    }

    const list = Array.from(namesSet).sort();

    return list.map(name => {
      const usersAtLoc = this.state.users.filter(u => (u.location || '').trim().toLowerCase() === name.toLowerCase());
      const guardsCount = usersAtLoc.filter(u => u.role === 'guard').length;
      const supervisorsCount = usersAtLoc.filter(u => u.role === 'supervisor').length;
      const adminsCount = usersAtLoc.filter(u => u.role === 'admin').length;

      return {
        id: `loc-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        code: name.substring(0, 4).toUpperCase(),
        address: `${name} Checkpoint Facility`,
        active: true,
        user_count: usersAtLoc.length,
        guards_count: guardsCount,
        supervisors_count: supervisorsCount,
        admins_count: adminsCount
      };
    });
  }

  public async addFacilityLocation(data: { name: string; code?: string; address?: string }, user?: AppUser): Promise<FacilityLocationItem> {
    const trimmed = (data.name || '').trim();
    if (!trimmed) throw new Error('Location name is required');

    const raw = this.state.settings.locations || '';
    const existing = raw.split(',').map(s => s.trim()).filter(Boolean);

    if (existing.some(e => e.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Location '${trimmed}' already exists`);
    }

    existing.push(trimmed);
    this.state.settings.locations = existing.join(',');

    const locId = `loc-${Date.now()}`;
    const locItem: FacilityLocationItem = {
      id: locId,
      name: trimmed,
      code: data.code?.trim() || trimmed.substring(0, 4).toUpperCase(),
      address: data.address?.trim() || `${trimmed} Checkpoint Facility`,
      active: true,
      user_count: 0,
      guards_count: 0,
      supervisors_count: 0,
      admins_count: 0
    };

    if (isMySQLConnected()) {
      await mysqlSaveLocation(locItem).catch(e => console.warn('[MySQL Save Location]', e?.message || e));
      await mysqlSaveSettings(this.state.settings).catch(e => console.warn('[MySQL Save Settings]', e?.message || e));
    }

    if (user) {
      this.addAudit(user.id, user.name, 'LOCATION_CREATED', null, {
        location_name: trimmed,
        code: locItem.code,
        address: locItem.address
      });
    }

    this.save();
    return locItem;
  }

  public async updateFacilityLocation(oldName: string, data: { name?: string; code?: string; address?: string }, user?: AppUser): Promise<FacilityLocationItem | null> {
    const cleanOld = oldName.trim();
    const cleanNew = (data.name || cleanOld).trim();
    if (!cleanNew) throw new Error('Location name cannot be empty');

    const raw = this.state.settings.locations || '';
    let existing = raw.split(',').map(s => s.trim()).filter(Boolean);

    const idx = existing.findIndex(e => e.toLowerCase() === cleanOld.toLowerCase());
    if (idx !== -1) {
      existing[idx] = cleanNew;
    } else {
      existing.push(cleanNew);
    }
    this.state.settings.locations = Array.from(new Set(existing)).join(',');

    // If name changed, reassign users with oldName to cleanNew
    if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
      for (const u of this.state.users) {
        if ((u.location || '').trim().toLowerCase() === cleanOld.toLowerCase()) {
          u.location = cleanNew;
          if (isMySQLConnected()) {
            await mysqlSaveUser(u).catch(e => console.warn('[MySQL Update User Location]', e?.message || e));
          }
        }
      }
    }

    const locItem: FacilityLocationItem = {
      id: `loc-${cleanNew.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: cleanNew,
      code: data.code?.trim() || cleanNew.substring(0, 4).toUpperCase(),
      address: data.address?.trim() || `${cleanNew} Checkpoint Facility`,
      active: true,
      user_count: this.state.users.filter(u => (u.location || '').toLowerCase() === cleanNew.toLowerCase()).length,
      guards_count: this.state.users.filter(u => (u.location || '').toLowerCase() === cleanNew.toLowerCase() && u.role === 'guard').length,
      supervisors_count: this.state.users.filter(u => (u.location || '').toLowerCase() === cleanNew.toLowerCase() && u.role === 'supervisor').length,
      admins_count: this.state.users.filter(u => (u.location || '').toLowerCase() === cleanNew.toLowerCase() && u.role === 'admin').length
    };

    if (isMySQLConnected()) {
      if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
        await mysqlDeleteLocation(cleanOld).catch(() => {});
      }
      await mysqlSaveLocation(locItem).catch(e => console.warn('[MySQL Save Location]', e?.message || e));
      await mysqlSaveSettings(this.state.settings).catch(e => console.warn('[MySQL Save Settings]', e?.message || e));
    }

    if (user) {
      this.addAudit(user.id, user.name, 'LOCATION_UPDATED', null, {
        old_name: cleanOld,
        new_name: cleanNew,
        code: locItem.code
      });
    }

    this.save();
    return locItem;
  }

  public async deleteFacilityLocation(name: string, user?: AppUser): Promise<boolean> {
    const clean = name.trim();
    const raw = this.state.settings.locations || '';
    let existing = raw.split(',').map(s => s.trim()).filter(Boolean);

    existing = existing.filter(e => e.toLowerCase() !== clean.toLowerCase());
    this.state.settings.locations = existing.join(',');

    if (isMySQLConnected()) {
      await mysqlDeleteLocation(clean).catch(e => console.warn('[MySQL Delete Location]', e?.message || e));
      await mysqlSaveSettings(this.state.settings).catch(e => console.warn('[MySQL Save Settings]', e?.message || e));
    }

    if (user) {
      this.addAudit(user.id, user.name, 'LOCATION_DELETED', null, {
        location_name: clean
      });
    }

    this.save();
    return true;
  }

  // --- Session Management ---
  public createSession(
    userId: string,
    login: string,
    device?: string,
    ip?: string,
    device_type?: 'tablet' | 'web',
    gate?: string,
    location?: string
  ): { sessionId: string; refreshToken: string } {
    if (!this.state.sessions) {
      this.state.sessions = [];
    }
    const sessionId = `sess-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const nowStr = getFormattedNow();

    const session: UserSession = {
      sessionId,
      userId,
      login,
      refreshToken,
      device: device || 'Web Browser',
      device_type: device_type || 'web',
      gate: gate || 'Main Gate',
      location: location || 'Estate 1',
      ip: ip || 'unknown',
      created_at: nowStr,
      last_active_at: nowStr,
      active: true
    };

    this.state.sessions.push(session);
    if (this.state.sessions.length > 300) {
      this.state.sessions = this.state.sessions.slice(-300);
    }
    if (isMySQLConnected()) {
      mysqlSaveSession(session).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    this.save();
    return { sessionId, refreshToken };
  }

  public validateSession(sessionId: string): UserSession | null {
    if (!this.state.sessions) return null;
    const sess = this.state.sessions.find(s => s.sessionId === sessionId && s.active);
    if (!sess) return null;
    sess.last_active_at = getFormattedNow();
    if (isMySQLConnected()) {
      mysqlSaveSession(sess).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    return sess;
  }

  public rotateRefreshToken(sessionId: string, oldRefreshToken: string): string | null {
    if (!this.state.sessions) return null;
    const sess = this.state.sessions.find(s => s.sessionId === sessionId && s.refreshToken === oldRefreshToken && s.active);
    if (!sess) return null;
    const newRefresh = crypto.randomBytes(32).toString('hex');
    sess.refreshToken = newRefresh;
    sess.last_active_at = getFormattedNow();
    if (isMySQLConnected()) {
      mysqlSaveSession(sess).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    this.save();
    return newRefresh;
  }

  public revokeSession(sessionId: string): boolean {
    if (!this.state.sessions) return false;
    const sess = this.state.sessions.find(s => s.sessionId === sessionId);
    if (sess) {
      sess.active = false;
      if (isMySQLConnected()) {
        mysqlSaveSession(sess).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
      this.save();
      return true;
    }
    return false;
  }

  public getActiveSessionsForUser(userId: string): UserSession[] {
    if (!this.state.sessions) return [];
    return this.state.sessions.filter(s => s.userId === userId && s.active);
  }

  // --- Sequences & Codes ---
  public peekNextCode(): string {
    const nextSeq = this.getNextSequenceNumber();
    return String(nextSeq).padStart(6, '0');
  }

  public getNextSequenceNumber(): number {
    let max = this.state.seq['GLOBAL_SERIAL'] || 0;
    for (const e of this.state.entries) {
      if (/^\d{1,6}$/.test(e.code)) {
        const num = parseInt(e.code, 10);
        if (!isNaN(num) && num > max) {
          max = num;
        }
      }
    }
    return max + 1;
  }

  public getNextCode(preferredCode?: string): string {
    if (preferredCode && preferredCode.trim()) {
      const clean = preferredCode.trim().toUpperCase();
      if (!this.state.entries.some(e => e.code.toUpperCase() === clean)) {
        if (/^\d+$/.test(clean)) {
          const num = parseInt(clean, 10);
          if (num >= (this.state.seq['GLOBAL_SERIAL'] || 0)) {
            this.state.seq['GLOBAL_SERIAL'] = num;
            this.save();
          }
        }
        return clean;
      }
    }

    const next = this.getNextSequenceNumber();
    this.state.seq['GLOBAL_SERIAL'] = next;
    this.save();
    return String(next).padStart(6, '0');
  }

  // --- Entries ---
  public async getEntries(): Promise<GateEntry[]> {
    if (isMySQLConnected()) {
      const freshEntries = await mysqlGetEntries();
      if (freshEntries.length > 0) {
        this.state.entries = freshEntries;
      }
      return freshEntries;
    }
    return this.state.entries;
  }

  public getCachedEntries(): GateEntry[] {
    return this.state.entries;
  }

  public async getEntryByCode(code: string): Promise<GateEntry | undefined> {
    const cleaned = code.trim().toUpperCase();
    if (isMySQLConnected()) {
      const directEntry = await mysqlGetEntryByCode(cleaned);
      if (directEntry) return directEntry;
    }
    return this.state.entries.find(e => e.code.toUpperCase() === cleaned);
  }

  public async createEntry(entryData: Omit<GateEntry, 'id' | 'code' | 'at' | 'prints' | 'corrections' | 'cancelled' | 'duplicate_of'> & { code?: string }): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked. App strictly requires an active MySQL connection.');
    }

    const nowStr = getFormattedNow();
    const code = this.getNextCode(entryData.code);

    // Duplicate detection for same document no and party
    const docClean = (entryData.doc_no || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const partyClean = (entryData.party || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const duplicates = (docClean && partyClean)
      ? this.state.entries
          .filter(e => !e.cancelled && e.doc_no && e.party)
          .filter(e => {
            const eDoc = e.doc_no.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const eParty = e.party.toLowerCase().replace(/[^a-z0-9]/g, '');
            return eDoc === docClean && eParty === partyClean;
          })
          .map(e => e.code)
      : [];

    const newEntry: GateEntry = {
      ...entryData,
      id: `ent-${Date.now()}`,
      code,
      at: nowStr,
      duplicate_of: duplicates,
      prints: 0,
      corrections: [],
      cancelled: null
    };

    // If this is returning an existing returnable out item
    if (entryData.dir === 'IN' && entryData.against) {
      const orig = await this.getEntryByCode(entryData.against);
      if (orig && orig.dir === 'OUT' && orig.returnable) {
        orig.returned_at = nowStr;
        orig.return_code = code;
        await mysqlSaveEntry(orig);
      }
    }

    // Direct save to MySQL
    await mysqlSaveEntry(newEntry);
    this.state.entries.unshift(newEntry);

    this.addAudit(entryData.guard_id, entryData.guard_name, entryData.dir === 'IN' ? 'MATERIAL_IN' : 'MATERIAL_OUT', code, {
      party: newEntry.party,
      vehicle: newEntry.vehicle_no,
      doc: `${newEntry.doc_type} ${newEntry.doc_no}`,
      amount: newEntry.amount,
      stage: newEntry.stage
    });

    this.save();
    return newEntry;
  }

  public async updateEntryStage(code: string, newStage: GateStage, userId: string, userName: string): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Entry not found');
    const oldStage = entry.stage;
    entry.stage = newStage;

    if (newStage === 'cleared' && !entry.vehicle_out_at && entry.dir === 'IN') {
      entry.vehicle_out_at = getFormattedNow();
    }

    this.addAudit(userId, userName, 'STAGE_CHANGE', code, { from: oldStage, to: newStage });
    await mysqlSaveEntry(entry);
    this.save();
    return entry;
  }

  public async markVehicleLeft(code: string, userId: string, userName: string): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Entry not found');
    entry.vehicle_out_at = getFormattedNow();
    entry.stage = 'cleared';
    this.addAudit(userId, userName, 'VEHICLE_LEFT', code, { vehicle: entry.vehicle_no });
    await mysqlSaveEntry(entry);
    this.save();
    return entry;
  }

  public async incrementPrints(code: string, userId: string, userName: string, format: string): Promise<GateEntry> {
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Entry not found');
    entry.prints = (entry.prints || 0) + 1;
    this.addAudit(userId, userName, entry.prints === 1 ? 'PRINTED_SLIP' : 'REPRINTED_SLIP', code, { format, print_count: entry.prints });
    if (isMySQLConnected()) {
      await mysqlSaveEntry(entry);
    }
    this.save();
    return entry;
  }

  public async addCorrection(code: string, field: string, newValue: string, reason: string, userId: string, userName: string): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Entry not found');
    const oldValue = (entry as any)[field] !== undefined ? String((entry as any)[field]) : '';

    (entry as any)[field] = field === 'vehicle_no' ? newValue.toUpperCase() : newValue;

    entry.corrections.push({
      at: getFormattedNow(),
      by: userId,
      by_name: userName,
      field,
      old: oldValue,
      new: newValue,
      reason
    });

    this.addAudit(userId, userName, 'CORRECTION_MADE', code, { field, old: oldValue, new: newValue, reason });
    await mysqlSaveEntry(entry);
    this.save();
    return entry;
  }

  public async cancelEntry(code: string, reason: string, userId: string, userName: string): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Entry not found');
    entry.cancelled = {
      at: getFormattedNow(),
      by: userId,
      by_name: userName,
      reason
    };

    if (entry.against) {
      const orig = await this.getEntryByCode(entry.against);
      if (orig && orig.return_code === entry.code) {
        orig.returned_at = null;
        orig.return_code = null;
        await mysqlSaveEntry(orig);
      }
    }

    this.addAudit(userId, userName, 'ENTRY_CANCELLED', code, { reason });
    await mysqlSaveEntry(entry);
    this.save();
    return entry;
  }

  public async recordReturn(code: string, returnData: {
    guard_id: string;
    guard_name: string;
    vehicle_type?: string;
    vehicle_no?: string;
    driver?: string;
    driver_id?: string;
    doc_type?: string;
    doc_no?: string;
    returned_items?: GateItem[];
    remarks?: string;
    photos?: { data_url: string; note?: string }[];
  }): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Original OUT entry not found');
    if (entry.dir !== 'OUT') throw new Error('Only OUT entries can be marked returned');

    const nowStr = getFormattedNow();
    entry.returned_at = nowStr;
    entry.return_code = entry.code;

    entry.return_details = {
      returned_at: nowStr,
      guard_id: returnData.guard_id,
      guard_name: returnData.guard_name,
      vehicle_type: returnData.vehicle_type || entry.vehicle_type,
      vehicle_no: returnData.vehicle_no ? returnData.vehicle_no.toUpperCase().trim() : entry.vehicle_no,
      driver: returnData.driver || entry.driver,
      driver_id: returnData.driver_id || entry.driver_id,
      doc_type: returnData.doc_type || 'Return note',
      doc_no: returnData.doc_no || '',
      items: returnData.returned_items && returnData.returned_items.length > 0 ? returnData.returned_items : entry.items,
      remarks: returnData.remarks || 'Returned back to factory',
      photos_count: returnData.photos?.length || 0
    };

    if (returnData.photos && Array.isArray(returnData.photos)) {
      for (const p of returnData.photos) {
        if (p.data_url) {
          await this.addPhoto({
            entry_id: entry.id,
            data_url: p.data_url,
            note: p.note || `Return document / item photo (${nowStr})`,
            mime: 'image/jpeg',
            captured_by: returnData.guard_id
          });
        }
      }
    }

    this.addAudit(returnData.guard_id, returnData.guard_name, 'ITEM_RETURNED', entry.code, {
      party: entry.party,
      vehicle_no: returnData.vehicle_no || entry.vehicle_no,
      returned_at: nowStr,
      items: entry.return_details.items,
      remarks: returnData.remarks
    });

    await mysqlSaveEntry(entry);
    this.save();
    return entry;
  }

  public async acknowledgeInterBranchReceipt(code: string, data: {
    guard_id: string;
    guard_name: string;
    receiving_branch?: string;
    receiving_gate?: string;
    received_items?: { item_id: string; qty: number }[];
    remarks?: string;
  }): Promise<GateEntry> {
    if (!isMySQLConnected()) {
      throw new Error('MySQL database is not connected. Operation blocked.');
    }
    const entry = await this.getEntryByCode(code);
    if (!entry) throw new Error('Transfer entry not found');

    const nowStr = getFormattedNow();
    const details: InterBranchDetails = entry.inter_branch_details || {
      from_branch: entry.from_branch || entry.location || 'Origin Branch',
      to_branch: entry.to_branch || entry.party || 'Destination Branch',
      status: 'in_transit',
      dispatched_at: entry.at,
      dispatched_guard: entry.guard_name
    };

    details.destination_received_at = nowStr;
    details.destination_received_gate = data.receiving_gate || entry.gate || 'Main Gate';
    details.destination_received_guard = data.guard_name;
    details.destination_receipt_remarks = data.remarks || 'Material acknowledged at destination branch';

    // Initialize or update tracking
    if (!details.items_tracking || details.items_tracking.length === 0) {
      details.items_tracking = entry.items.map(i => {
        const matchingRec = data.received_items?.find(r => r.item_id === i.id);
        const recQty = matchingRec !== undefined ? matchingRec.qty : i.qty;
        return {
          item_id: i.id,
          desc: i.desc,
          sent_qty: i.qty,
          received_qty: recQty,
          returned_qty: 0,
          unit: i.unit
        };
      });
    } else if (data.received_items && data.received_items.length > 0) {
      data.received_items.forEach((r, idx) => {
        const trk = details.items_tracking?.find(t => t.item_id === r.item_id) || details.items_tracking?.[idx];
        if (trk) {
          trk.received_qty = Number(r.qty);
        }
      });
    } else {
      details.items_tracking.forEach(trk => {
        if (!trk.received_qty) trk.received_qty = trk.sent_qty;
      });
    }

    if (entry.returnable) {
      details.status = 'pending_return';
    } else {
      details.status = 'completed';
      entry.stage = 'cleared';
    }

    entry.inter_branch_details = details;
    await mysqlSaveEntry(entry);
    this.save();

    this.addAudit(data.guard_id, data.guard_name, 'INTER_BRANCH_RECEIVED', entry.code, {
      from: details.from_branch,
      to: details.to_branch,
      status: details.status,
      remarks: data.remarks
    });

    return entry;
  }

  // --- Photos ---
  public async addPhoto(photoData: { entry_id: string; data_url: string; note: string; mime: string; captured_by: string }): Promise<GatePhoto> {
    const photoId = `pho-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let publicUrl = photoData.data_url;
    let bufferLength = 0;
    let sha = '';

    if (photoData.data_url && photoData.data_url.startsWith('data:image/')) {
      const base64Content = photoData.data_url.split(',')[1] || photoData.data_url;
      const buffer = Buffer.from(base64Content, 'base64');
      bufferLength = buffer.length;
      sha = crypto.createHash('sha256').update(buffer).digest('hex');
      const savedPath = saveBase64Image(photoData.data_url, 'photos', 'photo');
      if (savedPath) {
        publicUrl = savedPath;
      }
    } else {
      bufferLength = photoData.data_url ? photoData.data_url.length : 0;
      sha = crypto.createHash('sha256').update(photoData.data_url || '').digest('hex');
    }

    const newPhoto: GatePhoto = {
      id: photoId,
      entry_id: photoData.entry_id,
      data_url: publicUrl,
      note: photoData.note || 'Invoice / Document photo',
      mime: photoData.mime || 'image/jpeg',
      size: bufferLength,
      sha256: sha,
      captured_by: photoData.captured_by,
      at: getFormattedNow()
    };

    this.state.photos.push(newPhoto);
    if (isMySQLConnected()) {
      await mysqlSavePhoto(newPhoto);
    }
    this.save();
    return newPhoto;
  }

  public getPhotosForEntry(entryId: string): GatePhoto[] {
    return this.state.photos.filter(p => p.entry_id === entryId);
  }

  // --- Audit Trail ---
  public addAudit(userId: string, userName: string, action: string, code: string | null, details: any) {
    const prev = this.state.audit.length > 0 ? this.state.audit[this.state.audit.length - 1].hash : 'GENESIS';
    const nowStr = getFormattedNow();
    const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
    const hash = sha256(`${this.state.system_key}|${prev}|${nowStr}|${userId}|${action}|${code || ''}|${detailsStr}`);

    const log: AuditLog = {
      id: this.state.audit.length + 1,
      ts: nowStr,
      user_id: userId,
      user_name: userName,
      action,
      code,
      details: detailsStr,
      prev_hash: prev,
      hash
    };

    this.state.audit.push(log);
    if (isMySQLConnected()) {
      mysqlSaveAudit(log).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
  }

  public getAuditLogs(code?: string): AuditLog[] {
    if (code) {
      const clean = code.trim().toUpperCase();
      return this.state.audit.filter(a => a.code?.toUpperCase() === clean);
    }
    return this.state.audit.slice(-500).reverse();
  }

  public verifyAuditIntegrity(): { valid: boolean; checkedCount: number; errors: string[] } {
    let prev = 'GENESIS';
    const errors: string[] = [];

    for (const a of this.state.audit) {
      if (a.prev_hash !== prev) {
        errors.push(`Audit record #${a.id} chain break: prev_hash mismatch`);
      }
      const recalculated = sha256(`${this.state.system_key}|${a.prev_hash}|${a.ts}|${a.user_id}|${a.action}|${a.code || ''}|${a.details}`);
      if (recalculated !== a.hash) {
        errors.push(`Audit record #${a.id} content was modified or tampered`);
      }
      prev = a.hash;
    }

    return {
      valid: errors.length === 0,
      checkedCount: this.state.audit.length,
      errors
    };
  }

  // --- Statistics ---
  public async getStats() {
    const todayStr = getFormattedNow().slice(0, 10);
    const entries = await this.getEntries();

    const todayIn = entries.filter(e => !e.cancelled && e.dir === 'IN' && e.at.startsWith(todayStr)).length;
    const todayOut = entries.filter(e => !e.cancelled && e.dir === 'OUT' && e.at.startsWith(todayStr)).length;

    const vehiclesInside = entries.filter(e => !e.cancelled && e.dir === 'IN' && !e.vehicle_out_at && e.vehicle_type !== 'Hand carried').length;

    const overdueReturnables = entries.filter(e => !e.cancelled && e.dir === 'OUT' && e.returnable && !e.returned_at && e.expected_return && e.expected_return < todayStr).length;

    const stageBreakdown = {
      at_gate: entries.filter(e => !e.cancelled && e.stage === 'at_gate').length,
      dock_weighbridge: entries.filter(e => !e.cancelled && e.stage === 'dock_weighbridge').length,
      inspection_unloading: entries.filter(e => !e.cancelled && e.stage === 'inspection_unloading').length,
      cleared: entries.filter(e => !e.cancelled && e.stage === 'cleared').length
    };

    return {
      todayIn,
      todayOut,
      vehiclesInside,
      overdueReturnables,
      totalEntries: entries.length,
      stageBreakdown
    };
  }

  // --- Inter-Branch & Multi-Location Transfers ---
  public async getInterBranchGatePasses(filters: {
    status?: string;
    from_branch?: string;
    to_branch?: string;
    q?: string;
    date_from?: string;
    date_to?: string;
    branch?: string;
  } = {}): Promise<InterBranchGatePass[]> {
    if (!this.state.interbranch_passes) {
      this.state.interbranch_passes = [];
    }

    // Sync any existing GateEntry that has inter_branch_details or movement_type Inter-Location / Inter-Branch
    const entries = await this.getEntries();
    for (const e of entries) {
      if (
        (e.movement_type === 'Inter-Location Transfer' || e.movement_type === 'Inter-Branch Transfer' || e.inter_branch_details) &&
        !this.state.interbranch_passes.some(p => p.id === e.id || p.gate_pass_no === e.code || p.code === e.code)
      ) {
        const ib = e.inter_branch_details;
        let passStatus: InterBranchStatus = 'AWAITING_DISPATCH';
        if (ib?.status) {
          const s = String(ib.status).toUpperCase();
          if (s === 'IN_TRANSIT') passStatus = 'IN_TRANSIT';
          else if (s === 'RECEIVED') passStatus = 'RECEIVED';
          else if (s === 'PENDING_RETURN') passStatus = 'PENDING_RETURN';
          else if (s === 'RETURN_IN_TRANSIT') passStatus = 'RETURN_IN_TRANSIT';
          else if (s === 'COMPLETED') passStatus = 'COMPLETED';
          else if (s === 'GATE_HOLD') passStatus = 'GATE_HOLD';
          else passStatus = 'IN_TRANSIT';
        } else if (e.stage === 'cleared') {
          passStatus = e.returnable ? 'PENDING_RETURN' : 'COMPLETED';
        }

        const items: InterBranchItem[] = e.items.map((i, idx) => {
          const tracking = ib?.items_tracking?.find(t => t.item_id === i.id || t.desc === i.desc);
          return {
            id: i.id || `itm-${e.id}-${idx}`,
            item_code: `ITM-${String(idx + 1).padStart(3, '0')}`,
            description: i.desc,
            unit: i.unit,
            dispatch_qty: i.qty,
            received_qty: tracking?.received_qty || 0,
            returned_qty: tracking?.returned_qty || 0,
            difference: 0
          };
        });

        this.state.interbranch_passes.push({
          id: e.id,
          gate_pass_no: e.code,
          code: e.code,
          from_branch: e.from_branch || ib?.from_branch || e.location || 'Estate 1',
          to_branch: e.to_branch || ib?.to_branch || e.party || 'Kamonki',
          movement_type: e.movement_type,
          status: passStatus,
          department: e.dept || 'Logistics',
          purpose: e.purpose || 'Inter-Location Transfer',
          vehicle_no: e.vehicle_no || 'NO VEHICLE',
          vehicle_type: e.vehicle_type || 'Truck',
          driver_name: e.driver || 'Driver',
          driver_id: e.driver_id || '',
          driver_mobile: '',
          returnable: Boolean(e.returnable),
          expected_return_date: e.expected_return,
          items,
          created_at: e.at,
          created_by: e.guard_id,
          created_by_name: e.guard_name,
          remarks: e.remarks,
          gate_out_at: ib?.dispatched_at || e.at,
          gate_out_by_name: ib?.dispatched_guard || e.guard_name,
          gate_in_at: ib?.destination_received_at,
          gate_in_by_name: ib?.destination_received_guard,
          gate_in_remarks: ib?.destination_receipt_remarks,
          return_dispatched_at: ib?.return_dispatched_at,
          return_dispatched_by: ib?.return_by,
          return_vehicle_no: ib?.return_vehicle_no,
          return_driver: ib?.return_driver,
          return_driver_id: ib?.return_driver_id,
          return_remarks: ib?.return_remarks,
          return_received_at: ib?.origin_received_at,
          return_received_by: ib?.origin_received_guard,
          return_received_remarks: ib?.origin_receipt_remarks
        });
      }
    }

    let result = [...this.state.interbranch_passes];

    if (filters.status && filters.status !== 'ALL') {
      const targetStatus = filters.status.toUpperCase();
      result = result.filter(p => p.status.toUpperCase() === targetStatus);
    }

    if (filters.from_branch && filters.from_branch !== 'ALL') {
      result = result.filter(p => p.from_branch.toLowerCase() === filters.from_branch!.toLowerCase());
    }

    if (filters.to_branch && filters.to_branch !== 'ALL') {
      result = result.filter(p => p.to_branch.toLowerCase() === filters.to_branch!.toLowerCase());
    }

    if (filters.branch && filters.branch !== 'ALL') {
      const b = filters.branch.toLowerCase();
      result = result.filter(p => p.from_branch.toLowerCase() === b || p.to_branch.toLowerCase() === b);
    }

    if (filters.date_from) {
      result = result.filter(p => p.created_at.slice(0, 10) >= filters.date_from!);
    }

    if (filters.date_to) {
      result = result.filter(p => p.created_at.slice(0, 10) <= filters.date_to!);
    }

    if (filters.q) {
      const q = filters.q.toLowerCase().trim();
      result = result.filter(p =>
        p.gate_pass_no.toLowerCase().includes(q) ||
        p.vehicle_no.toLowerCase().includes(q) ||
        p.driver_name.toLowerCase().includes(q) ||
        p.from_branch.toLowerCase().includes(q) ||
        p.to_branch.toLowerCase().includes(q) ||
        p.items.some(i => i.description.toLowerCase().includes(q))
      );
    }

    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  public async getInterBranchGatePassByNo(no: string): Promise<InterBranchGatePass | undefined> {
    const passes = await this.getInterBranchGatePasses();
    const clean = no.trim().toUpperCase();
    return passes.find(p => p.gate_pass_no.toUpperCase() === clean || p.code?.toUpperCase() === clean);
  }

  public async getInterBranchGatePassById(id: string): Promise<InterBranchGatePass | undefined> {
    const passes = await this.getInterBranchGatePasses();
    return passes.find(p => p.id === id);
  }

  public async createInterBranchGatePass(data: any, user: AppUser): Promise<InterBranchGatePass> {
    const nowStr = getFormattedNow();
    const year = new Date().getFullYear();
    const nextSeq = this.getNextSequenceNumber();
    this.state.seq['GLOBAL_SERIAL'] = nextSeq;
    const passNo = `GP-${year}-${String(nextSeq).padStart(6, '0')}`;

    const fromBranch = (data.from_branch || user.location || 'Estate 1').trim();
    const toBranch = (data.to_branch || '').trim();

    if (!toBranch) {
      throw new Error('Destination (To Location) is required.');
    }
    if (fromBranch.toLowerCase() === toBranch.toLowerCase()) {
      throw new Error('From Location and To Location cannot be the same.');
    }

    const rawItems: any[] = data.items || [];
    if (rawItems.length === 0) {
      throw new Error('At least one item must be recorded.');
    }

    const items: InterBranchItem[] = rawItems.map((i, idx) => ({
      id: `itm-${Date.now()}-${idx}`,
      item_code: i.item_code || `ITM-${String(idx + 1).padStart(3, '0')}`,
      description: String(i.description || i.desc || '').trim(),
      unit: String(i.unit || 'PCS').trim(),
      dispatch_qty: Number(i.dispatch_qty || i.qty) || 0,
      received_qty: 0,
      returned_qty: 0,
      difference: 0,
      remarks: i.remarks || '',
      batch_no: i.batch_no || '',
      serial_no: i.serial_no || ''
    })).filter(i => i.description && i.dispatch_qty > 0);

    if (items.length === 0) {
      throw new Error('Each item must have a description and positive quantity.');
    }

    const returnable = Boolean(data.returnable);
    const newPass: InterBranchGatePass = {
      id: `ib-${Date.now()}`,
      gate_pass_no: passNo,
      code: passNo,
      from_branch: fromBranch,
      to_branch: toBranch,
      movement_type: 'Inter-Location Transfer',
      status: 'AWAITING_DISPATCH',
      department: data.department || 'Logistics',
      purpose: data.purpose || 'Inter-Location Transfer',
      vehicle_no: (data.vehicle_no || '').trim().toUpperCase(),
      vehicle_type: data.vehicle_type || 'Truck',
      driver_name: (data.driver_name || data.driver || '').trim(),
      driver_id: (data.driver_id || '').trim(),
      driver_mobile: (data.driver_mobile || '').trim(),
      returnable,
      expected_return_date: data.expected_return_date || (returnable ? data.expected_return : null) || null,
      items,
      created_at: nowStr,
      created_by: user.id,
      created_by_name: user.name,
      remarks: data.remarks || '',
      gate_out_at: null,
      gate_out_by: null,
      gate_in_at: null,
      gate_in_by: null
    };

    if (!this.state.interbranch_passes) {
      this.state.interbranch_passes = [];
    }
    this.state.interbranch_passes.unshift(newPass);

    // Also create corresponding GateEntry in entries list and sync to MySQL
    const itemsSummary = items.map(i => `${i.description} (${i.dispatch_qty} ${i.unit})`).join(', ');
    const entry: GateEntry = {
      id: newPass.id,
      code: passNo,
      dir: 'OUT',
      movement_type: 'Inter-Location Transfer',
      from_branch: fromBranch,
      to_branch: toBranch,
      inter_branch_details: {
        from_branch: fromBranch,
        to_branch: toBranch,
        status: 'in_transit',
        dispatched_at: nowStr,
        dispatched_guard: user.name,
        items_tracking: items.map(i => ({
          item_id: i.id || '',
          desc: i.description,
          sent_qty: i.dispatch_qty,
          received_qty: 0,
          returned_qty: 0,
          unit: i.unit
        }))
      },
      gate: user.gate || 'Main Gate',
      location: fromBranch,
      device_type: user.device_type || 'web',
      guard_id: user.id,
      guard_name: user.name,
      purpose: newPass.purpose,
      party: toBranch,
      vehicle_type: newPass.vehicle_type || 'Truck',
      vehicle_no: newPass.vehicle_no,
      driver: newPass.driver_name,
      driver_id: newPass.driver_id || '',
      doc_type: 'Gate pass',
      doc_no: passNo,
      amount: null,
      po_no: '',
      authorised_by: user.name,
      dept: newPass.department || 'Logistics',
      items: items.map(i => ({ id: i.id || '', desc: i.description, qty: i.dispatch_qty, unit: i.unit })),
      weight: null,
      packages: items.reduce((acc, itm) => acc + itm.dispatch_qty, 0),
      person: newPass.driver_name,
      remarks: newPass.remarks || '',
      returnable,
      expected_return: newPass.expected_return_date || null,
      returned_at: null,
      return_code: null,
      against: null,
      duplicate_of: [],
      vehicle_out_at: null,
      stage: 'at_gate',
      prints: 0,
      corrections: [],
      cancelled: null,
      at: nowStr
    };

    if (isMySQLConnected()) {
      await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
    }
    this.state.entries.unshift(entry);

    // Automatic notification to destination location
    this.addNotification({
      target_location: toBranch,
      from_location: fromBranch,
      code: passNo,
      type: 'new_incoming',
      title: '🔔 New Incoming Material',
      message: `Gate Pass ${passNo} has been created from ${fromBranch} to ${toBranch}. Material: ${itemsSummary}. Returnable: ${returnable ? 'YES' : 'NO'}. Vehicle: ${newPass.vehicle_no}, Driver: ${newPass.driver_name}. Status: Awaiting Dispatch.`,
      metadata: {
        pass_no: passNo,
        from_branch: fromBranch,
        to_branch: toBranch,
        returnable,
        vehicle: newPass.vehicle_no,
        driver: newPass.driver_name,
        materials: itemsSummary
      }
    });

    this.addAudit(user.id, user.name, 'INTER_BRANCH_CREATED', passNo, {
      from: fromBranch,
      to: toBranch,
      returnable,
      items: itemsSummary,
      vehicle: newPass.vehicle_no
    });

    this.save();
    return newPass;
  }

  public async verifyGateOut(id: string, user: AppUser, checklist: any = {}, remarks: string = ''): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    const nowStr = getFormattedNow();
    pass.status = 'IN_TRANSIT';
    pass.gate_out_at = nowStr;
    pass.gate_out_by = user.id;
    pass.gate_out_by_name = user.name;
    pass.gate_out_gate = user.gate || 'Main Gate';
    pass.gate_out_checklist = checklist;
    pass.gate_out_remarks = remarks;

    // Update corresponding GateEntry
    const entry = await this.getEntryByCode(pass.gate_pass_no);
    if (entry) {
      entry.stage = 'cleared';
      entry.vehicle_out_at = nowStr;
      if (entry.inter_branch_details) {
        entry.inter_branch_details.status = 'in_transit';
        entry.inter_branch_details.dispatched_at = nowStr;
        entry.inter_branch_details.dispatched_guard = user.name;
      }
      if (isMySQLConnected()) {
        await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
    }

    // Automatic notification to destination location
    this.addNotification({
      target_location: pass.to_branch,
      from_location: pass.from_branch,
      code: pass.gate_pass_no,
      type: 'in_transit',
      title: '🔔 Material In Transit',
      message: `${pass.gate_pass_no} From: ${pass.from_branch} To: ${pass.to_branch}. Status: IN TRANSIT. The vehicle has departed ${pass.from_branch} (Vehicle: ${pass.vehicle_no}, Driver: ${pass.driver_name}).`,
      metadata: {
        pass_no: pass.gate_pass_no,
        from_branch: pass.from_branch,
        to_branch: pass.to_branch,
        vehicle: pass.vehicle_no,
        driver: pass.driver_name
      }
    });

    this.addAudit(user.id, user.name, 'INTER_BRANCH_GATE_OUT', pass.gate_pass_no, {
      from: pass.from_branch,
      to: pass.to_branch,
      vehicle: pass.vehicle_no,
      dispatched_at: nowStr
    });

    this.save();
    return pass;
  }

  public async verifyGateIn(id: string, user: AppUser, receivedItemsData: any[] = [], checklist: any = {}, remarks: string = ''): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    // Strict Location Check as specified in Requirement 12
    if (user.role !== 'admin' && user.location && pass.to_branch) {
      if (user.location.trim().toLowerCase() !== pass.to_branch.trim().toLowerCase()) {
        throw new Error(`Receipt Not Allowed: This Gate Pass is assigned to ${pass.to_branch}. Current location: ${user.location}.`);
      }
    }

    const nowStr = getFormattedNow();
    let hasDiff = false;
    let hasDamage = false;

    // Update quantities and difference
    pass.items.forEach((item, idx) => {
      const rec = receivedItemsData.find((r: any) => r.id === item.id) || receivedItemsData[idx];
      if (rec) {
        item.received_qty = Number(rec.received_qty !== undefined ? rec.received_qty : item.dispatch_qty);
        item.damaged_qty = Number(rec.damaged_qty || 0);
        item.difference = item.received_qty - item.dispatch_qty;
        if (item.difference !== 0) hasDiff = true;
        if (item.damaged_qty > 0) hasDamage = true;
        if (rec.remarks) item.remarks = rec.remarks;
      } else {
        item.received_qty = item.dispatch_qty;
        item.difference = 0;
      }
    });

    pass.gate_in_at = nowStr;
    pass.gate_in_by = user.id;
    pass.gate_in_by_name = user.name;
    pass.gate_in_gate = user.gate || 'Main Gate';
    pass.gate_in_checklist = checklist;
    pass.gate_in_remarks = remarks;
    pass.has_difference = hasDiff;
    pass.has_damage = hasDamage;

    // Requirement 14 & 15: Returnable vs Non-Returnable Transition
    if (pass.returnable) {
      pass.status = 'PENDING_RETURN';
    } else {
      pass.status = hasDiff ? 'RECEIVED_WITH_DIFFERENCE' : (hasDamage ? 'RECEIVED_WITH_DAMAGE' : 'COMPLETED');
    }

    // Update corresponding GateEntry
    const entry = await this.getEntryByCode(pass.gate_pass_no);
    if (entry) {
      if (entry.inter_branch_details) {
        entry.inter_branch_details.destination_received_at = nowStr;
        entry.inter_branch_details.destination_received_guard = user.name;
        entry.inter_branch_details.destination_receipt_remarks = remarks;
        entry.inter_branch_details.status = pass.returnable ? 'pending_return' : 'completed';
        if (entry.inter_branch_details.items_tracking) {
          pass.items.forEach(pi => {
            const trk = entry.inter_branch_details!.items_tracking!.find(t => t.item_id === pi.id || t.desc === pi.description);
            if (trk) {
              trk.received_qty = pi.received_qty || pi.dispatch_qty;
            }
          });
        }
      }
      if (!pass.returnable) {
        entry.stage = 'cleared';
      }
      if (isMySQLConnected()) {
        await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
    }

    // Notification to Origin Sending Location
    if (pass.returnable) {
      this.addNotification({
        target_location: pass.from_branch,
        from_location: pass.to_branch,
        code: pass.gate_pass_no,
        type: 'pending_return',
        title: '🔔 Material Received at Destination (Pending Return)',
        message: `${pass.gate_pass_no} received at ${pass.to_branch}. Material is returnable and now marked as PENDING RETURN at ${pass.to_branch}.`,
        metadata: { pass_no: pass.gate_pass_no, to_branch: pass.to_branch }
      });
    } else {
      this.addNotification({
        target_location: pass.from_branch,
        from_location: pass.to_branch,
        code: pass.gate_pass_no,
        type: 'completed',
        title: '🔔 Material Received at Destination',
        message: `${pass.gate_pass_no} received at ${pass.to_branch}. Transfer COMPLETED.${hasDiff ? ' (Quantity differences reported)' : ''}`,
        metadata: { pass_no: pass.gate_pass_no, to_branch: pass.to_branch, hasDiff, hasDamage }
      });
    }

    this.addAudit(user.id, user.name, 'INTER_BRANCH_GATE_IN', pass.gate_pass_no, {
      from: pass.from_branch,
      to: pass.to_branch,
      status: pass.status,
      hasDiff,
      hasDamage,
      received_at: nowStr
    });

    this.save();
    return pass;
  }

  public async dispatchInterBranchReturn(id: string, data: any, user: AppUser): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    const nowStr = getFormattedNow();
    pass.status = 'RETURN_IN_TRANSIT';
    pass.return_dispatched_at = nowStr;
    pass.return_dispatched_by = data.returned_by || user.name;
    pass.return_vehicle_no = (data.vehicle_no || pass.vehicle_no).trim().toUpperCase();
    pass.return_vehicle_type = data.vehicle_type || pass.vehicle_type || 'Truck';
    pass.return_driver = (data.driver || data.driver_name || pass.driver_name).trim();
    pass.return_driver_id = (data.driver_id || '').trim();
    pass.return_driver_mobile = (data.driver_mobile || '').trim();
    pass.return_remarks = data.remarks || 'Material returning back to origin';

    // Update returned quantities if specified
    if (data.return_items && Array.isArray(data.return_items)) {
      data.return_items.forEach((ri: any) => {
        const item = pass.items.find(i => i.id === ri.item_id);
        if (item) {
          item.returned_qty = (item.returned_qty || 0) + Number(ri.return_qty || ri.qty || 0);
        }
      });
    } else {
      pass.items.forEach(i => {
        if (!i.returned_qty) i.returned_qty = i.received_qty || i.dispatch_qty;
      });
    }

    // Sync to GateEntry
    const entry = await this.getEntryByCode(pass.gate_pass_no);
    if (entry && entry.inter_branch_details) {
      entry.inter_branch_details.status = 'return_in_transit';
      entry.inter_branch_details.return_dispatched_at = nowStr;
      entry.inter_branch_details.return_by = pass.return_dispatched_by;
      entry.inter_branch_details.return_vehicle_no = pass.return_vehicle_no;
      entry.inter_branch_details.return_driver = pass.return_driver;
      if (isMySQLConnected()) {
        await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
    }

    // Notification to Origin Sending Location
    const itemsSummary = pass.items.map(i => `${i.description} (${i.returned_qty || i.dispatch_qty} ${i.unit})`).join(', ');
    this.addNotification({
      target_location: pass.from_branch,
      from_location: pass.to_branch,
      code: pass.gate_pass_no,
      type: 'return_in_transit',
      title: '🔔 Material Return In Transit',
      message: `${pass.gate_pass_no} is being returned from ${pass.to_branch} to ${pass.from_branch}. Material: ${itemsSummary}. Returned By: ${pass.return_dispatched_by}. Vehicle: ${pass.return_vehicle_no}. Status: RETURN IN TRANSIT.`,
      metadata: {
        pass_no: pass.gate_pass_no,
        from_branch: pass.from_branch,
        to_branch: pass.to_branch,
        returned_by: pass.return_dispatched_by,
        vehicle: pass.return_vehicle_no,
        materials: itemsSummary
      }
    });

    this.addAudit(user.id, user.name, 'INTER_BRANCH_RETURN_STARTED', pass.gate_pass_no, {
      from: pass.to_branch,
      to: pass.from_branch,
      returned_by: pass.return_dispatched_by,
      vehicle: pass.return_vehicle_no
    });

    this.save();
    return pass;
  }

  public async receiveInterBranchReturn(id: string, data: any, user: AppUser): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    const nowStr = getFormattedNow();
    pass.status = 'COMPLETED';
    pass.return_received_at = nowStr;
    pass.return_received_by = user.id;
    pass.return_received_remarks = data.remarks || 'Returned material verified and accepted back at origin gate';

    // Sync to GateEntry
    const entry = await this.getEntryByCode(pass.gate_pass_no);
    if (entry) {
      entry.stage = 'cleared';
      entry.returned_at = nowStr;
      if (entry.inter_branch_details) {
        entry.inter_branch_details.status = 'completed';
        entry.inter_branch_details.origin_received_at = nowStr;
        entry.inter_branch_details.origin_received_guard = user.name;
        entry.inter_branch_details.origin_receipt_remarks = pass.return_received_remarks;
      }
      if (isMySQLConnected()) {
        await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
    }

    // Final Notifications
    this.addNotification({
      target_location: pass.to_branch,
      from_location: pass.from_branch,
      code: pass.gate_pass_no,
      type: 'completed',
      title: '🔔 Material Received Back — Gate Pass Completed',
      message: `Returned material for Gate Pass ${pass.gate_pass_no} has been received back and verified at ${pass.from_branch}. Transaction COMPLETED.`,
      metadata: { pass_no: pass.gate_pass_no }
    });

    this.addNotification({
      target_location: pass.from_branch,
      from_location: pass.to_branch,
      code: pass.gate_pass_no,
      type: 'completed',
      title: '🔔 Material Received Back — Gate Pass Completed',
      message: `Return for ${pass.gate_pass_no} received back from ${pass.to_branch}. Transaction COMPLETED.`,
      metadata: { pass_no: pass.gate_pass_no }
    });

    this.addAudit(user.id, user.name, 'INTER_BRANCH_RETURN_RECEIVED_BACK', pass.gate_pass_no, {
      received_back_at: pass.from_branch,
      status: 'COMPLETED'
    });

    this.save();
    return pass;
  }

  public async holdInterBranchGatePass(id: string, reason: string, user: AppUser): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    pass.status = 'GATE_HOLD';
    pass.hold_reason = reason;
    pass.hold_by = user.name;
    pass.hold_at = getFormattedNow();

    this.addAudit(user.id, user.name, 'INTER_BRANCH_HOLD', pass.gate_pass_no, { reason });
    this.save();
    return pass;
  }

  public async releaseInterBranchGatePass(id: string, remarks: string, user: AppUser): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    pass.status = pass.gate_out_at ? 'IN_TRANSIT' : 'AWAITING_DISPATCH';
    pass.hold_reason = null;

    this.addAudit(user.id, user.name, 'INTER_BRANCH_RELEASED', pass.gate_pass_no, { remarks });
    this.save();
    return pass;
  }

  public async cancelInterBranchGatePass(id: string, reason: string, user: AppUser): Promise<InterBranchGatePass> {
    const pass = await this.getInterBranchGatePassById(id) || await this.getInterBranchGatePassByNo(id);
    if (!pass) throw new Error(`Gate pass '${id}' not found`);

    pass.status = 'CANCELLED';
    pass.cancel_reason = reason;
    pass.cancel_by = user.name;
    pass.cancel_at = getFormattedNow();

    const entry = await this.getEntryByCode(pass.gate_pass_no);
    if (entry) {
      entry.cancelled = {
        at: pass.cancel_at,
        by: user.id,
        by_name: user.name,
        reason
      };
      if (isMySQLConnected()) {
        await mysqlSaveEntry(entry).catch(e => console.warn('[MySQL Save]', e?.message || e));
      }
    }

    this.addAudit(user.id, user.name, 'INTER_BRANCH_CANCELLED', pass.gate_pass_no, { reason });
    this.save();
    return pass;
  }

  public async getInterBranchStats(branch?: string): Promise<InterBranchStats> {
    const passes = await this.getInterBranchGatePasses({ branch });

    const total = passes.length;
    const draft = passes.filter(p => p.status === 'DRAFT' || p.status === 'ISSUED' || p.status === 'AWAITING_DISPATCH').length;
    const gate_out_pending = draft;
    const in_transit = passes.filter(p => p.status === 'IN_TRANSIT' || p.status === 'GATE_OUT_VERIFIED').length;
    const received = passes.filter(p => p.status === 'RECEIVED' || p.status === 'RECEIVED_WITH_DIFFERENCE' || p.status === 'RECEIVED_WITH_DAMAGE').length;
    const completed = passes.filter(p => p.status === 'COMPLETED').length;
    const pending_return = passes.filter(p => p.status === 'PENDING_RETURN').length;
    const return_in_transit = passes.filter(p => p.status === 'RETURN_IN_TRANSIT').length;
    const holds = passes.filter(p => p.status === 'GATE_HOLD').length;
    const with_differences = passes.filter(p => p.has_difference || p.status === 'RECEIVED_WITH_DIFFERENCE').length;
    const with_damage = passes.filter(p => p.has_damage || p.status === 'RECEIVED_WITH_DAMAGE').length;

    return {
      total,
      draft,
      gate_out_pending,
      pendingGateOut: gate_out_pending,
      in_transit,
      expectedInTransit: in_transit,
      received,
      completed,
      pending_return,
      return_in_transit,
      holds,
      onHold: holds,
      with_differences,
      with_damage
    };
  }

  // --- Notifications ---
  public getNotifications(location?: string, unreadOnly: boolean = false): AppNotification[] {
    if (!this.state.notifications) {
      this.state.notifications = [];
    }

    let list = [...this.state.notifications];

    if (location && location !== 'ALL') {
      const loc = location.toLowerCase().trim();
      list = list.filter(n =>
        n.target_location.toLowerCase() === loc ||
        n.target_location.toLowerCase() === 'all' ||
        n.from_location.toLowerCase() === loc
      );
    }

    if (unreadOnly) {
      list = list.filter(n => !n.read);
    }

    return list.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
  }

  public addNotification(data: {
    target_location: string;
    from_location: string;
    code: string;
    type: AppNotification['type'];
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): AppNotification {
    if (!this.state.notifications) {
      this.state.notifications = [];
    }

    const notif: AppNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      created_at: getFormattedNow(),
      target_location: data.target_location,
      from_location: data.from_location,
      code: data.code,
      type: data.type,
      title: data.title,
      message: data.message,
      read: false,
      metadata: data.metadata
    };

    this.state.notifications.unshift(notif);
    if (this.state.notifications.length > 200) {
      this.state.notifications = this.state.notifications.slice(0, 200);
    }
    this.save();
    return notif;
  }

  public markNotificationRead(id: string): boolean {
    if (!this.state.notifications) return false;
    const n = this.state.notifications.find(item => item.id === id);
    if (n) {
      n.read = true;
      this.save();
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(location?: string): boolean {
    if (!this.state.notifications) return false;
    this.state.notifications.forEach(n => {
      if (!location || location === 'ALL' || n.target_location.toLowerCase() === location.toLowerCase()) {
        n.read = true;
      }
    });
    this.save();
    return true;
  }

  public getRawState(): DatabaseState {
    return this.state;
  }
}

export const db = new Database();
