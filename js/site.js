// Shared site logic for multi-page prototype (keeps SPA intact)
const LS_USER = "glt_user";
const LS_ACCOUNT = "glt_account";
const LS_TX = "glt_transactions";

function formatCurrency(n) {
  try { return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }); }
  catch { return `$${Number(n).toFixed(2)}`; }
}

function loadUser() {
  const raw = localStorage.getItem(LS_USER);
  return raw ? JSON.parse(raw) : null;
}
function saveUser(user) {
  localStorage.setItem(LS_USER, JSON.stringify(user));
}
function ensureAccount() {
  const raw = localStorage.getItem(LS_ACCOUNT);
  if (raw) return JSON.parse(raw);
  const initial = { balance: 1000, inTrade: 0, pnl: 0, holdings: {}, updatedAt: Date.now() };
  localStorage.setItem(LS_ACCOUNT, JSON.stringify(initial));
  return initial;
}
function saveAccount(acc) {
  localStorage.setItem(LS_ACCOUNT, JSON.stringify({ ...acc, updatedAt: Date.now() }));
}
function addTransaction(type, amount, status, ref = "") {
  const raw = localStorage.getItem(LS_TX);
  const list = raw ? JSON.parse(raw) : [];
  list.unshift({
    date: new Date().toISOString(),
    type, amount, status, ref,
    id: Math.random().toString(36).slice(2, 10),
  });
  localStorage.setItem(LS_TX, JSON.stringify(list));
}
function getTransactions() {
  const raw = localStorage.getItem(LS_TX);
  return raw ? JSON.parse(raw) : [];
}

/* Page initializers (each page checks for its own markers) */
function initDashboardPage() {
  const balanceEl = document.getElementById("dash-balance");
  if (!balanceEl) return;
  const acc = ensureAccount();
  document.getElementById("dash-balance").textContent = formatCurrency(acc.balance);
  document.getElementById("dash-intrade").textContent = formatCurrency(acc.inTrade || 0);
  document.getElementById("dash-pnl").textContent = formatCurrency(acc.pnl || 0);
}
function initDepositPage() {
  const form = document.getElementById("deposit-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("deposit-amount").value || 0);
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
    const acc = ensureAccount();
    acc.balance = Number((acc.balance + amount).toFixed(2));
    saveAccount(acc);
    addTransaction("Deposit", amount, "Completed");
    alert("Deposit recorded successfully.");
    location.href = "dashboard.html";
  });
}
function initWithdrawPage() {
  const form = document.getElementById("withdraw-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById("withdraw-amount").value || 0);
    const acc = ensureAccount();
    if (!Number.isFinite(amount) || amount <= 0) return alert("Enter a valid amount.");
    if (amount > acc.balance) return alert("Insufficient balance.");
    acc.balance = Number((acc.balance - amount).toFixed(2));
    saveAccount(acc);
    addTransaction("Withdraw", amount, "Processing");
    alert("Withdrawal request submitted.");
    location.href = "history.html";
  });
}
function initHistoryPage() {
  const tbody = document.getElementById("tx-tbody");
  if (!tbody) return;
  const txs = getTransactions();
  tbody.innerHTML = txs.length
    ? txs.map(t => `
      <tr>
        <td>${new Date(t.date).toLocaleString()}</td>
        <td>${t.type}</td>
        <td>${formatCurrency(t.amount)}</td>
        <td>${t.status}</td>
        <td>${t.ref || t.id}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="text-center text-muted">No transactions yet</td></tr>`;
}
function initProfilePage() {
  const form = document.getElementById("profile-form");
  if (!form) return;
  const user = loadUser() || { email: "", username: "", country: "" };
  document.getElementById("p-email").value = user.email || "";
  document.getElementById("p-username").value = user.username || "";
  document.getElementById("p-country").value = user.country || "";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = {
      email: document.getElementById("p-email").value.trim(),
      username: document.getElementById("p-username").value.trim(),
      country: document.getElementById("p-country").value.trim(),
    };
    saveUser(next);
    alert("Profile updated.");
  });
}
function initAuthPages() {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();
      if (!email || password.length < 6) return alert("Invalid credentials.");
      saveUser({ email, username: email.split("@")[0] });
      location.href = "dashboard.html";
    });
  }
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("register-email").value.trim();
      const username = document.getElementById("register-username").value.trim();
      const password = document.getElementById("register-password").value.trim();
      const country = document.getElementById("register-country").value.trim();
      if (!email || !username || password.length < 6) return alert("Please fill all fields correctly.");
      saveUser({ email, username, country });
      ensureAccount(); // create account storage if missing
      alert("Account created. Redirecting to Dashboard...");
      location.href = "dashboard.html";
    });
  }
  const forgotForm = document.getElementById("forgot-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email").value.trim();
      if (!email) return alert("Enter your email.");
      alert("If this email exists, a reset link has been sent.");
      location.href = "login.html";
    });
  }
}

/* Markets page: switch advanced chart symbol */
// Remove the unused Markets page embed function and its initializer
// DELETE this whole function:
// (Deleted) function initMarketsPage() { /* entire function removed */ }

/* Kick off initializers on page load */
document.addEventListener("DOMContentLoaded", () => {
  ensureAccount(); // make sure we have a base account
  initDashboardPage();
  initDepositPage();
  initWithdrawPage();
  initHistoryPage();
  initProfilePage();
  initAuthPages();
  // DELETE: initMarketsPage();
});