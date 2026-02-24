const GATE_STORAGE_KEY = 'gatePassedSession';
const CART_STORAGE_KEY = 'filialCartV1';
const SESSION_STORAGE_KEY = 'fp_session';
const ACCOUNTS_STORAGE_KEY = 'fp_accounts';
const WISHLIST_STORAGE_PREFIX = 'fp_wishlist_';
const GATE_PAGE = 'gate.html';
const GATE_FALLBACK_TARGET = 'index.html';
const GATE_PROTECTED_PAGES = new Set([
  'index.html',
  'shop.html',
  'product.html',
  'cart.html',
  'checkout.html',
  'about.html',
  'story.html',
  'story-photo.html',
  'story-video.html',
  'story-video-library.html',
  'story-video-player.html'
]);
const currentPageFile = window.location.pathname.split('/').pop() || 'index.html';
const gateParams = new URLSearchParams(window.location.search);

function readGatePassedAt() {
  try {
    return window.sessionStorage.getItem(GATE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function isGatePassed() {
  return readGatePassedAt();
}

function setGatePassedNow() {
  try {
    window.sessionStorage.setItem(GATE_STORAGE_KEY, '1');
  } catch {
    // sessionStorage might be blocked.
  }
}

function sanitizeNextTarget(rawNext) {
  if (!rawNext) return GATE_FALLBACK_TARGET;
  if (/^[a-z][a-z\d+\-.]*:/i.test(rawNext) || rawNext.startsWith('//')) {
    return GATE_FALLBACK_TARGET;
  }

  const trimmed = rawNext.replace(/^\/+/, '');
  const pathPart = trimmed.split('?')[0].split('#')[0];
  if (!GATE_PROTECTED_PAGES.has(pathPart)) {
    return GATE_FALLBACK_TARGET;
  }
  return trimmed;
}

function buildCurrentTarget() {
  const file = currentPageFile || 'index.html';
  return `${file}${window.location.search}${window.location.hash}`;
}

const isGatePage = currentPageFile === GATE_PAGE;
const hasAdminBypass = gateParams.get('key') === 'admin';

if (hasAdminBypass) {
  setGatePassedNow();
}

const gatePassed = isGatePassed();

if (!isGatePage && GATE_PROTECTED_PAGES.has(currentPageFile) && !gatePassed) {
  const next = encodeURIComponent(buildCurrentTarget());
  window.location.replace(`${GATE_PAGE}?next=${next}`);
}

if (isGatePage && (gatePassed || hasAdminBypass)) {
  const target = sanitizeNextTarget(gateParams.get('next'));
  window.location.replace(target);
}

// Defensive cleanup for transition/blur/menu states that might persist via bfcache or redirects.
function clearTransientUiState() {
  document.body.classList.remove(
    'is-leaving',
    'is-entering',
    'gate-is-winning',
    'is-nav-open',
    'is-mini-menu-open',
    'is-size-guide-open'
  );
  const openNav = document.querySelector('.site-nav.is-open');
  if (openNav) openNav.classList.remove('is-open');
}

clearTransientUiState();
window.addEventListener('pageshow', () => {
  clearTransientUiState();
});

const nav = document.querySelector('.site-nav');
const menuToggle = document.querySelector('.menu-toggle');
const revealNodes = document.querySelectorAll('.reveal');
const logoImages = document.querySelectorAll('.logo-image');
const productMainImage = document.querySelector('#productMainImage');
const productName = document.querySelector('#productName');
const productCode = document.querySelector('#productCode');
const productDescription = document.querySelector('#productDescription');
const thumbRow = document.querySelector('#thumbRow');
const prevImageBtn = document.querySelector('#prevImage');
const nextImageBtn = document.querySelector('#nextImage');
const homeVideoHero = document.querySelector('#homeVideoHero');
const homeHeroVideo = document.querySelector('#homeHeroVideo');
const videoVolume = document.querySelector('#videoVolume');
const videoVolLabel = document.querySelector('#videoVolLabel');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouchLikeDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const useInstantMobileNav = isTouchLikeDevice;
const PAGE_TRANSITION_MS = prefersReducedMotion ? 80 : (useInstantMobileNav ? 0 : 760);
const supportsPointerEvents = 'PointerEvent' in window;
const externalScriptCache = new Map();

if (useInstantMobileNav) {
  document.documentElement.classList.add('mobile-no-fx');
  document.body.classList.add('mobile-no-fx');
}

function initMobileMediaCompatibility() {
  const videos = document.querySelectorAll('video');
  if (!videos.length) return;

  videos.forEach((video) => {
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (!video.getAttribute('preload')) {
      video.setAttribute('preload', 'metadata');
    }
  });
}

function loadExternalScriptOnce(src) {
  if (externalScriptCache.has(src)) return externalScriptCache.get(src);

  const task = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Cannot load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Cannot load script: ${src}`));
    document.head.appendChild(script);
  });

  externalScriptCache.set(src, task);
  return task;
}

function readCartItems() {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        key: String(item.key || ''),
        id: String(item.id || ''),
        name: String(item.name || 'Product'),
        price: Number(item.price) > 0 ? Number(item.price) : 0,
        quantity: Number(item.quantity) > 0 ? Math.floor(Number(item.quantity)) : 1,
        image: String(item.image || ''),
        option: String(item.option || '')
      }))
      .filter((item) => item.key);
  } catch {
    return [];
  }
}

function writeCartItems(items) {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage might be blocked.
  }
}

function getCartCount(items = readCartItems()) {
  return items.reduce((total, item) => total + Math.max(0, item.quantity || 0), 0);
}

function getCartTotal(items = readCartItems()) {
  return items.reduce((total, item) => total + ((item.price || 0) * (item.quantity || 0)), 0);
}

function formatUsd(value) {
  return `${Math.round(value)} USD`;
}

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const email = String(parsed.email || '').trim().toLowerCase();
    if (!email) return null;
    return {
      email,
      createdAt: Number(parsed.createdAt) || Date.now()
    };
  } catch {
    return null;
  }
}

function writeSession(email) {
  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        createdAt: Date.now()
      })
    );
  } catch {
    // localStorage might be blocked.
  }
}

function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // localStorage might be blocked.
  }
}

function readAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => ({
        email: String(entry.email || '').trim().toLowerCase(),
        password: String(entry.password || ''),
        createdAt: Number(entry.createdAt) || Date.now()
      }))
      .filter((entry) => entry.email);
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // localStorage might be blocked.
  }
}

function initAccountLink() {
  const accountLink = document.querySelector('#accountLink');
  const session = readSession();
  if (accountLink) {
    accountLink.setAttribute('href', session ? 'account.html' : 'login.html');
  }
  const mobileAccountLink = document.querySelector('#mobileAccountLink');
  if (mobileAccountLink) {
    mobileAccountLink.setAttribute('href', session ? 'account.html' : 'login.html');
  }
}

function resolveSafeNextTarget(rawNext, fallback = 'account.html') {
  const value = String(rawNext || '').trim();
  if (!value) return fallback;
  if (/^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith('//')) return fallback;
  if (value.startsWith('/')) return fallback;
  return value;
}

function requireAuthForPurchase() {
  const session = readSession();
  if (session) return true;
  const next = encodeURIComponent(`${currentPageFile}${window.location.search}${window.location.hash}`);
  window.location.href = `login.html?next=${next}`;
  return false;
}

function readWishlist(email = readSession()?.email || '') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return [];
  try {
    const raw = window.localStorage.getItem(`${WISHLIST_STORAGE_PREFIX}${normalized}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeWishlist(items, email = readSession()?.email || '') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return;
  try {
    const unique = Array.from(new Set(items.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
    window.localStorage.setItem(`${WISHLIST_STORAGE_PREFIX}${normalized}`, JSON.stringify(unique));
  } catch {
    // localStorage might be blocked.
  }
}

function isWishlisted(productId) {
  const id = String(productId || '').trim().toLowerCase();
  if (!id) return false;
  const session = readSession();
  if (!session) return false;
  return readWishlist(session.email).includes(id);
}

function toggleWishlist(productId) {
  const id = String(productId || '').trim().toLowerCase();
  if (!id) return false;
  const session = readSession();
  if (!session) {
    const next = encodeURIComponent(`${currentPageFile}${window.location.search}${window.location.hash}`);
    window.location.href = `login.html?next=${next}`;
    return false;
  }

  const list = readWishlist(session.email);
  const nextList = list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
  writeWishlist(nextList, session.email);
  return nextList.includes(id);
}

function applyWishlistState(button) {
  if (!(button instanceof HTMLElement)) return;
  const productId = String(button.dataset.wishlistId || '').trim().toLowerCase();
  const active = isWishlisted(productId);
  const emptyLabel = button.dataset.heartEmpty || '♡';
  const fullLabel = button.dataset.heartFull || '♥';
  button.classList.toggle('is-active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  button.textContent = active ? fullLabel : emptyLabel;
}

function refreshWishlistButtons(root = document) {
  root.querySelectorAll('[data-wishlist-id]').forEach((button) => applyWishlistState(button));
}

function createWishlistButton(productId, { className = 'wishlist-btn', text = '♡' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.wishlistId = String(productId || '').trim().toLowerCase();
  button.dataset.heartEmpty = text || '♡';
  button.dataset.heartFull = '♥';
  button.setAttribute('aria-label', 'Save to wishlist');
  button.setAttribute('aria-pressed', 'false');
  button.textContent = button.dataset.heartEmpty;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleWishlist(button.dataset.wishlistId || '');
    refreshWishlistButtons(document);
  });
  applyWishlistState(button);
  return button;
}

function updateCartIndicators() {
  const count = getCartCount();
  document.querySelectorAll('[data-cart-count]').forEach((node) => {
    node.textContent = String(count);
  });
}

function addCartItem(item) {
  if (!readSession()) {
    const next = encodeURIComponent(`${currentPageFile}${window.location.search}${window.location.hash}`);
    window.location.href = `login.html?next=${next}`;
    return false;
  }
  const items = readCartItems();
  const key = String(item.key || '');
  if (!key) return false;

  const existing = items.find((entry) => entry.key === key);
  if (existing) {
    existing.quantity += Math.max(1, Math.floor(Number(item.quantity) || 1));
    if (!existing.image && item.image) existing.image = String(item.image);
  } else {
    items.push({
      key,
      id: String(item.id || key),
      name: String(item.name || 'Product'),
      price: Number(item.price) > 0 ? Number(item.price) : 0,
      quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      image: String(item.image || ''),
      option: String(item.option || '')
    });
  }

  writeCartItems(items);
  updateCartIndicators();
  return true;
}

function setCartItemQuantity(key, quantity) {
  const items = readCartItems();
  const target = items.find((item) => item.key === key);
  if (!target) return;
  target.quantity = Math.max(1, Math.floor(Number(quantity) || 1));
  writeCartItems(items);
  updateCartIndicators();
}

function removeCartItem(key) {
  const items = readCartItems().filter((item) => item.key !== key);
  writeCartItems(items);
  updateCartIndicators();
}

if (!useInstantMobileNav) {
  document.body.classList.add('is-entering');
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.remove('is-entering');
    });
  });
}

function closeMenu({ restoreFocus = false } = {}) {
  if (!nav || !menuToggle) return;
  nav.classList.remove('is-open');
  document.body.classList.remove('is-nav-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open menu');
  if (restoreFocus) {
    menuToggle.focus();
  }
}

function openMenu() {
  if (!nav || !menuToggle) return;
  nav.classList.add('is-open');
  document.body.classList.add('is-nav-open');
  menuToggle.setAttribute('aria-expanded', 'true');
  menuToggle.setAttribute('aria-label', 'Close menu');
}

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const opening = !nav.classList.contains('is-open');
    if (opening) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (nav.classList.contains('is-open') && !nav.contains(target) && !menuToggle.contains(target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu({ restoreFocus: true });
    }
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => closeMenu());
  });
}

