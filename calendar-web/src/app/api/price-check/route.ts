import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

interface PriceCheckLink {
  link_id: string;
  url: string;
}

function extractPriceFromHtml(html: string): number | null {
  const parsePrice = (raw: string | number | null | undefined): number | null => {
    if (raw == null) return null;
    // Strip everything except digits and the last decimal point
    const s = String(raw).replace(/,/g, "").replace(/[^0-9.]/g, "");
    const price = parseFloat(s);
    return !isNaN(price) && price > 0 ? price : null;
  };

  // 1. JSON-LD: Product with offers (handles top-level array and @graph)
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const data: unknown = JSON.parse(match[1]);
      const nodes: unknown[] = [];
      if (Array.isArray(data)) {
        nodes.push(...data);
      } else if (data && typeof data === "object" && "@graph" in data) {
        const graph = (data as Record<string, unknown>)["@graph"];
        nodes.push(...(Array.isArray(graph) ? graph : [graph]));
      } else {
        nodes.push(data);
      }
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const item = node as Record<string, unknown>;
        if (item["@type"] !== "Product" || !item.offers) continue;
        const offersList = Array.isArray(item.offers) ? item.offers : [item.offers];
        for (const offer of offersList) {
          const o = offer as Record<string, unknown>;
          const p = parsePrice((o.price ?? o.lowPrice) as string | number);
          if (p !== null) return p;
        }
      }
    } catch { /* ignore */ }
  }

  // 2. Open Graph product:price:amount
  const og =
    html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9.,]+)["']/i) ??
    html.match(/<meta[^>]+content=["']([0-9.,]+)["'][^>]+property=["']product:price:amount["']/i);
  if (og) { const p = parsePrice(og[1]); if (p) return p; }

  // 3. itemprop="price" — content attribute
  const itCont =
    html.match(/itemprop=["']price["'][^>]+content=["']([0-9.,]+)["']/i) ??
    html.match(/content=["']([0-9.,]+)["'][^>]+itemprop=["']price["']/i);
  if (itCont) { const p = parsePrice(itCont[1]); if (p) return p; }

  // 4. itemprop="price" — inner text  <span itemprop="price">$3.99</span>
  const itText = html.match(/itemprop=["']price["'][^>]*>\s*\$?\s*([0-9]+(?:[.,][0-9]{2})?)\s*</i);
  if (itText) { const p = parsePrice(itText[1]); if (p) return p; }

  // 5. data-price / data-sale-price attributes
  const dataPrice =
    html.match(/data-price=["']([0-9.,]+)["']/i) ??
    html.match(/data-sale-price=["']([0-9.,]+)["']/i) ??
    html.match(/data-product-price=["']([0-9.,]+)["']/i);
  if (dataPrice) { const p = parsePrice(dataPrice[1]); if (p) return p; }

  // 6. JSON blob in <script> — conservative: only match decimal prices to avoid false positives
  const scriptJson = html.match(/"price"\s*:\s*"([0-9]+\.[0-9]{1,2})"/);
  if (scriptJson) { const p = parsePrice(scriptJson[1]); if (p) return p; }

  return null;
}

async function fetchPrice(link: PriceCheckLink): Promise<{ link_id: string; price: number | null }> {
  try {
    const res = await fetch(link.url, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) return { link_id: link.link_id, price: null };

    const html = await res.text();
    return { link_id: link.link_id, price: extractPriceFromHtml(html) };
  } catch {
    return { link_id: link.link_id, price: null };
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;

  const { links } = (await req.json()) as { links: PriceCheckLink[] };

  if (!Array.isArray(links) || links.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const results = await Promise.all(links.map(fetchPrice));
  return NextResponse.json({ results });
}
