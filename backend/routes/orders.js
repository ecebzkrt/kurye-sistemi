const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Fiş fotoğrafı yükleme ayarları
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (okTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece resim dosyası (jpg, png, webp) yükleyebilirsiniz.'));
  }
});

// SİPARİŞ OLUŞTUR (sadece işletme)
// Artık otomatik atama YOK — sipariş direkt havuza düşer, müsait kuryeler görüp elle alır.
router.post('/', requireAuth(['business']), upload.single('receipt'), (req, res) => {
  const { customer_name, customer_address, mahalle } = req.body;

  if (!customer_name || !customer_address || !mahalle) {
    return res.status(400).json({ error: 'Müşteri adı, adres ve mahalle zorunludur.' });
  }

  const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(
    `INSERT INTO orders (business_id, customer_name, customer_address, mahalle, receipt_image_path, status)
     VALUES (?, ?, ?, ?, ?, 'bekliyor')`
  ).run(req.user.id, customer_name, customer_address, mahalle, receiptPath);

  const orderId = result.lastInsertRowid;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  res.status(201).json({
    order,
    message: 'Sipariş oluşturuldu ve müsait kuryelere iletildi.'
  });
});

// İŞLETMENİN KENDİ SİPARİŞLERİ
router.get('/business/mine', requireAuth(['business']), (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, c.name AS courier_name, c.status AS courier_status
     FROM orders o
     LEFT JOIN couriers c ON o.courier_id = c.id
     WHERE o.business_id = ?
     ORDER BY o.created_at DESC`
  ).all(req.user.id);

  res.json({ orders });
});

// KURYEYE ATANMIŞ SİPARİŞLER
router.get('/courier/mine', requireAuth(['courier']), (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, b.name AS business_name, b.mahalle AS business_mahalle
     FROM orders o
     LEFT JOIN businesses b ON o.business_id = b.id
     WHERE o.courier_id = ?
     ORDER BY o.created_at DESC`
  ).all(req.user.id);

  res.json({ orders });
});

// BEKLEYEN (HAVUZDAKİ) SİPARİŞLER — artık mahalle filtresi yok, TÜM bekleyen siparişler.
// İşletme adı ve işletmenin mahallesi de dönüyor, kurye ona göre karar versin diye.
router.get('/pending/mine', requireAuth(['courier']), (req, res) => {
  const orders = db.prepare(
    `SELECT o.*, b.name AS business_name, b.mahalle AS business_mahalle
     FROM orders o
     LEFT JOIN businesses b ON o.business_id = b.id
     WHERE o.status = 'bekliyor'
     ORDER BY o.created_at ASC`
  ).all();

  res.json({ orders });
});

// KURYE HAVUZDAN SİPARİŞ ALIR (manuel, atomik — çakışma koruması burada)
router.post('/:id/claim', requireAuth(['courier']), (req, res) => {
  const orderId = req.params.id;

  const claim = db.transaction(() => {
    const result = db.prepare(
      `UPDATE orders SET courier_id = ?, status = 'atandi', updated_at = datetime('now') WHERE id = ? AND status = 'bekliyor'`
    ).run(req.user.id, orderId);

    if (result.changes === 0) return false;

    db.prepare(`UPDATE couriers SET status = 'mesgul' WHERE id = ?`).run(req.user.id);
    return true;
  });

  const success = claim();

  if (!success) {
    return res.status(409).json({ error: 'Bu sipariş az önce başka bir kurye tarafından alındı.' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ order, message: 'Sipariş başarıyla üzerinize alındı.' });
});

// SİPARİŞ DURUMU GÜNCELLEME (yolda / teslim edildi)
router.patch('/:id/status', requireAuth(['courier']), (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  const allowed = ['yolda', 'teslim_edildi'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Durum sadece şunlardan biri olabilir: ${allowed.join(', ')}` });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (order.courier_id !== req.user.id) {
    return res.status(403).json({ error: 'Bu sipariş size atanmamış.' });
  }

  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, orderId);

  if (status === 'teslim_edildi') {
    db.prepare(`UPDATE couriers SET status = 'musait' WHERE id = ?`).run(req.user.id);
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ order: updated });
});

// SİPARİŞ İPTAL ETME (sadece işletme, sadece kendi siparişi, sadece henüz kurye almadıysa)
router.patch('/:id/cancel', requireAuth(['business']), (req, res) => {
  const orderId = req.params.id;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Sipariş bulunamadı.' });
  if (order.business_id !== req.user.id) {
    return res.status(403).json({ error: 'Bu sipariş size ait değil.' });
  }
  if (order.status !== 'bekliyor') {
    return res.status(400).json({ error: 'Bir kurye tarafından alınmış siparişler iptal edilemez, kuryeyle iletişime geçin.' });
  }

  db.prepare(`UPDATE orders SET status = 'iptal', updated_at = datetime('now') WHERE id = ?`).run(orderId);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ order: updated, message: 'Sipariş iptal edildi.' });
});



module.exports = router;