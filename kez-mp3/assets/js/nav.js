// kez.mp3 — soft page navigation
// Fetches the target page and crossfades #page-content in place instead
// of doing a full browser reload. This is what lets the global audio
// player (assets/js/player.js) keep playing uninterrupted while someone
// clicks around the site, and gives every "page change" a smooth crossfade
// (old content and new content overlap and fade into each other, rather
// than fading to blank and back).

(function () {
  var FADE_MS = 300;

  function getContentEl() {
    return document.getElementById("page-content");
  }

  function swapTo(url, addToHistory) {
    fetch(url.href, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status " + res.status);
        return res.text();
      })
      .then(function (html) {
        try {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var newSource = doc.getElementById("page-content");
          if (!newSource) throw new Error("no #page-content in fetched page");

          var outgoing = getContentEl();
          if (!outgoing || !outgoing.parentNode) throw new Error("no live #page-content to replace");

          var incoming = document.createElement("div");
          incoming.className = "page-layer";
          incoming.innerHTML = newSource.innerHTML;
          outgoing.parentNode.insertBefore(incoming, outgoing.nextSibling);

          document.title = doc.title;
          if (addToHistory) history.pushState({ kezmp3Nav: true }, "", url.href);
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });

          // double rAF: let the browser paint the starting state (incoming
          // at opacity 0, absolutely positioned over outgoing) before
          // flipping both opacities so the crossfade actually animates.
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              incoming.classList.add("page-layer-visible");
              outgoing.classList.add("page-fade-hide");
            });
          });

          setTimeout(function () {
            outgoing.remove();
            incoming.classList.remove("page-layer", "page-layer-visible");
            incoming.removeAttribute("style");
            incoming.id = "page-content";
            if (window.kezmp3InitPage) window.kezmp3InitPage();
          }, FADE_MS + 30);
        } catch (err) {
          window.location.href = url.href;
        }
      })
      .catch(function () {
        window.location.href = url.href;
      });
  }

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest("a[href]");
    if (!link) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;

    var url;
    try { url = new URL(link.href, location.href); } catch (err) { return; }

    if (url.origin !== location.origin) return;
    if (!/\.html$/.test(url.pathname) && url.pathname !== "/") return;

    if (url.pathname === location.pathname && !url.hash) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    swapTo(url, true);
  });

  window.addEventListener("popstate", function () {
    swapTo(new URL(location.href), false);
  });
})();
