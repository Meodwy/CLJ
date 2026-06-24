'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HeartPulse, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginFormData } from '@/lib/validators'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const data = {
      email: (formData.get('email') as string) || '',
      password: (formData.get('password') as string) || '',
    }

    const result = loginSchema.safeParse(data)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {}
      result.error.issues.forEach((err) => {
        const field = err.path[0] as keyof LoginFormData
        fieldErrors[field] = err.message
      })
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      toast.error('Email ou senha incorretos')
      setLoading(false)
      return
    }

    toast.success('Login realizado com sucesso!')
    router.replace('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Panel — Brand Experience */}
      <div className="relative hidden w-[45%] overflow-hidden lg:block">
        {/* Deep navy base */}
        <div className="absolute inset-0 bg-[oklch(0.18_0.025_265)]" />

        {/* Subtle dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.3) 0.5px, transparent 0.5px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Gradient wash */}
        <div className="absolute left-1/2 top-0 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[oklch(0.45_0.15_265_/_0.15)] to-transparent blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-[450px] w-[450px] rounded-full bg-gradient-to-tr from-[oklch(0.35_0.10_265_/_0.12)] to-transparent blur-3xl" />

        {/* Giant watermark wordmark — calmo e premium */}
        <div
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
          aria-hidden
        >
          <span
            className="font-heading text-[clamp(8rem,18vw,16rem)] font-bold leading-none tracking-[-0.04em] text-white/[0.04]"
            style={{ fontVariationSettings: '"wght" 700' }}
          >
            CLJ
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col px-14 py-16">
          {/* Top badge */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/[0.08]">
              <HeartPulse className="h-4.5 w-4.5 text-white/80" />
            </div>
            <span className="text-xs font-medium tracking-[0.15em] uppercase text-white/40">
              Gestão Clínica
            </span>
          </div>

          {/* Vertical spacer */}
          <div className="flex-1" />

          {/* Bottom-aligned brand message */}
          <div className="space-y-4">
            <div className="h-px w-16 bg-white/10" />

            <h1 className="font-heading text-4xl font-light leading-tight tracking-wide text-white">
              Cuidado que
              <br />
              <span className="font-medium">transforma.</span>
            </h1>

            <p className="max-w-xs text-sm leading-relaxed text-white/45">
              Plataforma completa para gestão da sua clínica com
              agendamentos, prontuários e equipe integrados.
            </p>

            {/* Trust markers */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
                <span className="text-[11px] text-white/35">Seguro</span>
              </div>
              <span className="text-[11px] text-white/15">/</span>
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-blue-400/70" />
                <span className="text-[11px] text-white/35">Confiável</span>
              </div>
              <span className="text-[11px] text-white/15">/</span>
              <div className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-amber-400/70" />
                <span className="text-[11px] text-white/35">24/7</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex w-full items-center justify-center bg-white px-8 lg:w-[55%]">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="mb-12 flex flex-col items-center lg:hidden">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <h1 className="font-heading text-lg font-semibold text-foreground">
              CLJ Clínica
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Faça login para acessar o sistema
            </p>
          </div>

          {/* Desktop header */}
          <div className="mb-12 hidden lg:block">
            <div className="mb-1 flex items-center gap-2">
              <h1 className="font-heading text-[22px] font-medium tracking-tight text-foreground">
                Bem-vindo
              </h1>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Acesse sua conta para continuar
            </p>
            <div className="mt-4 h-px w-10 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-[13px] font-medium text-foreground/80"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                disabled={loading}
                aria-invalid={!!errors.email}
                className="h-[46px] rounded-xl border-border/80 bg-white/60 px-4 text-[15px] shadow-sm transition-all duration-200 placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08),0_1px_2px_0_rgba(0,0,0,0.02)]"
              />
              {errors.email && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                  {errors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[13px] font-medium text-foreground/80"
              >
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={loading}
                  aria-invalid={!!errors.password}
                  className="h-[46px] rounded-xl border-border/80 bg-white/60 px-4 pr-[42px] text-[15px] shadow-sm transition-all duration-200 placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)_/_0.08),0_1px_2px_0_rgba(0,0,0,0.02)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1.5 text-[13px] text-destructive">
                  <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
                  {errors.password}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="h-[46px] w-full rounded-xl bg-primary text-[15px] font-medium text-primary-foreground shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-[18px] w-[18px] animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-14 text-center">
            <p className="text-[11px] text-muted-foreground/40">
              &copy; {new Date().getFullYear()} CLJ Clínica.
              <br className="sm:hidden" /> Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}