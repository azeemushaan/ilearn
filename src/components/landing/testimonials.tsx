import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Star } from "lucide-react";

const testimonials = [
  {
    id: "testimonial-1",
    name: "Aisha Khan",
    title: "8th Grade Science Teacher",
    quote: "iLearn has been a game-changer. My students are more engaged, and the AI-generated questions save me hours of prep time. The progress tracking is incredibly insightful.",
    rating: 5,
  },
  {
    id: "testimonial-2",
    name: "Bilal Ahmed",
    title: "School Principal",
    quote: "We implemented iLearn across our middle school, and the results are fantastic. It's a powerful, easy-to-use tool that aligns perfectly with our digital learning initiatives.",
    rating: 5,
  },
  {
    id: "testimonial-3",
    name: "Fatima Ali",
    title: "Educational Technologist",
    quote: "The 'anti-skip' feature is brilliant. It ensures students actually watch the content. The analytics dashboard provides the data we need to support our teachers effectively.",
    rating: 5,
  },
];

const Testimonials = () => {
  const getImage = (id: string) => PlaceHolderImages.find(img => img.id === id);

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Loved by Educators Everywhere
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See how iLearn is making a difference in classrooms.
          </p>
        </div>
        <Carousel
          opts={{ align: "start", loop: true }}
          className="w-full max-w-4xl mx-auto mt-12"
        >
          <CarouselContent>
            {testimonials.map((testimonial) => {
              const imageData = getImage(testimonial.id);
              return (
              <CarouselItem key={testimonial.id} className="md:basis-1/2 lg:basis-1/2">
                <div className="p-1">
                  <Card className="h-full flex flex-col justify-between shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex mb-4">
                            {Array(testimonial.rating).fill(0).map((_, i) => (
                                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                            ))}
                        </div>
                      <p className="text-foreground/80 mb-6">&ldquo;{testimonial.quote}&rdquo;</p>
                      <div className="flex items-center gap-4">
                        {imageData && (
                           <Image
                            src={imageData.imageUrl}
                            alt={`Avatar of ${testimonial.name}`}
                            width={48}
                            height={48}
                            className="rounded-full"
                            data-ai-hint={imageData.imageHint}
                          />
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{testimonial.name}</p>
                          <p className="text-sm text-muted-foreground">{testimonial.title}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            )})}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </div>
    </section>
  );
};

export default Testimonials;
