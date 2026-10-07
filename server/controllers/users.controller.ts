import { Response } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { mysqlSaveUser, mysqlGetLocations, isMySQLConnected } from '../mysqlClient.js';
import crypto from 'crypto';

export class UsersController {
  public static list(_req: AuthenticatedRequest, res: Response) {
    const users = db.getUsers();
    res.json(users);
  }

  public static async getLocations(_req: any, res: Response) {
    try {
      if (isMySQLConnected()) {
        const mysqlLocs = await mysqlGetLocations().catch(() => []);
        if (Array.isArray(mysqlLocs) && mysqlLocs.length > 0) {
          // Strictly return only the locations present in the MySQL database
          const users = db.getUsers();
          const result = mysqlLocs.map(ml => {
            const usersAtLoc = users.filter(u => (u.location || '').trim().toLowerCase() === ml.name.trim().toLowerCase());
            return {
              id: ml.id,
              name: ml.name,
              code: ml.code || ml.name.substring(0, 4).toUpperCase(),
              address: ml.address || `${ml.name} Checkpoint Facility`,
              active: ml.active,
              user_count: usersAtLoc.length,
              guards_count: usersAtLoc.filter(u => u.role === 'guard').length,
              supervisors_count: usersAtLoc.filter(u => u.role === 'supervisor').length,
              admins_count: usersAtLoc.filter(u => u.role === 'admin').length
            };
          });
          return res.json(result);
        }
      }

      // Offline fallback: return configured locations from database state
      const locations = db.getFacilityLocations();
      res.json(locations);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list locations' });
    }
  }

  public static async createLocation(req: AuthenticatedRequest, res: Response) {
    const { name, code, address } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Location name is required' });
    }

    try {
      const newLoc = await db.addFacilityLocation({
        name: String(name).trim(),
        code: code ? String(code).trim() : undefined,
        address: address ? String(address).trim() : undefined
      }, req.user);

      res.status(201).json({ success: true, location: newLoc });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to create location' });
    }
  }

  public static async updateLocation(req: AuthenticatedRequest, res: Response) {
    const { oldName } = req.params;
    const { name, code, address } = req.body;

    if (!oldName) {
      return res.status(400).json({ success: false, error: 'Target location identifier is required' });
    }

    try {
      const updated = await db.updateFacilityLocation(decodeURIComponent(oldName), {
        name: name ? String(name).trim() : undefined,
        code: code ? String(code).trim() : undefined,
        address: address ? String(address).trim() : undefined
      }, req.user);

      if (!updated) {
        return res.status(404).json({ success: false, error: 'Location not found' });
      }

      res.json({ success: true, location: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update location' });
    }
  }

  public static async deleteLocation(req: AuthenticatedRequest, res: Response) {
    const { name } = req.params;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Location name is required' });
    }

    const cleanName = decodeURIComponent(name).trim();

    // Protection: Check if users are assigned to this location
    const users = db.getUsers().filter(u => (u.location || '').trim().toLowerCase() === cleanName.toLowerCase());
    if (users.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete '${cleanName}' because ${users.length} active user(s) are assigned to this location. Reassign or delete them first.`
      });
    }

    try {
      await db.deleteFacilityLocation(cleanName, req.user);
      res.json({ success: true, message: `Location '${cleanName}' removed successfully.` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to delete location' });
    }
  }

  public static listGrouped(_req: AuthenticatedRequest, res: Response) {
    try {
      const users = db.getUsers();
      const locations = db.getFacilityLocations();

      const grouped: Record<string, typeof users> = {};

      // Initialize all registered locations
      locations.forEach(loc => {
        grouped[loc.name] = [];
      });

      // Distribute users into their locations
      users.forEach(u => {
        const locName = (u.location || '').trim() || 'Unassigned';
        if (!grouped[locName]) {
          grouped[locName] = [];
        }
        grouped[locName].push(u);
      });

      res.json({
        locations,
        grouped,
        total_users: users.length
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list grouped users' });
    }
  }

  public static async create(req: AuthenticatedRequest, res: Response) {
    const { name, login, role, gate, location, device_type, password } = req.body;
    if (!name || !login || !password) {
      return res.status(400).json({ success: false, error: 'Name, login, and password are required' });
    }

    const existing = db.findUserByLogin(login);
    if (existing) {
      return res.status(400).json({ success: false, error: `A user with login '${login}' already exists` });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const password_hash = crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');

    const newUser = {
      id: `usr-${Date.now()}`,
      name: String(name).trim(),
      login: String(login).trim().toLowerCase(),
      role: role || 'guard',
      gate: gate || 'Main Gate',
      location: location || 'Estate 1',
      device_type: (device_type === 'tablet' ? 'tablet' : 'web') as 'tablet' | 'web',
      salt,
      password_hash,
      active: true,
      must_change: false,
      failed: 0
    };

    db.getRawState().users.push(newUser);
    await mysqlSaveUser(newUser);

    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'USER_CREATED', null, {
        target_user: newUser.login,
        role: newUser.role,
        gate: newUser.gate,
        location: newUser.location,
        device_type: newUser.device_type
      });
    }

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        login: newUser.login,
        role: newUser.role,
        gate: newUser.gate,
        location: newUser.location,
        device_type: newUser.device_type,
        active: newUser.active
      }
    });
  }

  public static async update(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { name, role, gate, location, device_type, active, password } = req.body;

    const existing = db.findUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Protection: If changing role or deactivating, check if this is the only active admin
    if (existing.role === 'admin' && (role !== 'admin' || active === false)) {
      const activeAdmins = db.getUsers().filter(u => u.role === 'admin' && u.active && u.id !== id);
      if (activeAdmins.length === 0) {
        return res.status(400).json({ success: false, error: 'Cannot demote or deactivate the only active administrator.' });
      }
    }

    const updated = await db.updateUser(id, {
      name,
      role,
      gate,
      location,
      device_type,
      active,
      password: password && String(password).trim() ? String(password).trim() : undefined
    });

    if (!updated) {
      return res.status(500).json({ success: false, error: 'Failed to update user' });
    }

    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'USER_UPDATED', null, {
        target_user: existing.login,
        changes: { name, role, gate, location, device_type, active, password_changed: Boolean(password) }
      });
    }

    res.json({
      success: true,
      user: updated
    });
  }

  public static async delete(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    const existing = db.findUserById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Protection: Don't allow deleting self while logged in
    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account while currently logged in.'
      });
    }

    // Protection: Don't allow deleting the only admin
    if (existing.role === 'admin') {
      const remainingAdmins = db.getUsers().filter(u => u.role === 'admin' && u.id !== id);
      if (remainingAdmins.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the only administrator account. Create another administrator first.'
        });
      }
    }

    const success = await db.deleteUser(id);
    if (!success) {
      return res.status(500).json({ success: false, error: 'Failed to delete user' });
    }

    if (req.user) {
      db.addAudit(req.user.id, req.user.name, 'USER_DELETED', null, {
        deleted_user_id: id,
        deleted_user_login: existing.login,
        deleted_user_name: existing.name
      });
    }

    res.json({
      success: true,
      message: `User '${existing.login}' was deleted successfully.`
    });
  }
}
