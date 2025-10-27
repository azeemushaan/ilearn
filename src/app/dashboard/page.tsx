import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="p-4 md:p-6 border-b">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-headline font-bold">Dashboard</h1>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Assign New Playlist
            </Button>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome back, Teacher!</CardTitle>
                    <CardDescription>Here's a quick overview of your classes and assignments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Your dashboard content will go here.</p>
                </CardContent>
            </Card>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Assignments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">5</p>
                        <p className="text-sm text-muted-foreground">playlists currently assigned</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Students Enrolled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">87</p>
                        <p className="text-sm text-muted-foreground">across 3 classes</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Overall Completion</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold">76%</p>
                        <p className="text-sm text-muted-foreground">average across all assignments</p>
                    </CardContent>
                </Card>
             </div>
        </div>
      </main>
    </div>
  );
}
