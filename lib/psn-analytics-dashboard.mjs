import {financeRows} from './psn-analytics-finance.mjs';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships',c='http://schemas.openxmlformats.org/drawingml/2006/chart',a='http://schemas.openxmlformats.org/drawingml/2006/main',xdr='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const e=v=>String(v??'').replace(/[\u0000-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const col=i=>String.fromCharCode(65+i);
const hours=n=>Math.round(n/60*100)/100;
const cell=(v,i,j,style=0)=>'<c r="'+col(j)+(i+1)+'" s="'+style+'"'+(typeof v==='number'&&Number.isFinite(v)?'><v>'+v+'</v></c>':' t="inlineStr"><is><t>'+e(v)+'</t></is></c>');
const rowsXml=(rows,headers=[])=>rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>cell(v,i,j,headers.includes(i)?1:0)).join('')+'</row>').join('');
const relationship=(id,type,target)=>'<Relationship Id="'+id+'" Type="'+rel+'/'+type+'" Target="'+target+'"/>';
const relationships=s=>xml('<Relationships xmlns="'+pkg+'">'+s+'</Relationships>');
function register(files,id,name,body){
 files['xl/worksheets/sheet'+id+'.xml']=xml('<worksheet xmlns="'+ns+'" xmlns:r="'+rel+'">'+body+'</worksheet>');
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace('</sheets>','<sheet name="'+name+'" sheetId="'+id+'" r:id="rId'+id+'"/></sheets>');
 files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>',relationship('rId'+id,'worksheet','worksheets/sheet'+id+'.xml')+'</Relationships>');
 type(files,'/xl/worksheets/sheet'+id+'.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml');
}
function type(files,path,mime){files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>','<Override PartName="'+path+'" ContentType="'+mime+'"/></Types>')}
export function activityGrid(sessions){
 const grid=Array.from({length:7},()=>Array(24).fill(0));
 for(const s of sessions){let t=Date.parse(s.start),end=Date.parse(s.end);if(!Number.isFinite(t)||!Number.isFinite(end)||end<=t||end-t>43200000)continue;
 while(t<end){const d=new Date(t),next=Math.min(end,(Math.floor(t/3600000)+1)*3600000);grid[(d.getUTCDay()+6)%7][d.getUTCHours()]+=(next-t)/60000;t=next;}}
 return grid.map(r=>r.map(v=>Math.round(v*10)/10));
}
function chart(kind,title,cat,val,count){
 const series='<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>'+e(title)+'</c:v></c:tx><c:cat><c:strRef><c:f>'+e(cat)+'</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>'+e(val)+'</c:f></c:numRef></c:val></c:ser>';
 const plot=kind==='line'?'<c:lineChart><c:grouping val="standard"/>'+series+'<c:axId val="101"/><c:axId val="102"/></c:lineChart>':'<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/>'+series+'<c:axId val="101"/><c:axId val="102"/></c:barChart>';
 const axis=(tag,id,cross,pos)=>'<c:'+tag+'><c:axId val="'+id+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="'+pos+'"/><c:crossAx val="'+cross+'"/><c:crosses val="autoZero"/></c:'+tag+'>';
 return xml('<c:chartSpace xmlns:c="'+c+'" xmlns:a="'+a+'"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+e(title)+'</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/>'+plot+axis('catAx',101,102,kind==='line'?'b':'l')+axis('valAx',102,101,kind==='line'?'l':'b')+'</c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>');
}
export function addDashboard(files,m){
 const history=m.history.filter(h=>Number.isFinite(h.minutes??h.totalMinutes)).sort((a,b)=>a.date.localeCompare(b.date));
 const top=m.games.filter(g=>Number.isFinite(g.sonyMinutes)).sort((a,b)=>b.sonyMinutes-a.sonyMinutes).slice(0,10);
 const rows=[['PS5-RADAR | ANALYTICS','Wert'],['Sony Gesamtstunden',m.coverage.psn?hours(m.sonyMinutes):'Nicht verfügbar'],['Gespielte Titel',m.games.length],['Platin-Trophäen',m.trophies.reduce((s,t)=>s+(Number(t.platinum)||0),0)],['Monitor-Stunden',hours(m.observedSessions.reduce((s,t)=>s+(Number(t.minutes)||0),0))],['Monitor-Sitzungen',m.observedSessions.length],['Historische Messpunkte',history.length],['Erstellt UTC',m.generatedAt],[],['Datum','Sony Stunden','','Top 10 Spiele','Sony Stunden']];
 for(let i=0;i<Math.max(history.length,top.length);i++)rows.push([history[i]?.date??'',history[i]?hours(history[i].minutes??history[i].totalMinutes):'','',top[i]?.title??'',top[i]?hours(top[i].sonyMinutes):'']);
 const charts=[];if(history.length)charts.push(['line','Sony Gesamtspielzeit (h)','Dashboard!$A$11:$A$'+(10+history.length),'Dashboard!$B$11:$B$'+(10+history.length)]);if(top.length)charts.push(['bar','Top 10 Spiele (h)','Dashboard!$D$11:$D$'+(10+top.length),'Dashboard!$E$11:$E$'+(10+top.length)]);
 register(files,12,'Dashboard','<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="3" width="18" customWidth="1"/><col min="4" max="4" width="42" customWidth="1"/><col min="5" max="5" width="18" customWidth="1"/></cols><sheetData>'+rowsXml(rows,[0,9])+'</sheetData>'+(charts.length?'<drawing r:id="rId1"/>':''));
 const finance=financeRows(m);
 for(const [id,name,rows] of [[14,'Finanzen',finance.summary],[15,'Kaufbelege',finance.receipts],[16,'Kosten je Stunde',finance.ranking],[17,'Monatsausgaben',finance.monthly]]){
 register(files,id,name,'<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="7" width="24" customWidth="1"/></cols><sheetData>'+rowsXml(rows,[0])+'</sheetData>'+(rows.length>1?'<autoFilter ref="A1:'+col(rows[0].length-1)+rows.length+'"/>':''));
 }
 const grid=activityGrid(m.observedSessions),heat=[['UTC · Minuten',...Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))],...grid.map((r,i)=>[['Mo','Di','Mi','Do','Fr','Sa','So'][i],...r])];
 register(files,13,'Heatmap UTC','<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="25" width="6" customWidth="1"/></cols><sheetData>'+rowsXml(heat,[0])+'</sheetData><conditionalFormatting sqref="B2:Y8"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF1F5F9"/><color rgb="FF185ABD"/></colorScale></cfRule></conditionalFormatting>');
 if(!charts.length)return;
 files['xl/worksheets/_rels/sheet12.xml.rels']=relationships(relationship('rId1','drawing','../drawings/drawing1.xml'));
 files['xl/drawings/drawing1.xml']=xml('<xdr:wsDr xmlns:xdr="'+xdr+'" xmlns:a="'+a+'" xmlns:r="'+rel+'">'+charts.map((_,i)=>'<xdr:twoCellAnchor><xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+(i*18)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>15</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+((i+1)*18)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="'+(i+1)+'" name="Chart '+(i+1)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="'+c+'"><c:chart xmlns:c="'+c+'" r:id="rId'+(i+1)+'"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>').join('')+'</xdr:wsDr>');
 files['xl/drawings/_rels/drawing1.xml.rels']=relationships(charts.map((_,i)=>relationship('rId'+(i+1),'chart','../charts/chart'+(i+1)+'.xml')).join(''));
 type(files,'/xl/drawings/drawing1.xml','application/vnd.openxmlformats-officedocument.drawing+xml');
 charts.forEach((args,i)=>{files['xl/charts/chart'+(i+1)+'.xml']=chart(...args);type(files,'/xl/charts/chart'+(i+1)+'.xml','application/vnd.openxmlformats-officedocument.drawingml.chart+xml')});
}
