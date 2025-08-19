import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OutletGrid } from '@/components/pdu/OutletGrid';
import { PowerMetricsChart } from '@/components/pdu/PowerMetricsChart';
import { PDUInfo } from '@/components/pdu/PDUInfo';
import { pduApi } from '@/api/pdu';
import usePDUStore from '@/store/pduStore';

export function PDUDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getPduById, setOutlets, outlets } = usePDUStore();
  
  const pdu = id ? getPduById(id) : undefined;
  const pduOutlets = id ? outlets[id] || [] : [];

  const { data: outletsData, refetch: refetchOutlets } = useQuery({
    queryKey: ['outlets', id],
    queryFn: () => id ? pduApi.getOutlets(id) : Promise.resolve([]),
    enabled: !!id,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const { data: metricsData } = useQuery({
    queryKey: ['metrics', id],
    queryFn: () => id ? pduApi.getCurrentPowerMetrics(id) : Promise.resolve(null),
    enabled: !!id,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (outletsData && id) {
      setOutlets(id, outletsData);
    }
  }, [outletsData, id, setOutlets]);

  if (!pdu || !id) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">PDU Not Found</h2>
          <Button onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleReconcile = async () => {
    await pduApi.reconcilePDUState(id);
    refetchOutlets();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{pdu.name}</h2>
            <p className="text-muted-foreground">{pdu.ipAddress}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReconcile}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconcile State
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <OutletGrid pduId={id} outlets={pduOutlets} />
        </div>
        <div className="space-y-6">
          <PDUInfo pdu={pdu} metrics={metricsData} />
          {metricsData && <PowerMetricsChart metrics={metricsData} />}
        </div>
      </div>
    </div>
  );
}