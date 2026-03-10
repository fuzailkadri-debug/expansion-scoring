'use client';

import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import {
  RefreshCw, ExternalLink, Users, Calendar, AlertCircle,
  CheckCircle2, Clock, PauseCircle, XCircle, Settings,
} from 'lucide-react';
import Link from 'next/link';
import { loadProfile } from '@/lib/store';

interface Project {
  'Project Name': string;
  Description: string;
  Status: string;
  Owner: string;
  'Team Members': string;
  'Target Date': string;
  Notes: string;
  [key: string]: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  'Active':      { bg: 'bg-green-100',  text: 'text-green-800',  icon: CheckCircle2 },
  'In Progress': { bg: 'bg-blue-100',   text: 'text-blue-800',   icon: Clock },
  'Planning':    { bg: 'bg-purple-100', text: 'text-purple-800', icon: Clock },
  'On Hold':     { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: PauseCircle },
  'Complete':    { bg: 'bg-gray-100',   text: 'text-gray-600',   icon: CheckCircle2 },
  'Blocked':     { bg: 'bg-red-100',    text: 'text-red-700',    icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['Planning'];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" />
      {status || 'Unknown'}
    </span>
  );
}

function TeamChips({ members }: { members: string }) {
  if (!members?.trim()) return <span className="text-gray-400 text-xs">—</span>;
  const list = members.split(',').map((m) => m.trim()).filter(Boolean);
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((m) => (
        <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
          {m}
        </span>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const profile = loadProfile();
    setSheetUrl(profile.projectsSheetUrl ?? '');
    if (profile.projectsSheetUrl) fetchSheet(profile.projectsSheetUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSheet = useCallback(async (url: string) => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/sheets?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to fetch sheet');
      }
      const csv = await res.text();
      const { data } = Papa.parse<Project>(csv, { header: true, skipEmptyLines: true });
      setProjects(data);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const statuses = ['All', ...Array.from(new Set(projects.map((p) => p.Status).filter(Boolean)))];
  const filtered = statusFilter === 'All' ? projects : projects.filter((p) => p.Status === statusFilter);

  const statusCounts = Object.keys(STATUS_STYLES).reduce<Record<string, number>>((acc, s) => {
    acc[s] = projects.filter((p) => p.Status === s).length;
    return acc;
  }, {});

  if (!sheetUrl) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Projects</h1>
        <p className="text-gray-500 text-sm mb-8">Connect a Google Sheet to track AI builder projects and team status.</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-gray-800">Setup — 3 steps</h2>
          <ol className="space-y-4 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div>
                <p className="font-medium">Create your Google Sheet</p>
                <p className="text-gray-500 mt-0.5">Use these column headers (copy exactly):</p>
                <code className="block mt-1.5 text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 font-mono">
                  Project Name, Description, Status, Owner, Team Members, Target Date, Notes
                </code>
                <p className="text-gray-400 text-xs mt-1">Status options: Active, In Progress, Planning, On Hold, Complete, Blocked</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div>
                <p className="font-medium">Publish the sheet to the web</p>
                <p className="text-gray-500 mt-0.5">In Google Sheets: <strong>File → Share → Publish to web → Sheet1 → Comma-separated values (.csv) → Publish</strong></p>
                <p className="text-gray-500 mt-0.5">Copy the URL it gives you.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 bg-brand text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <div>
                <p className="font-medium">Paste the URL in My Profile → Projects Sheet URL</p>
                <Link href="/settings" className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1">
                  <Settings className="w-3.5 h-3.5" />
                  Go to My Profile
                </Link>
              </div>
            </li>
          </ol>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <strong>Visible to all team members?</strong> Yes — once you paste the sheet URL, anyone who opens this app on the same Vercel URL will see the live sheet data. They can edit projects directly in Google Sheets and the app refreshes automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Projects</h1>
          <p className="text-gray-500 text-sm mt-1">
            {lastRefreshed
              ? `Last refreshed ${lastRefreshed.toLocaleTimeString()}`
              : 'Loading from Google Sheet...'}
            {' · '}
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-0.5">
              Open Sheet <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <button
          onClick={() => fetchSheet(sheetUrl)}
          disabled={loading}
          className="flex items-center gap-2 bg-brand text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-light transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Could not load sheet</p>
            <p className="text-xs mt-0.5">{error}</p>
            <p className="text-xs mt-1 text-red-500">Make sure the sheet is published to web as CSV (File → Share → Publish to web).</p>
          </div>
        </div>
      )}

      {/* Status summary */}
      {projects.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.entries(STATUS_STYLES).map(([status, style]) => {
            const count = statusCounts[status] ?? 0;
            if (count === 0) return null;
            const Icon = style.icon;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? 'All' : status)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  statusFilter === status ? 'ring-2 ring-brand border-brand' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`inline-flex items-center gap-1 text-xs font-medium ${style.text}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {status}
                </div>
                <p className="text-xl font-bold text-gray-900 mt-1">{count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter */}
      {statuses.length > 2 && (
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600">Filter:</label>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  statusFilter === s
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-400">{filtered.length} projects</span>
        </div>
      )}

      {/* Project cards */}
      {loading && projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm">Loading from Google Sheet...</p>
        </div>
      ) : filtered.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No projects found. Add rows to your Google Sheet and hit Refresh.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((project, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                  {project['Project Name'] || '(Untitled)'}
                </h3>
                <StatusBadge status={project.Status} />
              </div>

              {project.Description && (
                <p className="text-sm text-gray-600 leading-relaxed">{project.Description}</p>
              )}

              <div className="space-y-2 pt-1">
                {project.Owner && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="font-medium text-gray-700">Owner:</span>
                    <span>{project.Owner}</span>
                  </div>
                )}

                {project['Team Members'] && (
                  <div className="flex items-start gap-2 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5 shrink-0 text-gray-400 mt-0.5" />
                    <span className="font-medium text-gray-700 shrink-0">Team:</span>
                    <TeamChips members={project['Team Members']} />
                  </div>
                )}

                {project['Target Date'] && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                    <span className="font-medium text-gray-700">Target:</span>
                    <span>{project['Target Date']}</span>
                  </div>
                )}
              </div>

              {project.Notes && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 italic border border-gray-100">
                  {project.Notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
