import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PDUCard } from '@/components/pdu/PDUCard';
import { SystemHealthCard } from '@/components/pdu/SystemHealthCard';
import { RecentEventsCard } from '@/components/pdu/RecentEventsCard';
import { AddPDUDialog } from '@/components/pdu/AddPDUDialog';
import { pduApi } from '@/api/pdu';
import usePDUStore from '@/store/pduStore';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus } from 'lucide-react';

export function Dashboard() {
  const { setPdus, setSystemHealth, pdus } = usePDUStore();
  const [addPduDialogOpen, setAddPduDialogOpen] = useState(false);

  const { data: pduData, isLoading: pdusLoading, refetch: refetchPdus } = useQuery({
    queryKey: ['pdus'],
    queryFn: () => pduApi.getPDUs(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => pduApi.getSystemHealth(),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (pduData) {
      setPdus(pduData);
    }
  }, [pduData, setPdus]);

  useEffect(() => {
    if (healthData) {
      setSystemHealth(healthData);
    }
  }, [healthData, setSystemHealth]);

  const handleRefresh = () => {
    refetchPdus();
  };

  const isLoading = pdusLoading || healthLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setAddPduDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add PDU
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <SystemHealthCard />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.isArray(pdus) && pdus.map((pdu) => (
              <PDUCard key={pdu.id} pdu={pdu} />
            ))}
          </div>

          <RecentEventsCard />
        </>
      )}

      <AddPDUDialog
        open={addPduDialogOpen}
        onOpenChange={setAddPduDialogOpen}
        onSuccess={() => {
          refetchPdus();
        }}
      />
    </div>
  );
}