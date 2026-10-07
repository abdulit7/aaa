import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppUser, FacilityLocation } from '../types';
import { useSettings } from '../context/SettingsContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { LocationMaterialOutModal } from '../components/modals/LocationMaterialOutModal';

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [locations, setLocations] = useState<FacilityLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and Location filter for Users Table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState<string>(searchParams.get('location') || 'ALL');

  // Add Location Form
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [isSavingLoc, setIsSavingLoc] = useState(false);

  // Edit Location Modal
  const [editingLocation, setEditingLocation] = useState<FacilityLocation | null>(null);
  const [editLocName, setEditLocName] = useState('');
  const [editLocCode, setEditLocCode] = useState('');
  const [editLocAddress, setEditLocAddress] = useState('');
  const [isUpdatingLoc, setIsUpdatingLoc] = useState(false);

  // Delete Location state
  const [deletingLocation, setDeletingLocation] = useState<FacilityLocation | null>(null);
  const [isDeletingLoc, setIsDeletingLoc] = useState(false);

  // Add User Form
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserLogin, setNewUserLogin] = useState('');
  const [newUserRole, setNewUserRole] = useState<'guard' | 'supervisor' | 'admin'>('guard');
  const [newUserGate, setNewUserGate] = useState('Main Gate');
  const [newUserLocation, setNewUserLocation] = useState('Estate 1');
  const [newUserDeviceType, setNewUserDeviceType] = useState<'tablet' | 'web'>('tablet');
  const [newUserPw, setNewUserPw] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'guard' | 'supervisor' | 'admin'>('guard');
  const [editGate, setEditGate] = useState('Main Gate');
  const [editLocation, setEditLocation] = useState('Estate 1');
  const [editDeviceType, setEditDeviceType] = useState<'tablet' | 'web'>('tablet');
  const [editActive, setEditActive] = useState(true);
  const [editPw, setEditPw] = useState('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Delete User Modal
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Notifications
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal to show Material OUT form for a specific location
  const [activeMaterialOutLocation, setActiveMaterialOutLocation] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('gatemaster_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, locsRes] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/users/locations', { headers })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }

      if (locsRes.ok) {
        const locsData = await locsRes.json();
        setLocations(Array.isArray(locsData) ? locsData : []);
        if (locsData.length > 0 && !newUserLocation) {
          setNewUserLocation(locsData[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load users & locations', err);
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================================
      LOCATION ACTIONS: SAVE, EDIT, DELETE
     ========================================================================= */

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    setIsSavingLoc(true);
    setNotice(null);
    try {
      const res = await fetch('/api/users/locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          name: newLocName.trim(),
          code: newLocCode.trim() || undefined,
          address: newLocAddress.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save location to database');

      setNotice({ text: `Location '${newLocName}' saved to database successfully!`, type: 'success' });
      setNewLocName('');
      setNewLocCode('');
      setNewLocAddress('');
      setShowAddLocation(false);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Error saving location', type: 'error' });
    } finally {
      setIsSavingLoc(false);
    }
  };

  const handleStartEditLocation = (loc: FacilityLocation) => {
    setEditingLocation(loc);
    setEditLocName(loc.name);
    setEditLocCode(loc.code || '');
    setEditLocAddress(loc.address || '');
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editLocName.trim()) return;

    setIsUpdatingLoc(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/locations/${encodeURIComponent(editingLocation.name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          name: editLocName.trim(),
          code: editLocCode.trim() || undefined,
          address: editLocAddress.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update location in database');

      setNotice({ text: `Location '${editLocName}' updated successfully in database!`, type: 'success' });
      setEditingLocation(null);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Error updating location', type: 'error' });
    } finally {
      setIsUpdatingLoc(false);
    }
  };

  const handleConfirmDeleteLocation = async () => {
    if (!deletingLocation) return;
    setIsDeletingLoc(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/locations/${encodeURIComponent(deletingLocation.name)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete location');

      setNotice({ text: `Location '${deletingLocation.name}' deleted from database.`, type: 'success' });
      setDeletingLocation(null);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Error deleting location', type: 'error' });
    } finally {
      setIsDeletingLoc(false);
    }
  };

  /* =========================================================================
      USER ACTIONS: CREATE, EDIT, DELETE
     ========================================================================= */

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUser(true);
    setNotice(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          name: newUserName.trim(),
          login: newUserLogin.trim().toLowerCase(),
          role: newUserRole,
          gate: newUserGate,
          location: newUserLocation,
          device_type: newUserDeviceType,
          password: newUserPw,
          active: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      setNotice({
        text: `User '${newUserLogin}' created and assigned to location '${newUserLocation}' successfully!`,
        type: 'success'
      });
      setNewUserName('');
      setNewUserLogin('');
      setNewUserPw('');
      setShowAddUser(false);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Failed to create user', type: 'error' });
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleStartEditUser = (u: AppUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditGate(u.gate || 'Main Gate');
    setEditLocation(u.location || 'Estate 1');
    setEditDeviceType(u.device_type || 'tablet');
    setEditActive(u.active);
    setEditPw('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdatingUser(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        },
        body: JSON.stringify({
          name: editName.trim(),
          role: editRole,
          gate: editGate,
          location: editLocation,
          device_type: editDeviceType,
          active: editActive,
          password: editPw.trim() ? editPw.trim() : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setNotice({
        text: `User '${editingUser.login}' updated successfully.`,
        type: 'success'
      });
      setEditingUser(null);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Error updating user', type: 'error' });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeletingUser(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      setNotice({
        text: `User '${deletingUser.login}' deleted successfully.`,
        type: 'success'
      });
      setDeletingUser(null);
      await fetchData();
    } catch (err: any) {
      setNotice({ text: err.message || 'Error deleting user', type: 'error' });
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Unique list of location names from database
  const allLocationNames = locations.length > 0
    ? locations.map(l => l.name).sort()
    : Array.from(new Set(users.map(u => u.location).filter(Boolean) as string[])).sort();

  // Filtered Users for the Single Table
  const filteredUsers = users.filter(u => {
    const matchesLoc = filterLocation === 'ALL' || (u.location || '').toLowerCase() === filterLocation.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query ||
      u.name.toLowerCase().includes(query) ||
      u.login.toLowerCase().includes(query) ||
      (u.gate || '').toLowerCase().includes(query) ||
      (u.location || '').toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query);
    return matchesLoc && matchesQuery;
  });

  return (
    <PageMotion className="w-full space-y-6 pb-16">
      {/* Top Banner Notice */}
      {notice && (
        <div className={`p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs ${
          notice.type === 'success'
            ? 'bg-[#e8f6ed] text-[#15803d] border border-[#a7f3d0]'
            : 'bg-[#fdecec] text-[#b91c1c] border border-[#fca5a5]'
        }`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="font-bold ml-2 cursor-pointer p-1">✕</button>
        </div>
      )}

      {/* =========================================================================
          TABLE 1: ALL USERS IN ONE SINGLE TABLE
          ========================================================================= */}
      <Card3D className="p-4 sm:p-5 space-y-4 bg-white border border-[#dde1e6]">
        {/* Header with Search, Filter & Add User Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dde1e6] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">👥</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#1b1f24] flex items-center gap-2">
                <span>All Users</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                  {filteredUsers.length} of {users.length} Total Users
                </span>
              </h2>
              <p className="text-xs text-[#5f6b7a]">
                All terminal operators, security guards, and supervisors in one comprehensive table.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Location Selector Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Filter Location:</label>
              <select
                value={filterLocation}
                onChange={e => {
                  const val = e.target.value;
                  setFilterLocation(val);
                  if (val === 'ALL') {
                    setSearchParams({});
                  } else {
                    setSearchParams({ location: val });
                  }
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-[#c5ccd4] rounded-lg font-bold text-slate-800 focus:bg-white focus:outline-hidden"
              >
                <option value="ALL">All Locations ({users.length})</option>
                {allLocationNames.map(name => {
                  const cnt = users.filter(u => (u.location || '').toLowerCase() === name.toLowerCase()).length;
                  return (
                    <option key={name} value={name}>
                      📍 {name} ({cnt})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search user, name, gate, location..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-[#c5ccd4] rounded-lg focus:outline-hidden focus:bg-white w-44 sm:w-52"
            />

            <Button3D
              type="button"
              variant="in"
              size="sm"
              onClick={() => setShowAddUser(!showAddUser)}
              className="font-bold flex items-center gap-1.5"
            >
              <span>{showAddUser ? '✕ Close Form' : '➕ Add User'}</span>
            </Button3D>
          </div>
        </div>

        {/* Collapsible Add User Form */}
        {showAddUser && (
          <form onSubmit={handleCreateUser} className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-emerald-300 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
              <span>➕</span>
              <span>Add Terminal User</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="form-label text-xs">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tariq Mehmood"
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="form-label text-xs">Username / Login *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. guard_tariq"
                  value={newUserLogin}
                  onChange={e => setNewUserLogin(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg font-mono focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="form-label text-xs">Location *</label>
                <select
                  value={newUserLocation}
                  onChange={e => setNewUserLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border-2 border-emerald-500 rounded-lg font-bold text-emerald-900 focus:outline-hidden"
                >
                  {allLocationNames.map(loc => (
                    <option key={loc} value={loc}>📍 {loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Assigned Gate *</label>
                <select
                  value={newUserGate}
                  onChange={e => setNewUserGate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                >
                  {(settings?.gates ? settings.gates.split(',') : ['Main Gate', 'Chocolate Gate', 'Workshop', 'Worldsweet']).map(g => (
                    <option key={g.trim()} value={g.trim()}>{g.trim()}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Role</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                >
                  <option value="guard">Security Guard</option>
                  <option value="supervisor">Security Supervisor</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Terminal Device</label>
                <select
                  value={newUserDeviceType}
                  onChange={e => setNewUserDeviceType(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                >
                  <option value="tablet">📱 Tablet Terminal (Guard Kiosk)</option>
                  <option value="web">💻 Web Console (Desktop)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="min 6 characters"
                  value={newUserPw}
                  onChange={e => setNewUserPw(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                />
              </div>

              <div>
                <Button3D
                  type="submit"
                  variant="in"
                  size="sm"
                  disabled={isSavingUser}
                  className="w-full font-bold py-2"
                >
                  {isSavingUser ? 'Adding User...' : '✔ Add User'}
                </Button3D>
              </div>
            </div>
          </form>
        )}

        {/* The Single All Users Table */}
        <div className="overflow-x-auto border border-[#dde1e6] rounded-xl shadow-2xs">
          <table className="w-full min-w-[760px] text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] uppercase text-[11px] font-bold">
                <th className="py-2.5 px-3">Username</th>
                <th className="py-2.5 px-3">Full Name</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3">Assigned Gate</th>
                <th className="py-2.5 px-3 text-center">Device</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Material OUT</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dde1e6]">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-[#1b1f24]">
                      {u.login}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1b1f24]">
                      {u.name}
                    </td>
                    <td className="py-2.5 px-3 capitalize">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : u.role === 'supervisor'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1 shadow-2xs">
                        <span>📍</span>
                        <span>{u.location || 'Estate 1'}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {u.gate || 'Main Gate'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.device_type === 'tablet'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        {u.device_type === 'tablet' ? '📱 Tablet' : '💻 Web'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.active ? 'bg-[#e8f6ed] text-[#15803d]' : 'bg-[#fdecec] text-[#b91c1c]'
                      }`}>
                        {u.active ? 'ACTIVE' : 'LOCKED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveMaterialOutLocation(u.location || 'Estate 1')}
                        className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 cursor-pointer inline-flex items-center gap-1 shadow-2xs hover:border-blue-400 transition-colors"
                        title={`Open Material OUT Form for ${u.location || 'Estate 1'}`}
                      >
                        <span>⬆</span>
                        <span>OUT Form</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditUser(u)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Edit User"
                        >
                          <span>✏️</span>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDeletingUser(u); }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Delete User"
                        >
                          <span>🗑️</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-xs text-slate-500">
                    No users matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card3D>

      {/* =========================================================================
          TABLE 2: LOCATIONS TABLE (WITH ADD, EDIT, DELETE & MATERIAL OUT)
          ========================================================================= */}
      <Card3D className="p-4 sm:p-5 space-y-4 bg-white border border-[#dde1e6]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dde1e6] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-1.5 bg-blue-100 text-blue-800 rounded-lg shrink-0">📍</span>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#1b1f24] flex items-center gap-2">
                <span>Locations</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                  {locations.length} Locations Saved
                </span>
              </h2>
              <p className="text-xs text-[#5f6b7a]">
                Manage system locations stored in database. Add new locations, edit or delete locations, and create Material OUT passes.
              </p>
            </div>
          </div>

          <Button3D
            type="button"
            variant="in"
            size="sm"
            onClick={() => setShowAddLocation(!showAddLocation)}
            className="font-bold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>{showAddLocation ? '✕ Close Form' : '➕ Add Location'}</span>
          </Button3D>
        </div>

        {/* Collapsible Add Location Form */}
        {showAddLocation && (
          <form onSubmit={handleCreateLocation} className="p-4 rounded-xl bg-slate-50 border border-blue-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <span>📍</span>
              <span>Save New Location to Database</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="form-label text-xs">
                  Location Name <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Estate 3, Raw Material Hub, Karachi Plant"
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="form-label text-xs">Location Code</label>
                <input
                  type="text"
                  placeholder="e.g. EST-03, HUB-1"
                  value={newLocCode}
                  onChange={e => setNewLocCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600 focus:outline-hidden font-mono uppercase"
                />
              </div>

              <div>
                <label className="form-label text-xs">Address / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Industrial Area Gate 2"
                  value={newLocAddress}
                  onChange={e => setNewLocAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={() => setShowAddLocation(false)}
              >
                Cancel
              </Button3D>
              <Button3D
                type="submit"
                variant="in"
                size="sm"
                disabled={isSavingLoc}
                className="font-bold flex items-center gap-1.5"
              >
                <span>💾</span>
                <span>{isSavingLoc ? 'Saving to Database...' : 'Save Location to Database'}</span>
              </Button3D>
            </div>
          </form>
        )}

        {/* Locations Table */}
        <div className="overflow-x-auto border border-[#dde1e6] rounded-xl shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] uppercase text-[11px] font-bold">
                <th className="py-2.5 px-3">Location Name</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Address / Note</th>
                <th className="py-2.5 px-3 text-center">Assigned Users</th>
                <th className="py-2.5 px-3 text-center">Database Status</th>
                <th className="py-2.5 px-3 text-center">Material OUT Form</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dde1e6]">
              {locations.length > 0 ? (
                locations.map(loc => {
                  const usersCount = users.filter(u => (u.location || '').toLowerCase() === loc.name.toLowerCase()).length;
                  return (
                    <tr key={loc.id || loc.name} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <span className="font-extrabold text-[#1b1f24] text-xs flex items-center gap-1.5">
                          <span className="text-blue-600">📍</span>
                          <span>{loc.name}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-600">
                        {loc.code || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        {loc.address || 'Standard Checkpoint'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                          {usersCount} User{usersCount !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#e8f6ed] text-[#15803d]">
                          🟢 SAVED IN DATABASE
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button3D
                          type="button"
                          variant="out"
                          size="sm"
                          onClick={() => setActiveMaterialOutLocation(loc.name)}
                          className="text-[11px] font-bold py-1 px-2.5 shadow-2xs inline-flex items-center gap-1"
                          title={`Show Material OUT Form for ${loc.name}`}
                        >
                          <span>⬆</span>
                          <span>Material OUT Form</span>
                        </Button3D>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEditLocation(loc)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Edit Location"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingLocation(loc)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold text-xs border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Delete Location"
                          >
                            <span>🗑️</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-slate-500">
                    No locations saved yet. Click "Add Location" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card3D>

      {/* =========================================================================
          MODAL 1: EDIT LOCATION MODAL
          ========================================================================= */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>✏️</span>
                <span>Edit Location: {editingLocation.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLocation} className="space-y-3">
              <div>
                <label className="form-label text-xs">
                  Location Name <span className="text-[#b91c1c]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editLocName}
                  onChange={e => setEditLocName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600 font-bold"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Renaming will automatically reassign all existing users from "{editingLocation.name}" to the new name.
                </span>
              </div>

              <div>
                <label className="form-label text-xs">Location Code</label>
                <input
                  type="text"
                  value={editLocCode}
                  onChange={e => setEditLocCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="form-label text-xs">Address / Note</label>
                <input
                  type="text"
                  value={editLocAddress}
                  onChange={e => setEditLocAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => setEditingLocation(null)}
                >
                  Cancel
                </Button3D>
                <Button3D
                  type="submit"
                  variant="in"
                  size="sm"
                  disabled={isUpdatingLoc}
                  className="font-bold"
                >
                  {isUpdatingLoc ? 'Saving...' : 'Save Location Changes'}
                </Button3D>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DELETE LOCATION CONFIRMATION MODAL
          ========================================================================= */}
      {deletingLocation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>Confirm Delete Location</span>
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete location <strong>{deletingLocation.name}</strong> from the database?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={() => setDeletingLocation(null)}
              >
                Cancel
              </Button3D>
              <Button3D
                type="button"
                variant="bad"
                size="sm"
                disabled={isDeletingLoc}
                onClick={handleConfirmDeleteLocation}
                className="font-bold"
              >
                {isDeletingLoc ? 'Deleting...' : 'Delete Location'}
              </Button3D>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: SHOW THAT LOCATION MATERIAL OUT FORM
          ========================================================================= */}
      {activeMaterialOutLocation && (
        <LocationMaterialOutModal
          locationName={activeMaterialOutLocation}
          onClose={() => setActiveMaterialOutLocation(null)}
          onSuccess={code => {
            setNotice({
              text: `Material OUT pass ${code} created successfully for ${activeMaterialOutLocation}!`,
              type: 'success'
            });
          }}
        />
      )}

      {/* =========================================================================
          MODAL 4: EDIT USER MODAL
          ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>✏️</span>
                  <span>Edit User: {editingUser.login}</span>
                </h3>
                <p className="text-xs text-slate-500">Update terminal location, role, or credentials</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="form-label text-xs">Role</label>
                  <select
                    value={editRole}
                    onChange={e => setEditRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                  >
                    <option value="guard">Security Guard</option>
                    <option value="supervisor">Security Supervisor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Location</label>
                  <select
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border-2 border-emerald-500 rounded-lg font-bold text-emerald-900"
                  >
                    {allLocationNames.map(loc => (
                      <option key={loc} value={loc}>📍 {loc}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Assigned Gate</label>
                  <select
                    value={editGate}
                    onChange={e => setEditGate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                  >
                    {(settings?.gates ? settings.gates.split(',') : ['Main Gate', 'Chocolate Gate', 'Workshop', 'Worldsweet']).map(g => (
                      <option key={g.trim()} value={g.trim()}>{g.trim()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Terminal Device</label>
                  <select
                    value={editDeviceType}
                    onChange={e => setEditDeviceType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                  >
                    <option value="tablet">📱 Tablet Terminal</option>
                    <option value="web">💻 Web Console</option>
                  </select>
                </div>

                <div>
                  <label className="form-label text-xs">Account Status</label>
                  <select
                    value={editActive ? 'active' : 'locked'}
                    onChange={e => setEditActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg font-semibold"
                  >
                    <option value="active">🟢 Active / Allowed</option>
                    <option value="locked">🔴 Locked / Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label text-xs">Reset Password (leave empty to keep unchanged)</label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  value={editPw}
                  onChange={e => setEditPw(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#c5ccd4] rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <Button3D
                  type="button"
                  variant="sec"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button3D>
                <Button3D
                  type="submit"
                  variant="in"
                  size="sm"
                  disabled={isUpdatingUser}
                  className="font-bold"
                >
                  {isUpdatingUser ? 'Saving...' : 'Save User Changes'}
                </Button3D>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: DELETE USER CONFIRMATION MODAL
          ========================================================================= */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>Confirm Delete User</span>
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete user <strong>{deletingUser.name}</strong> (<code>{deletingUser.login}</code>) assigned to <strong>{deletingUser.location}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button3D
                type="button"
                variant="sec"
                size="sm"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </Button3D>
              <Button3D
                type="button"
                variant="bad"
                size="sm"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="font-bold"
              >
                {isDeletingUser ? 'Deleting...' : 'Delete User'}
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </PageMotion>
  );
};
export default UsersPage;
