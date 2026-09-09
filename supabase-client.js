(function() {
  const SUPABASE_URL = "https://ocarsylhsyxjqpzidndb.supabase.co";
  const SUPABASE_KEY = "sb_publishable_LTmMKlt5saAsFIlnF87_6A_75FFCvK0";
  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.sb = window.supabaseClient;
    window.dispatchEvent(new Event("supabaseReady"));
  }
})();
