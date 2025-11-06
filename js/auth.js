import { App, showPage } from "./common.js";

function getUsers() {
  try { return JSON.parse(localStorage.getItem("glt_users")) || {}; } catch { return {}; }
}
function setUsers(users) {
  localStorage.setItem("glt_users", JSON.stringify(users));
}
function setCurrentUser(user) {
  localStorage.setItem("glt_current_user", JSON.stringify(user));
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("glt_current_user")); } catch { return null; }
}

export function initAuthPage() {
  const navAuth = document.getElementById("nav-auth");
  navAuth?.addEventListener("click", (e) => { e.preventDefault(); showPage("auth"); });

  const backBtn = document.getElementById("auth-back-home");
  backBtn?.addEventListener("click", () => showPage("home"));

  const loginForm = document.getElementById("login-form");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginAnonBtn = document.getElementById("login-anon");

  const registerForm = document.getElementById("register-form");
  const registerEmail = document.getElementById("register-email");
  const registerPassword = document.getElementById("register-password");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    const res = await loginUser(email, password);
    if (!res.ok) return alert(res.error || "Login failed");
    alert("Logged in successfully");
    showPage("dashboard");
  });

  loginAnonBtn?.addEventListener("click", async () => {
    const res = await loginAnonymous();
    if (!res.ok) return alert(res.error || "Guest login failed");
    alert("Continuing as Guest");
    showPage("dashboard");
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const res = await registerUser(email, password);
    if (!res.ok) return alert(res.error || "Registration failed");
    alert("Account created and logged in");
    showPage("dashboard");
  });

  // Reflect auth in header if Firebase is active
  if (App.fb?.auth && App.fb.onAuthStateChanged) {
    App.fb.onAuthStateChanged(App.fb.auth, (u) => {
      App.user = u ? { uid: u.uid, email: u.email, anon: u.isAnonymous } : null;
      const userEl = document.getElementById("account-user");
      if (userEl) userEl.textContent = u ? (u.email || "Guest") : "-";
    });
  } else {
    const u = getCurrentUser();
    if (u) App.user = u;
  }
}

async function registerUser(email, password) {
  if (App.fb?.auth && App.fb.createUserWithEmailAndPassword) {
    await App.fb.createUserWithEmailAndPassword(App.fb.auth, email, password);
    const u = App.fb.auth.currentUser;
    setCurrentUser({ uid: u?.uid, email: u?.email });
    return { ok: true, provider: "firebase" };
  } else {
    const users = getUsers();
    if (users[email]) return { ok: false, error: "Email already registered" };
    users[email] = { password };
    setUsers(users);
    setCurrentUser({ email });
    App.user = { email };
    return { ok: true, provider: "local" };
  }
}
async function loginUser(email, password) {
  if (App.fb?.auth && App.fb.signInWithEmailAndPassword) {
    await App.fb.signInWithEmailAndPassword(App.fb.auth, email, password);
    const u = App.fb.auth.currentUser;
    setCurrentUser({ uid: u?.uid, email: u?.email });
    App.user = { uid: u?.uid, email: u?.email };
    return { ok: true, provider: "firebase" };
  } else {
    const users = getUsers();
    if (!users[email] || users[email].password !== password) {
      return { ok: false, error: "Invalid email or password" };
    }
    setCurrentUser({ email });
    App.user = { email };
    return { ok: true, provider: "local" };
  }
}
async function loginAnonymous() {
  if (App.fb?.auth && App.fb.signInAnonymously) {
    await App.fb.signInAnonymously(App.fb.auth);
    const u = App.fb.auth.currentUser;
    setCurrentUser({ uid: u?.uid, anon: true });
    App.user = { uid: u?.uid, anon: true };
    return { ok: true, provider: "firebase" };
  } else {
    setCurrentUser({ email: "guest@glt.local", anon: true });
    App.user = { email: "guest@glt.local", anon: true };
    return { ok: true, provider: "local" };
  }
}