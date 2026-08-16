const jwt = require('jsonwebtoken');
const JWT_SECRET =process.env.JWT_SECRET || 'gelistirme-ortami-gizli-anahtari';

//dogrulama fonksiyonu
function requireAuth(allowedRoles){
return (req,res,next) =>{
    const authHeader =req.headers['authorization'];
    if(!authHeader || !authHeader.startsWith('Bearer')){
        return res.status(401).json({error:'Token bulunamadı.Lütfen giriş yapın'});
    }
    const token = authHeader.split(' ')[1];
    try{
        const payload =jwt.verify(token,JWT_SECRET);

        if(!allowedRoles.includes(payload.role)){
            return res.status(403).json({error:'Bu işlem için yetkiniz yok.'});
        }
req.user=payload;
next();
    }catch(err){
        return res.status(401).json({error:'Token geçersiz veya süresi dolmuş.'});
    }
  };
};
module.exports = { requireAuth,JWT_SECRET};