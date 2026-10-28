(() => {
  'use strict';
  const L=window.Lottery, $=id=>document.getElementById(id), storageKey='suiji-youshu-v1';
  const canvas=$('wheel'), ctx=canvas.getContext('2d'), palette=['#d8ccfa','#b9defb','#bcebdd','#ffedc5'];
  let state=L.fresh(), spinning=false, importing=false, dirty=false, workbook=null, importName='', parsed=null, toastTimer, lastTick='', savedAt=null;
  const emptyHistory=$('history').innerHTML;
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
  function drawWheel(ids=state.display){
    const size=1200,r=600,n=ids.length||30,step=L.TAU/n;ctx.clearRect(0,0,size,size);
    ctx.save();ctx.translate(r,r);
    for(let i=0;i<n;i++){
      const start=-Math.PI/2+i*step;
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,start+step);ctx.closePath();ctx.fillStyle=ids.length?palette[i%4]:['#ebe8f8','#e7f0fa','#e7f4ef','#faf2e3'][i%4];ctx.fill();
      if(n<800){ctx.strokeStyle='#fff';ctx.lineWidth=n>100?1:2;ctx.stroke();}
      if(ids.length){
        ctx.save();ctx.rotate(start+step/2);ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#182846';
        ctx.font=`500 ${n<=10?52:Math.max(2,Math.min(32,2300/n))}px ui-monospace, SFMono-Regular, Consolas, monospace`;
        ctx.fillText(ids[i],r-48,0,370);ctx.restore();
      }
    }
    ctx.restore();canvas.style.transform=`rotate(${state.angle}rad)`;
    canvas.setAttribute('aria-label',ids.length?`转盘共 ${ids.length} 个等面积格子`:'尚未导入名单');
  }
  function setNumber(angle=state.angle, ids=state.display){
    const id=ids.length?ids[L.indexAt(angle,ids.length)]:'──────────';
    if(id!==lastTick){$('number').textContent=id;lastTick=id;}
  }
  function updateButtons(){
    $('draw').disabled=spinning||importing||!state.remaining.length;
    $('draw').querySelector('span').textContent=spinning?'抽签中…':state.all.length&&!state.remaining.length?'全部抽取完成':'开始抽签';
    $('undo').disabled=spinning||importing||!state.canUndo;
    $('save').disabled=spinning||importing||!state.all.length;
    $('restore').disabled=spinning||importing;
    $('upload').disabled=spinning||importing;$('demo').disabled=spinning||importing;
  }
  function render(){
    $('total').textContent=state.all.length;$('remaining').textContent=state.remaining.length;$('drawn').textContent=state.history.length;
    $('filename').hidden=!state.name;$('filename').textContent=state.name;
    $('wheel-sub').textContent=state.all.length?`${state.display.length} 个等面积格子`:'等待导入';
    $('phase').textContent=state.pending?(!state.remaining.length?'本轮已抽中 · 全部抽取完成':'本轮已抽中 · 下次抽签时移除'):state.all.length?'等待开始':'导入名单后开始';
    $('display-label').textContent=state.pending?'本轮抽中编号':'当前编号';
    document.querySelector('.display').classList.toggle('winner',!!state.pending);
    $('history-count').textContent=state.history.length?`${state.history.length} 次`:'';
    if(!state.history.length) $('history').innerHTML=emptyHistory;
    else {
      const fragment=document.createDocumentFragment();
      state.history.slice().reverse().forEach((item,i)=>{
        const row=document.createElement('div');row.className='history-row';
        const rank=document.createElement('span');rank.className='rank';rank.textContent=String(state.history.length-i).padStart(2,'0');
        const id=document.createElement('strong');id.textContent=item.id;
        const time=document.createElement('time');time.dateTime=item.time;time.textContent=new Date(item.time).toLocaleTimeString('zh-CN',{hour12:false});
        row.append(rank,id,time);fragment.append(row);
      });$('history').replaceChildren(fragment);
    }
    $('save-status').textContent=dirty?'有未保存的更改 · 点击右上角保存进度':savedAt?(state.all.length?`已保存 ${new Date(savedAt).toLocaleString('zh-CN')} · 仅当前浏览器`:'当前是全新抽签 · 此浏览器有一份已保存进度'):'尚未保存 · 保存仅限当前设备、当前浏览器';
    $('restore').hidden=!savedAt;
    drawWheel();setNumber();updateButtons();
  }
  function start(){
    if(spinning||importing||!state.remaining.length)return;
    spinning=true;const pool=[...state.remaining],index=L.randomIndex(pool.length),startAngle=state.angle;
    const offset=.25+L.randomIndex(10001)/20000,target=L.targetAngle(startAngle,index,pool.length,7,offset),duration=5600+L.randomIndex(1201);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    drawWheel(pool);document.querySelector('.display').classList.remove('winner');$('wheel-sub').textContent=`${pool.length} 个等面积格子`;
    $('display-label').textContent='当前编号';$('phase').textContent=reduced?'抽签中，请稍候…':'转盘转动中…';updateButtons();
    let started=null;
    function frame(now){
      if(started===null)started=now;
      const t=Math.min((now-started)/duration,1);
      // Integral of an acceleration/deceleration curve: zero velocity at both ends.
      const progress=1-Math.pow(1-t,4)*(1+4*t),angle=startAngle+(target-startAngle)*progress;
      if(!reduced){canvas.style.transform=`rotate(${angle}rad)`;setNumber(angle,pool);}
      if(t<1){requestAnimationFrame(frame);return;}
      state=L.finish(state,pool,index,target);spinning=false;dirty=true;render();
      $('number').textContent=state.pending;lastTick=state.pending;
      toast(`本轮抽中：${state.pending}`);
    }
    requestAnimationFrame(frame);
  }
  $('draw').addEventListener('click',start);
  $('undo').addEventListener('click',()=>{if(spinning||!state.canUndo)return;state=L.undo(state);dirty=true;render();toast('已撤销本轮，编号已回到转盘。');});
  $('save').addEventListener('click',()=>{
    if(spinning||!state.all.length)return;
    try{const at=new Date().toISOString();localStorage.setItem(storageKey,JSON.stringify({state,savedAt:at}));savedAt=at;dirty=false;render();toast('进度已保存，下次可点击“恢复已保存进度”继续。');}
    catch{toast('保存失败：浏览器存储不可用或空间不足，请检查浏览器设置。');}
  });
  function restore(){
    try{const saved=JSON.parse(localStorage.getItem(storageKey));state=L.validate(saved.state);savedAt=saved.savedAt;dirty=false;render();toast('已恢复保存的抽签进度。');}
    catch{toast('存档不可用，请重新导入名单。');}
  }
  $('restore').addEventListener('click',()=>{if(spinning||importing)return;if(state.all.length)$('restore-dialog').showModal();else restore();});
  $('restore-dialog').addEventListener('close',()=>{if($('restore-dialog').returnValue==='confirm')restore();});
  function demo(){state=L.fresh(Array.from({length:30},(_,i)=>String(2026000001+i)),'示例名单 · 30 个编号');dirty=true;render();toast('已载入示例名单，可直接开始抽签。');}
  $('demo').addEventListener('click',()=>{if(spinning)return;if(state.all.length)$('replace-dialog').showModal();else demo();});
  $('replace-dialog').addEventListener('close',()=>{if($('replace-dialog').returnValue==='confirm')demo();});
  $('upload').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',e=>{if(e.target.files[0])loadFile(e.target.files[0]);e.target.value='';});
  for(const event of ['dragenter','dragover'])$('upload').addEventListener(event,e=>{e.preventDefault();if(!spinning)$('upload').classList.add('drag');});
  for(const event of ['dragleave','drop'])$('upload').addEventListener(event,e=>{e.preventDefault();$('upload').classList.remove('drag');});
  $('upload').addEventListener('drop',e=>{if(!spinning&&!importing&&e.dataTransfer.files[0])loadFile(e.dataTransfer.files[0]);});
  function rowsForSheet(){return XLSX.utils.sheet_to_json(workbook.Sheets[$('sheet').value],{header:1,raw:false,defval:'',blankrows:true});}
  function selectSheet(){
    const rows=rowsForSheet(),count=Math.max(1,...rows.slice(0,100).map(r=>r.length));
    $('column').replaceChildren();let best=0,bestCount=-1;
    for(let i=0;i<count;i++){
      const label=XLSX.utils.encode_col(i),first=String(rows[0]?.[i]??'').slice(0,24),opt=new Option(`${label} 列${first?' · '+first:''}`,String(i));$('column').append(opt);
      const valid=L.parseValues(rows.map(row=>row[i])).ids.length;if(valid>bestCount){best=i;bestCount=valid;}
    }
    $('column').value=String(best);previewImport();
  }
  function previewImport(){
    parsed=L.parseValues(rowsForSheet().map(row=>row[Number($('column').value)]));
    $('import-summary').textContent=`有效编号 ${parsed.ids.length} 个 · 重复 ${parsed.duplicates} 个 · 格式不符 ${parsed.invalid.length} 个`;
    $('confirm-import').disabled=!parsed.ids.length||parsed.ids.length>10000;
    $('confirm-import').textContent=parsed.invalid.length?'仅导入有效编号':'确认导入';
    const preview=parsed.ids.slice(0,8).join('  ')+(parsed.ids.length>8?' …':'');
    const errors=parsed.invalid.slice(0,5).map(x=>`第 ${x.row} 行：${x.value.slice(0,40)}`).join('\n');
    $('import-preview').textContent=preview+(errors?'\n\n以下内容将跳过：\n'+errors:'')+(parsed.ids.length>10000?'\n单份名单最多支持 10,000 个编号。':'');
  }
  async function loadFile(file){
    if(spinning||importing)return;
    if(!/\.(xlsx|xls|csv)$/i.test(file.name)){toast('请选择 .xlsx、.xls 或 .csv 文件。');return;}
    if(file.size>20*1024*1024){toast('文件超过 20 MB，请仅保留需要抽签的编号后重试。');return;}
    importing=true;updateButtons();
    try{
      const buffer=await file.arrayBuffer();
      workbook=/\.csv$/i.test(file.name)?XLSX.read(new TextDecoder('utf-8').decode(buffer),{type:'string',raw:true}):XLSX.read(buffer,{type:'array',cellText:true,sheetRows:100002});
      if(!workbook.SheetNames.length)throw Error('文件没有工作表');
      $('sheet').replaceChildren(...workbook.SheetNames.map(name=>new Option(name,name)));importName=file.name;selectSheet();$('import-dialog').showModal();
    }catch(error){toast('无法读取文件，请确认文件未加密，且为有效的 Excel 或 UTF-8 CSV 文件。');}
    finally{importing=false;updateButtons();}
  }
  $('sheet').addEventListener('change',selectSheet);$('column').addEventListener('change',previewImport);
  $('confirm-import').addEventListener('click',()=>{
    if(!parsed?.ids.length||parsed.ids.length>10000)return;
    state=L.fresh(parsed.ids,`${importName} · ${$('sheet').value} · ${XLSX.utils.encode_col(Number($('column').value))} 列`);
    dirty=true;$('import-dialog').close();render();toast(`成功导入 ${state.all.length} 个编号。`);workbook=null;
  });
  window.addEventListener('beforeunload',e=>{if(dirty||spinning){e.preventDefault();e.returnValue='';}});
  try{
    const raw=localStorage.getItem(storageKey);
    if(raw){const saved=JSON.parse(raw);L.validate(saved.state);savedAt=saved.savedAt;}
  }catch{toast('无法恢复保存的进度，请重新导入名单。');}
  render();
})();
