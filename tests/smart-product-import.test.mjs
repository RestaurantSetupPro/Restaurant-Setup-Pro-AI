import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSpreadsheet, parseSpreadsheet } from '../src/services/smart-product-import.mjs';

function storedZip(entries){
  const locals=[],centrals=[];let offset=0;
  for(const [name,value] of Object.entries(entries)){const nameBytes=Buffer.from(name),data=Buffer.from(value),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(0,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);locals.push(local,nameBytes,data);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(0,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);centrals.push(central,nameBytes);offset+=local.length+nameBytes.length+data.length}
  const centralData=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(centralData.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,centralData,end]);
}

test('DUBA-style XLSX tolerates merged gaps, sparse cells, blank rows, and embedded media',()=>{
  const sheet=`<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1"><v>型号</v></c><c r="B1"><v>产品名称</v></c><c r="C1"><v>尺寸</v></c><c r="D1"><v>人民币</v></c></row>
    <row r="2"><c r="A2"><v>UP-A002</v></c><c r="B2"><v>DUBA Table Base</v></c><c r="C2"><v>380x380</v></c><c r="D2"><v>156</v></c></row>
    <row r="3"><c r="C3"><v>450x450</v></c><c r="D3"><v>168</v></c></row>
    <row r="4"><c r="A4"></c><c r="D4"></c></row>
  </sheetData><mergeCells><mergeCell ref="A2:A3"/><mergeCell ref="B2:B3"/></mergeCells></worksheet>`;
  const buffer=storedZip({'xl/worksheets/sheet1.xml':sheet,'xl/media/image1.png':Buffer.from([137,80,78,71])}),parsed=parseSpreadsheet({filename:'DUBA Table Base.xlsx',buffer}),drafts=analyzeSpreadsheet(parsed,{filename:'DUBA Table Base.xlsx',defaultCategoryName:'Table Base',currency:'CNY',exchangeRate:7.2,supplierName:'DUBA'});
  assert.equal(parsed.images.length,1);assert.equal(drafts.length,1);assert.equal(drafts[0].product_sku,'UP-A002');assert.equal(drafts[0].variants.length,2);assert.deepEqual(drafts[0].variants.map(row=>row.dimensions),['380x380','450x450']);assert.deepEqual(drafts.groupingSummary,[{product_code:'UP-A002',variant_count:2}]);assert.ok(drafts.diagnostics.some(item=>item.row===4&&item.reason==='Blank row skipped.'));
});

