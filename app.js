const STORAGE_KEY = 'budget-couple-app-v1';

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createDefaultState() {
  return {
    settings: {
      exchangeRate: 1.47,
      displayCurrency: 'CAD',
    },
    accounts: [
      {
        id: createId(),
        name: 'Compte Canada',
        country: 'Canada',
        currency: 'CAD',
        openingBalance: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: createId(),
        name: 'Compte France',
        country: 'France',
        currency: 'EUR',
        openingBalance: 0,
        createdAt: new Date().toISOString(),
      },
    ],
    expenses: [],
    incomes: [],
    transfers: [],
    fixedExpenses: [],
  };
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

const DEFAULT_STATE = createDefaultState();

const state = loadState();
const ui = {
  selectedMonth: getCurrentMonth(),
  activeTab: 'comptes',
};

const refs = {
  toast: document.getElementById('toast'),
  monthInput: document.getElementById('selected-month'),
  metrics: document.getElementById('dashboard-metrics'),
  accountsOverview: document.getElementById('accounts-overview'),
  accountsList: document.getElementById('accounts-list'),
  expensesList: document.getElementById('expenses-list'),
  incomesList: document.getElementById('incomes-list'),
  transfersList: document.getElementById('transfers-list'),
  fixedList: document.getElementById('fixed-list'),
  exportButton: document.getElementById('export-button'),
  importInput: document.getElementById('import-input'),
  resetButton: document.getElementById('reset-button'),
  tabButtons: [...document.querySelectorAll('.tab-button')],
  panels: [...document.querySelectorAll('.tab-panel')],
  settingsForm: document.getElementById('settings-form'),
  exchangeRateInput: document.getElementById('exchange-rate'),
  displayCurrencyInput: document.getElementById('display-currency'),
};

const forms = {
  account: {
    element: document.getElementById('account-form'),
    title: document.getElementById('account-form-title'),
    cancel: document.getElementById('cancel-account-edit'),
    id: document.getElementById('account-id'),
    name: document.getElementById('account-name'),
    country: document.getElementById('account-country'),
    currency: document.getElementById('account-currency'),
    openingBalance: document.getElementById('account-opening-balance'),
  },
  expense: {
    element: document.getElementById('expense-form'),
    title: document.getElementById('expense-form-title'),
    cancel: document.getElementById('cancel-expense-edit'),
    id: document.getElementById('expense-id'),
    date: document.getElementById('expense-date'),
    description: document.getElementById('expense-description'),
    amount: document.getElementById('expense-amount'),
    accountId: document.getElementById('expense-account'),
    category: document.getElementById('expense-category'),
  },
  income: {
    element: document.getElementById('income-form'),
    title: document.getElementById('income-form-title'),
    cancel: document.getElementById('cancel-income-edit'),
    id: document.getElementById('income-id'),
    date: document.getElementById('income-date'),
    description: document.getElementById('income-description'),
    amount: document.getElementById('income-amount'),
    currency: document.getElementById('income-currency'),
    accountId: document.getElementById('income-account'),
  },
  transfer: {
    element: document.getElementById('transfer-form'),
    title: document.getElementById('transfer-form-title'),
    cancel: document.getElementById('cancel-transfer-edit'),
    id: document.getElementById('transfer-id'),
    date: document.getElementById('transfer-date'),
    sourceAccountId: document.getElementById('transfer-source'),
    destinationAccountId: document.getElementById('transfer-destination'),
    amount: document.getElementById('transfer-amount'),
    description: document.getElementById('transfer-description'),
  },
  fixed: {
    element: document.getElementById('fixed-form'),
    title: document.getElementById('fixed-form-title'),
    cancel: document.getElementById('cancel-fixed-edit'),
    id: document.getElementById('fixed-id'),
    description: document.getElementById('fixed-description'),
    amount: document.getElementById('fixed-amount'),
    currency: document.getElementById('fixed-currency'),
    category: document.getElementById('fixed-category'),
  },
};

initialize();

function initialize() {
  setDefaultDates();
  bindEvents();
  refs.monthInput.value = ui.selectedMonth;
  refs.exchangeRateInput.value = state.settings.exchangeRate;
  refs.displayCurrencyInput.value = state.settings.displayCurrency;
  renderAll();
}

function bindEvents() {
  refs.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  refs.monthInput.addEventListener('change', (event) => {
    ui.selectedMonth = event.target.value || getCurrentMonth();
    renderDashboard();
  });

  refs.exportButton.addEventListener('click', exportData);
  refs.importInput.addEventListener('change', importData);
  refs.resetButton.addEventListener('click', resetApp);

  refs.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.settings.exchangeRate = clampPositiveNumber(refs.exchangeRateInput.value, state.settings.exchangeRate);
    state.settings.displayCurrency = refs.displayCurrencyInput.value === 'EUR' ? 'EUR' : 'CAD';
    persistAndRender('Réglages sauvegardés.');
  });

  forms.account.element.addEventListener('submit', handleAccountSubmit);
  forms.expense.element.addEventListener('submit', handleExpenseSubmit);
  forms.income.element.addEventListener('submit', handleIncomeSubmit);
  forms.transfer.element.addEventListener('submit', handleTransferSubmit);
  forms.fixed.element.addEventListener('submit', handleFixedSubmit);

  Object.values(forms).forEach((formGroup) => {
    formGroup.cancel.addEventListener('click', () => resetForm(formGroup));
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();

    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    console.warn('Impossible de charger les données locales, retour à l’état par défaut.', error);
    return createDefaultState();
  }
}

