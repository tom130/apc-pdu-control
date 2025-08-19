import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Power, 
  PowerOff, 
  RotateCw, 
  Search,
  GripVertical,
  RotateCcw,
  Save,
  X
} from 'lucide-react';
import { Outlet, OutletState } from '@/types/pdu';
import { useMutation } from '@tanstack/react-query';
import { pduApi } from '@/api/pdu';
import usePDUStore from '@/store/pduStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableOutletCard } from './SortableOutletCard';

interface OutletGridProps {
  pduId: string;
  outlets: Outlet[];
  columns?: number;
}

export function OutletGrid({ pduId, outlets }: OutletGridProps) {
  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [sortedOutlets, setSortedOutlets] = useState(outlets);
  const { updateOutlet, reorderOutlets } = usePDUStore();
  
  // Update sortedOutlets when outlets prop changes
  useEffect(() => {
    setSortedOutlets(outlets);
  }, [outlets]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const powerMutation = useMutation({
    mutationFn: ({ outletId, state }: { outletId: string; state: OutletState }) =>
      pduApi.setOutletPower(pduId, outletId, state),
    onSuccess: (data, variables) => {
      updateOutlet(pduId, variables.outletId, { actualState: data.newState });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (outletIds: string[]) => pduApi.reorderOutlets(pduId, outletIds),
    onSuccess: (data) => {
      reorderOutlets(pduId, data);
      setSortedOutlets(data);
      setHasChanges(false);
    },
  });

  const resetOrderMutation = useMutation({
    mutationFn: () => pduApi.resetOutletOrder(pduId),
    onSuccess: (data) => {
      reorderOutlets(pduId, data);
      setSortedOutlets(data);
      setHasChanges(false);
      setIsReorganizing(false);
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setSortedOutlets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        return newOrder;
      });
    }
  };

  const saveOrder = () => {
    const outletIds = sortedOutlets.map(o => o.id);
    reorderMutation.mutate(outletIds);
  };

  const cancelReorganize = () => {
    setSortedOutlets(outlets);
    setHasChanges(false);
    setIsReorganizing(false);
  };

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
            {isReorganizing ? (
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <Badge variant="outline" className="text-amber-600 border-amber-600">
                    Unsaved changes
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="default"
                  onClick={saveOrder}
                  disabled={!hasChanges || reorderMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Order
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => resetOrderMutation.mutate()}
                  disabled={resetOrderMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset to Default
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelReorganize}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            ) : selectedOutlets.size > 0 ? (
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
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsReorganizing(true)}
              >
                <GripVertical className="h-4 w-4 mr-1" />
                Reorganize
              </Button>
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
            {!isReorganizing && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllSelection}
              >
                {selectedOutlets.size === filteredOutlets.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredOutlets.map(o => o.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredOutlets.map((outlet) => (
                <SortableOutletCard
                  key={outlet.id}
                  outlet={outlet}
                  isSelected={selectedOutlets.has(outlet.id)}
                  onToggle={() => handleOutletToggle(outlet)}
                  onReboot={() => handleOutletReboot(outlet)}
                  onSelect={() => toggleOutletSelection(outlet.id)}
                  isLoading={powerMutation.isPending}
                  isReorganizing={isReorganizing}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <div className="opacity-80">
                <SortableOutletCard
                  outlet={sortedOutlets.find(o => o.id === activeId)!}
                  isSelected={false}
                  onToggle={() => {}}
                  onReboot={() => {}}
                  onSelect={() => {}}
                  isLoading={false}
                  isReorganizing={true}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}