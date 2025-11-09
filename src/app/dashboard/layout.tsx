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
  PlaySquare,
  Users,
  BarChart3,
  HelpCircle,
  LogOut,
  CreditCard,
  Video,
  Youtube,
  ClipboardList,
} from "lucide-react";
import Logo from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase, useFirebaseAuth } from "@/firebase";
import { doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const { user } = useUser();
  const { claims } = useFirebaseAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (user) {
      setIsCheckingAuth(false);
    } else {
      const timer = setTimeout(() => {
        if (!user) {
          console.log('[Dashboard Layout] No user found after timeout, redirecting to login');
          router.push("/login");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, router]);

  useEffect(() => {
    if (userData) {
      setUserRole((userData as any).role);
    }
  }, [userData]);

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
    }
    window.location.href = '/login';
  };

  if (isCheckingAuth || !user) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (isUserDataLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
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
                  <Link href="/dashboard">
                    <Home />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            
            {/* Coach-only menu items */}
            {claims?.role === 'coach' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/playlists">
                      <PlaySquare />
                      <span>Playlists</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/youtube">
                      <Youtube />
                      <span>YouTube Connection</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/manage-students">
                      <Users />
                      <span>Students</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/analytics">
                      <BarChart3 />
                      <span>Analytics</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/subscription">
                      <CreditCard />
                      <span>Subscription</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/coach/assignments">
                      <ClipboardList />
                      <span>Assignments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}

            {/* Student-only menu items */}
            {claims?.role === 'student' && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href="/dashboard/my-assignments">
                      <Video />
                      <span>My Assignments</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="#">
                  <HelpCircle />
                  <span>Support</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary">
             <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || "https://picsum.photos/seed/user/100/100"} alt="User avatar" />
              <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold text-foreground truncate">{user?.displayName || user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
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
