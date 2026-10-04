# APURA 26

**Resultados eleitorais em tempo real — Eleições Gerais 2026**

Projeto independente criado por **Rodrigo Bahiense** para acompanhar, em uma interface visual e responsiva, os dados oficiais de totalização divulgados pelo Tribunal Superior Eleitoral (TSE).

> **Importante:** o APURA 26 não é um produto oficial do TSE, não realiza apuração própria, não faz projeções eleitorais e não declara vencedores por inferência. A interface apenas organiza e apresenta os dados públicos recebidos da fonte oficial.

---

## Visão geral

O APURA 26 foi pensado para funcionar bem em três cenários:

- **TV / telão:** números grandes, mapa nacional e rotação automática das principais telas;
- **desktop:** filtros, gráficos, mapa interativo e detalhes de candidatos;
- **mobile:** layout responsivo e navegação inferior otimizada para celular.

A identidade visual utiliza **glassmorphism**, transparência, animações discretas e modos claro/escuro, mantendo boa legibilidade sem parecer um painel institucional genérico.

---

## Recursos da versão atual

### Apuração

- atualização automática dos resultados oficiais;
- Presidente, Governador, Senador, Deputado Federal, Deputado Estadual e Deputado Distrital;
- filtros por Unidade da Federação;
- fotos oficiais dos candidatos disponibilizadas pelo TSE;
- cor visual associada ao partido do candidato;
- votos e percentual por candidato;
- seções totalizadas;
- votos computados e válidos;
- comparecimento e abstenção;
- votos brancos e nulos;
- gráficos animados de evolução;
- histórico local da sessão armazenado no navegador.

### Mapa eleitoral

- mapa do Brasil por Unidade da Federação;
- coloração pela candidatura com maior votação parcial em cada UF;
- modo alternativo de mapa por **percentual totalizado**;
- tooltip com candidato, percentual e avanço da apuração;
- clique na UF para abrir o resultado presidencial daquele estado.

### Exterior

- consulta da abrangência oficial `ZZ` do TSE;
- percentual totalizado;
- votos computados;
- comparecimento e abstenção;
- resultado presidencial agregado do eleitorado no exterior;
- nenhuma mistura entre boletins avulsos, imprensa e totalização oficial.

### Senado

Em 2026 são disputadas duas vagas por UF. O painel nacional mostra **54 cadeiras em disputa**.

Cada ponto recebe a cor do partido de um dos dois candidatos com maior votação parcial em sua UF naquele momento.

Isso é exibido explicitamente como **parcial**, e não como projeção da composição final do Senado.

### Câmara

Para cargos proporcionais, o projeto evita converter votação parcial em uma projeção própria de cadeiras. A tela de composição fica preparada para receber resultados oficiais de eleitos quando disponibilizados pelo TSE.

Enquanto isso, os votos para Deputado Federal podem ser acompanhados pelo filtro da tela de Apuração.

### Modo TV

O botão **TV**:

- solicita tela cheia ao navegador;
- remove controles secundários;
- amplia a área útil;
- inicia rotação automática entre Apuração, Exterior e Senado.

A rotação ocorre a cada 25 segundos.

---

## Fonte dos dados

O projeto utiliza a infraestrutura pública de divulgação de resultados do Tribunal Superior Eleitoral:

```text
https://resultados.tse.jus.br/oficial/ele2026/
```

Códigos oficiais utilizados no 1º turno de 2026:

| Eleição | Código |
|---|---:|
| Eleição Geral Federal — Presidente | `6257` |
| Eleições Gerais Estaduais | `6259` |

Códigos de cargo usados pela aplicação:

| Cargo | Código |
|---|---:|
| Presidente | `0001` |
| Governador | `0003` |
| Senador | `0005` |
| Deputado Federal | `0006` |
| Deputado Estadual | `0007` |
| Deputado Distrital | `0008` |

Exemplo de arquivo EA20 para Presidente do Brasil:

```text
https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json
```

Exemplo para Governador do Rio de Janeiro:

```text
https://resultados.tse.jus.br/oficial/ele2026/6259/dados/rj/rj-c0003-e006259-u.json
```

Fotos dos candidatos seguem o padrão oficial baseado no `sqcand` recebido no JSON:

```text
https://resultados.tse.jus.br/oficial/ele2026/{eleicao}/fotos/{abrangencia}/{sqcand}.jpeg
```

Documentação técnica oficial:

- https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados

O TSE informa limite de **100 requisições por IP por segundo**. O APURA 26 usa polling controlado e consultas em lotes para permanecer muito abaixo desse limite em uso normal.

