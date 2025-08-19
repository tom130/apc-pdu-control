import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Outlet } from '@/types/pdu';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Power,
  RotateCw,
  AlertTriangle,
  Shield,
  Zap,
  CheckCircle2,
  Circle,
  GripVertical
} from 'lucide-react';

interface SortableOutletCardProps {
  outlet: Outlet;
  isSelected: boolean;
  onToggle: () => void;
  onReboot: () => void;
  onSelect: () => void;
  isLoading: boolean;
  isReorganizing: boolean;
}

export function SortableOutletCard({
  outlet,
  isSelected,
  onToggle,
  onReboot,
  onSelect,
  isLoading,
  isReorganizing,
}: SortableOutletCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: outlet.id,
    disabled: !isReorganizing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOn = outlet.actualState === 'on';
  const hasSkew = outlet.desiredState && outlet.desiredState !== outlet.actualState;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg transition-all duration-300",
        "bg-gradient-to-br from-card to-card/50",
        "border",
        isSelected ? "border-primary shadow-md shadow-primary/20" : "border-border",
        hasSkew && "border-amber-500 dark:border-amber-400",
        outlet.isCritical && "border-red-500 dark:border-red-400",
        "hover:shadow-lg hover:scale-[1.01] hover:border-primary/50",
        isDragging && "opacity-50 z-50 shadow-2xl"
      )}
    >
      {/* Background gradient based on state */}
      <div className={cn(
        "absolute inset-0 opacity-10 transition-opacity duration-300",
        isOn && "bg-gradient-to-br from-green-500 to-emerald-500 opacity-20",
        !isOn && "bg-gradient-to-br from-gray-500 to-slate-500"
      )} />
      
      {/* Drag handle */}
      {isReorganizing && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-20 cursor-move touch-none"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </div>
      )}
      
      {/* Selection checkbox */}
      {!isReorganizing && (
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
      )}

      {/* Status badges */}
      <div className={cn(
        "absolute top-2 z-10 flex gap-1",
        isReorganizing ? "left-8" : "left-2"
      )}>
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
            disabled={isLoading || outlet.isCritical || isReorganizing}
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
        {!isReorganizing && (
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
        )}

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