function normalizeState(input) {
  const safe = createDefaultState();
  safe.settings.exchangeRate = clampPositiveNumber(input?.settings?.exchangeRate, DEFAULT_STATE.settings.exchangeRate);
  safe.settings.displayCurrency = input?.settings?.displayCurrency === 'EUR' ? 'EUR' : 'CAD';
  safe.accounts = Array.isArray(input?.accounts) && input.accounts.length > 0
    ? input.accounts.map((item) => ({
        id: typeof item.id === 'string' ? item.id : createId(),
        name: String(item.name || 'Compte'),
        country: item.country === 'France' ? 'France' : 'Canada',
        currency: item.currency === 'EUR' ? 'EUR' : 'CAD',
        openingBalance: Number(item.openingBalance) || 0,
        createdAt: item.createdAt || new Date().toISOString(),
      }))
    : safe.accounts;
  safe.expenses = normalizeEntries(input?.expenses, ['date', 'description', 'accountId', 'category']);
  safe.incomes = normalizeEntries(input?.incomes, ['date', 'description', 'accountId', 'currency']);
  safe.transfers = normalizeEntries(input?.transfers, ['date', 'description', 'sourceAccountId', 'destinationAccountId']);
  safe.fixedExpenses = normalizeEntries(input?.fixedExpenses, ['description', 'currency', 'category']);
  return safe;
}