function initHeaderScrollState() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const threshold = 14;
  let ticking = false;

  const update = () => {
    const y = window.scrollY || window.pageYOffset || 0;
    document.body.classList.toggle('is-header-scrolled', y > threshold);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true }
  );
  window.addEventListener('resize', update, { passive: true });
  update();
}

function initMobileHeaderCollapse() {
  if (!nav || !menuToggle) return;

  const mobileQuery = window.matchMedia('(max-width: 900px)');
  let miniMenu = null;
  let mobileCartFab = null;
  let mobileAccountFab = null;

  const ensureMiniMenu = () => {
    if (miniMenu) return miniMenu;
    const links = [
      { href: 'index.html', label: 'Home' },
      { href: 'shop.html', label: 'Shop' },
      { href: 'story.html', label: 'Story' },
      { href: 'about.html', label: 'About' },
      { href: readSession() ? 'account.html' : 'login.html', label: 'Account' }
    ];
    miniMenu = document.createElement('nav');
    miniMenu.className = 'mobile-header-pop';
    miniMenu.setAttribute('aria-label', 'Quick menu');
    miniMenu.innerHTML = links
      .map(({ href, label }) => `<a class="mobile-header-pop__link fx-link" href="${href}" data-transition>${label}</a>`)
      .join('');
    document.body.appendChild(miniMenu);
    miniMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        document.body.classList.remove('is-mini-menu-open');
      });
    });
    return miniMenu;
  };

  const ensureMobileCartFab = () => {
    if (mobileCartFab) return mobileCartFab;
    mobileCartFab = document.createElement('a');
    mobileCartFab.className = 'mobile-cart-fab fx-link';
    mobileCartFab.href = 'cart.html';
    mobileCartFab.setAttribute('data-transition', '');
    mobileCartFab.setAttribute('aria-label', 'Cart');
    mobileCartFab.innerHTML = '<span class="mobile-cart-fab__icon" aria-hidden="true"><img src="assets/cart-icon-minimal.svg" alt="" /></span><span class="mobile-cart-fab__count" data-cart-count>0</span>';
    document.body.appendChild(mobileCartFab);
    return mobileCartFab;
  };

  const ensureMobileAccountFab = () => {
    if (mobileAccountFab) return mobileAccountFab;
    mobileAccountFab = document.createElement('a');
    mobileAccountFab.className = 'mobile-cart-fab mobile-account-fab fx-link';
    mobileAccountFab.href = readSession() ? 'account.html' : 'login.html';
    mobileAccountFab.id = 'mobileAccountLink';
    mobileAccountFab.setAttribute('data-transition', '');
    mobileAccountFab.setAttribute('aria-label', 'Account');
    mobileAccountFab.innerHTML = '<span class="mobile-cart-fab__icon mobile-account-fab__icon" aria-hidden="true"><img src="assets/account-icon-minimal.svg" alt="" /></span>';
    document.body.appendChild(mobileAccountFab);
    return mobileAccountFab;
  };

  const syncToggleIcon = () => {
    if (!mobileQuery.matches) return;
    const collapsed = document.body.classList.contains('is-mobile-header-collapsed');
    if (!collapsed) {
      menuToggle.textContent = 'Menu';
      menuToggle.setAttribute('aria-label', 'Open menu');
      return;
    }
    const open = document.body.classList.contains('is-mini-menu-open');
    menuToggle.textContent = open ? '✕' : '⋯';
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  const update = () => {
    if (!mobileQuery.matches) {
      document.body.classList.remove('is-mobile-header-collapsed');
      document.body.classList.remove('is-mini-menu-open');
      if (nav.classList.contains('is-open')) closeMenu();
      menuToggle.textContent = 'Menu';
      if (mobileCartFab) mobileCartFab.remove();
      if (mobileAccountFab) mobileAccountFab.remove();
      mobileCartFab = null;
      mobileAccountFab = null;
      return;
    }

    document.body.classList.add('is-mobile-header-collapsed');
    ensureMobileAccountFab();
    ensureMobileCartFab();
    initAccountLink();
    syncToggleIcon();
  };

  window.addEventListener('resize', update, { passive: true });
  menuToggle.addEventListener('click', () => {
    if (mobileQuery.matches && document.body.classList.contains('is-mobile-header-collapsed')) {
      ensureMiniMenu();
      document.body.classList.toggle('is-mini-menu-open');
      if (nav.classList.contains('is-open')) closeMenu();
    }
    window.requestAnimationFrame(syncToggleIcon);
  });
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      window.requestAnimationFrame(syncToggleIcon);
    });
  });

  document.addEventListener('click', (event) => {
    if (!mobileQuery.matches) return;
    if (!document.body.classList.contains('is-mini-menu-open')) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    const pop = ensureMiniMenu();
    if (pop.contains(target) || menuToggle.contains(target)) return;
    document.body.classList.remove('is-mini-menu-open');
    syncToggleIcon();
  });

  update();
}

logoImages.forEach((img) => {
  const fallback = img.parentElement?.querySelector('.logo-fallback');
  if (!fallback) return;

  fallback.style.display = 'inline';

  const hideFallback = () => {
    fallback.style.display = 'none';
  };

  img.addEventListener('load', () => {
    if (img.naturalWidth > 10) {
      hideFallback();
    }
  });

  if (img.complete && img.naturalWidth > 10) {
    hideFallback();
  }
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.15 }
);

const staggerGroups = [
  '.catalog-grid',
  '.campaign-grid',
  '.shop-items',
  '.thumb-row',
  '.home-video-controls',
  '.story-hub-grid',
  '.story-photo-grid',
  '.story-video-grid',
  '.story-player-nav'
];
staggerGroups.forEach((selector) => {
  document.querySelectorAll(selector).forEach((group) => {
    Array.from(group.children).forEach((item, index) => {
      if (!(item instanceof HTMLElement)) return;
      item.classList.add('reveal');
      item.style.setProperty('--reveal-delay', `${Math.min(index * 75, 420)}ms`);
    });
  });
});

document.querySelectorAll('.reveal').forEach((node, index) => {
  if (!(node instanceof HTMLElement)) return;
  if (!node.style.getPropertyValue('--reveal-delay')) {
    node.style.setProperty('--reveal-delay', `${Math.min(index * 35, 280)}ms`);
  }
  revealObserver.observe(node);
});

if (document.body.dataset.page === 'home') {
  const stageSection = document.querySelector('.single-stage');
  const homeSections = document.querySelectorAll('.single-product-main section');

  const homeSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-in-view', entry.isIntersecting && entry.intersectionRatio >= 0.25);
      });
    },
    { threshold: [0.25, 0.5, 0.75] }
  );

  homeSections.forEach((section) => homeSectionObserver.observe(section));

  const updateHomeScrollFx = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    document.body.style.setProperty('--home-progress', progress.toFixed(4));

    const stageShift = Math.min(120, window.scrollY * 0.24);
    document.body.style.setProperty('--home-stage-shift', `${stageShift.toFixed(2)}px`);

    if (stageSection) {
      const stageBottom = stageSection.offsetTop + stageSection.offsetHeight;
      const afterStage = Math.max(0, window.scrollY - (stageBottom - window.innerHeight * 0.9));
      const videoOffset = Math.max(0, 72 - afterStage * 0.08);
      document.body.style.setProperty('--home-video-offset', `${videoOffset.toFixed(2)}px`);
    }
  };

  let homeTicking = false;
  const requestHomeUpdate = () => {
    if (homeTicking) return;
    homeTicking = true;
    window.requestAnimationFrame(() => {
      updateHomeScrollFx();
      homeTicking = false;
    });
  };

  window.addEventListener('scroll', requestHomeUpdate, { passive: true });
  window.addEventListener('resize', requestHomeUpdate);
  updateHomeScrollFx();

  const stlWrap = document.querySelector('.single-model-wrap');
  const pointerZone = document.querySelector('.single-stage');
  if (stlWrap && pointerZone && !prefersReducedMotion) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const updateInertia = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      stlWrap.style.setProperty('--stl-tilt-x', `${currentX.toFixed(2)}deg`);
      stlWrap.style.setProperty('--stl-tilt-y', `${currentY.toFixed(2)}deg`);
      window.requestAnimationFrame(updateInertia);
    };

    const updateTiltFromPoint = (clientX, clientY) => {
      const rect = pointerZone.getBoundingClientRect();
      const px = (clientX - rect.left) / rect.width - 0.5;
      const py = (clientY - rect.top) / rect.height - 0.5;
      targetY = Math.max(-3.5, Math.min(3.5, px * 7));
      targetX = Math.max(-2.6, Math.min(2.6, -py * 5.2));
    };

    if (supportsPointerEvents) {
      pointerZone.addEventListener(
        'pointermove',
        (event) => updateTiltFromPoint(event.clientX, event.clientY),
        { passive: true }
      );
    } else {
      pointerZone.addEventListener(
        'mousemove',
        (event) => updateTiltFromPoint(event.clientX, event.clientY),
        { passive: true }
      );
      pointerZone.addEventListener(
        'touchmove',
        (event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          updateTiltFromPoint(touch.clientX, touch.clientY);
        },
        { passive: true }
      );
    }

    const resetTilt = () => {
      targetX = 0;
      targetY = 0;
    };
    pointerZone.addEventListener('pointerleave', resetTilt);
    pointerZone.addEventListener('mouseleave', resetTilt);
    pointerZone.addEventListener('touchend', resetTilt, { passive: true });
    pointerZone.addEventListener('touchcancel', resetTilt, { passive: true });

    updateInertia();
  }
}

