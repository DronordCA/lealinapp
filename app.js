const DEFAULT_STATE = {
  comptes: [
    { id: "budget_ca", label: "Budget Canada", devise: "CAD", flag: "🍁" },
    { id: "epargne_ca", label: "Épargne Canada", devise: "CAD", flag: "🍁" },
    { id: "joint_fr", label: "Compte joint FR", devise: "EUR", flag: "🇫🇷" },
    { id: "livret_fr", label: "Livret A", devise: "EUR", flag: "🇫🇷" },
  ],
  ouverture: {
    budget_ca: 2100,
    epargne_ca: 15000,
    joint_fr: 2000,
    livret_fr: 8000,
  },
  depenses: [],
  revenus: [],
  virements: [],
  fixes: [
    { id: 1, nom: "Loyer / Hypothèque", montant: 1500 },
    { id: 2, nom: "Téléphones", montant: 90 },
    { id: 3, nom: "Assurances", montant: 100 },
    { id: 4, nom: "Abonnements", montant: 30 },
    { id: 5, nom: "Chat", montant: 60 },
  ],
  taux: 1.46,
};

const CATEGORIES = [
  "Alimentation",
  "Restaurants",
  "Transport",
  "Santé",
  "Vêtements",
  "Loisirs",
  "Voyages",
  "Sport",
  "Cadeaux",
  "Hygiène",
  "Culture",
  "Divers",
];

const FLAGS = ["🍁", "🇫🇷", "🏦", "💶", "💵", "🏠", "💳", "📈", "🌍", "💰"];

let state = loadState();
let currentView = "home";
let moneyMode = "income";

function loadState() {
  try {
    const raw = localStorage.getItem("budget.app.state");
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem("budget.app.state", JSON.stringify(state));
}

function structuredClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function formatCAD(n) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function formatEUR(n) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function formatByCurrency(n, devise) {
  return devise === "EUR" ? formatEUR(n) : formatCAD(n);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return today().slice(0, 7);
}

function currentMonthLabel() {
  return new Date().toLocaleString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add("hidden"), 1800);
}

function setView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
  document.getElementById(`view-${view}`).classList.add("active");

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

function setMoneyMode(mode) {
  moneyMode = mode;
  document.getElementById("segmentIncome").classList.toggle("active", mode === "income");
  document.getElementById("segmentTransfer").classList.toggle("active", mode === "transfer");
  document.getElementById("incomeCard").classList.toggle("hidden", mode !== "income");
  document.getElementById("transferCard").classList.toggle("hidden", mode !== "transfer");
}

function computeBalances() {
  const balances = { ...state.ouverture };

  state.comptes.forEach((c) => {
    if (balances[c.id] == null) balances[c.id] = 0;
  });

  state.revenus.forEach((r) => {
    balances[r.compte] = (balances[r.compte] || 0) + Number(r.montantNatif || 0);
  });

  state.virements.forEach((v) => {
    balances[v.source] = (balances[v.source] || 0) - Number(v.montant || 0);
    balances[v.dest] = (balances[v.dest] || 0) + Number(v.montant || 0);
  });

  state.depenses.forEach((d) => {
    balances[d.compte] = (balances[d.compte] || 0) - Number(d.montant || 0);
  });

  return balances;
}

function computePatrimoineCAD(balances) {
  return state.comptes.reduce((sum, c) => {
    const solde = Number(balances[c.id] || 0);
    return sum + (c.devise === "EUR" ? solde * Number(state.taux || 1) : solde);
  }, 0);
}

function getBudgetAccountId() {
  return state.comptes.find((c) => c.id === "budget_ca")?.id || state.comptes[0]?.id;
}

function renderHero(balances) {
  const totalCAD = computePatrimoineCAD(balances);
  document.getElementById("heroTotal").textContent = formatCAD(totalCAD);
  document.getElementById("heroTotalEur").textContent = formatEUR(totalCAD / Number(state.taux || 1));
  document.getElementById("heroMonth").textContent = currentMonthLabel();
}

function renderAccounts(balances) {
  const grid = document.getElementById("accountsGrid");
  grid.innerHTML = "";

  state.comptes.forEach((c) => {
    const card = document.createElement("div");
    card.className = "account-card";
    card.innerHTML = `
      <div class="account-emoji">${c.flag}</div>
      <div class="account-label">${escapeHtml(c.label)}</div>
      <div class="account-balance">${formatByCurrency(balances[c.id] || 0, c.devise)}</div>
    `;
    grid.appendChild(card);
  });
}

