import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, TestTube, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import usePDUStore from '@/store/pduStore';
import { pduApi } from '@/api/pdu';

export function Settings() {
  const { pdus, pollingInterval, setPollingInterval, setPdus } = usePDUStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [newPdu, setNewPdu] = useState({
    name: '',
    ipAddress: '',
    model: '',
    snmpVersion: 'v3',
    snmpUser: 'apc',  // Default APC username
    snmpAuthProtocol: 'SHA',
    snmpAuthPassphrase: '',
    snmpPrivProtocol: 'AES',
    snmpPrivPassphrase: '',
    snmpSecurityLevel: 'noAuthNoPriv',  // Default to no auth/priv for APC
  });

  const handleAddPdu = async () => {
    if (!newPdu.name || !newPdu.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Name and IP Address are required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const createdPdu = await pduApi.createPDU(newPdu);
      
      // Refresh PDU list
      const updatedPdus = await pduApi.getPDUs();
      setPdus(updatedPdus);
      
      toast({
        title: 'Success',
        description: `PDU "${createdPdu.name}" added successfully`,
      });
      
      // Reset form
      setNewPdu({
        name: '',
        ipAddress: '',
        model: '',
        snmpVersion: 'v3',
        snmpUser: 'apc',
        snmpAuthProtocol: 'SHA',
        snmpAuthPassphrase: '',
        snmpPrivProtocol: 'AES',
        snmpPrivPassphrase: '',
        snmpSecurityLevel: 'noAuthNoPriv',
      });
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

  const handleTestConnection = async () => {
    if (!newPdu.ipAddress || !newPdu.snmpUser) {
      toast({
        title: 'Validation Error',
        description: 'IP Address and SNMP username are required for testing',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate based on security level
    const securityLevel = newPdu.snmpSecurityLevel || 'noAuthNoPriv';
    if ((securityLevel === 'authNoPriv' || securityLevel === 'authPriv') && !newPdu.snmpAuthPassphrase) {
      toast({
        title: 'Validation Error',
        description: 'Authentication passphrase is required for this security level',
        variant: 'destructive',
      });
      return;
    }
    if (securityLevel === 'authPriv' && !newPdu.snmpPrivPassphrase) {
      toast({
        title: 'Validation Error',
        description: 'Privacy passphrase is required for authPriv security level',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingConnection(true);
    try {
      // First create a temporary PDU to get an ID
      const tempName = newPdu.name || `Test-${Date.now()}`;
      const tempPdu = await pduApi.createPDU({ ...newPdu, name: tempName });
      
      // Test the connection
      const result = await pduApi.testPDUConnection(tempPdu.id);
      
      if (result.success) {
        toast({
          title: 'Connection Successful',
          description: result.message,
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.message,
          variant: 'destructive',
        });
        // Delete the temporary PDU if test failed
        await pduApi.deletePDU(tempPdu.id);
      }
      
      // Refresh PDU list
      const updatedPdus = await pduApi.getPDUs();
      setPdus(updatedPdus);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to test connection',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDeletePdu = async (id: string) => {
    try {
      await pduApi.deletePDU(id);
      
      // Refresh PDU list
      const updatedPdus = await pduApi.getPDUs();
      setPdus(updatedPdus);
      
      toast({
        title: 'Success',
        description: 'PDU deleted successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete PDU',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure PDUs and system settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add New PDU</CardTitle>
          <CardDescription>
            Configure a new APC PDU with SNMPv3 credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">PDU Name</Label>
              <Input
                id="name"
                value={newPdu.name}
                onChange={(e) => setNewPdu({ ...newPdu, name: e.target.value })}
                placeholder="PDU-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ip">IP Address</Label>
              <Input
                id="ip"
                value={newPdu.ipAddress}
                onChange={(e) => setNewPdu({ ...newPdu, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={newPdu.model}
                onChange={(e) => setNewPdu({ ...newPdu, model: e.target.value })}
                placeholder="AP7920B"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snmpUser">SNMP User</Label>
              <Input
                id="snmpUser"
                value={newPdu.snmpUser}
                onChange={(e) => setNewPdu({ ...newPdu, snmpUser: e.target.value })}
                placeholder="Default: apc"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="securityLevel">Security Level</Label>
              <Select
                value={newPdu.snmpSecurityLevel}
                onValueChange={(value) => setNewPdu({ ...newPdu, snmpSecurityLevel: value })}
              >
                <SelectTrigger id="securityLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="noAuthNoPriv">No Auth, No Privacy (Default)</SelectItem>
                  <SelectItem value="authNoPriv">Auth, No Privacy</SelectItem>
                  <SelectItem value="authPriv">Auth + Privacy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Only show auth fields if auth is required */}
            {(newPdu.snmpSecurityLevel === 'authNoPriv' || newPdu.snmpSecurityLevel === 'authPriv') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="authProtocol">Auth Protocol</Label>
                  <Select
                    value={newPdu.snmpAuthProtocol}
                    onValueChange={(value) => setNewPdu({ ...newPdu, snmpAuthProtocol: value })}
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
                    value={newPdu.snmpAuthPassphrase}
                    onChange={(e) => setNewPdu({ ...newPdu, snmpAuthPassphrase: e.target.value })}
                    placeholder="Authentication password"
                  />
                </div>
              </>
            )}
            
            {/* Only show privacy fields if privacy is required */}
            {newPdu.snmpSecurityLevel === 'authPriv' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="privProtocol">Privacy Protocol</Label>
                  <Select
                    value={newPdu.snmpPrivProtocol}
                    onValueChange={(value) => setNewPdu({ ...newPdu, snmpPrivProtocol: value })}
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
                    value={newPdu.snmpPrivPassphrase}
                    onChange={(e) => setNewPdu({ ...newPdu, snmpPrivPassphrase: e.target.value })}
                    placeholder="Privacy password"
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleAddPdu} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add PDU
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={isTestingConnection}>
              {isTestingConnection ? (
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured PDUs</CardTitle>
          <CardDescription>
            Manage existing PDU configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.isArray(pdus) && pdus.map((pdu) => (
              <div
                key={pdu.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium">{pdu.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {pdu.ipAddress} • {pdu.model}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={pdu.isActive ? 'success' : 'secondary'}>
                    {pdu.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDeletePdu(pdu.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>
            Configure system-wide settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="polling">Polling Interval (seconds)</Label>
              <div className="flex gap-2">
                <Input
                  id="polling"
                  type="number"
                  value={pollingInterval / 1000}
                  onChange={(e) => setPollingInterval(parseInt(e.target.value) * 1000)}
                  min={5}
                  max={300}
                />
                <Button variant="outline">Apply</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                How often to poll PDUs for status updates (5-300 seconds)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}