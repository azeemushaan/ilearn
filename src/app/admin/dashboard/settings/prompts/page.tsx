import { listPromptTemplates } from '@/lib/firestore/admin-ops';
import {
  createPromptTemplateAction,
  deletePromptTemplateAction,
  updatePromptTemplateAction,
} from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default async function PromptSettingsPage() {
  const prompts = await listPromptTemplates();

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Prompt templates</h1>
        <p className="text-muted-foreground">
          Create reusable system prompts for quiz generation and choose which template is active.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create a prompt template</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createPromptTemplateAction} className="space-y-4">
            <div className="grid max-w-xl gap-2">
              <label htmlFor="prompt-name" className="text-sm font-medium">Name</label>
              <Input id="prompt-name" name="name" placeholder="Quiz prompt" required />
            </div>
            <div className="grid max-w-xl gap-2">
              <label htmlFor="prompt-description" className="text-sm font-medium">Description</label>
              <Input id="prompt-description" name="description" placeholder="Short summary (optional)" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="prompt-content" className="text-sm font-medium">Prompt content</label>
              <Textarea
                id="prompt-content"
                name="content"
                rows={10}
                placeholder="Use {{{videoTitle}}}, {{{chapterName}}}, {{{transcriptChunk}}}, etc."
                required
              />
              <p className="text-xs text-muted-foreground">
                Triple braces (e.g., {'{{{videoTitle}}}'} or {'{{{transcriptChunk}}}'}) insert request context when generating MCQs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input type="hidden" name="active" value="off" />
              <input id="prompt-active" type="checkbox" name="active" value="on" />
              <label htmlFor="prompt-active" className="text-sm font-medium">Mark as active after saving</label>
            </div>
            <Button type="submit">Create template</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {prompts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No prompt templates yet. Create one above to get started.
            </CardContent>
          </Card>
        ) : (
          prompts.map(prompt => (
            <Card key={prompt.id}>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{prompt.name}</CardTitle>
                  {prompt.description ? (
                    <p className="text-sm text-muted-foreground">{prompt.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 self-start">
                  <Badge variant="outline">v{prompt.version}</Badge>
                  {prompt.active ? <Badge variant="secondary">Active</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={updatePromptTemplateAction} className="space-y-4">
                  <input type="hidden" name="id" value={prompt.id} />
                  <div className="grid max-w-xl gap-2">
                    <label htmlFor={`prompt-${prompt.id}-name`} className="text-sm font-medium">Name</label>
                    <Input
                      id={`prompt-${prompt.id}-name`}
                      name="name"
                      defaultValue={prompt.name}
                      required
                    />
                  </div>
                  <div className="grid max-w-xl gap-2">
                    <label htmlFor={`prompt-${prompt.id}-description`} className="text-sm font-medium">Description</label>
                    <Input
                      id={`prompt-${prompt.id}-description`}
                      name="description"
                      defaultValue={prompt.description ?? ''}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor={`prompt-${prompt.id}-content`} className="text-sm font-medium">Prompt content</label>
                    <Textarea
                      id={`prompt-${prompt.id}-content`}
                      name="content"
                      rows={10}
                      defaultValue={prompt.content}
                      required
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input type="hidden" name="active" value="off" />
                      <input
                        id={`prompt-${prompt.id}-active`}
                        type="checkbox"
                        name="active"
                        value="on"
                        defaultChecked={prompt.active}
                      />
                      <label htmlFor={`prompt-${prompt.id}-active`} className="text-sm font-medium">
                        Active
                      </label>
                    </div>
                    <Button type="submit">Save changes</Button>
                  </div>
                </form>
                <form action={deletePromptTemplateAction} className="flex justify-end">
                  <input type="hidden" name="id" value={prompt.id} />
                  <Button type="submit" variant="destructive">
                    Delete template
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