function renderMonthly() {
  const month = currentMonth();
  const budgetId = getBudgetAccountId();

  const depMois = state.depenses.filter((d) => (d.date || "").startsWith(month));
  const revenusBudget = state.revenus
    .filter((r) => r.compte === budgetId && (r.date || "").startsWith(month))
    .reduce((sum, r) => sum + Number(r.montantCAD || (r.devise === "EUR" ? r.montantNatif * state.taux : r.montantNatif) || 0), 0);

  const virementsVersBudget = state.virements
    .filter((v) => v.dest === budgetId && (v.date || "").startsWith(month))
    .reduce((sum, v) => sum + Number(v.montant || 0), 0);

  const totalReceived = revenusBudget + virementsVersBudget;
  const totalFixed = state.fixes.reduce((sum, f) => sum + Number(f.montant || 0), 0);
  const totalVariable = depMois
    .filter((d) => d.compte === budgetId)
    .reduce((sum, d) => sum + Number(d.montant || 0), 0);

  const solde = totalReceived - totalFixed - totalVariable;

  const balanceEl = document.getElementById("monthlyBalance");
  balanceEl.textContent = formatCAD(solde);
  balanceEl.classList.toggle("negative", solde < 0);

  document.getElementById("monthlyReceived").textContent = formatCAD(totalReceived);
  document.getElementById("monthlyFixed").textContent = formatCAD(totalFixed);
  document.getElementById("monthlyVariable").textContent = formatCAD(totalVariable);

  const categoryBox = document.getElementById("categorySummary");
  categoryBox.innerHTML = "";

  const byCat = {};
  depMois.forEach((d) => {
    if (!d.cat) return;
    byCat[d.cat] = (byCat[d.cat] || 0) + Number(d.montant || 0);
  });

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    categoryBox.innerHTML = `<div class="empty-state">Aucune dépense catégorisée ce mois-ci.</div>`;
  } else {
    entries.forEach(([cat, total]) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      row.innerHTML = `<span>${escapeHtml(cat)}</span><strong>${formatCAD(total)}</strong>`;
      categoryBox.appendChild(row);
    });
  }
}

function renderSelectors() {
  const expenseCategory = document.getElementById("expenseCategory");
  expenseCategory.innerHTML = `<option value="">—</option>` + CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");

  const accountOptions = state.comptes
    .map((c) => `<option value="${c.id}">${c.flag} ${escapeHtml(c.label)}</option>`)
    .join("");

  ["expenseAccount", "incomeAccount", "transferSource", "transferDest"].forEach((id) => {
    const el = document.getElementById(id);
    el.innerHTML = accountOptions;
  });

  if (state.comptes[0]) {
    document.getElementById("expenseAccount").value = state.comptes[0].id;
    document.getElementById("incomeAccount").value = state.comptes[0].id;
    document.getElementById("transferSource").value = state.comptes[0].id;
  }
  if (state.comptes[1]) {
    document.getElementById("transferDest").value = state.comptes[1].id;
  } else if (state.comptes[0]) {
    document.getElementById("transferDest").value = state.comptes[0].id;
  }
}

function renderHistory() {
  let historyCard = document.getElementById("historyCard");
  if (!historyCard) {
    historyCard = document.createElement("section");
    historyCard.id = "historyCard";
    historyCard.className = "card";
    historyCard.innerHTML = `<div class="card-kicker">Dernières opérations</div><div id="historyList" class="history-list"></div>`;
    document.getElementById("view-home").appendChild(historyCard);
  }

  const list = document.getElementById("historyList");
  list.innerHTML = "";

  const items = [
    ...state.depenses.map((x) => ({ ...x, _type: "expense" })),
    ...state.revenus.map((x) => ({ ...x, _type: "income" })),
    ...state.virements.map((x) => ({ ...x, _type: "transfer" })),
  ].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || Number(b.id || 0) - Number(a.id || 0));

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">Aucune opération pour le moment.</div>`;
    return;
  }

  items.slice(0, 12).forEach((item) => {
    const row = document.createElement("div");
    row.className = "history-item";

    let amountText = "";
    let amountClass = "";
    let meta = "";

    if (item._type === "expense") {
      amountText = `-${formatCAD(item.montant)}`;
      amountClass = "expense";
      const compte = state.comptes.find((c) => c.id === item.compte);
      meta = `${item.date || "—"} · ${item.cat || "Sans catégorie"} · ${compte ? compte.label : "Compte"}`;
    } else if (item._type === "income") {
      const amountCad = item.montantCAD || (item.devise === "EUR" ? item.montantNatif * state.taux : item.montantNatif);
      amountText = `+${formatCAD(amountCad)}`;
      amountClass = "income";
      const compte = state.comptes.find((c) => c.id === item.compte);
      meta = `${item.date || "—"} · ${item.devise} · ${compte ? compte.label : "Compte"}`;
    } else {
      amountText = formatCAD(item.montant);
      amountClass = "transfer";
      const source = state.comptes.find((c) => c.id === item.source)?.label || "Source";
      const dest = state.comptes.find((c) => c.id === item.dest)?.label || "Destination";
      meta = `${item.date || "—"} · ${source} → ${dest}`;
    }

    row.innerHTML = `
      <div class="history-top">
        <div class="history-title">${escapeHtml(item.desc || "Sans description")}</div>
        <div class="history-amount ${amountClass}">${amountText}</div>
      </div>
      <div class="history-meta">${escapeHtml(meta)}</div>
    `;
    list.appendChild(row);
  });
}

