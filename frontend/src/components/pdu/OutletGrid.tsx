import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Power, 
  PowerOff, 
  RotateCw, 
  AlertTriangle, 
  Shield, 
  Zap,
  Search,
  CheckCircle2,
  Circle
} from 'lucide-react';
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

export function OutletGrid({ pduId, outlets }: OutletGridProps) {
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
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

  const toggleAllSelection = () => {
    if (selectedOutlets.size === filteredOutlets.length) {
      setSelectedOutlets(new Set());
    } else {
      setSelectedOutlets(new Set(filteredOutlets.map(o => o.id)));
    }
  };

  const sortedOutlets = [...outlets].sort((a, b) => a.outletNumber - b.outletNumber);
  const filteredOutlets = sortedOutlets.filter(outlet => 
    outlet.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    outlet.outletNumber.toString().includes(searchTerm)
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-card to-muted/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Outlet Control</CardTitle>
            {selectedOutlets.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-semibold">
                  {selectedOutlets.size} selected
                </Badge>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleBulkOperation('on')}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                >
                  <Power className="h-4 w-4 mr-1" />
                  All On
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBulkOperation('off')}
                >
                  <PowerOff className="h-4 w-4 mr-1" />
                  All Off
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkOperation('reboot')}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Reboot
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search outlets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAllSelection}
            >
              {selectedOutlets.size === filteredOutlets.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredOutlets.map((outlet) => (
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
        "group relative overflow-hidden rounded-lg transition-all duration-300",
        "bg-gradient-to-br from-card to-card/50",
        "border",
        isSelected ? "border-primary shadow-md shadow-primary/20" : "border-border",
        hasSkew && "border-amber-500 dark:border-amber-400",
        outlet.isCritical && "border-red-500 dark:border-red-400",
        "hover:shadow-lg hover:scale-[1.01] hover:border-primary/50"
      )}
    >
      {/* Background gradient based on state */}
      <div className={cn(
        "absolute inset-0 opacity-10 transition-opacity duration-300",
        isOn && "bg-gradient-to-br from-green-500 to-emerald-500 opacity-20",
        !isOn && "bg-gradient-to-br from-gray-500 to-slate-500"
      )} />
      
      {/* Selection checkbox */}
      <button
        onClick={onSelect}
        className="absolute top-2 right-2 z-10 transition-colors"
      >
        {isSelected ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
        )}
      </button>

      {/* Status badges */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        {outlet.isCritical && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0">
            <Shield className="h-2.5 w-2.5" />
          </Badge>
        )}
        {hasSkew && (
          <Badge variant="warning" className="text-xs px-1.5 py-0">
            <AlertTriangle className="h-2.5 w-2.5" />
          </Badge>
        )}
      </div>

      <div className="relative p-3 space-y-2">
        {/* Outlet name and number */}
        <div className="text-center pt-3">
          <div className="text-sm font-bold text-foreground/90 truncate">
            {outlet.name || `Outlet ${outlet.outletNumber}`}
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            #{outlet.outletNumber}
          </div>
        </div>

        {/* Power button */}
        <div className="flex justify-center">
          <button
            onClick={onToggle}
            disabled={isLoading || outlet.isCritical}
            className={cn(
              "relative group/btn w-14 h-14 rounded-full transition-all duration-300",
              "border-2 flex items-center justify-center",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              isOn ? [
                "bg-gradient-to-br from-green-500 to-emerald-500",
                "border-green-400 dark:border-green-600",
                "hover:from-green-600 hover:to-emerald-600",
                "shadow-md shadow-green-500/30"
              ] : [
                "bg-gradient-to-br from-gray-500 to-slate-600",
                "border-gray-400 dark:border-gray-600",
                "hover:from-gray-600 hover:to-slate-700",
                "shadow-md shadow-gray-500/20"
              ]
            )}
          >
            <div className={cn(
              "transition-all duration-300",
              "group-hover/btn:scale-110"
            )}>
              {isOn ? (
                <Zap className="h-6 w-6 text-white fill-white" />
              ) : (
                <Power className="h-6 w-6 text-white" />
              )}
            </div>
            
            {/* Pulsing ring for ON state */}
            {isOn && (
              <div className="absolute inset-0 rounded-full animate-pulse-ring">
                <div className="absolute inset-0 rounded-full bg-green-400 opacity-20 animate-ping" />
              </div>
            )}
          </button>
        </div>

        {/* Status text */}
        <div className="text-center">
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
            "text-xs font-semibold transition-colors",
            isOn ? [
              "bg-green-100 text-green-800",
              "dark:bg-green-900/30 dark:text-green-400"
            ] : [
              "bg-gray-100 text-gray-800",
              "dark:bg-gray-900/30 dark:text-gray-400"
            ]
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOn ? "bg-green-500 animate-pulse" : "bg-gray-500"
            )} />
            {isOn ? 'ON' : 'OFF'}
          </div>
        </div>

        {/* Reboot button */}
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs py-1 h-7 group/reboot"
          onClick={onReboot}
          disabled={isLoading || outlet.isCritical}
        >
          <RotateCw className="h-3 w-3 mr-1 transition-transform group-hover/reboot:rotate-180 duration-500" />
          Reboot
        </Button>

        {/* Desired state indicator */}
        {outlet.desiredState && outlet.desiredState !== outlet.actualState && (
          <div className="text-center">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Target: {outlet.desiredState.toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}