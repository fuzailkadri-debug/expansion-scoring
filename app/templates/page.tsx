'use client';

import { useState, useEffect } from 'react';
import { Copy, Mail, ChevronRight, Sparkles, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { loadProfile } from '@/lib/store';
import { fmt$, fmtPct } from '@/lib/utils';
import { Account } from '@/lib/types';

interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  useCase: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'expansion-tier1',
    name: 'Expansion Outreach — Tier 1',
    category: 'Expansion',
    useCase: 'Best for: Tier 1 accounts with high dept-match free users',
    subject: 'Scaling your BioRender license at {{organization}}',
    body: `Hi [Contact Name],

I wanted to reach out because I noticed there are {{free_users}} researchers at {{organization}} who are already using BioRender on the free plan — many in the same departments as your current licensed team.

Given your team is at {{activation}} activation and clearly getting strong value from the platform, I think there's a real opportunity to consolidate everyone onto your existing license and streamline access.

I'd love to connect for a quick 20-minute call to walk through what that would look like in practice. Are you available this week?

Best,
{{csm_name}}

---
Your current plan: {{license_type}} · {{arr}} ARR · Renews in {{days_to_renewal}} days`,
  },
  {
    id: 'dg-sw-renewal',
    name: 'DG/Sitewide Renewal + Expansion',
    category: 'Expansion',
    useCase: 'Best for: Defined Group or Sitewide accounts entering renewal window',
    subject: 'Your {{license_type}} license renewal at {{organization}} — let\'s plan ahead',
    body: `Hi [Contact Name],

With {{organization}}'s renewal coming up in {{days_to_renewal}} days, I wanted to get in touch now so we have plenty of time to review your license and make sure it still fits your team's needs going forward.

A few things worth discussing:
• Your current {{license_type}} covers your core teams — are there other departments we should include?
• Activation is at {{activation}}, which is strong. Any gaps we should address before renewal?
• {{free_users}} additional researchers in your org are on the free tier — we could look at bringing them under the license

Can we find 30 minutes in the next two weeks?

Best,
{{csm_name}}`,
  },
  {
    id: 'free-users-convert',
    name: 'Free User Conversion Pitch',
    category: 'Expansion',
    useCase: 'Best for: Accounts with high dept-match free users and room to expand seats',
    subject: 'BioRender update for {{organization}}',
    body: `Hi [Contact Name],

Quick note — I can see that {{free_users}} researchers at {{organization}} are actively using BioRender's free tier. Many appear to be in the same groups as your current licensed users.

A couple of thoughts:
1. Free tier users have limited access — they can't use premium templates, export at full resolution, or collaborate seamlessly with your licensed team
2. Adding them to your existing {{license_type}} license would give everyone a consistent experience

Happy to put together a quick cost comparison if that would be helpful. Your renewal is {{days_to_renewal}} days away, so the timing works well.

Let me know!

{{csm_name}}`,
  },
  {
    id: 'health-checkin',
    name: 'Health Check-In (Yellow/Red)',
    category: 'Retention',
    useCase: 'Best for: Accounts with Yellow or Red health status',
    subject: 'Checking in on your BioRender experience — {{organization}}',
    body: `Hi [Contact Name],

I wanted to reach out personally to check in on how things are going with BioRender at {{organization}}.

I noticed your team's activation is at {{activation}}, and I want to make sure everyone is getting the full value from the platform. Sometimes there are onboarding gaps or features people haven't discovered yet that can make a big difference.

A few things I can help with:
• A quick training session for any new team members
• Walking through advanced features your team might not be using yet
• Troubleshooting any friction points with the platform

Would a 30-minute check-in call work? I want to make sure {{organization}} is set up for success before your renewal in {{days_to_renewal}} days.

Best,
{{csm_name}}`,
  },
  {
    id: 'qbr-invite',
    name: 'QBR / Business Review Invite',
    category: 'Retention',
    useCase: 'Best for: Quarterly business reviews with key accounts',
    subject: 'Quarterly review invite — {{organization}} x BioRender',
    body: `Hi [Contact Name],

I'd like to schedule a quarterly business review for {{organization}} to make sure we're aligned on your team's goals and getting the most out of BioRender.

In our review, I'd like to cover:
• Usage highlights — what your team has created and accomplished
• Activation overview — {{activation}} of your license is being used
• Upcoming features and roadmap items relevant to your workflows
• Your renewal ({{days_to_renewal}} days away) and any changes to your team's needs

These sessions are typically 45 minutes and I can share a summary doc ahead of time.

Does [suggest 2-3 dates] work for you?

Looking forward to it,
{{csm_name}}`,
  },
  {
    id: 'churn-save',
    name: 'Churn Save — Re-engagement',
    category: 'Retention',
    useCase: 'Best for: High churn risk accounts before drafting a full playbook',
    subject: 'Re: {{organization}} — BioRender',
    body: `Hi [Contact Name],

I've been reviewing your account and wanted to reach out directly. I can see that BioRender usage at {{organization}} has dropped off, and with renewal {{days_to_renewal}} days away, I want to make sure we address anything that isn't working.

I'd love to understand:
• Is the team running into any specific challenges with the platform?
• Has anything changed with your research workflows or team structure?
• Is there anything we could do differently to make BioRender more valuable for your team?

Your feedback matters a lot to us, and I want to make sure we earn the renewal. Even a quick 15-minute call would be incredibly helpful.

Best,
{{csm_name}}`,
  },
];

