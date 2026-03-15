const SYSTEM_PROMPT = ``;

const MODE_INSTRUCTIONS = {
  chat: ``,

  analyze: `## Mod: Derin Analiz
1. **Durum Tespiti** — Mevcut durumu ve bağlamı çerçevele.
2. **Bileşen Analizi** — Parçaları ayrıştır, ilişkilendir.
3. **Güçlü / Zayıf Yönler** — SWOT ya da benzeri yapı kullan.
4. **Öncelik Sırası** — Eisenhower Matrisini uygula.
5. **Risk & Önlem** — Olası sorunları ve çıkış yollarını göster.
6. **Sonuç & Öneri** — Aksiyon odaklı, net bir özet ile bitir.

FORMAT: Başlıklı bölümler → tablo veya liste → özet.`,

  plan: `## Mod: Aksiyon Planlama
- Her adım numaralı ve spesifik eylem cümlesiyle başlasın.
- Her adım için: Süre tahmini | Gerekli kaynak | Başarı kriteri.
- Bağımlılıkları belirt.
- Kritik yolu vurgula.
- Son olarak: Risk tablosu (Risk | Olasılık | Önlem).

FORMAT: Numaralı liste + alt maddeler + risk tablosu.`,

  summarize: `## Mod: Akıllı Özet
- **Ana Tema:** 1 cümle.
- **Kritik Noktalar:** Maksimum 5 madde.
- **Aksiyon Gerektiren:** Acil işlemler varsa vurgula.
- **Atlanan / Belirsiz Noktalar:** Eksik bilgiyi belirt.

FORMAT: Kısa başlıklar + madde listesi, max 200 kelime.`,

  code: `## Mod: Kod & Teknik Yardım
- Önce sorunun kök nedenini veya isteğin çıktısını belirt.
- Tam, çalışır kod yaz.
- Kod bloğu: \`\`\`dil\\n kod \\n\`\`\`
- Her önemli satıra yorum ekle.
- Varsa alternatif yaklaşımları karşılaştır.
- Edge case'leri belirt.`,

  debug: `## Mod: Hata Ayıklama
1. Hata mesajını veya belirtileri tam oku.
2. Olası nedenleri listele (en yaygından en nadire).
3. Her neden için → teşhis adımı tanımla.
4. Çözüm veya workaround sun.
5. Tekrarlanmaması için önlem öner.

FORMAT: Neden → Teşhis → Çözüm yapısı.`,
};

function buildPrompt({ userMessage, activities = [], mode = 'chat', context = {} }) {
  const parts = [SYSTEM_PROMPT, '---', MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.chat, '---'];

  if (context.project)  parts.push(`**Proje Bağlamı:** ${context.project}`);
  if (context.userRole) parts.push(`**Kullanıcı Rolü:** ${context.userRole}`);
  if (context.language) parts.push(`**Tercih Edilen Dil:** ${context.language}`);
  if (Object.keys(context).length) parts.push('---');

  if (activities.length) {
    parts.push(`**Aktivite Listesi (${activities.length} öğe):**`);
    activities.forEach((a, i) => {
      const status   = a.completed ? '✅' : '⏳';
      const priority = a.priority ? `[${a.priority.toUpperCase()}]` : '[NORMAL]';
      const due      = a.dueDate ? ` • Son: ${a.dueDate}` : '';
      const tags     = a.tags?.length ? ` • Etiket: ${a.tags.join(', ')}` : '';
      parts.push(`${i + 1}. ${status} ${priority} [${a.category || 'Genel'}] ${a.content}${due}${tags}`);
    });
    parts.push('---');
  }

  const message = userMessage?.trim();
  if (message) {
    parts.push(`**Kullanıcı İsteği:**\n${message}`);
  } else if (activities.length && mode === 'analyze') {
    parts.push(`**Kullanıcı İsteği:**\nYukarıdaki aktivite listesini derinlemesine analiz et, önceliklendir, bağımlılıkları belirle ve somut aksiyon planı oluştur.`);
  }

  return parts.join('\n');
}

function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') throw new Error('Geçersiz prompt: string bekleniyor');
  if (prompt.length > 12_000) console.warn('[Prompt] Uyarı: Prompt 12k karakteri aşıyor.');
  return true;
}

module.exports = { buildPrompt, validatePrompt, MODE_INSTRUCTIONS, SYSTEM_PROMPT };