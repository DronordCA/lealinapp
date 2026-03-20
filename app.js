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
        emoji: '🍁',
        openingBalance: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: createId(),
        name: 'Compte France',
        country: 'France',
        currency: 'EUR',
        emoji: '🇫🇷',
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
  activeScreen: 'accueil',
  moneyMode: 'revenu',
  accountDrafts: [],
  fixedDrafts: [],
};

const refs = {
  toast: document.getElementById('toast'),
  monthInput: document.getElementById('selected-month'),
  heroTotal: document.getElementById('hero-total'),
  heroSecondary: document.getElementById('hero-secondary'),
  heroMonth: document.getElementById('hero-month'),
  homeAccounts: document.getElementById('home-accounts'),
  monthBalanceValue: document.getElementById('month-balance-value'),
  monthStatChips: document.getElementById('month-stat-chips'),
  categoryBreakdown: document.getElementById('category-breakdown'),
  accountsList: document.getElementById('accounts-list'),
  expensesList: document.getElementById('expenses-list'),
  incomesList: document.getElementById('incomes-list'),
  transfersList: document.getElementById('transfers-list'),
  fixedList: document.getElementById('fixed-list'),
  exportButton: document.getElementById('export-button'),
  importInput: document.getElementById('import-input'),
  resetButton: document.getElementById('reset-button'),
  addAccountButton: document.getElementById('add-account-button'),
  addFixedButton: document.getElementById('add-fixed-button'),
  screens: [...document.querySelectorAll('.screen')],
  navButtons: [...document.querySelectorAll('.nav-button')],
  moneyButtons: [...document.querySelectorAll('.segment-button')],
  moneyPanels: [...document.querySelectorAll('.money-panel')],
  settingsForm: document.getElementById('settings-form'),
  exchangeRateInput: document.getElementById('exchange-rate'),
  displayCurrencyInput: document.getElementById('display-currency'),
  incomeExchangeWrap: document.getElementById('income-exchange-wrap'),
  incomeExchangeRate: document.getElementById('income-exchange-rate'),
};

const forms = {
  expense: {
    element: document.getElementById('expense-form'),
    title: document.getElementById('expense-form-title'),
    cancel: document.getElementById('cancel-expense-edit'),
    error: document.getElementById('expense-error'),
    id: document.getElementById('expense-id'),
    date: document.getElementById('expense-date'),
    description: document.getElementById('expense-description'),
    category: document.getElementById('expense-category'),
    amount: document.getElementById('expense-amount'),
    accountId: document.getElementById('expense-account'),
  },
  income: {
    element: document.getElementById('income-form'),
    title: document.getElementById('income-form-title'),
    cancel: document.getElementById('cancel-income-edit'),
    error: document.getElementById('income-error'),
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
    error: document.getElementById('transfer-error'),
    id: document.getElementById('transfer-id'),
    date: document.getElementById('transfer-date'),
    description: document.getElementById('transfer-description'),
    sourceAccountId: document.getElementById('transfer-source'),
    destinationAccountId: document.getElementById('transfer-destination'),
    amount: document.getElementById('transfer-amount'),
  },
};

initialize();

function initialize() {
  setDefaultDates();
  bindEvents();
  refs.monthInput.value = ui.selectedMonth;
  refs.exchangeRateInput.value = state.settings.exchangeRate;
  refs.displayCurrencyInput.value = state.settings.displayCurrency;
  refs.incomeExchangeRate.value = state.settings.exchangeRate;
  updateIncomeExchangeVisibility();
  renderAll();
}

