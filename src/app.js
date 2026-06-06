/* Welcome Back to SoD — interactivity
 * - mobile nav toggle
 * - TOC scroll-spy active highlighting
 * - ZG reputation calculator
 */

(function () {
  'use strict';

  // -------- theme toggle --------
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const root = document.documentElement;
      const isLight = root.getAttribute('data-theme') === 'light';
      const next = isLight ? 'dark' : 'light';
      if (next === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }
      try { localStorage.setItem('theme', next); } catch { /* ignore */ }
    });
  }

  // -------- mobile nav toggle --------
  const toggle = document.getElementById('navToggle');
  const sidebar = document.getElementById('toc');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    sidebar.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        sidebar.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // -------- scroll-spy --------
  const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));

  const linkBySection = new Map();
  tocLinks.forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    linkBySection.set(id, a);
  });

  function setActive(id) {
    tocLinks.forEach((a) => a.classList.remove('active'));
    const link = linkBySection.get(id);
    if (link) link.classList.add('active');
  }

  // For each TOC entry, pick an element whose bounding box reflects the section's
  // visible extent. Headings inside a .class-card have near-zero height and share
  // their vertical position with siblings in the same grid row, so observe the
  // card instead.
  const sectionData = tocLinks
    .map((a) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return null;
      const el = target.closest('.class-card') || target;
      return { id, el };
    })
    .filter(Boolean);

  // BAND_Y must be at or below the scroll-anchor landing position of a section,
  // which is scroll-padding-top + scroll-margin-top (~140px with the current
  // CSS). 160 leaves a little headroom; small h3 anchors land higher (~64px)
  // and are caught easily.
  const BAND_Y = 160;

  function updateActive() {
    if (!sectionData.length) return;

    // Sections whose top has scrolled to or past the band line. Using "top
    // passed" rather than "box contains band" so short class cards and tiny
    // h3 anchors qualify the same way as full sections.
    const candidates = sectionData.filter(
      ({ el }) => el.getBoundingClientRect().top <= BAND_Y
    );
    if (!candidates.length) return;

    // Drop entries whose box contains another entry in the same set, so a
    // parent <section> doesn't outrank a child card / sub-heading.
    const leaves = candidates.filter(
      (x) => !candidates.some((y) => y !== x && x.el.contains(y.el))
    );

    // Hash preference: clicking a TOC link should stick even when multiple
    // siblings share the band (grid row of cards).
    const hashId = location.hash.slice(1);
    const hashed = hashId ? leaves.find((s) => s.id === hashId) : null;
    if (hashed) {
      setActive(hashed.id);
      return;
    }

    // Among leaves, pick the one whose top is closest to the band line from
    // above (i.e. the most recently passed). Ties (grid row siblings) go to
    // the first in DOM order because the loop only updates on strict >.
    let pick = null;
    let pickTop = -Infinity;
    for (const l of leaves) {
      const top = l.el.getBoundingClientRect().top;
      if (top > pickTop) {
        pickTop = top;
        pick = l;
      }
    }
    if (pick) setActive(pick.id);
  }

  let scheduled = false;
  function onScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateActive();
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateActive);
  window.addEventListener('hashchange', updateActive);
  updateActive();

  // -------- reputation helpers (shared) --------
  // Standings (cumulative bar size for each level)
  const STANDING_NAMES = ['neutral', 'friendly', 'honored', 'revered', 'exalted'];
  const STANDING_SIZE = {
    neutral: 3000,    // neutral -> friendly
    friendly: 6000,   // friendly -> honored
    honored: 12000,   // honored -> revered
    revered: 21000,   // revered -> exalted
  };

  function repToTarget(currentIdx, currentProgress, targetIdx) {
    // total rep needed from current point to *reach* target standing
    if (targetIdx <= currentIdx) return 0;
    let total = -currentProgress;
    for (let i = currentIdx; i < targetIdx; i++) {
      total += STANDING_SIZE[STANDING_NAMES[i]];
    }
    return Math.max(total, 0);
  }

  function currentStandingMax(idx) {
    if (idx >= 4) return 0;
    return STANDING_SIZE[STANDING_NAMES[idx]];
  }

  const fmtInt = (n) => (n == null ? '—' : Math.ceil(n).toLocaleString('en-US'));
  const fmtGold = (n) => (n == null ? '—' : Math.ceil(n).toLocaleString('en-US') + 'g');

  // -------- ZG reputation calculator --------
  const REP_PER_BIJOU = 125;
  const REP_PER_RUN = 3000;
  const COIN_PER_BIJOU = 1;
  const COINS_PER_BLOODMOON = 45;

  const standingEl = document.getElementById('calc-standing');
  const progressEl = document.getElementById('calc-progress');
  const progressMaxEl = document.getElementById('calc-progress-max');
  const priceEl = document.getElementById('calc-bijou-price');
  const resultsEl = document.getElementById('calc-results');

  if (standingEl && progressEl && priceEl && resultsEl) {
    function update() {
      const currentIdx = parseInt(standingEl.value, 10);
      const max = currentStandingMax(currentIdx);

      // clamp progress to [0, max]
      let progress = parseInt(progressEl.value, 10);
      if (isNaN(progress) || progress < 0) progress = 0;
      if (max > 0 && progress > max) progress = max;

      progressMaxEl.textContent = max > 0 ? `/ ${max.toLocaleString('en-US')}` : '(maxed)';

      let price = parseFloat(priceEl.value);
      if (isNaN(price) || price < 0) price = 0;

      const targets = ['friendly', 'honored', 'revered', 'exalted'];
      targets.forEach((target, i) => {
        const targetIdx = i + 1;
        const row = resultsEl.querySelector(`tr[data-target="${target}"]`);
        if (!row) return;

        const cells = row.querySelectorAll('td');

        if (targetIdx <= currentIdx) {
          row.classList.add('unreachable');
          cells[0].textContent = 'achieved';
          cells[1].textContent = '—';
          cells[2].textContent = '—';
          cells[3].textContent = '—';
          return;
        }

        row.classList.remove('unreachable');
        const repNeeded = repToTarget(currentIdx, progress, targetIdx);
        const bijous = repNeeded / REP_PER_BIJOU;
        const gold = bijous * price;
        const coins = bijous * COIN_PER_BIJOU;
        const bloodmoons = coins / COINS_PER_BLOODMOON;
        const runs = repNeeded / REP_PER_RUN;

        cells[0].textContent = fmtInt(bijous);
        cells[1].textContent = fmtGold(gold);
        cells[2].textContent = bloodmoons.toFixed(1);
        cells[3].textContent = runs.toFixed(1);
      });
    }

    [standingEl, progressEl, priceEl].forEach((el) => {
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });
    update();
  }

  // -------- BRE reputation calculator --------
  const breResultsEl = document.getElementById('bre-calc-results');
  if (breResultsEl) {
    const rows = breResultsEl.querySelectorAll('tbody tr[data-rep-per-run]');

    function updateRow(row) {
      const repPerRun = parseFloat(row.dataset.repPerRun);
      const standingSel = row.querySelector('.bre-standing');
      const progressInput = row.querySelector('.bre-progress');
      const targetSel = row.querySelector('.bre-target');
      const eventsCell = row.querySelector('.bre-events');

      const currentIdx = parseInt(standingSel.value, 10);
      const targetIdx = parseInt(targetSel.value, 10);
      const max = currentStandingMax(currentIdx);

      let progress = parseInt(progressInput.value, 10);
      if (isNaN(progress) || progress < 0) progress = 0;
      if (max > 0 && progress > max) {
        progress = max;
        progressInput.value = max;
      }

      if (targetIdx <= currentIdx) {
        row.classList.add('unreachable');
        eventsCell.textContent = 'achieved';
        return;
      }
      row.classList.remove('unreachable');

      const repNeeded = repToTarget(currentIdx, progress, targetIdx);
      const events = repNeeded / repPerRun;
      eventsCell.textContent = fmtInt(events);
    }

    rows.forEach((row) => {
      const inputs = row.querySelectorAll('select, input');
      inputs.forEach((el) => {
        el.addEventListener('input', () => updateRow(row));
        el.addEventListener('change', () => updateRow(row));
      });
      updateRow(row);
    });
  }

  // -------- shareable subsection anchors --------
  // The End-game h4 subsections (Naxx Prep / Scarlet Enclave Prep) each carry
  // an id but are intentionally left out of the TOC. Give them a hover-revealed
  // link icon so a permalink (e.g. .../#naxx-attunement) is one click to copy.
  const anchorIcon =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.71-1.71"/>' +
    '</svg>';

  document.querySelectorAll('#endgame h4[id]').forEach((h) => {
    const link = document.createElement('a');
    link.className = 'heading-anchor';
    link.href = '#' + h.id;
    link.title = 'Copy link to this section';
    link.setAttribute('aria-label', 'Copy link to ' + h.textContent.trim());
    link.innerHTML = anchorIcon;

    let resetTimer = null;
    const flash = () => {
      link.classList.add('copied');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => link.classList.remove('copied'), 1200);
    };

    link.addEventListener('click', (e) => {
      e.preventDefault();
      // Drop the permalink in the address bar without a jarring re-scroll.
      history.replaceState(null, '', '#' + h.id);
      const url = location.href;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(flash, () => {
          // Clipboard unavailable (e.g. insecure context) — just navigate.
          location.hash = h.id;
        });
      } else {
        location.hash = h.id;
        flash();
      }
    });

    h.appendChild(link);
  });
})();
