
'use client';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/logo";
import { useAuth, useFirestore } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, User, getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { setUserClaims } from "@/ai/flows/set-user-claims";

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 261.8 0 120.8 109.8 8 244 8c66.8 0 126 23.4 172.9 61.9l-69.4 69.4c-22.3-21.5-52.6-34.3-88.4-34.3-71.1 0-129.5 58.2-129.5 129.4s58.4 129.4 129.5 129.4c82.3 0 115.5-59.8 119.5-88.4h-119.5v-92.6h216.5c1.2 11.5 1.8 23.4 1.8 35.8z"></path>
  </svg>
)

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  console.log('[LOGIN PAGE] Rendered, auth:', !!auth, 'isLoading:', isLoading);

  const handleLoginSuccess = async (user: User) => {
    if (!auth) return;
    
    const startTime = Date.now();
    try {
      console.log('[LOGIN] Getting ID token...');
      const tokenStart = Date.now();
      const idToken = await user.getIdToken(true);
      console.log(`[LOGIN] ID token obtained in ${Date.now() - tokenStart}ms`);
      
      console.log('[LOGIN] Creating session cookie...');
      const sessionStart = Date.now();
      const response: Response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      console.log(`[LOGIN] Session API response in ${Date.now() - sessionStart}ms`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[LOGIN] Session creation failed:', error);
        throw new Error('Session creation failed');
      }

      const sessionData = await response.json();
      console.log('[LOGIN] Session created:', sessionData);

      console.log('[LOGIN] Getting token claims...');
      const claimsStart = Date.now();
      const tokenResult = await user.getIdTokenResult(true);
      const claims = tokenResult.claims;
      console.log(`[LOGIN] Claims obtained in ${Date.now() - claimsStart}ms:`, claims);

      console.log(`[LOGIN] Total login time: ${Date.now() - startTime}ms`);

      if (claims.role === 'admin') {
        console.log('[LOGIN] Redirecting to /admin/dashboard');
        window.location.href = "/admin/dashboard";
      } else {
        console.log('[LOGIN] Redirecting to /dashboard');
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error('[LOGIN] Error:', error);
      console.log(`[LOGIN] Failed after ${Date.now() - startTime}ms`);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      // This assumes a user logging in with Google already exists.
      // A more robust flow would check and create the user if they don't.
      await handleLoginSuccess(userCredential.user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) {
      console.error('[LOGIN] Firebase auth not initialized');
      return;
    }
    
    console.log('[LOGIN] Form submitted');
    setIsLoading(true);
    
    try {
      console.log('[LOGIN] Signing in with email:', email);
      const signInStart = Date.now();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log(`[LOGIN] Sign in successful in ${Date.now() - signInStart}ms, UID:`, userCredential.user.uid);
      await handleLoginSuccess(userCredential.user);
    } catch (error: any) {
      console.error('[LOGIN] Email login error:', error);
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
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
          <CardTitle className="font-headline text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full" onClick={handleGoogleLogin} disabled={isLoading}>
              <GoogleIcon />
              Login with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
          </div>
          <form 
            className="grid gap-4 mt-4" 
            onSubmit={(e) => {
              console.log('[LOGIN] Form onSubmit triggered');
              handleEmailLogin(e);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto inline-block text-sm underline text-muted-foreground hover:text-primary">
                  Forgot your password?
                </Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={isLoading}
              onClick={(e) => {
                console.log('[LOGIN] Button clicked, isLoading:', isLoading, 'auth:', !!auth);
              }}
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline text-primary">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
