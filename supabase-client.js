window.SUPABASE_URL = "https://ocarsylhsyxjqpzidndb.supabase.co";
window.SUPABASE_KEY = "sb_publishable_LTmMKlt5saAsFIlnF87_6A_75FFCvK0";
(function() {
  if (window.supabase && !window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    window.sb = window.supabaseClient;
    window.dispatchEvent(new Event("supabaseReady"));
  }
})();
