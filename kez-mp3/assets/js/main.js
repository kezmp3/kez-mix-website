// kez.mp3 — shared site behavior
// initPage() wires up everything that depends on the current page's DOM.
// It runs on first load, and again after every soft (fade-swap) navigation
// handled by nav.js, since that swap replaces #page-content's markup.

function initPage() {
  // mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }

  // portfolio genre filter (only present on portfolio.html)
  const chips = document.querySelectorAll('.filter-chip');
  const tracks = document.querySelectorAll('.track');
  if (chips.length && tracks.length) {
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const genre = chip.dataset.genre;
        tracks.forEach(track => {
          const match = genre === 'all' || track.dataset.genre === genre;
          track.style.display = match ? 'grid' : 'none';
        });
      });
    });
  }

  // book-a-mix form (only present on book.html) — submits to Formspree via
  // fetch so we can show our own inline status message instead of
  // redirecting away to a Formspree page.
  const form = document.getElementById('mix-form');
  const status = document.getElementById('form-status');
  if (form && status) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.form-submit');
      if (submitBtn) submitBtn.disabled = true;
      status.classList.remove('ok', 'err');
      status.classList.add('show');
      status.textContent = 'Sending your request…';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then((response) => {
          if (response.ok) {
            form.reset();
            status.textContent = "Thanks — your request is in! I'll follow up within 24–48 hours with a quote.";
            status.classList.add('ok');
          } else {
            return response.json().then((data) => {
              const msg = data && data.errors
                ? data.errors.map((err) => err.message).join(', ')
                : 'Something went wrong submitting the form.';
              throw new Error(msg);
            });
          }
        })
        .catch(() => {
          status.textContent = 'Something went wrong sending your request — please try again or email me directly.';
          status.classList.add('err');
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
          status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    });
  }
}

window.kezmp3InitPage = initPage;
document.addEventListener('DOMContentLoaded', initPage);
