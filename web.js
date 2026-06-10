// ============================================================
// PLATE LOOKUP PRO - Web Application JS
// ============================================================
const PLATE_REGEX=/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/i;
const INDIAN_STATE_CODES=['MH','DL','RJ','KA','TN','UP','GJ','AP','BR','CG','GA','HR','HP','JH','JK','KL','LA','MP','MN','ML','MZ','NL','OD','PB','SK','TR','UK','WB','AN','CH','DN','DD','LD','PY'];
let currentUser=null,currentRecord=null,activeMode='image';
let parkingBlob=null,parkingRecorder=null,parkingChunks=[],parkingTimerInterval=null,parkingSeconds=0,isVoiceRecording=false,parkingAudioPlayer=null;
let _recFilter='all',_recSearch='';

// SEARCH HISTORY
function getSearchHistory(){try{return JSON.parse(localStorage.getItem('SEARCH_HISTORY'))||[];}catch{return[];}}
function addToSearchHistory(n){let h=getSearchHistory();h=h.filter(x=>x!==n);h.unshift(n);if(h.length>5)h.pop();localStorage.setItem('SEARCH_HISTORY',JSON.stringify(h));updateHistoryUI();}
function updateHistoryUI(){
  const h=getSearchHistory(),c=document.getElementById('history-chips'),w=document.getElementById('search-history-container');
  if(!c||!w)return;
  if(!h.length){w.style.display='none';return;}
  w.style.display='block';
  c.innerHTML=h.map(x=>`<div class="chip" onclick="doSearch('${x}')"><i class="fa-solid fa-clock-rotate-left"></i>${x}</div>`).join('');
}
updateHistoryUI();

// SAMPLE PLATES
function initSamples(){
  const g=document.getElementById('samples-grid');
  if(!g)return;
  const samples=(typeof CAR_DATASET!=='undefined'?CAR_DATASET:[]).slice(0,10);
  g.innerHTML=samples.map(c=>`<div class="sample-plate" onclick="doSearch('${c.number}')">${c.number}</div>`).join('');
}
document.addEventListener('DOMContentLoaded',initSamples);

// VALIDATION
const manualInput=document.getElementById('manual-input');
if(manualInput){manualInput.addEventListener('input',e=>{
  const v=e.target.value.trim().replace(/[-\s]/g,'');
  document.getElementById('validation-warning').style.display=(v.length>3&&!PLATE_REGEX.test(v))?'block':'none';
});}

// PLATE NORMALIZE & EXTRACT
function normalizeNumber(t){if(!t)return'';return t.toUpperCase().replace(/O/g,'0').replace(/Q/g,'0').replace(/I/g,'1').replace(/L/g,'1').replace(/Z/g,'2').replace(/S/g,'5').replace(/B/g,'8').replace(/G/g,'6').replace(/[^A-Z0-9]/g,'');}
const PLATE_RE=/[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}/;
function extractPlateFromText(text){
  if(!text)return'';
  const norm=normalizeNumber(text);
  const allM=[];let m;const re=/[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}/g;
  while((m=re.exec(norm))!==null)allM.push(m[0]);
  const pref=allM.find(p=>INDIAN_STATE_CODES.includes(p.substring(0,2)));
  if(pref)return pref;if(allM.length)return allM[0];
  const lines=text.split(/[\n\r]+/);
  for(const l of lines){const mm=normalizeNumber(l).match(PLATE_RE);if(mm)return mm[0];}
  const tokens=text.toUpperCase().replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
  for(let i=0;i<tokens.length;i++){const j=tokens.slice(i,i+4).join('');const mm=normalizeNumber(j).match(PLATE_RE);if(mm&&INDIAN_STATE_CODES.includes(mm[0].substring(0,2)))return mm[0];}
  return'';
}

// DETERMINISTIC CAR GENERATION
function generateDeterministicCar(number){
  if(!number)return null;
  const n=number.toUpperCase();
  const sc=n.substring(0,2);
  const states={MH:'Maharashtra',DL:'Delhi',RJ:'Rajasthan',KA:'Karnataka',TN:'Tamil Nadu',UP:'Uttar Pradesh',GJ:'Gujarat',HR:'Haryana',PB:'Punjab',WB:'West Bengal'};
  const stateName=states[sc]||'India';
  let hash=0;for(let i=0;i<n.length;i++)hash=n.charCodeAt(i)+((hash<<5)-hash);hash=Math.abs(hash);
  const fN=['Rajesh','Amit','Priya','Sneha','Vikram','Rohan','Suresh','Ramesh','Pooja','Neha'];
  const lN=['Sharma','Verma','Patil','Deshmukh','Singh','Yadav','Gupta','Jadhav','Iyer','Kumar'];
  const models=['Hyundai Creta','Maruti Swift','Honda City','Tata Nexon','Kia Seltos','Mahindra Thar','Toyota Innova','Tata Harrier'];
  const colors=['White','Silver','Black','Red','Blue','Grey','Brown'];
  return{number:n,ownerName:`${fN[hash%fN.length]} ${lN[(hash>>1)%lN.length]}`,carModel:models[(hash>>2)%models.length],color:colors[(hash>>3)%colors.length],year:2010+((hash>>4)%15),phone:'+91 '+(9000000000+(hash%1000000000)),state:stateName};
}

// RESULT RENDERING
function setResultState(html){const r=document.getElementById('result');if(r)r.innerHTML=html;}
function setResultNotFound(msg='No record found.',icon='fa-triangle-exclamation'){
  setResultState(`<div class="empty-state"><i class="fa-solid ${icon} empty-icon"></i><p>${msg}</p></div>`);
}
function setLoadingState(){setResultState(`<div class="empty-state"><i class="fa-solid fa-spinner spinner empty-icon" style="color:#60a5fa"></i><p>Searching database...</p></div>`);}

function getZoneIcon(zone){
  if(!zone)return'<i class="fa-solid fa-square-parking"></i>';
  const z=zone.toLowerCase();
  if(z.includes('faculty'))return'<i class="fa-solid fa-chalkboard-user"></i>';
  if(z.includes('student'))return'<i class="fa-solid fa-graduation-cap"></i>';
  if(z.includes('visitor'))return'<i class="fa-solid fa-person-walking"></i>';
  if(z.includes('staff'))return'<i class="fa-solid fa-user-tie"></i>';
  return'<i class="fa-solid fa-square-parking"></i>';
}

