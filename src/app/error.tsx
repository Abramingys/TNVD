"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Не удалось открыть страницу</h1>
      <p>Повторите попытку. При локальном запуске проверьте настройки Supabase или включите DEMO_MODE.</p>
      <button onClick={reset}>Повторить</button>
    </main>
  );
}