function bindEvents() {
  refs.navButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveScreen(button.dataset.screenTarget));
  });

  refs.moneyButtons.forEach((button) => {
    button.addEventListener('click', () => setMoneyMode(button.dataset.moneyMode));
  });

  refs.monthInput.addEventListener('change', (event) => {
    ui.selectedMonth = event.target.value || getCurrentMonth();
    renderHome();
  });

  refs.exportButton.addEventListener('click', exportData);
  refs.importInput.addEventListener('change', importData);
  refs.resetButton.addEventListener('click', resetApp);
  refs.addAccountButton.addEventListener('click', () => {
    ui.accountDrafts.unshift(createAccountDraft());
    renderAccountsSettings();
  });
  refs.addFixedButton.addEventListener('click', () => {
    ui.fixedDrafts.unshift(createFixedDraft());
    renderFixedExpenses();
  });

  refs.settingsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.settings.exchangeRate = clampPositiveNumber(refs.exchangeRateInput.value, state.settings.exchangeRate);
    state.settings.displayCurrency = refs.displayCurrencyInput.value === 'EUR' ? 'EUR' : 'CAD';
    refs.incomeExchangeRate.value = state.settings.exchangeRate;
    persistAndRender('Réglages sauvegardés.');
  });

  forms.expense.element.addEventListener('submit', handleExpenseSubmit);
  forms.income.element.addEventListener('submit', handleIncomeSubmit);
  forms.transfer.element.addEventListener('submit', handleTransferSubmit);

  [forms.expense, forms.income, forms.transfer].forEach((formGroup) => {
    formGroup.cancel.addEventListener('click', () => resetForm(formGroup));
  });

  forms.income.currency.addEventListener('change', updateIncomeExchangeVisibility);
  refs.incomeExchangeRate.addEventListener('change', () => {
    const value = clampPositiveNumber(refs.incomeExchangeRate.value, state.settings.exchangeRate);
    refs.incomeExchangeRate.value = value;
  });

  refs.accountsList.addEventListener('submit', handleAccountEditorSubmit);
  refs.accountsList.addEventListener('click', handleAccountEditorClick);
  refs.fixedList.addEventListener('submit', handleFixedEditorSubmit);
  refs.fixedList.addEventListener('click', handleFixedEditorClick);
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
        emoji: normalizeEmoji(item.emoji, item.currency, item.country),
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
  renderHome();
  renderAccountsSettings();
  renderExpenses();
  renderIncomes();
  renderTransfers();
  renderFixedExpenses();
}

function renderSelectOptions() {
  const accounts = state.accounts;
  const options = accounts
    .map((account) => `<option value="${account.id}">${escapeHtml(account.emoji || defaultAccountEmoji(account))} ${escapeHtml(account.name)} · ${account.currency}</option>`)
    .join('');

  [forms.expense.accountId, forms.income.accountId, forms.transfer.sourceAccountId, forms.transfer.destinationAccountId].forEach((select) => {
    const currentValue = select.value;
    select.innerHTML = options || '<option value="">Ajoutez d’abord un compte</option>';
    if (accounts.some((account) => account.id === currentValue)) {
      select.value = currentValue;
    }
  });
}

