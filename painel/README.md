# Painel web de explicabilidade

Versão para GitHub Pages do painel do projeto. A aplicação explora valores SHAP e probabilidades calculados pelo primeiro Random Forest base, na leitura de profundidade variável, em uma amostra do teste do CIRA. Permite escolher uma classe, consultar a importância global, explorar qualquer um dos 29 atributos e examinar a explicação de cada fluxo da amostra.

O navegador usa os dados já calculados em `dados.json`. Não treina modelos nem classifica novos arquivos. O painel Python completo permanece em `project/scripts/painel_xai.py`.

## Abrir localmente

Na raiz do repositório:

```bash
python3 -m http.server 8080 --directory painel
```

Abra http://127.0.0.1:8080. A pasta pode ser hospedada como está, sem instalar Node.js nem executar Python no servidor de publicação.

## Atualizar os dados

Com o ambiente e o CIRA preparado em `project/data/processed/cira.parquet`:

```bash
cd project
uv run python scripts/painel_xai.py --export-web ../painel/dados.json --export-only
```

A exportação repete o treino do sistema com a seed 42 e usa a mesma amostra do painel Python. O JSON contém atributos estatísticos, classes, probabilidades e explicações; não contém IPs, portas, horários nem um modelo serializado. As contribuições são conferidas contra as probabilidades do Random Forest antes da gravação.

## Publicar no novo repositório

1. Envie os arquivos do projeto para o repositório público, incluindo `painel/` e `.github/workflows/painel-pages.yml`.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Em **Actions**, abra **Publicar painel no GitHub Pages** e execute **Run workflow**.
4. Use o endereço retornado pelo job `publicar` e acrescente o link ao README principal.

O workflow é manual para que o repositório de rascunho não publique automaticamente. Apenas a pasta `painel/` é enviada ao Pages. A configuração segue a [documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Biblioteca dos gráficos

Os gráficos usam Plotly.js, incluído em `vendor/` para funcionar sem CDN. A licença MIT da biblioteca está em `vendor/LICENSE-plotly.txt`. Os dados e as explicações vêm do projeto; as métricas do relatório continuam sendo as registradas em `project/results/`.
