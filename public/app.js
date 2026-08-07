const app = document.querySelector('#app');
const navHome = document.querySelector('#nav-home');
const navAccount = document.querySelector('#nav-account');

const RESERVED = new Set([
  'admin','api','app','assets','auth','blog','dashboard','edit','help','login','logout',
  'pricing','privacy','reset-password','signup','support','terms','uebey'
]);

const config = window.UEBEY_CONFIG || {};
const hasSupabaseConfig = Boolean(
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  window.supabase?.createClient
);
const supabaseClient = hasSupabaseConfig
  ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
  : null;

const demoProfiles = {
  rodrigo: {
    username: 'rodrigo',
    display_name: 'Rodrigo Sucupira',
    headline: 'Quant Research · Python · Finance',
    bio: 'Pesquisa quantitativa, sistemas e ideias aplicadas ao mercado financeiro.',
    instagram: '', whatsapp: '', linkedin: 'https://www.linkedin.com/',
    website: 'https://github.com/rsucupira', theme: 'minimal', published: true
  },
  carlosmagico: {
    username: 'carlosmagico', display_name: 'Carlos Batista',
    headline: 'Mágica ao vivo para eventos',
    bio: 'Transforme seu evento em uma experiência inesquecível.',
    instagram: 'https://www.instagram.com/', whatsapp: '', linkedin: '',
    website: '', theme: 'dark', published: true
  }
};

function normalizeUsername(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .replace(/[._-]{2,}/g, '-')
    .slice(0, 30);
}

function getStoredProfiles() {
  try { return JSON.parse(localStorage.getItem('uebey-v0-profiles') || '{}'); }
  catch { return {}; }
}

function saveLocalProfile(profile) {
  const profiles = getStoredProfiles();
  profiles[profile.username] = profile;
  localStorage.setItem('uebey-v0-profiles', JSON.stringify(profiles));
}

function findLocalProfile(username) {
  return getStoredProfiles()[username] || demoProfiles[username] || null;
}

function navigate(path) {
  history.pushState({}, '', path);
  renderRoute();
}

function setTheme(theme = 'minimal') {
  document.body.classList.remove('theme-dark', 'theme-warm');
  if (theme === 'dark') document.body.classList.add('theme-dark');
  if (theme === 'warm') document.body.classList.add('theme-warm');
}

function cloneTemplate(id) {
  return document.querySelector(id).content.cloneNode(true);
}

function setLoading(message = 'Carregando...') {
  setTheme('minimal');
  const wrap = document.createElement('section');
  wrap.className = 'not-found';
  const p = document.createElement('p');
  p.textContent = message;
  wrap.appendChild(p);
  app.replaceChildren(wrap);
}

function setHeaderUser(user) {
  navAccount.textContent = user ? 'Minha conta' : 'Entrar';
}

async function currentUser() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

async function initializeHeader() {
  setHeaderUser(await currentUser());
}

async function usernameAvailable(username) {
  if (!username || username.length < 3 || RESERVED.has(username)) return false;
  if (!supabaseClient) return !findLocalProfile(username);

  const { data, error } = await supabaseClient.rpc('username_available', { candidate: username });
  if (error) throw error;
  return Boolean(data);
}

