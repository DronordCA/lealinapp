let data = JSON.parse(localStorage.getItem("budget")) || {
  accounts: [
    { name: "Canada", amount: 2000 },
    { name: "France", amount: 1500 }
  ],
  items: []
};

function save() {
  localStorage.setItem("budget", JSON.stringify(data));
}

function render() {
  // ACCOUNTS
  const accountsEl = document.getElementById("accounts");
  accountsEl.innerHTML = "";

  let total = 0;

  data.accounts.forEach(acc => {
    total += acc.amount;

    const div = document.createElement("div");
    div.className = "account";
    div.innerHTML = `
      <div>${acc.name}</div>
      <strong>${acc.amount} $</strong>
    `;
    accountsEl.appendChild(div);
  });

  document.getElementById("total").innerText = total + " $";
  document.getElementById("total-eur").innerText = (total * 0.7).toFixed(0) + " €";

  // LIST
  const list = document.getElementById("list");
  list.innerHTML = "";

  let received = 0;
  let variable = 0;

  data.items.forEach(item => {
    const li = document.createElement("li");
    li.innerText = `${item.desc} : ${item.amount}`;
    list.appendChild(li);

    if (item.type === "revenu") received += item.amount;
    else variable += item.amount;
  });

  document.getElementById("received").innerText = received;
  document.getElementById("variable").innerText = variable;
  document.getElementById("fixed").innerText = 0;
  document.getElementById("monthly").innerText = (received - variable) + " $";
}

// EXPORT
function exportData() {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "budget.json";
  a.click();
}

// IMPORT
function importData(e) {
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = (ev) => {
    data = JSON.parse(ev.target.result);
    save();
    render();
  };

  reader.readAsText(file);
}

render();
