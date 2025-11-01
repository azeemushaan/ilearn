'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Home, Users, CreditCard, Package, FileText, ShieldCheck, Settings, ScrollText, Building } from 'lucide-react';
import Logo from '@/components/logo';
import { auth } from '@/firebase/client';
import { useFirebaseAuth } from '@/firebase/provider';
import { cn } from '@/lib/utils';
import { useImpersonation } from '@/hooks/use-impersonation';

const NAVIGATION = [
  { href: '/admin/dashboard', label: 'Overview', icon: Home },
  { href: '/admin/dashboard/coaches', label: 'Coaches', icon: Building },
  { href: '/admin/dashboard/plans', label: 'Plans', icon: Package },
  { href: '/admin/dashboard/subscriptions', label: 'Subscriptions', icon: ShieldCheck },
  { href: '/admin/dashboard/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/dashboard/users', label: 'Students', icon: Users },
  { href: '/admin/dashboard/audit', label: 'Audit', icon: ScrollText },
  { href: '/admin/dashboard/settings', label: 'Settings', icon: Settings },
];

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const { user, claims, initializing } = useFirebaseAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [impersonation] = useImpersonation();

  useEffect(() => {
    if (!initializing && (!user || claims?.role !== 'admin')) {
      router.replace('/admin/login');
    }
  }, [initializing, user, claims, router]);

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/admin/login');
  };

  const activePath = pathname;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2">
              <Logo />
              <SidebarTrigger className="ml-auto" />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {NAVIGATION.map((item) => {
                const Icon = item.icon;
                const isActive = activePath === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href} className={cn('flex items-center gap-2', isActive && 'font-semibold')}>
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user?.photoURL ?? undefined} alt={user?.displayName ?? user?.email ?? 'Admin'} />
                <AvatarFallback>{user?.email?.[0]?.toUpperCase() ?? 'A'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col text-sm">
                <span className="font-semibold leading-tight">{user?.displayName ?? user?.email}</span>
                <span className="text-xs text-muted-foreground uppercase">Admin</span>
              </div>
              <Button size="icon" variant="ghost" onClick={handleSignOut}>
                ⎋
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <main className="flex-1 bg-background">
            {impersonation.coachId && (
              <div className="bg-amber-100 text-amber-900 px-6 py-3 text-sm flex items-center justify-between">
                <span>
                  Impersonating coach <strong>{impersonation.coachId}</strong>. Actions are read-only until you exit.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    sessionStorage.removeItem('ilearn_impersonation');
                    window.location.reload();
                  }}
                >
                  Exit impersonation
                </Button>
              </div>
            )}
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