async function getAccount(userId) {
  if (!supabaseClient || !userId) return null;
  const { data, error } = await supabaseClient
    .from('accounts')
    .select('user_id,plan,page_limit,status,created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getOwnPages(userId) {
  if (!supabaseClient || !userId) return [];
  const { data, error } = await supabaseClient
    .from('pages')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getOwnedPage(userId, username) {
  if (!supabaseClient || !userId || !username) return null;
  const { data, error } = await supabaseClient
    .from('pages')
    .select('*')
    .eq('owner_id', userId)
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPublicPage(username) {
  if (!supabaseClient) return findLocalProfile(username);
  const { data, error } = await supabaseClient
    .from('pages')
    .select('id,username,display_name,headline,bio,instagram,whatsapp,linkedin,website,theme,published')
    .eq('username', username)
    .eq('published', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function renderHome() {
  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#home-template'));

  const form = document.querySelector('#claim-form');
  const input = document.querySelector('#claim-username');
  const feedback = document.querySelector('#claim-feedback');
  let requestId = 0;

  const updateFeedback = async () => {
    const id = ++requestId;
    const username = normalizeUsername(input.value);
    if (input.value !== username) input.value = username;
    feedback.className = 'feedback';

    if (!username) {
      feedback.textContent = 'Use letras, números, ponto, hífen ou underline.';
      return false;
    }
    if (username.length < 3) {
      feedback.textContent = 'Escolha pelo menos 3 caracteres.';
      feedback.classList.add('bad');
      return false;
    }
    if (RESERVED.has(username)) {
      feedback.textContent = `uebey.com/${username} é um endereço reservado.`;
      feedback.classList.add('bad');
      return false;
    }

    feedback.textContent = 'Verificando disponibilidade...';
    try {
      const available = await usernameAvailable(username);
      if (id !== requestId) return false;
      feedback.textContent = available
        ? `✓ uebey.com/${username} está disponível.`
        : `uebey.com/${username} já está em uso.`;
      feedback.classList.add(available ? 'good' : 'bad');
      return available;
    } catch {
      if (id !== requestId) return false;
      feedback.textContent = 'Não foi possível verificar agora. Tente novamente.';
      feedback.classList.add('bad');
      return false;
    }
  };

  input.addEventListener('input', updateFeedback);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = normalizeUsername(input.value);
    const available = await usernameAvailable(username).catch(() => false);
    if (!available) {
      await updateFeedback();
      return;
    }

    localStorage.setItem('uebey-pending-claim', username);

    if (!supabaseClient) {
      sessionStorage.setItem('uebey-v0-claim', username);
      navigate(`/edit/${username}`);
      return;
    }

    const user = await currentUser();
    navigate(user ? `/edit/${username}` : '/signup');
  });
}

function renderAuth(mode = 'login') {
  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#auth-template'));

  const signup = mode === 'signup';
  const pending = localStorage.getItem('uebey-pending-claim');
  document.querySelector('#auth-title').textContent = signup ? 'Criar conta' : 'Entrar';
  document.querySelector('#auth-copy').textContent = signup
    ? (pending ? `Crie sua conta para continuar com uebey.com/${pending}.` : 'Crie sua conta UEBEY.')
    : 'Acesse suas páginas e edite quando quiser.';

  const form = document.querySelector('#auth-form');
  const feedback = document.querySelector('#auth-feedback');
  const submit = document.querySelector('#auth-submit');
  const switchButton = document.querySelector('#auth-switch');
  const forgotButton = document.querySelector('#auth-forgot');
  const resendButton = document.querySelector('#auth-resend');
  const password = form.elements.namedItem('password');
  const emailField = form.elements.namedItem('email');

  submit.textContent = signup ? 'Criar conta' : 'Entrar';
  switchButton.textContent = signup ? 'Já tenho uma conta' : 'Ainda não tenho conta';
  password.autocomplete = signup ? 'new-password' : 'current-password';
  forgotButton.hidden = signup;
  resendButton.hidden = !signup;

  switchButton.addEventListener('click', () => navigate(signup ? '/login' : '/signup'));

  forgotButton.addEventListener('click', async () => {
    const email = String(emailField.value || '').trim();
    feedback.className = 'feedback';
    if (!email) {
      feedback.textContent = 'Digite seu email acima para receber o link de recuperação.';
      feedback.classList.add('bad');
      emailField.focus();
      return;
    }
    try {
      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password`
      });
      if (error) throw error;
      feedback.textContent = 'Se esse email estiver cadastrado, você receberá um link para redefinir a senha.';
      feedback.classList.add('good');
    } catch {
      feedback.textContent = 'Não foi possível solicitar a recuperação agora. Tente novamente.';
      feedback.classList.add('bad');
    }
  });

  resendButton.addEventListener('click', async () => {
    const email = String(emailField.value || '').trim();
    feedback.className = 'feedback';
    if (!email) {
      feedback.textContent = 'Digite seu email acima para reenviar a confirmação.';
      feedback.classList.add('bad');
      emailField.focus();
      return;
    }
    try {
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${location.origin}/dashboard` }
      });
      if (error) throw error;
      feedback.textContent = 'Se houver um cadastro aguardando confirmação, um novo email será enviado.';
      feedback.classList.add('good');
    } catch {
      feedback.textContent = 'Não foi possível reenviar agora. Aguarde um pouco e tente novamente.';
      feedback.classList.add('bad');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.className = 'feedback';

    if (!supabaseClient) {
      feedback.textContent = 'A autenticação ainda não está conectada.';
      feedback.classList.add('bad');
      return;
    }

    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const passwordValue = String(data.get('password') || '');
    submit.disabled = true;
    submit.textContent = signup ? 'Criando...' : 'Entrando...';

    try {
      if (signup) {
        const { data: result, error } = await supabaseClient.auth.signUp({
          email,
          password: passwordValue,
          options: {
            emailRedirectTo: `${location.origin}/dashboard`,
            data: { claimed_username: pending || null }
          }
        });
        if (error) throw error;

        if (result.session) {
          navigate(pending ? `/edit/${pending}` : '/dashboard');
          return;
        }

        feedback.textContent = 'Confira seu email para confirmar o cadastro. Se você já possui conta, entre ou recupere sua senha.';
        feedback.classList.add('good');
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: passwordValue });
        if (error) throw error;
        navigate(pending ? `/edit/${pending}` : '/dashboard');
      }
    } catch (error) {
      feedback.textContent = signup
        ? 'Não foi possível concluir o cadastro agora. Confira os dados ou tente novamente.'
        : (error?.message || 'Email ou senha inválidos.');
      feedback.classList.add('bad');
    } finally {
      submit.disabled = false;
      submit.textContent = signup ? 'Criar conta' : 'Entrar';
    }
  });
}

