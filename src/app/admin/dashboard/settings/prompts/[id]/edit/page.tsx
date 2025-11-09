import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { updatePromptTemplateAction, deletePromptTemplateAction } from '../../actions';
import { adminFirestore } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

interface EditPromptPageProps {
  params: {
    id: string;
  };
}

interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string;
  active: boolean;
}

async function getPromptTemplate(id: string): Promise<PromptTemplate | null> {
  const db = adminFirestore();
  const doc = await db.collection('promptTemplates').doc(id).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  return {
    id: doc.id,
    name: data?.name || '',
    description: data?.description,
    content: data?.content || '',
    active: data?.active ?? false,
  };
}

export default async function EditPromptPage({ params }: EditPromptPageProps) {
  const prompt = await getPromptTemplate(params.id);
  
  if (!prompt) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/dashboard/settings/prompts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Prompt Template</h1>
          <p className="text-muted-foreground">Update your prompt template configuration</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt Details</CardTitle>
          <CardDescription>Modify the details of your prompt template</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePromptTemplateAction} className="space-y-6">
            <input type="hidden" name="id" value={prompt.id} />
            
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Default MCQ Generation"
                defaultValue={prompt.name}
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
                defaultValue={prompt.description || ''}
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
                defaultValue={prompt.content}
                required
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                The actual prompt text. You can use variables like {'{'}segmentText{'}'}, {'{'}context{'}'}, etc.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                id="active" 
                name="active" 
                defaultChecked={prompt.active ?? false} 
              />
              <Label htmlFor="active" className="cursor-pointer">
                Set as active template
              </Label>
            </div>

            <div className="flex justify-between">
              <div className="flex gap-4">
                <Button type="submit">Update Prompt Template</Button>
                <Link href="/admin/dashboard/settings/prompts">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
              
              <form action={deletePromptTemplateAction}>
                <input type="hidden" name="id" value={prompt.id} />
                <Button 
                  type="submit" 
                  variant="destructive"
                  onClick={(e) => {
                    if (!confirm('Are you sure you want to delete this prompt template? This action cannot be undone.')) {
                      e.preventDefault();
                    }
                  }}
                >
                  Delete Template
                </Button>
              </form>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
