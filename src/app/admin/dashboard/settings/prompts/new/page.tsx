import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { createPromptTemplateAction } from '../actions';

export const dynamic = 'force-dynamic';

export default function NewPromptPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/dashboard/settings/prompts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Prompt Template</h1>
          <p className="text-muted-foreground">Create a new prompt template for AI generation</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Details</CardTitle>
          <CardDescription>Fill in the details for your new prompt template</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPromptTemplateAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Default MCQ Generation"
                required
              />
              <p className="text-sm text-muted-foreground">
                A descriptive name for this prompt template
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                placeholder="Optional description"
              />
              <p className="text-sm text-muted-foreground">
                An optional description of what this prompt does
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Prompt Content *</Label>
              <Textarea
                id="content"
                name="content"
                placeholder="Enter your prompt template here..."
                rows={12}
                required
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                The actual prompt text. You can use variables like {'{'}segmentText{'}'}, {'{'}context{'}'}, etc.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch id="active" name="active" defaultChecked />
              <Label htmlFor="active" className="cursor-pointer">
                Set as active template
              </Label>
            </div>

            <div className="flex gap-4">
              <Button type="submit">Create Prompt Template</Button>
              <Link href="/admin/dashboard/settings/prompts">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