if (homeVideoHero && homeHeroVideo) {
  let userPaused = false;
  homeHeroVideo.volume = 1;
  homeHeroVideo.muted = true;

  const updateControls = () => {
    if (videoVolume) {
      videoVolume.value = String(Math.round(homeHeroVideo.volume * 100));
    }
    if (videoVolLabel) {
      videoVolLabel.textContent = `Vol ${Math.round(homeHeroVideo.volume * 100)}%`;
    }
  };

  const tryPlay = () => {
    const playPromise = homeHeroVideo.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        updateControls();
      });
    }
  };

  const autoPlayObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target !== homeVideoHero) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
          if (!userPaused) {
            tryPlay();
          }
        } else {
          homeHeroVideo.pause();
        }
      });
    },
    { threshold: [0.25, 0.55, 0.85] }
  );

  autoPlayObserver.observe(homeVideoHero);

  homeHeroVideo.addEventListener('click', () => {
    if (homeHeroVideo.paused) {
      userPaused = false;
      tryPlay();
    } else {
      userPaused = true;
      homeHeroVideo.pause();
    }
    updateControls();
  });

  videoVolume?.addEventListener('input', () => {
    const level = Number(videoVolume.value) / 100;
    homeHeroVideo.muted = false;
    homeHeroVideo.volume = Math.max(0, Math.min(1, level));
    updateControls();
  });

  homeHeroVideo.addEventListener('play', updateControls);
  homeHeroVideo.addEventListener('pause', updateControls);
  homeHeroVideo.addEventListener('volumechange', updateControls);
  updateControls();
}

if (productMainImage && productName && productDescription && thumbRow) {
  const productVariantWrap = document.querySelector('#productVariantWrap');
  const productVariantOptions = document.querySelector('#productVariantOptions');
  const addToCartButton = document.querySelector('.product-order-btn');
  const buyNowButton = document.querySelector('.product-buy-now-btn');
  const productWishlistBtn = document.querySelector('#productWishlistBtn');
  const fullscreenModal = document.querySelector('#productFullscreenModal');
  const fullscreenTrack = document.querySelector('#productFullscreenTrack');
  const fullscreenClose = document.querySelector('#productFullscreenClose');

  const imageCandidates = (folder, base) => [
    `assets/${folder}/${base}.1.JPG`,
    `assets/${folder}/${base}.1.jpg`,
    `assets/${folder}/${base}.1.jpeg`,
    `assets/${folder}/${base}.1.png`,
    `assets/${folder}/${base}.JPG`,
    `assets/${folder}/${base}.jpg`,
    `assets/${folder}/${base}.jpeg`,
    `assets/${folder}/${base}.png`,
    `assets/${folder}/${base}-2.JPG`,
    `assets/${folder}/${base}-2.jpg`,
    `assets/${folder}/${base}-2.jpeg`,
    `assets/${folder}/${base}-2.png`,
    `assets/${folder}/${base}-3.JPG`,
    `assets/${folder}/${base}-3.jpg`,
    `assets/${folder}/${base}-3.jpeg`,
    `assets/${folder}/${base}-3.png`,
    `assets/${folder}/${base}-4.JPG`,
    `assets/${folder}/${base}-4.jpg`,
    `assets/${folder}/${base}-4.jpeg`,
    `assets/${folder}/${base}-4.png`,
    `assets/${folder}/${base}-5.JPG`,
    `assets/${folder}/${base}-5.jpg`,
    `assets/${folder}/${base}-5.jpeg`,
    `assets/${folder}/${base}-5.png`
  ];

  const productMap = {
    p01: {
      code: 'Item 01',
      name: 'Product p01',
      description: 'Independent product code p01.',
      images: ['assets/p01/p01.JPG']
    },
    p02: {
      code: 'Item 02',
      name: 'Product p02',
      description: 'Independent product code p02.',
      images: ['assets/p02/p02.JPG']
    },
    p03: {
      code: 'Item 03',
      name: 'Product p03',
      description: 'Independent product code p03.',
      images: ['assets/p03/p03.JPG']
    },
    p04: {
      code: 'Item 04',
      name: 'Product p04',
      description: 'Independent product code p04.',
      images: ['assets/p04/p04.JPG']
    },
    p05: {
      code: 'Item 05',
      name: 'Product p05',
      description: 'Independent product code p05.',
      images: ['assets/p05/p05.JPG']
    },
    p06: {
      code: 'Item 06',
      name: 'Product p06',
      description: 'Independent product code p06.',
      images: ['assets/p06/p06.JPG']
    }
  };

  const query = new URLSearchParams(window.location.search);
  const entryKey = query.get('item') || 'p01';
  let activeImageIndex = 0;
  let activeImages = [];
  let activeProduct = productMap.p01;
  let activeProductKey = 'p01';
  let renderToken = 0;
  const optionKeys = ['p01', 'p02', 'p03', 'p04', 'p05', 'p06'];
  const mobileProductQuery = window.matchMedia('(max-width: 900px)');
  const productMainMedia = document.querySelector('.product-main-media');
  let mobileImageIndicator = null;
  let isFullscreenOpen = false;
  let zoomLens = null;
  const isDesktopHoverZoom = window.matchMedia('(min-width: 901px) and (hover: hover)').matches;
  const desktopZoomFactor = 2;

  const uniqueImageSources = (candidates) => {
    const seen = new Set();
    return candidates
      .filter(Boolean)
      .filter((src) => {
        const key = String(src).replace(/\\/g, '/').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };
  const resolveExistingImages = async (candidates) => uniqueImageSources(candidates);
  const optionPreviewCache = new Map();

  const resolveOptionPreview = async (optionKey) => {
    if (optionPreviewCache.has(optionKey)) return optionPreviewCache.get(optionKey);
    const option = productMap[optionKey];
    if (!option) return '';
    const resolved = await resolveExistingImages(option.images);
    const preview = resolved[0] || option.images[0] || '';
    optionPreviewCache.set(optionKey, preview);
    return preview;
  };

  function showActiveImage() {
    if (!activeImages.length) return;
    const currentSrc = activeImages[activeImageIndex] || activeImages[0];
    productMainImage.src = currentSrc;
    productMainImage.alt = `${activeProduct.name} image ${activeImageIndex + 1}`;
    thumbRow.querySelectorAll('[data-image-index]').forEach((button) => {
      const index = Number(button.getAttribute('data-image-index') || -1);
      button.classList.toggle('is-active', index === activeImageIndex);
    });
    if (mobileProductQuery.matches && mobileImageIndicator) {
      mobileImageIndicator.textContent = `${activeImageIndex + 1} / ${activeImages.length}`;
    }
    if (zoomLens) {
      zoomLens.style.backgroundImage = `url("${currentSrc}")`;
    }
  }

  const hideZoomLens = () => {
    zoomLens?.classList.remove('is-visible');
  };

  const setupZoomTarget = (targetImage) => {
    if (!isDesktopHoverZoom || !targetImage) return;
    if (targetImage.dataset.zoomBound === '1') return;
    targetImage.dataset.zoomBound = '1';
    targetImage.classList.add('product-zoom-target');

    targetImage.addEventListener('mousemove', (event) => {
      if (!zoomLens) return;
      const rect = targetImage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hideZoomLens();
        return;
      }

      const lensRect = zoomLens.getBoundingClientRect();
      const lensW = lensRect.width || 230;
      const lensH = lensRect.height || 155;

      zoomLens.style.left = `${event.clientX}px`;
      zoomLens.style.top = `${event.clientY}px`;
      zoomLens.style.backgroundImage = `url("${targetImage.currentSrc || targetImage.src}")`;
      zoomLens.style.backgroundSize = `${rect.width * desktopZoomFactor}px ${rect.height * desktopZoomFactor}px`;
      zoomLens.style.backgroundPosition = `${-(x * desktopZoomFactor - lensW / 2)}px ${-(y * desktopZoomFactor - lensH / 2)}px`;
      zoomLens.classList.add('is-visible');
    });

    targetImage.addEventListener('mouseenter', () => {
      if (!zoomLens) return;
      zoomLens.classList.add('is-visible');
    });
    targetImage.addEventListener('mouseleave', hideZoomLens);
  };

  const renderFullscreenGallery = () => {
    if (!fullscreenTrack) return;
    fullscreenTrack.innerHTML = '';
    activeImages.forEach((src, index) => {
      const slide = document.createElement('figure');
      slide.className = 'product-fullscreen-slide';
      slide.setAttribute('data-fullscreen-index', String(index));
      slide.innerHTML = `<img src="${src}" alt="${activeProduct.name} fullscreen image ${index + 1}" />`;
      fullscreenTrack.appendChild(slide);
    });
  };

  const openFullscreenGallery = (index = activeImageIndex) => {
    if (!fullscreenModal || !fullscreenTrack || !activeImages.length) return;
    if (!fullscreenTrack.children.length) {
      renderFullscreenGallery();
    }
    isFullscreenOpen = true;
    fullscreenModal.classList.add('is-open');
    fullscreenModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-product-fullscreen-open');
    const safeIndex = Math.max(0, Math.min(index, activeImages.length - 1));
    const snapTarget = fullscreenTrack.children[safeIndex];
    snapTarget?.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  const closeFullscreenGallery = () => {
    if (!fullscreenModal) return;
    isFullscreenOpen = false;
    fullscreenModal.classList.remove('is-open');
    fullscreenModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-product-fullscreen-open');
  };

  function renderGallery() {
    if (!activeImages.length) return;
    const isMobileProduct = mobileProductQuery.matches;
    thumbRow.innerHTML = '';

    if (!isMobileProduct) {
      activeImages.forEach((imgSrc, index) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'product-scroll-item';
        item.setAttribute('data-image-index', String(index));
        item.setAttribute('aria-label', `Show image ${index + 1}`);
        item.innerHTML = `<img class="product-scroll-image" src="${imgSrc}" alt="${activeProduct.name} image ${index + 1}" />`;
        item.addEventListener('click', () => {
          activeImageIndex = index;
          showActiveImage();
        });
        item.addEventListener('dblclick', () => {
          openFullscreenGallery(index);
        });
        thumbRow.appendChild(item);
        const thumbImage = item.querySelector('.product-scroll-image');
        if (thumbImage instanceof HTMLImageElement) {
          setupZoomTarget(thumbImage);
        }
      });
      showActiveImage();
      const hasMultiple = activeImages.length > 1;
      thumbRow.hidden = activeImages.length <= 1;
      if (prevImageBtn) prevImageBtn.hidden = !hasMultiple;
      if (nextImageBtn) nextImageBtn.hidden = !hasMultiple;
      renderFullscreenGallery();
      return;
    }

    showActiveImage();
    const hasMultiple = activeImages.length > 1;
    thumbRow.hidden = true;
    if (prevImageBtn) prevImageBtn.hidden = !hasMultiple;
    if (nextImageBtn) nextImageBtn.hidden = !hasMultiple;
    renderFullscreenGallery();
  }

  const shiftImage = (step) => {
    if (activeImages.length <= 1) return;
    activeImageIndex = (activeImageIndex + step + activeImages.length) % activeImages.length;
    showActiveImage();
  };

  const setProduct = async (productKey) => {
    if (isFullscreenOpen) closeFullscreenGallery();
    const product = productMap[productKey] || productMap.p01;
    activeProductKey = productKey in productMap ? productKey : 'p01';
    activeProduct = product;
    productCode.textContent = product.code;
    productName.textContent = product.name;
    productDescription.textContent = product.description;

    const token = ++renderToken;
    const resolved = await resolveExistingImages(product.images);
    if (token !== renderToken) return;
    activeImages = resolved.length > 0 ? resolved : uniqueImageSources(product.images);
    activeImageIndex = 0;
    renderGallery();
    if (window.history?.replaceState) {
      window.history.replaceState(null, '', `product.html?item=${activeProductKey}`);
    }
    if (productWishlistBtn) {
      productWishlistBtn.dataset.wishlistId = activeProductKey;
      productWishlistBtn.dataset.heartEmpty = '♡';
      productWishlistBtn.dataset.heartFull = '♥';
      applyWishlistState(productWishlistBtn);
    }
  };

  const renderProductOptions = async () => {
    if (!productVariantWrap || !productVariantOptions) return;

    productVariantWrap.hidden = false;
    productVariantOptions.innerHTML = '';

    for (const optionKey of optionKeys) {
      const option = productMap[optionKey];
      if (!option) continue;
      if (optionKey === activeProductKey) continue;
      const previewSrc = await resolveOptionPreview(optionKey);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `product-variant-btn${optionKey === activeProductKey ? ' is-active' : ''}`;
      btn.innerHTML = `
        <span class="product-variant-thumb-wrap">
          <img class="product-variant-thumb" src="${previewSrc}" alt="${option.name}" />
        </span>
        <span class="product-variant-name">${option.name.replace(/^product\s+/i, '').toLowerCase()}</span>
      `;
      btn.addEventListener('click', async () => {
        await setProduct(optionKey);
        await renderProductOptions();
      });
      productVariantOptions.appendChild(btn);
    }
  };

  prevImageBtn?.addEventListener('click', () => shiftImage(-1));
  nextImageBtn?.addEventListener('click', () => shiftImage(1));
  productMainImage.addEventListener('click', () => openFullscreenGallery(activeImageIndex));
  fullscreenClose?.addEventListener('click', closeFullscreenGallery);
  fullscreenModal?.addEventListener('click', (event) => {
    if (event.target === fullscreenModal) closeFullscreenGallery();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isFullscreenOpen) closeFullscreenGallery();
  });

  if (productMainMedia) {
    let touchStartX = 0;
    let touchStartY = 0;
    productMainMedia.addEventListener(
      'touchstart',
      (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      },
      { passive: true }
    );
    productMainMedia.addEventListener(
      'touchend',
      (event) => {
        if (!mobileProductQuery.matches) return;
        if (activeImages.length <= 1) return;
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) < 42) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        shiftImage(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );

    if (isDesktopHoverZoom) {
      zoomLens = document.createElement('div');
      zoomLens.className = 'product-zoom-lens';
      document.body.appendChild(zoomLens);
      setupZoomTarget(productMainImage);
      productMainMedia.addEventListener('mouseleave', hideZoomLens);
      productMainImage.addEventListener('click', hideZoomLens);
    }
  }

  if (!mobileProductQuery.matches) {
    prevImageBtn?.remove();
    nextImageBtn?.remove();
  }

  const onViewportChange = (event) => {
    if (!event.matches) {
      prevImageBtn?.remove();
      nextImageBtn?.remove();
    }
    renderGallery();
  };
  if (typeof mobileProductQuery.addEventListener === 'function') {
    mobileProductQuery.addEventListener('change', onViewportChange);
  } else if (typeof mobileProductQuery.addListener === 'function') {
    mobileProductQuery.addListener(onViewportChange);
  }

  if (productMainMedia) {
    mobileImageIndicator = document.createElement('div');
    mobileImageIndicator.className = 'mobile-image-indicator';
    mobileImageIndicator.setAttribute('aria-live', 'polite');
    productMainMedia.appendChild(mobileImageIndicator);
  }

  const defaultKey = entryKey;
  setProduct(defaultKey).then(async () => {
    await renderProductOptions();
  });

  addToCartButton?.addEventListener('click', () => {
    if (!requireAuthForPurchase()) return;
    const image = productMainImage.getAttribute('src') || activeImages[0] || '';
    const key = `${activeProductKey}`;
    const added = addCartItem({
      key,
      id: activeProductKey,
      name: activeProduct.name,
      price: 70,
      quantity: 1,
      image,
      option: `Variant ${activeProductKey.toUpperCase()}`
    });
    if (!added) return;

    const originalLabel = addToCartButton.textContent;
    addToCartButton.textContent = 'Added';
    window.setTimeout(() => {
      addToCartButton.textContent = originalLabel || 'Add to Cart';
    }, 820);
  });

  buyNowButton?.addEventListener('click', () => {
    if (!requireAuthForPurchase()) return;
    const image = productMainImage.getAttribute('src') || activeImages[0] || '';
    const key = `${activeProductKey}`;
    const added = addCartItem({
      key,
      id: activeProductKey,
      name: activeProduct.name,
      price: 70,
      quantity: 1,
      image,
      option: `Variant ${activeProductKey.toUpperCase()}`
    });
    if (!added) return;

    window.location.href = 'checkout.html';
  });

  productWishlistBtn?.addEventListener('click', () => {
    toggleWishlist(activeProductKey);
    refreshWishlistButtons(document);
  });
}

