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
      if (!email || password.length < 6) {
        alert("Invalid credentials. Please check your email and password.");
        return;
      }
      const remember = document.getElementById("login-remember")?.checked;
      const user = loadUser() || {};
      const next = { ...user, email, username: user.username || email.split("@")[0] };
      saveUser(next);
      alert("Login successful. Redirecting…");
      location.href = "dashboard.html";
    });
  }
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    populateCountriesDatalist();
    populateCurrenciesDatalist();
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
        first, last, username, email, phone, country, city, address,
        dob, nationality, idType, idNumber, employment, sof, experience, risk,
        objective, currency, income, networth, pep, kyc, aml
      };
      saveUser(profile);
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