import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import Link from "next/link";

const Hero = () => {
  return (
    <section className="relative bg-secondary/30">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(to_bottom,white_10%,transparent_90%)]"></div>
        <div className="container mx-auto px-4 md:px-6 text-center relative py-24 md:py-32 lg:py-40">
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-primary">
                Turn YouTube Playlists into <br/> Measurable Learning
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
                Auto-pause, AI quizzes, real-time progress — built for Grades 1–8.
            </p>
            <div className="mt-8 flex justify-center gap-4">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                    <Link href="/signup">Start free</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                    <Link href="#">
                        <PlayCircle className="mr-2 h-5 w-5"/>
                        Watch 60-sec demo
                    </Link>
                </Button>
            </div>
        </div>
    </section>
  );
};

export default Hero;
