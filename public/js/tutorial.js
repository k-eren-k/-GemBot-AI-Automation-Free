const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });
document.querySelectorAll('.step-wrap').forEach((el, i) => {
  el.style.transitionDelay = (i * 0.06) + 's';
  observer.observe(el);
});
function toggleFaq(btn) {
  const parent = btn.parentElement;
  if (parent) parent.classList.toggle('open');
}
const models = [
  { name: 'Flash 2.0', desc: 'Hızlı yanıtlar için optimize edilmiş model. Günlük görevler ve sohbet için en iyi seçim.', speed: '95%' },
  { name: 'Thinking 2.0', desc: 'Adım adım düşünerek karmaşık problemleri çözer. Mantık, analiz ve planlama için idealdir.', speed: '60%' },
  { name: 'Pro 2.5', desc: 'En üst düzey performans. Derin kodlama, matematik ve araştırma görevleri için en iyi seçim.', speed: '45%' },
];
function selectModel(tab, idx) {
  document.querySelectorAll('#modelTabs .model-tab').forEach(t => t.classList.remove('active-tab'));
  tab.classList.add('active-tab');
  const m = models[idx];
  if (m) {
    const nameEl = document.getElementById('mdName');
    const descEl = document.getElementById('mdDesc');
    const barEl = document.getElementById('mdBar');
    if (nameEl) nameEl.textContent = m.name;
    if (descEl) descEl.textContent = m.desc;
    if (barEl) barEl.style.width = m.speed;
  }
}
let modelIdx = 0;
setInterval(() => {
  modelIdx = (modelIdx + 1) % 3;
  const tabs = document.querySelectorAll('#modelTabs .model-tab');
  if (tabs[modelIdx]) selectModel(tabs[modelIdx], modelIdx);
}, 3000);
setTimeout(() => {
  document.querySelectorAll('.step-wrap').forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) el.classList.add('visible');
  });
}, 100);
