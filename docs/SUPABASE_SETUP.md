# UEBEY V1 — Supabase setup

A V1 usa Supabase Auth + Postgres. O frontend já está preparado; enquanto `public/config.js` estiver vazio, o site continua em modo V0/localStorage.

## 1. Criar o projeto

No Supabase Dashboard, crie um projeto chamado `uebey` (ou `uebey-prod`).

- Region: South America (São Paulo / `sa-east-1`) se disponível.
- Use uma senha forte e exclusiva para o banco.
- Guarde a senha do banco fora do repositório.

## 2. Criar banco e políticas

Abra **SQL Editor** no projeto Supabase e execute todo o conteúdo de:

`supabase/schema.sql`

Isso cria:

- tabela `public.profiles`;
- username único;
- políticas RLS;
- leitura pública apenas de páginas publicadas;
- escrita apenas pelo proprietário autenticado;
- função pública segura para verificar disponibilidade de username.

## 3. Configurar autenticação

Em **Authentication > URL Configuration**:

- Site URL: use primeiro a URL atual do Worker UEBEY (`https://...workers.dev`).
- Redirect URLs: adicione a mesma origem com `/**` ou, no mínimo, `/dashboard` conforme a interface oferecida pelo Supabase.

Quando `uebey.com` for conectado, troque/adicionalmente autorize `https://uebey.com/**`.

Mantenha confirmação de email habilitada no MVP.

## 4. Obter os valores públicos do projeto

No Supabase Dashboard, abra a área de API/keys do projeto e copie:

- Project URL
- Publishable key

NÃO use `service_role` no navegador. A `service_role` ignora RLS e deve permanecer secreta.

## 5. Conectar o frontend

Atualize `public/config.js`:

```js
window.UEBEY_CONFIG = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabasePublishableKey: 'SUA-PUBLISHABLE-KEY'
};
```

Depois do commit, o Cloudflare fará novo deploy automaticamente.

## 6. Teste de ponta a ponta

1. Abra a home.
2. Escolha um username livre.
3. Clique em **Criar minha página**.
4. Crie uma conta por email/senha.
5. Confirme o email.
6. Entre novamente.
7. Complete nome, bio e links.
8. Publique.
9. Abra a página em janela anônima.
10. Confirme que outro usuário não consegue editar essa página.

## Segurança do MVP

- Nunca colocar `service_role` no frontend/GitHub.
- O navegador usa somente a publishable key.
- RLS é a barreira principal entre contas.
- Cada conta possui uma página na V1.
- Upload de foto/storage será adicionado depois de auth + banco estarem validados.
