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
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

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

  const handleLoginSuccess = async (user: User) => {
    const userDocRef = doc(firestore, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists() && userDoc.data().role === 'admin') {
      router.push("/admin/dashboard");
    } else {
      router.push("/dashboard");
    }
  };

  const createOrUpdateUserDocument = async (user: User, role: 'admin' | 'teacher', name: string) => {
    if (!firestore) return;
    const userRef = doc(firestore, "users", user.uid);
    
    let userData: any = {
      id: user.uid,
      email: user.email,
      role: role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (role === 'admin') {
        userData.firstName = 'Admin';
        userData.lastName = '';
    } else {
        userData.firstName = name.split(' ')[0] || '';
        userData.lastName = name.split(' ').slice(1).join(' ') || '';
    }

    await setDoc(userRef, userData, { merge: true });
  }

  const handleGoogleSignup = async () => {
    if(!auth || !firestore) return;
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      await createOrUpdateUserDocument(user, 'teacher', user.displayName || '');

      await handleLoginSuccess(user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message,
      });
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!auth || !firestore) return;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const role = email.toLowerCase() === 'admin@ilearn.com' ? 'admin' : 'teacher';

      await createOrUpdateUserDocument(user, role, name);

      await handleLoginSuccess(user);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error.message,
      });
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
          <CardTitle className="font-headline text-2xl">Create an account</CardTitle>
          <CardDescription>Enter your information to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full" onClick={handleGoogleSignup}>
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
              <Input id="name" placeholder="Your Name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              Create Account
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline text-primary">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
