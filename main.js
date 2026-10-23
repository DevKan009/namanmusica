/* ==========================================================================
   Naman Musica — Official Site Interactive Logic
   High-fidelity audio synth, interactive player, lookbook, and mobile menu
   ========================================================================== */

(function () {
  'use strict';

  // --- Originals Player ---
  // Playback runs through the official YouTube IFrame API, so every play is a
  // normal embedded YouTube view. The tracklist and vinyl disc just mirror it.
  const TRACKS = [
    { title: 'Illusion', id: 'R2axwAMikR0' },
    { title: 'Sirf Tu', id: 'ntqEtl9u8Co' },
    { title: 'Chal Do', id: 'oRBU7SwaIuc' }
  ];
  const PLAYLIST_URL = 'https://www.youtube.com/@Namanmusicaa';

  let ytPlayer = null;
  let ytReady = false;
  let apiState = 'idle'; // idle | loading | ready | failed
  let queuedIdx = null;
  let currentTrackIdx = 0;
  let isPlaying = false;
  let tickTimer = null;

  const vinylDisc = document.getElementById('vinyl-disc');
  const vinylWrap = document.getElementById('vinyl-wrap');
  const trackButtons = document.querySelectorAll('.track-row-btn');
  const playerNowTitle = document.getElementById('player-title');
  const musicSection = document.getElementById('music');
  const sleeveTitle = document.getElementById('sleeve-title');
  const sleeveArt = document.querySelector('.sleeve-art');
  const sleeveImgs = document.querySelectorAll('.sleeve-img');

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function updatePlayerUI(elapsed, total) {
    const track = TRACKS[currentTrackIdx];
    if (playerNowTitle) playerNowTitle.textContent = track.title;
    if (sleeveTitle) sleeveTitle.textContent = track.title;
    sleeveImgs.forEach((img, idx) => img.classList.toggle('is-active', idx === currentTrackIdx));
    if (sleeveArt) sleeveArt.classList.toggle('is-playing', isPlaying);

    if (vinylWrap && vinylDisc) {
      vinylWrap.classList.toggle('on', isPlaying);
      vinylDisc.classList.toggle('on', isPlaying);
    }

    trackButtons.forEach((btn, idx) => {
      const isCurrent = idx === currentTrackIdx;
      const numSpan = btn.querySelector('.track-num');
      const eqSpan = btn.querySelector('.track-eq');
      const bar = btn.querySelector('.track-prog i');

      btn.setAttribute('aria-pressed', isCurrent && isPlaying ? 'true' : 'false');
      btn.style.color = isCurrent ? 'var(--accent)' : '#F3EEE8';
      if (numSpan) numSpan.style.display = isCurrent && isPlaying ? 'none' : 'block';
      if (eqSpan) eqSpan.style.display = isCurrent && isPlaying ? 'inline-flex' : 'none';
      if (bar) {
        const pct = isCurrent && total ? (elapsed / total) * 100 : 0;
        bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      }
    });
  }

  function readTime() {
    if (!ytReady || !ytPlayer || !ytPlayer.getDuration) return;
    const total = ytPlayer.getDuration() || 0;
    const elapsed = ytPlayer.getCurrentTime() || 0;
    if (total) {
      const lenEl = trackButtons[currentTrackIdx] && trackButtons[currentTrackIdx].querySelector('.track-len');
      if (lenEl) lenEl.textContent = formatTime(total);
    }
    updatePlayerUI(elapsed, total);
  }

  function startTick() {
    stopTick();
    tickTimer = setInterval(readTime, 500);
  }

  function stopTick() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function onStateChange(e) {
    const S = window.YT.PlayerState;
    if (e.data === S.PLAYING) {
      isPlaying = true;
      startTick();
    } else if (e.data === S.PAUSED) {
      isPlaying = false;
      stopTick();
    } else if (e.data === S.ENDED) {
      stopTick();
      if (currentTrackIdx < TRACKS.length - 1) {
        playTrack(currentTrackIdx + 1);
        return;
      }
      isPlaying = false;
      currentTrackIdx = 0;
      ytPlayer.cueVideoById(TRACKS[0].id);
    }
    if (ytReady) readTime();
    else updatePlayerUI(0, 0);
  }

  function createPlayer() {
    ytPlayer = new window.YT.Player('yt-player', {
      width: '100%',
      height: '100%',
      videoId: TRACKS[currentTrackIdx].id,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ytReady = true;
          apiState = 'ready';
          if (queuedIdx !== null) {
            const idx = queuedIdx;
            queuedIdx = null;
            playTrack(idx);
          }
        },
        onStateChange,
        onError: () => {
          isPlaying = false;
          stopTick();
          updatePlayerUI(0, 0);
          showToast('This track could not load. Opening YouTube instead.');
          window.open(PLAYLIST_URL, '_blank', 'noopener');
        }
      }
    });
  }

  function loadApi() {
    if (apiState !== 'idle') return;
    apiState = 'loading';
    if (window.YT && window.YT.Player) {
      createPlayer();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev();
      createPlayer();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => {
      apiState = 'failed';
    };
    document.head.appendChild(tag);
  }

  function playTrack(idx) {
    currentTrackIdx = idx;
    if (apiState === 'failed') {
      window.open(PLAYLIST_URL, '_blank', 'noopener');
      return;
    }
    if (!ytReady) {
      queuedIdx = idx;
      loadApi();
      updatePlayerUI(0, 0);
      return;
    }
    ytPlayer.loadVideoById(TRACKS[idx].id);
    updatePlayerUI(0, 0);
  }

  function selectTrack(idx) {
    if (idx === currentTrackIdx && ytReady) {
      if (isPlaying) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
      return;
    }
    playTrack(idx);
  }

  trackButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => selectTrack(idx));
  });

  // Warm up the player shortly before the section scrolls into view.
  if (musicSection && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        loadApi();
        io.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    io.observe(musicSection);
  } else if (musicSection) {
    loadApi();
  }

  updatePlayerUI(0, 0);

  // --- Mobile Menu Toggle ---
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  function openMobileMenu() {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.classList.add('open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'Close menu');
  }

  function closeMobileMenu() {
    if (!mobileMenu || !menuBtn) return;
    mobileMenu.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Open menu');
  }

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = mobileMenu.classList.contains('open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close when clicking mobile menu links
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMobileMenu);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (mobileMenu.classList.contains('open') && !mobileMenu.contains(e.target) && e.target !== menuBtn) {
        closeMobileMenu();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        closeMobileMenu();
      }
    });
  }

  // Clear any legacy theme overrides to lock accent to #b31f12
  try {
    localStorage.removeItem('naman_theme');
    localStorage.removeItem('esme_theme');
    document.documentElement.removeAttribute('data-theme');
  } catch (e) {}

  // --- Performance Gallery Lightbox ---
  // Items come from the gallery cards on the page (data-* attributes), so each
  // visuals page carries its own set.
  const LOOKS_DATA = Array.from(document.querySelectorAll('.look[data-title]')).map((el) => ({
    img: el.dataset.img || '',
    alt: el.dataset.alt || '',
    title: el.dataset.title || '',
    venue: el.dataset.venue || '',
    desc: el.dataset.desc || '',
    pos: el.dataset.pos || '50% 50%',
    link: el.dataset.link || '#',
    embed: el.dataset.embed || '',
    video: el.dataset.video || '',
    kind: el.dataset.kind || 'instagram',
    cta: el.dataset.cta || 'Watch'
  }));

  const lightbox = document.getElementById('lookbook-lightbox');
  const lightboxContent = lightbox ? lightbox.querySelector('.lightbox-content') : null;
  const lightboxMedia = document.getElementById('lightbox-media');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxFrame = document.getElementById('lightbox-frame');
  const lightboxEra = document.getElementById('lightbox-era');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxLink = document.getElementById('lightbox-link');
  const lightboxClose = document.getElementById('lightbox-close');

  function embedUrl(data) {
    if (data.kind === 'youtube' && data.embed) {
      return data.embed.length === 11
        ? `https://www.youtube-nocookie.com/embed/${data.embed}?autoplay=1&playsinline=1&rel=0`
        : `https://www.youtube-nocookie.com/embed/videoseries?list=${data.embed}&autoplay=1&playsinline=1&rel=0`;
    }
    if (data.embed) return `https://www.instagram.com/reel/${data.embed}/embed/`;
    return '';
  }

  // Self-hosted clip: the only way to get real in-page autoplay with sound
  // (Instagram's embed can't be autoplayed, and its play button leaves the page).
  let lightboxVideo = null;
  function stopVideo() {
    if (!lightboxVideo) return;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    lightboxVideo.load();
    lightboxVideo.style.display = 'none';
  }

  function openLightbox(idx) {
    const data = LOOKS_DATA[idx];
    if (!data || !lightbox) return;

    const src = data.video ? '' : embedUrl(data);
    const isYoutube = data.kind === 'youtube' && !data.video;

    lightboxMedia.classList.toggle('is-embed', (!!src && !isYoutube) || !!data.video);
    lightboxContent.classList.toggle('is-wide', isYoutube);

    if (data.video) {
      if (!lightboxVideo) {
        lightboxVideo = document.createElement('video');
        lightboxVideo.setAttribute('playsinline', '');
        lightboxVideo.controls = true;
        lightboxVideo.loop = true;
        lightboxVideo.preload = 'auto';
        lightboxMedia.appendChild(lightboxVideo);
      }
      lightboxImg.style.display = 'none';
      lightboxFrame.style.display = 'none';
      lightboxFrame.removeAttribute('src');
      lightboxVideo.poster = data.img;
      lightboxVideo.src = data.video;
      lightboxVideo.style.display = 'block';
      lightboxVideo.muted = false;
      // the card click is the user gesture that lets this start with sound
      const started = lightboxVideo.play();
      if (started && started.catch) started.catch(() => {});
    } else if (src) {
      stopVideo();
      lightboxImg.style.display = 'none';
      lightboxFrame.style.display = 'block';
      lightboxFrame.src = src;
    } else {
      stopVideo();
      lightboxFrame.style.display = 'none';
      lightboxFrame.removeAttribute('src');
      lightboxImg.style.display = 'block';
      lightboxImg.src = data.img;
      lightboxImg.alt = data.alt;
      lightboxImg.style.objectPosition = data.pos;
    }

    lightboxEra.textContent = data.venue;
    lightboxTitle.textContent = data.title;
    lightboxDesc.textContent = data.desc;
    lightboxLink.href = data.link;
    lightboxLink.textContent = data.cta + ' ↗';

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    // blank the iframe / video so playback stops
    lightboxFrame.removeAttribute('src');
    stopVideo();
  }


  document.querySelectorAll('.look-notch-btn, .look-img').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const lookIdx = parseInt(el.getAttribute('data-look-index') || '0', 10);
      openLightbox(lookIdx);
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  // --- Tour "Notify Me" Action ---
  document.querySelectorAll('.tour-notify-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const city = btn.getAttribute('data-city') || 'your city';
      const emailInput = document.getElementById('join-email');
      const joinSection = document.getElementById('join');

      if (joinSection) {
        joinSection.scrollIntoView({ behavior: 'smooth' });
      }

      if (emailInput) {
        setTimeout(() => {
          emailInput.focus();
          showToast(`Selected city: ${city}. Enter your email to receive first access.`);
        }, 500);
      }
    });
  });

  // --- Book us tabs ---
  const bookTabs = Array.from(document.querySelectorAll('.book-tab'));
  function selectBookTab(tab, focus) {
    bookTabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }
  bookTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectBookTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        selectBookTab(bookTabs[(i + dir + bookTabs.length) % bookTabs.length], true);
      }
    });
  });

  // --- Newsletter / Join Form ---
  const joinForm = document.getElementById('join-form');
  const joinSuccess = document.getElementById('join-success');

  if (joinForm && joinSuccess) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('join-email');
      const email = emailInput ? emailInput.value : '';

      if (email) {
        joinForm.style.display = 'none';
        joinSuccess.style.display = 'block';
        showToast(`Thank you! We'll get in touch with ${email} shortly.`);
      }
    });
  }

  // --- Toast Notification System ---
  function showToast(message) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast xc';
    toast.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--accent)"></span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3600);
  }

  // Initial UI Render
  updatePlayerUI();

})();
