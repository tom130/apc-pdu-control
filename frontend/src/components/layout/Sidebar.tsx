import { NavLink } from 'react-router-dom';
import { Home, Server, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/events', icon: AlertCircle, label: 'Events' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-card h-[calc(100vh-4rem)]">
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
        
        <div className="pt-4 border-t">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase">
            PDUs
          </h3>
          <PDUList />
        </div>
      </nav>
    </aside>
  );
}

function PDUList() {
  const pdus = usePDUStore((state) => state.pdus);
  
  return (
    <div className="mt-2 space-y-1">
      {Array.isArray(pdus) && pdus.map((pdu) => (
        <NavLink
          key={pdu.id}
          to={`/pdu/${pdu.id}`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground'
            )
          }
        >
          <Server className="h-4 w-4" />
          <span className="truncate">{pdu.name}</span>
          <span
            className={cn(
              'ml-auto h-2 w-2 rounded-full',
              pdu.isActive ? 'bg-green-500' : 'bg-gray-400'
            )}
          />
        </NavLink>
      ))}
    </div>
  );
}

import usePDUStore from '@/store/pduStore';