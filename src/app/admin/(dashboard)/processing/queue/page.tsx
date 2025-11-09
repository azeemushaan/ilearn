'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Loader2, XCircle, ArrowUp, PlayCircle, PauseCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { StatusChip } from '@/components/video/status-chip';

export default function ProcessingQueuePage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [prioritizing, setPrioritizing] = useState<string | null>(null);

  // Query active batch jobs
  const activeJobsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'batch_jobs'),
      where('status', 'in', ['queued', 'running']),
      orderBy('createdAt', 'desc')
    );
  }, [firestore]);

  const { data: activeJobs, isLoading } = useCollection(activeJobsRef);

  // Query recent completed jobs
  const completedJobsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'batch_jobs'),
      where('status', 'in', ['completed', 'cancelled', 'failed']),
      orderBy('completedAt', 'desc')
    );
  }, [firestore]);

  const { data: completedJobs } = useCollection(completedJobsRef);

  const handleCancelJob = async (jobId: string, userId: string) => {
    setCancelling(jobId);
    
    try {
      const response = await fetch(`/api/batch/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast({
          title: 'Job Cancelled',
          description: 'Batch job cancelled successfully',
        });
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: error instanceof Error ? error.message : 'Failed to cancel job',
        variant: 'destructive',
      });
    } finally {
      setCancelling(null);
    }
  };

  const handlePrioritize = async (jobId: string, userId: string, delta: number = 10) => {
    setPrioritizing(jobId);
    
    try {
      const response = await fetch(`/api/batch/${jobId}/prioritize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, delta }),
      });

      if (response.ok) {
        toast({
          title: 'Job Prioritized',
          description: 'Job moved up in queue',
        });
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      toast({
        title: 'Prioritize Failed',
        description: error instanceof Error ? error.message : 'Failed to prioritize job',
        variant: 'destructive',
      });
    } finally {
      setPrioritizing(null);
    }
  };

  const getJobStatusBadge = (status: string) => {
    const config: Record<string, { label: string; variant: any; className: string }> = {
      queued: { label: 'Queued', variant: 'secondary', className: 'bg-gray-100' },
      running: { label: 'Running', variant: 'default', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Completed', variant: 'secondary', className: 'bg-green-100 text-green-800' },
      failed: { label: 'Failed', variant: 'destructive', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'Cancelled', variant: 'secondary', className: 'bg-gray-100' },
    };

    const cfg = config[status] || config.queued;
    
    return (
      <Badge variant={cfg.variant} className={cfg.className}>
        {cfg.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold">Processing Queue</h1>
        <p className="text-muted-foreground mt-1">
          Monitor and manage active video processing jobs
        </p>
      </div>

      {/* Active Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Active Jobs</CardTitle>
          <CardDescription>
            Currently running or queued batch processing jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!activeJobs || activeJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No active jobs
            </div>
          ) : (
            <div className="space-y-4">
              {activeJobs.map((job: any) => {
                const progress = job.progress || { total: 0, completed: 0, failed: 0, running: 0 };
                const progressPct = progress.total > 0 
                  ? ((progress.completed + progress.failed) / progress.total) * 100
                  : 0;

                return (
                  <div key={job.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Batch Job #{job.id.slice(0, 8)}</h3>
                          {getJobStatusBadge(job.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Type: {job.type} • {progress.total} videos
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Coach: {job.coachId} • Created: {job.createdAt?.toDate?.()?.toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        {job.status === 'queued' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrioritize(job.id, 'admin', 10)}
                            disabled={prioritizing === job.id}
                          >
                            {prioritizing === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowUp className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {(job.status === 'queued' || job.status === 'running') && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelJob(job.id, 'admin')}
                            disabled={cancelling === job.id}
                          >
                            {cancelling === job.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">
                          {progress.completed + progress.failed}/{progress.total}
                        </span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                      
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>✓ Completed: {progress.completed}</span>
                        <span>⏳ Running: {progress.running}</span>
                        <span>❌ Failed: {progress.failed}</span>
                      </div>
                    </div>

                    {job.reservedCredits > 0 && (
                      <div className="text-xs text-muted-foreground">
                        Credits: {job.consumedCredits}/{job.reservedCredits} used
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Completed Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Completed Jobs</CardTitle>
          <CardDescription>Last 10 completed or cancelled jobs</CardDescription>
        </CardHeader>
        <CardContent>
          {!completedJobs || completedJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No completed jobs yet
            </div>
          ) : (
            <div className="space-y-3">
              {completedJobs.slice(0, 10).map((job: any) => {
                const progress = job.progress || { total: 0, completed: 0, failed: 0 };

                return (
                  <div key={job.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">#{job.id.slice(0, 8)}</span>
                          {getJobStatusBadge(job.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {job.type} • {progress.total} videos • {progress.completed} succeeded, {progress.failed} failed
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {job.completedAt?.toDate?.()?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

