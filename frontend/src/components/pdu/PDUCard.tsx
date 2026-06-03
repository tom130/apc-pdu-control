import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Power, ArrowRight, RefreshCw } from 'lucide-react';
import { PDU } from '@/types/pdu';
import usePDUStore from '@/store/pduStore';
import { format } from 'date-fns';

interface PDUCardProps {
  pdu: PDU;
}

export function PDUCard({ pdu }: PDUCardProps) {
  const navigate = useNavigate();
  const { getOutletsByPduId } = usePDUStore();
  
  const outlets = getOutletsByPduId(pdu.id);
  const autoRestoreCount = outlets.filter(o => o.autoRecovery).length;

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/pdu/${pdu.id}`)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle className="text-lg">{pdu.name}</CardTitle>
          </div>
          <Badge variant={pdu.isActive ? 'success' : 'secondary'}>
            {pdu.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <CardDescription>{pdu.ipAddress}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Model</span>
            <span>{pdu.model || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Outlets</span>
            <span>{outlets.length}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Outlets On</span>
            <span className="flex items-center gap-1">
              <Power className="h-3 w-3 text-green-500" />
              {outlets.filter(o => o.actualState === 'on').length}
            </span>
          </div>
          
          {outlets.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Auto-Restore</span>
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3 text-blue-500" />
                {autoRestoreCount}/{outlets.length}
              </span>
            </div>
          )}
          
          {pdu.lastSeen && (
            <div className="text-xs text-muted-foreground text-center pt-2">
              Last seen: {format(new Date(pdu.lastSeen), 'HH:mm:ss')}
            </div>
          )}
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full mt-4"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/pdu/${pdu.id}`);
          }}
        >
          View Details
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
