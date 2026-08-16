// utils.js
// Mahalle adlarını standart bir forma çevirir, böylece "Sarıçam", "sarıçam",
// "Sarıçam Mah.", "SARIÇAM MAHALLESİ" hepsi aynı kabul edilir.

function normalizeMahalle(raw) {
  if (!raw) return '';

  let s = raw.trim().replace(/\s+/g, ' ');

  // "mah.", "mh.", "mahalle", "mahallesi" eklerini temizle
  s = s.replace(/\b(mahallesi|mahalle|mah|mh)\.?\b/gi, '').trim();
  s = s.replace(/\s+/g, ' ').trim();

  // Baş harfleri büyüt (Türkçe karakterlere duyarlı)
  s = s.toLocaleLowerCase('tr-TR')
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1))
    .join(' ');

  return s;
}

module.exports = { normalizeMahalle };