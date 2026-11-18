"use strict";

const $ = (id) => document.getElementById(id);
const number = (value, digits = 2) => new Intl.NumberFormat("pt-BR", {maximumFractionDigits: digits}).format(value);
const colors = ["#2675a7", "#229477", "#d5713b"];
const plotConfig = {responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"]};
let data;
let tab = "importance";

function option(select, label, value) {
  const item = document.createElement("option");
  item.textContent = label;
  item.value = value;
  select.append(item);
}

function layout(extra = {}) {
  return {font: {family: "system-ui, sans-serif", size: 14, color: "#324a5e"}, paper_bgcolor: "white", plot_bgcolor: "white", margin: {l: 255, r: 38, t: 28, b: 65}, ...extra};
}

function localEffects() {
  const row = Number($("flow-select").value);
  const cls = Number($("class-select").value);
  return data.features.map((name, index) => ({name, index, effect: data.shap[row][index][cls] * 100, value: data.values[row][index]})).sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));
}

function renderImportance() {
  const cls = Number($("class-select").value);
  const count = Number($("limit-select").value);
  const ranked = data.features.map((name, index) => ({name, value: data.shap.reduce((sum, row) => sum + Math.abs(row[index][cls]), 0) / data.labels.length * 100})).sort((a, b) => b.value - a.value).slice(0, count).reverse();
  $("importance-chart").style.height = `${Math.max(490, count * 25 + 90)}px`;
  Plotly.react("importance-chart", [{type: "bar", orientation: "h", x: ranked.map((r) => r.value), y: ranked.map((r) => r.name), marker: {color: colors[cls]}, hovertemplate: "%{y}<br>SHAP absoluto médio: %{x:.3f} pp<extra></extra>"}], layout({xaxis: {title: {text: "Contribuição média absoluta (pontos percentuais)"}, gridcolor: "#edf1f5", zeroline: false}, yaxis: {automargin: true}}), plotConfig);
}

function renderDependence() {
  const cls = Number($("class-select").value);
  const feature = Number($("feature-select").value);
  const filter = $("filter-select").value;
  const traces = data.classes.map((name, label) => {
    const indexes = data.labels.flatMap((value, i) => value === label ? [i] : []);
    return {type: "scatter", mode: "markers", name, visible: filter === "all" || Number(filter) === label, x: indexes.map((i) => data.values[i][feature]), y: indexes.map((i) => data.shap[i][feature][cls] * 100), customdata: indexes.map((i) => i + 1), marker: {color: colors[label], size: 6, opacity: 0.65}, hovertemplate: "Fluxo %{customdata}<br>Valor: %{x:.5g}<br>SHAP: %{y:.3f} pp<extra>%{fullData.name}</extra>"};
  });
  Plotly.react("dependence-chart", traces, layout({margin: {l: 85, r: 35, t: 55, b: 75}, legend: {orientation: "h", x: 0, y: 1.12}, xaxis: {title: {text: `${data.features[feature]} (valor original)`}, gridcolor: "#edf1f5"}, yaxis: {title: {text: "Contribuição SHAP (pp)"}, zerolinecolor: "#7d91a5", gridcolor: "#edf1f5"}}), plotConfig);
}