function renderAccountSettings() {
  const box = document.getElementById("accountsSettings");
  box.innerHTML = "";

  state.comptes.forEach((c) => {
    const wrap = document.createElement("div");
    wrap.className = "account-editor";
    wrap.innerHTML = `
      <div class="account-editor-grid">
        <select data-account-flag="${c.id}">
          ${FLAGS.map((f) => `<option value="${f}" ${c.flag === f ? "selected" : ""}>${f}</option>`).join("")}
        </select>
        <input data-account-label="${c.id}" type="text" value="${escapeAttr(c.label)}" />
        <select data-account-currency="${c.id}">
          <option value="CAD" ${c.devise === "CAD" ? "selected" : ""}>CAD</option>
          <option value="EUR" ${c.devise === "EUR" ? "selected" : ""}>EUR</option>
        </select>
      </div>
      <div style="margin-top: 10px;">
        <label class="field no-margin">
          <span>Solde d'ouverture</span>
          <input data-account-opening="${c.id}" type="number" step="0.01" value="${Number(state.ouverture[c.id] || 0)}" />
        </label>
      </div>
    `;
    box.appendChild(wrap);
  });

  box.querySelectorAll("[data-account-flag]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.dataset.accountFlag;
      const compte = state.comptes.find((x) => x.id === id);
      if (compte) compte.flag = e.target.value;
      saveState();
      render();
    });
  });

  box.querySelectorAll("[data-account-label]").forEach((el) => {
    el.addEventListener("input", (e) => {
      const id = e.target.dataset.accountLabel;
      const compte = state.comptes.find((x) => x.id === id);
      if (compte) compte.label = e.target.value;
      saveState();
      render();
    });
  });

  box.querySelectorAll("[data-account-currency]").forEach((el) => {
    el.addEventListener("change", (e) => {
      const id = e.target.dataset.accountCurrency;
      const compte = state.comptes.find((x) => x.id === id);
      if (compte) compte.devise = e.target.value;
      saveState();
      render();
    });
  });

  box.querySelectorAll("[data-account-opening]").forEach((el) => {
    el.addEventListener("input", (e) => {
      const id = e.target.dataset.accountOpening;
      state.ouverture[id] = Number(e.target.value || 0);
      saveState();
      render();
    });
  });
}

function renderFixedSettings() {
  const box = document.getElementById("fixedCostsList");
  box.innerHTML = "";

  state.fixes.forEach((f) => {
    const wrap = document.createElement("div");
    wrap.className = "fixed-editor";
    wrap.innerHTML = `
      <div class="fixed-editor-grid">
        <input data-fixed-name="${f.id}" type="text" value="${escapeAttr(f.nom)}" />
        <input data-fixed-amount="${f.id}" type="number" step="0.01" value="${Number(f.montant || 0)}" />
        <button class="small-btn" data-fixed-delete="${f.id}">✕</button>
      </div>
    `;
    box.appendChild(wrap);
  });

  box.querySelectorAll("[data-fixed-name]").forEach((el) => {
    el.addEventListener("input", (e) => {
      const id = Number(e.target.dataset.fixedName);
      const row = state.fixes.find((x) => x.id === id);
      if (row) row.nom = e.target.value;
      saveState();
      renderMonthly();
    });
  });

  box.querySelectorAll("[data-fixed-amount]").forEach((el) => {
    el.addEventListener("input", (e) => {
      const id = Number(e.target.dataset.fixedAmount);
      const row = state.fixes.find((x) => x.id === id);
      if (row) row.montant = Number(e.target.value || 0);
      saveState();
      renderMonthly();
    });
  });

  box.querySelectorAll("[data-fixed-delete]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = Number(e.target.dataset.fixedDelete);
      state.fixes = state.fixes.filter((x) => x.id !== id);
      saveState();
      render();
      showToast("Ligne supprimée");
    });
  });
}

function render() {
  const balances = computeBalances();
  renderHero(balances);
  renderAccounts(balances);
  renderMonthly();
  renderSelectors();
  renderHistory();
  renderAccountSettings();
  renderFixedSettings();

  document.getElementById("globalRate").value = Number(state.taux || 1.46);
  document.getElementById("incomeRate").value = Number(state.taux || 1.46);
  document.getElementById("incomeRateField").classList.toggle(
    "hidden",
    document.getElementById("incomeCurrency").value !== "EUR"
  );
}

