import { getSystemSettings } from '@/lib/firestore/admin-ops';
import { updateSettingsAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SettingsPage() {
  const settings = await getSystemSettings();
  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">System settings</h1>
        <p className="text-muted-foreground">Toggle platform-wide flags and support details.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Billing &amp; payments</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettingsAction} className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" name="manualPaymentsEnabled" defaultChecked={settings.manualPaymentsEnabled} id="manualPaymentsEnabled" />
              <label htmlFor="manualPaymentsEnabled" className="text-sm font-medium">Accept manual bank transfers</label>
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="supportEmail" className="text-sm font-medium">Support email</label>
              <Input id="supportEmail" name="supportEmail" defaultValue={settings.supportEmail} required />
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="logoUrl" className="text-sm font-medium">Brand logo URL</label>
              <Input id="logoUrl" name="logoUrl" defaultValue={settings.branding.logoUrl ?? ''} />
            </div>
            <Button type="submit">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
