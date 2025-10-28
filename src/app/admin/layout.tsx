
'use client';
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
import { useAuth, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { IdTokenResult } from "firebase/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user, isLoading: isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [claims, setClaims] = useState<IdTokenResult['claims'] | null>(null);
  const [isLoadingClaims, setIsLoadingClaims] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      return; // Wait until user object is resolved
    }

    if (!user) {
      router.push("/admin/login");
      return;
    }

    user.getIdTokenResult(true) // Force refresh to get latest claims
      .then((idTokenResult) => {
        setClaims(idTokenResult.claims);
        if (idTokenResult.claims.role !== 'admin') {
          toast({
            variant: 'destructive',
            title: 'Access Denied',
            description: 'You do not have permission to view this page.'
          });
          // Sign out and redirect to a non-admin login to prevent loops
          auth?.signOut();
          router.push('/login');
        }
      })
      .catch((error) => {
        console.error("Error getting user claims:", error);
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: 'Could not verify your permissions.'
        });
        auth?.signOut();
        router.push('/login');
      })
      .finally(() => {
        setIsLoadingClaims(false);
      });

  }, [user, isUserLoading, router, toast, auth]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
    }
    router.push('/admin/login');
  };

  // Show loading screen while user is loading or claims are being verified
  if (isUserLoading || isLoadingClaims || !claims) {
    return <div className="flex h-screen w-full items-center justify-center">Loading Admin Portal...</div>;
  }
  
  // If claims are loaded but user is not an admin, show access denied.
  // This state should ideally be brief due to the redirect in useEffect.
  if (claims.role !== 'admin') {
      return <div className="flex h-screen w-full items-center justify-center">Access Denied. Redirecting...</div>;
  }


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