function renderHome() {
  const summary = computeMonthlySummary(ui.selectedMonth);
  const patrimonyCad = computeTotalPatrimonyInCAD();
  const displayCurrency = state.settings.displayCurrency;
  const primaryValue = displayCurrency === 'CAD' ? patrimonyCad : convertAmount(patrimonyCad, 'CAD', 'EUR');
  const secondaryCurrency = displayCurrency === 'CAD' ? 'EUR' : 'CAD';
  const secondaryValue = convertAmount(primaryValue, displayCurrency, secondaryCurrency);

  refs.heroTotal.textContent = formatCurrency(primaryValue, displayCurrency);
  refs.heroSecondary.textContent = formatCurrency(secondaryValue, secondaryCurrency);
  refs.heroMonth.textContent = formatMonthLabel(ui.selectedMonth);

  refs.homeAccounts.innerHTML = state.accounts.length
    ? state.accounts
        .map((account) => {
          const balance = computeAccountBalance(account.id);
          return `
            <article class="account-tile">
              <span class="account-emoji">${escapeHtml(account.emoji || defaultAccountEmoji(account))}</span>
              <p class="account-label">${escapeHtml(account.name)}</p>
              <p class="account-balance ${balance >= 0 ? 'amount-positive' : 'amount-negative'}">${formatCurrency(balance, account.currency)}</p>
            </article>
          `;
        })
        .join('')
    : emptyState('Ajoutez un compte pour voir votre patrimoine.');

  refs.monthBalanceValue.textContent = formatCurrency(summary.monthBalanceDisplay, displayCurrency);
  refs.monthBalanceValue.className = `spotlight-amount ${summary.monthBalanceDisplay >= 0 ? 'amount-positive' : 'amount-negative'}`;
  refs.monthStatChips.innerHTML = [
    summaryChip('Reçus', formatCurrency(summary.incomesDisplay, displayCurrency), 'success'),
    summaryChip('Fixes', formatCurrency(summary.fixedExpensesDisplay, displayCurrency), 'info'),
    summaryChip('Variables', formatCurrency(summary.variableExpensesDisplay, displayCurrency), 'warning'),
  ].join('');

  const categories = computeCategoryBreakdown(ui.selectedMonth);
  refs.categoryBreakdown.innerHTML = categories.length
    ? categories
        .map((item) => `
          <div class="category-row">
            <span>${escapeHtml(item.category)}</span>
            <strong>${formatCurrency(item.amount, displayCurrency)}</strong>
          </div>
        `)
        .join('')
    : emptyState('Aucune dépense catégorisée pour ce mois.');
}

function renderAccountsSettings() {
  const cards = [
    ...state.accounts.map((account) => accountEditorCard(account)),
    ...ui.accountDrafts.map((draft) => accountEditorCard(draft, true)),
  ];
  refs.accountsList.innerHTML = cards.length ? cards.join('') : emptyState('Ajoutez votre premier compte.');
}

function renderExpenses() {
  refs.expensesList.innerHTML = state.expenses.length
    ? [...state.expenses]
        .sort(sortByDateDesc)
        .map((expense) => ledgerCard({
          title: expense.description,
          amountLabel: formatCurrency(expense.amount, findAccount(expense.accountId)?.currency || 'CAD'),
          amountClass: 'amount-negative',
          metaLeft: formatDate(expense.date),
          metaRight: expense.category,
          note: findAccount(expense.accountId)?.name || 'Compte supprimé',
          editAction: `editExpense('${expense.id}')`,
          deleteAction: `deleteExpense('${expense.id}')`,
        }))
        .join('')
    : emptyState('Aucune dépense enregistrée.');
}

function renderIncomes() {
  refs.incomesList.innerHTML = state.incomes.length
    ? [...state.incomes]
        .sort(sortByDateDesc)
        .map((income) => {
          const account = findAccount(income.accountId);
          return ledgerCard({
            title: income.description,
            amountLabel: formatCurrency(income.amount, income.currency),
            amountClass: 'amount-positive',
            metaLeft: formatDate(income.date),
            metaRight: income.currency,
            note: `Vers ${account?.name || 'Compte supprimé'}`,
            editAction: `editIncome('${income.id}')`,
            deleteAction: `deleteIncome('${income.id}')`,
          });
        })
        .join('')
    : emptyState('Aucun revenu enregistré.');
}

function renderTransfers() {
  refs.transfersList.innerHTML = state.transfers.length
    ? [...state.transfers]
        .sort(sortByDateDesc)
        .map((transfer) => {
          const source = findAccount(transfer.sourceAccountId);
          const destination = findAccount(transfer.destinationAccountId);
          return ledgerCard({
            title: transfer.description,
            amountLabel: formatCurrency(transfer.amount, source?.currency || 'CAD'),
            amountClass: 'amount-neutral',
            metaLeft: formatDate(transfer.date),
            metaRight: `${source?.name || 'Source'} → ${destination?.name || 'Destination'}`,
            note: 'Montant saisi dans la devise du compte source',
            editAction: `editTransfer('${transfer.id}')`,
            deleteAction: `deleteTransfer('${transfer.id}')`,
          });
        })
        .join('')
    : emptyState('Aucun virement enregistré.');
}

