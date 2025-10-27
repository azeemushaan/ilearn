import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "For early schools",
    description: "Get started with the essential features to transform your teaching.",
    features: [
      "Assign YouTube playlists",
      "AI-generated quizzes",
      "Basic progress tracking",
      "Up to 3 classes",
    ],
    isPopular: false,
  },
  {
    name: "Pro",
    price: "Coming Soon",
    period: "Per teacher / month",
    description: "Unlock advanced analytics and customization for your classroom.",
    features: [
      "Everything in Free, plus:",
      "Advanced student analytics",
      "Class heatmaps",
      "Edit AI-generated questions",
      "Unlimited classes",
    ],
    isPopular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "For districts & institutions",
    description: "Tailored solutions, dedicated support, and custom integrations.",
    features: [
      "Everything in Pro, plus:",
      "Parental reports",
      "District-level dashboards",
      "Custom integrations (LMS, SIS)",
      "Dedicated support & onboarding",
    ],
    isPopular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Free for early schools. Premium analytics & parental reports coming soon.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-3 items-stretch">
          {plans.map((plan) => (
            <Card key={plan.name} className={cn("flex flex-col shadow-lg", plan.isPopular && "border-accent ring-2 ring-accent")}>
              <CardHeader className="pb-4">
                {plan.isPopular && (
                    <div className="text-sm font-semibold text-accent -mt-2 mb-2">MOST POPULAR</div>
                )}
                <CardTitle className="text-2xl font-headline">{plan.name}</CardTitle>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className={cn("w-full", plan.isPopular ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-primary text-primary-foreground hover:bg-primary/90")} disabled={plan.name !== 'Free'}>
                  {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