function initProductSizeGuide() {
  if (document.body.dataset.page !== 'product') return;

  const openBtn = document.querySelector('#sizeGuideBtn');
  const modal = document.querySelector('#sizeGuideModal');
  const closeBtn = document.querySelector('#sizeGuideClose');
  const sceneMount = document.querySelector('#sizeGuideScene');
  if (!openBtn || !modal || !closeBtn || !sceneMount) return;

  const focusButtons = Array.from(modal.querySelectorAll('.size-focus-btn'));
  const measureRows = Array.from(modal.querySelectorAll('[data-measure-row]'));
  const marks = Array.from(modal.querySelectorAll('.size-guide-mark'));
  const unitButtons = Array.from(modal.querySelectorAll('.size-unit-btn'));
  const valueNodes = Array.from(modal.querySelectorAll('[data-measure-value]'));
  const labelNodes = Array.from(modal.querySelectorAll('[data-measure-label]'));
  const unitMiniNodes = Array.from(modal.querySelectorAll('.size-unit-mini'));

  const measurementCm = {
    chest: 44,
    length: 24,
    shoulder: 18,
    sleeve: 30
  };
  const measureTitles = {
    chest: 'Chest',
    length: 'Length',
    shoulder: 'Shoulder',
    sleeve: 'Sleeve'
  };
  let currentUnit = 'cm';

  const formatValue = (value, unit) => {
    if (unit === 'cm') return `${value}`;
    const inch = value / 2.54;
    return inch.toFixed(1);
  };

  const renderUnits = () => {
    unitButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.unit === currentUnit));
    unitMiniNodes.forEach((node) => {
      node.textContent = currentUnit === 'inch' ? 'in' : 'cm';
    });
    valueNodes.forEach((node) => {
      const key = node.dataset.measureValue;
      if (!key || !(key in measurementCm)) return;
      node.textContent = formatValue(measurementCm[key], currentUnit);
    });
    labelNodes.forEach((node) => {
      const key = node.dataset.measureLabel;
      if (!key || !(key in measurementCm)) return;
      node.textContent = `${measureTitles[key]} ${formatValue(measurementCm[key], currentUnit)} ${currentUnit === 'inch' ? 'in' : 'cm'}`;
    });
  };

  const setActiveMeasure = (measure) => {
    focusButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.measure === measure));
    measureRows.forEach((row) => row.classList.toggle('is-active', row.dataset.measureRow === measure));
    marks.forEach((mark) => mark.classList.toggle('is-active', mark.dataset.measure === measure));
  };

  focusButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveMeasure(button.dataset.measure || 'chest'));
    button.addEventListener('mouseenter', () => setActiveMeasure(button.dataset.measure || 'chest'));
    button.addEventListener('focus', () => setActiveMeasure(button.dataset.measure || 'chest'));
  });
  measureRows.forEach((row) => {
    row.addEventListener('click', () => setActiveMeasure(row.dataset.measureRow || 'chest'));
  });
  unitButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const unit = button.dataset.unit;
      if (unit !== 'inch' && unit !== 'cm') return;
      currentUnit = unit;
      renderUnits();
    });
  });
  renderUnits();

  let initialized = false;
  let running = false;
  let rafId = 0;
  let renderer = null;
  let scene = null;
  let camera = null;
  let model = null;
  let targetY = 0;
  let isDragging = false;
  let dragX = 0;
  let dragVelocityY = 0;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const setSceneStatus = (text) => {
    sceneMount.innerHTML = '';
    const node = document.createElement('p');
    node.className = 'size-guide-scene-status';
    node.textContent = text;
    sceneMount.appendChild(node);
  };

  const ensureThreeAndLoader = async () => {
    if (!window.THREE) {
      const threeCandidates = [
        'assets/vendor-legacy/three.min.js',
        'https://unpkg.com/three@0.128.0/build/three.min.js'
      ];
      let threeReady = false;
      for (const src of threeCandidates) {
        try {
          await loadExternalScriptOnce(src);
          if (window.THREE) {
            threeReady = true;
            break;
          }
        } catch {
          // try next source
        }
      }
      if (!threeReady) return false;
    }

    if (!window.THREE.GLTFLoader) {
      const loaderCandidates = [
        'assets/vendor-legacy/GLTFLoader.js',
        'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'
      ];
      for (const src of loaderCandidates) {
        try {
          await loadExternalScriptOnce(src);
          if (window.THREE.GLTFLoader) break;
        } catch {
          // try next source
        }
      }
    }

    return Boolean(window.THREE && window.THREE.GLTFLoader);
  };

  const startLoop = () => {
    if (!renderer || !scene || !camera) return;
    if (running) return;
    running = true;

    const tick = () => {
      if (!running) return;
      rafId = window.requestAnimationFrame(tick);

      if (model) {
        // Keep model still by default; user rotates manually via drag.
        const rotationDamping = isCoarsePointer ? 0.18 : 0.13;
        model.rotation.y += (targetY - model.rotation.y) * rotationDamping;
        if (!isDragging) {
          targetY += dragVelocityY;
          dragVelocityY *= isCoarsePointer ? 0.92 : 0.88;
          if (Math.abs(dragVelocityY) < 0.00006) dragVelocityY = 0;
        }
      }

      renderer.render(scene, camera);
    };

    tick();
  };

  const stopLoop = () => {
    running = false;
    window.cancelAnimationFrame(rafId);
  };

  const initViewer = async () => {
    if (initialized) return;
    initialized = true;

    setSceneStatus('Loading 3D model...');

    const hasDeps = await ensureThreeAndLoader();
    if (!hasDeps) {
      setSceneStatus('3D viewer unavailable');
      return;
    }

    const THREE = window.THREE;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 0.1, 5.35);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setClearColor(0x000000, 0);
    if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    sceneMount.innerHTML = '';
    sceneMount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(2.6, 3.2, 4.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe9ecff, 0.44);
    fill.position.set(-2.4, 1.8, -3.6);
    scene.add(fill);

    const resize = () => {
      if (!renderer || !camera) return;
      const rect = sceneMount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };
    window.addEventListener('resize', resize);
    resize();

    const loader = new THREE.GLTFLoader();
    const modelCandidates = [
      'assets/models/sweater1.glb',
      'assets/models/sweater.glb'
    ];

    const tryLoad = (index) => {
      if (index >= modelCandidates.length) {
        setSceneStatus('Model not found: sweater1.glb');
        return;
      }

      loader.load(
        modelCandidates[index],
        (gltf) => {
          const root = gltf.scene || gltf.scenes?.[0];
          if (!root) {
            setSceneStatus('Invalid model data');
            return;
          }

          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center);
          root.position.y -= 0.16;

          const longest = Math.max(size.x, size.y, size.z) || 1;
          root.scale.setScalar(2.05 / longest);

          scene.add(root);
          model = root;
          startLoop();
        },
        undefined,
        () => tryLoad(index + 1)
      );
    };
    tryLoad(0);

    const onDragStart = (clientX) => {
      isDragging = true;
      dragX = clientX;
    };
    const onDragMove = (clientX) => {
      if (!isDragging) return;
      const dx = clientX - dragX;
      dragX = clientX;
      const sensitivity = isCoarsePointer ? 0.0085 : 0.012;
      const delta = dx * sensitivity;
      targetY += delta;
      dragVelocityY = delta;
    };
    const onDragEnd = () => {
      isDragging = false;
    };

    sceneMount.style.touchAction = 'none';

    if (supportsPointerEvents) {
      sceneMount.addEventListener('pointerdown', (event) => onDragStart(event.clientX));
      sceneMount.addEventListener('pointermove', (event) => onDragMove(event.clientX));
      sceneMount.addEventListener('pointerup', onDragEnd);
      sceneMount.addEventListener('pointercancel', onDragEnd);
      sceneMount.addEventListener('pointerleave', onDragEnd);
    } else {
      sceneMount.addEventListener('mousedown', (event) => onDragStart(event.clientX));
      sceneMount.addEventListener('mousemove', (event) => onDragMove(event.clientX));
      sceneMount.addEventListener('mouseup', onDragEnd);
      sceneMount.addEventListener('mouseleave', onDragEnd);
      sceneMount.addEventListener(
        'touchstart',
        (event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          onDragStart(touch.clientX);
        },
        { passive: true }
      );
      sceneMount.addEventListener(
        'touchmove',
        (event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          onDragMove(touch.clientX);
        },
        { passive: true }
      );
      sceneMount.addEventListener('touchend', onDragEnd, { passive: true });
      sceneMount.addEventListener('touchcancel', onDragEnd, { passive: true });
    }
  };

  const openModal = async () => {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-size-guide-open');
    setActiveMeasure('chest');
    await initViewer();
    startLoop();
  };

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-size-guide-open');
    stopLoop();
  };

  openBtn.addEventListener('click', () => {
    openModal();
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a[data-transition]');
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const href = anchor.getAttribute('href');
  if (
    !href ||
    href.startsWith('#') ||
    anchor.target === '_blank' ||
    anchor.hasAttribute('download') ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  if (useInstantMobileNav) {
    closeMenu();
    return;
  }

  event.preventDefault();
  closeMenu();
  document.body.classList.add('is-leaving');

  window.setTimeout(() => {
    window.location.href = href;
  }, PAGE_TRANSITION_MS);
});

function initStoryPhotoLightbox() {
  if (document.body.dataset.page !== 'story-photo') return;

  const lightbox = document.querySelector('#storyLightbox');
  const lightboxImage = document.querySelector('#storyLightboxImage');
  const closeButton = document.querySelector('#storyLightboxClose');
  const tiles = document.querySelectorAll('[data-photo-full]');
  if (!lightbox || !lightboxImage || !closeButton || !tiles.length) return;

  const close = () => {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-lightbox-open');
    window.setTimeout(() => {
      if (lightbox.classList.contains('is-open')) return;
      lightboxImage.src = '';
    }, 220);
  };

  const open = (src, alt) => {
    lightboxImage.src = src;
    lightboxImage.alt = alt || 'Expanded story photo';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-lightbox-open');
  };

  tiles.forEach((tile, index) => {
    tile.addEventListener('click', () => {
      const src = tile.getAttribute('data-photo-full');
      const img = tile.querySelector('img');
      if (!src) return;
      const alt = img?.alt || `Story photo ${index + 1}`;
      open(src, alt);
    });
  });

  closeButton.addEventListener('click', close);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      close();
    }
  });
}