function renderFixedExpenses() {
  const cards = [
    ...state.fixedExpenses
      .slice()
      .sort((a, b) => a.description.localeCompare(b.description, 'fr'))
      .map((item) => fixedEditorCard(item)),
    ...ui.fixedDrafts.map((draft) => fixedEditorCard(draft, true)),
  ];
  refs.fixedList.innerHTML = cards.length ? cards.join('') : emptyState('Aucune dépense fixe configurée.');
}

function summaryChip(label, value, tone) {
  return `
    <article class="stat-chip tone-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function ledgerCard({ title, amountLabel, amountClass, metaLeft, metaRight, note, editAction, deleteAction }) {
  return `
    <article class="ledger-card">
      <div class="ledger-top">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="ledger-note">${escapeHtml(note)}</p>
        </div>
        <strong class="${amountClass}">${escapeHtml(amountLabel)}</strong>
      </div>
      <div class="ledger-meta">
        <span>${escapeHtml(metaLeft)}</span>
        <span>${escapeHtml(metaRight)}</span>
      </div>
      <div class="inline-actions">
        <button type="button" class="text-button" onclick="${editAction}">Modifier</button>
        <button type="button" class="text-button danger-text" onclick="${deleteAction}">Supprimer</button>
      </div>
    </article>
  `;
}

function accountEditorCard(account, isDraft = false) {
  return `
    <form class="settings-editor" data-editor="account" data-account-id="${isDraft ? '' : account.id}" data-draft-id="${isDraft ? account.id : ''}">
      <div class="editor-grid editor-grid-account">
        <label>
          <span>Nom du compte</span>
          <input name="name" type="text" value="${escapeAttribute(account.name)}" placeholder="Ex. Compte courant" required />
        </label>
        <label>
          <span>Devise</span>
          <select name="currency" required>
            <option value="CAD" ${account.currency === 'CAD' ? 'selected' : ''}>CAD</option>
            <option value="EUR" ${account.currency === 'EUR' ? 'selected' : ''}>EUR</option>
          </select>
        </label>
        <label>
          <span>Emoji / repère</span>
          <input name="emoji" type="text" value="${escapeAttribute(account.emoji || '')}" maxlength="4" placeholder="🍁" />
        </label>
        <label>
          <span>Solde d'ouverture</span>
          <input name="openingBalance" type="number" step="0.01" inputmode="decimal" value="${account.openingBalance}" required />
        </label>
        <label>
          <span>Pays / zone</span>
          <select name="country" required>
            <option value="Canada" ${account.country === 'Canada' ? 'selected' : ''}>Canada</option>
            <option value="France" ${account.country === 'France' ? 'selected' : ''}>France</option>
          </select>
        </label>
      </div>
      <div class="inline-actions align-end">
        <button type="submit" class="secondary-button">Enregistrer</button>
        <button type="button" class="text-button danger-text" data-account-action="delete">Supprimer</button>
      </div>
    </form>
  `;
}

function fixedEditorCard(item, isDraft = false) {
  return `
    <form class="settings-editor" data-editor="fixed" data-fixed-id="${isDraft ? '' : item.id}" data-draft-id="${isDraft ? item.id : ''}">
      <div class="fixed-row">
        <div class="fixed-main">
          <label>
            <span>Nom</span>
            <input name="description" type="text" value="${escapeAttribute(item.description)}" placeholder="Ex. Loyer" required />
          </label>
          <label>
            <span>Montant</span>
            <input name="amount" type="number" step="0.01" inputmode="decimal" value="${item.amount}" required />
          </label>
          <label>
            <span>Devise</span>
            <select name="currency" required>
              <option value="CAD" ${item.currency === 'CAD' ? 'selected' : ''}>CAD</option>
              <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
            </select>
          </label>
          <label>
            <span>Catégorie</span>
            <input name="category" type="text" value="${escapeAttribute(item.category)}" placeholder="Ex. Logement" required />
          </label>
        </div>
        <div class="inline-actions align-end">
          <button type="submit" class="secondary-button">Enregistrer</button>
          <button type="button" class="text-button danger-text" data-fixed-action="delete">Supprimer</button>
        </div>
      </div>
    </form>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
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
  const monthExpenses = state.expenses.filter((item) => getMonthFromDate(item.date) === selectedMonth);
  const monthIncomes = state.incomes.filter((item) => getMonthFromDate(item.date) === selectedMonth);

  const variableExpensesBase = monthExpenses.reduce((sum, item) => {
    const account = findAccount(item.accountId);
    return sum + convertAmount(item.amount, account?.currency || 'CAD', displayCurrency);
  }, 0);

  const incomesBase = monthIncomes.reduce((sum, item) => sum + convertAmount(item.amount, item.currency, displayCurrency), 0);

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
  };
}

