import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getLogoSrc } from "@/lib/branding";

export default async function LoginPage() {
  const logoUrl = await getLogoSrc();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="אולטרנט" className="h-24 w-auto object-contain sm:h-28" />
      ) : (
        <span className="text-3xl font-extrabold tracking-tight text-teal">אולטרנט</span>
      )}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