function normalizeEntries(collection, requiredFields) {
  if (!Array.isArray(collection)) return [];
  return collection
    .filter((item) => requiredFields.every((field) => item && item[field] !== undefined && item[field] !== null && item[field] !== ''))
    .map((item) => ({
      ...item,
      id: typeof item.id === 'string' ? item.id : createId(),
      amount: Number(item.amount) || 0,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
}

function persistAndRender(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if (message) showToast(message);
}

function renderAll() {
  renderSelectOptions();
  renderDashboard();
  renderAccounts();
  renderExpenses();
  renderIncomes();
  renderTransfers();
  renderFixedExpenses();
}

function renderSelectOptions() {
  const accounts = state.accounts;
  const options = accounts
    .map((account) => `<option value="${account.id}">${escapeHtml(account.name)} · ${account.currency}</option>`)
    .join('');

  [forms.expense.accountId, forms.income.accountId, forms.transfer.sourceAccountId, forms.transfer.destinationAccountId].forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = options || '<option value="">Ajoutez d\'abord un compte</option>';
    if (accounts.some((account) => account.id === currentValue)) {
      select.value = currentValue;
    }
  });
}

function renderDashboard() {
  const summary = computeMonthlySummary(ui.selectedMonth);
  const patrimonyCad = computeTotalPatrimonyInCAD();
  const patrimonyEur = convertAmount(patrimonyCad, 'CAD', 'EUR');
  const displayCurrency = state.settings.displayCurrency;

  refs.metrics.innerHTML = [
    metricCard('Patrimoine total', formatCurrency(displayCurrency === 'CAD' ? patrimonyCad : patrimonyEur, displayCurrency), `Vue principale en ${displayCurrency}`),
    metricCard('Patrimoine en CAD', formatCurrency(patrimonyCad, 'CAD'), 'Total converti'),
    metricCard('Patrimoine en EUR', formatCurrency(patrimonyEur, 'EUR'), 'Total converti'),
    metricCard('Argent reçu', formatCurrency(summary.incomesDisplay, displayCurrency), `${formatMonthLabel(ui.selectedMonth)}`),
    metricCard('Dépenses variables', formatCurrency(summary.variableExpensesDisplay, displayCurrency), `${summary.variableCount} opération(s)`),
    metricCard('Dépenses fixes', formatCurrency(summary.fixedExpensesDisplay, displayCurrency), `${state.fixedExpenses.length} récurrente(s)`),
    metricCard('Solde du mois', formatCurrency(summary.monthBalanceDisplay, displayCurrency), summary.monthBalanceDisplay >= 0 ? 'Vous restez positifs' : 'À surveiller'),
  ].join('');

  refs.accountsOverview.innerHTML = state.accounts.length
    ? state.accounts
        .map((account) => {
          const balance = computeAccountBalance(account.id);
          const secondaryCurrency = account.currency === 'CAD' ? 'EUR' : 'CAD';
          return `
            <article class="account-overview-card">
              <div class="card-row">
                <h3>${escapeHtml(account.name)}</h3>
                <span class="account-badge">${escapeHtml(account.country)} · ${account.currency}</span>
              </div>
              <p class="metric-value ${balance >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(balance, account.currency)}</p>
              <p class="summary-caption">Équivalent ${formatCurrency(convertAmount(balance, account.currency, secondaryCurrency), secondaryCurrency)}</p>
            </article>
          `;
        })
        .join('')
    : '<div class="empty-state">Ajoutez un compte pour commencer.</div>';
}

function renderAccounts() {
  refs.accountsList.innerHTML = state.accounts.length
    ? state.accounts
        .map((account) => {
          const balance = computeAccountBalance(account.id);
          return itemCard({
            title: account.name,
            amountLabel: formatCurrency(balance, account.currency),
            amountClass: balance >= 0 ? 'amount-positive' : 'amount-negative',
            lines: [
              `<span class="tag">${escapeHtml(account.country)}</span>`,
              `<span class="tag">Solde d'ouverture ${formatCurrency(account.openingBalance, account.currency)}</span>`,
            ],
            meta: `Devise du compte : ${account.currency}`,
            onEdit: `editAccount('${account.id}')`,
            onDelete: `deleteAccount('${account.id}')`,
          });
        })
        .join('')
    : '<div class="empty-state">Aucun compte pour le moment.</div>';
}

function renderExpenses() {
  refs.expensesList.innerHTML = state.expenses.length
    ? [...state.expenses]
        .sort(sortByDateDesc)
        .map((expense) => {
          const account = findAccount(expense.accountId);
          return itemCard({
            title: expense.description,
            amountLabel: formatCurrency(expense.amount, account?.currency || 'CAD'),
            amountClass: 'amount-negative',
            lines: [
              `<span class="tag">${formatDate(expense.date)}</span>`,
              `<span class="tag">${escapeHtml(expense.category)}</span>`,
              `<span class="tag">${escapeHtml(account?.name || 'Compte supprimé')}</span>`,
            ],
            meta: 'Dépense variable',
            onEdit: `editExpense('${expense.id}')`,
            onDelete: `deleteExpense('${expense.id}')`,
          });
        })
        .join('')
    : '<div class="empty-state">Aucune dépense enregistrée.</div>';
}

function renderIncomes() {
  refs.incomesList.innerHTML = state.incomes.length
    ? [...state.incomes]
        .sort(sortByDateDesc)
        .map((income) => {
          const account = findAccount(income.accountId);
          return itemCard({
            title: income.description,
            amountLabel: formatCurrency(income.amount, income.currency),
            amountClass: 'amount-positive',
            lines: [
              `<span class="tag">${formatDate(income.date)}</span>`,
              `<span class="tag">Vers ${escapeHtml(account?.name || 'Compte supprimé')}</span>`,
              `<span class="tag">${income.currency}</span>`,
            ],
            meta: `Crédité sur le compte en ${account?.currency || income.currency}`,
            onEdit: `editIncome('${income.id}')`,
            onDelete: `deleteIncome('${income.id}')`,
          });
        })
        .join('')
    : '<div class="empty-state">Aucun revenu enregistré.</div>';
}

function renderTransfers() {
  refs.transfersList.innerHTML = state.transfers.length
    ? [...state.transfers]
        .sort(sortByDateDesc)
        .map((transfer) => {
          const source = findAccount(transfer.sourceAccountId);
          const destination = findAccount(transfer.destinationAccountId);
          return itemCard({
            title: transfer.description,
            amountLabel: formatCurrency(transfer.amount, source?.currency || 'CAD'),
            amountClass: 'amount-neutral',
            lines: [
              `<span class="tag">${formatDate(transfer.date)}</span>`,
              `<span class="tag">${escapeHtml(source?.name || 'Compte source supprimé')}</span>`,
              `<span class="tag">→ ${escapeHtml(destination?.name || 'Compte destination supprimé')}</span>`,
            ],
            meta: 'Montant saisi dans la devise du compte source',
            onEdit: `editTransfer('${transfer.id}')`,
            onDelete: `deleteTransfer('${transfer.id}')`,
          });
        })
        .join('')
    : '<div class="empty-state">Aucun virement enregistré.</div>';
}

function renderFixedExpenses() {
  refs.fixedList.innerHTML = state.fixedExpenses.length
    ? [...state.fixedExpenses]
        .sort((a, b) => a.description.localeCompare(b.description, 'fr'))
        .map((item) =>
          itemCard({
            title: item.description,
            amountLabel: formatCurrency(item.amount, item.currency),
            amountClass: 'amount-negative',
            lines: [
              `<span class="tag">Mensuel</span>`,
              `<span class="tag">${escapeHtml(item.category)}</span>`,
            ],
            meta: 'Pris en compte dans le solde mensuel',
            onEdit: `editFixedExpense('${item.id}')`,
            onDelete: `deleteFixedExpense('${item.id}')`,
          })
        )
        .join('')
    : '<div class="empty-state">Aucune dépense fixe configurée.</div>';
}

function itemCard({ title, amountLabel, amountClass, lines, meta, onEdit, onDelete }) {
  return `
    <article class="item-card">
      <div class="card-row">
        <h3>${escapeHtml(title)}</h3>
        <strong class="${amountClass}">${amountLabel}</strong>
      </div>
      <div class="card-row">${lines.join('')}</div>
      <p class="card-meta">${escapeHtml(meta)}</p>
      <div class="card-actions">
        <button type="button" class="text-button" onclick="${onEdit}">Modifier</button>
        <button type="button" class="text-button" onclick="${onDelete}">Supprimer</button>
      </div>
    </article>
  `;
}

function metricCard(label, value, caption) {
  return `
    <article class="metric-card">
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="metric-value">${escapeHtml(value)}</p>
      <p class="summary-caption">${escapeHtml(caption)}</p>
    </article>
  `;
}

function computeAccountBalance(accountId) {
  const account = findAccount(accountId);
  if (!account) return 0;

  const incomes = state.incomes
    .filter((income) => income.accountId === accountId)
    .reduce((sum, income) => sum + convertAmount(income.amount, income.currency, account.currency), 0);

  const expenses = state.expenses
    .filter((expense) => expense.accountId === accountId)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const incomingTransfers = state.transfers
    .filter((transfer) => transfer.destinationAccountId === accountId)
    .reduce((sum, transfer) => {
      const source = findAccount(transfer.sourceAccountId);
      const sourceCurrency = source?.currency || account.currency;
      return sum + convertAmount(transfer.amount, sourceCurrency, account.currency);
    }, 0);

  const outgoingTransfers = state.transfers
    .filter((transfer) => transfer.sourceAccountId === accountId)
    .reduce((sum, transfer) => sum + transfer.amount, 0);

  return roundAmount(account.openingBalance + incomes + incomingTransfers - expenses - outgoingTransfers);
}

function computeTotalPatrimonyInCAD() {
  return roundAmount(
    state.accounts.reduce((total, account) => total + convertAmount(computeAccountBalance(account.id), account.currency, 'CAD'), 0)
  );
}

function computeMonthlySummary(selectedMonth) {
  const displayCurrency = state.settings.displayCurrency;
  const variableExpensesBase = state.expenses
    .filter((item) => getMonthFromDate(item.date) === selectedMonth)
    .reduce((sum, item) => {
      const account = findAccount(item.accountId);
      return sum + convertAmount(item.amount, account?.currency || 'CAD', displayCurrency);
    }, 0);

  const incomesBase = state.incomes
    .filter((item) => getMonthFromDate(item.date) === selectedMonth)
    .reduce((sum, item) => sum + convertAmount(item.amount, item.currency, displayCurrency), 0);

  const fixedExpensesBase = state.fixedExpenses.reduce(
    (sum, item) => sum + convertAmount(item.amount, item.currency, displayCurrency),
    0
  );

  const monthBalanceDisplay = roundAmount(incomesBase - variableExpensesBase - fixedExpensesBase);

  return {
    incomesDisplay: roundAmount(incomesBase),
    variableExpensesDisplay: roundAmount(variableExpensesBase),
    fixedExpensesDisplay: roundAmount(fixedExpensesBase),
    monthBalanceDisplay,
    variableCount: state.expenses.filter((item) => getMonthFromDate(item.date) === selectedMonth).length,
  };
}

function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return roundAmount(amount);
  const rate = clampPositiveNumber(state.settings.exchangeRate, DEFAULT_STATE.settings.exchangeRate);
  if (fromCurrency === 'EUR' && toCurrency === 'CAD') return roundAmount(amount * rate);
  if (fromCurrency === 'CAD' && toCurrency === 'EUR') return roundAmount(amount / rate);
  return roundAmount(amount);
}

