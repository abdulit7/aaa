import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SystemSettings } from '../types';

interface SettingsContextType {
  settings: SystemSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<{ success: boolean; error?: string }>;
  reloadSettings: () => Promise<void>;
}

const DEFAULT_CLIENT_SETTINGS: SystemSettings = {
  company_name: 'GUJRANWALA FOOD INDUSTRIES (PVT) LTD',
  company_short: '',
  app_name: 'Gate Register',
  logo_url: '',
  gates: 'Main Gate,Gate 2 (Raw Material),Gate 3 (Dispatch)',
  units: 'Bags,Cartons,Drums,Pcs,KG,Tons,Litre,Rolls,Bundles,Pallets,Boxes,Sets',
  in_purposes: 'Purchase,Raw Material,Packaging,Returnable Item Back,Customer Return,Sample,Job Work,Machinery Repair,General Store',
  out_purposes: 'Finished Goods / Sale,Return to Supplier,Contractor Repair,Job Work Dispatched,Scrap & Waste,Sample,Company Asset,Empty Pallets / Containers,Other',
  photo_required_in: true,
  photo_required_out: false,
  idle_logout_minutes: 30
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const cached = localStorage.getItem('gatemaster_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.company_short === 'GFI LOGISTICS') parsed.company_short = '';
        if (parsed.app_name === 'GFI · Gate Register') parsed.app_name = 'Gate Register';
        return { ...DEFAULT_CLIENT_SETTINGS, ...parsed };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_CLIENT_SETTINGS;
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.company_short === 'GFI LOGISTICS') data.company_short = '';
        if (data.app_name === 'GFI · Gate Register') data.app_name = 'Gate Register';
        const merged = { ...DEFAULT_CLIENT_SETTINGS, ...data };
        setSettings(merged);
        localStorage.setItem('gatemaster_settings', JSON.stringify(merged));
      }
    } catch (err) {
      console.warn('Could not load settings from server, using local defaults', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (newSettings: Partial<SystemSettings>): Promise<{ success: boolean; error?: string }> => {
    const token = localStorage.getItem('gatemaster_token');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newSettings)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.error || 'Failed to save settings' };
      }

      const updated = await res.json();
      const merged = { ...settings, ...updated };
      setSettings(merged);
      localStorage.setItem('gatemaster_settings', JSON.stringify(merged));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error saving settings' };
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, reloadSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
