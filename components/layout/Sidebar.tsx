'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, ShoppingCart, Package, Users, Wallet, FileText,
  RefreshCcw, Landmark, Calendar, Settings, Smartphone, LogOut,
} from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import { useSession } from '@/shared/providers/SessionProvider';


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


  return (
    <div className="flex flex-col w-56 bg-white border-r border-slate-200 shrink-0">
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

      {/* User row */}
      <div className="px-2.5 py-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
          <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-[10px] shrink-0 border border-slate-300">
            {user?.email?.[0].toUpperCase() || 'O'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">{user?.email || 'Owner'}</p>
            <p className="text-[10px] text-slate-400">Owner</p>
          </div>
          <button
            onClick={() => signOut()}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