function renderResetPassword() {
  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#reset-password-template'));
  const form = document.querySelector('#reset-password-form');
  const feedback = document.querySelector('#reset-password-feedback');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirmation = String(data.get('password_confirmation') || '');
    feedback.className = 'feedback';

    if (password !== confirmation) {
      feedback.textContent = 'As senhas não são iguais.';
      feedback.classList.add('bad');
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      feedback.textContent = error.message || 'Não foi possível alterar a senha.';
      feedback.classList.add('bad');
      return;
    }

    feedback.textContent = 'Senha alterada. Você já pode acessar sua conta.';
    feedback.classList.add('good');
    setTimeout(() => navigate('/dashboard'), 700);
  });
}

function pageActionButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function renderDashboard() {
  setLoading();
  if (!supabaseClient) {
    renderAuth('login');
    return;
  }

  const user = await currentUser();
  if (!user) {
    navigate('/login');
    return;
  }

  let account;
  let pages;
  try {
    [account, pages] = await Promise.all([getAccount(user.id), getOwnPages(user.id)]);
  } catch {
    renderNotFound('dashboard', 'Não foi possível carregar seu dashboard.');
    return;
  }

  if (!account) {
    renderNotFound('dashboard', 'Sua conta ainda não está pronta. Atualize a página em alguns segundos.');
    return;
  }

  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#dashboard-template'));
  document.querySelector('#dashboard-email').textContent = user.email || '';
  const card = document.querySelector('#dashboard-card');

  const summary = document.createElement('div');
  summary.className = 'account-summary';
  const plan = document.createElement('span');
  plan.className = 'plan-badge';
  plan.textContent = `Plano ${account.plan}`;
  const quota = document.createElement('strong');
  quota.textContent = `${pages.length} de ${account.page_limit} página${account.page_limit === 1 ? '' : 's'} utilizada${pages.length === 1 ? '' : 's'}`;
  const status = document.createElement('span');
  status.className = 'account-status';
  status.textContent = account.status === 'active' ? 'Conta ativa' : `Conta ${account.status}`;
  summary.append(plan, quota, status);
  card.appendChild(summary);

  const list = document.createElement('div');
  list.className = 'page-list';

  if (!pages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-pages';
    const title = document.createElement('h2');
    title.textContent = 'Você ainda não tem uma página.';
    const copy = document.createElement('p');
    copy.textContent = 'Escolha um endereço e publique sua primeira UEBEY.';
    empty.append(title, copy);
    list.appendChild(empty);
  }

  pages.forEach((page) => {
    const item = document.createElement('article');
    item.className = 'page-item';

    const meta = document.createElement('div');
    meta.className = 'page-item-meta';
    const title = document.createElement('h2');
    title.textContent = `uebey.com/${page.username}`;
    const state = document.createElement('span');
    state.className = `status-pill ${page.published ? 'is-live' : ''}`;
    state.textContent = page.published ? 'Publicada' : 'Rascunho';
    meta.append(title, state);

    const actions = document.createElement('div');
    actions.className = 'page-item-actions';
    actions.append(
      pageActionButton('Ver', 'secondary-button', () => navigate(`/${page.username}`)),
      pageActionButton('Editar', 'secondary-button', () => navigate(`/edit/${page.username}`)),
      pageActionButton(page.published ? 'Despublicar' : 'Publicar', 'secondary-button', async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const { error } = await supabaseClient
          .from('pages')
          .update({ published: !page.published })
          .eq('id', page.id);
        if (error) button.disabled = false;
        else renderDashboard();
      })
    );

    item.append(meta, actions);
    list.appendChild(item);
  });

  card.appendChild(list);

  const controls = document.createElement('div');
  controls.className = 'dashboard-footer-actions';
  const canCreate = account.status === 'active' && pages.length < account.page_limit;
  const create = pageActionButton(
    canCreate ? '+ Criar outra página' : 'Limite de páginas atingido',
    'primary-button',
    () => navigate('/')
  );
  create.disabled = !canCreate;
  controls.appendChild(create);

  if (!canCreate && account.status === 'active') {
    const limitCopy = document.createElement('p');
    limitCopy.className = 'quota-note';
    limitCopy.textContent = `Seu plano atual permite ${account.page_limit} página${account.page_limit === 1 ? '' : 's'}. O limite poderá ser ampliado por plano sem alterar sua conta.`;
    controls.appendChild(limitCopy);
  }

  const logout = pageActionButton('Sair da conta', 'text-button', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('uebey-pending-claim');
    navigate('/');
  });
  controls.appendChild(logout);
  card.appendChild(controls);

  const pending = normalizeUsername(localStorage.getItem('uebey-pending-claim') || '');
  if (pending && canCreate) {
    localStorage.removeItem('uebey-pending-claim');
    navigate(`/edit/${pending}`);
  }
}