function initStoryVideoPlayer() {
  if (document.body.dataset.page !== 'story-video-player') return;

  const title = document.querySelector('#storyPlayerTitle');
  const video = document.querySelector('#storyPlayerVideo');
  const source = document.querySelector('#storyPlayerSource');
  if (!title || !video || !source) return;

  source.src = 'assets/final21.mp4';
  video.poster = 'assets/story/final2-poster.jpg';
  title.textContent = 'Final2';
  video.load();
}

function initStoryMediaSwap() {
  if (document.body.dataset.page !== 'story') return;

  const swap = document.querySelector('#storyMediaSwap');
  const miniPhotoSwap = document.querySelector('#storyMiniPhotoSwap');
  const miniPhoto = document.querySelector('#storyMiniPhoto');
  const primaryPhoto = document.querySelector('#storyPrimaryPhoto');
  const primaryVideoWrap = document.querySelector('#storyPrimaryVideoWrap');
  const miniVideoSwap = document.querySelector('#storyMiniVideoSwap');
  const extraSection = document.querySelector('#storyExtraPhotos');
  const extraPhotoGrid = document.querySelector('#storyExtraPhotoGrid');
  const lightbox = document.querySelector('#storySwapLightbox');
  const lightboxImage = document.querySelector('#storySwapLightboxImage');
  const lightboxClose = document.querySelector('#storySwapLightboxClose');
  const mobileStoryQuery = window.matchMedia('(max-width: 860px)');
  if (!swap || !miniPhotoSwap || !miniPhoto || !primaryPhoto || !primaryVideoWrap || !miniVideoSwap || !extraSection || !extraPhotoGrid) return;

  const photoRoots = ['photo%20behind', 'photo behind', 'assets/photo%20behind', 'assets/photo behind', 'assets/photo-behind', 'assets/story'];
  const photoExtensions = ['jpg', 'JPG', 'jpeg', 'JPEG', 'png', 'PNG', 'webp', 'WEBP'];
  const initialKey = 'b6';
  const allPhotoKeys = Array.from({ length: 40 }, (_, index) => `b${index + 1}`);
  const coverCandidateKeys = allPhotoKeys;

  const resolvePhotoSrc = async (key) => {
    const candidates = [];
    photoRoots.forEach((root) => {
      photoExtensions.forEach((ext) => {
        candidates.push(`${root}/${key}.${ext}`);
      });
    });

    const checks = candidates.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(src);
          img.onerror = () => resolve(null);
          img.src = src;
        })
    );
    const results = await Promise.all(checks);
    return results.find(Boolean) || '';
  };

  const loadImageMeta = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ src, width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const setMode = (mode) => {
    const isPhotoPrimary = mode === 'photo';
    const isMobileStory = mobileStoryQuery.matches;
    swap.classList.toggle('is-photo-primary', isPhotoPrimary);
    swap.classList.toggle('is-video-primary', !isPhotoPrimary);
    // On mobile, keep extra photos visible so users can browse all images easily.
    if (isMobileStory) {
      extraSection.hidden = false;
      extraSection.classList.add('is-open');
    } else {
      extraSection.hidden = !isPhotoPrimary;
      extraSection.classList.toggle('is-open', isPhotoPrimary);
    }
    if (isMobileStory) {
      miniPhotoSwap.classList.add('is-hidden');
      miniPhotoSwap.setAttribute('aria-hidden', 'true');
    } else {
      miniPhotoSwap.classList.toggle('is-hidden', isPhotoPrimary);
      miniPhotoSwap.setAttribute('aria-hidden', isPhotoPrimary ? 'true' : 'false');
    }
    miniVideoSwap.setAttribute('aria-hidden', isPhotoPrimary ? 'false' : 'true');
    primaryVideoWrap.style.cursor = isPhotoPrimary ? 'pointer' : 'default';
    document.dispatchEvent(new CustomEvent('story-media-mode', { detail: { mode } }));
  };

  miniPhotoSwap.addEventListener('click', () => setMode('photo'));
  miniVideoSwap.addEventListener('click', () => setMode('video'));
  primaryVideoWrap.addEventListener('click', (event) => {
    if (!swap.classList.contains('is-photo-primary')) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest('video') || target.closest('#storyMiniVideoSwap'))) {
      setMode('video');
    }
  });

  const openLightbox = (src, alt) => {
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = src;
    lightboxImage.alt = alt || 'Expanded story image';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-lightbox-open');
  };

  const closeLightbox = () => {
    if (!lightbox || !lightboxImage) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-lightbox-open');
    window.setTimeout(() => {
      if (lightbox.classList.contains('is-open')) return;
      lightboxImage.src = '';
    }, 180);
  };

  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox?.classList.contains('is-open')) {
      closeLightbox();
    }
  });

  primaryPhoto.addEventListener('click', () => {
    if (!primaryPhoto.src) return;
    if (mobileStoryQuery.matches) return;
    openLightbox(primaryPhoto.src, primaryPhoto.alt);
  });

  extraPhotoGrid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const tile = target.closest('.story-extra-photo-tile');
    if (!(tile instanceof HTMLButtonElement)) return;
    const img = tile.querySelector('img');
    if (!img?.src) return;
    primaryPhoto.src = img.src;
    miniPhoto.src = img.src;
    setMode('photo');
    if (!mobileStoryQuery.matches) {
      openLightbox(img.src, img.alt);
    }
  });

  const boot = async () => {
    let initialSrc = '';
    for (const key of coverCandidateKeys) {
      const src = await resolvePhotoSrc(key);
      if (!src) continue;
      const meta = await loadImageMeta(src);
      if (!meta) continue;
      if (meta.width > meta.height) {
        initialSrc = src;
        break;
      }
    }

    if (!initialSrc) {
      initialSrc = await resolvePhotoSrc(initialKey);
    }
    if (!initialSrc) initialSrc = 'assets/p01/p01.JPG';

    if (primaryPhoto) {
      primaryPhoto.style.objectFit = 'cover';
    }
    primaryPhoto.src = initialSrc;
    miniPhoto.src = initialSrc;

    const extraPhotoKeys = mobileStoryQuery.matches
      ? allPhotoKeys
      : allPhotoKeys.filter((key) => key !== initialKey);

    extraPhotoGrid.innerHTML = '';
    for (const key of extraPhotoKeys) {
      const src = await resolvePhotoSrc(key);
      if (!src) continue;
      const tile = document.createElement('button');
      tile.className = 'story-extra-photo-tile';
      tile.type = 'button';
      tile.setAttribute('data-photo-key', key);
      tile.innerHTML = `<img src="${src}" alt="Behind photo ${key}" />`;
      extraPhotoGrid.appendChild(tile);
    }

    if (!extraPhotoGrid.children.length) {
      const fallback = document.createElement('p');
      fallback.className = 'muted';
      fallback.textContent = 'No extra photos found.';
      extraPhotoGrid.appendChild(fallback);
    }

    setMode('video');
  };

  boot();
}

