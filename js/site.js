// Shared site logic for multi-page prototype (keeps SPA intact)
const LS_USER = "glt_user";
const LS_ACCOUNT = "glt_account";
const LS_TX = "glt_transactions";
const LS_USERS = "glt_users"; // registry of all users
const ADMIN_EMAILS = ["admin@globalonlinetrading.local"];

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
    // Only run on dashboard page when its elements are present
    const balanceEl = document.getElementById("dash-balance");
    if (!balanceEl) return;

    // Auth gate: redirect if not logged in
    const user = loadUser();
    const isAuthed = !!user && (!!user.email || !!user.username || !!user.uid);
    if (!isAuthed) {
        alert("Please login to access your Dashboard.");
        location.href = "login.html";
        return;
    }

    const acc = ensureAccount();
    document.getElementById("dash-balance").textContent = formatCurrency(acc.balance);
    document.getElementById("dash-intrade").textContent = formatCurrency(acc.inTrade || 0);
    document.getElementById("dash-pnl").textContent = formatCurrency(acc.pnl || 0);
}
function initDepositPage() {
  const form = document.getElementById("deposit-form");
  if (!form) return;

  // Initialize balance display
  const acc = ensureAccount();
  const balanceEl = document.getElementById("current-balance");
  if (balanceEl) balanceEl.textContent = formatCurrency(acc.balance);

  const amountEl = document.getElementById("deposit-amount");
  const methodRadios = Array.from(document.querySelectorAll('input[name="deposit-method"]'));
  const hintEl = document.getElementById("method-hint");
  const sumAmountEl = document.getElementById("sum-amount");
  const sumFeeEl = document.getElementById("sum-fee");
  const sumTotalEl = document.getElementById("sum-total");

  const methodHints = {
    crypto: "Network fee applies; speed varies by network.",
    card: "Instant deposit. Processing fee applies.",
    bank: "May take 1–3 business days. Minimal bank processing fee applies."
  };

  const calcFee = (method, amt) => {
    if (!Number.isFinite(amt) || amt <= 0) return 0;
    switch (method) {
      case "card": return Number((amt * 0.025).toFixed(2));        // 2.5%
      case "bank": return Number(Math.min(amt * 0.01, 25).toFixed(2)); // 1% up to $25 cap
      case "crypto": return Number(Math.max(amt * 0.005, 1).toFixed(2)); // 0.5% or $1 minimum
      default: return 0;
    }
  };

  const activeMethod = () => {
    const checked = methodRadios.find(r => r.checked);
    return checked ? checked.value : "crypto";
  };

  const renderSummary = () => {
    const amt = Number(amountEl.value || 0);
    const method = activeMethod();
    const fee = calcFee(method, amt);
    const total = Number((amt + fee).toFixed(2));
    sumAmountEl.textContent = formatCurrency(amt);
    sumFeeEl.textContent = formatCurrency(fee);
    sumTotalEl.textContent = formatCurrency(total);
    if (hintEl) hintEl.textContent = methodHints[method] || "";
  };

  methodRadios.forEach(r => r.addEventListener("change", renderSummary));
  amountEl.addEventListener("input", renderSummary);
  Array.from(document.querySelectorAll(".qa")).forEach(btn => {
    btn.addEventListener("click", () => {
      const v = Number(btn.getAttribute("data-amt") || 0);
      if (v > 0) {
        amountEl.value = String(v);
        renderSummary();
      }
    });
  });

  renderSummary();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amt = Number(amountEl.value || 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast("Enter a valid amount (greater than 0).", "error");
      return;
    }
    const method = activeMethod();
    const fee = calcFee(method, amt);
    const ref = "DEP-" + Date.now().toString(36).toUpperCase();

    const accNow = ensureAccount();
    accNow.balance = Number((accNow.balance + amt).toFixed(2));
    saveAccount(accNow);
    addTransaction("Deposit", amt, "Completed", ref);

    showToast(`Deposit of ${formatCurrency(amt)} recorded. Ref: ${ref}`, "success");
    setTimeout(() => { location.href = "dashboard.html"; }, 800);
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
function populateCurrenciesDatalist() {
  const dl = document.getElementById("currencies");
  if (!dl) return;
  const currencies = [
    "USD - US Dollar","EUR - Euro","GBP - British Pound","NGN - Nigerian Naira","JPY - Japanese Yen","CAD - Canadian Dollar","AUD - Australian Dollar","CHF - Swiss Franc","CNY - Chinese Yuan","HKD - Hong Kong Dollar",
    "SGD - Singapore Dollar","NZD - New Zealand Dollar","ZAR - South African Rand","BRL - Brazilian Real","INR - Indian Rupee","RUB - Russian Ruble","TRY - Turkish Lira","MXN - Mexican Peso","KRW - South Korean Won","SEK - Swedish Krona",
    "NOK - Norwegian Krone","DKK - Danish Krone","PLN - Polish Zloty","HUF - Hungarian Forint","CZK - Czech Koruna","AED - UAE Dirham","SAR - Saudi Riyal","QAR - Qatari Riyal","KWD - Kuwaiti Dinar","BHD - Bahraini Dinar",
    "OMR - Omani Rial","THB - Thai Baht","MYR - Malaysian Ringgit","IDR - Indonesian Rupiah","PHP - Philippine Peso","VND - Vietnamese Dong","PKR - Pakistani Rupee","BDT - Bangladeshi Taka","LKR - Sri Lankan Rupee","NPR - Nepalese Rupee",
    "EGP - Egyptian Pound","DZD - Algerian Dinar","TND - Tunisian Dinar","MAD - Moroccan Dirham","GHS - Ghanaian Cedi","KES - Kenyan Shilling","UGX - Ugandan Shilling","TZS - Tanzanian Shilling","RWF - Rwandan Franc","ETB - Ethiopian Birr",
    "XOF - West African CFA Franc","XAF - Central African CFA Franc","XPF - CFP Franc","UAH - Ukrainian Hryvnia","RON - Romanian Leu","BGN - Bulgarian Lev","HRK - Croatian Kuna","RSD - Serbian Dinar","ISK - Icelandic Krona","MDL - Moldovan Leu",
    "GEL - Georgian Lari","AZN - Azerbaijani Manat","AMD - Armenian Dram","KZT - Kazakhstani Tenge","UZS - Uzbekistani Som","TJS - Tajikistani Somoni","KGS - Kyrgyzstani Som","BYN - Belarusian Ruble","ILS - Israeli New Shekel","JOD - Jordanian Dinar",
    "LBP - Lebanese Pound","IQD - Iraqi Dinar","IRR - Iranian Rial","AFN - Afghan Afghani","SYP - Syrian Pound","YER - Yemeni Rial","MNT - Mongolian Tugrik","MOP - Macanese Pataca","TWD - New Taiwan Dollar","KHR - Cambodian Riel",
    "LAK - Lao Kip","MMK - Burmese Kyat","BND - Brunei Dollar","BWP - Botswana Pula","ZMW - Zambian Kwacha","MWK - Malawian Kwacha","MZN - Mozambican Metical","AOA - Angolan Kwanza","NAD - Namibian Dollar","BBD - Barbadian Dollar",
    "TTD - Trinidad and Tobago Dollar","JMD - Jamaican Dollar","DOP - Dominican Peso","PEN - Peruvian Sol","ARS - Argentine Peso","CLP - Chilean Peso","COP - Colombian Peso","UYU - Uruguayan Peso","PYG - Paraguayan Guarani","BOB - Boliviano",
    "VES - Venezuelan Bolívar","CRC - Costa Rican Colón","GTQ - Guatemalan Quetzal","HNL - Honduran Lempira","NIO - Nicaraguan Córdoba","SVC - Salvadoran Colón","BSD - Bahamian Dollar","BZD - Belize Dollar","GYD - Guyanese Dollar","SRD - Surinamese Dollar"
  ];
  dl.innerHTML = currencies.map(c => `<option value="${c}"></option>`).join("");
}
function initAuthPages() {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value.trim();
      if (!email || password.length < 6) return alert("Invalid credentials. Please check your email and password.");

      // Validate against registry if exists
      const regUser = findUserByEmail(email);
      if (regUser) {
        if ((regUser.password || "") !== password) return alert("Invalid email or password.");
        // Seed admin role if email matches ADMIN_EMAILS
        const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? "admin" : (regUser.role || "user");
        const current = { ...regUser, role };
        saveUser(current);
      } else {
        // Fallback legacy: allow login and create session (no registry) - prototype behavior
        saveUser({ email, username: email.split("@")[0], role: ADMIN_EMAILS.includes(email.toLowerCase()) ? "admin" : "user" });
      }
      alert("Login successful. Redirecting…");
      location.href = "dashboard.html";
    });
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    // Populate assistive lists
    if (typeof populateCountriesDatalist === "function") populateCountriesDatalist();
    if (typeof populateCurrenciesDatalist === "function") populateCurrenciesDatalist();

    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const first = document.getElementById("register-first").value.trim();
      const last = document.getElementById("register-last").value.trim();
      const username = document.getElementById("register-username").value.trim();
      const email = document.getElementById("register-email").value.trim();
      const password = document.getElementById("register-password").value.trim();
      const phone = document.getElementById("register-phone").value.trim();
      const country = document.getElementById("register-country").value.trim();
      const city = document.getElementById("register-city").value.trim();
      const address = document.getElementById("register-address").value.trim();
      const dob = document.getElementById("register-dob").value;
      const nationality = document.getElementById("register-nationality").value.trim();
      const idType = document.getElementById("register-idtype").value;
      const idNumber = document.getElementById("register-idnumber").value.trim();
      const employment = document.getElementById("register-employment").value;
      const sof = document.getElementById("register-sof").value;
      const experience = document.getElementById("register-experience").value;
      const risk = document.getElementById("register-risk").value;
      const objective = document.getElementById("register-objective").value;
      const currency = document.getElementById("register-currency").value.trim();
      const income = document.getElementById("register-income").value;
      const networth = document.getElementById("register-networth").value;
      const pep = document.getElementById("register-pep").checked;
      const kyc = document.getElementById("register-kyc").checked;
      const aml = document.getElementById("register-aml").checked;
      const terms = document.getElementById("register-terms").checked;

      if (!first || !last || !username || !email || password.length < 6 || !phone || !country || !city || !address ||
          !dob || !nationality || !idType || !idNumber || !employment || !sof || !experience || !risk ||
          !objective || !currency || !income || !networth || !kyc || !aml || !terms) {
        alert("Please complete all required fields and accept the necessary agreements.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Please enter a valid email address.");
        return;
      }

      const profile = {
        first, last, username, email, password, phone, country, city, address,
        dob, nationality, idType, idNumber, employment, sof, experience, risk,
        objective, currency, income, networth, pep, kyc, aml, role: "user"
      };
      const res = addUserToRegistry(profile);
      if (!res.ok) return alert(res.error || "Registration failed.");

      // Set current session
      saveUser(res.user);
      ensureAccount();
      alert("Registration successful. Redirecting to Dashboard…");
      location.href = "dashboard.html";
    });
  }

  const forgotForm = document.getElementById("forgot-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email").value.trim();
      if (!email) return alert("Enter your email to receive a reset link.");
      alert("If this email exists, a reset link has been sent.");
      location.href = "login.html";
    });
  }
}

