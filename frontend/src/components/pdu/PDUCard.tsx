import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Power, AlertTriangle, ArrowRight } from 'lucide-react';
import { PDU } from '@/types/pdu';
import usePDUStore from '@/store/pduStore';
import { format } from 'date-fns';

interface PDUCardProps {
  pdu: PDU;
}

export function PDUCard({ pdu }: PDUCardProps) {
  const navigate = useNavigate();
  const { getOutletsByPduId, getSkewedOutlets, reconciliations } = usePDUStore();
  
  const outlets = getOutletsByPduId(pdu.id);
  const skewedOutlets = getSkewedOutlets(pdu.id);
  const reconciliation = reconciliations[pdu.id];
  const hasSkew = skewedOutlets.length > 0;

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
          
          {hasSkew && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">State Skew</span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                {skewedOutlets.length}
              </span>
            </div>
          )}
          
          {reconciliation?.isReconciling && (
            <Badge variant="warning" className="w-full justify-center">
              Reconciling...
            </Badge>
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