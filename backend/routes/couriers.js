const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// KURYE KENDİ DURUMUNU DEĞİŞTİRİR (müsait/meşgul)
// Artık otomatik atama tetiklenmiyor — kurye müsait olduğunda havuza kendi bakıp seçiyor.
router.patch('/status', requireAuth(['courier']), (req, res) => {
  const { status } = req.body;
  const allowed = ['musait', 'mesgul'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Durum sadece şunlardan biri olabilir: ${allowed.join(', ')}` });
  }

  if (status === 'musait') {
    const activeOrder = db.prepare(
      `SELECT id FROM orders WHERE courier_id = ? AND status IN ('atandi','yolda')`
    ).get(req.user.id);

    if (activeOrder) {
      return res.status(400).json({
        error: 'Üzerinizde henüz teslim edilmemiş bir sipariş var. Önce onu teslim edildi olarak işaretleyin.'
      });
    }
  }

  db.prepare('UPDATE couriers SET status = ? WHERE id = ?').run(status, req.user.id);

  const courier = db.prepare('SELECT id, name, email, mahalle, status FROM couriers WHERE id = ?').get(req.user.id);

  res.json({
    courier,
    message: 'Durumunuz güncellendi.'
  });
});

module.exports = router;