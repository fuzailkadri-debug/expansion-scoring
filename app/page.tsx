'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { Upload, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { mergeAndScore } from '@/lib/scoring';
import { fmt$ } from '@/lib/utils';
import MetricCard from '@/components/MetricCard';

type FileState = 'idle' | 'loaded' | 'error';

interface FileZoneProps {
  label: string;
  sublabel: string;
  state: FileState;
  filename?: string;
  required?: boolean;
  onChange: (file: File) => void;
}

function FileZone({ label, sublabel, state, filename, required, onChange }: FileZoneProps) {
  return (
    <label className="block cursor-pointer">
      <div
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          state === 'loaded'
            ? 'border-green-400 bg-green-50'
            : state === 'error'
              ? 'border-red-400 bg-red-50'
              : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        {state === 'loaded' ? (
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
        ) : state === 'error' ? (
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        ) : (
          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        )}
        <p className="font-semibold text-gray-800 text-sm">
          {label} {required && <span className="text-red-500">*</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
        {filename && (
          <p className="text-xs text-green-700 mt-1 truncate max-w-[200px] mx-auto">{filename}</p>
        )}
      </div>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(f);
        }}
      />
    </label>
  );
}

function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => resolve(r.data as Record<string, unknown>[]),
      error: reject,
    });
  });
}

export default function HomePage() {
  const router = useRouter();
  const { setAccounts, setHasHexData, setHasZendeskData, accounts, isLoaded } = useAppStore();

  const [sfFile, setSfFile] = useState<File | null>(null);
  const [hexFile, setHexFile] = useState<File | null>(null);
  const [zdFile, setZdFile] = useState<File | null>(null);
  const [sfState, setSfState] = useState<FileState>('idle');
  const [hexState, setHexState] = useState<FileState>('idle');
  const [zdState, setZdState] = useState<FileState>('idle');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSfFile = useCallback((f: File) => {
    setSfFile(f);
    setSfState('loaded');
    setError(null);
  }, []);

  const handleHexFile = useCallback((f: File) => {
    setHexFile(f);
    setHexState('loaded');
  }, []);

  const handleZdFile = useCallback((f: File) => {
    setZdFile(f);
    setZdState('loaded');
  }, []);

  async function handleProcess() {
    if (!sfFile) {
      setError('Please upload your Salesforce CSV first.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const [sfRows, hexRows, zdRows] = await Promise.all([
        parseCSV(sfFile),
        hexFile ? parseCSV(hexFile) : Promise.resolve([]),
        zdFile ? parseCSV(zdFile) : Promise.resolve(null),
      ]);

      const scored = mergeAndScore(
        sfRows,
        hexRows,
        zdRows as Record<string, unknown>[] | null,
      );

      setAccounts(scored);
      setHasHexData(hexFile !== null);
      setHasZendeskData(zdFile !== null);
      router.push('/book-overview');
    } catch (e) {
      setError(`Failed to process data: ${e instanceof Error ? e.message : String(e)}`);
      setSfState('error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">BioRender CS Intelligence Tool</h1>
      <p className="text-gray-500 mt-1 text-sm">
        Upload your data to score accounts for expansion, churn risk, and renewals.
      </p>

      <div className="mt-8 space-y-6">
        {/* Salesforce */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            1. Salesforce Export <span className="text-red-500">required</span>
          </h2>
          <FileZone
            label="Salesforce CSV"
            sublabel="Opportunity Name · ARR · Renewal Date · Health · License Type · Seats"
            state={sfState}
            filename={sfFile?.name}
            required
            onChange={handleSfFile}
          />
        </div>

        {/* Hex */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            2. Hex Free-User Export <span className="text-gray-400">(optional)</span>
          </h2>
          <FileZone
            label="Hex CSV"
            sublabel="Department-matched free & self-serve users — unlocks full expansion scoring"
            state={hexState}
            filename={hexFile?.name}
            onChange={handleHexFile}
          />
        </div>

        {/* Zendesk */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            3. Zendesk Export <span className="text-gray-400">(optional)</span>
          </h2>
          <FileZone
            label="Zendesk CSV"
            sublabel="Support ticket volume — adds context to churn risk analysis"
            state={zdState}
            filename={zdFile?.name}
            onChange={handleZdFile}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleProcess}
          disabled={!sfFile || processing}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white py-3 px-6 rounded-xl font-semibold text-sm hover:bg-brand-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Scoring accounts...
            </>
          ) : (
            <>
              Score Accounts
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Quick stats if data already loaded */}
      {isLoaded && accounts.length > 0 && (
        <div className="mt-10">
          <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Current session
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Accounts" value={accounts.length} />
            <MetricCard
              label="Total ARR"
              value={fmt$(accounts.reduce((s, a) => s + a.renewalTargetAmount, 0))}
            />
            <MetricCard
              label="Tier 1"
              value={accounts.filter((a) => a.tier === 'Tier 1').length}
              color="green"
            />
            <MetricCard
              label="High Churn Risk"
              value={accounts.filter((a) => a.churnRisk === 'High Risk').length}
              color="red"
            />
          </div>
          <button
            onClick={() => router.push('/book-overview')}
            className="mt-3 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            View dashboard <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
