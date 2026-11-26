const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkg='http://schemas.openxmlformats.org/package/2006/relationships';
const xml=s=>'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+s;
const e=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
function addPivot(files,games,{id,sheetId,source,caption,fields,rowField=2,valueField=3}){
 const rows=games.filter(g=>Number.isFinite(g.sonyMinutes));
 if(!rows.length)return;
 // Cache must reflect the complete source range, including missing durations.
 const values=g=>[g.title,g.id,g.platform,g.sonyMinutes,g.lastPlayed];
 const group=g=>String(values(g)[rowField]??"");
 const platforms=[...new Set(games.map(group))];
 
 const cacheFields=fields.map((f,i)=>'<cacheField name="'+f+'" numFmtId="0">'+(i===rowField?'<sharedItems count="'+platforms.length+'">'+platforms.map(p=>'<s v="'+e(p)+'"/>').join('')+'</sharedItems>':i===valueField?'<sharedItems containsSemiMixedTypes="0" containsNonDate="1" containsString="0" containsNumber="1" containsBlank="1"/>':'<sharedItems containsString="1"/>')+'</cacheField>').join('');
 files['xl/pivotCache/pivotCacheDefinition'+id+'.xml']=xml('<pivotCacheDefinition xmlns="'+ns+'" xmlns:r="'+rel+'" r:id="rId1" refreshOnLoad="0" recordCount="'+games.length+'"><cacheSource type="worksheet"><worksheetSource ref="A1:E'+(games.length+1)+'" sheet="'+e(source)+'"/></cacheSource><cacheFields count="5">'+cacheFields+'</cacheFields></pivotCacheDefinition>');
 files['xl/pivotCache/pivotCacheRecords'+id+'.xml']=xml('<pivotCacheRecords xmlns="'+ns+'" count="'+games.length+'">'+games.map(g=>'<r>'+values(g).map((v,i)=>i===rowField?'<x v="'+platforms.indexOf(group(g))+'"/>':i===valueField?(Number.isFinite(v)?'<n v="'+v+'"/>':'<m/>'):'<s v="'+e(v)+'"/>').join('')+'</r>').join('')+'</pivotCacheRecords>');
 const relationships=(type,target)=>xml('<Relationships xmlns="'+pkg+'"><Relationship Id="rId1" Type="'+rel+'/'+type+'" Target="'+target+'"/></Relationships>');
 files['xl/pivotCache/_rels/pivotCacheDefinition'+id+'.xml.rels']=relationships('pivotCacheRecords','pivotCacheRecords'+id+'.xml');
 files['xl/pivotTables/_rels/pivotTable'+id+'.xml.rels']=relationships('pivotCacheDefinition','../pivotCache/pivotCacheDefinition'+id+'.xml');
 files['xl/pivotTables/pivotTable'+id+'.xml']=xml('<pivotTableDefinition xmlns="'+ns+'" name="Pivot'+id+'" cacheId="'+id+'" dataCaption="Werte" grandTotalCaption="Gesamt" rowGrandTotals="1" colGrandTotals="1" createdVersion="6" updatedVersion="6" minRefreshableVersion="3"><location ref="A3:B'+(platforms.length+4)+'" firstHeaderRow="1" firstDataRow="1" firstDataCol="1"/><pivotFields count="5">'+fields.map((_,i)=>i===rowField?'<pivotField axis="axisRow" showAll="0"><items count="'+(platforms.length+1)+'">'+platforms.map((_,j)=>'<item x="'+j+'"/>').join('')+'<item t="default"/></items></pivotField>':i===valueField?'<pivotField dataField="1" showAll="0"/>':'<pivotField showAll="0"/>').join('')+'</pivotFields><rowFields count="1"><field x="'+rowField+'"/></rowFields><rowItems count="'+(platforms.length+1)+'">'+platforms.map((_,i)=>'<i><x v="'+i+'"/></i>').join('')+'<i t="grand"><x/></i></rowItems><colItems count="1"><i><x/></i></colItems><dataFields count="1"><dataField name="Summe '+e(fields[valueField])+'" fld="'+valueField+'" subtotal="sum" numFmtId="0"/></dataFields><pivotTableStyleInfo name="PivotStyleMedium9" showRowHeaders="1" showColHeaders="1" showRowStripes="0" showColStripes="0"/></pivotTableDefinition>');
 const cell=(ref,v)=>typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+e(v)+'</t></is></c>';
 const sums=platforms.map(p=>rows.filter(g=>group(g)===p).reduce((s,g)=>s+g.sonyMinutes,0));
 const data=[[fields[rowField],'Summe '+e(fields[valueField])+''],...platforms.map((p,i)=>[p,sums[i]]),['Gesamt',sums.reduce((a,b)=>a+b,0)]];
 files['xl/worksheets/sheet'+sheetId+'.xml']=xml('<worksheet xmlns="'+ns+'" xmlns:r="'+rel+'"><sheetData>'+data.map((r,i)=>'<row r="'+(i+3)+'">'+cell('A'+(i+3),r[0])+cell('B'+(i+3),r[1])+'</row>').join('')+'</sheetData><pivotTableParts count="1"><pivotTablePart r:id="rId1"/></pivotTableParts></worksheet>');
 files['xl/worksheets/_rels/sheet'+sheetId+'.xml.rels']=relationships('pivotTable','../pivotTables/pivotTable'+id+'.xml');
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace('</sheets>','<sheet name="'+e(caption)+'" sheetId="'+sheetId+'" r:id="rId'+sheetId+'"/></sheets>');
 const cache='<pivotCache cacheId="'+id+'" r:id="rIdCache'+id+'"/>';
 files['xl/workbook.xml']=files['xl/workbook.xml'].includes('</pivotCaches>')?files['xl/workbook.xml'].replace('</pivotCaches>',cache+'</pivotCaches>'):files['xl/workbook.xml'].replace('</workbook>','<pivotCaches>'+cache+'</pivotCaches></workbook>');
 files['xl/_rels/workbook.xml.rels']=files['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="rId'+sheetId+'" Type="'+rel+'/worksheet" Target="worksheets/sheet'+sheetId+'.xml"/><Relationship Id="rIdCache'+id+'" Type="'+rel+'/pivotCacheDefinition" Target="pivotCache/pivotCacheDefinition'+id+'.xml"/></Relationships>');
 const types={['/xl/worksheets/sheet'+sheetId+'.xml']:'worksheet',['/xl/pivotCache/pivotCacheDefinition'+id+'.xml']:'pivotCacheDefinition',['/xl/pivotCache/pivotCacheRecords'+id+'.xml']:'pivotCacheRecords',['/xl/pivotTables/pivotTable'+id+'.xml']:'pivotTable'};
 files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',Object.entries(types).map(([p,t])=>'<Override PartName="'+p+'" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.'+t+'+xml"/>').join('')+'</Types>');
}

export function addPlatformPivot(files,games){const fields=['Titel','ID','Plattform','Sony Minuten','Zuletzt gespielt'];addPivot(files,games,{id:1,sheetId:7,source:'Spiele',caption:'Pivot Plattform',fields});addPivot(files,games,{id:2,sheetId:8,source:'Spiele',caption:'Pivot Spiele',fields,rowField:0});}
