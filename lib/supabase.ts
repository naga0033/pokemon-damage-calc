import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Supabaseクライアント（ブラウザ用シングルトン） */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
