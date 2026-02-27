"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <head>
        <title>Terjadi Kesalahan | Pasal.id</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="flex min-h-screen items-center justify-center bg-background font-sans">
        <div className="text-center">
          <h2 className="font-heading text-xl mb-4">Terjadi Kesalahan</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Maaf, terjadi kesalahan yang tidak terduga.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Coba Lagi
          </button>
        </div>
      </body>
    </html>
  );
}