async function renderEditor(username) {
  setTheme('minimal');
  if (!username || RESERVED.has(username)) {
    navigate('/');
    return;
  }

  if (!supabaseClient) {
    const existing = findLocalProfile(username);
    const claimed = sessionStorage.getItem('uebey-v0-claim') === username;
    if (existing && !claimed) {
      navigate(`/${username}`);
      return;
    }
    app.replaceChildren(cloneTemplate('#editor-template'));
    setupEditorForm(username, existing, null);
    return;
  }

  setLoading();
  const user = await currentUser();
  if (!user) {
    localStorage.setItem('uebey-pending-claim', username);
    navigate('/signup');
    return;
  }

  let existing;
  try { existing = await getOwnedPage(user.id, username); }
  catch {
    renderNotFound(username, 'Não foi possível abrir o editor.');
    return;
  }

  if (!existing) {
    const available = await usernameAvailable(username).catch(() => false);
    if (!available) {
      const publicPage = await getPublicPage(username).catch(() => null);
      if (publicPage) navigate(`/${username}`);
      else renderNotFound(username, 'Esse endereço não está disponível.');
      return;
    }

    const [account, pages] = await Promise.all([getAccount(user.id), getOwnPages(user.id)]).catch(() => [null, []]);
    if (!account || account.status !== 'active') {
      renderNotFound(username, 'Sua conta não está habilitada para criar páginas.');
      return;
    }
    if (pages.length >= account.page_limit) {
      localStorage.removeItem('uebey-pending-claim');
      renderLimitReached(account.page_limit);
      return;
    }
  }

  app.replaceChildren(cloneTemplate('#editor-template'));
  setupEditorForm(username, existing, user);
}

function renderLimitReached(limit) {
  setTheme('minimal');
  const wrap = document.createElement('section');
  wrap.className = 'not-found';
  const title = document.createElement('h1');
  title.textContent = 'Limite atingido.';
  const copy = document.createElement('p');
  copy.textContent = `Sua conta permite ${limit} página${limit === 1 ? '' : 's'} neste momento.`;
  const button = pageActionButton('Voltar para Minhas páginas', 'secondary-button', () => navigate('/dashboard'));
  wrap.append(title, copy, button);
  app.replaceChildren(wrap);
}