function clearErrors() {
  ["expenseError", "incomeError", "transferError"].forEach((id) => {
    const el = document.getElementById(id);
    el.textContent = "";
    el.classList.add("hidden");
  });
}

function setError(id, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.classList.remove("hidden");
}

function addExpense() {
  clearErrors();
  const date = document.getElementById("expenseDate").value;
  const desc = document.getElementById("expenseDesc").value.trim();
  const cat = document.getElementById("expenseCategory").value;
  const montant = Number(document.getElementById("expenseAmount").value);
  const compte = document.getElementById("expenseAccount").value;

  if (!desc) return setError("expenseError", "Description requise");
  if (!montant || montant <= 0) return setError("expenseError", "Montant invalide");

  state.depenses.unshift({
    id: Date.now(),
    date,
    desc,
    cat,
    montant,
    compte,
  });

  saveState();
  render();
  showToast("Dépense enregistrée");
  setView("home");

  document.getElementById("expenseDesc").value = "";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expenseCategory").value = "";
}

function addIncome() {
  clearErrors();
  const date = document.getElementById("incomeDate").value;
  const desc = document.getElementById("incomeDesc").value.trim();
  const montant = Number(document.getElementById("incomeAmount").value);
  const devise = document.getElementById("incomeCurrency").value;
  const compte = document.getElementById("incomeAccount").value;
  const taux = Number(document.getElementById("incomeRate").value || state.taux || 1);

  if (!desc) return setError("incomeError", "Description requise");
  if (!montant || montant <= 0) return setError("incomeError", "Montant invalide");

  state.revenus.unshift({
    id: Date.now(),
    date,
    desc,
    montantNatif: montant,
    devise,
    compte,
    taux,
    montantCAD: devise === "EUR" ? montant * taux : montant,
  });

  saveState();
  render();
  showToast("Revenu enregistré");
  setView("home");

  document.getElementById("incomeDesc").value = "";
  document.getElementById("incomeAmount").value = "";
}

function addTransfer() {
  clearErrors();
  const date = document.getElementById("transferDate").value;
  const desc = document.getElementById("transferDesc").value.trim();
  const source = document.getElementById("transferSource").value;
  const dest = document.getElementById("transferDest").value;
  const montant = Number(document.getElementById("transferAmount").value);

  if (!desc) return setError("transferError", "Description requise");
  if (!montant || montant <= 0) return setError("transferError", "Montant invalide");
  if (source === dest) return setError("transferError", "Source et destination identiques");

  state.virements.unshift({
    id: Date.now(),
    date,
    desc,
    source,
    dest,
    montant,
  });

  saveState();
  render();
  showToast("Virement enregistré");
  setView("home");

  document.getElementById("transferDesc").value = "";
  document.getElementById("transferAmount").value = "";
}

function addAccount() {
  const id = `c_${Date.now()}`;
  state.comptes.push({
    id,
    label: "Nouveau compte",
    devise: "CAD",
    flag: "🏦",
  });
  state.ouverture[id] = 0;
  saveState();
  render();
  showToast("Compte ajouté");
}

function addFixed() {
  state.fixes.push({
    id: Date.now(),
    nom: "",
    montant: 0,
  });
  saveState();
  render();
  showToast("Ligne ajoutée");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `budget-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Export JSON téléchargé");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      state = {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
      };
      saveState();
      render();
      showToast("Import réussi");
    } catch {
      showToast("Import impossible");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!window.confirm("Tu veux vraiment tout supprimer ?")) return;
  state = structuredClone(DEFAULT_STATE);
  saveState();
  render();
  showToast("Application réinitialisée");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

function init() {
  document.getElementById("expenseDate").value = today();
  document.getElementById("incomeDate").value = today();
  document.getElementById("transferDate").value = today();

  document.getElementById("incomeCurrency").addEventListener("change", (e) => {
    document.getElementById("incomeRateField").classList.toggle("hidden", e.target.value !== "EUR");
  });

  document.getElementById("segmentIncome").addEventListener("click", () => setMoneyMode("income"));
  document.getElementById("segmentTransfer").addEventListener("click", () => setMoneyMode("transfer"));

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.getElementById("saveExpenseBtn").addEventListener("click", addExpense);
  document.getElementById("saveIncomeBtn").addEventListener("click", addIncome);
  document.getElementById("saveTransferBtn").addEventListener("click", addTransfer);

  document.getElementById("addAccountBtn").addEventListener("click", addAccount);
  document.getElementById("addFixedBtn").addEventListener("click", addFixed);

  document.getElementById("globalRate").addEventListener("input", (e) => {
    state.taux = Number(e.target.value || 1);
    saveState();
    render();
  });

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("importInput").addEventListener("change", importData);
  document.getElementById("resetBtn").addEventListener("click", resetAll);

  setView("home");
  setMoneyMode("income");
  render();
}

init();
