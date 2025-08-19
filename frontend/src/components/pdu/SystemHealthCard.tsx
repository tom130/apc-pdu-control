import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Server, Zap, AlertTriangle } from 'lucide-react';
import usePDUStore from '@/store/pduStore';

export function SystemHealthCard() {
  const { systemHealth } = usePDUStore();
  
  if (!systemHealth) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Loading system health information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const healthStatus = systemHealth.stateSkewPercentage < 5 ? 'excellent' : 
                       systemHealth.stateSkewPercentage < 10 ? 'good' : 
                       systemHealth.stateSkewPercentage < 20 ? 'warning' : 'critical';

  const statusColor = {
    excellent: 'success',
    good: 'secondary',
    warning: 'warning',
    critical: 'destructive',
  } as const;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Overall system status and metrics</CardDescription>
          </div>
          <Badge variant={statusColor[healthStatus]} className="uppercase">
            {healthStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Total PDUs</p>
              <p className="text-2xl font-bold">{systemHealth.totalPdus}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Active PDUs</p>
              <p className="text-2xl font-bold">{systemHealth.activePdus}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Total Outlets</p>
              <p className="text-2xl font-bold">{systemHealth.totalOutlets}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              systemHealth.stateSkewPercentage > 10 ? 'bg-yellow-500/10' : 'bg-green-500/10'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                systemHealth.stateSkewPercentage > 10 ? 'text-yellow-500' : 'text-green-500'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium">State Skew</p>
              <p className="text-2xl font-bold">{systemHealth.stateSkewPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Average Response Time</span>
            <Badge variant={systemHealth.averageResponseTime < 100 ? 'success' : 'warning'}>
              {systemHealth.averageResponseTime.toFixed(0)}ms
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}