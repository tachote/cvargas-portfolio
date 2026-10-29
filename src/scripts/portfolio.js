// The archive is complete HTML first; these controls only refine what is visible.
const archive = document.querySelector('[data-research-archive]');
if (archive) {
  const tools = archive.querySelector('[data-research-tools]');
  const input = archive.querySelector('input[type="search"]');
  const filters = [...archive.querySelectorAll('button[data-filter]')];
  const rows = [...archive.querySelectorAll('[data-research-row]')];
  const groups = [...archive.querySelectorAll('[data-research-group]')];
  const more = archive.querySelector('[data-research-more]');
  const moreLabel = more?.querySelector('.archive-more-label');
  const feature = archive.querySelector('[data-research-feature]');
  const status = archive.querySelector('.research-status');
  const reset = archive.querySelector('.research-reset');
  const empty = archive.querySelector('.research-empty');
  const clear = archive.querySelector('.research-clear');
  let restoreOpen = Boolean(more?.open), filtering = false;
  const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').trim();
  const entries = rows.map(row => ({ row, id: row.dataset.researchId, kind: row.dataset.researchClass, text: normalize(row.dataset.researchSearch ?? '') }));
  const total = new Set(entries.map(entry => entry.id)).size;
  let selectedClass = '';
  const format = (template, shown) => (template ?? '').replace('{shown}', String(shown)).replace('{total}', String(total));

  function update() {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    const active = terms.length > 0 || selectedClass !== '';
    if (active && !filtering) restoreOpen = Boolean(more?.open);
    const matching = new Set();
    for (const entry of entries) {
      const visible = (!selectedClass || entry.kind === selectedClass) && terms.every(term => entry.text.includes(term));
      entry.row.hidden = !visible;
      if (visible) matching.add(entry.id);
    }
    for (const group of groups) group.hidden = ![...group.querySelectorAll('[data-research-row]')].some(row => !row.hidden);
    if (more) {
      const remaining = entries.filter(entry => more.contains(entry.row) && !entry.row.hidden).length;
      more.hidden = active && remaining === 0;
      if (active) more.open = remaining > 0;
      else if (filtering) more.open = restoreOpen;
      if (moreLabel) moreLabel.textContent = format(active ? archive.dataset.filteredMoreTemplate : archive.dataset.moreTemplate, remaining);
    }
    // The featured case is repeated in the index; keep filtered result counts unambiguous.
    if (feature) feature.hidden = active;
    for (const filter of filters) filter.setAttribute('aria-pressed', String(filter.dataset.filter === selectedClass));
    if (status) status.textContent = format(archive.dataset.resultTemplate, matching.size);
    if (reset) reset.hidden = !active;
    if (empty) empty.hidden = matching.size > 0;
    filtering = active;
  }

  function resetArchive() {
    input.value = '';
    selectedClass = '';
    update();
    input.focus();
  }

  if (tools && input && entries.length) {
    input.addEventListener('input', update);
    input.addEventListener('search', update);
    for (const filter of filters) filter.addEventListener('click', () => {
      selectedClass = filter.dataset.filter ?? '';
      update();
    });
    reset?.addEventListener('click', resetArchive);
    clear?.addEventListener('click', resetArchive);
    update();
    tools.hidden = false;
  }
}

const chapterNav = document.querySelector('.chapter-nav');
if (chapterNav) {
  const links = [...chapterNav.querySelectorAll('.chapter-link[data-chapter]')];
  const chapters = links.map(link => ({ link, section: document.getElementById(link.dataset.chapter) })).filter(chapter => chapter.section);
  const current = chapterNav.querySelector('.chapter-current');
  const progress = chapterNav.querySelector('.reading-progress');
  let scheduled = false;
  let activeId = '';

  function updateChapter() {
    scheduled = false;
    if (!chapters.length) return;
    const threshold = Math.min(180, innerHeight * 0.3);
    let active = chapters[0];
    for (const chapter of chapters) if (chapter.section.getBoundingClientRect().top <= threshold) active = chapter;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) active = chapters.at(-1);
    if (activeId !== active.section.id) {
      activeId = active.section.id;
      for (const chapter of chapters) {
        if (chapter === active) chapter.link.setAttribute('aria-current', 'location');
        else chapter.link.removeAttribute('aria-current');
      }
      if (current) current.textContent = active.section.querySelector('h2 .amb')?.textContent.replace(/^\s*·\s*/, '') ?? active.link.textContent.trim();
    }
    if (progress) {
      const start = chapters[0].section.getBoundingClientRect().top + scrollY - threshold;
      const end = Math.max(start + 1, document.documentElement.scrollHeight - innerHeight);
      progress.value = Math.max(0, Math.min(100, ((scrollY - start) / (end - start)) * 100));
    }
  }

  function scheduleChapter() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateChapter);
  }

  if (progress) progress.hidden = false;
  addEventListener('scroll', scheduleChapter, { passive: true });
  addEventListener('resize', scheduleChapter, { passive: true });
  addEventListener('hashchange', scheduleChapter);
  addEventListener('load', scheduleChapter, { once: true });
  archive?.addEventListener('toggle', scheduleChapter, true);
  archive?.addEventListener('input', scheduleChapter);
  archive?.addEventListener('click', scheduleChapter);
  scheduleChapter();
}