function renderLocal() {
  const row = Number($("flow-select").value);
  const cls = Number($("class-select").value);
  const effects = localEffects();
  const shown = effects.slice(0, 10);
  const other = effects.slice(10).reduce((sum, item) => sum + item.effect, 0);
  const predicted = data.probabilities[row].indexOf(Math.max(...data.probabilities[row]));
  $("actual-class").textContent = data.classes[data.labels[row]];
  $("predicted-class").textContent = data.classes[predicted];
  $("probability-label").textContent = `Probabilidade de ${data.classes[cls]}`;
  $("probability").textContent = `${number(data.probabilities[row][cls] * 100)}%`;
  const labels = ["Referência", ...shown.map((item) => item.name), "Outros 19 atributos", "Probabilidade final"];
  const measures = ["absolute", ...shown.map(() => "relative"), "relative", "total"];
  const values = [data.base_values[cls] * 100, ...shown.map((item) => item.effect), other, 0];
  Plotly.react("local-chart", [{type: "waterfall", orientation: "h", y: labels, x: values, measure: measures, connector: {line: {color: "#a5b7c6"}}, increasing: {marker: {color: "#d5713b"}}, decreasing: {marker: {color: "#2675a7"}}, totals: {marker: {color: "#213e59"}}, hovertemplate: "%{y}<br>%{x:.3f} pp<extra></extra>"}], layout({xaxis: {title: {text: "Probabilidade e contribuições (pontos percentuais)"}, gridcolor: "#edf1f5", zerolinecolor: "#b4c3d0"}, yaxis: {autorange: "reversed", automargin: true}}), plotConfig);
  $("feature-table").replaceChildren();
  for (const item of effects) {
    const tr = document.createElement("tr");
    for (const value of [item.name, number(item.value, 6), `${item.effect > 0 ? "+" : ""}${number(item.effect, 5)}`]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    $("feature-table").append(tr);
  }
}

function render() {
  if (tab === "importance") renderImportance();
  if (tab === "dependence") renderDependence();
  if (tab === "local") renderLocal();
}

function selectTab(name) {
  tab = name;
  for (const candidate of ["importance", "dependence", "local"]) {
    const selected = candidate === name;
    $(`tab-${candidate}`).setAttribute("aria-selected", String(selected));
    $(`tab-${candidate}`).tabIndex = selected ? 0 : -1;
    $(`panel-${candidate}`).hidden = !selected;
  }
  $("limit-control").hidden = name !== "importance";
  $("feature-control").hidden = name !== "dependence";
  $("filter-control").hidden = name !== "dependence";
  $("flow-control").hidden = name !== "local";
  render();
}

function downloadExplanation() {
  const cls = Number($("class-select").value);
  const row = Number($("flow-select").value);
  const lines = [["atributo", "valor_original", "shap_pp"], ...localEffects().map((r) => [r.name, r.value, r.effect]), ["referencia", "", data.base_values[cls] * 100], ["probabilidade_final", "", data.probabilities[row][cls] * 100]];
  const blob = new Blob([lines.map((line) => line.join(",")).join("\n")], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fluxo-${row + 1}-${data.classes[cls]}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function start() {
  try {
    const response = await fetch("dados.json");
    if (!response.ok) throw new Error("Os dados do painel não foram encontrados.");
    data = await response.json();
    if (data.schema_version !== 1 || data.features.length !== 29 || data.classes.length !== 3 || !data.labels.length || !window.Plotly) throw new Error("Os arquivos do painel estão incompletos.");
    for (const [i, name] of data.classes.entries()) {
      option($("class-select"), name, i);
      option($("filter-select"), name, i);
    }
    $("class-select").value = "2";
    data.features.forEach((name, i) => option($("feature-select"), name, i));
    data.labels.forEach((label, i) => option($("flow-select"), `Fluxo ${String(i + 1).padStart(3, "0")} · ${data.classes[label]}`, i));
    $("flow-select").value = String(data.labels.indexOf(2));
    $("sample-description").textContent = `${number(data.labels.length, 0)} fluxos do teste · ${data.features.length} atributos estatísticos`;
    for (const name of ["importance", "dependence", "local"]) $( `tab-${name}`).addEventListener("click", () => selectTab(name));
    for (const id of ["class-select", "limit-select", "feature-select", "filter-select", "flow-select"]) $(id).addEventListener("change", render);
    $("download").addEventListener("click", downloadExplanation);
    document.querySelector(".tabs").addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = ["importance", "dependence", "local"];
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
      event.preventDefault();
      selectTab(tabs[next]);
      $(`tab-${tabs[next]}`).focus();
    });
    $("loading").hidden = true;
    $("dashboard").hidden = false;
    render();
  } catch (error) {
    $("loading").hidden = true;
    $("error").hidden = false;
    $("error").textContent = `Não foi possível abrir o painel. ${error.message} Abra esta página por um servidor HTTP ou pelo GitHub Pages.`;
  }
}

start();
