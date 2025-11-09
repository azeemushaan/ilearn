import { listPromptTemplates } from '@/lib/firestore/admin-ops';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PromptsPage() {
  const promptTemplates = await listPromptTemplates();

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold">Prompt Library</h1>
          <p className="text-muted-foreground">Manage AI prompt templates for quiz generation</p>
        </div>
        <Link href="/admin/dashboard/settings/prompts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
        </Link>
      </header>

      <div className="grid gap-4">
        {promptTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No custom prompts yet</p>
              <Link href="/admin/dashboard/settings/prompts/new">
                <Button>Create your first prompt</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          promptTemplates.map(template => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {template.name}
                      {template.active && (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      )}
                    </CardTitle>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">{template.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/dashboard/settings/prompts/${template.id}/edit`}>
                      <Button variant="outline" size="sm">Edit</Button>
                    </Link>
                    <Link href={`/admin/dashboard/settings/prompts/${template.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p className="line-clamp-2">{template.content}</p>
                </div>
                {template.createdAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Back to Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/admin/dashboard/settings">
            <Button variant="outline">← Return to System Settings</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