function renderRecord(record){
  if(!record){setResultNotFound();return;}
  currentRecord=record;
  if(parkingAudioPlayer){try{parkingAudioPlayer.pause();}catch(e){}parkingAudioPlayer=null;}
  if(parkingRecorder&&isVoiceRecording){try{parkingRecorder.stop();}catch(e){}}
  clearInterval(parkingTimerInterval);parkingBlob=null;parkingChunks=[];isVoiceRecording=false;
  const adminCtrl=(currentUser&&currentUser.role==='admin')?`<div class="admin-actions"><button onclick="handleDelete('${record.number}')" class="btn fw" style="background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3)"><i class="fa-solid fa-trash-can"></i> Delete Record</button></div>`:'';
  const zoneHtml=record.parkingZone?`<div class="parking-zone-banner"><div class="zone-banner-icon">${getZoneIcon(record.parkingZone)}</div><div class="zone-banner-text"><span class="zone-banner-label">Assigned Zone</span><span class="zone-banner-value">${record.parkingZone} Parking</span></div><div class="zone-banner-badge">${record.parkingZone.toUpperCase()}</div></div>`:'';
  const altHtml=record.altPhone?`<div class="detail-item"><div class="detail-label">Alt. Number</div><div class="detail-value" style="color:#a78bfa">${record.altPhone}</div></div>`:'';
  setResultState(`<div class="record-layout">
    <div class="record-title">${record.number}<span class="record-state"><i class="fa-solid fa-map-location-dot"></i> ${record.state||'India'}</span></div>
    <div class="record-grid">
      <div class="detail-item"><div class="detail-label">Owner</div><div class="detail-value">${record.ownerName}</div></div>
      <div class="detail-item"><div class="detail-label">Model</div><div class="detail-value">${record.carModel} <span style="color:#94a3b8;font-size:.85em">(${record.year||'N/A'})</span></div></div>
      <div class="detail-item"><div class="detail-label">Color</div><div class="detail-value">${record.color}</div></div>
      <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value" id="owner-phone-display">${record.phone||'N/A'}</div></div>
      ${altHtml}
    </div>
    ${zoneHtml}
    <div class="action-bar">
      <button class="action-btn call-btn" onclick="callOwner()"><i class="fa-solid fa-phone"></i><span>Call</span></button>
      <button class="action-btn copy-btn" onclick="navigator.clipboard.writeText('${record.number}').then(()=>showToast('Copied!',true))"><i class="fa-solid fa-copy"></i><span>Copy</span></button>
      <button class="action-btn share-btn" onclick="shareRecord('${record.number}','${record.ownerName}')"><i class="fa-solid fa-share-nodes"></i><span>Share</span></button>
    </div>
    ${adminCtrl}
    <div class="parking-alert-section">
      <div class="parking-alert-header">
        <div class="parking-alert-badge"><i class="fa-solid fa-triangle-exclamation"></i><span>Parking Violation Alert</span></div>
        <span class="parking-badge-tag">GUARD TOOL</span>
      </div>
      <div class="voice-recorder-panel">
        <div class="rec-status-row"><i class="fa-solid fa-microphone" id="rec-icon"></i><span id="rec-status-text">Record voice message for owner</span><span id="rec-timer" class="rec-timer">00:00</span></div>
        <div class="waveform-container" id="waveform-container">${'<div class="waveform-bar"></div>'.repeat(10)}</div>
        <div class="recorder-btn-row">
          <button id="btn-record-voice" class="btn-voice-record"><i class="fa-solid fa-microphone"></i><span>Record</span></button>
          <button id="btn-play-voice" class="btn-voice-play" style="display:none"><i class="fa-solid fa-play"></i><span>Play</span></button>
          <button id="btn-send-voice" class="btn-voice-send" style="display:none"><i class="fa-solid fa-paper-plane"></i><span>Share</span></button>
        </div>
      </div>
      <div class="parking-quick-actions">
        <button class="parking-action-btn wa-btn" onclick="sendWhatsAppAlert()"><i class="fa-brands fa-whatsapp"></i><span>WhatsApp</span></button>
        <button class="parking-action-btn call-owner-btn" onclick="callOwner()"><i class="fa-solid fa-phone"></i><span>Call</span></button>
        <button class="parking-action-btn tts-btn" id="btn-tts-alert" onclick="playTTSAlert()"><i class="fa-solid fa-volume-high"></i><span>Speak Alert</span></button>
      </div>
    </div>
  </div>`);
  setTimeout(initParkingAlert,60);
}

