//kuryelerin ayni anda secerek cakismasini onluyoruz
const db= require('./db');
//otomatik atama fonksiyonu
function tryAssignOrder(orderId){
   const order =db.prepare('SELECT * FROM orders WHERE id =?').get(orderId);
   if(!order || order.status!=='bekliyor')return null;

  const courier=db.prepare(
    `SELECT * FROM couriers WHERE mahalle =? AND status = 'musait' ORDER BY id ASC LIMIT 1`
  ).get(order.mahalle);
if(!courier) return null;
//atomik atama komutu 
const assign=db.transaction(()=>{
  db.prepare(
    `UPDATE orders SET courier_id = ?,status = 'atandi',updated_at=datetime('now')WHERE id= ? AND status = 'bekliyor'`
  ).run(courier.id,orderId);

  db.prepare(
    `UPDATE couriers SET status = 'mesgul' WHERE id=?`
  ).run(courier.id);
});
assign();
return courier;
}
//kurye musait olunca otomatik atama
function tryAssignPendingOrderToCourier(courierId){
 const courier=db.prepare('SELECT * FROM couriers WHERE id=?').get(courierId);
if(!courier ||courier.status !=='musait')return null;

const pendingOrder=db.prepare(
    `SELECT * FROM  orders WHERE mahalle =? AND status = 'bekliyor' ORDER BY created_at ASC LIMIT 1`
).get(courier.mahalle);

if(!pendingOrder) return null;
return tryAssignOrder(pendingOrder.id);

}
module.exports={tryAssignOrder,tryAssignPendingOrderToCourier};