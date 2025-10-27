import { Youtube, Bot, Database, ShieldCheck } from "lucide-react";

const tech = [
    {
        icon: <Youtube className="h-8 w-8 text-red-500" />,
        name: "YouTube Player & Data APIs"
    },
    {
        icon: <Bot className="h-8 w-8 text-blue-500" />,
        name: "Gemini Question Generation"
    },
    {
        icon: <Database className="h-8 w-8 text-yellow-500" />,
        name: "Firebase Security & Auth"
    },
    {
        icon: <ShieldCheck className="h-8 w-8 text-green-500" />,
        name: "Google Cloud Infrastructure"
    }
]

const BuiltOnGoogle = () => {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16">
            <div className="md:w-1/2 text-center md:text-left">
                <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
                    Reliable, Scalable, and Secure
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                    iLearn is built on Google's world-class infrastructure, ensuring a seamless and secure experience for you and your students.
                </p>
            </div>
            <div className="md:w-1/2 grid grid-cols-2 gap-8">
                {tech.map((item) => (
                    <div key={item.name} className="flex items-center gap-4">
                        {item.icon}
                        <span className="font-semibold text-foreground">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </section>
  );
};

export default BuiltOnGoogle;
