import { getCode } from "@/lib/tnved";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(\d{2,10}|demo-[a-z]+|[a-f\d-]{36})$/i.test(code)) return Response.json({ error: "Некорректный код." }, { status: 400 });
  try {
    const row = await getCode(code);
    return row ? Response.json(row) : Response.json({ error: "Позиция не найдена." }, { status: 404 });
  } catch {
    return Response.json({ error: "Карточка временно недоступна." }, { status: 503 });
  }
}
