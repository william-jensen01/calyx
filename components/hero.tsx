import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Hero() {
  const user = await getCurrentUser();
  const hasKey = user?.url_token;

  return (
    <section className="min-h-screen flex items-start justify-center px-4 ">
      <div className="max-w-3xl text-center">
        {/* Eyebrow */}
        <div className="text-sm uppercase tracking-[3px] tracking-midwest text-hero-accent font-semibold mb-6">
          From Bud to Bloom
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight mb-8">
          Your Schedule,{" "}
          <span className="bg-gradient-to-r from-[10%] from-leaf via-pink-500 to-rose-700 bg-clip-text text-transparent">
            Unfolded
          </span>
        </h1>

        {/* Body */}
        <p className="text-lg md:text-2xl lg:text-2xl font-[300] leading-relaxed mb-10">
          Your schedule is{" "}
          <span className="font-[600] italic text-hero-accent">trapped</span> -
          locked like a flower bud waiting for spring. You know it's all there.
          Every appointment. Every shift. Every deadline. Every commitment you
          need to honor.{" "}
          <strong className="italic font-[600] text-hero-accent">
            But you can't actually see it where you need it.
          </strong>
        </p>

        {/* Solution */}
        <p className="text-xl md:text-3xl lg:text-3xl leading-relaxed mb-4 font-[300]">
          <span className="font-semibold text-hero-accent">Calyx</span> opens up
          what's locked away,{" "}
          <strong className="italic font-[600] text-hero-accent">
            revealing the schedule you need to see.
          </strong>
        </p>

        {/* Closing Statement */}
        <p className="text-md md:text-lg text-muted-foreground dark:text-muted-foreground mb-8">
          No more hunting. No more guessing. Just clarity.
        </p>

        {/* CTA Button */}
        <div className="flex justify-center">
          <div className="grid gap-4 grid-flow-col items-center">
            <Button size="lg" variant={"default"}>
              <Link
                href={hasKey ? `/u/${user.url_token}` : "/auth/login"}
                className="inline-block font-bold"
              >
                See Your Schedule
              </Link>
            </Button>

            <Button variant="link" size="sm">
              <Link href="#">
                Learn more <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
