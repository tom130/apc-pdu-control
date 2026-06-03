import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Power, WifiOff, Wifi } from 'lucide-react';
import { pduApi } from '@/api/pdu';
import { PDUEvent } from '@/types/pdu';
import { format } from 'date-fns';
import usePDUStore from '@/store/pduStore';

export function RecentEventsCard() {
  const { pdus } = usePDUStore();
  
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => pduApi.getAllEvents(20),
    refetchInterval: 60000, // Refetch every minute
  });

  const getEventIcon = (eventType: PDUEvent['eventType']) => {
    switch (eventType) {
      case 'connection_lost':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'connection_restored':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'recovery_complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'state_skew':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Power className="h-4 w-4" />;
    }
  };

  const getEventVariant = (eventType: PDUEvent['eventType']): 'default' | 'secondary' | 'destructive' | 'warning' | 'success' => {
    switch (eventType) {
      case 'connection_lost':
        return 'destructive';
      case 'connection_restored':
      case 'recovery_complete':
        return 'success';
      case 'state_skew':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getEventLabel = (eventType: PDUEvent['eventType']) => {
    if (eventType === 'state_skew') return 'load warning';
    return eventType.replace('_', ' ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Events</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent events</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const pdu = pdus.find(p => p.id === event.pduId);
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-0.5">{getEventIcon(event.eventType)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getEventVariant(event.eventType)}>
                        {getEventLabel(event.eventType)}
                      </Badge>
                      <span className="text-sm font-medium">
                        {pdu?.name || 'Unknown PDU'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(event.timestamp), 'MMM dd, HH:mm:ss')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
