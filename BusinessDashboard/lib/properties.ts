// Flip these by hand when deploying. Uncomment the production line, comment
// the test line. Same pattern as the indigolearn client's Properties.jsx.
const Properties = {
  MODE: "test",

  // This app (Business Dashboard)
  BASE_URL: "http://localhost:3001",
  // BASE_URL: "https://snapdeskbusinessdashboard-chi.vercel.app",

  MENU_BASE_URL: "http://localhost:3000",
  // MENU_BASE_URL: "https://snapdesk-tan.vercel.app",

  DASHBOARD_BASE_URL: "http://localhost:3001",
  // DASHBOARD_BASE_URL: "https://snapdeskbusinessdashboard-chi.vercel.app",

  ADMIN_BASE_URL: "http://localhost:3002",
  // ADMIN_BASE_URL: "https://REPLACE-WITH-ADMIN-URL.vercel.app",

  // Google client id lives in Supabase (Auth → Providers → Google); kept for
  // reference only, the app does not read it.
  GOOGLE_CLIENT_ID: "",
};

export default Properties;
