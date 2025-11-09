import { getSystemAiSettings, getSystemSettings, listPromptTemplates } from '@/lib/firestore/admin-ops';
export const dynamic = 'force-dynamic';
import { updateSettingsAction, updateAiSettingsAction } from './actions';
import { AiTestConnectionForm } from './ai-test-connection-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorPickerInput } from '@/components/admin/color-picker-input';
import Link from 'next/link';

export default async function SettingsPage({ searchParams }: { searchParams?: { saved?: string } | Promise<{ saved?: string }> }) {
  const awaited = searchParams && typeof (searchParams as any).then === 'function'
    ? await (searchParams as Promise<{ saved?: string }>)
    : (searchParams as { saved?: string } | undefined);
  const [settings, aiSettings, promptTemplates] = await Promise.all([
    getSystemSettings(),
    getSystemAiSettings(),
    listPromptTemplates(),
  ]);

  const providerOptions = [
    { value: 'google', label: 'Google AI Studio' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'openrouter', label: 'OpenRouter' },
  ];
  return (
    <div className="space-y-6 p-6">
      {awaited?.saved && (
        <div className="rounded-md border border-green-200 bg-green-50 text-green-800 px-4 py-2">
          Successfully saved {awaited.saved === 'ai' ? 'AI settings' : 'settings'}
        </div>
      )}
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
              <Input id="logoUrl" name="logoUrl" defaultValue={settings.branding.logoUrl ?? ''} placeholder="https://example.com/logo.png" />
              <p className="text-xs text-muted-foreground">Or upload a file below</p>
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="logoFile" className="text-sm font-medium">Upload logo file</label>
              <Input id="logoFile" name="logoFile" type="file" accept="image/*" />
              {settings.branding.logoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Current logo:</p>
                  <img src={settings.branding.logoUrl} alt="Current logo" className="h-16 w-auto border rounded" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <ColorPickerInput
                id="primaryColor"
                name="primaryColor"
                label="Primary color"
                defaultValue={settings.branding.primaryColor || '#3b82f6'}
                placeholder="#3b82f6"
              />
              <ColorPickerInput
                id="secondaryColor"
                name="secondaryColor"
                label="Secondary color"
                defaultValue={settings.branding.secondaryColor || '#10b981'}
                placeholder="#10b981"
              />
            </div>
            <Button type="submit">Save settings</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>AI configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose the AI provider and system prompt template used for quiz generation.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={updateAiSettingsAction} className="space-y-4">
            <div className="grid max-w-md gap-2">
              <label htmlFor="provider" className="text-sm font-medium">AI provider</label>
              <select
                id="provider"
                name="provider"
                defaultValue={aiSettings.provider}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {providerOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Select the backend used to generate MCQs.</p>
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="model" className="text-sm font-medium">Model</label>
              <Input
                id="model"
                name="model"
                defaultValue={aiSettings.model}
                placeholder="e.g. googleai/gemini-2.5-flash"
                required
              />
              <p className="text-xs text-muted-foreground">Provide the fully-qualified model identifier.</p>
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="apiKey" className="text-sm font-medium">API key</label>
              <Input
                id="apiKey"
                name="apiKey"
                type="password"
                placeholder="Enter a new key to replace the stored value"
              />
              <p className="text-xs text-muted-foreground">
                {aiSettings.hasApiKey
                  ? `Stored key: ${aiSettings.apiKeyMask ?? '••••'}. Leave blank to keep the current key.`
                  : 'No API key on file. Submit a key to enable external providers.'}
              </p>
            </div>
            <div className="grid max-w-md gap-2">
              <label htmlFor="activePromptId" className="text-sm font-medium">Active system prompt</label>
              <select
                id="activePromptId"
                name="activePromptId"
                defaultValue={aiSettings.activePromptId ?? ''}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Use default prompt</option>
                {promptTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {`${template.name} (v${template.version}${template.active ? ', active' : ''})`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Manage templates in the{' '}
                <Link href="/admin/dashboard/settings/prompts" className="underline">
                  prompt library
                </Link>
                .
              </p>
            </div>
            <Button type="submit">Save AI settings</Button>
          </form>
          <div className="border-t pt-4">
            <AiTestConnectionForm disabled={!aiSettings.hasApiKey} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