test('real supplier layout detects bilingual multi-row headers and groups merged model rows as variants',()=>{
  const sheet=`<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1"><v>DUBA Table Base Price List</v></c></row>
    <row r="3"><c r="A3"><v>Supplier quotation</v></c></row>
    <row r="5"><c r="A5"><v>型号 / Model</v></c><c r="B5"><v>图片 / Image</v></c><c r="C5"><v>产品名称 / Product Name</v></c><c r="D5"><v>材质 / Material</v></c><c r="G5"><v>表面处理 / Finish</v></c><c r="H5"><v>总高度 / Height</v></c><c r="I5"><v>人民币 / RMB</v></c><c r="J5"><v>规格 / Dimension</v></c></row>
    <row r="6"><c r="D6"><v>Chassis</v></c><c r="E6"><v>Column</v></c><c r="F6"><v>Tray</v></c></row>
    <row r="7"><c r="A7"><v>DB-A002</v></c><c r="C7"><v>DUBA Table Base</v></c><c r="D7"><v>Cast iron</v></c><c r="E7"><v>Steel</v></c><c r="F7"><v>Cast iron</v></c><c r="G7"><v>Black powder coat</v></c><c r="H7"><v>720</v></c><c r="I7"><v>156</v></c><c r="J7"><v>380x380</v></c></row>
    <row r="8"><c r="I8"><v>160</v></c><c r="J8"><v>400x400</v></c></row>
    <row r="9"><c r="I9"><v>168</v></c><c r="J9"><v>450x450</v></c></row>
    <row r="10"><c r="I10"><v>176</v></c><c r="J10"><v>500x500</v></c></row>
    <row r="11"><c r="I11"><v>185</v></c><c r="J11"><v>550x550</v></c></row>
  </sheetData><mergeCells><mergeCell ref="A5:A6"/><mergeCell ref="B5:B6"/><mergeCell ref="C5:C6"/><mergeCell ref="D5:F5"/><mergeCell ref="G5:G6"/><mergeCell ref="H5:H6"/><mergeCell ref="I5:I6"/><mergeCell ref="J5:J6"/><mergeCell ref="A7:A11"/><mergeCell ref="B7:B11"/><mergeCell ref="C7:C11"/></mergeCells></worksheet>`;
  const parsed=parseSpreadsheet({filename:'DUBA Table Base.xlsx',buffer:storedZip({'xl/worksheets/sheet1.xml':sheet,'xl/media/duba-a002.png':Buffer.from([137,80,78,71])})});
  const drafts=analyzeSpreadsheet(parsed,{filename:'DUBA Table Base.xlsx',defaultCategoryName:'Table Base',currency:'CNY',exchangeRate:7.2,supplierName:'DUBA'});
  assert.equal(drafts.length,1);assert.equal(drafts[0].product_sku,'DB-A002');assert.equal(drafts[0].variants.length,5);assert.deepEqual(drafts[0].variants.map(item=>item.dimensions),['380x380','400x400','450x450','500x500','550x550']);assert.deepEqual(drafts.groupingSummary,[{product_code:'DB-A002',variant_count:5}]);
  assert.equal(drafts.headerRanges[0].startRow,5);assert.equal(drafts.headerRanges[0].endRow,6);assert.equal(parsed.images.length,1);
  const mapped=Object.values(drafts[0].source_mapping).map(item=>item.source);assert.ok(mapped.includes('材质 / Material - Chassis'));assert.ok(mapped.includes('材质 / Material - Column'));assert.ok(mapped.includes('材质 / Material - Tray'));assert.match(drafts[0].mapped_product.material,/Chassis.*Cast iron/);
});

test('sparse JavaScript row arrays never reach Object.fromEntries as undefined iterator entries',()=>{
  const headers=[];headers[0]='Model';headers[2]='Dimensions';headers[5]='RMB';const first=[];first[0]='DUBA-01';first[2]='400x400';first[5]='156';const second=[];second[2]='500x500';second[5]='180';
  const drafts=analyzeSpreadsheet({sheets:[{name:'Table Base',rows:[{number:1,values:headers},undefined,{number:2,values:first},{number:3,values:second},{number:4,values:undefined}]}],images:[]},{filename:'DUBA.xlsx',defaultCategoryName:'Table Base',currency:'CNY',exchangeRate:7.2});
  assert.equal(drafts.length,1);assert.equal(drafts[0].variants.length,2);assert.equal(drafts[0].original_values['Column 2'],'');assert.ok(drafts.diagnostics.some(item=>item.reason==='Blank row skipped.'));
});

test('product grouping uses first non-empty Model candidate and carries it to variant rows',()=>{
  const rows=[
    {number:1,values:['Code','Model','Dimensions','RMB']},
    {number:2,values:['','DB-A002','380x380','156']},
    {number:3,values:['','','400x400','160']},
    {number:4,values:['','','450x450','168']}
  ];
  const drafts=analyzeSpreadsheet({sheets:[{name:'Supplier Sheet',rows}],images:[]},{filename:'DUBA Table Base.xlsx',defaultCategoryName:'Table Base',currency:'CNY',exchangeRate:7.2});
  assert.equal(drafts.length,1);
  assert.equal(drafts[0].product_sku,'DB-A002');
  assert.equal(drafts[0].variants.length,3);
  assert.deepEqual(drafts[0].variants.map(item=>item.dimensions),['380x380','400x400','450x450']);
  assert.deepEqual(drafts.groupingSummary,[{product_code:'DB-A002',variant_count:3}]);
});

test('unreadable spreadsheets return a clear analysis error',()=>{
  assert.throws(()=>parseSpreadsheet({filename:'broken.xlsx',buffer:Buffer.from('not-an-xlsx')}),/empty or is not a valid XLSX|not a valid XLSX/);
  assert.throws(()=>analyzeSpreadsheet({sheets:[{name:'Blank',rows:[]}],images:[]},{filename:'blank.xlsx'}),/No product rows could be analyzed/);
});
