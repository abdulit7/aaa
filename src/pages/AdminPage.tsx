import React, { useState, useEffect } from 'react';
import { SystemSettings, AuditLog } from '../types';
import { useSettings } from '../context/SettingsContext';
import { Card3D, Button3D } from '../styles/emotion';
import { PageMotion } from '../components/common/PageMotion';
import { uploadImageToServer } from '../utils/imageOptimizer';
import { UsersPage } from './UsersPage';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'mysql' | 'audit'>('users');

  const [mysqlInfo, setMysqlInfo] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    fetchMysqlStatus();
    fetchSettings();
    fetchAudit();
  }, []);

  const fetchMysqlStatus = () => {
    fetch('/api/mysql/status')
      .then(res => res.json())
      .then(data => setMysqlInfo(data))
      .catch(console.error);
  };

  const fetchSettings = () => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  };

  const fetchAudit = () => {
    fetch('/api/audit', {
      headers: { Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}` }
    })
      .then(res => res.json())
      .then(data => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const { updateSettings } = useSettings();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSettingsMsg('Processing & uploading logo to public directory...');
    try {
      const publicUrl = await uploadImageToServer(file, 'logo', 'logo');
      setSettings(prev => prev ? { ...prev, logo_url: publicUrl } : prev);
      setSettingsMsg('Logo uploaded to public directory! Click "Save Settings" to apply.');
    } catch (err: any) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setSettings(prev => prev ? { ...prev, logo_url: dataUrl } : prev);
        setSettingsMsg('Logo ready. Click "Save Settings" to save to public directory.');
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const result = await updateSettings(settings);
      if (result.success) {
        setSettingsMsg('Application settings & branding updated successfully.');
        setTimeout(() => setSettingsMsg(null), 3500);
      } else {
        setSettingsMsg(result.error || 'Failed to update settings');
      }
    } catch (err: any) {
      setSettingsMsg(err.message || 'Error saving settings');
    }
  };

  const handleRunTamperCheck = async () => {
    setIsVerifying(true);
    setTamperResult(null);
    try {
      const res = await fetch('/api/audit/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('gatemaster_token')}` }
      });
      const data = await res.json();
      setTamperResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <PageMotion className="w-full space-y-4 pb-16">
      <h1 className="text-xl sm:text-2xl font-bold text-[#1b1f24]">
        Admin Console
      </h1>

      {/* Nav pill tabs */}
      <Card3D className="p-1.5 sm:p-2 flex overflow-x-auto sm:flex-wrap gap-1.5 sm:gap-2">
        <Button3D
          variant={activeTab === 'users' ? 'in' : 'sec'}
          size="sm"
          onClick={() => setActiveTab('users')}
          className="whitespace-nowrap"
        >
          Users & Locations
        </Button3D>
        <Button3D
          variant={activeTab === 'settings' ? 'in' : 'sec'}
          size="sm"
          onClick={() => setActiveTab('settings')}
          className="whitespace-nowrap"
        >
          Settings
        </Button3D>
        <Button3D
          variant={activeTab === 'mysql' ? 'in' : 'sec'}
          size="sm"
          onClick={() => setActiveTab('mysql')}
          className="whitespace-nowrap"
        >
          MySQL Database
        </Button3D>
        <Button3D
          variant={activeTab === 'audit' ? 'in' : 'sec'}
          size="sm"
          onClick={() => setActiveTab('audit')}
          className="whitespace-nowrap"
        >
          Activity log & check
        </Button3D>
      </Card3D>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <UsersPage />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <Card3D className="p-4 sm:p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#dde1e6] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1b1f24]">System Settings & Identity</h2>
              <p className="text-xs text-[#5f6b7a]">Configure application name, logo, company titles, and gate parameters</p>
            </div>
            {settingsMsg && (
              <div className="p-2 px-3 rounded-lg bg-[#e8f6ed] text-[#15803d] text-xs font-semibold border border-emerald-300">
                {settingsMsg}
              </div>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            {/* Branding & Appearance Section */}
            <div className="bg-[#f8fafc] p-4 sm:p-5 rounded-xl border border-[#dde1e6] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-[#dde1e6]">
                <span className="text-lg">🎨</span>
                <div>
                  <h3 className="text-sm font-bold text-[#1b1f24]">Application Branding & Logo</h3>
                  <p className="text-xs text-[#5f6b7a]">Customise the software name and brand logo across sidebars, login, and printouts</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                <div>
                  <label className="form-label">Application Name</label>
                  <input
                    type="text"
                    placeholder="e.g. GateMaster, GFI · Gate Register"
                    value={settings.app_name || ''}
                    onChange={e => setSettings({ ...settings, app_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                  <span className="text-[11px] text-[#5f6b7a] mt-1 block">
                    Displayed in the sidebar, header bar, login window, and PDF exports.
                  </span>
                </div>

                <div className="space-y-2.5">
                  <label className="form-label">Application Logo</label>
                  
                  <div className="flex items-center gap-3.5">
                    {/* Visual Preview */}
                    <div className="h-16 w-16 rounded-xl border-2 border-dashed border-[#c5ccd4] bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                      {settings.logo_url ? (
                        <img
                          src={settings.logo_url}
                          alt="Logo Preview"
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <div className="text-center text-[#5f6b7a]">
                          <span className="text-2xl">🏢</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="btn-3d btn-3d-sec py-1.5 px-3 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
                          <span>📁</span>
                          <span>Upload Image</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml,image/webp"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </label>

                        {settings.logo_url && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettings({ ...settings, logo_url: '' });
                              setSettingsMsg('Logo removed. Click "Save Settings" to confirm.');
                            }}
                            className="text-xs text-[#b91c1c] hover:underline font-semibold cursor-pointer px-2 py-1"
                          >
                            Remove Logo
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-[#5f6b7a]">
                        Recommended: PNG or SVG with transparent background (Max 2MB).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#5f6b7a] block mb-1">
                      Or Direct Logo Image URL / Data URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com/logo.png or data:image/png;base64,..."
                      value={settings.logo_url || ''}
                      onChange={e => setSettings({ ...settings, logo_url: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-[#c5ccd4] rounded-lg font-mono focus:border-[#15803d] focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Corporate Organization Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#1b1f24] flex items-center gap-2">
                <span>🏭</span>
                <span>Company & Facility Parameters</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Full Company Name (on Reports & Header)</label>
                  <input
                    type="text"
                    value={settings.company_name}
                    onChange={e => setSettings({ ...settings, company_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="form-label">Short Name (on thermal slips & badges)</label>
                  <input
                    type="text"
                    value={settings.company_short}
                    onChange={e => setSettings({ ...settings, company_short: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="form-label">Gates (comma separated)</label>
                  <input
                    type="text"
                    value={settings.gates}
                    onChange={e => setSettings({ ...settings, gates: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="form-label">Locations / Estates (comma separated)</label>
                  <input
                    type="text"
                    placeholder="Estate 1, Estate 2, Head Office, Plant A"
                    value={settings.locations || 'Estate 1, Estate 2, Head Office, Plant A'}
                    onChange={e => setSettings({ ...settings, locations: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="form-label">Standard Units (comma separated)</label>
                  <input
                    type="text"
                    value={settings.units}
                    onChange={e => setSettings({ ...settings, units: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm bg-white border border-[#c5ccd4] rounded-lg min-h-[46px] sm:min-h-[38px] focus:border-[#15803d] focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#dde1e6] flex items-center justify-between">
              <Button3D type="submit" variant="in" size="md" className="font-bold">
                <span>💾</span>
                <span>Save All Settings</span>
              </Button3D>

              <span className="text-xs text-[#5f6b7a]">
                Changes apply in real-time across all active terminals.
              </span>
            </div>
          </form>
        </Card3D>
      )}

      {/* MySQL Hub Tab */}
      {activeTab === 'mysql' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card3D className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1b1f24] flex items-center gap-2">
                <span>🗄️</span>
                <span>MySQL Database Status</span>
              </h2>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-md flex items-center gap-1.5 ${
                mysqlInfo?.connected
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}>
                <span className={`h-2 w-2 rounded-full ${mysqlInfo?.connected ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'}`} />
                <span>{mysqlInfo?.connected ? 'Live Connected' : 'Disconnected'}</span>
              </span>
            </div>

            <p className="text-xs text-[#5f6b7a]">
              Configured database: <b className="font-mono text-[#1b1f24]">{mysqlInfo?.configured_database || 'gateregister_db'}</b> at {mysqlInfo?.configured_host || 'localhost'}:{mysqlInfo?.configured_port || 3306}
            </p>

            {mysqlInfo?.last_error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono">
                Error: {mysqlInfo.last_error}
              </div>
            )}

            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-bold text-slate-700">Live MySQL Tables & Row Counts:</p>
              {mysqlInfo?.tables?.map((tbl: any) => (
                <div key={tbl.name} className="flex items-center justify-between p-2 rounded bg-[#f7f8f9] border border-[#dde1e6] text-xs">
                  <span className="font-mono text-[#1b1f24] font-semibold">{tbl.name}</span>
                  <span className="font-mono font-bold text-[#15803d]">{tbl.rows} rows</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button3D
                type="button"
                variant="in"
                size="sm"
                onClick={fetchMysqlStatus}
                className="w-full text-xs font-bold justify-center"
              >
                🔄 Refresh MySQL Status & Row Counts
              </Button3D>
            </div>
          </Card3D>

          <Card3D className="p-4 sm:p-5 space-y-3">
            <h2 className="text-base font-bold text-[#1b1f24] flex items-center gap-2">
              <span>⚡</span>
              <span>Direct Database Policies</span>
            </h2>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900">
                <p className="font-bold">✓ Direct MySQL Read & Write</p>
                <p>All gate transactions, invoices, photos, and materials are committed straight to your MySQL database in real time.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                <p className="font-bold">✓ JSON Storage Strictly Bypassed</p>
                <p>No transactions are saved to local .json files (<code className="font-mono">data/db.json</code>). Direct database persistence ensures live multi-client consistency.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                <p className="font-bold">✓ Zero Offline IndexedDB Storage</p>
                <p>Mobile and terminal browsers operate in synchronized live mode directly with the backend database.</p>
              </div>
            </div>

            <h3 className="text-xs font-bold text-[#1b1f24] pt-2">Export SQL Scripts</h3>
            <div className="space-y-2 pt-1">
              <a
                href="/api/mysql/export-schema"
                download="gateregister_schema.sql"
                className="btn-3d btn-3d-in py-2 px-3 text-xs w-full text-center no-underline text-white font-bold block"
              >
                ⬇ Download MySQL DDL Schema (.sql)
              </a>

              <a
                href="/api/mysql/export-dump"
                download="gateregister_data_dump.sql"
                className="btn-3d btn-3d-sec py-2 px-3 text-xs w-full text-center no-underline text-[#1b1f24] font-bold block"
              >
                ⬇ Download Full MySQL Data Dump (.sql)
              </a>
            </div>
          </Card3D>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card3D className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1b1f24]">Activity log & tamper check</h2>
                <p className="text-xs text-[#5f6b7a]">
                  Checks that no entry history or record was changed outside this program.
                </p>
              </div>
              <Button3D
                variant="in"
                size="sm"
                onClick={handleRunTamperCheck}
                disabled={isVerifying}
              >
                {isVerifying ? 'Checking...' : 'Run tamper check'}
              </Button3D>
            </div>

            {tamperResult && (
              <div className={`p-3.5 rounded-lg border text-xs font-semibold ${tamperResult.valid ? 'bg-[#e8f6ed] border-[#9fd6b2] text-[#15803d]' : 'bg-[#fdecec] border-[#efa5a5] text-[#b91c1c]'}`}>
                {tamperResult.valid ? (
                  <span>✔ No tampering found — {tamperResult.checkedCount} log records verified.</span>
                ) : (
                  <span>⚠ Discrepancy found!</span>
                )}
              </div>
            )}
          </Card3D>

          <Card3D className="overflow-hidden">
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[550px] text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#f7f8f9] border-b border-[#dde1e6] text-[#555] uppercase text-[10px] sticky top-0">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Code</th>
                    <th className="py-2 px-3">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dde1e6] font-mono text-[11px]">
                  {auditLogs.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-[#5f6b7a]">{a.id}</td>
                      <td className="py-2 px-3 text-[#5f6b7a]">{a.ts}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-[#1b1f24]">{a.user_name}</td>
                      <td className="py-2 px-3 font-bold text-[#15803d]">{a.action}</td>
                      <td className="py-2 px-3 text-[#1b1f24]">{a.code || '-'}</td>
                      <td className="py-2 px-3 text-[#5f6b7a] truncate max-w-[120px]">{a.hash.slice(0, 16)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card3D>
        </div>
      )}
    </PageMotion>
  );
};
