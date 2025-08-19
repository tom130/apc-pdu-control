import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PDU, PowerMetrics } from '@/types/pdu';
import { format } from 'date-fns';
import { Server, Zap, Activity, Clock } from 'lucide-react';

interface PDUInfoProps {
  pdu: PDU;
  metrics?: PowerMetrics | null;
}

export function PDUInfo({ pdu, metrics }: PDUInfoProps) {
  const loadStateColor = {
    normal: 'success',
    low: 'secondary',
    near_overload: 'warning',
    overload: 'destructive',
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          PDU Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm text-muted-foreground">Status</div>
          <Badge variant={pdu.isActive ? 'success' : 'secondary'}>
            {pdu.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div>
          <div className="text-sm text-muted-foreground">Model</div>
          <div className="font-medium">{pdu.model || 'Unknown'}</div>
        </div>

        <div>
          <div className="text-sm text-muted-foreground">SNMP Version</div>
          <div className="font-medium">{pdu.snmpVersion}</div>
        </div>

        {metrics && (
          <>
            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Power Draw
              </div>
              <div className="text-2xl font-bold">
                {metrics.totalPowerDraw.toFixed(1)} A / {metrics.totalPowerWatts || Math.round(metrics.totalPowerDraw * 230)} W
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Load State
              </div>
              <Badge variant={loadStateColor[metrics.loadState]}>
                {metrics.loadState.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </>
        )}

        {pdu.lastSeen && (
          <div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last Seen
            </div>
            <div className="font-medium">
              {format(new Date(pdu.lastSeen), 'MMM dd, HH:mm:ss')}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}