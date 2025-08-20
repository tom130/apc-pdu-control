import { useState } from 'react';
import { Loader2, TestTube } from 'lucide-react';
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
import type { SecurityLevel } from '@/types/pdu';

interface AddPDUDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddPDUDialog({ open, onOpenChange, onSuccess }: AddPDUDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    model: '',
    snmpVersion: 'v1', // Default to v1 for compatibility
    snmpUser: 'public', // Community string for v1/v2c, username for v3
    snmpSecurityLevel: 'noAuthNoPriv' as SecurityLevel,
    snmpAuthProtocol: 'SHA',
    snmpAuthPassphrase: '',
    snmpPrivProtocol: 'AES',
    snmpPrivPassphrase: '',
  });

  const handleTestConnection = async () => {
    if (!formData.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'IP Address is required to test connection',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    try {
      // Create temporary PDU for testing
      const testPdu = await pduApi.createPDU({
        ...formData,
        name: formData.name || `Test-${Date.now()}`,
        isActive: true,
      } as any);

      // Test the connection
      const result = await pduApi.testPDUConnection(testPdu.id);
      
      // Delete the test PDU
      await pduApi.deletePDU(testPdu.id);

      if (result.success) {
        toast({
          title: 'Connection Successful',
          description: 'SNMP connection test passed',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message || 'Could not connect to PDU',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Test Failed',
        description: error.response?.data?.message || 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Name and IP Address are required',
        variant: 'destructive',
      });
      return;
    }

    // Validate v3 security requirements
    if (formData.snmpVersion === 'v3') {
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
    }

    setIsLoading(true);
    try {
      const pduData: any = {
        name: formData.name,
        ipAddress: formData.ipAddress,
        model: formData.model,
        snmpVersion: formData.snmpVersion,
        snmpUser: formData.snmpUser, // Community string for v1/v2c, username for v3
        isActive: true,
      };

      // Only include v3 specific fields if using v3
      if (formData.snmpVersion === 'v3') {
        pduData.snmpSecurityLevel = formData.snmpSecurityLevel;
        pduData.snmpAuthProtocol = formData.snmpAuthProtocol;
        pduData.snmpPrivProtocol = formData.snmpPrivProtocol;
        
        if (formData.snmpAuthPassphrase) {
          pduData.snmpAuthPassphrase = formData.snmpAuthPassphrase;
        }
        if (formData.snmpPrivPassphrase) {
          pduData.snmpPrivPassphrase = formData.snmpPrivPassphrase;
        }
      }

      await pduApi.createPDU(pduData);
      
      toast({
        title: 'Success',
        description: `PDU "${formData.name}" added successfully`,
      });
      
      // Reset form
      setFormData({
        name: '',
        ipAddress: '',
        model: '',
        snmpVersion: 'v1',
        snmpUser: 'public',
        snmpSecurityLevel: 'noAuthNoPriv',
        snmpAuthProtocol: 'SHA',
        snmpAuthPassphrase: '',
        snmpPrivProtocol: 'AES',
        snmpPrivPassphrase: '',
      });
      
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to add PDU',
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
          <DialogTitle>Add New PDU</DialogTitle>
          <DialogDescription>
            Configure a new APC PDU for monitoring and control
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">PDU Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="PDU-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">IP Address *</Label>
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
              <Label htmlFor="snmpVersion">SNMP Version</Label>
              <Select
                value={formData.snmpVersion}
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    snmpVersion: value,
                    // Reset community/user based on version
                    snmpUser: value === 'v3' ? 'apc' : 'public'
                  });
                }}
              >
                <SelectTrigger id="snmpVersion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">SNMP v1</SelectItem>
                  <SelectItem value="v2c">SNMP v2c</SelectItem>
                  <SelectItem value="v3">SNMP v3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* For v1/v2c: Show community string */}
            {(formData.snmpVersion === 'v1' || formData.snmpVersion === 'v2c') && (
              <div className="space-y-2 col-span-2">
                <Label htmlFor="community">Community String</Label>
                <Input
                  id="community"
                  value={formData.snmpUser}
                  onChange={(e) => setFormData({ ...formData, snmpUser: e.target.value })}
                  placeholder="Default: public (read-only) or private (read-write)"
                />
                <p className="text-xs text-muted-foreground">
                  Most APC PDUs use 'public' for read access and 'private' for write access
                </p>
              </div>
            )}

            {/* For v3: Show username and security options */}
            {formData.snmpVersion === 'v3' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="snmpUser">SNMP Username</Label>
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
                        placeholder="Authentication passphrase"
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
                        placeholder="Privacy passphrase"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isLoading || isTesting}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add PDU'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}