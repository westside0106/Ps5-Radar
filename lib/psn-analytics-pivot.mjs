const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkg='http://schemas.openxmlformats.org/package/2006/relationships';
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const e=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
export function addPlatformPivot(files,games){
 const rows=games.filter(g=>Number.isFinite(g.sonyMinutes));
 if(!rows.length)return;
 // Cache must reflect the complete source range, including missing durations.
 const platforms=[...new Set(games.map(g=>g.platform||''))];
 const fields=['Titel','ID','Plattform','Sony Minuten','Zuletzt gespielt'];
 const cacheFields=fields.map((f,i)=>'<cacheField name="'+f+'" numFmtId="0">'+(i===2?'<sharedItems count="'+platforms.length+'">'+platforms.map(p=>'<s v="'+e(p)+'"/>').join('')+'</sharedItems>':i===3?'<sharedItems containsSemiMixedTypes="0" containsNonDate="1" containsString="0" containsNumber="1" containsBlank="1"/>':'<sharedItems containsString="1"/>')+'</cacheField>').join('');
 files['xl/pivotCache/pivotCacheDefinition1.xml']=xml('<pivotCacheDefinition xmlns="'+ns+'" xmlns:r="'+rel+'" r:id="rId1" refreshOnLoad="0" recordCount="'+games.length+'"><cacheSource type="worksheet"><worksheetSource ref="A1:E'+(games.length+1)+'" sheet="Spiele"/></cacheSource><cacheFields count="5">'+cacheFields+'</cacheFields></pivotCacheDefinition>');
 files['xl/pivotCache/pivotCacheRecords1.xml']=xml('<pivotCacheRecords xmlns="'+ns+'" count="'+games.length+'">'+games.map(g=>'<r><s v="'+e(g.title)+'"/><s v="'+e(g.id)+'"/><x v="'+platforms.indexOf(g.platform||'')+'"/>'+(Number.isFinite(g.sonyMinutes)?'<n v="'+g.sonyMinutes+'"/>':'<m/>')+'<s v="'+e(g.lastPlayed)+'"/></r>').join('')+'</pivotCacheRecords>');
 const relationships=(type,target)=>xml('<Relationships xmlns="'+pkg+'"><Relationship Id="rId1" Type="'+rel+'/'+type+'" Target="'+target+'"/></Relationships>');
 files['xl/pivotCache/_rels/pivotCacheDefinition1.xml.rels']=relationships('pivotCacheRecords','pivotCacheRecords1.xml');
 files['xl/pivotTables/_rels/pivotTable1.xml.rels']=relationships('pivotCacheDefinition','../pivotCache/pivotCacheDefinition1.xml');
 files['xl/pivotTables/pivotTable1.xml']=xml('<pivotTableDefinition xmlns="'+ns+'" name="SonySpielzeitPlattform" cacheId="1" dataCaption="Werte" grandTotalCaption="Gesamt" rowGrandTotals="1" colGrandTotals="1" createdVersion="6" updatedVersion="6" minRefreshableVersion="3"><location ref="A3:B'+(platforms.length+4)+'" firstHeaderRow="1" firstDataRow="1" firstDataCol="1"/><pivotFields count="5"><pivotField showAll="0"/><pivotField showAll="0"/><pivotField axis="axisRow" showAll="0"><items count="'+(platforms.length+1)+'">'+platforms.map((_,i)=>'<item x="'+i+'"/>').join('')+'<item t="default"/></items></pivotField><pivotField dataField="1" showAll="0"/><pivotField showAll="0"/></pivotFields><rowFields count="1"><field x="2"/></rowFields><rowItems count="'+(platforms.length+1)+'">'+platforms.map((_,i)=>'<i><x v="'+i+'"/></i>').join('')+'<i t="grand"><x/></i></rowItems><colItems count="1"><i><x/></i></colItems><dataFields count="1"><dataField name="Summe Sony Minuten" fld="3" subtotal="sum" numFmtId="0"/></dataFields><pivotTableStyleInfo name="PivotStyleMedium9" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0"/></pivotTableDefinition>');
 const cell=(ref,v)=>typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+e(v)+'</t></is></c>';
 const sums=platforms.map(p=>rows.filter(g=>(g.platform||'')===p).reduce((s,g)=>s+g.sonyMinutes,0));
 const data=[['Plattform','Summe Sony Minuten'],...platforms.map((p,i)=>[p,sums[i]]),['Gesamt',sums.reduce((a,b)=>a+b,0)]];
 files['xl/worksheets/sheet7.xml']=xml('<worksheet xmlns="'+ns+'" xmlns:r="'+rel+'"><sheetData>'+data.map((r,i)=>'<row r="'+(i+3)+'">'+cell('A'+(i+3),r[0])+cell('B'+(i+3),r[1])+'</row>').join('')+'</sheetData><pivotTableParts count="1"><pivotTablePart r:id="rId1"/></pivotTableParts></worksheet>');
 files['xl/worksheets/_rels/sheet7.xml.rels']=relationships('pivotTable','../pivotTables/pivotTable1.xml');
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace('</sheets>','<sheet name="Pivot Plattform" sheetId="7" r:id="rId7"/></sheets><pivotCaches><pivotCache cacheId="1" r:id="rIdCache1"/></pivotCaches>');
 files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="rId7" Type="'+rel+'/worksheet" Target="worksheets/sheet7.xml"/><Relationship Id="rIdCache1" Type="'+rel+'/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition1.xml"/></Relationships>');
 const types={'/xl/worksheets/sheet7.xml':'worksheet','/xl/pivotCache/pivotCacheDefinition1.xml':'pivotCacheDefinition','/xl/pivotCache/pivotCacheRecords1.xml':'pivotCacheRecords','/xl/pivotTables/pivotTable1.xml':'pivotTable'};
 files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',Object.entries(types).map(([p,t])=>'<Override PartName="'+p+'" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.'+t+'+xml"/>').join('')+'</Types>');
}