function handleAccountSubmit(event) {
  event.preventDefault();
  const payload = {
    id: forms.account.id.value || createId(),
    name: forms.account.name.value.trim(),
    country: forms.account.country.value,
    currency: forms.account.currency.value,
    openingBalance: clampNumber(forms.account.openingBalance.value),
    createdAt: forms.account.id.value ? findEntryById(state.accounts, forms.account.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.name) {
    showToast('Le nom du compte est obligatoire.');
    return;
  }

  upsertEntry(state.accounts, payload);
  resetForm(forms.account);
  persistAndRender('Compte enregistré.');
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  if (!state.accounts.length) {
    showToast('Ajoutez d’abord un compte.');
    return;
  }

  const payload = {
    id: forms.expense.id.value || createId(),
    date: forms.expense.date.value,
    description: forms.expense.description.value.trim(),
    amount: clampPositiveNumber(forms.expense.amount.value, 0),
    accountId: forms.expense.accountId.value,
    category: forms.expense.category.value.trim(),
    createdAt: forms.expense.id.value ? findEntryById(state.expenses, forms.expense.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.description || !payload.date || !payload.accountId || !payload.category || payload.amount <= 0) {
    showToast('Complétez correctement la dépense.');
    return;
  }

  upsertEntry(state.expenses, payload);
  resetForm(forms.expense);
  persistAndRender('Dépense enregistrée.');
}

function handleIncomeSubmit(event) {
  event.preventDefault();
  if (!state.accounts.length) {
    showToast('Ajoutez d’abord un compte.');
    return;
  }

  const payload = {
    id: forms.income.id.value || createId(),
    date: forms.income.date.value,
    description: forms.income.description.value.trim(),
    amount: clampPositiveNumber(forms.income.amount.value, 0),
    currency: forms.income.currency.value,
    accountId: forms.income.accountId.value,
    createdAt: forms.income.id.value ? findEntryById(state.incomes, forms.income.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.description || !payload.date || !payload.accountId || payload.amount <= 0) {
    showToast('Complétez correctement le revenu.');
    return;
  }

  upsertEntry(state.incomes, payload);
  resetForm(forms.income);
  persistAndRender('Revenu enregistré.');
}

function handleTransferSubmit(event) {
  event.preventDefault();
  if (state.accounts.length < 2) {
    showToast('Il faut au moins deux comptes pour faire un virement.');
    return;
  }

  const payload = {
    id: forms.transfer.id.value || createId(),
    date: forms.transfer.date.value,
    sourceAccountId: forms.transfer.sourceAccountId.value,
    destinationAccountId: forms.transfer.destinationAccountId.value,
    amount: clampPositiveNumber(forms.transfer.amount.value, 0),
    description: forms.transfer.description.value.trim(),
    createdAt: forms.transfer.id.value ? findEntryById(state.transfers, forms.transfer.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.date || !payload.sourceAccountId || !payload.destinationAccountId || !payload.description || payload.amount <= 0) {
    showToast('Complétez correctement le virement.');
    return;
  }

  if (payload.sourceAccountId === payload.destinationAccountId) {
    showToast('Le compte source et le compte destination doivent être différents.');
    return;
  }

  upsertEntry(state.transfers, payload);
  resetForm(forms.transfer);
  persistAndRender('Virement enregistré.');
}

function handleFixedSubmit(event) {
  event.preventDefault();
  const payload = {
    id: forms.fixed.id.value || createId(),
    description: forms.fixed.description.value.trim(),
    amount: clampPositiveNumber(forms.fixed.amount.value, 0),
    currency: forms.fixed.currency.value,
    category: forms.fixed.category.value.trim(),
    createdAt: forms.fixed.id.value ? findEntryById(state.fixedExpenses, forms.fixed.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.description || !payload.category || payload.amount <= 0) {
    showToast('Complétez correctement la dépense fixe.');
    return;
  }

  upsertEntry(state.fixedExpenses, payload);
  resetForm(forms.fixed);
  persistAndRender('Dépense fixe enregistrée.');
}

function upsertEntry(collection, payload) {
  const index = collection.findIndex((entry) => entry.id === payload.id);
  if (index >= 0) {
    collection[index] = payload;
    return;
  }
  collection.push(payload);
}

function editAccount(id) {
  const item = findEntryById(state.accounts, id);
  if (!item) return;
  populateForm(forms.account, {
    id: item.id,
    name: item.name,
    country: item.country,
    currency: item.currency,
    openingBalance: item.openingBalance,
  }, 'Modifier le compte');
  setActiveTab('comptes');
}

function editExpense(id) {
  const item = findEntryById(state.expenses, id);
  if (!item) return;
  populateForm(forms.expense, {
    id: item.id,
    date: item.date,
    description: item.description,
    amount: item.amount,
    accountId: item.accountId,
    category: item.category,
  }, 'Modifier la dépense');
  setActiveTab('depenses');
}

function editIncome(id) {
  const item = findEntryById(state.incomes, id);
  if (!item) return;
  populateForm(forms.income, {
    id: item.id,
    date: item.date,
    description: item.description,
    amount: item.amount,
    currency: item.currency,
    accountId: item.accountId,
  }, 'Modifier le revenu');
  setActiveTab('revenus');
}

function editTransfer(id) {
  const item = findEntryById(state.transfers, id);
  if (!item) return;
  populateForm(forms.transfer, {
    id: item.id,
    date: item.date,
    sourceAccountId: item.sourceAccountId,
    destinationAccountId: item.destinationAccountId,
    amount: item.amount,
    description: item.description,
  }, 'Modifier le virement');
  setActiveTab('virements');
}

function editFixedExpense(id) {
  const item = findEntryById(state.fixedExpenses, id);
  if (!item) return;
  populateForm(forms.fixed, {
    id: item.id,
    description: item.description,
    amount: item.amount,
    currency: item.currency,
    category: item.category,
  }, 'Modifier la dépense fixe');
  setActiveTab('fixes');
}

function deleteAccount(id) {
  const hasLinkedData = state.expenses.some((item) => item.accountId === id)
    || state.incomes.some((item) => item.accountId === id)
    || state.transfers.some((item) => item.sourceAccountId === id || item.destinationAccountId === id);

  if (hasLinkedData) {
    showToast('Supprimez d’abord les opérations liées à ce compte.');
    return;
  }

  deleteEntry(state.accounts, id);
  persistAndRender('Compte supprimé.');
}

function deleteExpense(id) {
  deleteEntry(state.expenses, id);
  persistAndRender('Dépense supprimée.');
}

function deleteIncome(id) {
  deleteEntry(state.incomes, id);
  persistAndRender('Revenu supprimé.');
}

function deleteTransfer(id) {
  deleteEntry(state.transfers, id);
  persistAndRender('Virement supprimé.');
}

function deleteFixedExpense(id) {
  deleteEntry(state.fixedExpenses, id);
  persistAndRender('Dépense fixe supprimée.');
}

function deleteEntry(collection, id) {
  const index = collection.findIndex((entry) => entry.id === id);
  if (index >= 0) collection.splice(index, 1);
}

function populateForm(formGroup, values, title) {
  Object.entries(values).forEach(([key, value]) => {
    if (formGroup[key]) formGroup[key].value = value;
  });
  formGroup.title.textContent = title;
  formGroup.cancel.classList.remove('hidden');
}

function resetForm(formGroup) {
  formGroup.element.reset();
  formGroup.id.value = '';
  formGroup.cancel.classList.add('hidden');
  const defaultTitles = new Map([
    [forms.account, 'Ajouter un compte'],
    [forms.expense, 'Ajouter une dépense'],
    [forms.income, 'Ajouter un revenu'],
    [forms.transfer, 'Ajouter un virement'],
    [forms.fixed, 'Ajouter une dépense fixe'],
  ]);
  formGroup.title.textContent = defaultTitles.get(formGroup);
  setDefaultDates();
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  if (!forms.expense.date.value) forms.expense.date.value = today;
  if (!forms.income.date.value) forms.income.date.value = today;
  if (!forms.transfer.date.value) forms.transfer.date.value = today;
}

function setActiveTab(tabName) {
  ui.activeTab = tabName;
  refs.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tabName));
  refs.panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tabName));
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `budget-couple-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Export JSON généré.');
}

function importData(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedState = normalizeState(parsed);
      Object.assign(state, importedState);
      refs.exchangeRateInput.value = state.settings.exchangeRate;
      refs.displayCurrencyInput.value = state.settings.displayCurrency;
      persistAndRender('Import réussi.');
    } catch (error) {
      console.error(error);
      showToast('Le fichier JSON est invalide.');
    } finally {
      refs.importInput.value = '';
    }
  };
  reader.readAsText(file);
}

function resetApp() {
  const confirmed = window.confirm('Voulez-vous vraiment supprimer toutes les données locales ?');
  if (!confirmed) return;

  const fresh = cloneData(createDefaultState());
  Object.keys(state).forEach((key) => {
    state[key] = fresh[key];
  });
  ui.selectedMonth = getCurrentMonth();
  refs.monthInput.value = ui.selectedMonth;
  refs.exchangeRateInput.value = state.settings.exchangeRate;
  refs.displayCurrencyInput.value = state.settings.displayCurrency;
  Object.values(forms).forEach(resetForm);
  persistAndRender('Application réinitialisée.');
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove('visible'), 2600);
}

function findAccount(id) {
  return state.accounts.find((account) => account.id === id);
}

function findEntryById(collection, id) {
  return collection.find((entry) => entry.id === id);
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(roundAmount(amount));
}

function formatDate(value) {
  if (!value) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T12:00:00`));
}

function formatMonthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function getMonthFromDate(value) {
  return String(value || '').slice(0, 7);
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function clampNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? roundAmount(numericValue) : 0;
}

function clampPositiveNumber(value, fallback = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
  return roundAmount(numericValue);
}

function roundAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sortByDateDesc(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

// Expose edit/delete actions for inline buttons without any framework/runtime dependency.
window.editAccount = editAccount;
window.editExpense = editExpense;
window.editIncome = editIncome;
window.editTransfer = editTransfer;
window.editFixedExpense = editFixedExpense;
window.deleteAccount = deleteAccount;
window.deleteExpense = deleteExpense;
window.deleteIncome = deleteIncome;
window.deleteTransfer = deleteTransfer;
window.deleteFixedExpense = deleteFixedExpense;
