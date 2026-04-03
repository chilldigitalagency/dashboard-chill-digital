export interface Profile {
  id: string;
  full_name: string | null;
  role: "admin" | "operator";
  created_at: string;
}

export interface ProfileWithEmail extends Profile {
  email: string;
}