function initStoryCenterVideoControl() {
  if (document.body.dataset.page !== 'story') return;

  const video = document.querySelector('#storyMainVideo');
  const button = document.querySelector('#storyCenterControl');
  const swap = document.querySelector('#storyMediaSwap');
  if (!video || !button) return;
  const isTouchLike = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // On touch devices, rely on native video controls to avoid play-blocking overlays.
  if (isTouchLike) {
    button.style.display = 'none';
    button.setAttribute('aria-hidden', 'true');
    return;
  }

  const syncButton = () => {
    const videoPrimary = !swap || swap.classList.contains('is-video-primary');
    if (!videoPrimary) {
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
      return;
    }

    if (video.paused) {
      button.textContent = 'Play';
      button.setAttribute('aria-label', 'Play video');
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
    } else {
      button.textContent = 'Pause';
      button.setAttribute('aria-label', 'Pause video');
      button.style.opacity = '0';
      button.style.pointerEvents = 'none';
    }
  };

  button.addEventListener('click', () => {
    if (video.paused) {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      video.pause();
    }
    syncButton();
  });

  video.addEventListener('play', syncButton);
  video.addEventListener('pause', syncButton);
  document.addEventListener('story-media-mode', syncButton);
  syncButton();
}

function initGateMinigame() {
  if (document.body.dataset.page !== 'gate') return;

  const sceneMount = document.querySelector('#gateScene');
  const statusText = document.querySelector('#gateStatus');
  const cinematic = document.querySelector('#gateCinematic');
  const soundToggle = document.querySelector('#gateSoundToggle');
  if (!sceneMount || !statusText || !cinematic) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nextTarget = sanitizeNextTarget(gateParams.get('next'));
  let unlocked = false;
  let unlockProgress = 0;
  let audioEnabled = false;
  let audioContext = null;
  const unlockTarget = Math.PI * 0.35;
  let model = null;
  let mixer = null;
  let isDragging = false;
  let pointerX = 0;
  let targetRotationY = 0;
  let targetRotationX = 0;
  let spinMomentum = 0;
  let modelBaseScale = 1;
  let modelScaleBoost = 0;

  const updateProgressText = () => {
    if (unlocked) return;
    const pct = Math.max(0, Math.min(100, Math.round((unlockProgress / unlockTarget) * 100)));
    statusText.textContent = `Rotate to unlock ${pct}%`;
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Cannot load script: ${src}`));
    document.head.appendChild(s);
  });

  const ensureGLTFLoader = async () => {
    if (!window.THREE) return false;
    if (THREE.GLTFLoader) return true;

    const candidates = [
      'assets/vendor-legacy/GLTFLoader.js',
      '/assets/vendor-legacy/GLTFLoader.js',
      'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'
    ];

    for (const src of candidates) {
      try {
        await loadScript(src);
        if (THREE.GLTFLoader) return true;
      } catch {
        // Try next source.
      }
    }
    return false;
  };

  const playWinTone = () => {
    if (!audioEnabled) return;

    try {
      if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        audioContext = new AudioCtx();
      }

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio should never block access.
    }
  };

  const finishGate = () => {
    if (unlocked) return;
    unlocked = true;
    setGatePassedNow();
    statusText.textContent = 'Access granted';
    unlockProgress = unlockTarget;
    playWinTone();

    document.body.classList.add('gate-is-winning');
    cinematic.setAttribute('aria-hidden', 'false');

    const delay = reducedMotion ? 260 : 1100;
    window.setTimeout(() => {
      window.location.replace(nextTarget || GATE_FALLBACK_TARGET);
    }, delay);
  };

  const initThreeScene = async () => {
    if (!window.THREE) {
      statusText.textContent = '3D unavailable';
      return;
    }

    const hasLoader = await ensureGLTFLoader();
    if (!hasLoader) {
      statusText.textContent = 'GLB loader missing';
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 0.2, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    if ('outputEncoding' in renderer && 'sRGBEncoding' in THREE) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    sceneMount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(2.2, 3.8, 4.4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xe8ecff, 0.24);
    rimLight.position.set(-2.4, 1.5, -3.2);
    scene.add(rimLight);
    const keyLightBase = 0.95;
    const rimLightBase = 0.24;

    const resize = () => {
      const rect = sceneMount.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height, false);
    };
    window.addEventListener('resize', resize);
    resize();

    const loader = new THREE.GLTFLoader();
    const modelPaths = [
      'assets/models/p1.glb',
      '/assets/models/p1.glb'
    ];
    const tryLoadModel = (index) => {
      if (index >= modelPaths.length) {
        statusText.textContent = 'Cannot load model';
        return;
      }

      loader.load(
        modelPaths[index],
        (gltf) => {
          const root = gltf.scene || gltf.scenes?.[0];
          if (!root) {
            statusText.textContent = 'Model data missing';
            return;
          }

          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center);
          const largest = Math.max(size.x, size.y, size.z) || 1;
          modelBaseScale = 2.1 / largest;
          root.scale.setScalar(modelBaseScale);

          scene.add(root);
          model = root;

          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(root);
            const action = mixer.clipAction(gltf.animations[0]);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
          }
        },
        undefined,
        () => tryLoadModel(index + 1)
      );
    };
    tryLoadModel(0);

    const clock = new THREE.Clock();
    let rafId = 0;
    let running = true;
    const animate = () => {
      if (!running) return;
      rafId = window.requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (model) {
        // Smoothly animate toward drag target for a more premium interaction.
        spinMomentum *= 0.9;
        model.rotation.y += (targetRotationY - model.rotation.y) * 0.16;
        model.rotation.x += (targetRotationX - model.rotation.x) * 0.12;
        targetRotationX *= 0.92;

        if (!isDragging) {
          targetRotationY += 0.0045 + (spinMomentum * 0.25);
        }

        // Interactive deformation + light pulse while rotating.
        const spinEnergy = Math.min(1, Math.abs(spinMomentum) * 18 + (isDragging ? 0.12 : 0));
        modelScaleBoost += ((spinEnergy * 0.045) - modelScaleBoost) * 0.18;
        model.scale.setScalar(modelBaseScale * (1 + modelScaleBoost));

        keyLight.intensity = keyLightBase + (spinEnergy * 0.35);
        rimLight.intensity = rimLightBase + (spinEnergy * 0.22);
      }
      if (mixer) {
        mixer.update(delta);
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    const onPointerDown = (event) => {
      if (unlocked) return;
      isDragging = true;
      pointerX = event.clientX;
      sceneMount.classList.add('is-dragging');
      if (typeof event.pointerId === 'number') {
        sceneMount.setPointerCapture?.(event.pointerId);
      }
    };

    const onPointerMove = (event) => {
      if (!isDragging || !model || unlocked) return;
      const deltaX = event.clientX - pointerX;
      pointerX = event.clientX;
      const amount = deltaX * 0.012;
      targetRotationY += amount;
      targetRotationX = Math.max(-0.2, Math.min(0.2, targetRotationX + amount * 0.08));
      spinMomentum = Math.max(-0.22, Math.min(0.22, amount));
      unlockProgress += Math.abs(amount);
      updateProgressText();
      if (unlockProgress >= unlockTarget) {
        finishGate();
      }
    };

    const endDrag = () => {
      isDragging = false;
      sceneMount.classList.remove('is-dragging');
    };

    if (supportsPointerEvents) {
      sceneMount.addEventListener('pointerdown', onPointerDown);
      sceneMount.addEventListener('pointermove', onPointerMove);
      sceneMount.addEventListener('pointerup', endDrag);
      sceneMount.addEventListener('pointercancel', endDrag);
      sceneMount.addEventListener('pointerleave', endDrag);
    } else {
      sceneMount.addEventListener('mousedown', (event) => onPointerDown(event));
      sceneMount.addEventListener('mousemove', (event) => onPointerMove(event));
      sceneMount.addEventListener('mouseup', endDrag);
      sceneMount.addEventListener('mouseleave', endDrag);
      sceneMount.addEventListener(
        'touchstart',
        (event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          onPointerDown({ clientX: touch.clientX });
        },
        { passive: true }
      );
      sceneMount.addEventListener(
        'touchmove',
        (event) => {
          const touch = event.touches?.[0];
          if (!touch) return;
          onPointerMove({ clientX: touch.clientX });
        },
        { passive: true }
      );
      sceneMount.addEventListener('touchend', endDrag, { passive: true });
      sceneMount.addEventListener('touchcancel', endDrag, { passive: true });
    }
    window.addEventListener('blur', endDrag);

    const onVisibilityChange = () => {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        clock.start();
        animate();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    clock.start();
    animate();
  };

  soundToggle?.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    soundToggle.textContent = audioEnabled ? 'Sound On' : 'Sound Off';
    soundToggle.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false');
  });

  updateProgressText();
  initThreeScene();
}

function initHomeContactBar() {
  if (document.body.dataset.page !== 'home') return;

  const contactbar = document.querySelector('.contactbar');
  if (!contactbar) return;
  contactbar.classList.add('contactbar--visible');
}

function initGlobalFootnote() {
  const page = document.body.dataset.page || '';
  if (page === 'home' || page === 'gate') return;

  let footnote = document.querySelector('.contactbar');
  if (!footnote) {
    footnote = document.createElement('aside');
    footnote.className = 'contactbar contactbar--global';
    footnote.setAttribute('aria-label', 'Contact');
    footnote.innerHTML = `
      <div class="contactbar__inner">
        <div class="contactbar__links">
          <a class="contactbar__link" href="https://www.instagram.com/filialproject/" target="_blank" rel="noopener">Instagram</a>
          <a class="contactbar__link" href="mailto:filialproject@gmail.com">filialproject@gmail.com</a>
        </div>
        <span class="contactbar__loc">Based in Manhattan, New York</span>
      </div>
    `;
    document.body.appendChild(footnote);
  }

  footnote.classList.add('contactbar--global', 'contactbar--visible');
}

function initHomeNewAvailableCarousel() {
  if (document.body.dataset.page !== 'home') return;

  const track = document.querySelector('#homeNewAvailableTrack');
  const prevBtn = document.querySelector('[data-home-slide="prev"]');
  const nextBtn = document.querySelector('[data-home-slide="next"]');
  const pageCounter = document.querySelector('#homeNewAvailablePage');
  if (!track || !prevBtn || !nextBtn) return;

  const homeProducts = [
    { id: 'p01', name: 'Product p01', price: 70, image: 'assets/p01/p01.JPG' },
    { id: 'p02', name: 'Product p02', price: 70, image: 'assets/p02/p02.JPG' },
    { id: 'p03', name: 'Product p03', price: 70, image: 'assets/p03/p03.JPG' },
    { id: 'p04', name: 'Product p04', price: 70, image: 'assets/p04/p04.JPG' },
    { id: 'p05', name: 'Product p05', price: 70, image: 'assets/p05/p05.JPG' },
    { id: 'p06', name: 'Product p06', price: 70, image: 'assets/p06/p06.JPG' }
  ];

  const pageSize = 3;
  let pageIndex = 0;
  let shifting = false;
  const totalPages = Math.max(1, Math.ceil(homeProducts.length / pageSize));

  const render = () => {
    const start = pageIndex * pageSize;
    const visibleProducts = homeProducts.slice(start, start + pageSize);
    track.innerHTML = '';

    visibleProducts.forEach((product) => {
      const card = document.createElement('article');
      card.className = 'home-new-card';
      card.innerHTML = `
        <a class="home-new-card-media fx-link" href="product.html?item=${product.id}" data-transition>
          <img src="${product.image}" alt="${product.name}" />
        </a>
        <div class="home-new-card-copy">
          <h3>${product.name.toUpperCase()}</h3>
          <span>${formatUsd(product.price)}</span>
        </div>
        <div class="home-new-card-actions">
          <button class="home-new-card-add" type="button">Add to Cart</button>
        </div>
      `;

      const addButton = card.querySelector('.home-new-card-add');
      const actions = card.querySelector('.home-new-card-actions');
      if (actions) {
        const heartButton = createWishlistButton(product.id, { className: 'wishlist-btn home-new-card-heart', text: '♡' });
        actions.appendChild(heartButton);
      }
      addButton?.addEventListener('click', () => {
        if (!requireAuthForPurchase()) return;
        const added = addCartItem({
          key: product.id,
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.image,
          option: ''
        });
        if (!added) return;

        const originalLabel = addButton.textContent;
        addButton.textContent = 'Added';
        window.setTimeout(() => {
          addButton.textContent = originalLabel || 'Add to Cart';
        }, 760);
      });

      track.appendChild(card);
    });
    refreshWishlistButtons(track);

    if (pageCounter) {
      pageCounter.textContent = `${pageIndex + 1} / ${totalPages}`;
    }
  };

  const shiftTo = (direction) => {
    if (shifting) return;
    const maxPage = Math.ceil(homeProducts.length / pageSize) - 1;
    let nextPage = pageIndex + direction;
    if (nextPage > maxPage) nextPage = 0;
    if (nextPage < 0) nextPage = maxPage;
    if (nextPage === pageIndex) return;

    shifting = true;
    track.classList.add(direction > 0 ? 'is-shifting-next' : 'is-shifting-prev');

    window.setTimeout(() => {
      pageIndex = nextPage;
      render();
      track.classList.remove('is-shifting-next', 'is-shifting-prev');
      shifting = false;
    }, 220);
  };

  prevBtn.addEventListener('click', () => shiftTo(-1));
  nextBtn.addEventListener('click', () => shiftTo(1));
  render();
}

function initMobileQuickNav() {
  if (document.body.dataset.page === 'gate') return;
  if (window.matchMedia('(max-width: 900px)').matches) return;
  if (document.querySelector('.mobile-quick-nav')) return;

  const nav = document.createElement('nav');
  nav.className = 'mobile-quick-nav';
  nav.setAttribute('aria-label', 'Quick navigation');
  nav.innerHTML = `
    <a class="mobile-quick-nav__link fx-link" href="shop.html" data-transition>Shop</a>
    <a class="mobile-quick-nav__link fx-link" href="story.html" data-transition>Story</a>
    <a class="mobile-quick-nav__link fx-link" href="about.html" data-transition>About</a>
    <a class="mobile-quick-nav__link mobile-quick-nav__link--cart fx-link" href="cart.html" data-transition aria-label="Cart"><span class="cart-icon" aria-hidden="true"><img src="assets/cart-icon-minimal.svg" alt="" /></span><span data-cart-count>0</span></a>
    <a class="mobile-quick-nav__link fx-link" id="mobileAccountLink" href="${readSession() ? 'account.html' : 'login.html'}" data-transition aria-label="Account"><span class="account-icon" aria-hidden="true"><img src="assets/account-icon-minimal.svg" alt="" /></span></a>
  `;

  const current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  nav.querySelectorAll('a').forEach((link) => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (href === current) link.classList.add('is-active');
  });

  document.body.classList.add('has-mobile-quick-nav');
  document.body.appendChild(nav);
}

function initCartPage() {
  if (document.body.dataset.page !== 'cart') return;

  const itemsRoot = document.querySelector('#cartItems');
  const totalNode = document.querySelector('#cartTotalPrice');
  const checkoutBtn = document.querySelector('#cartCheckoutBtn');
  if (!itemsRoot || !totalNode || !checkoutBtn) return;

  const render = () => {
    const items = readCartItems();
    const total = getCartTotal(items);
    totalNode.textContent = formatUsd(total);
    checkoutBtn.classList.toggle('is-disabled', items.length === 0);
    checkoutBtn.setAttribute('aria-disabled', items.length === 0 ? 'true' : 'false');

    if (!items.length) {
      itemsRoot.innerHTML = `
        <article class="cart-item cart-item--empty">
          <p>Your cart is empty.</p>
          <a class="size-guide-btn cart-empty-link fx-link" href="shop.html" data-transition>Go to Shop</a>
        </article>
      `;
      return;
    }

    itemsRoot.innerHTML = items
      .map((item) => {
        const linePrice = (item.price || 0) * (item.quantity || 0);
        return `
          <article class="cart-item" data-cart-key="${item.key}">
            <div class="cart-item-media">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" />` : '<span>No image</span>'}
            </div>
            <div class="cart-item-content">
              <h3>${item.name}</h3>
              <p class="cart-item-meta">${item.option || item.id.toUpperCase()}</p>
              <p class="cart-item-price">${formatUsd(item.price)}</p>
              <div class="cart-item-actions">
                <button type="button" class="size-focus-btn" data-cart-action="minus" data-cart-key="${item.key}">-</button>
                <span class="cart-item-qty">${item.quantity}</span>
                <button type="button" class="size-focus-btn" data-cart-action="plus" data-cart-key="${item.key}">+</button>
                <button type="button" class="size-guide-btn cart-remove-btn" data-cart-action="remove" data-cart-key="${item.key}">Remove</button>
              </div>
            </div>
            <p class="cart-item-line-total">${formatUsd(linePrice)}</p>
          </article>
        `;
      })
      .join('');
  };

  itemsRoot.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-cart-action');
    const key = target.getAttribute('data-cart-key');
    if (!action || !key) return;

    const items = readCartItems();
    const item = items.find((entry) => entry.key === key);
    if (!item) return;

    if (action === 'minus') {
      if (item.quantity <= 1) {
        removeCartItem(key);
      } else {
        setCartItemQuantity(key, item.quantity - 1);
      }
    } else if (action === 'plus') {
      setCartItemQuantity(key, item.quantity + 1);
    } else if (action === 'remove') {
      removeCartItem(key);
    }

    render();
  });

  checkoutBtn.addEventListener('click', (event) => {
    if (readCartItems().length > 0) return;
    event.preventDefault();
  });
  checkoutBtn.addEventListener('click', (event) => {
    if (!requireAuthForPurchase()) {
      event.preventDefault();
    }
  });

  render();
}

function initShopWishlistButtons() {
  if (document.body.dataset.page !== 'shop') return;
  // Shop page intentionally has no wishlist heart button.
}

function initCheckoutPage() {
  if (document.body.dataset.page !== 'checkout') return;
  if (!readSession()) {
    const next = encodeURIComponent(`${currentPageFile}${window.location.search}${window.location.hash}`);
    window.location.replace(`login.html?next=${next}`);
    return;
  }

  const totalNode = document.querySelector('#checkoutTotalPrice');
  const payBtn = document.querySelector('#checkoutPayBtn');
  if (!totalNode || !payBtn) return;

  const render = () => {
    const items = readCartItems();
    const total = getCartTotal(items);
    totalNode.textContent = formatUsd(total);
    payBtn.disabled = items.length === 0;
    payBtn.textContent = items.length === 0 ? 'Cart Empty' : 'Pay Now';
  };

  payBtn.addEventListener('click', () => {
    const items = readCartItems();
    if (!items.length) return;
    writeCartItems([]);
    updateCartIndicators();
    render();
    window.alert('Payment complete. Thank you.');
    window.location.href = 'index.html';
  });

  render();
}

function initLoginPage() {
  if (document.body.dataset.page !== 'login') return;

  const session = readSession();
  const loginParams = new URLSearchParams(window.location.search);
  const nextTarget = resolveSafeNextTarget(loginParams.get('next'), 'account.html');
    if (session) {
    window.location.replace(nextTarget);
    return;
  }

  const form = document.querySelector('#loginForm');
  const emailInput = document.querySelector('#loginEmail');
  const passwordInput = document.querySelector('#loginPassword');
  const confirmLabel = document.querySelector('#signupConfirmLabel');
  const confirmInput = document.querySelector('#signupConfirmPassword');
  const titleNode = document.querySelector('#authTitle');
  const submitButton = document.querySelector('#authSubmitBtn');
  const testLoginButton = document.querySelector('#testLoginBtn');
  const loginModeButton = document.querySelector('#authLoginMode');
  const signupModeButton = document.querySelector('#authSignupMode');
  const errorNode = document.querySelector('#loginError');
  if (!form || !emailInput || !passwordInput || !confirmLabel || !confirmInput || !titleNode || !submitButton || !loginModeButton || !signupModeButton || !errorNode) return;

  let mode = 'login';

  const setMode = (nextMode) => {
    mode = nextMode;
    const isSignup = mode === 'signup';
    titleNode.textContent = isSignup ? 'Sign up' : 'Log in';
    submitButton.textContent = isSignup ? 'Sign up' : 'Log in';
    confirmLabel.hidden = !isSignup;
    confirmInput.hidden = !isSignup;
    loginModeButton.classList.toggle('is-active', !isSignup);
    signupModeButton.classList.toggle('is-active', isSignup);
    loginModeButton.setAttribute('aria-selected', isSignup ? 'false' : 'true');
    signupModeButton.setAttribute('aria-selected', isSignup ? 'true' : 'false');
    errorNode.hidden = true;
    errorNode.textContent = '';
  };

  loginModeButton.addEventListener('click', () => setMode('login'));
  signupModeButton.addEventListener('click', () => setMode('signup'));
  setMode('login');

  testLoginButton?.addEventListener('click', () => {
    const testEmail = 'test@filialproject.com';
    const testPassword = 'test1234';
    const accounts = readAccounts();
    const existing = accounts.find((entry) => entry.email === testEmail);
    if (!existing) {
      accounts.push({
        email: testEmail,
        password: testPassword,
        createdAt: Date.now()
      });
      writeAccounts(accounts);
    }
    writeSession(testEmail);
    window.location.href = nextTarget;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = String(emailInput.value || '').trim().toLowerCase();
    const password = String(passwordInput.value || '');
    if (!email || !email.includes('@')) {
      errorNode.hidden = false;
      errorNode.textContent = 'Please enter a valid email.';
      return;
    }
    if (password.length < 6) {
      errorNode.hidden = false;
      errorNode.textContent = 'Password must be at least 6 characters.';
      return;
    }

    const accounts = readAccounts();
    const existing = accounts.find((entry) => entry.email === email);

    if (mode === 'signup') {
      const confirmPassword = String(confirmInput.value || '');
      if (password !== confirmPassword) {
        errorNode.hidden = false;
        errorNode.textContent = 'Passwords do not match.';
        return;
      }
      if (existing) {
        errorNode.hidden = false;
        errorNode.textContent = 'This email is already registered. Please log in.';
        return;
      }
      accounts.push({
        email,
        password,
        createdAt: Date.now()
      });
      writeAccounts(accounts);
      errorNode.hidden = true;
      writeSession(email);
      window.location.href = nextTarget;
      return;
    }

    if (!existing) {
      errorNode.hidden = false;
      errorNode.textContent = 'No account found. Please sign up first.';
      return;
    }
    if (existing.password !== password) {
      errorNode.hidden = false;
      errorNode.textContent = 'Incorrect password.';
      return;
    }

    errorNode.hidden = true;
    writeSession(email);
    window.location.href = nextTarget;
  });
}

function initAccountPage() {
  if (document.body.dataset.page !== 'account') return;

  const session = readSession();
  if (!session) {
    window.location.replace('login.html');
    return;
  }

  const emailNode = document.querySelector('#accountEmail');
  const logoutBtn = document.querySelector('#logoutBtn');
  const wishlistNode = document.querySelector('#accountWishlist');
  if (emailNode) emailNode.textContent = session.email;
  if (wishlistNode) {
    const catalog = {
      p01: { id: 'p01', name: 'Product p01', image: 'assets/p01/p01.JPG', price: 70 },
      p02: { id: 'p02', name: 'Product p02', image: 'assets/p02/p02.JPG', price: 70 },
      p03: { id: 'p03', name: 'Product p03', image: 'assets/p03/p03.JPG', price: 70 },
      p04: { id: 'p04', name: 'Product p04', image: 'assets/p04/p04.JPG', price: 70 },
      p05: { id: 'p05', name: 'Product p05', image: 'assets/p05/p05.JPG', price: 70 },
      p06: { id: 'p06', name: 'Product p06', image: 'assets/p06/p06.JPG', price: 70 }
    };

    const renderWishlist = () => {
      const items = readWishlist(session.email);
      if (!items.length) {
        wishlistNode.innerHTML = '<span class="account-wishlist-empty">No wishlist items yet.</span>';
        return;
      }

      wishlistNode.innerHTML = items
        .map((id) => {
          const product = catalog[id] || { id, name: id.toUpperCase(), image: '', price: 70 };
          return `
            <article class="account-wishlist-card" data-wishlist-item="${product.id}">
              <a class="account-wishlist-media fx-link" href="product.html?item=${product.id}" data-transition>
                ${product.image ? `<img src="${product.image}" alt="${product.name}" />` : '<span>No image</span>'}
              </a>
              <div class="account-wishlist-copy">
                <p>${product.name}</p>
                <span>${formatUsd(product.price)}</span>
              </div>
              <button class="cta-main account-wishlist-buy" type="button" data-account-buy="${product.id}">Add to Cart</button>
            </article>
          `;
        })
        .join('');
    };

    wishlistNode.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const productId = target.getAttribute('data-account-buy');
      if (!productId) return;
      const product = catalog[productId] || { id: productId, name: productId.toUpperCase(), image: '', price: 70 };
      const added = addCartItem({
        key: product.id,
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image,
        option: `Variant ${product.id.toUpperCase()}`
      });
      if (!added) return;
      const original = target.textContent;
      target.textContent = 'Added';
      window.setTimeout(() => {
        target.textContent = original || 'Add to Cart';
      }, 800);
    });

    renderWishlist();
  }

  logoutBtn?.addEventListener('click', () => {
    clearSession();
    window.location.href = 'login.html';
  });
}

initStoryPhotoLightbox();
initStoryVideoPlayer();
initStoryMediaSwap();
initStoryCenterVideoControl();
initGateMinigame();
initAccountLink();
initHeaderScrollState();
initMobileHeaderCollapse();
initHomeContactBar();
initGlobalFootnote();
initHomeNewAvailableCarousel();
initMobileQuickNav();
initShopWishlistButtons();
initCartPage();
initCheckoutPage();
initLoginPage();
initAccountPage();
initMobileMediaCompatibility();
initProductSizeGuide();
updateCartIndicators();
refreshWishlistButtons(document);
