import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { pduApi } from '@/api/pdu';
import type { PDU, SecurityLevel } from '@/types/pdu';

interface PDUConfigDialogProps {
  pdu: PDU;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PDUConfigDialog({ pdu, open, onOpenChange, onSuccess }: PDUConfigDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: pdu.name,
    ipAddress: pdu.ipAddress,
    model: pdu.model || '',
    snmpUser: pdu.snmpUser || 'apc',
    snmpSecurityLevel: (pdu.snmpSecurityLevel || 'noAuthNoPriv') as SecurityLevel,
    snmpAuthProtocol: pdu.snmpAuthProtocol || 'SHA',
    snmpAuthPassphrase: '',
    snmpPrivProtocol: pdu.snmpPrivProtocol || 'AES',
    snmpPrivPassphrase: '',
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Name and IP Address are required',
        variant: 'destructive',
      });
      return;
    }

    const securityLevel = formData.snmpSecurityLevel;
    if ((securityLevel === 'authNoPriv' || securityLevel === 'authPriv') && !formData.snmpAuthPassphrase) {
      toast({
        title: 'Validation Error',
        description: 'Authentication passphrase is required for this security level',
        variant: 'destructive',
      });
      return;
    }
    if (securityLevel === 'authPriv' && !formData.snmpPrivPassphrase) {
      toast({
        title: 'Validation Error',
        description: 'Privacy passphrase is required for this security level',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const updateData: any = {
        name: formData.name,
        ipAddress: formData.ipAddress,
        model: formData.model,
        snmpUser: formData.snmpUser,
        snmpSecurityLevel: formData.snmpSecurityLevel,
        snmpAuthProtocol: formData.snmpAuthProtocol,
        snmpPrivProtocol: formData.snmpPrivProtocol,
      };

      if (formData.snmpAuthPassphrase) {
        updateData.snmpAuthPassphrase = formData.snmpAuthPassphrase;
      }
      if (formData.snmpPrivPassphrase) {
        updateData.snmpPrivPassphrase = formData.snmpPrivPassphrase;
      }

      await pduApi.updatePDU(pdu.id, updateData);
      
      toast({
        title: 'Success',
        description: `PDU "${formData.name}" updated successfully`,
      });
      
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update PDU',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure PDU</DialogTitle>
          <DialogDescription>
            Update the configuration settings for {pdu.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">PDU Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="PDU-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">IP Address</Label>
              <Input
                id="ip"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="AP7920B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snmpUser">SNMP User</Label>
              <Input
                id="snmpUser"
                value={formData.snmpUser}
                onChange={(e) => setFormData({ ...formData, snmpUser: e.target.value })}
                placeholder="Default: apc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securityLevel">Security Level</Label>
              <Select
                value={formData.snmpSecurityLevel}
                onValueChange={(value) => setFormData({ ...formData, snmpSecurityLevel: value as SecurityLevel })}
              >
                <SelectTrigger id="securityLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noAuthNoPriv">No Auth, No Privacy</SelectItem>
                  <SelectItem value="authNoPriv">Auth, No Privacy</SelectItem>
                  <SelectItem value="authPriv">Auth + Privacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(formData.snmpSecurityLevel === 'authNoPriv' || formData.snmpSecurityLevel === 'authPriv') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="authProtocol">Auth Protocol</Label>
                  <Select
                    value={formData.snmpAuthProtocol}
                    onValueChange={(value) => setFormData({ ...formData, snmpAuthProtocol: value })}
                  >
                    <SelectTrigger id="authProtocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHA">SHA</SelectItem>
                      <SelectItem value="MD5">MD5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authPass">Auth Passphrase</Label>
                  <Input
                    id="authPass"
                    type="password"
                    value={formData.snmpAuthPassphrase}
                    onChange={(e) => setFormData({ ...formData, snmpAuthPassphrase: e.target.value })}
                    placeholder="Leave blank to keep existing"
                  />
                </div>
              </>
            )}
            
            {formData.snmpSecurityLevel === 'authPriv' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="privProtocol">Privacy Protocol</Label>
                  <Select
                    value={formData.snmpPrivProtocol}
                    onValueChange={(value) => setFormData({ ...formData, snmpPrivProtocol: value })}
                  >
                    <SelectTrigger id="privProtocol">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AES">AES</SelectItem>
                      <SelectItem value="DES">DES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="privPass">Privacy Passphrase</Label>
                  <Input
                    id="privPass"
                    type="password"
                    value={formData.snmpPrivPassphrase}
                    onChange={(e) => setFormData({ ...formData, snmpPrivPassphrase: e.target.value })}
                    placeholder="Leave blank to keep existing"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}