window.handleDelete=function(number){
  if(confirm(`Delete ${number}?`)){
    if(typeof deleteLocalCar==='function'){
      if(deleteLocalCar(number)){showToast('Record deleted',true);setResultNotFound();}
      else showToast('Cannot delete built-in record',false);
    }
  }
};
window.shareRecord=function(num,owner){
  if(navigator.share){navigator.share({title:'Car Details',text:`Car ${num}  Owner: ${owner}`}).catch(()=>{});}
  else{navigator.clipboard.writeText(`Plate: ${num}, Owner: ${owner}`);showToast('Copied to clipboard',true);}
};
window.callOwner=function(){
  if(!currentRecord)return;
  const r=(currentRecord.phone||'').replace(/[^0-9+]/g,'');
  if(!r||r.length<7){showToast('No phone number available',false);return;}
  const tel=r.startsWith('+')?r:(r.startsWith('91')?'+'+r:'+91'+r);
  window.location.href='tel:'+tel;
};
window.sendWhatsAppAlert=async function(){
  if(!currentRecord)return;
  const raw=(currentRecord.phone||'').replace(/[^0-9]/g,'');
  const phone=raw.startsWith('91')?raw:'91'+raw;
  const num=currentRecord.number||'';const owner=currentRecord.ownerName||'Owner';
  if(parkingBlob){
    try{
      const ext=parkingBlob.type.includes('ogg')?'ogg':'webm';
      const f=new File([parkingBlob],`alert-${num}.${ext}`,{type:parkingBlob.type});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({title:`Parking Alert - ${num}`,text:`Parking Violation: Vehicle ${num} is illegally parked.`,files:[f]});return;}
    }catch(e){}
  }
  const msg=encodeURIComponent(`Parking Violation Notice\n\nDear ${owner},\nYour vehicle *${num}* is parked in a restricted zone.\nPlease move it immediately.\n\n Parking Guard System`);
  window.open(`https://wa.me/${phone}?text=${msg}`,'_blank');
};
window.playTTSAlert=function(){
  if(!currentRecord)return;
  if(!('speechSynthesis' in window)){showToast('TTS not supported',false);return;}
  const btn=document.getElementById('btn-tts-alert');
  if(window.speechSynthesis.speaking){window.speechSynthesis.cancel();if(btn){btn.innerHTML='<i class="fa-solid fa-volume-high"></i><span>Speak Alert</span>';btn.style.background='';}return;}
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(`Attention ${currentRecord.ownerName}. Your vehicle number ${(currentRecord.number||'').split('').join(' ')} is parked in a restricted zone. Please move your vehicle immediately.`);
  u.lang='en-IN';u.rate=.85;u.pitch=1;
  if(btn){btn.innerHTML='<i class="fa-solid fa-stop"></i><span>Stop</span>';btn.style.background='rgba(239,68,68,.3)';}
  u.onend=u.onerror=()=>{if(btn){btn.innerHTML='<i class="fa-solid fa-volume-high"></i><span>Speak Alert</span>';btn.style.background='';}};
  window.speechSynthesis.speak(u);
};

async function initParkingAlert(){
  const btnR=document.getElementById('btn-record-voice'),btnP=document.getElementById('btn-play-voice'),btnS=document.getElementById('btn-send-voice');
  const recSt=document.getElementById('rec-status-text'),recTm=document.getElementById('rec-timer'),recIco=document.getElementById('rec-icon'),wave=document.getElementById('waveform-container');
  if(!btnR)return;
  function updTimer(){parkingSeconds++;const m=String(Math.floor(parkingSeconds/60)).padStart(2,'0'),s=String(parkingSeconds%60).padStart(2,'0');if(recTm)recTm.textContent=`${m}:${s}`;if(parkingSeconds>=60)stopRec();}
  async function startRec(){
    try{
      const mic=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      parkingChunks=[];
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')?'audio/ogg;codecs=opus':'audio/webm';
      parkingRecorder=new MediaRecorder(mic,{mimeType:mime});
      parkingRecorder.ondataavailable=e=>{if(e.data&&e.data.size>0)parkingChunks.push(e.data);};
      parkingRecorder.onstop=()=>{
        mic.getTracks().forEach(t=>t.stop());
        parkingBlob=new Blob(parkingChunks,{type:mime});
        btnR.innerHTML='<i class="fa-solid fa-microphone"></i><span>Record Again</span>';btnR.classList.remove('recording');
        btnP.style.display='inline-flex';btnS.style.display='inline-flex';
        if(wave)wave.classList.remove('active');
        if(recIco){recIco.className='fa-solid fa-circle-check';recIco.style.color='#22c55e';}
        if(recSt)recSt.textContent=`Voice ready (${recTm?recTm.textContent:''})`;
        clearInterval(parkingTimerInterval);isVoiceRecording=false;
      };
      parkingRecorder.start(100);isVoiceRecording=true;parkingSeconds=0;
      if(recTm)recTm.textContent='00:00';
      parkingTimerInterval=setInterval(updTimer,1000);
      btnR.innerHTML='<i class="fa-solid fa-stop"></i><span>Stop</span>';btnR.classList.add('recording');
      btnP.style.display='none';btnS.style.display='none';
      if(wave)wave.classList.add('active');
      if(recIco){recIco.className='fa-solid fa-circle-dot';recIco.style.color='#ef4444';}
      if(recSt)recSt.textContent='Recording... (max 60s)';
      if(navigator.vibrate)navigator.vibrate(50);
    }catch(err){showToast('Microphone access denied',false);}
  }
  function stopRec(){if(parkingRecorder&&isVoiceRecording)parkingRecorder.stop();}
  btnR.addEventListener('click',()=>isVoiceRecording?stopRec():startRec());
  btnP.addEventListener('click',()=>{
    if(!parkingBlob)return;
    if(parkingAudioPlayer&&!parkingAudioPlayer.paused){parkingAudioPlayer.pause();parkingAudioPlayer.currentTime=0;btnP.innerHTML='<i class="fa-solid fa-play"></i><span>Play</span>';return;}
    const url=URL.createObjectURL(parkingBlob);parkingAudioPlayer=new Audio(url);parkingAudioPlayer.play();
    btnP.innerHTML='<i class="fa-solid fa-pause"></i><span>Pause</span>';
    parkingAudioPlayer.onended=()=>{btnP.innerHTML='<i class="fa-solid fa-play"></i><span>Play</span>';URL.revokeObjectURL(url);};
  });
  btnS.addEventListener('click',()=>sendWhatsAppAlert());
}

// SEARCH
async function searchAndDisplay(number){
  if(!number){
    setResultNotFound('Please provide a car number.');
    return;
  }

  setLoadingState();

  try{
    let found = null;

    if(typeof findLocalCar === 'function'){
      const l = findLocalCar(number);
      if(l && l.ownerName && l.ownerName !== 'Unknown')
        found = l;
    }

    if(!found || !found.state){
      setResultNotFound(`No records found for "${number}".`);
      return;
    }

    renderRecord(found);
    addToSearchHistory(normalizeNumber(found.number));

  } catch(e){
    setResultNotFound('Error searching database.');
  }
}
// OCR
let ocrImage=null;
function resetOcrUI(){
  const s=document.getElementById('ocr-status'),e=document.getElementById('extracted-number'),p=document.getElementById('ocr-progress-container'),f=document.getElementById('ocr-fallback-container');
  if(s)s.textContent='';if(e)e.textContent='';if(p)p.style.display='none';if(f)f.style.display='none';
  const pf=document.getElementById('ocr-progress-fill');if(pf){pf.style.width='0%';pf.style.background='';}
}
function showPreview(file){
  ocrImage=file;
  const pa=document.getElementById('preview-area'),uz=document.getElementById('upload-zone');
  if(!file){if(pa)pa.style.display='none';if(uz)uz.style.display='block';return;}
  const fn=document.getElementById('file-name');if(fn)fn.textContent=file.name||'Camera Image';
  const reader=new FileReader();
  reader.onload=e=>{
    const img=document.getElementById('img-preview');if(img)img.src=e.target.result;
    if(pa)pa.style.display='block';if(uz)uz.style.display='none';
    resetOcrUI();
  };
  reader.readAsDataURL(file);
}

