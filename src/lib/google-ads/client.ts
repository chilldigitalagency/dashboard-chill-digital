const WINDSOR_BASE = "https://connectors.windsor.ai/google_ads";

export interface GoogleSummary {
  spend: number;
  conversions: number;
  conversion_value: number;
  roas: number;
  cpa: number;
  clicks: number;
  impressions: number;
}

export interface GoogleDailyRow {
  date: string;
  spend: number;
  conversions: number;
  conversion_value: number;
  clicks: number;
}

type WindsorRow = Record<string, string | number>;

function parseNum(v: string | number | undefined): number {
  if (v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

async function windsorFetch(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  fields: string
): Promise<WindsorRow[]> {
  const url = new URL(WINDSOR_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("date_from", dateFrom);
  url.searchParams.set("date_to", dateTo);
  url.searchParams.set("fields", fields);

  const res = await fetch(url.toString(), {
    next: { revalidate: 0 },
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Windsor.ai responded ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  // Windsor returns { data: [...] }
  return Array.isArray(json?.data) ? (json.data as WindsorRow[]) : [];
}

export async function getGoogleSummary(
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<GoogleSummary> {
  // Fetch spend+clicks+impressions and conversions in parallel
  // (splitting avoids zeros on days with no conversions suppressing spend data)
  const [spendRows, convRows] = await Promise.all([
    windsorFetch(apiKey, dateFrom, dateTo, "cost,clicks,impressions"),
    windsorFetch(apiKey, dateFrom, dateTo, "conversions,conversion_value"),
  ]);

  let spend = 0;
  let clicks = 0;
  let impressions = 0;
  for (const row of spendRows) {
    spend += parseNum(row.cost);
    clicks += parseNum(row.clicks);
    impressions += parseNum(row.impressions);
  }

  let conversions = 0;
  let convValue = 0;
  for (const row of convRows) {
    conversions += parseNum(row.conversions);
    convValue += parseNum(row.conversion_value);
  }

  const roas = spend > 0 ? convValue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;

  return { spend, conversions, conversion_value: convValue, roas, cpa, clicks, impressions };
}

export async function getGoogleDaily(
  apiKey: string,
  dateFrom: string,
  dateTo: string
): Promise<GoogleDailyRow[]> {
  const [spendRows, convRows] = await Promise.all([
    windsorFetch(apiKey, dateFrom, dateTo, "date,cost,clicks"),
    windsorFetch(apiKey, dateFrom, dateTo, "date,conversions,conversion_value"),
  ]);

  // Build map by date
  const byDate = new Map<string, GoogleDailyRow>();

  for (const row of spendRows) {
    const date = String(row.date ?? "").split("T")[0];
    if (!date) continue;
    if (!byDate.has(date)) {
      byDate.set(date, { date, spend: 0, conversions: 0, conversion_value: 0, clicks: 0 });
    }
    const entry = byDate.get(date)!;
    entry.spend += parseNum(row.cost);
    entry.clicks += parseNum(row.clicks);
  }

  for (const row of convRows) {
    const date = String(row.date ?? "").split("T")[0];
    if (!date) continue;
    if (!byDate.has(date)) {
      byDate.set(date, { date, spend: 0, conversions: 0, conversion_value: 0, clicks: 0 });
    }
    const entry = byDate.get(date)!;
    entry.conversions += parseNum(row.conversions);
    entry.conversion_value += parseNum(row.conversion_value);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
