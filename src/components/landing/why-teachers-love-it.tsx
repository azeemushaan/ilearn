import { PauseCircle, BrainCircuit, Lock, LayoutGrid } from "lucide-react";

const features = [
  {
    icon: <PauseCircle className="h-8 w-8 text-primary" />,
    title: "Intelligent Pauses",
    description: "Videos automatically pause at natural concept boundaries, ensuring students have time to reflect and absorb.",
  },
  {
    icon: <BrainCircuit className="h-8 w-8 text-primary" />,
    title: "AI-Generated MCQs",
    description: "Instantly create relevant multiple-choice questions based on the video content, which you can review and edit.",
  },
  {
    icon: <Lock className="h-8 w-8 text-primary" />,
    title: "Anti-Skip Controls",
    description: "Ensure students watch the content with features that prevent skipping ahead. No more fake 'completed' videos.",
  },
  {
    icon: <LayoutGrid className="h-8 w-8 text-primary" />,
    title: "Class Heatmaps",
    description: "Visualize class-wide and individual student performance to easily track mastery and identify areas for improvement.",
  },
];

const WhyTeachersLoveIt = () => {
  return (
    <section id="features" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Why Teachers Love iLearn
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powerful tools designed to make your teaching more effective and engaging.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 rounded-lg">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background mb-4 shadow-md">
                    {feature.icon}
                </div>
                <h3 className="text-xl font-headline font-semibold text-primary">{feature.title}</h3>
                <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyTeachersLoveIt;
