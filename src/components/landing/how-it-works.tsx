import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPaste, Sparkles, GraduationCap } from "lucide-react";

const steps = [
  {
    icon: <ClipboardPaste className="h-8 w-8 text-accent" />,
    title: "Paste a Playlist",
    description: "Simply provide a link to any YouTube playlist you want to assign to your students.",
  },
  {
    icon: <Sparkles className="h-8 w-8 text-accent" />,
    title: "AI Auto-Generates Questions",
    description: "Our AI analyzes the content and automatically inserts checkpoints with relevant questions.",
  },
  {
    icon: <GraduationCap className="h-8 w-8 text-accent" />,
    title: "Track Student Mastery",
    description: "Monitor student progress, see quiz results, and identify learning gaps in real-time.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Get Started in 3 Simple Steps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Transform passive video watching into active learning experiences effortlessly.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <Card key={index} className="text-center shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                  {step.icon}
                </div>
                <CardTitle className="font-headline text-xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
