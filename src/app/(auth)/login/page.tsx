import { LoginButton } from "@/components/auth/LoginButton";

const ERROR_MESSAGES: Record<string, string> = {
  domain:
    "Este email no tiene acceso al dashboard. Solo se permite el dominio @chilldigital.agency.",
  auth: "Ocurrió un error durante el inicio de sesión. Intentá de nuevo.",
};

interface LoginPageProps {
  searchParams: { error?: string };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const errorMessage = searchParams.error
    ? ERROR_MESSAGES[searchParams.error] ?? ERROR_MESSAGES.auth
    : null;

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-4">
      {/* Glow de fondo */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(96,74,217,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div
          className="relative rounded-2xl border border-white/[0.06] bg-[#16151c] p-8 flex flex-col gap-6"
          style={{
            boxShadow:
              "0 0 0 1px rgba(96,74,217,0.1), 0 0 80px rgba(96,74,217,0.1)",
          }}
        >
          {/* Logo + marca */}
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center mb-1">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 12C3 7.03 7.03 3 12 3s9 4.03 9 9-4.03 9-9 9"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"
                  stroke="white"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Chill Digital
            </h1>
            <p className="text-sm text-muted-foreground">
              Panel de Meta Ads
            </p>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {/* Botón */}
          <LoginButton />

          {/* Nota de acceso */}
          <p className="text-center text-xs text-muted-foreground leading-relaxed">
            Acceso exclusivo para el equipo de Chill Digital.
            <br />
            Usá tu cuenta{" "}
            <span className="text-brand-400 font-medium">
              @chilldigital.agency
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
