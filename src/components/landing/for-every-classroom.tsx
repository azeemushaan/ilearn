import { Wifi, Languages, CloudCog } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const features = [
  {
    icon: <Wifi className="h-8 w-8 text-accent" />,
    title: "Low-Bandwidth Mode",
    description: "Designed to work smoothly even in areas with spotty internet, ensuring access for all students.",
  },
  {
    icon: <Languages className="h-8 w-8 text-accent" />,
    title: "Urdu/English UI",
    description: "A bilingual interface makes the platform accessible and easy to use for a wider range of students and teachers.",
  },
  {
    icon: <CloudCog className="h-8 w-8 text-accent" />,
    title: "Offline Answer Sync",
    description: "Students can answer questions offline, and their progress will automatically sync when they reconnect.",
  },
];

const ForEveryClassroom = () => {
  return (
    <section className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Built for Every Classroom
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            We're committed to making learning accessible, no matter the circumstances.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-background/50 border-0 shadow-none">
              <CardHeader className="flex flex-row items-center gap-4">
                {feature.icon}
                <div>
                    <CardTitle className="font-headline text-xl">{feature.title}</CardTitle>
                    <CardDescription className="mt-1">{feature.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ForEveryClassroom;
