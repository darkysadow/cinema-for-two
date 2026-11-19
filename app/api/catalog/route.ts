import { type NextRequest } from "next/server";
import { catalogReader } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "private, no-store" };
  switch (request.headers.get("x-catalog-read")) {
    case "genres":
      return Response.json(await catalogReader.genres(), { headers });
    case "page":
      return Response.json(await catalogReader.readPage(params), { headers });
    default:
      return Response.json(await catalogReader.readRange(params), { headers });
  }
}
