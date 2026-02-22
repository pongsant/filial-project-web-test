const GATE_STORAGE_KEY = 'gatePassedSession';
const GATE_PAGE = 'gate.html';
const GATE_FALLBACK_TARGET = 'index.html';
const GATE_PROTECTED_PAGES = new Set([
  'index.html',
  'shop.html',
  'product.html',
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
const PAGE_TRANSITION_MS = prefersReducedMotion ? 80 : 760;
const supportsPointerEvents = 'PointerEvent' in window;

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

document.body.classList.add('is-entering');
window.requestAnimationFrame(() => {
  window.requestAnimationFrame(() => {
    document.body.classList.remove('is-entering');
  });
});

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

  const imageCandidates = (folder, base) => [
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
      images: imageCandidates('p01', 'p01')
    },
    p02: {
      code: 'Item 02',
      name: 'Product p02',
      description: 'Independent product code p02.',
      images: imageCandidates('p02', 'p02')
    },
    p03: {
      code: 'Item 03',
      name: 'Product p03',
      description: 'Independent product code p03.',
      images: imageCandidates('p03', 'p03')
    },
    p04: {
      code: 'Item 04',
      name: 'Product p04',
      description: 'Independent product code p04.',
      images: imageCandidates('p04', 'p04')
    },
    p05: {
      code: 'Item 05',
      name: 'Product p05',
      description: 'Independent product code p05.',
      images: imageCandidates('p05', 'p05')
    },
    p06: {
      code: 'Item 06',
      name: 'Product p06',
      description: 'Independent product code p06.',
      images: imageCandidates('p06', 'p06')
    }
  };

  const query = new URLSearchParams(window.location.search);
  const entryKey = query.get('item') || 'p01';
  let activeImageIndex = 0;
  let activeImages = [];
  let activeProduct = productMap.p01;
  let activeProductKey = 'p01';
  let renderToken = 0;
  const p01OptionKeys = ['p03', 'p04', 'p05', 'p06'];

  const resolveExistingImages = async (candidates) => {
    const checks = candidates.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(src);
          img.onerror = () => resolve(null);
          img.src = src;
        })
    );
    const resolved = await Promise.all(checks);
    return resolved.filter(Boolean);
  };

  function renderGallery() {
    if (!activeImages.length) return;
    productMainImage.src = activeImages[activeImageIndex];
    productMainImage.alt = `${activeProduct.name} image ${activeImageIndex + 1}`;
    thumbRow.innerHTML = '';

    activeImages.forEach((imgSrc, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = `thumb-btn${index === activeImageIndex ? ' is-active' : ''}`;
      thumb.setAttribute('aria-label', `View image ${index + 1}`);
      thumb.innerHTML = `<img src=\"${imgSrc}\" alt=\"${activeProduct.name} thumbnail ${index + 1}\" />`;
      thumb.addEventListener('click', () => {
        activeImageIndex = index;
        renderGallery();
      });
      thumbRow.appendChild(thumb);
    });
  }

  const setProduct = async (productKey) => {
    const product = productMap[productKey] || productMap.p01;
    activeProductKey = productKey in productMap ? productKey : 'p01';
    activeProduct = product;
    productCode.textContent = product.code;
    productName.textContent = product.name;
    productDescription.textContent = product.description;

    const token = ++renderToken;
    const resolved = await resolveExistingImages(product.images);
    if (token !== renderToken) return;
    activeImages = resolved.length > 0 ? resolved : product.images;
    activeImageIndex = 0;
    renderGallery();
  };

  const renderP01Options = () => {
    if (!productVariantWrap || !productVariantOptions) return;

    if (entryKey !== 'p01') {
      productVariantWrap.hidden = true;
      productVariantOptions.innerHTML = '';
      return;
    }

    productVariantWrap.hidden = false;
    productVariantOptions.innerHTML = '';

    p01OptionKeys.forEach((optionKey) => {
      const option = productMap[optionKey];
      if (!option) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `product-variant-btn${optionKey === activeProductKey ? ' is-active' : ''}`;
      btn.textContent = option.name.toUpperCase();
      btn.addEventListener('click', async () => {
        await setProduct(optionKey);
        renderP01Options();
      });
      productVariantOptions.appendChild(btn);
    });
  };

  prevImageBtn?.addEventListener('click', () => {
    if (!activeImages.length) return;
    activeImageIndex = (activeImageIndex - 1 + activeImages.length) % activeImages.length;
    renderGallery();
  });

  nextImageBtn?.addEventListener('click', () => {
    if (!activeImages.length) return;
    activeImageIndex = (activeImageIndex + 1) % activeImages.length;
    renderGallery();
  });

  const defaultKey = entryKey;
  setProduct(defaultKey).then(() => {
    renderP01Options();
  });
}

