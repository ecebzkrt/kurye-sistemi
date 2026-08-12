const Database =require('better-sqlite3');
const path=require('path');
const db=new Database(path.join(__dirname,'kurye.db'));
//performans guvenlik ayari
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');//siparis hangi isletmeye kuryeye ait bunu belirliyor

//işletmeler tablosu
db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    mahalle TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
    ) 
    `);
    //kurye tablosu
    db.exec(`
  CREATE TABLE IF NOT EXISTS couriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    mahalle TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'musait' CHECK(status IN ('musait','mesgul')),
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
//siparişler tablosu
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    courier_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    mahalle TEXT NOT NULL,
    receipt_image_path TEXT,
    status TEXT NOT NULL DEFAULT 'bekliyor'
      CHECK(status IN ('bekliyor','atandi','yolda','teslim_edildi','iptal')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (business_id) REFERENCES businesses(id),
    FOREIGN KEY (courier_id) REFERENCES couriers(id)
  )
`);
module.exports=db;