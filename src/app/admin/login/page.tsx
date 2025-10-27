
'use client';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/logo";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("ilearn@er21.org");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSuccess = async (user: User) => {
    if (!auth) return;
    console.log(`Verifying admin access for user: ${user.email}`);

    // Force a token refresh to get the latest custom claims
    console.log("Forcing token refresh...");
    await user.getIdToken(true);
    const tokenResult = await user.getIdTokenResult();
    const claims = tokenResult.claims;

    console.log("User claims from token:", claims);
    
    // Display the claims in a toast for easy debugging
    toast({
      title: "User Claims Verified",
      description: (
        <div className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <p className="text-white">Role from token: '{claims.role || "Not Found"}'</p>
          <pre><code className="text-white">{JSON.stringify(claims, null, 2)}</code></pre>
        </div>
      ),
      duration: 15000, // Keep toast open longer for debugging
    });

    console.log(`Checking if claims.role ('${claims.role}') === 'admin'`);
    if (claims.role === 'admin') {
      console.log("Admin check PASSED. Redirecting to /admin/dashboard...");
      router.push("/admin/dashboard");
    } else {
      console.log("Admin check FAILED. Signing out and showing 'Access Denied'.");
      // If the user is not an admin, deny access and sign them out.
      await auth.signOut();
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "You do not have administrative privileges.",
      });
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleLoginSuccess(userCredential.user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
      console.error("Login Error:", error);
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <CardTitle className="font-headline text-2xl">Admin Login</CardTitle>
          <CardDescription>Enter your admin credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 mt-4" onSubmit={handleEmailLogin}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