---

## Atualização dos dados

A aplicação utiliza cadências diferentes conforme o custo da consulta:

| Dados | Intervalo |
|---|---:|
| resultado selecionado | 15 segundos |
| exterior | 30 segundos |
| mapa das UFs | 60 segundos |
| Senado nacional | sob demanda |

Quando a aba fica oculta, as consultas periódicas são pausadas para evitar requisições desnecessárias.

---

## Tecnologias

O projeto não possui etapa de build.

- HTML5;
- CSS3;
- JavaScript ES Modules;
- Chart.js;
- Leaflet;
- JSON oficial do TSE;
- `localStorage` para histórico visual do navegador.

Isso permite hospedar o projeto diretamente no **GitHub Pages**.

---

## Estrutura

```text
apura26/
├── index.html
├── README.md
├── LICENSE
├── .nojekyll
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
└── js/
    ├── app.js
    └── tse-api.js
```

Todos os arquivos principais possuem no cabeçalho do código o crédito:

```text
Aplicação criada por Rodrigo Bahiense — 2026.
```

---

## Rodando localmente

Por utilizar módulos JavaScript, é recomendado abrir a aplicação por um servidor HTTP local em vez de dar duplo clique no `index.html`.

Com Python:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

Também é possível usar qualquer servidor estático, como Live Server do VS Code.

---

## Publicando no GitHub Pages

1. Crie um novo repositório no GitHub, por exemplo `apura26`.
2. Envie o conteúdo desta pasta para a raiz do repositório.
3. Abra **Settings** do repositório.
4. Acesse **Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Escolha a branch `main` e a pasta `/ (root)`.
7. Salve.

Após a publicação, o GitHub fornecerá uma URL semelhante a:

```text
https://seu-usuario.github.io/apura26/
```

Não é necessário alterar caminhos no projeto: CSS, JavaScript e assets utilizam URLs relativas compatíveis com subdiretórios do GitHub Pages.

---

## Temas e identidade visual

O APURA 26 possui dois temas:

### Escuro

- fundo: `#080D18`;
- superfícies translúcidas;
- azul/ciano como destaque da interface;
- violeta em gradientes e animações.

### Claro

- fundo: `#EDF2F7`;
- cards translúcidos claros;
- mesmos elementos de destaque da versão escura.

As cores dos candidatos ficam separadas da identidade da aplicação. Quando há um partido conhecido na paleta, utiliza-se uma cor associada à identidade visual partidária; partidos sem configuração recebem uma cor estável gerada pela aplicação.

A legenda nunca depende somente da cor: nome do candidato e sigla partidária permanecem visíveis.

---

## Histórico dos gráficos

O TSE sobrescreve os arquivos de resultado ao longo da totalização. Para criar os gráficos de evolução sem um servidor próprio, o APURA 26 guarda snapshots no `localStorage` do navegador.

Isso significa que:

- o histórico começa a ser construído quando aquele navegador abre a aplicação;
- ao atualizar a página, o histórico continua disponível;
- outros usuários possuem históricos independentes;
- limpar os dados do navegador remove esse histórico.

Uma versão futura pode persistir snapshots centralmente usando um backend ou banco de dados.

---

## Limitações conhecidas / próximos passos

- implementar mapa municipal completo e colorido por candidato, carregado sob demanda por UF;
- detalhar o exterior por país/localidade após validar de forma segura o relacionamento oficial das localidades internacionais;
- integrar o EA10 para montar a composição confirmada da Câmara conforme os eleitos forem oficialmente atribuídos;
- usar EA14/EA15 de forma incremental para reduzir ainda mais consultas em mapas detalhados;
- permitir compartilhar uma tela específica através de parâmetros na URL;
- opção de personalizar o tempo da rotação do modo TV.

---

## Integridade eleitoral

O APURA 26 segue alguns princípios de implementação:

1. **Fonte oficial primeiro:** resultados vêm dos arquivos publicados pelo TSE.
2. **Sem previsão:** a aplicação não estima vencedores nem converte parcial em probabilidade eleitoral.
3. **Parcial é parcial:** uma candidatura estar à frente em determinado momento não significa resultado definitivo.
4. **Cargos proporcionais:** cadeiras não são projetadas por regra simplificada própria.
5. **Independência visual:** o projeto deixa explícito que não é uma aplicação oficial da Justiça Eleitoral.

---

## Autor

**Rodrigo Bahiense**

Criado em 2026.

---

## Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
