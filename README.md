# UEBEY V0

UEBEY é uma prova de conceito de páginas pessoais como contas: uma pessoa escolhe um `username`, preenche poucos dados e publica uma página em `uebey.com/username`.

## O que esta V0 faz

- Home com `Claim your page` / escolha de username.
- Validação básica de nomes reservados e nomes já usados.
- Editor simples com nome, título, bio e links.
- Três estilos visuais: Minimal, Dark e Warm.
- Publicação imediata de uma página dinâmica em `/username`.
- Perfis-demo em `/rodrigo` e `/carlosmagico`.
- Persistência local via `localStorage` apenas para validar UX sem banco.
- Fallback de rotas para Cloudflare Pages via `_redirects`.

## Importante sobre a V0

Esta versão **não tem autenticação nem banco de dados real**. Páginas criadas pelo visitante ficam apenas no navegador/dispositivo em que foram criadas. Isso é intencional: a V0 serve para validar o fluxo e o design antes de adicionarmos Supabase.

## Publicar no Cloudflare Pages

Este projeto é estático e não usa framework nem etapa real de compilação.

Configuração sugerida:

- Framework preset: `None`
- Production branch: `main`
- Build command: `exit 0`
- Build output directory: `.`
- Root directory: manter o padrão (raiz do repositório)

Depois do primeiro deploy, a Cloudflare fornecerá um endereço `*.pages.dev`. Teste nele antes de associar `uebey.com`.

## Próxima etapa — V1

Migrar a persistência de `localStorage` para Supabase:

1. Supabase Auth (cadastro/login/confirmação de email)
2. PostgreSQL (`profiles`, `links`, `pages`)
3. Row Level Security (cada usuário altera apenas sua página)
4. Supabase Storage (foto/avatar)
5. Publicação real compartilhada entre dispositivos
6. Painel do usuário
7. Painel administrativo básico
8. Turnstile / rate limiting

## Arquitetura alvo

```text
GitHub
  ↓
Cloudflare
  ↓
UEBEY frontend / routing
  ↓
Supabase
├── Auth
├── PostgreSQL
└── Storage
```

## Segurança

Nunca coloque service-role keys, senhas ou segredos no repositório. A futura V1 usará variáveis de ambiente e políticas RLS.
