# Minhas Finanças: como instalar no iPhone

Seus dados ficam só no iPhone, no armazenamento do app. O GitHub hospeda apenas o código, sem nenhum dado seu.

## 1. Publicar no GitHub Pages (uma vez, pelo computador)

1. Crie uma conta em github.com, se ainda não tiver.
2. Clique em **+ → New repository**.
   - Nome: `financas` (ou outro)
   - Visibilidade: **Public**. No plano gratuito, o Pages só funciona com repositório público. O código fica visível, mas seus dados não.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **o conteúdo** da pasta `financas-app` (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest` e a pasta `icons`), não a pasta em si. Clique em **Commit changes**.
5. Vá em **Settings → Pages**.
   - Source: **Deploy from a branch**
   - Branch: **main**, pasta **/(root)** → **Save**.
6. Em 1 a 2 minutos, o endereço aparece no topo da página, no formato `https://SEU-USUARIO.github.io/financas/`.

## 2. Instalar no iPhone

1. Abra o endereço no **Safari**. Precisa ser o Safari.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone. A partir daí, funciona em modo avião.

## 3. Token da brapi (cotações de ações e FIIs)

1. Crie uma conta em brapi.dev e copie o token no painel (dashboard).
2. No app: **⚙️ Ajustes → Token → Salvar e testar token**.
3. Plano gratuito: 1 ativo por requisição, ~15 mil requisições/mês e atraso de ~30 min. Com 15 ativos e atualização ao abrir o app (no máximo a cada 30 min), sobra folga.
4. O dólar vem da AwesomeAPI, as criptomoedas da CoinGecko e o CDI do Banco Central. Nenhum deles precisa de token.

## 4. Backup (importante)

- **Ajustes → Exportar backup criptografado** → crie uma senha → salve em **Arquivos / iCloud Drive**.
- Se você apagar o app, trocar de iPhone ou limpar os dados do Safari, restaure por **Ajustes → Restaurar backup**.
- Sem a senha, o arquivo não abre. Não existe recuperação.
- O app avisa quando o último backup tiver mais de 30 dias.

## 5. Atualizar o app no futuro

1. No GitHub, abra o repositório → **Add file → Upload files** → arraste os arquivos novos **soltos**, sem a pasta `financas-app`, para que eles substituam os antigos na raiz → **Commit changes**.
2. Espere 1 a 2 minutos. O andamento aparece na aba **Actions** do repositório: espere ficar verde.
3. Abra o app com internet. Ele baixa a versão nova e recarrega sozinho.
4. Para conferir, veja o número da versão no fim de **Ajustes**. Se não mudou, toque em **Buscar versão nova do app**. Seus dados não são apagados.

## Como cada investimento é calculado

| Tipo | Nicho | Valor atual |
|---|---|---|
| Ação | Ações | quantidade × preço da brapi (ou preço médio, se ainda não tiver cotação) |
| FII | FIIs e Terrenos | quantidade × preço da brapi |
| Terreno | FIIs e Terrenos | valor estimado que você informa |
| Caixa com rendimento | Caixa | saldo que você informa; o % do CDI fica registrado e o app mostra a taxa equivalente ao ano |
| Caixa sem rendimento | Caixa | saldo que você informa (conta corrente, espécie) |
| Dólar | Dólar e Cripto | US$ × cotação atual do dólar |
| Cripto | Dólar e Cripto | quantidade × preço em R$ da CoinGecko (sem token) |
