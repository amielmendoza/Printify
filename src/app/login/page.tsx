import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { CreditCard, Sparkles, Layers, ShieldCheck } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI background removal",
    description: "Photos auto-cleaned for crisp, consistent ID cards.",
  },
  {
    icon: Layers,
    title: "Batch generation",
    description: "Print hundreds of IDs in a single pass — duplex-ready.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description: "Row-level security keeps every organization isolated.",
  },
]

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand / story panel */}
      <div className="relative hidden w-1/2 flex-col overflow-hidden bg-foreground p-12 text-background lg:flex">
        <div
          className="absolute inset-0 opacity-[0.65]"
          style={{
            background:
              "radial-gradient(at 20% 0%, oklch(0.55 0.22 265 / 0.5) 0px, transparent 50%), radial-gradient(at 100% 80%, oklch(0.60 0.22 320 / 0.35) 0px, transparent 50%)",
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
            Professional ID cards,
            <br />
            <span className="bg-gradient-to-r from-white via-white to-white/40 bg-clip-text text-transparent">
              made effortless.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65">
            Upload templates, import people, and generate print-ready ID cards in
            bulk — with automatic photo cleanup and duplex output.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">{f.title}</p>
                  <p className="text-[12px] text-white/55">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-12 text-[11px] uppercase tracking-[0.18em] text-white/30">
          ID Card Printing Service
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="absolute inset-0 bg-dotted opacity-60 lg:hidden" />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CreditCard className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Printify</span>
          </div>

          <div className="mb-7">
            <h1 className="text-[26px] font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground">
              Sign in to continue to your workspace.
            </p>
          </div>

          <LoginForm />

          <p className="mt-7 text-center text-[13px] text-muted-foreground">
            New to Printify?{" "}
            <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