document.getElementById('image-input')?.addEventListener('change',e=>showPreview(e.target.files[0]));
document.getElementById('camera-input')?.addEventListener('change',e=>{showPreview(e.target.files[0]);if(e.target.files[0])setTimeout(()=>document.getElementById('ocr-button')?.click(),500);});
document.getElementById('retake-btn')?.addEventListener('click',()=>{ocrImage=null;showPreview(null);resetOcrUI();});

// Drag and drop
const uz=document.getElementById('upload-zone');
if(uz){
  uz.addEventListener('dragover',e=>{e.preventDefault();uz.style.borderColor='rgba(59,130,246,.6)';uz.style.background='rgba(59,130,246,.08)';});
  uz.addEventListener('dragleave',()=>{uz.style.borderColor='';uz.style.background='';});
  uz.addEventListener('drop',e=>{e.preventDefault();uz.style.borderColor='';uz.style.background='';if(e.dataTransfer.files[0])showPreview(e.dataTransfer.files[0]);});
}

function generateOcrVariants(src){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      const variants=[];
      function mc(sx,sy,sw,sh,ow){const c=document.createElement('canvas'),oh=Math.round(sh/sw*ow);c.width=ow;c.height=oh;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,sx,sy,sw,sh,0,0,ow,oh);return{c,ctx};}
      {const{c,ctx}=mc(0,0,img.width,img.height,1400);const d=ctx.getImageData(0,0,c.width,c.height),px=d.data;for(let i=0;i<px.length;i+=4){let g=.299*px[i]+.587*px[i+1]+.114*px[i+2];g=Math.min(255,Math.max(0,(g-128)*2+128));px[i]=px[i+1]=px[i+2]=g;}ctx.putImageData(d,0,0);variants.push({url:c.toDataURL('image/jpeg',.95),label:'gray_full'});}
      {const cw=img.width*.85,ch=img.height*.5,sx=(img.width-cw)/2,sy=(img.height-ch)/2;const{c,ctx}=mc(sx,sy,cw,ch,1200);const d=ctx.getImageData(0,0,c.width,c.height),px=d.data;let sum=0;for(let i=0;i<px.length;i+=4)sum+=.299*px[i]+.587*px[i+1]+.114*px[i+2];const thr=Math.min(200,Math.max(80,sum/(px.length/4)*.85));for(let i=0;i<px.length;i+=4){let g=.299*px[i]+.587*px[i+1]+.114*px[i+2];g=Math.min(255,Math.max(0,(g-128)*2.2+128));const b=g>=thr?255:0;px[i]=px[i+1]=px[i+2]=b;}ctx.putImageData(d,0,0);variants.push({url:c.toDataURL('image/jpeg',.95),label:'binary_crop'});}
      {const{c}=mc(0,0,img.width,img.height,1600);variants.push({url:c.toDataURL('image/jpeg',.92),label:'raw_full'});}
      res(variants);
    };img.onerror=rej;img.src=src;
  });
}

async function runTesseract(worker,url,psm){
  await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',tessedit_pageseg_mode:String(psm)});
  const{data}=await worker.recognize(url);return{text:data.text||'',confidence:data.confidence||0};
}

document.getElementById('ocr-button')?.addEventListener('click',async()=>{
  if(!ocrImage)return;
  const ocrBtn=document.getElementById('ocr-button');
  ocrBtn.disabled=true;resetOcrUI();
  const ocrSt=document.getElementById('ocr-status'),pCont=document.getElementById('ocr-progress-container'),pFill=document.getElementById('ocr-progress-fill'),pTxt=document.getElementById('ocr-progress-text'),extNum=document.getElementById('extracted-number'),fbCont=document.getElementById('ocr-fallback-container'),fbInp=document.getElementById('ocr-fallback-input');
  if(ocrSt)ocrSt.innerHTML='<i class="fa-solid fa-spinner spinner"></i> Loading OCR engine...';
  if(pCont)pCont.style.display='block';if(pFill)pFill.style.width='5%';
  let worker=null;
  try{
    worker=await Tesseract.createWorker('eng',1,{logger:m=>{if(m.status==='recognizing text'&&pFill&&pTxt){const p=20+Math.round(m.progress*60);pFill.style.width=p+'%';pTxt.textContent='Analyzing... '+p+'%';}}});
    if(ocrSt)ocrSt.innerHTML='<i class="fa-solid fa-spinner spinner"></i> Preprocessing...';
    if(pFill)pFill.style.width='15%';
    const reader=new FileReader();
    const imgData=await new Promise(res=>{reader.onload=e=>res(e.target.result);reader.readAsDataURL(ocrImage);});
    const variants=await generateOcrVariants(imgData);
    if(pFill)pFill.style.width='20%';if(ocrSt)ocrSt.innerHTML='<i class="fa-solid fa-spinner spinner"></i> Multi-pass scanning...';
    const psms=[6,7,8,11];let best='',bestConf=0,allRaw=[];let pc=0;const total=variants.length*psms.length;
    for(const v of variants){
      for(const psm of psms){
        try{const{text,confidence}=await runTesseract(worker,v.url,psm);pc++;const pct=20+Math.round(pc/total*70);if(pFill)pFill.style.width=pct+'%';if(pTxt)pTxt.textContent=`Pass ${pc}/${total}... ${pct}%`;if(text.trim())allRaw.push(text.trim());const ext=extractPlateFromText(text);if(ext){const has=INDIAN_STATE_CODES.includes(ext.substring(0,2));const sc=confidence+(has?50:0);if(sc>bestConf||!best){best=ext;bestConf=sc;}if(has&&confidence>70)break;}}catch(e){}
      }
      if(best&&INDIAN_STATE_CODES.includes(best.substring(0,2))&&bestConf>100)break;
    }
    await worker.terminate();worker=null;
    if(pFill){pFill.style.width='100%';pFill.style.background=best?'linear-gradient(90deg,#10b981,#34d399)':'linear-gradient(90deg,#f59e0b,#fb923c)';}
    if(pTxt)pTxt.textContent=best?`Plate detected (${Math.round(bestConf)}% score)!`:'Could not auto-detect.';
    setTimeout(()=>{if(pCont)pCont.style.display='none';},2500);
    if(best){
      if(extNum)extNum.innerHTML=`<span style="color:#34d399">Plate: <strong>${best}</strong></span>`;
      if(ocrSt)ocrSt.innerHTML='';
      if(fbInp)fbInp.value=best;if(fbCont)fbCont.style.display='block';
      await searchAndDisplay(best);
    }else{
      const raw=allRaw.slice(0,3).join(' | ').substring(0,120);
      if(extNum)extNum.innerHTML=`<span style="color:#94a3b8;font-size:.8rem">Raw OCR: "${raw||'nothing detected'}"</span>`;
      if(ocrSt)ocrSt.innerHTML='<span style="color:#f59e0b">Auto-detection failed. Enter plate manually:</span>';
      if(fbCont)fbCont.style.display='block';if(fbInp){fbInp.value='';fbInp.focus();}
    }
  }catch(err){
    if(worker){try{await worker.terminate();}catch(e){}}
    const ocrSt2=document.getElementById('ocr-status');
    if(ocrSt2)ocrSt2.innerHTML=`<span style="color:#f87171">OCR error: ${err.message}</span>`;
    const pCont2=document.getElementById('ocr-progress-container');if(pCont2)pCont2.style.display='none';
    const fbCont2=document.getElementById('ocr-fallback-container');if(fbCont2)fbCont2.style.display='block';
  }finally{ocrBtn.disabled=false;}
});
document.getElementById('ocr-fallback-btn')?.addEventListener('click',()=>{const v=document.getElementById('ocr-fallback-input')?.value.trim();if(v)searchAndDisplay(v);});
document.getElementById('manual-search-button')?.addEventListener('click',()=>{const v=document.getElementById('manual-input')?.value.trim();if(!v){showToast('Please enter a car number',false);return;}searchAndDisplay(v);});
document.getElementById('manual-input')?.addEventListener('keyup',e=>{if(e.key==='Enter')document.getElementById('manual-search-button')?.click();});

