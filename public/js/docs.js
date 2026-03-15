function toggleEp(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}
async function copyCode(btn) {
  const block = btn.parentElement.cloneNode(true);
  block.querySelectorAll('.copy-btn').forEach(b => b.remove());
  try {
    await navigator.clipboard.writeText(block.innerText.trim());
    btn.textContent = '✓ Kopyalandı';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Kopyala'; btn.classList.remove('copied'); }, 2000);
  } catch { btn.textContent = 'Hata'; }
}
function switchTab(tab, contentId) {
  const tabBar = tab.parentElement;
  if (tabBar) {
    tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const body = tabBar.parentElement;
    if (body) {
      body.querySelectorAll('.tab-pane').forEach(p => p.style.display = p.id === contentId ? 'block' : 'none');
    }
  }
}
function searchNav(q) {
  q = q.toLowerCase().trim();
  document.querySelectorAll('.nav-link').forEach(l => {
    const text = (l.textContent + ' ' + (l.dataset.search || '')).toLowerCase();
    l.style.display = (!q || text.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.nav-group-title').forEach(t => {
    const grp = t.parentElement;
    if (grp) {
      const vis = Array.from(grp.querySelectorAll('.nav-link')).some(l => l.style.display !== 'none');
      t.style.display = vis ? '' : 'none';
    }
  });
}
const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
function updateActiveNav() {
  const scrollY = window.scrollY + 130;
  const tracked = [];
  navLinks.forEach(link => {
    const id = link.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) tracked.push({ el, link });
  });
  if (tracked.length === 0) return;
  let active = tracked[0];
  for (const item of tracked) {
    if (item.el.getBoundingClientRect().top + window.scrollY <= scrollY) active = item;
  }
  navLinks.forEach(l => l.classList.remove('active'));
  if (active) active.link.classList.add('active');
}
window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const href = a.getAttribute('href');
    if (!href) return;
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (a.classList.contains('nav-link')) {
        navLinks.forEach(l => l.classList.remove('active'));
        a.classList.add('active');
      }
    }
  });
});
