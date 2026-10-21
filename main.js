/* ==========================================================================
   Esme Ray — Official Site Interactive Logic
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

  // --- Theme Color Switcher ---
  const themeDots = document.querySelectorAll('.theme-dot');
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeDots.forEach(dot => {
      if (dot.getAttribute('data-theme-name') === theme) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
    localStorage.setItem('esme_theme', theme);
  }

  themeDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const theme = dot.getAttribute('data-theme-name');
      setTheme(theme);
      showToast(`Accent color updated`);
    });
  });

  // Restore saved theme
  const savedTheme = localStorage.getItem('esme_theme');
  if (savedTheme) {
    setTheme(savedTheme);
  }

  // --- Lookbook Lightbox Modal ---
  const LOOKS_DATA = [
    {
      era: 'Era I',
      name: 'Red Room',
      img: './assets/ee3bb94a7d9be7c583a296c5b7cf267e.jpg',
      alt: 'Portrait in a red suit against a burnt-orange backdrop',
      desc: 'Shot in a soundproof isolation booth at 2 AM. The saturated crimson and burnt amber tones reflect the raw intensity of the first vocal takes for Static Hearts.',
      credits: 'Photography: Elena Rostova · Wardrobe: Studio Ray'
    },
    {
      era: 'Era II',
      name: 'Golden Hour',
      img: './assets/08161b9127ec885bb45ec3b1c3272d34.jpg',
      alt: 'Seated figure in a knit sweater under a warm streak of light',
      desc: 'The quiet acoustic side of the record. Warm late-afternoon natural rays piercing through dusty studio blinds in suburban London.',
      credits: 'Photography: Marcus Thorne · Styling: Anna Vance'
    },
    {
      era: 'Era III',
      name: 'Wild Card',
      img: './assets/d34af629590d4a20eb3c1b494fee5d5f.jpg',
      alt: 'Close-up portrait in a leopard-print coat against deep red',
      desc: 'Reckless overdrive, analog fuzz pedals, and late-night defiance. The aesthetic cornerstone for the mid-tempo rocker "Neon Prayer".',
      credits: 'Photography: Elena Rostova · Make-up: K. Tanaka'
    },
    {
      era: 'Era IV',
      name: 'After Dark',
      img: './assets/9c9f4bd0bfcb051273f6768d2afbb263.jpg',
      alt: 'Figure in a dark coat and red trousers seated against grey',
      desc: 'Sleek, minimalist, and reflective. Captured on an empty soundstage hours before the winter tour announcement.',
      credits: 'Creative Direction: Esme Ray & Marcus Thorne'
    }
  ];

  const lightbox = document.getElementById('lookbook-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxEra = document.getElementById('lightbox-era');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxCredits = document.getElementById('lightbox-credits');
  const lightboxClose = document.getElementById('lightbox-close');

  function openLightbox(idx) {
    const data = LOOKS_DATA[idx];
    if (!data || !lightbox) return;

    lightboxImg.src = data.img;
    lightboxImg.alt = data.alt;
    lightboxEra.textContent = data.era;
    lightboxTitle.textContent = data.name;
    lightboxDesc.textContent = data.desc;
    lightboxCredits.textContent = data.credits;

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.look-notch-btn, .look-card').forEach((el) => {
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