function computeCategoryBreakdown(selectedMonth) {
  const totals = new Map();
  const displayCurrency = state.settings.displayCurrency;

  state.expenses
    .filter((item) => getMonthFromDate(item.date) === selectedMonth)
    .forEach((item) => {
      const account = findAccount(item.accountId);
      const amount = convertAmount(item.amount, account?.currency || 'CAD', displayCurrency);
      totals.set(item.category, roundAmount((totals.get(item.category) || 0) + amount));
    });

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return roundAmount(amount);
  const rate = clampPositiveNumber(state.settings.exchangeRate, DEFAULT_STATE.settings.exchangeRate);
  if (fromCurrency === 'EUR' && toCurrency === 'CAD') return roundAmount(amount * rate);
  if (fromCurrency === 'CAD' && toCurrency === 'EUR') return roundAmount(amount / rate);
  return roundAmount(amount);
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  clearFormError(forms.expense.error);

  if (!state.accounts.length) {
    return failForm(forms.expense.error, 'Ajoutez d’abord un compte.');
  }

  const payload = {
    id: forms.expense.id.value || createId(),
    date: forms.expense.date.value,
    description: forms.expense.description.value.trim(),
    category: forms.expense.category.value.trim(),
    amount: clampPositiveNumber(forms.expense.amount.value, 0),
    accountId: forms.expense.accountId.value,
    createdAt: forms.expense.id.value ? findEntryById(state.expenses, forms.expense.id.value)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.description || !payload.date || !payload.accountId || !payload.category || payload.amount <= 0) {
    return failForm(forms.expense.error, 'Complétez correctement la dépense.');
  }

  upsertEntry(state.expenses, payload);
  resetForm(forms.expense);
  persistAndRender('Dépense enregistrée.');
}

function handleIncomeSubmit(event) {
  event.preventDefault();
  clearFormError(forms.income.error);

  if (!state.accounts.length) {
    return failForm(forms.income.error, 'Ajoutez d’abord un compte.');
  }

  if (forms.income.currency.value === 'EUR') {
    state.settings.exchangeRate = clampPositiveNumber(refs.incomeExchangeRate.value, state.settings.exchangeRate);
    refs.exchangeRateInput.value = state.settings.exchangeRate;
    refs.incomeExchangeRate.value = state.settings.exchangeRate;
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
    return failForm(forms.income.error, 'Complétez correctement le revenu.');
  }

  upsertEntry(state.incomes, payload);
  resetForm(forms.income);
  persistAndRender('Revenu enregistré.');
}

function handleTransferSubmit(event) {
  event.preventDefault();
  clearFormError(forms.transfer.error);

  if (state.accounts.length < 2) {
    return failForm(forms.transfer.error, 'Il faut au moins deux comptes pour faire un virement.');
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
    return failForm(forms.transfer.error, 'Complétez correctement le virement.');
  }

  if (payload.sourceAccountId === payload.destinationAccountId) {
    return failForm(forms.transfer.error, 'Le compte source et le compte destination doivent être différents.');
  }

  upsertEntry(state.transfers, payload);
  resetForm(forms.transfer);
  persistAndRender('Virement enregistré.');
}

