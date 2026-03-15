document.addEventListener('DOMContentLoaded', () => {
  const btnCheckChrome = document.getElementById('btnCheckChrome');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const chromeStatus = document.getElementById('chromeStatus');
  const profileNameInput = document.getElementById('profileName');
  const checkChrome = async () => {
    chromeStatus.textContent = 'Kontrol ediliyor...';
    try {
      const res = await fetch('/api/setup/check-chrome');
      const data = await res.json();
      if (data.success) {
        chromeStatus.textContent = 'Chrome bulundu: ' + data.path;
        chromeStatus.style.color = '#2d9f6a';
        setTimeout(() => {
          showStep(2);
        }, 1500);
      } else {
        chromeStatus.textContent = 'Chrome bulunamadı! Lütfen yükleyin.';
        chromeStatus.style.color = '#e8650a';
      }
    } catch (err) {
      chromeStatus.textContent = 'Hata oluştu.';
    }
  };
  const showStep = (num) => {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + num).classList.add('active');
  };
  btnCheckChrome.addEventListener('click', checkChrome);
  btnSaveProfile.addEventListener('click', async () => {
    const profile = profileNameInput.value.trim();
    if (!profile) return alert('Profil adı girin.');
    try {
      const res = await fetch('/api/setup/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      const data = await res.json();
      if (data.success) {
        showStep(3);
      }
    } catch (err) {
      alert('Kaydedilemedi.');
    }
  });
  checkChrome();
});