// Admin page initializer and CRUD
function initAdminPage() {
  const tbody = document.getElementById("admin-users-tbody");
  if (!tbody) return; // only run on admin page

  // Gate: must be logged in and admin
  const current = loadUser();
  const authed = !!current && (!!current.email || !!current.username || !!current.uid);
  const isAdmin = authed && ((current.role === "admin") || ADMIN_EMAILS.includes((current.email || "").toLowerCase()));
  if (!authed) {
    alert("Please login to access Admin.");
    location.href = "login.html";
    return;
  }
  if (!isAdmin) {
    alert("Admin access required.");
    location.href = "dashboard.html";
    return;
  }

  const render = () => {
    const list = getUsersRegistry();
    tbody.innerHTML = list.length
      ? list.map((u, idx) => `
        <tr data-id="${u.id}">
          <td>${idx + 1}</td>
          <td>${(u.first || "")} ${(u.last || "")}</td>
          <td>${u.email || ""}</td>
          <td>${u.username || ""}</td>
          <td>${u.phone || ""}</td>
          <td>${u.country || ""}</td>
          <td><span class="badge ${u.role === "admin" ? "text-bg-success" : "text-bg-secondary"}">${u.role || "user"}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-success admin-edit">Edit</button>
            <button class="btn btn-sm btn-outline-danger admin-delete">Delete</button>
          </td>
        </tr>
      `).join("")
      : `<tr><td colspan="8" class="text-center text-muted">No users found</td></tr>`;
  };

  // Modal helpers
  const modalEl = document.getElementById("admin-user-modal");
  const modal = new bootstrap.Modal(modalEl);
  const form = document.getElementById("admin-user-form");
  const setFormValues = (u) => {
    document.getElementById("admin-user-id").value = u?.id || "";
    document.getElementById("admin-first").value = u?.first || "";
    document.getElementById("admin-last").value = u?.last || "";
    document.getElementById("admin-email").value = u?.email || "";
    document.getElementById("admin-username").value = u?.username || "";
    document.getElementById("admin-phone").value = u?.phone || "";
    document.getElementById("admin-country").value = u?.country || "";
    document.getElementById("admin-role").value = u?.role || "user";
    document.getElementById("admin-password").value = "";
  };

  // Create new user
  document.getElementById("admin-create-user").addEventListener("click", () => {
    setFormValues({ role: "user" });
    document.getElementById("admin-user-modal-title").textContent = "Create User";
    modal.show();
  });

  // Edit existing user
  tbody.addEventListener("click", (e) => {
    const rowBtn = e.target.closest("button");
    const row = e.target.closest("tr");
    if (!row || !rowBtn) return;
    const id = row.getAttribute("data-id");
    if (rowBtn.classList.contains("admin-edit")) {
      const u = getUsersRegistry().find(x => x.id === id);
      if (!u) return;
      setFormValues(u);
      document.getElementById("admin-user-modal-title").textContent = "Edit User";
      modal.show();
    } else if (rowBtn.classList.contains("admin-delete")) {
      if (confirm("Delete this user?")) {
        deleteUserFromRegistry(id);
        // If deleting the current session user, clear session
        const cur = loadUser();
        if (cur && cur.id === id) saveUser(null);
        render();
      }
    }
  });

  // Save create/edit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("admin-user-id").value;
    const first = document.getElementById("admin-first").value.trim();
    const last = document.getElementById("admin-last").value.trim();
    const email = document.getElementById("admin-email").value.trim();
    const username = document.getElementById("admin-username").value.trim();
    const phone = document.getElementById("admin-phone").value.trim();
    const country = document.getElementById("admin-country").value.trim();
    const role = document.getElementById("admin-role").value;
    const password = document.getElementById("admin-password").value.trim();

    if (!first || !last || !email || !username) {
      alert("Please fill required fields (first, last, email, username).");
      return;
    }
    if (!id) {
      // Create
      const res = addUserToRegistry({ first, last, email, username, phone, country, role, password });
      if (!res.ok) return alert(res.error || "Could not create user.");
    } else {
      // Update
      const updates = { first, last, email, username, phone, country, role };
      if (password) updates.password = password;
      const res = updateUserInRegistry(id, updates);
      if (!res.ok) return alert(res.error || "Could not update user.");
      // Keep session in sync if editing current user
      const cur = loadUser();
      if (cur && cur.id === id) saveUser({ ...cur, ...res.user });
    }
    modal.hide();
    render();
  });

  // Initial render
  render();
}

