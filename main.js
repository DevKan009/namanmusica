/* ==========================================================================
   Naman Musica — Official Site Interactive Logic
   High-fidelity audio synth, interactive player, lookbook, and mobile menu
   ========================================================================== */

(function () {
  'use strict';

  // --- Tracklist & Player State ---
  const TRACKS = [
    { title: 'Static Hearts', len: '3:42', totalSec: 222, chordFreqs: [220, 261.63, 329.63, 392.00] }, // Am7
    { title: 'Last Train Home', len: '4:05', totalSec: 245, chordFreqs: [174.61, 220, 261.63, 329.63] }, // Fmaj7
    { title: 'Neon Prayer', len: '3:18', totalSec: 198, chordFreqs: [196.00, 246.94, 293.66, 369.99] }, // Gmaj7
    { title: 'Paper Crowns', len: '3:57', totalSec: 237, chordFreqs: [164.81, 196.00, 246.94, 293.66] }, // Em7
    { title: 'Slow Burn', len: '5:10', totalSec: 310, chordFreqs: [146.83, 174.61, 220, 261.63] }   // Dm7
  ];

  let currentTrackIdx = 0;
  let isPlaying = false;
  let currentElapsedSec = 0;
  let playbackInterval = null;

  // --- Web Audio Generative Synth (Dreamy Indie/Lo-Fi Ambience) ---
  let audioCtx = null;
  let synthGain = null;
  let activeNodes = [];

  function initAudio() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();

    synthGain = audioCtx.createGain();
    synthGain.gain.setValueAtTime(0, audioCtx.currentTime);

    // Warm master filter
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(1400, audioCtx.currentTime);
    lowpass.Q.setValueAtTime(1.2, audioCtx.currentTime);

    // Subtle vinyl warmth / stereo panner
    synthGain.connect(lowpass);
    lowpass.connect(audioCtx.destination);
  }

  function startSynthSound() {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    stopSynthSound();

    const now = audioCtx.currentTime;
    synthGain.gain.cancelScheduledValues(now);
    synthGain.gain.setValueAtTime(0.001, now);
    synthGain.gain.linearRampToValueAtTime(0.16, now + 1.2);

    const track = TRACKS[currentTrackIdx];
    const freqs = track.chordFreqs || [220, 261.63, 329.63, 392.00];

    // Create 4 warm oscillator voices for dreamy indie pad
    freqs.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const voiceGain = audioCtx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Subtle warm detune / chorus
      const detuneCents = (idx - 1.5) * 7;
      osc.detune.setValueAtTime(detuneCents, now);

      // Subtle LFO modulation
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();
      lfo.frequency.setValueAtTime(0.3 + idx * 0.1, now);
      lfoGain.gain.setValueAtTime(1.8, now);
      lfo.connect(osc.frequency);
      lfo.start(now);

      voiceGain.gain.setValueAtTime(0.25, now);
      osc.connect(voiceGain);
      voiceGain.connect(synthGain);

      osc.start(now);
      activeNodes.push(osc, lfo, voiceGain, lfoGain);
    });
  }

  function stopSynthSound() {
    if (!audioCtx || !synthGain) return;
    const now = audioCtx.currentTime;
    synthGain.gain.cancelScheduledValues(now);
    synthGain.gain.linearRampToValueAtTime(0.001, now + 0.6);

    setTimeout(() => {
      activeNodes.forEach(node => {
        try {
          if (node.stop) node.stop();
          if (node.disconnect) node.disconnect();
        } catch (e) {}
      });
      activeNodes = [];
    }, 700);
  }

  // --- Format Time ---
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // --- DOM Elements ---
  const heroPlayBtn = document.getElementById('hero-play-btn');
  const heroPlayIcon = document.getElementById('hero-play-icon');
  const heroPauseIcon = document.getElementById('hero-pause-icon');
  const playerStatusLabel = document.getElementById('player-status');
  const playerNowTitle = document.getElementById('player-title');
  const playerNowLen = document.getElementById('player-len');
  const playerTimeCurrent = document.getElementById('player-time-current');
  const playerProgBar = document.getElementById('player-prog-bar');
  const heroEq = document.getElementById('hero-eq');
  const vinylDisc = document.getElementById('vinyl-disc');
  const vinylWrap = document.getElementById('vinyl-wrap');
  const trackButtons = document.querySelectorAll('.track-row-btn');

  // --- Update Player UI ---
  function updatePlayerUI() {
    const track = TRACKS[currentTrackIdx];

    // Status & Title
    if (playerStatusLabel) {
      playerStatusLabel.textContent = isPlaying ? 'Now playing' : 'Press play';
    }
    if (playerNowTitle) {
      playerNowTitle.textContent = track.title;
    }
    if (playerNowLen) {
      playerNowLen.textContent = track.len;
    }

    // Play/Pause Icons in Hero Player
    if (heroPlayIcon && heroPauseIcon) {
      if (isPlaying) {
        heroPlayIcon.style.display = 'none';
        heroPauseIcon.style.display = 'block';
        if (heroPlayBtn) heroPlayBtn.setAttribute('aria-label', `Pause ${track.title}`);
      } else {
        heroPlayIcon.style.display = 'block';
        heroPauseIcon.style.display = 'none';
        if (heroPlayBtn) heroPlayBtn.setAttribute('aria-label', `Play ${track.title}`);
      }
    }

    // Hero Equalizer
    if (heroEq) {
      if (isPlaying) {
        heroEq.classList.add('on');
      } else {
        heroEq.classList.remove('on');
      }
    }

    // Vinyl Disc Animation
    if (vinylWrap && vinylDisc) {
      if (isPlaying) {
        vinylWrap.classList.add('on');
        vinylDisc.classList.add('on');
      } else {
        vinylWrap.classList.remove('on');
        vinylDisc.classList.remove('on');
      }
    }

    // Tracklist updates
    trackButtons.forEach((btn, idx) => {
      const isCurrent = idx === currentTrackIdx;
      const numSpan = btn.querySelector('.track-num');
      const eqSpan = btn.querySelector('.track-eq');

      btn.setAttribute('aria-pressed', isCurrent && isPlaying ? 'true' : 'false');

      if (isCurrent) {
        btn.style.color = 'var(--accent)';
        if (numSpan) numSpan.style.display = isPlaying ? 'none' : 'block';
        if (eqSpan) eqSpan.style.display = isPlaying ? 'inline-flex' : 'none';
      } else {
        btn.style.color = '#F3EEE8';
        if (numSpan) numSpan.style.display = 'block';
        if (eqSpan) eqSpan.style.display = 'none';
      }
    });

    // Time & Progress
    if (playerTimeCurrent) {
      playerTimeCurrent.textContent = formatTime(currentElapsedSec);
    }
    if (playerProgBar) {
      const percentage = (currentElapsedSec / track.totalSec) * 100;
      playerProgBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      startSynthSound();
      startProgressTimer();
      showToast(`Now playing: ${TRACKS[currentTrackIdx].title}`);
    } else {
      stopSynthSound();
      stopProgressTimer();
    }
    updatePlayerUI();
  }

  function selectTrack(idx) {
    if (idx === currentTrackIdx) {
      togglePlay();
      return;
    }
    currentTrackIdx = idx;
    currentElapsedSec = 0;
    isPlaying = true;
    startSynthSound();
    startProgressTimer();
    showToast(`Now playing: ${TRACKS[currentTrackIdx].title}`);
    updatePlayerUI();
  }

  function startProgressTimer() {
    stopProgressTimer();
    playbackInterval = setInterval(() => {
      const track = TRACKS[currentTrackIdx];
      currentElapsedSec += 1;
      if (currentElapsedSec > track.totalSec) {
        // Next track
        currentTrackIdx = (currentTrackIdx + 1) % TRACKS.length;
        currentElapsedSec = 0;
        startSynthSound();
        showToast(`Next track: ${TRACKS[currentTrackIdx].title}`);
      }
      updatePlayerUI();
    }, 1000);
  }

  function stopProgressTimer() {
    if (playbackInterval) {
      clearInterval(playbackInterval);
      playbackInterval = null;
    }
  }

  // --- Attach Player Listeners ---
  if (heroPlayBtn) {
    heroPlayBtn.addEventListener('click', togglePlay);
  }

  trackButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => selectTrack(idx));
  });

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
  const LOOKS_DATA = [
    {
      "img": "./assets/performances/01-toyota-phoenix-citadel.jpg",
      "alt": "Pyro flames in front of the Toyota sign at the Phoenix Citadel corporate show",
      "title": "Toyota Corporate Event",
      "venue": "Phoenix Citadel, Indore",
      "desc": "Rock, Bollywood anthems and metal vibes",
      "pos": "50% 50%",
      "link": "https://www.instagram.com/namanmusica/reel/DaPiFmSzmoD/",
      "embed": "DaPiFmSzmoD",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/02-prestige-college-indore.jpg",
      "alt": "The band posing on a red carpet of confetti in front of a huge college crowd at night",
      "title": "Prestige College Fest",
      "venue": "Prestige College, Indore",
      "desc": "Strangers become one crowd, every song becomes an anthem",
      "pos": "50% 0%",
      "link": "https://www.instagram.com/namanmusica/reel/DaNJBH0zzKJ/",
      "embed": "DaNJBH0zzKJ",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/03-tu-meri-college-concert.jpg",
      "alt": "Vocalist singing into the mic above a cheering college crowd under purple lights",
      "title": "College Concert: Tu Meri",
      "venue": "Live",
      "desc": "Thousands of hearts singing the same lyrics together",
      "pos": "50% 100%",
      "link": "https://www.instagram.com/namanmusica/reel/DancShJzipk/",
      "embed": "DancShJzipk",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/04-ies-university-bhopal.jpg",
      "alt": "Naman on stage in a white mesh vest under a cloud of stage smoke at IES University",
      "title": "IES University Fest",
      "venue": "IES University, Bhopal",
      "desc": "One stage. Thousands of voices.",
      "pos": "50% 50%",
      "link": "https://www.instagram.com/namanmusica/reel/DdjHwbCzo3E/",
      "embed": "DdjHwbCzo3E",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/05-flute-college-fest.jpg",
      "alt": "Close-up of the live flute performance on stage",
      "title": "Live Flute Moment",
      "venue": "Live",
      "desc": "A single flute melody is enough to change the entire atmosphere",
      "pos": "50% 0%",
      "link": "https://www.instagram.com/namanmusica/reel/DafFkBpIx8N/",
      "embed": "DafFkBpIx8N",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/06-college-show-live.jpg",
      "alt": "Vocalist in a bright headband mid-song at a college show",
      "title": "College Show",
      "venue": "Live",
      "desc": "One stage. One crowd. Infinite memories.",
      "pos": "50% 50%",
      "link": "https://www.instagram.com/namanmusica/reel/DaCdXB8uSXk/",
      "embed": "DaCdXB8uSXk",
      "kind": "instagram",
      "cta": "Watch on Instagram"
    },
    {
      "img": "./assets/performances/07-live-stage-indore-jul.jpg",
      "alt": "Vocalist silhouetted on a dark stage during a live show in Indore",
      "title": "Live on Stage",
      "venue": "Indore, India",
      "desc": "It remembers how you made people feel",
      "pos": "50% 40%",
      "link": "https://www.instagram.com/namanmusica/p/Da0DSKPk75L/",
      "embed": null,
      "kind": "instagram",
      "cta": "View on Instagram"
    },
    {
      "img": "./assets/performances/08-live-stage-indore-aug.jpg",
      "alt": "Vocalist silhouetted in blue smoke just before the first note",
      "title": "Before the First Note",
      "venue": "Indore, India",
      "desc": "This is what peace looks like before the first note",
      "pos": "50% 40%",
      "link": "https://www.instagram.com/namanmusica/p/Dbfwh3uo_uQ/",
      "embed": null,
      "kind": "instagram",
      "cta": "View on Instagram"
    },
    {
      "img": "",
      "alt": "",
      "title": "Chal Do",
      "venue": "Official video",
      "desc": "Our original, on YouTube.",
      "pos": "50% 50%",
      "link": "https://youtu.be/oRBU7SwaIuc",
      "embed": "oRBU7SwaIuc",
      "kind": "youtube",
      "cta": "Watch on YouTube"
    }
  ];

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
    if (data.kind === 'youtube') {
      return `https://www.youtube-nocookie.com/embed/${data.embed}?autoplay=1&rel=0`;
    }
    if (data.embed) return `https://www.instagram.com/reel/${data.embed}/embed/`;
    return '';
  }

  function openLightbox(idx) {
    const data = LOOKS_DATA[idx];
    if (!data || !lightbox) return;

    const src = embedUrl(data);
    const isYoutube = data.kind === 'youtube';

    lightboxMedia.classList.toggle('is-embed', !!src && !isYoutube);
    lightboxContent.classList.toggle('is-wide', isYoutube);

    if (src) {
      lightboxImg.style.display = 'none';
      lightboxFrame.style.display = 'block';
      lightboxFrame.src = src;
    } else {
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
    // blank the iframe so playback stops
    lightboxFrame.removeAttribute('src');
  }

  window.openLook = openLightbox;

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
        showToast(`You're subscribed with ${email}!`);
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