document.querySelectorAll('a[data-transition]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
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

    event.preventDefault();
    closeMenu();
    document.body.classList.add('is-leaving');

    window.setTimeout(() => {
      window.location.href = href;
    }, PAGE_TRANSITION_MS);
  });
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

function initStoryCenterVideoControl() {
  if (document.body.dataset.page !== 'story') return;

  const video = document.querySelector('#storyMainVideo');
  const button = document.querySelector('#storyCenterControl');
  if (!video || !button) return;
  const isTouchLike = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // On touch devices, rely on native video controls to avoid play-blocking overlays.
  if (isTouchLike) {
    button.style.display = 'none';
    button.setAttribute('aria-hidden', 'true');
    return;
  }

  const syncButton = () => {
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

  let lastScrollY = window.scrollY || 0;
  let ticking = false;

  const showBar = () => {
    contactbar.classList.add('contactbar--visible');
  };

  const hideBar = () => {
    contactbar.classList.remove('contactbar--visible');
  };

  const update = () => {
    const y = window.scrollY || 0;
    const scrollingDown = y > lastScrollY;

    if (y > 120 && scrollingDown) {
      showBar();
    }

    lastScrollY = y;
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

  // Fallback: if page has very little scroll space, wheel-down should still reveal the bar.
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.deltaY > 4) {
        showBar();
      }
    },
    { passive: true }
  );

  // Hide only when user clicks empty upper area outside the bar.
  const hideBarIfOutsideUpperArea = (event) => {
    if (!contactbar.classList.contains('contactbar--visible')) return;

    const target = event.target;
    if (!(target instanceof Node)) return;
    if (contactbar.contains(target)) return;

    const touch = event.touches?.[0];
    const clickY = (typeof event.clientY === 'number' ? event.clientY : touch?.clientY) || 0;
    const upperAreaLimit = window.innerHeight * 0.55;
    if (clickY < upperAreaLimit) {
      hideBar();
    }
  };
  document.addEventListener('pointerdown', hideBarIfOutsideUpperArea);
  document.addEventListener('mousedown', hideBarIfOutsideUpperArea);
  document.addEventListener('touchstart', hideBarIfOutsideUpperArea, { passive: true });

  update();
}

function initMobileQuickNav() {
  if (document.body.dataset.page === 'gate') return;
  if (document.querySelector('.mobile-quick-nav')) return;

  const nav = document.createElement('nav');
  nav.className = 'mobile-quick-nav';
  nav.setAttribute('aria-label', 'Quick navigation');
  nav.innerHTML = `
    <a class="mobile-quick-nav__link fx-link" href="shop.html" data-transition>Shop</a>
    <a class="mobile-quick-nav__link fx-link" href="story.html" data-transition>Story</a>
    <a class="mobile-quick-nav__link fx-link" href="about.html" data-transition>About</a>
  `;

  const current = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  nav.querySelectorAll('a').forEach((link) => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    if (href === current) link.classList.add('is-active');
  });

  document.body.classList.add('has-mobile-quick-nav');
  document.body.appendChild(nav);
}

initStoryPhotoLightbox();
initStoryVideoPlayer();
initStoryCenterVideoControl();
initGateMinigame();
initHomeContactBar();
initMobileQuickNav();
initMobileMediaCompatibility();
