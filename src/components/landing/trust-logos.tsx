const TrustLogos = () => {
  const logos = [
    "EduVerse Schools",
    "Brighton District",
    "Summit Academy",
    "Learning Grove",
    "Knowledge First",
    "Future Leaders Prep",
  ];

  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Trusted by leading schools and districts
        </h3>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-y-8 gap-x-12 items-center">
          {logos.map((logo) => (
            <div key={logo} className="flex justify-center">
              <span className="font-headline text-lg font-medium text-muted-foreground/70 text-center">
                {logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustLogos;