function setupEditorForm(username, existing, user) {
  document.querySelector('#editor-address').textContent = `uebey.com/${username}`;
  const form = document.querySelector('#profile-form');
  const feedback = document.querySelector('#profile-feedback');

  if (existing) {
    const values = {
      name: existing.display_name,
      headline: existing.headline,
      bio: existing.bio,
      instagram: existing.instagram,
      whatsapp: existing.whatsapp,
      linkedin: existing.linkedin,
      website: existing.website,
      theme: existing.theme
    };
    for (const [key, value] of Object.entries(values)) {
      const field = form.elements.namedItem(key);
      if (!field) continue;
      if (field instanceof RadioNodeList) field.value = value || 'minimal';
      else field.value = value || '';
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const page = {
      username,
      display_name: String(data.get('name') || '').trim(),
      headline: String(data.get('headline') || '').trim(),
      bio: String(data.get('bio') || '').trim(),
      instagram: String(data.get('instagram') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').replace(/\D/g, ''),
      linkedin: String(data.get('linkedin') || '').trim(),
      website: String(data.get('website') || '').trim(),
      theme: String(data.get('theme') || 'minimal'),
      published: true
    };

    feedback.className = 'feedback';

    if (!supabaseClient) {
      saveLocalProfile(page);
      sessionStorage.removeItem('uebey-v0-claim');
      navigate(`/${username}`);
      return;
    }

    let error = null;
    if (existing) {
      ({ error } = await supabaseClient
        .from('pages')
        .update({
          display_name: page.display_name,
          headline: page.headline,
          bio: page.bio,
          instagram: page.instagram,
          whatsapp: page.whatsapp,
          linkedin: page.linkedin,
          website: page.website,
          theme: page.theme,
          published: true
        })
        .eq('id', existing.id));
    } else {
      ({ error } = await supabaseClient.rpc('create_page', {
        p_username: page.username,
        p_display_name: page.display_name,
        p_headline: page.headline,
        p_bio: page.bio,
        p_instagram: page.instagram,
        p_whatsapp: page.whatsapp,
        p_linkedin: page.linkedin,
        p_website: page.website,
        p_theme: page.theme,
        p_published: true
      }));
    }

    if (error) {
      const message = String(error.message || '');
      if (error.code === '23505') {
        feedback.textContent = 'Esse endereço acabou de ser escolhido por outra pessoa.';
      } else if (message.includes('page_limit_reached')) {
        feedback.textContent = 'Você atingiu o limite de páginas da sua conta.';
      } else if (message.includes('account_not_active')) {
        feedback.textContent = 'Sua conta não está habilitada para publicar agora.';
      } else {
        feedback.textContent = 'Não foi possível salvar a página. Tente novamente.';
      }
      feedback.classList.add('bad');
      return;
    }

    localStorage.removeItem('uebey-pending-claim');
    navigate(`/${username}`);
  });
}

function safeExternalUrl(raw) {
  if (!raw) return null;
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function makeLink(label, href) {
  if (!href) return null;
  const a = document.createElement('a');
  a.textContent = label;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function renderProfile(page) {
  setTheme(page.theme);
  app.replaceChildren(cloneTemplate('#profile-template'));
  const name = page.display_name || page.username;
  const initial = name.trim().charAt(0).toUpperCase();
  document.querySelector('#profile-avatar').textContent = initial;
  document.querySelector('#profile-handle').textContent = `uebey.com/${page.username}`;
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-headline').textContent = page.headline || '';
  document.querySelector('#profile-bio').textContent = page.bio || '';

  const links = document.querySelector('#profile-links');
  const candidates = [
    makeLink('Instagram', safeExternalUrl(page.instagram)),
    makeLink('WhatsApp', page.whatsapp ? `https://wa.me/${page.whatsapp}` : null),
    makeLink('LinkedIn', safeExternalUrl(page.linkedin)),
    makeLink('Site / GitHub', safeExternalUrl(page.website))
  ].filter(Boolean);
  candidates.forEach((link) => links.appendChild(link));
  if (!candidates.length) links.remove();
}

function renderNotFound(username, customMessage = '') {
  setTheme('minimal');
  const wrap = document.createElement('section');
  wrap.className = 'not-found';
  const title = document.createElement('h1');
  title.textContent = customMessage ? 'Ops.' : 'Página livre.';
  const copy = document.createElement('p');
  copy.textContent = customMessage || `uebey.com/${username} ainda não foi criado.`;
  const button = pageActionButton('Ir para o UEBEY →', 'text-button', () => navigate('/'));
  wrap.append(title, copy, button);
  app.replaceChildren(wrap);
}

async function renderRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  const route = parts[0] || '';

  if (!route) return renderHome();
  if (route === 'login') return renderAuth('login');
  if (route === 'signup') return renderAuth('signup');
  if (route === 'reset-password') return renderResetPassword();
  if (route === 'dashboard') return renderDashboard();
  if (route === 'edit') return renderEditor(normalizeUsername(parts[1] || ''));

  const username = normalizeUsername(route);
  setLoading();
  try {
    const page = await getPublicPage(username);
    if (page) renderProfile(page);
    else renderNotFound(username);
  } catch {
    renderNotFound(username, 'Não foi possível carregar esta página agora.');
  }
}

navHome.addEventListener('click', () => navigate('/'));
navAccount.addEventListener('click', async () => {
  const user = await currentUser();
  navigate(user ? '/dashboard' : '/login');
});
window.addEventListener('popstate', renderRoute);

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setHeaderUser(session?.user || null);
  });
}
initializeHeader();
renderRoute();
