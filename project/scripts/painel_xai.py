"""Painel interativo de explicabilidade, como o da Seção VI-C do artigo.

Lê data/processed/cira.parquet, separa 10% para teste com a seed 42, ajusta o
sistema na leitura de profundidade variável e sobe o painel do
explainerdashboard sobre o Random Forest do primeiro subconjunto, com uma
amostra estratificada do teste, de até 333 fluxos por classe. O modelo é
treinado na memória a cada execução: nenhum modelo é gravado nem lido do disco,
e o painel não grava resultado.

O painel é material de demonstração; os números do relatório vêm de
scripts/e5_xai.py. Os atributos aparecem normalizados em [0, 1], que é o que o
modelo recebe. O treino e o cálculo dos valores SHAP levam alguns minutos antes
de o endereço responder. Para encerrar, Ctrl+C.

Uso: uv run python scripts/painel_xai.py

Exportação para a versão web, sem iniciar o servidor Python:
    uv run python scripts/painel_xai.py --export-web ../painel/dados.json --export-only
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from explainerdashboard import ClassifierExplainer, ExplainerDashboard

from doh_ids.config import (
    CIRA_PARQUET_PATH,
    CLASS_NAMES,
    DASHBOARD_HOST,
    DASHBOARD_PORT,
    DASHBOARD_SAMPLE_PER_CLASS,
    EXPLAINED_BASE,
    FEATURE_COLUMNS,
    MAX_DEPTH_VARIABLE,
    SEED_FIEL,
)
from doh_ids.data import feature_matrix
from doh_ids.explain import forest_shap_values, stratified_sample
from doh_ids.splits import stratified_split
from doh_ids.system import fit_system


def build_dashboard(table: pd.DataFrame) -> ExplainerDashboard:
    """Treina o sistema sobre `table` e monta o painel, sem abrir o servidor.

    `table` tem os atributos do modelo e `label`. O painel explica um Random
    Forest base nas linhas de uma amostra do teste.
    """
    # O teste é separado antes do ajuste e só é lido para ser explicado.
    train, test = stratified_split(table, SEED_FIEL)
    scaler, stacked, _, _ = fit_system(train, SEED_FIEL, MAX_DEPTH_VARIABLE)
    sample = stratified_sample(test, DASHBOARD_SAMPLE_PER_CLASS, SEED_FIEL)
    X = pd.DataFrame(scaler.transform(feature_matrix(sample)), columns=FEATURE_COLUMNS)

    # O SHAP não aceita o modelo empilhado: o painel explica o Random Forest do
    # primeiro subconjunto, o mesmo das figuras estáticas. A classe em destaque
    # ao abrir é Malicious-DoH; as outras são escolhidas na própria página.
    explainer = ClassifierExplainer(
        stacked.clfs_[EXPLAINED_BASE],
        X,
        sample["label"].reset_index(drop=True),
        shap="tree",
        labels=CLASS_NAMES,
        pos_label=CLASS_NAMES.index("Malicious-DoH"),
    )
    # Ficam as abas que correspondem às figuras do artigo: importância (Fig. 5),
    # dependência (Fig. 6) e contribuições de um fluxo (Figs. 7 e 8). As métricas
    # de desempenho ficam de fora porque a amostra tem as classes em partes
    # iguais e não mede o modelo; as demais, pelo custo de cálculo.
    return ExplainerDashboard(
        explainer,
        title="Explicação do Random Forest base (Balanced Stacked Random Forest)",
        importances=True,
        shap_dependence=True,
        contributions=True,
        model_summary=False,
        whatif=False,
        shap_interaction=False,
        decision_trees=False,
        no_permutations=True,
    )


def export_web(dashboard: ExplainerDashboard, table: pd.DataFrame, output: Path) -> None:
    """Exporta explicações reais para consulta no navegador, sem modelo serializado.

    A amostra é a mesma do painel Python. O arquivo contém somente os 29
    atributos estatísticos, classes, probabilidades e valores SHAP do primeiro
    Random Forest base. Índices originais, IPs, portas e horários não são exportados.
    """
    _, test = stratified_split(table, SEED_FIEL)
    sample = stratified_sample(test, DASHBOARD_SAMPLE_PER_CLASS, SEED_FIEL)
    normalized = dashboard.explainer.X.to_numpy()
    labels = sample["label"].to_numpy()
    assert np.array_equal(labels, np.asarray(dashboard.explainer.y))
    values, base = forest_shap_values(dashboard.explainer.model, normalized)
    probabilities = dashboard.explainer.model.predict_proba(normalized)
    assert np.allclose(base + values.sum(axis=1), probabilities, atol=1e-6)
    payload = {
        "schema_version": 1,
        "dataset": "CIRA-CIC-DoHBrw-2020",
        "seed": SEED_FIEL,
        "model": "Random Forest base 1, profundidade variável",
        "classes": CLASS_NAMES,
        "features": FEATURE_COLUMNS,
        "values": feature_matrix(sample).round(11).to_numpy().tolist(),
        "labels": labels.tolist(),
        "probabilities": probabilities.round(11).tolist(),
        "shap": values.round(11).tolist(),
        "base_values": base.round(11).tolist(),
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Explicações de {len(sample)} fluxos exportadas para {output}", flush=True)


def main() -> None:
    """Monta o painel com dados reais; opcionalmente exporta a versão web."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-web", type=Path, help="Arquivo JSON para o painel web")
    parser.add_argument("--export-only", action="store_true", help="Exporta sem abrir servidor")
    args = parser.parse_args()
    if args.export_only and args.export_web is None:
        parser.error("--export-only requer --export-web")
    table = pd.read_parquet(CIRA_PARQUET_PATH)
    print("Treinando o sistema e calculando as explicações do painel...", flush=True)
    dashboard = build_dashboard(table)
    if args.export_web:
        export_web(dashboard, table, args.export_web)
    if args.export_only:
        return
    print(f"Painel em http://{DASHBOARD_HOST}:{DASHBOARD_PORT}")
    dashboard.run(port=DASHBOARD_PORT, host=DASHBOARD_HOST)


if __name__ == "__main__":
    main()
