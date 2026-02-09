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
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/xevra-logo.png"
              alt="Xevra"
              width={36}
              height={36}
              className="rounded-lg"
              priority
            />
            <span className="text-xl font-bold tracking-tight">XEVRA</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/login?tab=register">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="mb-6 inline-flex items-center rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              Trusted examination platform
            </div>
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              e<span className="text-primary">X</span>amination{" "}
              <span className="text-primary">EV</span>aluation &{" "}
              <span className="text-primary">R</span>esult{" "}
              <span className="text-primary">A</span>uthority
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              A comprehensive examination platform where proctors create and manage exams,
              invite examinees, and analyze results -- all in one place.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
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
      <section id="features" className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need for exam management
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Powerful features designed for both proctors and examinees.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group rounded-xl border bg-card p-6 transition-shadow hover:shadow-lg"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
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
      <section className="border-t py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to transform your examination process?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join Xevra today and streamline how you create, distribute, and evaluate exams.
          </p>
          <div className="mt-8">
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
          <div className="flex items-center justify-between">
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
