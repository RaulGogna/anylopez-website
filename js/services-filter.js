(function () {
  'use strict';

  const goalsBar = document.querySelector('.svc-goals');
  const dataEl = document.getElementById('svc-goals-data');
  if (!goalsBar || !dataEl) return;

  const slugsByGoal = Object.fromEntries(
    JSON.parse(dataEl.textContent).map((g) => [g.id, new Set(g.slugs)])
  );
  const buttons = goalsBar.querySelectorAll('[data-goal]');
  const status = goalsBar.querySelector('.svc-count');
  const groups = document.querySelectorAll('.svc-group');
  const catChips = document.querySelectorAll('a.svc-chip[data-cat]');
  const total = document.querySelectorAll('.svc-row').length;

  function applyGoal(goalId) {
    const wanted = slugsByGoal[goalId];
    let shown = 0;

    groups.forEach((group) => {
      let visible = 0;
      group.querySelectorAll('.svc-row').forEach((row) => {
        const show = !wanted || wanted.has(row.dataset.slug);
        row.parentElement.hidden = !show;
        if (show) visible++;
      });
      group.hidden = visible === 0;
      shown += visible;
    });

    catChips.forEach((chip) => {
      chip.parentElement.hidden = document.getElementById(chip.dataset.cat).hidden;
    });
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.goal === goalId)));
    status.textContent = status.dataset.template
      .replace('{shown}', shown)
      .replace('{total}', total);
  }

  goalsBar.addEventListener('click', (e) => {
    const button = e.target.closest('[data-goal]');
    if (button) applyGoal(button.dataset.goal);
  });

  goalsBar.hidden = false;
})();
