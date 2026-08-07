const app = document.querySelector('#app');
const navHome = document.querySelector('#nav-home');
const navAccount = document.querySelector('#nav-account');

const RESERVED = new Set([
  'admin','api','app','assets','auth','blog','dashboard','edit','help','login','logout','pricing','privacy','signup','support','terms','uebey'
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
    name: 'Rodrigo Sucupira',
    headline: 'Quant Research · Python · Finance',
    bio: 'Pesquisa quantitativa, sistemas e ideias aplicadas ao mercado financeiro.',
    instagram: '', whatsapp: '', linkedin: 'https://www.linkedin.com/',
    website: 'https://github.com/rsucupira', theme: 'minimal'
  },
  carlosmagico: {
    username: 'carlosmagico', name: 'Carlos Batista',
    headline: 'Mágica ao vivo para eventos',
    bio: 'Transforme seu evento em uma experiência inesquecível.',
    instagram: 'https://www.instagram.com/', whatsapp: '', linkedin: '', website: '', theme: 'dark'
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

async function currentUser() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

async function updateHeader() {
  const user = await currentUser();
  navAccount.textContent = user ? 'Minha página' : 'Entrar';
}

async function usernameAvailable(username) {
  if (!username || username.length < 3 || RESERVED.has(username)) return false;
  if (!supabaseClient) return !findLocalProfile(username);

  const { data, error } = await supabaseClient.rpc('username_available', { candidate: username });
  if (error) throw error;
  return Boolean(data);
}

async function getOwnProfile(userId) {
  if (!supabaseClient || !userId) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPublicProfile(username) {
  if (!supabaseClient) return findLocalProfile(username);
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('username,display_name,headline,bio,instagram,whatsapp,linkedin,website,theme,published')
    .eq('username', username)
    .eq('published', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, name: data.display_name };
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
    ? (pending ? `Crie sua conta para reservar uebey.com/${pending}.` : 'Crie uma conta e publique sua página.')
    : 'Acesse sua página e edite quando quiser.';

  const form = document.querySelector('#auth-form');
  const feedback = document.querySelector('#auth-feedback');
  const submit = document.querySelector('#auth-submit');
  const switchButton = document.querySelector('#auth-switch');
  const password = form.elements.namedItem('password');

  submit.textContent = signup ? 'Criar conta' : 'Entrar';
  switchButton.textContent = signup ? 'Já tenho uma conta' : 'Ainda não tenho conta';
  password.autocomplete = signup ? 'new-password' : 'current-password';
  switchButton.addEventListener('click', () => navigate(signup ? '/login' : '/signup'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    feedback.className = 'feedback';

    if (!supabaseClient) {
      feedback.textContent = 'A V1 ainda precisa ser conectada ao Supabase. A V0 continua funcionando normalmente.';
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
        feedback.textContent = 'Conta criada. Confira seu email para confirmar o cadastro e depois volte ao UEBEY.';
        feedback.classList.add('good');
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: passwordValue });
        if (error) throw error;
        navigate(pending ? `/edit/${pending}` : '/dashboard');
      }
    } catch (error) {
      feedback.textContent = error?.message || 'Não foi possível concluir. Tente novamente.';
      feedback.classList.add('bad');
    } finally {
      submit.disabled = false;
      submit.textContent = signup ? 'Criar conta' : 'Entrar';
    }
  });
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

  let profile;
  try { profile = await getOwnProfile(user.id); }
  catch {
    renderNotFound('dashboard', 'Não foi possível carregar seu dashboard.');
    return;
  }

  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#dashboard-template'));
  document.querySelector('#dashboard-email').textContent = user.email || '';
  const card = document.querySelector('#dashboard-card');

  const title = document.createElement('h2');
  const copy = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'dashboard-actions';

  if (profile) {
    title.textContent = `uebey.com/${profile.username}`;
    copy.textContent = profile.published ? 'Sua página está publicada.' : 'Sua página está salva como rascunho.';

    const view = document.createElement('button');
    view.className = 'primary-button';
    view.textContent = 'Ver página';
    view.addEventListener('click', () => navigate(`/${profile.username}`));

    const edit = document.createElement('button');
    edit.className = 'secondary-button';
    edit.textContent = 'Editar';
    edit.addEventListener('click', () => navigate(`/edit/${profile.username}`));

    const toggle = document.createElement('button');
    toggle.className = 'secondary-button';
    toggle.textContent = profile.published ? 'Despublicar' : 'Publicar';
    toggle.addEventListener('click', async () => {
      toggle.disabled = true;
      const { error } = await supabaseClient
        .from('profiles')
        .update({ published: !profile.published })
        .eq('user_id', user.id);
      if (!error) renderDashboard();
      else toggle.disabled = false;
    });

    actions.append(view, edit, toggle);
  } else {
    const pending = localStorage.getItem('uebey-pending-claim') || user.user_metadata?.claimed_username;
    title.textContent = 'Sua página ainda não foi publicada.';
    copy.textContent = pending ? `Você começou com uebey.com/${pending}.` : 'Escolha seu endereço para começar.';

    const create = document.createElement('button');
    create.className = 'primary-button';
    create.textContent = pending ? `Criar uebey.com/${pending}` : 'Escolher endereço';
    create.addEventListener('click', () => navigate(pending ? `/edit/${normalizeUsername(pending)}` : '/'));
    actions.appendChild(create);
  }

  const logout = document.createElement('button');
  logout.className = 'text-button';
  logout.textContent = 'Sair da conta';
  logout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    navigate('/');
  });

  card.append(title, copy, actions, logout);
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
  try { existing = await getOwnProfile(user.id); }
  catch {
    renderNotFound(username, 'Não foi possível abrir o editor.');
    return;
  }

  if (existing && existing.username !== username) {
    navigate(`/edit/${existing.username}`);
    return;
  }

  if (!existing) {
    const available = await usernameAvailable(username).catch(() => false);
    if (!available) {
      navigate(`/${username}`);
      return;
    }
  }

  app.replaceChildren(cloneTemplate('#editor-template'));
  setupEditorForm(username, existing, user);
}