function handleAccountEditorSubmit(event) {
  const form = event.target.closest('form[data-editor="account"]');
  if (!form) return;
  event.preventDefault();

  const draftId = form.dataset.draftId;
  const accountId = form.dataset.accountId || createId();
  const currency = form.elements.currency.value;
  const country = form.elements.country.value;
  const payload = {
    id: accountId,
    name: form.elements.name.value.trim(),
    country,
    currency,
    emoji: normalizeEmoji(form.elements.emoji.value.trim(), currency, country),
    openingBalance: clampNumber(form.elements.openingBalance.value),
    createdAt: form.dataset.accountId ? findEntryById(state.accounts, form.dataset.accountId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.name) {
    showToast('Le nom du compte est obligatoire.');
    return;
  }

  upsertEntry(state.accounts, payload);
  if (draftId) ui.accountDrafts = ui.accountDrafts.filter((item) => item.id !== draftId);
  persistAndRender('Compte enregistré.');
}

function handleAccountEditorClick(event) {
  const button = event.target.closest('[data-account-action="delete"]');
  if (!button) return;
  const form = button.closest('form[data-editor="account"]');
  if (!form) return;

  const draftId = form.dataset.draftId;
  if (draftId) {
    ui.accountDrafts = ui.accountDrafts.filter((item) => item.id !== draftId);
    renderAccountsSettings();
    return;
  }

  deleteAccount(form.dataset.accountId);
}

function handleFixedEditorSubmit(event) {
  const form = event.target.closest('form[data-editor="fixed"]');
  if (!form) return;
  event.preventDefault();

  const draftId = form.dataset.draftId;
  const fixedId = form.dataset.fixedId || createId();
  const payload = {
    id: fixedId,
    description: form.elements.description.value.trim(),
    amount: clampPositiveNumber(form.elements.amount.value, 0),
    currency: form.elements.currency.value,
    category: form.elements.category.value.trim(),
    createdAt: form.dataset.fixedId ? findEntryById(state.fixedExpenses, form.dataset.fixedId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (!payload.description || !payload.category || payload.amount <= 0) {
    showToast('Complétez correctement la dépense fixe.');
    return;
  }

  upsertEntry(state.fixedExpenses, payload);
  if (draftId) ui.fixedDrafts = ui.fixedDrafts.filter((item) => item.id !== draftId);
  persistAndRender('Dépense fixe enregistrée.');
}

function handleFixedEditorClick(event) {
  const button = event.target.closest('[data-fixed-action="delete"]');
  if (!button) return;
  const form = button.closest('form[data-editor="fixed"]');
  if (!form) return;

  const draftId = form.dataset.draftId;
  if (draftId) {
    ui.fixedDrafts = ui.fixedDrafts.filter((item) => item.id !== draftId);
    renderFixedExpenses();
    return;
  }

  deleteFixedExpense(form.dataset.fixedId);
}

function upsertEntry(collection, payload) {
  const index = collection.findIndex((entry) => entry.id === payload.id);
  if (index >= 0) {
    collection[index] = payload;
    return;
  }
  collection.push(payload);
}

function editExpense(id) {
  const item = findEntryById(state.expenses, id);
  if (!item) return;
  populateForm(forms.expense, {
    id: item.id,
    date: item.date,
    description: item.description,
    category: item.category,
    amount: item.amount,
    accountId: item.accountId,
  }, 'Modifier la dépense');
  setActiveScreen('depense');
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
  setActiveScreen('argent');
  setMoneyMode('revenu');
  updateIncomeExchangeVisibility();
}

function editTransfer(id) {
  const item = findEntryById(state.transfers, id);
  if (!item) return;
  populateForm(forms.transfer, {
    id: item.id,
    date: item.date,
    description: item.description,
    sourceAccountId: item.sourceAccountId,
    destinationAccountId: item.destinationAccountId,
    amount: item.amount,
  }, 'Modifier le virement');
  setActiveScreen('argent');
  setMoneyMode('virement');
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
  clearFormError(formGroup.error);
}

function resetForm(formGroup) {
  formGroup.element.reset();
  formGroup.id.value = '';
  formGroup.cancel.classList.add('hidden');
  clearFormError(formGroup.error);
  const defaultTitles = new Map([
    [forms.expense, 'Nouvelle dépense'],
    [forms.income, 'Revenu / Salaire'],
    [forms.transfer, 'Virement'],
  ]);
  formGroup.title.textContent = defaultTitles.get(formGroup);
  setDefaultDates();
  if (formGroup === forms.income) {
    refs.incomeExchangeRate.value = state.settings.exchangeRate;
    updateIncomeExchangeVisibility();
  }
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  if (!forms.expense.date.value) forms.expense.date.value = today;
  if (!forms.income.date.value) forms.income.date.value = today;
  if (!forms.transfer.date.value) forms.transfer.date.value = today;
}

function setActiveScreen(screenName) {
  ui.activeScreen = screenName;
  refs.navButtons.forEach((button) => button.classList.toggle('active', button.dataset.screenTarget === screenName));
  refs.screens.forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === screenName));
}

function setMoneyMode(mode) {
  ui.moneyMode = mode;
  refs.moneyButtons.forEach((button) => button.classList.toggle('active', button.dataset.moneyMode === mode));
  refs.moneyPanels.forEach((panel) => panel.classList.toggle('active', panel.dataset.moneyPanel === mode));
}

function updateIncomeExchangeVisibility() {
  const isEuro = forms.income.currency.value === 'EUR';
  refs.incomeExchangeWrap.classList.toggle('hidden', !isEuro);
  refs.incomeExchangeRate.value = state.settings.exchangeRate;
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
      ui.accountDrafts = [];
      ui.fixedDrafts = [];
      refs.exchangeRateInput.value = state.settings.exchangeRate;
      refs.displayCurrencyInput.value = state.settings.displayCurrency;
      refs.incomeExchangeRate.value = state.settings.exchangeRate;
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
  ui.accountDrafts = [];
  ui.fixedDrafts = [];
  refs.monthInput.value = ui.selectedMonth;
  refs.exchangeRateInput.value = state.settings.exchangeRate;
  refs.displayCurrencyInput.value = state.settings.displayCurrency;
  refs.incomeExchangeRate.value = state.settings.exchangeRate;
  Object.values(forms).forEach(resetForm);
  persistAndRender('Application réinitialisée.');
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove('visible'), 2600);
}

