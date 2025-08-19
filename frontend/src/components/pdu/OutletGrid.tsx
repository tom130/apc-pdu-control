import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Power, PowerOff, RotateCw, AlertTriangle, Shield } from 'lucide-react';
import { Outlet, OutletState } from '@/types/pdu';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { pduApi } from '@/api/pdu';
import usePDUStore from '@/store/pduStore';

interface OutletGridProps {
  pduId: string;
  outlets: Outlet[];
  columns?: number;
}

export function OutletGrid({ pduId, outlets, columns = 4 }: OutletGridProps) {
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set());
  const { updateOutlet } = usePDUStore();

  const powerMutation = useMutation({
    mutationFn: ({ outletId, state }: { outletId: string; state: OutletState }) =>
      pduApi.setOutletPower(pduId, outletId, state),
    onSuccess: (data, variables) => {
      updateOutlet(pduId, variables.outletId, { actualState: data.newState });
    },
  });

  const handleOutletToggle = (outlet: Outlet) => {
    const newState: OutletState = outlet.actualState === 'on' ? 'off' : 'on';
    powerMutation.mutate({ outletId: outlet.id, state: newState });
  };

  const handleOutletReboot = (outlet: Outlet) => {
    powerMutation.mutate({ outletId: outlet.id, state: 'reboot' });
  };

  const handleBulkOperation = (operation: OutletState) => {
    selectedOutlets.forEach((outletId) => {
      powerMutation.mutate({ outletId, state: operation });
    });
    setSelectedOutlets(new Set());
  };

  const toggleOutletSelection = (outletId: string) => {
    const newSelection = new Set(selectedOutlets);
    if (newSelection.has(outletId)) {
      newSelection.delete(outletId);
    } else {
      newSelection.add(outletId);
    }
    setSelectedOutlets(newSelection);
  };

  const sortedOutlets = [...outlets].sort((a, b) => a.outletNumber - b.outletNumber);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Outlet Control</CardTitle>
          {selectedOutlets.size > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedOutlets.size} selected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkOperation('on')}
              >
                <Power className="h-4 w-4" />
                All On
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkOperation('off')}
              >
                <PowerOff className="h-4 w-4" />
                All Off
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkOperation('reboot')}
              >
                <RotateCw className="h-4 w-4" />
                Reboot All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {sortedOutlets.map((outlet) => (
            <OutletCard
              key={outlet.id}
              outlet={outlet}
              isSelected={selectedOutlets.has(outlet.id)}
              onToggle={() => handleOutletToggle(outlet)}
              onReboot={() => handleOutletReboot(outlet)}
              onSelect={() => toggleOutletSelection(outlet.id)}
              isLoading={powerMutation.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface OutletCardProps {
  outlet: Outlet;
  isSelected: boolean;
  onToggle: () => void;
  onReboot: () => void;
  onSelect: () => void;
  isLoading: boolean;
}

function OutletCard({
  outlet,
  isSelected,
  onToggle,
  onReboot,
  onSelect,
  isLoading,
}: OutletCardProps) {
  const isOn = outlet.actualState === 'on';
  const hasSkew = outlet.desiredState && outlet.desiredState !== outlet.actualState;

  return (
    <div
      className={cn(
        'relative p-3 border rounded-lg transition-all',
        isSelected && 'ring-2 ring-primary',
        hasSkew && 'border-yellow-500',
        outlet.isCritical && 'border-red-500'
      )}
    >
      <div className="absolute top-2 right-2 flex gap-1">
        {outlet.isCritical && (
          <Shield className="h-4 w-4 text-red-500" />
        )}
        {hasSkew && (
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium">#{outlet.outletNumber}</span>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="h-4 w-4"
          />
        </div>

        <div className="text-sm text-muted-foreground truncate">
          {outlet.name || `Outlet ${outlet.outletNumber}`}
        </div>

        <div className="flex items-center justify-between">
          <Switch
            checked={isOn}
            onCheckedChange={onToggle}
            disabled={isLoading || outlet.isCritical}
            className="data-[state=checked]:bg-green-500"
          />
          <div className="flex items-center gap-1">
            <Badge
              variant={isOn ? 'success' : 'secondary'}
              className="text-xs"
            >
              {isOn ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onReboot}
          disabled={isLoading || outlet.isCritical}
        >
          <RotateCw className="h-3 w-3 mr-1" />
          Reboot
        </Button>

        {outlet.desiredState && (
          <div className="text-xs text-center text-muted-foreground">
            Desired: {outlet.desiredState.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}