import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOrderHistory,summarizeOrderHistory} from '../lib/psn-order-history.mjs';

const rows=[
 {id:'tx-1-item-1',date:'2026-10-05T12:00:00Z',name:'Premium, Deluxe "Edition"',category:'purchased',paid:35.99,original:69.99,refunded:false,txnId:'SECRET-TXN',payment:'CREDIT_CARD'},
 {id:'tx-1-item-2',date:'2026-10-05T12:00:00Z',name:'Monthly game',category:'psplus',paid:0,original:59.99,refunded:false},
 {id:'tx-2-item-1',date:'2026-11-04T12:00:00Z',name:'Refunded title',category:'purchased',paid:20,original:35,refunded:true},
 {id:'tx-3-item-1',date:'2026-11-04T12:00:00Z',name:'Subscription',category:'subscription',paid:9.99,refunded:false}
];
test('JSON export imports rows but strips identifiers and payment methods',()=>{
 const data=parseOrderHistory(JSON.stringify(rows),'json');
 assert.equal(data.rows.length,4);
 assert.equal(data.source,'json');
 assert.equal(data.rows[0].title,'Premium, Deluxe "Edition"');
 assert.equal('txnId' in data.rows[0],false);
 assert.equal('payment' in data.rows[0],false);
 assert.equal('id' in data.rows[0],false);
 assert.equal(data.rows[0].category,'purchased');
 const values=summarizeOrderHistory(data.rows);
 assert.equal(values.positions,4);
 assert.equal(values.netSpent,45.98);
 assert.equal(values.groups.purchased.count,2);
 assert.equal(values.groups.purchased.paid,35.99);
 assert.equal(values.groups.psplus.count,1);
 assert.equal(values.groups.psplus.storeValue,59.99);
 assert.equal(values.refundedCount,1);
 assert.equal(values.monthly[0].month,'2026-11');
 assert.equal(values.monthly[0].paid,9.99);
});
test('CSV BOM escaped quote, comma and multi-line quoted titles',()=>{
 const csv='\ufeffDate,Name,Category,Type,Platform,Price paid,Store price,Saved,Payment,Refunded,SKU,Transaction ID\r\n'
  +'2026-10-05,"Premium, Deluxe ""Edition""",Purchased,GAME,PS5,35.99,69.99,34.00,Card,No,SKU,tx1\r\n'
  +'2026-11-02,"Wrapped\nGame",PS Plus,GAME,PS5,0,60,60,,No,SKU2,tx2\r\n'
  +'2026-11-05,Subscription,Subscriptions,SUBSCRIPTION,,9.99,9.99,0,Card,Yes,SKU3,tx3';
 const imported=parseOrderHistory(csv,'csv');
 assert.equal(imported.rows.length,3);
 assert.equal(imported.rows[1].title,'Wrapped\nGame');
 assert.equal(imported.rows[1].category,'psplus');
 assert.equal(imported.rows[2].refunded,true);
 assert.equal(summarizeOrderHistory(imported.rows).netSpent,35.99);
});
test('money locale is parsed unambiguously without guessing unknown amounts',()=>{
 const base={date:'2026-11-21',name:'Game',category:'Purchased',refunded:false};
 const data=parseOrderHistory(JSON.stringify([
 {...base,paid:'1.234,50',original:'2.000,00'},
 {...base,name:'DLC',paid:'1,234.50'},
 {...base,name:'Unknown',paid:'abc'},
 {...base,name:'Local',paid:'10,50'}
 ]));
 assert.equal(data.rows.length,4);
 assert.equal(data.rows[0].paid,1234.5);
 assert.equal(data.rows[1].paid,1234.5);
 assert.equal(data.rows[2].paid,null);
 assert.equal(data.rows[3].paid,10.5);
 assert.equal(summarizeOrderHistory(data.rows).unknownAmounts,1);
});
test('invalid CSV header, data and excessive sizes are rejected',()=>{
 assert.throws(()=>parseOrderHistory('Date,Name\n2026-01-01,A','csv'),/Spalte fehlt/);
 assert.throws(()=>parseOrderHistory('Date,Name,Category,Price paid,Refunded\n2026-11-20,"Bad title', 'csv'),/unvollständig/);
 assert.throws(()=>parseOrderHistory('{broken','json'),/Ungültiges JSON/);
 assert.throws(()=>parseOrderHistory('a'.repeat(3_000_001),'csv'),/größer als 3 MB/);
});
test('duplicate JSON IDs deduplicated; invalid dates skipped',()=>{
 const imp=parseOrderHistory(JSON.stringify([rows[0],rows[0],{...rows[0],id:'new',date:'2026-02-31'}]));
 assert.equal(imp.rows.length,1);
 assert.equal(imp.skippedRows,2);
});
test('unknown currency is never assumed; only selected currency is display-level',()=>{
 const imp=parseOrderHistory(JSON.stringify(rows),'json');
 assert.equal(imp.rows[0].paid,35.99);
 assert.equal('currency' in imp.rows[0],false);
});
