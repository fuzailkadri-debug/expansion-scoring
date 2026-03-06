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
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Data Upload', icon: Upload },
  { href: '/book-overview', label: 'Book Overview', icon: BookOpen },
  { href: '/expansion', label: 'Expansion', icon: TrendingUp },
  { href: '/churn', label: 'Churn Risk', icon: AlertTriangle },
  { href: '/renewals', label: 'Renewals', icon: RefreshCw },
  { href: '/adoption', label: 'Adoption', icon: BarChart2 },
  { href: '/chat', label: 'AI Chat', icon: MessageSquare, badge: 'Gemini' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-brand text-white flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-brand-light">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-blue-300" />
          <span className="font-semibold text-sm leading-tight">CS Intelligence</span>
        </div>
        <p className="text-xs text-blue-300 mt-0.5">BioRender · Book of Business</p>
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
      <div className="px-5 py-4 border-t border-brand-light">
        <p className="text-xs text-blue-300">Powered by Gemini Flash</p>
      </div>
    </aside>
  );
}
