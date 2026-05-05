# Projeto: Portfolio BEA.TECH — Beatriz Reis

## Site no ar
- **Vercel (principal):** `projetos-neon-kappa.vercel.app` → em processo de renomear para `beatrizreis.vercel.app`
- **GitHub Pages:** `beareisfarma.github.io/Projetos/portfolio-v1/`

## Repositório
- **Repo:** `beareisfarma/Projetos`
- **Branch de produção Vercel:** `claude/create-portfolio-folder-WjVJ3`  
  → arquivo servido: `portfólio/index.html`
- **Branch GitHub Pages:** `gh-pages`  
  → arquivo servido: `portfolio-v1/index.html`
- **Branch de trabalho:** `gh-pages-update` (local, aponta para `gh-pages`)

## Fluxo de deploy
1. Editar `portfolio-v1/index.html` no branch `gh-pages-update`
2. `git push origin gh-pages-update:gh-pages` → atualiza GitHub Pages
3. Copiar o arquivo para `portfólio/index.html` e push para `claude/create-portfolio-folder-WjVJ3` → atualiza Vercel

## Stack
- HTML/CSS/JS puro — site estático, sem framework
- Fontes: Bebas Neue + Manrope (Google Fonts)
- Imagens: base64 embutidas no HTML
- Tema: toggle dark/light via CSS variables + localStorage

## O que foi construído
- Site portfólio completo da Beatriz Reis (BEA.TECH)
- Acento laranja `#DA7756`, fundo escuro `#0c0c14`
- Toggle dark/light — mesmo conteúdo, troca só as cores (botão fixo canto inferior direito)
- Barra sticky de navegação (aparece ao rolar, esconde links do nav principal)
- Setores de clientes: Clínicas · Varejo · Imobiliário · Advocacia · Farmacêutico

## Projetos exibidos
1. **Projeto 01** — SaaS de gestão para representantes farmacêuticos
2. **Projeto 02** — Finances Control (dashboard financeiro)
3. **Projeto 03** — Bot Assistente / Secretaria Virtual (WhatsApp/Telegram)  
   → imagem real do bot "Clínica atual" (Telegram, endereço ocultado)
4. **Projeto Pharma** — Ferramenta clínica confidencial (NDA)
