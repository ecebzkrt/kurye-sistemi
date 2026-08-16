require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const courierRoutes = require('./routes/couriers');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Yüklenen fiş fotoğraflarına tarayıcıdan erişim
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API route'ları
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/couriers', courierRoutes);

// Hata yakalama (örn. multer dosya boyutu/tipi hatası)
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Bir hata oluştu.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor: http://localhost:${PORT}`);
});