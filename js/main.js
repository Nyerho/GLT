import { App, showPage, lsLoadOrInit } from "./common.js";
import { initFirebase } from "./firebaseConfig.js";
import { initHome } from "./home.js";
import { initAuthPage } from "./auth.js";
import { initDashboard } from "./dashboard.js";

function setupNavigation() {
  document.getElementById("nav-home")?.addEventListener("click", (e) => { e.preventDefault(); showPage("home"); });
  document.getElementById("nav-auth")?.addEventListener("click", (e) => { e.preventDefault(); showPage("auth"); });
  document.getElementById("nav-dashboard")?.addEventListener("click", (e) => { e.preventDefault(); showPage("dashboard"); });
}

async function bootstrap() {
  // Firebase (optional)
  App.fb = await initFirebase();

  // Initialize local account immediately (will rebind to user if signed in)
  App.account = lsLoadOrInit(App.user?.uid || "local");

  // Pages
  setupNavigation();
  initHome();
  initAuthPage();
  initDashboard();

  // Default route
  showPage("home");
}

document.addEventListener("DOMContentLoaded", bootstrap);