function failForm(errorNode, message) {
  errorNode.textContent = message;
  errorNode.classList.remove('hidden');
}

function clearFormError(errorNode) {
  errorNode.textContent = '';
  errorNode.classList.add('hidden');
}

function findAccount(id) {
  return state.accounts.find((account) => account.id === id);
}

function findEntryById(collection, id) {
  return collection.find((entry) => entry.id === id);
}

function createAccountDraft() {
  return {
    id: createId(),
    name: '',
    country: 'Canada',
    currency: 'CAD',
    emoji: '🏦',
    openingBalance: 0,
  };
}

function createFixedDraft() {
  return {
    id: createId(),
    description: '',
    amount: 0,
    currency: 'CAD',
    category: '',
  };
}

function normalizeEmoji(value, currency, country) {
  const trimmed = String(value || '').trim();
  if (trimmed) return [...trimmed].slice(0, 2).join('');
  return defaultAccountEmoji({ currency, country });
}

function defaultAccountEmoji(account) {
  if (account?.currency === 'EUR' || account?.country === 'France') return '🇫🇷';
  if (account?.currency === 'CAD' || account?.country === 'Canada') return '🍁';
  return '🏦';
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

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function sortByDateDesc(a, b) {
  return String(b.date).localeCompare(String(a.date));
}

window.editExpense = editExpense;
window.editIncome = editIncome;
window.editTransfer = editTransfer;
window.deleteAccount = deleteAccount;
window.deleteExpense = deleteExpense;
window.deleteIncome = deleteIncome;
window.deleteTransfer = deleteTransfer;
window.deleteFixedExpense = deleteFixedExpense;
