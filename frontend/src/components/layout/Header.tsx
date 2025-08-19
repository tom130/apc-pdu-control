import { Power, Activity, AlertTriangle, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import usePDUStore from '@/store/pduStore';

export function Header() {
  const navigate = useNavigate();
  const { systemHealth, pdus } = usePDUStore();
  
  const activePdus = Array.isArray(pdus) ? pdus.filter(p => p.isActive).length : 0;
  const hasSkew = systemHealth && systemHealth.stateSkewPercentage > 10;

  return (
    <header className="border-b bg-card">
      <div className="flex h-16 items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <Power className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">APC PDU Control Panel</h1>
        </div>
        
        <div className="flex-1 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              Active PDUs: <Badge variant="success">{activePdus}/{Array.isArray(pdus) ? pdus.length : 0}</Badge>
            </span>
          </div>
          
          {systemHealth && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  Total Outlets: <Badge variant="secondary">{systemHealth.totalOutlets}</Badge>
                </span>
              </div>
              
              {hasSkew && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">
                    State Skew: <Badge variant="warning">{systemHealth.stateSkewPercentage.toFixed(1)}%</Badge>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/settings')}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}