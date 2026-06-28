import Link from "next/link"
import { RegisterForm } from "@/components/auth/register-form"
import { CreditCard, CheckCircle2 } from "lucide-react"

const benefits = [
  "Unlimited templates and people",
  "AI-powered photo background removal",
  "Batch print + duplex export",
  "Role-based access for your team",
]

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-foreground p-12 text-background lg:flex">
        <div
          className="absolute inset-0 opacity-[0.65]"
          style={{
            background:
              "radial-gradient(at 80% 10%, oklch(0.55 0.22 265 / 0.5) 0px, transparent 50%), radial-gradient(at 0% 90%, oklch(0.60 0.22 320 / 0.35) 0px, transparent 50%)",
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <CreditCard className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Printify</span>
        </div>

        <div className="relative mt-auto">
          <h2 className="text-[40px] font-semibold leading-[1.1] tracking-tight">
            Start printing IDs <br />
            in <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">under five minutes.</span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
            Create your workspace, upload your first template, and you&apos;re ready to go.
          </p>

          <ul className="mt-8 space-y-3">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-3 text-[14px] text-white/80">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-[11px] uppercase tracking-[0.18em] text-white/30">
          ID Card Printing Service
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="absolute inset-0 bg-dotted opacity-60 lg:hidden" />
        <div className="relative w-full max-w-[420px]">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Printify</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[26px] font-semibold tracking-tight">Create your workspace</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Get started in less than a minute. No credit card required.
            </p>
          </div>

          <RegisterForm />

          <p className="mt-7 text-center text-[13px] text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
