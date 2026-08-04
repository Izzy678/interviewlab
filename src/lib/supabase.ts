import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://edbytsuykbezfvniwdyd.supabase.co";
const supabaseAnonKey =
  "sb_publishable_R3rt7ZfSl9rfL6_L0mWPbA_SpxFRqh1";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);