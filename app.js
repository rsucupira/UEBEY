const app = document.querySelector('#app');
const navHome = document.querySelector('#nav-home');

const RESERVED = new Set([
  'admin','api','app','assets','auth','blog','dashboard','edit','help','login','logout','pricing','privacy','signup','support','terms','uebey'
]);

const demoProfiles = {
  rodrigo: {
    username: 'rodrigo',
    name: 'Rodrigo Sucupira',
    headline: 'Quant Research · Python · Finance',
    bio: 'Pesquisa quantitativa, sistemas e ideias aplicadas ao mercado financeiro.',
    instagram: '',
    whatsapp: '',
    linkedin: 'https://www.linkedin.com/',
    website: 'https://github.com/rsucupira',
    theme: 'minimal'
  },
  carlosmagico: {
    username: 'carlosmagico',
    name: 'Carlos Batista',
    headline: 'Mágica ao vivo para eventos',
    bio: 'Transforme seu evento em uma experiência inesquecível.',
    instagram: 'https://www.instagram.com/',
    whatsapp: '',
    linkedin: '',
    website: '',
    theme: 'dark'
  }
};

function normalizeUsername(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 30);
}

function getStoredProfiles() {
  try {
    return JSON.parse(localStorage.getItem('uebey-v0-profiles') || '{}');
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  const profiles = getStoredProfiles();
  profiles[profile.username] = profile;
  localStorage.setItem('uebey-v0-profiles', JSON.stringify(profiles));
}

function findProfile(username) {
  const stored = getStoredProfiles();
  return stored[username] || demoProfiles[username] || null;
}

function isTaken(username) {
  return RESERVED.has(username) || Boolean(findProfile(username));
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

function renderHome() {
  setTheme('minimal');
  app.replaceChildren(cloneTemplate('#home-template'));

  const form = document.querySelector('#claim-form');
  const input = document.querySelector('#claim-username');
  const feedback = document.querySelector('#claim-feedback');

  const updateFeedback = () => {
    const username = normalizeUsername(input.value);
    if (input.value !== username) input.value = username;

    feedback.className = 'feedback';
    if (!username) {
      feedback.textContent = 'Use letras, números, ponto, hífen ou underline.';
      return;
    }
    if (username.length < 3) {
      feedback.textContent = 'Escolha pelo menos 3 caracteres.';
      feedback.classList.add('bad');
      return;
    }
    if (isTaken(username)) {
      feedback.textContent = `uebey.com/${username} já está em uso.`;
      feedback.classList.add('bad');
      return;
    }
    feedback.textContent = `✓ uebey.com/${username} está disponível.`;
    feedback.classList.add('good');
  };

  input.addEventListener('input', updateFeedback);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = normalizeUsername(input.value);
    if (username.length < 3 || isTaken(username)) {
      updateFeedback();
      return;
    }
    sessionStorage.setItem('uebey-v0-claim', username);
    navigate(`/edit/${username}`);
  });
}

function renderEditor(username) {
  setTheme('minimal');

  if (!username || RESERVED.has(username)) {
    navigate('/');
    return;
  }

  const existing = findProfile(username);
  const claimed = sessionStorage.getItem('uebey-v0-claim') === username;
  if (existing && !claimed) {
    navigate(`/${username}`);
    return;
  }

  app.replaceChildren(cloneTemplate('#editor-template'));
  document.querySelector('#editor-address').textContent = `uebey.com/${username}`;

  const form = document.querySelector('#profile-form');
  if (existing) {
    for (const [key, value] of Object.entries(existing)) {
      const field = form.elements.namedItem(key);
      if (!field) continue;
      if (field instanceof RadioNodeList) field.value = value;
      else field.value = value || '';
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const profile = {
      username,
      name: String(data.get('name') || '').trim(),
      headline: String(data.get('headline') || '').trim(),
      bio: String(data.get('bio') || '').trim(),
      instagram: String(data.get('instagram') || '').trim(),
      whatsapp: String(data.get('whatsapp') || '').replace(/\D/g, ''),
      linkedin: String(data.get('linkedin') || '').trim(),
      website: String(data.get('website') || '').trim(),
      theme: String(data.get('theme') || 'minimal')
    };
    saveProfile(profile);
    sessionStorage.removeItem('uebey-v0-claim');
    navigate(`/${username}`);
  });
}

function safeExternalUrl(raw) {
  if (!raw) return null;
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
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

  const initial = (profile.name || profile.username || '?').trim().charAt(0).toUpperCase();
  document.querySelector('#profile-avatar').textContent = initial;
  document.querySelector('#profile-handle').textContent = `uebey.com/${profile.username}`;
  document.querySelector('#profile-name').textContent = profile.name || profile.username;
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

function renderNotFound(username) {
  setTheme('minimal');
  const wrap = document.createElement('section');
  wrap.className = 'not-found';
  const title = document.createElement('h1');
  title.textContent = 'Página livre.';
  const copy = document.createElement('p');
  copy.textContent = `uebey.com/${username} ainda não foi criado.`;
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = 'Criar uma página →';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    navigate('/');
  });
  wrap.append(title, copy, link);
  app.replaceChildren(wrap);
}

function renderRoute() {
  const parts = location.pathname.split('/').filter(Boolean);

  if (!parts.length) {
    renderHome();
    return;
  }

  if (parts[0] === 'edit') {
    renderEditor(normalizeUsername(parts[1] || ''));
    return;
  }

  const username = normalizeUsername(parts[0]);
  const profile = findProfile(username);
  if (profile) renderProfile(profile);
  else renderNotFound(username);
}

navHome.addEventListener('click', () => navigate('/'));
window.addEventListener('popstate', renderRoute);
renderRoute();
