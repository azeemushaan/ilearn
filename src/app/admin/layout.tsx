'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebaseAuth } from '@/firebase/provider';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Home,
  Users,
  CreditCard,
  Settings,
  Shield,
  LogOut,
  Package,
} from "lucide-react";
import Logo from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { auth } from '@/firebase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, claims, initializing, loadingClaims } = useFirebaseAuth();
  const redirected = useRef(false);

  // This boolean is the heart of the logic. It's only true when we have a definitive answer.
  const ready = !initializing && (user ? !loadingClaims : true);
  const isAdmin = !!(claims && claims.role === 'admin');

  useEffect(() => {
    // Wait until we are "ready" and haven't already redirected.
    if (!ready || redirected.current) {
        return;
    }

    // Case 1: No user is logged in.
    if (!user) {
      redirected.current = true;
      router.replace('/admin/login');
      return;
    }

    // Case 2: A user is logged in, but they are NOT an admin.
    if (user && !isAdmin) {
      redirected.current = true;
      router.replace('/login'); // Redirect non-admins to the standard user login/dashboard
      return;
    }

  }, [ready, user, isAdmin, router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/admin/login');
  };

  // If we are not ready, show the main loading screen.
  if (!ready) {
    return <div className="flex h-screen w-full items-center justify-center">Loading Admin Portal…</div>;
  }

  // If we are ready BUT the user is not an admin, we are about to redirect.
  // Render nothing to prevent a flash of the wrong content.
  if (!isAdmin) {
      return null;
  }
  
  // If we are ready and the user is an admin, show the dashboard.
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Logo />
            <SidebarTrigger className="ml-auto" />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/dashboard">
                  <Home />
                  <span>Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/users">
                  <Users />
                  <span>Users</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/subscriptions">
                  <Package />
                  <span>Plans</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/payments">
                  <CreditCard />
                  <span>Payments</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/admin/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || "https://picsum.photos/seed/admin/100/100"} alt="Admin avatar" />
              <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-foreground truncate">{user?.displayName || user?.email}</p>
              <p className="text-xs text-muted-foreground capitalize flex items-center gap-1"><Shield className="h-3 w-3 text-destructive" /> Admin</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={handleLogout}>
              <LogOut className="text-muted-foreground" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
