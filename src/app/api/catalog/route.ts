import { z } from "zod";
import { catalogChildren } from "@/lib/tnved";

export async function GET(request: Request) {
  const parsed = z
    .object({
      parent: z
        .string()
        .regex(/^(demo-[a-z]+|[a-f\d-]{36})$/i)
        .optional(),
      offset: z.coerce.number().int().min(0).max(20000).default(0),
    })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Некорректные параметры." }, { status: 400 });
  try {
    const rows = await catalogChildren(parsed.data.parent ?? null, parsed.data.offset);
    return Response.json({ rows: rows.slice(0, 50), more: rows.length > 50 });
  } catch {
    return Response.json({ error: "Справочник временно недоступен." }, { status: 503 });
  }
}
