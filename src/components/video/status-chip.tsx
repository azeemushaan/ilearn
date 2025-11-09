import { Badge } from '@/components/ui/badge';
import { Circle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VideoStatus = 'not_ready' | 'processing' | 'ready' | 'failed';

interface StatusChipProps {
  status: VideoStatus;
  currentStep?: string;
  className?: string;
  showIcon?: boolean;
}

const statusConfig = {
  not_ready: {
    label: 'Not Ready',
    icon: Circle,
    variant: 'secondary' as const,
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    variant: 'secondary' as const,
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    iconClassName: 'animate-spin',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    variant: 'secondary' as const,
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-800 border-red-300',
  },
};

export function StatusChip({ status, currentStep, className, showIcon = true }: StatusChipProps) {
  const config = statusConfig[status] || statusConfig.not_ready; // Fallback to not_ready if status is invalid
  const Icon = config.icon;

  const displayLabel = status === 'processing' && currentStep
    ? `Processing: ${currentStep}`
    : config.label;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 font-medium',
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon className={cn('h-3.5 w-3.5', config.iconClassName)} />
      )}
      <span>{displayLabel}</span>
    </Badge>
  );
}

/**
 * Get human-readable step name
 */
export function getStepLabel(step: string): string {
  const stepLabels: Record<string, string> = {
    caption_fetch: 'Fetching Captions',
    segment: 'Segmenting',
    mcq_generate: 'Generating MCQs',
    manifest_build: 'Building Manifest',
  };

  return stepLabels[step] || step;
}

