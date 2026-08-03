export interface Client {
  id: string;
  name: string;
  slug: string;
  meta_account_id: string;
  meta_access_token: string | null;
  client_type: "ecommerce" | "servicios";
  google_ads_account_id: string | null;
  google_ads_access_token: string | null;
  active: boolean;
  created_at: string;
}

export interface ClientThreshold {
  id: string;
  client_id: string;
  roas_min: number;
  cpa_max: number;
  sales_min: number;
  updated_at: string;
}

export interface ClientWithThresholds extends Client {
  client_thresholds: ClientThreshold[];
}
