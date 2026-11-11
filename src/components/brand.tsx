import { APP_NAME, LOGO_URL } from "@/lib/utils";

/** Nama & logo penyelenggara (dapat diganti lewat NEXT_PUBLIC_APP_NAME / NEXT_PUBLIC_LOGO_URL). */
export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  if (size === "md") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        {LOGO_URL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={LOGO_URL} alt={`Logo ${APP_NAME}`} className="h-24 w-auto" />
        ) : null}
        <div>
          <p className="text-xl font-bold text-primary">{APP_NAME}</p>
          <p className="text-sm text-muted-foreground">Try Out SKD CPNS</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {LOGO_URL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_URL} alt="" className="h-8 w-auto" />
      ) : null}
      <span className="font-semibold text-primary">{APP_NAME}</span>
    </div>
  );
}
