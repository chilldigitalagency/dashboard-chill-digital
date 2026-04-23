"use client";

import { useRouter } from "next/navigation";

interface ClientCardProps {
  id: string;
  name: string;
  meta_account_id: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ClientCard({ id, name, meta_account_id }: ClientCardProps) {
  const accountIdClean = meta_account_id.replace("act_", "");
  const router = useRouter();

  return (
    <div className="relative" style={{ minHeight: "280px" }}>
      {/* Glow de fondo */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 80%, rgba(96,74,217,0.12) 0%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />

      {/* Card */}
      <div
        className="client-card relative h-full rounded-[0.75rem] border flex flex-col items-center justify-center gap-6 p-8 cursor-pointer transition-all duration-200 bg-card border-border"
        style={{ minHeight: "280px" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(96,74,217,0.4)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 1px rgba(96,74,217,0.2), 0 8px 32px rgba(96,74,217,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "";
          (e.currentTarget as HTMLElement).style.boxShadow = "";
        }}
        onClick={() => router.push(`/clients/${id}`)}
      >
        {/* Iniciales */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#604ad9" }}
        >
          <span className="text-xl font-bold text-white tracking-wide">
            {getInitials(name)}
          </span>
        </div>

        {/* Nombre */}
        <div className="flex flex-col items-center gap-1.5">
          <p
            className="text-foreground text-center leading-snug"
            style={{ fontSize: "1.5rem", fontWeight: 600 }}
          >
            {name}
          </p>
          <p className="text-xs text-muted-foreground">
            Cuenta publicitaria: {accountIdClean}
          </p>
        </div>

        {/* Botón */}
        <button
          className="w-full h-12 rounded-full font-semibold text-base text-white transition-all duration-200 cursor-pointer"
          style={{
            background: "#604ad9",
            boxShadow: "0 4px 24px rgba(96,74,217,0.25)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#4f3bc4";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 4px 32px rgba(96,74,217,0.45)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#604ad9";
            (e.currentTarget as HTMLElement).style.boxShadow =
              "0 4px 24px rgba(96,74,217,0.25)";
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/clients/${id}`);
          }}
        >
          Ver resultados
        </button>
      </div>
    </div>
  );
}
