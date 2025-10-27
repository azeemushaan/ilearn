import { BookOpen, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <BookOpen className="h-5 w-5" />
        <PlayCircle className="absolute -bottom-1 -right-1 h-4 w-4 fill-accent text-background" />
      </div>
      <span className="font-headline text-xl font-bold text-primary">iLearn</span>
    </div>
  );
};

export default Logo;
