
'use client';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/logo";
import { useAuth, useFirestore } from "@/firebase";
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp, addDoc, collection, getDoc } from "firebase/firestore";
import { setUserClaims } from "@/ai/flows/set-user-claims";

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
      <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 261.8 0 120.8 109.8 8 244 8c66.8 0 126 23.4 172.9 61.9l-69.4 69.4c-22.3-21.5-52.6-34.3-88.4-34.3-71.1 0-129.5 58.2-129.5 129.4s58.4 129.4 129.5 129.4c82.3 0 115.5-59.8 119.5-88.4h-119.5v-92.6h216.5c1.2 11.5 1.8 23.4 1.8 35.8z"></path>
    </svg>
)

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSuccess = async (user: User) => {
    if (!auth) return;
    
    try {
      const idToken = await user.getIdToken(true);
      
      // Create session cookie
      const response: Response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const tokenResult = await user.getIdTokenResult(true);
      const claims = tokenResult.claims;

      if (claims.role === 'admin') {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/dashboard";
      }
    } catch (error) {
      console.error('Session creation error:', error);
      throw error;
    }
  };

  const createOrUpdateUser = async (user: User, displayName: string) => {
    if (!firestore) throw new Error("Firestore not available");
    
    const userRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userRef);

    // If user document already exists, just refresh claims
    if(userDoc.exists()) {
        console.log("User document already exists. Refreshing claims.");
        const userData = userDoc.data();
        // Refresh custom claims
        const claimsResult = await setUserClaims({
            uid: user.uid,
            claims: { role: userData.role, coachId: userData.coachId }
        });
        
        if (!claimsResult.success) {
          throw new Error(`Failed to refresh custom claims: ${claimsResult.message}`);
        }
        
        // Wait for claims to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        return;
    }

    const isSpecialAdmin = user.email?.toLowerCase() === 'ilearn@er21.org';
    const role = isSpecialAdmin ? 'admin' : 'coach';
    let coachId: string;

    if (isSpecialAdmin) {
        coachId = user.uid;
        const coachRef = doc(firestore, "coaches", coachId);
        await setDoc(coachRef, {
            displayName: displayName || "iLearn Admin",
            email: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
    } else {
        const newCoachRef = await addDoc(collection(firestore, "coaches"), {
             displayName: displayName,
             email: user.email,
             createdAt: serverTimestamp(),
             updatedAt: serverTimestamp(),
        });
        coachId = newCoachRef.id;
    }

    // Set user document in Firestore
    await setDoc(userRef, {
        coachId: coachId,
        role: role,
        profile: {
            name: displayName,
            email: user.email,
            photoUrl: user.photoURL || ''
        },
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });

    // Set custom claims using the server-side flow
    const claimsResult = await setUserClaims({
        uid: user.uid,
        claims: { role, coachId }
    });

    if (!claimsResult.success) {
      throw new Error(`Failed to set custom claims: ${claimsResult.message}`);
    }
    
    // Wait for claims to propagate and force token refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    await user.getIdToken(true); // Force refresh token
  }

  const handleGoogleSignup = async () => {
    if(!auth || !firestore) return;
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      await createOrUpdateUser(user, user.displayName || 'New User');
      await handleLoginSuccess(user);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!auth || !firestore) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await createOrUpdateUser(user, name);
      await handleLoginSuccess(user);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message,
      });
    } finally {
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
          <CardTitle className="font-headline text-2xl">Create a Coach Account</CardTitle>
          <CardDescription>Enter your information to start teaching</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full" onClick={handleGoogleSignup} disabled={isLoading}>
              <GoogleIcon />
              Sign up with Google
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
            <form className="grid gap-4 mt-4" onSubmit={handleEmailSignup}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your Name" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}/>
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline text-primary">
              Login
            </Link>
          </div>
          <div className="text-center text-sm text-muted-foreground mt-2">
            Student?{" "}
            <Link href="/signup-student" className="underline text-blue-600">
              Sign up with invite code
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
