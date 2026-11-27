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
function chart(kind,title,cat,val,data){
 const series='<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>'+e(title)+'</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="1264A3"/></a:solidFill><a:ln w="28575"><a:solidFill><a:srgbClr val="1264A3"/></a:solidFill></a:ln></c:spPr><c:cat><c:strRef><c:f>'+e(cat)+'</c:f><c:strCache><c:ptCount val="'+data.length+'"/>'+data.map((p,i)=>'<c:pt idx="'+i+'"><c:v>'+e(p[0])+'</c:v></c:pt>').join('')+'</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'+e(val)+'</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="'+data.length+'"/>'+data.map((p,i)=>'<c:pt idx="'+i+'"><c:v>'+p[1]+'</c:v></c:pt>').join('')+'</c:numCache></c:numRef></c:val></c:ser>';
 const plot=kind==='line'?'<c:lineChart><c:grouping val="standard"/>'+series+'<c:axId val="101"/><c:axId val="102"/></c:lineChart>':'<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/>'+series+'<c:axId val="101"/><c:axId val="102"/></c:barChart>';
 const axis=(tag,id,cross,pos)=>'<c:'+tag+'><c:axId val="'+id+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="'+pos+'"/><c:crossAx val="'+cross+'"/><c:crosses val="autoZero"/></c:'+tag+'>';
 return xml('<c:chartSpace xmlns:c="'+c+'" xmlns:a="'+a+'"><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>'+e(title)+'</a:t></a:r></a:p></c:rich></c:tx></c:title><c:plotArea><c:layout/>'+plot+axis('catAx',101,102,kind==='line'?'b':'l')+axis('valAx',102,101,kind==='line'?'l':'b')+'</c:plotArea><c:plotVisOnly val="1"/></c:chart></c:chartSpace>');
}
export function addDashboard(files,m){
 const history=m.history.filter(h=>Number.isFinite(h.minutes??h.totalMinutes)).sort((a,b)=>a.date.localeCompare(b.date));
 const top=m.games.filter(g=>Number.isFinite(g.sonyMinutes)).sort((a,b)=>b.sonyMinutes-a.sonyMinutes).slice(0,10);
 const finance=financeRows(m);
 const metric=k=>finance.summary.find(r=>r[0]===k)?.[1]??'–';
 const styles=files['xl/styles.xml'];
 const font=(size,color)=>'<font><b/><sz val="'+size+'"/><color rgb="FF'+color+'"/><name val="Calibri"/></font>';
 const fill=color=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+color+'"/><bgColor indexed="64"/></patternFill></fill>';
 const xf=(f,b,n=0)=>'<xf numFmtId="'+n+'" fontId="'+f+'" fillId="'+b+'" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="left"/></xf>';
 files['xl/styles.xml']=styles.replace('<fonts count="2">','<fonts count="5">').replace('</fonts>',font(22,'FFFFFF')+font(11,'A9C6E8')+font(26,'FFFFFF')+'</fonts>').replace('<fills count="3">','<fills count="6">').replace('</fills>',fill('101D35')+fill('183B63')+fill('1264A3')+'</fills>').replace('<cellXfs count="2">','<cellXfs count="7">').replace('</cellXfs>',xf(2,3)+xf(3,4)+xf(4,4,4)+xf(4,5,4)+xf(3,3)+'</cellXfs>');
 const cells=new Map(),merges=[];
 const put=(r,j,v,st)=>{if(!cells.has(r))cells.set(r,new Map());cells.get(r).set(j,[v,st]);};
 const band=(r,j,w,v,st)=>{for(let k=0;k<w;k++)put(r,j+k,k===0?v:'',st);if(w>1)merges.push(col(j)+r+':'+col(j+w-1)+r);};
 band(1,0,8,'PS5 RADAR  /  ANALYTICS',2);
 band(2,0,8,'PERSONAL PLAYSTATION REPORT  •  '+String(m.generatedAt).slice(0,10),6);
 const kpis=[['SONY SPIELZEIT · h',m.coverage.psn?hours(m.sonyMinutes):'–'],['NETTOAUSGABEN · EUR',metric('Nettoausgaben EUR')],['GESPIELTE TITEL',m.games.length],['PLATIN',m.trophies.reduce((s,t)=>s+(Number(t.platinum)||0),0)],['MONITOR · h',hours(m.observedSessions.reduce((s,t)=>s+(Number(t.minutes)||0),0))],['SITZUNGEN',m.observedSessions.length]];
 kpis.forEach(([label,value],i)=>{const r=4+Math.floor(i/2)*3,j=(i%2)*4;band(r,j,4,label,3);band(r+1,j,4,value,i%2?5:4);});
 band(13,0,8,'01  /  SPIELZEIT & AKTIVITÄT',2);
 band(29,0,8,'02  /  TOP 10 SPIELE',2);
 band(45,0,8,'03  /  MONATLICHE NETTOAUSGABEN',2);
 band(76,0,8,'05  /  DATENQUALITÄT',2);
 band(77,0,8,'Sony-Gesamtzeit und Monitor-Sitzungen sind getrennte Messgrößen.',6);
 band(78,0,8,'Kosten enthalten ggf. DLCs; Erstattungen nur auf Gesamtebene.',6);
 band(79,0,8,'Historische Messpunkte: '+history.length+'  |  Kaufbelege: '+(m.purchases??[]).length,6);
 band(61,0,8,'04  /  AKTIVITÄT · UTC',2);
 const activity=activityGrid(m.observedSessions);
 ['Tag','00–04','04–08','08–12','12–16','16–20','20–24','Summe'].forEach((v,j)=>put(63,j,v,3));
 activity.forEach((day,i)=>{put(64+i,0,['Mo','Di','Mi','Do','Fr','Sa','So'][i],3);for(let j=0;j<6;j++)put(64+i,j+1,Math.round(day.slice(j*4,j*4+4).reduce((a,b)=>a+b,0)),0);put(64+i,7,Math.round(day.reduce((a,b)=>a+b,0)),0);});
 band(72,0,8,'Minuten je Zeitfenster · nur beobachtete Sitzungen',6);
 const monthly=finance.monthly.slice(1);
 const charts=[];
 const series=(kind,title,data,row)=>{if(!data.length)return;data.forEach(([label,value],i)=>{put(90+i,charts.length*2,label,0);put(70+i,charts.length*2+1,value,0);});const j=charts.length*2;charts.push([kind,title,'Dashboard!$'+col(j)+'$90:$'+col(j)+'$'+(89+data.length),'Dashboard!$'+col(j+1)+'$90:$'+col(j+1)+'$'+(89+data.length),data,row]);};
 series('line','Sony Gesamtspielzeit (h)',history.map(h=>[h.date,hours(h.minutes??h.totalMinutes)]),13);
 series('bar','Top 10 Spiele (h)',top.map(g=>[g.title,hours(g.sonyMinutes)]),29);
 series('line','Nettoausgaben (EUR)',monthly,45);
 const body=[...cells].sort(([a],[b])=>a-b).map(([r,cs])=>'<row r="'+r+'" ht="'+([1,13,29,45,61,76].includes(r)?32:[5,8,11].includes(r)?38:22)+'" customHeight="1">'+[...cs].sort(([a],[b])=>a-b).map(([j,[v,st]])=>cell(v,r-1,j,st)).join('')+'</row>').join('');
 register(files,12,'Dashboard','<sheetViews><sheetView workbookViewId="0" showGridLines="0" zoomScale="85"/></sheetViews><cols><col min="1" max="8" width="11" customWidth="1"/></cols><sheetData>'+body+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells><conditionalFormatting sqref="B64:G70"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF1F5F9"/><color rgb="FF1264A3"/></colorScale></cfRule></conditionalFormatting>'+(charts.length?'<drawing r:id="rId1"/>':''));
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace(/<sheet name="Dashboard"[^>]*\/>/,tag=>{return ''}).replace('<sheets>','<sheets><sheet name="Dashboard" sheetId="12" r:id="rId12"/>');
 for(const [id,name,rows] of [[14,'Finanzen',finance.summary],[15,'Kaufbelege',finance.receipts],[16,'Kosten je Stunde',finance.ranking],[17,'Monatsausgaben',finance.monthly]]){
 register(files,id,name,'<cols><col min="1" max="1" width="38" customWidth="1"/><col min="2" max="10" width="24" customWidth="1"/></cols><sheetData>'+rowsXml(rows,[0])+'</sheetData>'+(rows.length>1?'<autoFilter ref="A1:'+col(rows[0].length-1)+rows.length+'"/>':''));
 }
 const grid=activityGrid(m.observedSessions),heat=[['UTC · Minuten',...Array.from({length:24},(_,i)=>String(i).padStart(2,'0'))],...grid.map((r,i)=>[['Mo','Di','Mi','Do','Fr','Sa','So'][i],...r])];
 register(files,13,'Heatmap UTC','<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="25" width="6" customWidth="1"/></cols><sheetData>'+rowsXml(heat,[0])+'</sheetData><conditionalFormatting sqref="B2:Y8"><cfRule type="colorScale" priority="1"><colorScale><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF1F5F9"/><color rgb="FF185ABD"/></colorScale></cfRule></conditionalFormatting>');
 if(!charts.length)return;
 files['xl/worksheets/_rels/sheet12.xml.rels']=relationships(relationship('rId1','drawing','../drawings/drawing1.xml'));
 files['xl/drawings/drawing1.xml']=xml('<xdr:wsDr xmlns:xdr="'+xdr+'" xmlns:a="'+a+'" xmlns:r="'+rel+'">'+charts.map((_,i)=>'<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+(charts[i][5])+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+(charts[i][5]+15)+'</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame><xdr:nvGraphicFramePr><xdr:cNvPr id="'+(i+1)+'" name="Chart '+(i+1)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="'+c+'"><c:chart xmlns:c="'+c+'" r:id="rId'+(i+1)+'"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>').join('')+'</xdr:wsDr>');
 files['xl/drawings/_rels/drawing1.xml.rels']=relationships(charts.map((_,i)=>relationship('rId'+(i+1),'chart','../charts/chart'+(i+1)+'.xml')).join(''));
 type(files,'/xl/drawings/drawing1.xml','application/vnd.openxmlformats-officedocument.drawing+xml');
 charts.forEach((args,i)=>{files['xl/charts/chart'+(i+1)+'.xml']=chart(...args);type(files,'/xl/charts/chart'+(i+1)+'.xml','application/vnd.openxmlformats-officedocument.drawingml.chart+xml')});
}
