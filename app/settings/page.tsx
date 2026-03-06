'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, User } from 'lucide-react';
import { loadProfile, saveProfile, CSMProfile } from '@/lib/store';

export default function SettingsPage() {
  const [profile, setProfile] = useState<CSMProfile>({
    name: '',
    email: '',
    sfOwnerName: '',
    team: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
          <p className="text-gray-500 text-sm">Saved in your browser — each CSM sets their own.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Fuzail Kadri"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            BioRender Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            placeholder="e.g. fuzail@biorender.com"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Salesforce Owner Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Fuzail Kadri (exactly as it appears in Salesforce)"
            value={profile.sfOwnerName}
            onChange={(e) => setProfile({ ...profile, sfOwnerName: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 mt-1">
            Used to label your data. Check your Salesforce opportunity owner field for the exact spelling.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team / Segment <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Enterprise, Mid-Market, SMB"
            value={profile.team}
            onChange={(e) => setProfile({ ...profile, team: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-brand-light transition-colors"
          >
            Save Profile
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>
      </form>

      {/* Hex guide */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-900 text-sm mb-2">How to get your Hex data</h2>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
          <li>Open Hex and run your free-user query (see CLAUDE.md for the prompt)</li>
          <li>Make sure your Salesforce Owner Name above matches exactly what you use in the Hex query</li>
          <li>Download the results as CSV</li>
          <li>Upload on the Data Upload page alongside your Salesforce export</li>
        </ol>
        <p className="text-xs text-blue-600 mt-3">
          Note: Direct Hex API connection requires a workspace API key. Ask your Hex admin if you want one-click data refresh.
        </p>
      </div>

      {/* About */}
      <div className="mt-6 text-center text-xs text-gray-400">
        BioRender CS Intelligence Tool · Created by Fuzail Kadri
      </div>
    </div>
  );
}
