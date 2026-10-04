# APURA 26 — Apuração Eleitoral 2026

Painel independente, responsivo e em tempo real para acompanhar a totalização oficial das Eleições Gerais de 2026.

**Criado por Rodrigo Bahiense.**

> O APURA 26 não é um produto oficial do Tribunal Superior Eleitoral. Os resultados exibidos são consumidos dos arquivos públicos de divulgação do TSE.

## O que há na v2.4

- interface compacta em uma única tela, pensada para TV;
- modo claro e escuro;
- layout responsivo para celular e tablet;
- atualização automática da totalização;
- fotos oficiais dos candidatos;
- cores partidárias como apoio visual;
- mapa do Brasil por UF;
- visões de **Estados**, **Vantagem**, **Por candidato** e **Municípios**;
- **Governadores** por UF;
- **Senado** com duas posições por UF e bandeiras estaduais;
- **Câmara** com vagas atribuídas oficialmente pelo TSE, sem projeção própria;
- **Internacional** com resultado agregado do exterior e localidades oficiais do EA12;
- bandeiras de países quando a localidade internacional pode ser associada com segurança;
- histórico da apuração salvo no navegador;
- tela cheia com visão fixa; as atualizações automáticas preservam a aba escolhida;
- busca por estado, município e candidato.

## Fonte de dados

O projeto usa a estrutura pública de divulgação do TSE para 2026:

- Ambiente: `https://resultados.tse.jus.br/oficial/ele2026/`
- Eleição federal: `6257`
- Eleições estaduais: `6259`
- Resultado unificado: EA20
- Configuração de municípios/localidades do exterior: EA12

Exemplo — Presidente/Brasil:

```text
https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json
```

A aplicação consulta somente os arquivos necessários e atualiza os panoramas estaduais em intervalos maiores, evitando polling agressivo.

## Abrir agora no Windows

Extraia a pasta e execute:

```text
INICIAR_APURA26.bat
```

O script inicia um servidor local na porta `8765` e abre o navegador automaticamente.

Também é possível iniciar manualmente:

```bash
python -m http.server 8765
```

Depois acesse:

```text
http://localhost:8765
```

Para colocar na televisão, clique em **Tela cheia**.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `apura26`.
2. Envie todo o conteúdo desta pasta para a raiz do repositório.
3. Abra **Settings → Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione `main` e `/ (root)`.
6. Aguarde a publicação.

O endereço ficará semelhante a:

```text
https://seuusuario.github.io/apura26/
```

Não existe etapa de build, `npm install` ou backend obrigatório.

## Estrutura

```text
apura26-v2/
├── index.html
├── README.md
├── LICENSE
├── .nojekyll
├── INICIAR_APURA26.bat
├── assets/
│   ├── apura26-logo.png
│   └── favicon.png
├── css/
│   └── styles.css
└── js/
    ├── app.js
    └── tse-api.js
```

## Regras adotadas

- nenhum resultado eleitoral é inventado ou preenchido com dados de demonstração;
- o painel não declara vencedor apenas porque alguém está na frente na parcial;
- a Câmara mostra somente vagas atribuídas pelos dados oficiais, sem cálculo próprio de projeção;
- Senado mostra os dois candidatos mais votados na parcial de cada UF e identifica a visualização como parcial;
- quando a fonte estiver indisponível, a interface informa a falha em vez de substituir por dados fictícios.

## Créditos

**APURA 26**  
Criado por **Rodrigo Bahiense** — 2026.

Dados eleitorais: Tribunal Superior Eleitoral (TSE).

As bandeiras estaduais são carregadas do projeto aberto `akagabi/bandeira-dos-estados-do-brasil` (MIT). A malha estadual é carregada do conjunto aberto `codeforamerica/click_that_hood`.


## Ajustes da v2.4

- Corrige o fallback de foto que aparecia como um círculo de iniciais por cima/abaixo dos candidatos.
- Aumenta fontes e áreas úteis dos cards para leitura em TV.
- Senado reorganizado em 4 colunas no desktop, com bandeiras de UF maiores e nomes menos truncados.
- Internacional passa a exibir bandeiras dos países/localidades reconhecidas, com fallback em emoji.
- A visão **Por candidato** colore cada UF com a cor partidária do candidato que lidera a parcial naquele estado.
- Atualizações automáticas não trocam mais de aba. A última aba escolhida é preservada, inclusive após F5.
- O botão da timeline não ativa mais rotação automática de cargos.


## Ajustes de legibilidade da v2.4

- Painel de candidatos redesenhado em **duas colunas de cards horizontais**, com foto, nome, partido e percentual legíveis a distância.
- Coluna esquerda ampliada e percentual de seções destacado sem sobreposição de elementos.
- Senado reduzido para **3 UFs por linha** em telas largas e 2 em resoluções menores, priorizando leitura dos nomes.
- Internacional usa **bandeiras em emoji**, eliminando dependência de CDN externa para que apareçam também na TV e no GitHub Pages.
- Mantida a aba atual durante todas as atualizações automáticas.


## v2.4

- Card de candidatos ampliado até o fim da coluna esquerda.
- Gráfico “Ao longo da apuração” ocultado para priorizar leitura na TV.
- Card “Últimas atualizações” ocultado.
- “Por região” ampliado para exibir as cinco regiões e Exterior no mesmo card em telas grandes.
- Internacional usa imagens reais de bandeiras dos países, com fallback por código ISO.

Criado por **Rodrigo Bahiense**.


## v2.4 — atualização ao vivo no GitHub Pages

- As consultas aos JSONs oficiais do TSE usam cache-buster para evitar resposta antiga de CDN/browser.
- O cabeçalho separa a hora do arquivo oficial (`TSE HH:MM:SS`) da hora da última leitura (`consultado HH:MM:SS`).
- A aba ativa é atualizada a cada 8 segundos e os panoramas por UF a cada 45 segundos.
- Ao voltar para a aba do navegador ou recuperar a conexão, o painel atualiza imediatamente.