function fillTemplate(template: Template, account: Account | null, csmName: string): { subject: string; body: string } {
  const fields: Record<string, string> = {
    '{{organization}}': account?.organization ?? '[Organization]',
    '{{arr}}': account ? fmt$(account.renewalTargetAmount) : '[ARR]',
    '{{renewal_date}}': account?.renewalDate ?? '[Renewal Date]',
    '{{days_to_renewal}}': account ? String(account.daysToRenewal) : '[X]',
    '{{activation}}': account ? fmtPct(account.trueActivation) : '[X%]',
    '{{free_users}}': account ? String(account.freeUsers) : '[X]',
    '{{tier}}': account?.tier ?? '[Tier]',
    '{{license_type}}': account?.licenseType ?? '[License Type]',
    '{{csm_name}}': csmName || '[Your Name]',
  };

  let subject = template.subject;
  let body = template.body;
  for (const [field, value] of Object.entries(fields)) {
    subject = subject.replaceAll(field, value);
    body = body.replaceAll(field, value);
  }
  return { subject, body };
}

function openInGmail(subject: string, body: string) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank');
}

const CATEGORIES = ['All', 'Expansion', 'Retention'];

export default function TemplatesPage() {
  const { accounts, isLoaded } = useAppStore();
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(TEMPLATES[0]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [csmName, setCsmName] = useState('');
  const [category, setCategory] = useState('All');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCsmName(loadProfile().name);
  }, []);

  const filtered = category === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.category === category);
  const { subject, body } = fillTemplate(selectedTemplate, selectedAccount, csmName);

  function handleCopy() {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tier1Accounts = [...accounts]
    .filter((a) => a.tier === 'Tier 1' || a.tier === 'Tier 2')
    .sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="text-gray-500 text-sm mt-1">
          Select a template, pick an account to fill merge fields, then open directly in Gmail.
        </p>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Template list */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* Category filter */}
          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  category === c
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto space-y-1.5">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  selectedTemplate.id === t.id
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium leading-snug">{t.name}</p>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                </div>
                <span className={`text-xs mt-1 inline-block px-1.5 py-0.5 rounded font-medium ${
                  selectedTemplate.id === t.id
                    ? 'bg-white/20 text-white'
                    : t.category === 'Expansion' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {t.category}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Preview + controls */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-auto">
          {/* Account selector + actions */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-4 shrink-0">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Fill merge fields for account <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={selectedAccount?.opportunityName ?? ''}
                onChange={(e) => {
                  const acct = accounts.find((a) => a.opportunityName === e.target.value) ?? null;
                  setSelectedAccount(acct);
                }}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">— No account selected —</option>
                {tier1Accounts.map((a) => (
                  <option key={a.opportunityName} value={a.opportunityName}>
                    {a.organization} ({a.tier})
                  </option>
                ))}
                {accounts.filter((a) => !['Tier 1', 'Tier 2'].includes(a.tier)).map((a) => (
                  <option key={a.opportunityName} value={a.opportunityName}>
                    {a.organization}
                  </option>
                ))}
              </select>
              {!isLoaded && <p className="text-xs text-gray-400 mt-1">Upload data on home page to enable account selection.</p>}
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => openInGmail(subject, body)}
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors"
              >
                <Mail className="w-4 h-4" />
                Open in Gmail
              </button>
            </div>
          </div>

          {/* Use case hint */}
          <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            {selectedTemplate.useCase}
          </div>

          {/* Email preview */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex-1 overflow-auto">
            <div className="border-b border-gray-100 pb-3 mb-4">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Subject</p>
              <p className="text-sm font-semibold text-gray-900">{subject}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Body</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{body}</pre>
            </div>

            {/* Merge field legend */}
            {!selectedAccount && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-2">Merge fields (filled when account selected):</p>
                <div className="flex flex-wrap gap-1.5">
                  {['{{organization}}', '{{arr}}', '{{days_to_renewal}}', '{{activation}}', '{{free_users}}', '{{license_type}}', '{{csm_name}}'].map((f) => (
                    <code key={f} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{f}</code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