// MODES
function setActiveMode(mode){
  activeMode=mode;
  const panels={image:'panel-image',number:'panel-number',add:'panel-add',records:'panel-records'};
  Object.entries(panels).forEach(([m,id])=>{const el=document.getElementById(id);if(el)el.style.display=m===mode?'block':'none';});
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')===mode));
  document.querySelectorAll('.mob-tab').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')===mode));
  if(mode==='records')setTimeout(refreshRecords,80);
  else if(mode==='number'){const mi=document.getElementById('manual-input');if(mi)setTimeout(()=>mi.focus(),100);}
}
document.querySelectorAll('.nav-item,.mob-tab').forEach(b=>b.addEventListener('click',()=>setActiveMode(b.getAttribute('data-mode'))));

// ZONE SELECTOR
window.selectZone=function(zone){
  const h=document.getElementById('add-zone'),cu=document.getElementById('add-zone-custom');
  if(h)h.value=zone;if(cu)cu.value='';
  document.querySelectorAll('#zone-btn-group .zone-btn').forEach(b=>b.classList.toggle('zone-btn-active',b.getAttribute('data-zone')===zone));
};
document.getElementById('add-zone-custom')?.addEventListener('input',e=>{
  if(e.target.value.trim()){const h=document.getElementById('add-zone');if(h)h.value=e.target.value.trim();document.querySelectorAll('#zone-btn-group .zone-btn').forEach(b=>b.classList.remove('zone-btn-active'));}
});

// ADD RECORD
document.getElementById('add-btn')?.addEventListener('click',async()=>{
  const num=(document.getElementById('add-number')?.value||'').trim().toUpperCase();
  const owner=(document.getElementById('add-owner')?.value||'').trim();
  const model=(document.getElementById('add-model')?.value||'').trim();
  const color=(document.getElementById('add-color')?.value||'').trim();
  const phone=(document.getElementById('add-phone')?.value||'').trim();
  const alt=(document.getElementById('add-alt-phone')?.value||'').trim();
  const zoneH=document.getElementById('add-zone'),zoneCu=document.getElementById('add-zone-custom');
  const zone=(zoneCu&&zoneCu.value.trim())?zoneCu.value.trim():(zoneH?zoneH.value.trim():'');
  const st=document.getElementById('add-status');
  if(!num||!owner){if(st){st.innerHTML='<span style="color:#f87171">Plate number and owner are required.</span>';}return;}
  const car={number:num,ownerName:owner,carModel:model||'Unknown',color:color||'Unknown',phone:phone||'Unknown',altPhone:alt||'',parkingZone:zone||'',_source:'custom'};
  try{
    const ex=localStorage.getItem('CUSTOM_CARS'),cars=ex?JSON.parse(ex):[];
    const di=cars.findIndex(c=>c.number.toUpperCase().replace(/[^A-Z0-9]/g,'')===num.replace(/[^A-Z0-9]/g,''));
    if(di>=0)cars[di]=car;else cars.push(car);
    localStorage.setItem('CUSTOM_CARS',JSON.stringify(cars));
    if(st)st.innerHTML=`<span style="color:#34d399">Saved: ${num}${zone?' · '+zone+' Zone':''}</span>`;
    ['add-number','add-owner','add-model','add-color','add-phone','add-alt-phone'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    if(zoneH)zoneH.value='';if(zoneCu)zoneCu.value='';
    document.querySelectorAll('#zone-btn-group .zone-btn').forEach(b=>b.classList.remove('zone-btn-active'));
    setTimeout(()=>{if(st)st.textContent='';},3000);
    showToast('Record saved!',true);
  }catch(e){if(st)st.innerHTML='<span style="color:#f87171">Error saving data.</span>';}
});

// LOGIN
const loginOverlay=document.getElementById('login-overlay');
document.querySelectorAll('.ltab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.ltab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  document.getElementById('form-user').style.display=t.id==='tab-user'?'flex':'none';
  document.getElementById('form-staff').style.display=t.id==='tab-staff'?'flex':'none';
  document.getElementById('form-admin').style.display=t.id==='tab-admin'?'flex':'none';
  document.getElementById('login-message').textContent='';
}));

