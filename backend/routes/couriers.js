const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { tryAssignPendingOrderToCourier } = require('../matching');

const router = express.Router();

// KURYE KENDİ DURUMUNU DEĞİŞTİRİR (müsait/meşgul)
router.patch('/status', requireAuth(['courier']), (req, res) => {
  const { status } = req.body;
  const allowed = ['musait', 'mesgul'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Durum sadece şunlardan biri olabilir: ${allowed.join(', ')}` });
  }

  // Üzerinde teslim edilmemiş sipariş varken "müsait" yapmasını engelle
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

  let assignedOrder = null;
  if (status === 'musait') {
    assignedOrder = tryAssignPendingOrderToCourier(req.user.id);
  }

  const courier = db.prepare('SELECT id, name, email, mahalle, status FROM couriers WHERE id = ?').get(req.user.id);

  res.json({
    courier,
    autoAssigned: !!assignedOrder,
    message: assignedOrder
      ? 'Durumunuz güncellendi. Mahallenizde bekleyen bir sipariş otomatik olarak size atandı.'
      : 'Durumunuz güncellendi.'
  });
});

module.exports = router;