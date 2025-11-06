import { showPage } from "./common.js";

export function initHome() {
  const homeLogin = document.getElementById("home-login");
  const homeRegister = document.getElementById("home-register");
  homeLogin?.addEventListener("click", (e) => { e.preventDefault(); showPage("auth"); });
  homeRegister?.addEventListener("click", (e) => { e.preventDefault(); showPage("auth"); });

  const navHome = document.getElementById("nav-home");
  navHome?.addEventListener("click", (e) => { e.preventDefault(); showPage("home"); });
}