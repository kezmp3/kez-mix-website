// kez.mp3 — persistent global audio player
// Shared across every page: builds a fixed bottom "now playing" bar,
// wires up any [data-track-index] play buttons on the page, and
// persists playback position/state in localStorage so it picks back up
// on the next page load.

(function () {
  var PLAYLIST = [
    { title: "Finale Set - IMI Dance Showcase", sub: "Custom Mix", src: "assets/audio/finale-set-imi-showcase.mp3" },
    { title: "Kendrick Lamar - Humble (Remix)", sub: "Remix", src: "assets/audio/humble-hiphop-remix.mp3" },
    { title: "Competition Set - Mega Mix", sub: "Custom Mix", src: "assets/audio/competition-set-mega-mix.mp3" },
    { title: "Team A - Showcase Mix", sub: "Blend Mix", src: "assets/audio/studio-showcase-blend.mp3" },
    { title: "Kendrick Lamar - DNA (Remix)", sub: "Remix", src: "assets/audio/dna-remix.mp3" }
  ];

  var STORAGE_KEY = "kezmp3_player_state";

  var ICON_PLAY = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M6 6h2v12H6zM20 6L10 12l10 6z"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M16 6h2v12h-2zM4 6l10 6-10 6z"/></svg>';
  var ICON_VOLUME = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  var audio = new Audio();
  audio.preload = "none";
  var currentIndex = null;
  var lastSaved = 0;

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  function saveState(force) {
    if (currentIndex === null) return;
    var now = Date.now();
    if (!force && now - lastSaved < 1000) return;
    lastSaved = now;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        index: currentIndex,
        time: audio.currentTime || 0,
        playing: !audio.paused,
        volume: audio.volume
      }));
    } catch (e) {}
  }

  // ---- build the bar ----
  var bar = document.createElement("div");
  bar.className = "global-player";
  bar.hidden = true;
  bar.innerHTML =
    '<div class="gp-track">' +
      '<div class="gp-art">♪</div>' +
      '<div class="gp-meta">' +
        '<div class="gp-title"></div>' +
        '<div class="gp-sub"></div>' +
      '</div>' +
    '</div>' +
    '<div class="gp-controls">' +
      '<button class="gp-prev" aria-label="Previous track" type="button"></button>' +
      '<button class="gp-playpause" aria-label="Play" type="button"></button>' +
      '<button class="gp-next" aria-label="Next track" type="button"></button>' +
    '</div>' +
    '<div class="gp-progress">' +
      '<span class="gp-time gp-current">0:00</span>' +
      '<input class="gp-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek">' +
      '<span class="gp-time gp-duration">0:00</span>' +
    '</div>' +
    '<div class="gp-extra">' +
      '<span class="gp-vol-icon"></span>' +
      '<input class="gp-volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volume">' +
      '<button class="gp-close" aria-label="Close player" type="button"></button>' +
    '</div>';

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(bar);

    var titleEl = bar.querySelector(".gp-title");
    var subEl = bar.querySelector(".gp-sub");
    var playPauseBtn = bar.querySelector(".gp-playpause");
    var prevBtn = bar.querySelector(".gp-prev");
    var nextBtn = bar.querySelector(".gp-next");
    var seek = bar.querySelector(".gp-seek");
    var currentTimeEl = bar.querySelector(".gp-current");
    var durationEl = bar.querySelector(".gp-duration");
    var volume = bar.querySelector(".gp-volume");
    var volIcon = bar.querySelector(".gp-vol-icon");
    var closeBtn = bar.querySelector(".gp-close");

    playPauseBtn.innerHTML = ICON_PLAY;
    prevBtn.innerHTML = ICON_PREV;
    nextBtn.innerHTML = ICON_NEXT;
    volIcon.innerHTML = ICON_VOLUME;
    closeBtn.innerHTML = ICON_CLOSE;

    var seekDragging = false;

    function updatePlayButtons() {
      var playing = currentIndex !== null && !audio.paused;
      playPauseBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
      document.querySelectorAll(".play-btn").forEach(function (btn) {
        var idx = Number(btn.dataset.trackIndex);
        var active = idx === currentIndex && playing;
        btn.classList.toggle("is-playing", active);
        btn.innerHTML = active ? ICON_PAUSE : ICON_PLAY;
        btn.setAttribute("aria-label", active ? "Pause " + PLAYLIST[idx].title : "Play " + PLAYLIST[idx].title);
      });
    }

    function renderMeta() {
      if (currentIndex === null) return;
      var t = PLAYLIST[currentIndex];
      titleEl.textContent = t.title;
      subEl.textContent = "kez.mp3 · " + t.sub;
      bar.hidden = false;
      document.body.classList.add("player-active");
    }

    function playIndex(idx, resumeTime) {
      if (idx < 0 || idx >= PLAYLIST.length) return;
      currentIndex = idx;
      audio.src = PLAYLIST[idx].src;
      renderMeta();
      audio.currentTime = resumeTime || 0;
      var p = audio.play();
      if (p && p.catch) p.catch(function () { updatePlayButtons(); });
      updatePlayButtons();
      saveState(true);
    }

    function togglePlayPause() {
      if (currentIndex === null) return;
      if (audio.paused) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        audio.pause();
      }
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".play-btn");
      if (!btn) return;
      var idx = Number(btn.dataset.trackIndex);
      if (idx === currentIndex) {
        togglePlayPause();
      } else {
        playIndex(idx, 0);
      }
    });

    playPauseBtn.addEventListener("click", togglePlayPause);
    prevBtn.addEventListener("click", function () {
      if (currentIndex === null) return;
      playIndex((currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length, 0);
    });
    nextBtn.addEventListener("click", function () {
      if (currentIndex === null) return;
      playIndex((currentIndex + 1) % PLAYLIST.length, 0);
    });
    closeBtn.addEventListener("click", function () {
      audio.pause();
      bar.hidden = true;
      document.body.classList.remove("player-active");
      currentIndex = null;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      updatePlayButtons();
    });

    audio.addEventListener("play", function () { updatePlayButtons(); saveState(true); });
    audio.addEventListener("pause", function () { updatePlayButtons(); saveState(true); });
    audio.addEventListener("loadedmetadata", function () {
      durationEl.textContent = fmtTime(audio.duration);
    });
    audio.addEventListener("timeupdate", function () {
      if (!seekDragging) {
        seek.value = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
      }
      currentTimeEl.textContent = fmtTime(audio.currentTime);
      saveState(false);
    });
    audio.addEventListener("ended", function () {
      playIndex((currentIndex + 1) % PLAYLIST.length, 0);
    });
    audio.addEventListener("error", function () {
      if (currentIndex !== null) playIndex((currentIndex + 1) % PLAYLIST.length, 0);
    });

    seek.addEventListener("input", function () {
      seekDragging = true;
      if (audio.duration) currentTimeEl.textContent = fmtTime((seek.value / 100) * audio.duration);
    });
    seek.addEventListener("change", function () {
      if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
      seekDragging = false;
      saveState(true);
    });

    volume.addEventListener("input", function () {
      audio.volume = Number(volume.value);
      saveState(true);
    });

    window.addEventListener("pagehide", function () { saveState(true); });
    window.addEventListener("beforeunload", function () { saveState(true); });

    // initialize every play button's icon on this page
    updatePlayButtons();

    // restore previous session's track, if any
    var saved = loadState();
    if (saved && PLAYLIST[saved.index]) {
      currentIndex = saved.index;
      audio.src = PLAYLIST[currentIndex].src;
      audio.volume = typeof saved.volume === "number" ? saved.volume : 1;
      volume.value = audio.volume;
      renderMeta();
      currentTimeEl.textContent = fmtTime(saved.time || 0);
      audio.load();
      audio.addEventListener("loadedmetadata", function once() {
        audio.currentTime = saved.time || 0;
        if (saved.playing) {
          var p = audio.play();
          if (p && p.catch) p.catch(function () { updatePlayButtons(); });
        }
        updatePlayButtons();
      }, { once: true });
    }
  });
})();
