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
  const sections = tocLinks
    .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);

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

  if ('IntersectionObserver' in window && sections.length) {
    const obs = new IntersectionObserver(
      (entries) => {
        // pick the entry closest to the top that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
  }

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
})();
