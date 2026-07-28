'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Home, ShoppingCart, Package, Users, Wallet, FileText,
  RefreshCcw, Landmark, Calendar, Settings, Smartphone, LogOut,
  ChevronUp, Store,
} from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import { useSession } from '@/shared/providers/SessionProvider';
import { supabase } from '@/platform/supabase/client';

const navigation = [
  { name: 'Dashboard',       href: '/dashboard',       icon: Home        },
  { name: 'Sales',           href: '/sales',           icon: ShoppingCart },
  { name: 'Purchases',       href: '/purchases',       icon: Package     },
  { name: 'Inventory',       href: '/inventory',       icon: Smartphone  },
  { name: 'Parties',         href: '/parties',         icon: Users       },
  { name: 'Payments',        href: '/payments',        icon: Wallet      },
  { name: 'Exchange',        href: '/exchange',        icon: RefreshCcw  },
  { name: 'Accounts',        href: '/accounts',        icon: Landmark    },
  { name: 'Proforma',        href: '/proformas',       icon: FileText    },
  { name: 'Financial Year',  href: '/financial-year',  icon: Calendar    },
  { name: 'Settings',        href: '/settings',        icon: Settings    },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useSession();

  const [storeName, setStoreName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch store name and logo from DB
  useEffect(() => {
    supabase
      .from('store')
      .select('name, logo_url')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStoreName(data.name || null);
          setLogoUrl(data.logo_url || null);
        }
      });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const displayName = storeName || user?.email || 'My Store';
  const initial = displayName[0]?.toUpperCase() || 'S';

  return (
    <div className="flex flex-col w-48 bg-white border-r border-slate-200 shrink-0">
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2.5">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile dropdown */}
      <div className="px-2.5 py-3 border-t border-slate-200" ref={dropdownRef}>
        {/* Dropdown menu — renders above the trigger */}
        {dropdownOpen && (
          <div className="mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
            <button
              onClick={() => { setDropdownOpen(false); signOut(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              Sign Out
            </button>
          </div>
        )}

        {/* Trigger row */}
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors',
            dropdownOpen ? 'bg-slate-100' : 'hover:bg-slate-50',
          )}
        >
          {/* Avatar / store logo */}
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              width={28}
              height={28}
              className="h-7 w-7 rounded-full object-cover shrink-0 border border-slate-200"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[11px] shrink-0 border border-indigo-200">
              {initial}
            </div>
          )}

          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Store className="h-2.5 w-2.5 shrink-0" />
              Owner
            </p>
          </div>

          <ChevronUp
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150',
              !dropdownOpen && 'rotate-180',
            )}
          />
        </button>
      </div>
    </div>
  );
}
