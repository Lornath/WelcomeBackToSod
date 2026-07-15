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
  const STANDING_NAMES = ['hostile', 'unfriendly', 'neutral', 'friendly', 'honored', 'revered', 'exalted'];
  const STANDING_SIZE = {
    hostile: 3000,    // hostile -> unfriendly
    unfriendly: 3000, // unfriendly -> neutral
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
    return STANDING_SIZE[STANDING_NAMES[idx]] || 0;
  }

  const fmtInt = (n) => (n == null ? '—' : Math.ceil(n).toLocaleString('en-US'));
  const fmtGold = (n) => (n == null ? '—' : Math.ceil(n).toLocaleString('en-US') + 'g');
  const fmtStacks = (n, stackSize) => {
    if (n == null) return '—';
    const count = Math.ceil(n);
    const stacks = Math.ceil(count / stackSize);
    return `${count.toLocaleString('en-US')} (${stacks.toLocaleString('en-US')} ${stacks === 1 ? 'stack' : 'stacks'})`;
  };

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
      targets.forEach((target) => {
        const targetIdx = STANDING_NAMES.indexOf(target);
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

  // -------- generic (commendation signet) reputation calculator --------
  const REP_PER_SIGNET = 7.5;       // 10 signets -> 75 rep
  const BANDAGES_PER_SIGNET = 2;    // 20 bandages -> 10 signets
  const RUNECLOTH_PER_BANDAGE = 1;  // 1 runecloth -> 1 bandage
  const RUNECLOTH_STACK = 20;       // runecloth / bandages stack in 20s
  const SIGNET_STACK = 100;         // commendation signets stack in 100s
  const RUNECLOTH_PRICE_KEY = 'runeclothPrice';

  const sigStandingEl = document.getElementById('sig-standing');
  const sigProgressEl = document.getElementById('sig-progress');
  const sigProgressMaxEl = document.getElementById('sig-progress-max');
  const sigPriceEl = document.getElementById('sig-price');
  const sigResultsEl = document.getElementById('sig-results');

  if (sigStandingEl && sigProgressEl && sigPriceEl && sigResultsEl) {
    function updateSig() {
      const currentIdx = parseInt(sigStandingEl.value, 10);
      const max = currentStandingMax(currentIdx);

      // clamp progress to [0, max]
      let progress = parseInt(sigProgressEl.value, 10);
      if (isNaN(progress) || progress < 0) progress = 0;
      if (max > 0 && progress > max) progress = max;

      sigProgressMaxEl.textContent = max > 0 ? `/ ${max.toLocaleString('en-US')}` : '(maxed)';

      let price = parseFloat(sigPriceEl.value);
      if (isNaN(price) || price < 0) price = 0;

      // remember a valid price for next visit
      if (sigPriceEl.value !== '' && !isNaN(parseFloat(sigPriceEl.value))) {
        try { localStorage.setItem(RUNECLOTH_PRICE_KEY, sigPriceEl.value); } catch { /* ignore */ }
      }

      const targets = ['unfriendly', 'neutral', 'friendly', 'honored', 'revered', 'exalted'];
      targets.forEach((target) => {
        const targetIdx = STANDING_NAMES.indexOf(target);
        const row = sigResultsEl.querySelector(`tr[data-target="${target}"]`);
        if (!row) return;

        const cells = row.querySelectorAll('td');

        if (targetIdx <= currentIdx) {
          row.classList.add('unreachable');
          cells[0].textContent = 'achieved';
          cells[1].textContent = '—';
          cells[2].textContent = '—';
          return;
        }

        row.classList.remove('unreachable');
        const repNeeded = repToTarget(currentIdx, progress, targetIdx);
        const signets = repNeeded / REP_PER_SIGNET;
        const bandages = signets * BANDAGES_PER_SIGNET;
        const runecloth = bandages * RUNECLOTH_PER_BANDAGE;
        const gold = runecloth * price;

        // runecloth and bandages are 1:1, so they share a column
        cells[0].textContent = fmtStacks(runecloth, RUNECLOTH_STACK);
        cells[1].textContent = fmtStacks(signets, SIGNET_STACK);
        cells[2].textContent = fmtGold(gold);
      });
    }

    // restore the last-used runecloth price
    try {
      const savedPrice = localStorage.getItem(RUNECLOTH_PRICE_KEY);
      if (savedPrice !== null && savedPrice !== '') sigPriceEl.value = savedPrice;
    } catch { /* ignore */ }

    [sigStandingEl, sigProgressEl, sigPriceEl].forEach((el) => {
      el.addEventListener('input', updateSig);
      el.addEventListener('change', updateSig);
    });
    updateSig();
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

  // -------- info tooltips --------
  // Author a note inline right after the word it annotates:
  //   word<span class="tip">the note, may contain <a>links</a></span>
  // Here we replace the span's contents with an (i) marker and a
  // popover bubble holding that note.
  (function () {
    const tips = document.querySelectorAll('main .tip');
    if (!tips.length) { return; }

    let uid = 0;
    let openTip = null;

    const close = (tip) => {
      if (!tip) { return; }
      tip.classList.remove('is-open');
      const icon = tip.querySelector('.tip__icon');
      if (icon) { icon.setAttribute('aria-expanded', 'false'); }
      if (openTip === tip) { openTip = null; }
    };

    // Nudge the bubble back on-screen if it would spill past a viewport
    // edge, and flip it below the marker when there's no room above.
    const position = (tip) => {
      const bubble = tip.querySelector('.tip__bubble');
      if (!bubble) { return; }
      bubble.classList.remove('tip__bubble--below');
      bubble.style.transform = 'translateX(-50%)';
      bubble.style.setProperty('--tip-caret', '0px');

      const margin = 8;
      const rect = bubble.getBoundingClientRect();
      let shift = 0;
      if (rect.left < margin) {
        shift = margin - rect.left;
      } else if (rect.right > window.innerWidth - margin) {
        shift = (window.innerWidth - margin) - rect.right;
      }
      if (shift) {
        // Keep the caret under the marker, but clamp it inside the bubble.
        const half = rect.width / 2 - 10;
        const caret = Math.max(-half, Math.min(half, -shift));
        bubble.style.transform = 'translateX(calc(-50% + ' + shift + 'px))';
        bubble.style.setProperty('--tip-caret', caret + 'px');
      }
      if (rect.top < margin) { bubble.classList.add('tip__bubble--below'); }
    };

    tips.forEach((tip) => {
      const note = tip.innerHTML.trim();
      if (!note) { return; }
      tip.innerHTML = '';
      uid += 1;
      const bubbleId = 'tip-' + uid;

      const icon = document.createElement('button');
      icon.type = 'button';
      icon.className = 'tip__icon';
      icon.textContent = 'i';
      icon.setAttribute('aria-label', 'More information');
      icon.setAttribute('aria-expanded', 'false');
      icon.setAttribute('aria-describedby', bubbleId);

      const bubble = document.createElement('span');
      bubble.className = 'tip__bubble';
      bubble.id = bubbleId;
      bubble.setAttribute('role', 'tooltip');
      bubble.innerHTML = note;

      tip.append(icon, bubble);
      tip.classList.add('tip--ready');

      // Position before it's revealed on hover or keyboard focus.
      icon.addEventListener('mouseenter', () => position(tip));
      icon.addEventListener('focus', () => position(tip));

      // Click/tap toggles it open (the mobile path).
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = tip.classList.contains('is-open');
        if (openTip && openTip !== tip) { close(openTip); }
        if (isOpen) {
          close(tip);
        } else {
          tip.classList.add('is-open');
          icon.setAttribute('aria-expanded', 'true');
          openTip = tip;
          position(tip);
        }
      });

      // Clicks inside the bubble (e.g. a link) shouldn't close it.
      bubble.addEventListener('click', (e) => e.stopPropagation());
    });

    // A tap/click anywhere else dismisses the open tip.
    document.addEventListener('click', () => { if (openTip) { close(openTip); } });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && openTip) {
        const icon = openTip.querySelector('.tip__icon');
        close(openTip);
        if (icon) { icon.focus(); }
      }
    });

    window.addEventListener('resize', () => { if (openTip) { position(openTip); } });
  })();
})();
