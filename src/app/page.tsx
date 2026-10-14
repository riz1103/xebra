"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import {
  GraduationCap,
  Shield,
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

const features = [
  {
    icon: GraduationCap,
    title: "Smart Exam Creation",
    description: "Build exams with multiple question types, time limits, and randomization options.",
  },
  {
    icon: Shield,
    title: "Secure Proctoring",
    description: "Control access with invitations, manage groups, and monitor exam sessions in real-time.",
  },
  {
    icon: BarChart3,
    title: "Instant Results",
    description: "Auto-graded results with detailed analytics, pass/fail indicators, and feedback.",
  },
  {
    icon: Users,
    title: "Group Management",
    description: "Organize examinees into groups and send bulk invitations efficiently.",
  },
  {
    icon: Clock,
    title: "Flexible Timing",
    description: "Set time limits per exam or per question with auto-submission when time expires.",
  },
  {
    icon: CheckCircle,
    title: "Passing Conditions",
    description: "Configure passing criteria by percentage, points, or minimum correct answers.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-dvh bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image
              src="/xevra-logo.png"
              alt="Xevra"
              width={36}
              height={36}
              className="h-8 w-8 rounded-lg sm:h-9 sm:w-9"
              priority
            />
            <span className="text-lg font-bold tracking-tight sm:text-xl">XEVRA</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button variant="ghost" asChild className="px-3 sm:px-4">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild className="hidden min-[400px]:inline-flex">
                  <Link href="/login?tab=register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-14 sm:pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center rounded-full border bg-muted/50 px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Trusted examination platform
            </div>
            <h1 className="mx-auto max-w-4xl text-[2rem] leading-tight font-bold tracking-tight min-[400px]:text-4xl sm:text-6xl lg:text-7xl">
              e<span className="text-primary">X</span>amination{" "}
              <span className="text-primary">EV</span>aluation &{" "}
              <span className="text-primary">R</span>esult{" "}
              <span className="text-primary">A</span>uthority
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A comprehensive examination platform where proctors create and manage exams,
              invite examinees, and analyze results -- all in one place.
            </p>
            <div className="mx-auto mt-8 flex max-w-xs flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <Button size="lg" asChild className="h-12 px-8 text-base">
                <Link href="/login?tab=register">
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base">
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-14 border-t bg-muted/30 py-16 sm:scroll-mt-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
              Everything you need for exam management
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Powerful features designed for both proctors and examinees.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-lg sm:p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center sm:h-12 sm:w-12 justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
            Ready to transform your examination process?
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Join Xevra today and streamline how you create, distribute, and evaluate exams.
          </p>
          <div className="mx-auto mt-8 flex max-w-xs flex-col sm:block sm:max-w-none">
            <Button size="lg" asChild className="h-12 px-8 text-base">
              <Link href="/login?tab=register">
                Get Started Now <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-2">
              <Image
                src="/xevra-logo.png"
                alt="Xevra"
                width={28}
                height={28}
                className="rounded-md"
              />
              <span className="text-sm font-semibold">XEVRA</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Xevra. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