function setupUIForRole(role){
  const navAdd=document.getElementById('nav-add'),navRec=document.getElementById('nav-records'),mobAdd=document.getElementById('mob-add'),mobRec=document.getElementById('mob-records'),park=document.getElementById('parking-portal-btn'),chip=document.getElementById('user-chip'),nameL=document.getElementById('user-name-lbl'),roleL=document.getElementById('user-role-lbl');
  const isPriv=role==='admin'||role==='staff'||role==='guard';
  if(navAdd)navAdd.style.display=isPriv?'flex':'none';if(navRec)navRec.style.display=isPriv?'flex':'none';
  if(mobAdd)mobAdd.style.display=isPriv?'flex':'none';if(mobRec)mobRec.style.display=isPriv?'flex':'none';
  if(park)park.style.display=isPriv?'flex':'none';
  if(chip)chip.style.display='flex';
  if(nameL)nameL.textContent=currentUser.name;
  if(roleL){roleL.textContent=role.charAt(0).toUpperCase()+role.slice(1);roleL.style.color=role==='admin'?'#f87171':role==='staff'||role==='guard'?'#34d399':'#94a3b8';}
  const lBtn=document.getElementById('logout-btn'),mlBtn=document.getElementById('mob-logout-btn');
  if(lBtn)lBtn.style.display='flex';if(mlBtn)mlBtn.style.display='block';
}

document.getElementById('btn-user-login')?.addEventListener('click',()=>{
  const n=(document.getElementById('login-username')?.value||'').trim();
  if(!n){document.getElementById('login-message').textContent='Please enter your name';return;}
  currentUser={name:n,role:'user'};setupUIForRole('user');
  loginOverlay.style.opacity='0';setTimeout(()=>loginOverlay.style.display='none',300);
});
document.getElementById('btn-staff-login')?.addEventListener('click',()=>{
  const id=(document.getElementById('login-staff-id')?.value||'').trim().toUpperCase();
  const pass=(document.getElementById('login-staff-pass')?.value||'');
  const msg=document.getElementById('login-message');
  if(!id||!pass){msg.textContent='Enter ID and password';return;}
  if(typeof findGuard==='function'){
    const g=findGuard(id,pass);
    if(g){
      currentUser={name:g.name,role:(g.role||'staff').toLowerCase()};
      if(typeof setGuardSession==='function')setGuardSession(g);
      setupUIForRole(currentUser.role);loginOverlay.style.opacity='0';setTimeout(()=>loginOverlay.style.display='none',300);
    }else msg.textContent='Invalid Staff ID or password';
  }else msg.textContent='Authentication system error';
});
document.getElementById('btn-admin-login')?.addEventListener('click',()=>{
  const pass=(document.getElementById('login-password')?.value||'').trim();
  const msg=document.getElementById('login-message');
  if(pass==='admin123'){
    currentUser={name:'Administrator',role:'admin'};
    if(typeof setGuardSession==='function')setGuardSession({id:'ADMIN',name:'Administrator',role:'ADMIN'});
    setupUIForRole('admin');loginOverlay.style.opacity='0';setTimeout(()=>loginOverlay.style.display='none',300);
  }else msg.textContent='Incorrect password';
});
function logout(){
  if(typeof clearGuardSession==='function')clearGuardSession();
  currentUser=null;
  ['nav-add','nav-records','mob-add','mob-records','parking-portal-btn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';});
  const chip=document.getElementById('user-chip');if(chip)chip.style.display='none';
  const lBtn=document.getElementById('logout-btn');if(lBtn)lBtn.style.display='none';
  const mlBtn=document.getElementById('mob-logout-btn');if(mlBtn)mlBtn.style.display='none';
  loginOverlay.style.display='flex';setTimeout(()=>loginOverlay.style.opacity='1',10);
  setResultNotFound('No query submitted yet.','fa-magnifying-glass');
  setActiveMode('image');
  document.getElementById('login-username').value='';document.getElementById('login-staff-id').value='';document.getElementById('login-staff-pass').value='';document.getElementById('login-password').value='';document.getElementById('login-message').textContent='';
}
document.getElementById('logout-btn')?.addEventListener('click',logout);
document.getElementById('mob-logout-btn')?.addEventListener('click',logout);

// MOBILE SIDEBAR
document.getElementById('hamburger-btn')?.addEventListener('click',()=>{const sb=document.getElementById('sidebar');sb.classList.toggle('open');});
document.addEventListener('click',e=>{
  const sb=document.getElementById('sidebar'),ham=document.getElementById('hamburger-btn');
  if(sb&&sb.classList.contains('open')&&!sb.contains(e.target)&&!ham.contains(e.target))sb.classList.remove('open');
});

