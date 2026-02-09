import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cron } from 'croner';
import { format } from 'date-fns';
import { Clock, Trash2, Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { pduApi } from '@/api/pdu';
import type { Outlet, OutletState } from '@/types/pdu';

interface OutletScheduleDialogProps {
  outlet: Outlet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OutletScheduleDialog({ outlet, open, onOpenChange }: OutletScheduleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cron form state
  const [cronName, setCronName] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [cronOperation, setCronOperation] = useState<OutletState>('off');

  // One-time form state
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [oneTimeOperation, setOneTimeOperation] = useState<OutletState>('off');

  // Fetch schedules
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['outlet-schedules', outlet.id],
    queryFn: () => pduApi.getOutletSchedules(outlet.id),
    enabled: open,
  });

  // Cron expression preview
  const cronPreview = useMemo(() => {
    if (!cronExpression.trim()) return null;
    try {
      const cron = new Cron(cronExpression);
      const runs = cron.nextRuns(3);
      return { valid: true, runs };
    } catch {
      return { valid: false, runs: [] };
    }
  }, [cronExpression]);

  // Mutations
  const createCron = useMutation({
    mutationFn: () => pduApi.createCronSchedule({
      outletId: outlet.id,
      name: cronName,
      cronExpression,
      operation: cronOperation,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet-schedules', outlet.id] });
      setCronName('');
      setCronExpression('');
      toast({ title: 'Schedule created', description: 'Recurring schedule added successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const updateCron = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { isActive?: boolean } }) =>
      pduApi.updateCronSchedule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet-schedules', outlet.id] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const deleteCron = useMutation({
    mutationFn: (id: string) => pduApi.deleteCronSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet-schedules', outlet.id] });
      toast({ title: 'Deleted', description: 'Recurring schedule removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const createOneTime = useMutation({
    mutationFn: () => pduApi.createOneTimeSchedule({
      outletId: outlet.id,
      operation: oneTimeOperation,
      scheduledTime: new Date(oneTimeDate).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet-schedules', outlet.id] });
      setOneTimeDate('');
      toast({ title: 'Schedule created', description: 'One-time schedule added successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const deleteOneTime = useMutation({
    mutationFn: (id: string) => pduApi.deleteOneTimeSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlet-schedules', outlet.id] });
      toast({ title: 'Deleted', description: 'One-time schedule removed.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const handleCreateCron = () => {
    if (!cronName.trim() || !cronExpression.trim()) return;
    if (!cronPreview?.valid) {
      toast({ title: 'Invalid expression', description: 'Please enter a valid cron expression.', variant: 'destructive' });
      return;
    }
    createCron.mutate();
  };

  const handleCreateOneTime = () => {
    if (!oneTimeDate) return;
    if (new Date(oneTimeDate) <= new Date()) {
      toast({ title: 'Invalid time', description: 'Scheduled time must be in the future.', variant: 'destructive' });
      return;
    }
    createOneTime.mutate();
  };

  const operationLabel = (op: string) => {
    switch (op) {
      case 'on': return 'Turn On';
      case 'off': return 'Turn Off';
      case 'reboot': return 'Reboot';
      default: return op;
    }
  };

  const operationColor = (op: string) => {
    switch (op) {
      case 'on': return 'text-green-500';
      case 'off': return 'text-red-500';
      case 'reboot': return 'text-yellow-500';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedules — {outlet.name || `Outlet #${outlet.outletNumber}`}
          </DialogTitle>
          <DialogDescription>
            Manage recurring and one-time scheduled operations for this outlet.
          </DialogDescription>
        </DialogHeader>

        <Tabs.Root defaultValue="recurring" className="w-full">
          <Tabs.List className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
            <Tabs.Trigger
              value="recurring"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1"
            >
              Recurring ({schedules?.cron.length ?? 0})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="one-time"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1"
            >
              One-Time ({schedules?.oneTime.length ?? 0})
            </Tabs.Trigger>
          </Tabs.List>

          {/* Recurring (CRON) Tab */}
          <Tabs.Content value="recurring" className="mt-4 space-y-4">
            {/* Create form */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="cron-name">Name</Label>
                <Input
                  id="cron-name"
                  placeholder="e.g. Nightly shutdown"
                  value={cronName}
                  onChange={(e) => setCronName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cron-expr">Cron Expression</Label>
                <Input
                  id="cron-expr"
                  placeholder="e.g. 0 22 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  className={cronExpression && !cronPreview?.valid ? 'border-red-500' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day-of-month month day-of-week
                </p>
                {cronPreview && cronExpression && (
                  <div className="text-xs">
                    {cronPreview.valid ? (
                      <div className="text-muted-foreground">
                        <span className="font-medium">Next runs:</span>
                        {cronPreview.runs.map((run, i) => (
                          <div key={i} className="ml-2">{format(run, 'PPpp')}</div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-red-500">Invalid cron expression</p>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Operation</Label>
                <Select value={cronOperation} onValueChange={(v) => setCronOperation(v as OutletState)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">Turn On</SelectItem>
                    <SelectItem value="off">Turn Off</SelectItem>
                    <SelectItem value="reboot">Reboot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleCreateCron}
                disabled={createCron.isPending || !cronName.trim() || !cronPreview?.valid}
                className="w-full"
              >
                {createCron.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add Recurring Schedule
              </Button>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : schedules?.cron.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recurring schedules</p>
            ) : (
              <div className="space-y-2">
                {schedules?.cron.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{schedule.name}</span>
                        <Badge variant="outline" className={`text-xs ${operationColor(schedule.operation)}`}>
                          {operationLabel(schedule.operation)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{schedule.cronExpression}</p>
                      {schedule.nextRunAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Next: {format(new Date(schedule.nextRunAt), 'PPpp')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={schedule.isActive}
                        onCheckedChange={(checked) =>
                          updateCron.mutate({ id: schedule.id, updates: { isActive: checked } })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteCron.mutate(schedule.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Content>

          {/* One-Time Tab */}
          <Tabs.Content value="one-time" className="mt-4 space-y-4">
            {/* Create form */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="onetime-date">Date & Time</Label>
                <Input
                  id="onetime-date"
                  type="datetime-local"
                  value={oneTimeDate}
                  onChange={(e) => setOneTimeDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Operation</Label>
                <Select value={oneTimeOperation} onValueChange={(v) => setOneTimeOperation(v as OutletState)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">Turn On</SelectItem>
                    <SelectItem value="off">Turn Off</SelectItem>
                    <SelectItem value="reboot">Reboot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleCreateOneTime}
                disabled={createOneTime.isPending || !oneTimeDate}
                className="w-full"
              >
                {createOneTime.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add One-Time Schedule
              </Button>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : schedules?.oneTime.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No one-time schedules</p>
            ) : (
              <div className="space-y-2">
                {schedules?.oneTime.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${operationColor(schedule.operation)}`}>
                          {operationLabel(schedule.operation)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Scheduled: {format(new Date(schedule.scheduledTime), 'PPpp')}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => deleteOneTime.mutate(schedule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Tabs.Content>
        </Tabs.Root>
      </DialogContent>
    </Dialog>
  );
}