function setupEditorForm(username, existing, user) {
  document.querySelector('#editor-address').textContent = `uebey.com/${username}`;
  const form = document.querySelector('#profile-form');
  const feedback = document.querySelector('#profile-feedback');

  if (existing) {
    const values = {
      name: existing.display_name ?? existing.name,
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
    const profile = {
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
      saveLocalProfile({ ...profile, name: profile.display_name });
      sessionStorage.removeItem('uebey-v0-claim');
      navigate(`/${username}`);
      return;
    }

    profile.user_id = user.id;
    const { error } = await supabaseClient
      .from('profiles')
      .upsert(profile, { onConflict: 'user_id' });

    if (error) {
      feedback.textContent = error.code === '23505'
        ? 'Esse endereço acabou de ser escolhido por outra pessoa. Escolha outro.'
        : (error.message || 'Não foi possível salvar a página.');
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

function renderProfile(profile) {
  setTheme(profile.theme);
  app.replaceChildren(cloneTemplate('#profile-template'));
  const name = profile.name || profile.display_name || profile.username;
  const initial = name.trim().charAt(0).toUpperCase();
  document.querySelector('#profile-avatar').textContent = initial;
  document.querySelector('#profile-handle').textContent = `uebey.com/${profile.username}`;
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-headline').textContent = profile.headline || '';
  document.querySelector('#profile-bio').textContent = profile.bio || '';

  const links = document.querySelector('#profile-links');
  const candidates = [
    makeLink('Instagram', safeExternalUrl(profile.instagram)),
    makeLink('WhatsApp', profile.whatsapp ? `https://wa.me/${profile.whatsapp}` : null),
    makeLink('LinkedIn', safeExternalUrl(profile.linkedin)),
    makeLink('Site / GitHub', safeExternalUrl(profile.website))
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
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = 'Ir para o UEBEY →';
  link.addEventListener('click', (event) => { event.preventDefault(); navigate('/'); });
  wrap.append(title, copy, link);
  app.replaceChildren(wrap);
}

async function renderRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  const route = parts[0] || '';

  if (!route) return renderHome();
  if (route === 'login') return renderAuth('login');
  if (route === 'signup') return renderAuth('signup');
  if (route === 'dashboard') return renderDashboard();
  if (route === 'edit') return renderEditor(normalizeUsername(parts[1] || ''));

  const username = normalizeUsername(route);
  setLoading();
  try {
    const profile = await getPublicProfile(username);
    if (profile) renderProfile(profile);
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
  supabaseClient.auth.onAuthStateChange(() => updateHeader());
}
updateHeader();
renderRoute();
