import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://isyiezsprectyxztokkk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzeWllenNwcmVjdHl4enRva2trIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjEzODEsImV4cCI6MjA4OTQzNzM4MX0.dHc8oQYv8YfQ9qItQTKShFyPo2MAbwh6MHBJO6JpQ8U";

export const supabase = createClient(supabaseUrl, supabaseKey);
