import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PowerMetrics } from '@/types/pdu';
import { TrendingUp } from 'lucide-react';

interface PowerMetricsChartProps {
  metrics: PowerMetrics;
}

export function PowerMetricsChart({ metrics }: PowerMetricsChartProps) {
  // Power meter visualization for EU standards
  const maxPowerWatts = 3450; // 15A × 230V for typical PDU
  const powerWatts = metrics.totalPowerWatts || (metrics.totalPowerDraw * 230);
  const percentage = (powerWatts / maxPowerWatts) * 100;
  
  const getColor = () => {
    if (metrics.loadState === 'overload') return 'bg-red-500';
    if (metrics.loadState === 'near_overload') return 'bg-yellow-500';
    if (metrics.loadState === 'low') return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Power Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current Load</span>
              <span className="text-sm font-medium">
                {metrics.totalPowerDraw.toFixed(1)} A / {powerWatts} W
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${getColor()}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">0W</span>
              <span className="text-xs text-muted-foreground">{maxPowerWatts}W</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-secondary rounded">
              <div className="text-xs text-muted-foreground">Current</div>
              <div className="font-bold">{metrics.totalPowerDraw.toFixed(1)} A</div>
            </div>
            <div className="p-2 bg-secondary rounded">
              <div className="text-xs text-muted-foreground">Power</div>
              <div className="font-bold">{powerWatts} W</div>
            </div>
            <div className="p-2 bg-secondary rounded">
              <div className="text-xs text-muted-foreground">Voltage</div>
              <div className="font-bold">{metrics.voltage || 230} V</div>
            </div>
            <div className="p-2 bg-secondary rounded">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="font-bold capitalize">
                {metrics.loadState.replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}