// RECORDS PORTAL
function getAllRecords(){
  const bi=(typeof CAR_DATASET!=='undefined'?CAR_DATASET:[]).map(c=>({...c,_source:'builtin'}));
  let cu=[];try{const r=localStorage.getItem('CUSTOM_CARS');if(r)cu=JSON.parse(r).map(c=>({...c,_source:'custom'}));}catch(e){}
  return[...cu,...bi];
}
function saveEditedRecord(orig,data){
  try{
    const r=localStorage.getItem('CUSTOM_CARS');let cars=r?JSON.parse(r):[];
    const normO=orig.toUpperCase().replace(/[^A-Z0-9]/g,'');
    const idx=cars.findIndex(c=>c.number.toUpperCase().replace(/[^A-Z0-9]/g,'')===normO);
    if(idx>=0)cars[idx]={...cars[idx],...data,_source:'custom'};else cars.push({...data,_source:'custom'});
    localStorage.setItem('CUSTOM_CARS',JSON.stringify(cars));return true;
  }catch(e){return false;}
}
window.deleteFromPortal=function(number){
  if(!confirm(`Delete record for "${number}"?`))return;
  const norm=number.toUpperCase().replace(/[^A-Z0-9]/g,'');
  try{const r=localStorage.getItem('CUSTOM_CARS');let cars=r?JSON.parse(r):[];cars=cars.filter(c=>c.number.toUpperCase().replace(/[^A-Z0-9]/g,'')!==norm);localStorage.setItem('CUSTOM_CARS',JSON.stringify(cars));refreshRecords();showToast('Record deleted',true);}catch(e){}
};
window.openEditModal=function(number){
  const all=getAllRecords();const rec=all.find(r=>r.number.toUpperCase().replace(/[^A-Z0-9]/g,'')==number.toUpperCase().replace(/[^A-Z0-9]/g,''));
  if(!rec)return;
  const cur=rec.parkingZone||'';const zones=['Faculty','Student','Visitor','Staff'];
  const zBtns=zones.map(z=>`<button type="button" onclick="_editZoneSelect(this,'${z}')" data-zone="${z}" class="zone-btn zone-${z.toLowerCase()}${cur===z?' zone-btn-active':''}">${z}</button>`).join('');
  openModal(`Edit: ${rec.number}`,`<div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
    <div><label class="fl">Plate</label><input id="edit-number" class="form-input" value="${rec.number}" ${rec._source==='custom'?'':'readonly style="opacity:.6"'} style="margin-top:4px"/></div>
    <div><label class="fl">Owner</label><input id="edit-owner" class="form-input" value="${rec.ownerName||''}" style="margin-top:4px"/></div>
    <div><label class="fl">Model</label><input id="edit-model" class="form-input" value="${rec.carModel||''}" style="margin-top:4px"/></div>
    <div><label class="fl">Color</label><input id="edit-color" class="form-input" value="${rec.color||''}" style="margin-top:4px"/></div>
    <div><label class="fl">Phone</label><input id="edit-phone" class="form-input" value="${rec.phone||''}" style="margin-top:4px"/></div>
    <div><label class="fl" style="color:#a78bfa">Alt Number</label><input id="edit-alt-phone" class="form-input" value="${rec.altPhone||''}" style="margin-top:4px;border-color:rgba(167,139,250,.3)"/></div>
    <div><label class="fl">Zone</label><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${zBtns}</div><input id="edit-zone" class="form-input" value="${cur}" placeholder="Custom zone..."/></div>
    ${rec._source!=='custom'?'<p style="font-size:.78rem;color:#f59e0b"><i class="fa-solid fa-triangle-exclamation"></i> Built-in: edits saved as custom override.</p>':''}
    <div id="edit-save-status"></div>
    <button onclick="commitEdit('${rec.number}')" class="btn primary fw"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
  </div>`);
};
window._editZoneSelect=function(btn,zone){
  document.querySelectorAll('.modal-box .zone-btn').forEach(b=>b.classList.remove('zone-btn-active'));
  btn.classList.add('zone-btn-active');const zi=document.getElementById('edit-zone');if(zi)zi.value=zone;
};
window.commitEdit=function(orig){
  const num=(document.getElementById('edit-number')?.value||'').trim().toUpperCase();
  const owner=(document.getElementById('edit-owner')?.value||'').trim();
  const st=document.getElementById('edit-save-status');
  if(!num||!owner){if(st)st.innerHTML='<span style="color:#f87171">Number and Owner required.</span>';return;}
  const ok=saveEditedRecord(orig,{number:num,ownerName:owner,carModel:(document.getElementById('edit-model')?.value||'').trim(),color:(document.getElementById('edit-color')?.value||'').trim(),phone:(document.getElementById('edit-phone')?.value||'').trim(),altPhone:(document.getElementById('edit-alt-phone')?.value||'').trim(),parkingZone:(document.getElementById('edit-zone')?.value||'').trim()});
  if(ok){if(st)st.innerHTML='<span style="color:#34d399">Saved!</span>';setTimeout(()=>{document.getElementById('modal-overlay').style.display='none';refreshRecords();},800);}
  else{if(st)st.innerHTML='<span style="color:#f87171">Error saving.</span>';}
};
function renderRecordsList(recs){
  const c=document.getElementById('records-list');if(!c)return;
  if(!recs.length){c.innerHTML='<div style="text-align:center;padding:28px;color:#475569"><i class="fa-solid fa-folder-open" style="font-size:2rem;opacity:.4;display:block;margin-bottom:10px"></i>No records found.</div>';return;}
  c.innerHTML=recs.map(r=>{
    const cu=r._source==='custom';
    const badge=cu?'<span class="rec-source-badge badge-custom">Custom</span>':'<span class="rec-source-badge badge-builtin">Built-in</span>';
    const zone=r.parkingZone?`<div class="rec-zone-chip">${getZoneIcon(r.parkingZone)}<span>${r.parkingZone} Zone</span></div>`:'';
    const alt=r.altPhone?`<div class="rec-field"><div class="rec-field-label" style="color:#a78bfa">Alt.</div><div class="rec-field-value" style="color:#a78bfa">${r.altPhone}</div></div>`:'';
    const del=cu?`<button class="rec-action-btn rec-delete-btn" onclick="deleteFromPortal('${r.number}')"><i class="fa-solid fa-trash"></i> Delete</button>`:'';
    return`<div class="rec-item-card"><div class="rec-card-header"><span class="rec-plate-num">${r.number}</span>${badge}</div><div class="rec-card-body"><div class="rec-field"><div class="rec-field-label">Owner</div><div class="rec-field-value">${r.ownerName||''}</div></div><div class="rec-field"><div class="rec-field-label">Model</div><div class="rec-field-value">${r.carModel||''}</div></div><div class="rec-field"><div class="rec-field-label">Color</div><div class="rec-field-value">${r.color||''}</div></div><div class="rec-field"><div class="rec-field-label">Phone</div><div class="rec-field-value">${r.phone||''}</div></div>${alt}</div>${zone}<div class="rec-card-actions"><button class="rec-action-btn rec-edit-btn" onclick="openEditModal('${r.number}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button><button class="rec-action-btn rec-search-btn" onclick="doSearch('${r.number}')"><i class="fa-solid fa-magnifying-glass"></i> Search</button>${del}</div></div>`;
  }).join('');
}
window.refreshRecords=function(){
  const all=getAllRecords();
  const cu=all.filter(r=>r._source==='custom').length,bi=all.filter(r=>r._source==='builtin').length;
  const st=document.getElementById('stat-total'),sc=document.getElementById('stat-custom'),ss=document.getElementById('stat-static');
  if(st)st.innerHTML=`<i class="fa-solid fa-car"></i> ${all.length} Total`;
  if(sc)sc.innerHTML=`<i class="fa-solid fa-user-pen"></i> ${cu} Custom`;
  if(ss)ss.innerHTML=`<i class="fa-solid fa-database"></i> ${bi} Built-in`;
  let f=all;
  if(_recFilter==='custom')f=all.filter(r=>r._source==='custom');
  else if(_recFilter==='builtin')f=all.filter(r=>r._source==='builtin');
  if(_recSearch.trim()){const q=_recSearch.trim().toLowerCase();f=f.filter(r=>(r.number||'').toLowerCase().includes(q)||(r.ownerName||'').toLowerCase().includes(q)||(r.carModel||'').toLowerCase().includes(q)||(r.color||'').toLowerCase().includes(q));}
  renderRecordsList(f);
};
window.exportRecordsCSV=function(){
  const all=getAllRecords();
  const hdr='Plate Number,Owner Name,Car Model,Color,Phone,Alternate Number,Source';
  const rows=all.map(r=>[r.number,r.ownerName,r.carModel,r.color,r.phone,r.altPhone||'',r._source].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(','));
  const csv=[hdr,...rows].join('\n');const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`CarRecords_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  showToast('CSV exported!',true);
};
document.querySelectorAll('.rfbtn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.rfbtn').forEach(x=>x.classList.remove('active'));b.classList.add('active');_recFilter=b.getAttribute('data-filter');refreshRecords();
}));
document.getElementById('records-search')?.addEventListener('input',e=>{_recSearch=e.target.value;refreshRecords();});

// EXCEL IMPORT
document.getElementById('excel-file-input')?.addEventListener('change',function(e){
  const file=e.target.files[0];if(!file)return;
  const info=document.getElementById('excel-file-info'),stat=document.getElementById('excel-import-status');
  if(info){info.textContent=`Selected: ${file.name}`;info.style.display='block';}
  if(stat){stat.textContent='Processing...';stat.style.color='#a78bfa';}
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      if(typeof XLSX==='undefined')throw new Error('SheetJS not loaded');
      const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1});
      if(rows.length<2)throw new Error('No data found');
      const hdrs=rows[0].map(h=>String(h||'').trim().toLowerCase().replace(/[^a-z0-9]/g,''));
      const km={number:['carnumber','vehiclenumber','platenumber','plate','number'],ownerName:['ownername','owner','name'],carModel:['carmodel','model'],color:['color','colour'],phone:['phone','phonenumber','contact','mobile'],altPhone:['alternatephone','altphone'],parkingZone:['parkingzone','zone']};
      const idx={};for(let k in km)idx[k]=hdrs.findIndex(h=>km[k].includes(h));
      if(idx.number===-1)idx.number=0;if(idx.ownerName===-1)idx.ownerName=1;
      const ex=localStorage.getItem('CUSTOM_CARS');const cars=ex?JSON.parse(ex):[];let ok=0;
      for(let r=1;r<rows.length;r++){
        const row=rows[r];if(!row||!row.length)continue;
        const plate=idx.number<row.length?String(row[idx.number]||'').trim().toUpperCase():'';
        const owner=idx.ownerName<row.length?String(row[idx.ownerName]||'').trim():'';
        if(!plate||!owner)continue;
        const car={number:plate,ownerName:owner,carModel:idx.carModel>=0&&row[idx.carModel]?String(row[idx.carModel]).trim():'Unknown',color:idx.color>=0&&row[idx.color]?String(row[idx.color]).trim():'Unknown',phone:idx.phone>=0&&row[idx.phone]?String(row[idx.phone]).trim():'Unknown',altPhone:idx.altPhone>=0&&row[idx.altPhone]?String(row[idx.altPhone]).trim():'',parkingZone:idx.parkingZone>=0&&row[idx.parkingZone]?String(row[idx.parkingZone]).trim():'',_source:'custom'};
        const norm=plate.replace(/[^A-Z0-9]/g,'');const di=cars.findIndex(c=>c.number.toUpperCase().replace(/[^A-Z0-9]/g,'')==norm);
        if(di>=0)cars[di]=car;else cars.push(car);ok++;
      }
      localStorage.setItem('CUSTOM_CARS',JSON.stringify(cars));
      if(stat)stat.innerHTML=`<span style="color:#34d399">Imported ${ok} records!</span>`;
      showToast(`Imported ${ok} records!`,true);
      e.target.value='';setTimeout(()=>{if(info)info.style.display='none';if(stat)stat.textContent='';},4000);
      refreshRecords();
    }catch(err){if(stat)stat.innerHTML=`<span style="color:#f87171">Error: ${err.message}</span>`;}
  };
  reader.readAsArrayBuffer(file);
});

// MODAL
function openModal(title,html){const mo=document.getElementById('modal-overlay'),mt=document.getElementById('modal-title'),mb=document.getElementById('modal-body');if(mo)mo.style.display='flex';if(mt)mt.textContent=title;if(mb)mb.innerHTML=html;}
document.getElementById('modal-close')?.addEventListener('click',()=>{document.getElementById('modal-overlay').style.display='none';});
document.getElementById('modal-overlay')?.addEventListener('click',e=>{if(e.target===document.getElementById('modal-overlay'))document.getElementById('modal-overlay').style.display='none';});

// TOAST
function showToast(msg,ok=true){
  let t=document.getElementById('toast');if(!t)return;
  t.innerHTML=`<i class="fa-solid ${ok?'fa-circle-check':'fa-circle-xmark'}" style="color:${ok?'#34d399':'#f87171'}"></i> ${msg}`;
  t.style.display='flex';clearTimeout(t._to);t._to=setTimeout(()=>t.style.display='none',3000);
}

// INIT
setResultNotFound('No query submitted yet.','fa-magnifying-glass');
setActiveMode('image');
loginOverlay.style.opacity='1';
