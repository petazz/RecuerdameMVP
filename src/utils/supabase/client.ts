import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzrdoceqgcmluranqdxe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6cmRvY2VxZ2NtbHVyYW5xZHhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTk1MjUsImV4cCI6MjA3Nzc3NTUyNX0.TyVz-b_-p4qA888ufUfmBItJ8cELtpwvMdx4bT7v5C8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
