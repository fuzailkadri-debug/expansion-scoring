'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  MessageSquare,
  Upload,
  Settings,
  Plug,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { loadProfile } from '@/lib/store';

const NAV = [
  { href: '/', label: 'Data Upload', icon: Upload },
  { href: '/book-overview', label: 'Book Overview', icon: BookOpen },
  { href: '/expansion', label: 'Expansion', icon: TrendingUp },
  { href: '/churn', label: 'Churn Risk', icon: AlertTriangle },
  { href: '/renewals', label: 'Renewals', icon: RefreshCw },
  { href: '/adoption', label: 'Adoption', icon: BarChart2 },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare, badge: 'Gemini' },
  { href: '/connectors', label: 'Connectors', icon: Plug },
  { href: '/settings', label: 'My Profile', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [csmName, setCsmName] = useState('');
  useEffect(() => {
    setCsmName(loadProfile().name);
  }, []);

  return (
    <aside className="w-60 shrink-0 bg-brand text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-light">
        <img src="/biorender-logo.png" alt="BioRender" className="h-8 w-auto brightness-0 invert mb-2" />
        <p className="text-xs font-semibold text-white leading-tight">CS Intelligence Tool</p>
        <p className="text-xs text-blue-300 mt-0.5">by Fuzail Kadri</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-100 hover:bg-brand-light hover:text-white',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-brand-light space-y-0.5">
        {csmName && <p className="text-xs text-white font-medium truncate">{csmName}</p>}
        <p className="text-xs text-blue-300">Powered by Gemini Flash</p>
      </div>
    </aside>
  );
}
