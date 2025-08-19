import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download } from 'lucide-react';
import { pduApi } from '@/api/pdu';
import { format } from 'date-fns';
import usePDUStore from '@/store/pduStore';

export function Events() {
  const { pdus } = usePDUStore();
  
  const { data: events = [], refetch, isLoading } = useQuery({
    queryKey: ['all-events'],
    queryFn: () => pduApi.getAllEvents(100),
  });

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'PDU', 'Event Type', 'Description'],
      ...events.map(event => {
        const pdu = pdus.find(p => p.id === event.pduId);
        return [
          format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss'),
          pdu?.name || 'Unknown',
          event.eventType,
          event.description,
        ];
      }),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdu-events-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Events</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No events recorded
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const pdu = pdus.find(p => p.id === event.pduId);
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge>{event.eventType.replace('_', ' ')}</Badge>
                        <span className="font-medium">{pdu?.name || 'Unknown PDU'}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(event.timestamp), 'MMM dd, HH:mm:ss')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}