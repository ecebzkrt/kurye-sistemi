const { normalizeMahalle } = require('../utils');
const express =require('express');
const bcrypt= require('bcryptjs');
const jwt= require('jsonwebtoken');
const db= require('../db');
const { JWT_SECRET }=require('../middleware/auth');

const router = express.Router();
//isletme kaydi
router.post('/business/register',(req,res)=>{
    const { name,email,password,mahalle} =req.body;
if(!name || !email || !password || !mahalle){
    return res.status(400).json({error:'Tüm alanları doldurun! (isim ,email ,şifre ,mahalle).'});
}
const existing =db.prepare('SELECT id FROM businesses WHERE email = ?').get(email);
if(existing){
    return res.status(409).json({error:'Bu email ile kayıtlı bir işletme zaten var.'});

}
const password_hash =bcrypt.hashSync(password,10);
const mahalleClean = normalizeMahalle(mahalle);
const result = db.prepare(
    'INSERT INTO businesses (name, email, password_hash,mahalle) VALUES (?, ?, ?,?)'

).run(name, email, password_hash, mahalle);

const token =jwt.sign(
    { id: result.lastInsertRowid, role: 'business',name},
    JWT_SECRET,
    {expiresIn: '7d'}
);
res.status(201).json({ token,business: {id: result.lastInsertRowid, name, email, mahalle:'mahalleClean'}});

});


//işletme girişi
router.post('/business/login',(req,res) =>{
    const { email, password } =req.body;
const business = db.prepare('SELECT * FROM businesses WHERE email = ?').get(email);

if(!business || !bcrypt.compareSync(password,business.password_hash)){
    return res.status(401).json({error:'Email veya şifre hatalı!'});
}
const token=jwt.sign(
    { id: business.id,role: 'business',name:business.name },
    JWT_SECRET,
    { expiresIn: '7d'}

    );
   res.json({
    token,
    business: { id: business.id,name: business.name, email: business.email, mahalle: business.mahalle}
   });
});

//kurye kaydi
router.post('/courier/register',(req,res) =>{
    const { name,email,password,mahalle}=req.body;
    if(!name || !email || !password || !mahalle){
        return res.status(400).json({error:'Bütün alanları doldurun! (isim,email,şifre,mahalle,durum)'});
    }
    const existing= db.prepare('SELECT id FROM couriers WHERE email = ?').get(email);
    if(existing){
        return res.status(409).json({error:'Bu email ile kayıtlı bir kurye zaten var.'});
    }
const password_hash=bcrypt.hashSync(password,10);
const mahalleClean = normalizeMahalle(mahalle);
const result=db.prepare(

  'INSERT INTO couriers (name,email,password_hash,mahalle,status) VALUES (?,?,?,?,?)'
).run(name,email,password_hash,mahalleClean,'musait');

const token=jwt.sign(
    { id: result.lastInsertRowid, role: 'courier',name},
    JWT_SECRET,
    {expiresIn: '7d'},
);
res.status(201).json({token,courier: {id: result.lastInsertRowid, name,email,mahalle:'mahalleClean',status:'musait'}});

});
//kurye giris
router.post('/courier/login',(req,res)=>{
    const { email,password }= req.body;
    const courier= db.prepare('SELECT * FROM couriers WHERE email = ?').get(email);
    if(!courier || !bcrypt.compareSync(password,courier.password_hash)){
        return res.status(401).json({error:'Email veya şifre hatalı!'});
    }
    const token=jwt.sign(
        {id: courier.id,role:'courier',name: courier.name},
        JWT_SECRET,
        { expiresIn: '7d'}
    );
    res.json({
        token,
        courier: {id: courier.id,name:courier.name,email:courier.email,mahalle:courier.mahalle,status:courier.status}
    });
});
module.exports= router;