/* Markets page: switch advanced chart symbol */
// Remove the unused Markets page embed function and its initializer
// DELETE this whole function:
// (Deleted) function initMarketsPage() { /* entire function removed */ }

/* Header UI: KYC indicator + theme toggle */
function initHeaderUI() {
  // KYC indicator status from localStorage
  const indicatorEl = document.getElementById("kyc-indicator");
  if (indicatorEl) {
    const status = (localStorage.getItem("kycStatus") || "pending").toLowerCase();
    indicatorEl.classList.remove("kyc-started", "kyc-pending", "kyc-verified");
    const normalized = ["started", "pending", "verified"].includes(status) ? status : "pending";
    indicatorEl.classList.add(`kyc-${normalized}`);
    const label = indicatorEl.querySelector(".kyc-label");
    if (label) label.textContent = `KYC: ${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }

  // Theme toggle (persisted via localStorage) + login visibility based on auth
  const user = loadUser();
  const isAuthed = !!user && (!!user.email || !!user.username || !!user.uid);

  const toggle = document.getElementById("theme-toggle");
  const loginLink = document.getElementById("login-link");
  if (toggle) {
    // Show toggle only when authenticated
    toggle.classList.toggle("d-none", !isAuthed);
  }
  if (loginLink) {
    // Show Login only when NOT authenticated
    loginLink.classList.toggle("d-none", isAuthed);
  }

  const themeIcon = toggle?.querySelector(".theme-icon");
  const applyTheme = (mode) => {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("theme", mode);
    if (themeIcon) themeIcon.textContent = mode === "light" ? "☀️" : "🌙";
  };
  const initialTheme = localStorage.getItem("theme") || "dark";
  applyTheme(initialTheme);
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = (localStorage.getItem("theme") === "light") ? "dark" : "light";
      applyTheme(next);
    });
  }

  // KYC indicator status update remains (on pages that include it)
  const indicator = document.getElementById("kyc-indicator");
  if (indicator) {
    const status = (localStorage.getItem("kycStatus") || "pending").toLowerCase();
    indicator.classList.remove("kyc-started", "kyc-pending", "kyc-verified");
    const normalized = ["started", "pending", "verified"].includes(status) ? status : "pending";
    indicator.classList.add(`kyc-${normalized}`);
    const label = indicator.querySelector(".kyc-label");
    if (label) label.textContent = `KYC: ${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
  }
}

/* Kick off initializers on page load */
document.addEventListener("DOMContentLoaded", () => {
  ensureAccount(); // make sure we have a base account
  ensureToastContainer(); // make sure toast region exists
  initDashboardPage();
  initDepositPage();
  initWithdrawPage();
  initHistoryPage();
  initProfilePage();
  initAuthPages();
  // DELETE: initMarketsPage();
  // Initialize header UI last so it can attach to header elements
  initHeaderUI();

  // Build WhatsApp link
  const fab = document.getElementById("whatsapp-fab");
  if (fab) {
    const phone = (fab.getAttribute("data-phone") || "").replace(/\D/g, "");
    const text = encodeURIComponent("Hello! I need assistance with my account on GlobalOnlineTrading.");
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    fab.setAttribute("href", url);
  }
});

function getUsersRegistry() {
  const raw = localStorage.getItem(LS_USERS);
  return raw ? JSON.parse(raw) : [];
}
function saveUsersRegistry(list) {
  localStorage.setItem(LS_USERS, JSON.stringify(list));
}
function findUserByEmail(email) {
  const list = getUsersRegistry();
  return list.find(u => (u.email || "").toLowerCase() === (email || "").toLowerCase());
}
function addUserToRegistry(profile) {
  const list = getUsersRegistry();
  if (findUserByEmail(profile.email)) return { ok: false, error: "Email already registered" };
  const id = Math.random().toString(36).slice(2, 10);
  const next = { id, role: "user", ...profile };
  list.push(next);
  saveUsersRegistry(list);
  return { ok: true, user: next };
}
function updateUserInRegistry(id, updates) {
  const list = getUsersRegistry();
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) return { ok: false, error: "User not found" };
  list[idx] = { ...list[idx], ...updates };
  saveUsersRegistry(list);
  return { ok: true, user: list[idx] };
}
function deleteUserFromRegistry(id) {
  const list = getUsersRegistry();
  const next = list.filter(u => u.id !== id);
  saveUsersRegistry(next);
  return { ok: true };
}

// Utility: toasts for user feedback
function ensureToastContainer() {
  if (document.getElementById("toast-container")) return;
  const wrap = document.createElement("div");
  wrap.id = "toast-container";
  wrap.className = "toast-container position-fixed bottom-0 end-0 p-3";
  document.body.appendChild(wrap);
}
function showToast(message, type = "success") {
  ensureToastContainer();
  const wrap = document.getElementById("toast-container");
  const toastEl = document.createElement("div");
  const bg = type === "error" ? "text-bg-danger" : (type === "warning" ? "text-bg-warning" : "text-bg-success");
  toastEl.className = `toast align-items-center ${bg} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
  wrap.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 2500 });
  toast.show();
}