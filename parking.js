'use strict';
const ADMIN_PASSWORD='admin123';
const INDIAN_PLATE_RE=/[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}/;
let currentResult=null,adminLoggedIn=false,gpsZone=null;
const $=id=>document.getElementById(id);

// ============================================================
//  SESSION CHECK
// ============================================================
function initGuardLogin() {
  const session = typeof getGuardSession === 'function' ? getGuardSession() : null;
  if (session) {
    showGuardSession(session);
    
    // Auto-unlock admin features if session is ADMIN
    if (session.guardRole === 'ADMIN') {
      adminLoggedIn = true;
      const gate = $('pv-admin-gate'), content = $('pv-admin-content');
      if (gate) gate.style.display = 'none';
      if (content) content.style.display = 'block';
      // Use setTimeout to ensure DOM is ready for rendering
      setTimeout(() => {
        if (typeof renderAdminRecords === 'function') renderAdminRecords();
        if (typeof renderGuardAccounts === 'function') renderGuardAccounts();
        if (typeof renderGuardLoginHistory === 'function') renderGuardLoginHistory();
      }, 100);
    }
  } else {
    // Redirect to main login if no session found
    console.warn("No active session found. Redirecting...");
    window.location.href = "index.html";
  }
}

function showGuardSession(session) {
  const badge = $('guard-session-badge');
  if (badge) {
    badge.style.display = 'flex';
    $('guard-session-name').textContent = session.guardName;
    const role = session.guardRole || 'USER';
    $('guard-session-id').textContent = session.guardId + ' · ' + role;
  }
}

const gLogoutBtn = $('guard-logout-btn');
if (gLogoutBtn) {
  gLogoutBtn.addEventListener('click', () => {
    if (confirm('Log out from system?')) {
      if (typeof clearGuardSession === 'function') clearGuardSession();
      window.location.href = "index.html";
    }
  });
}

// Tabs
document.querySelectorAll('.pv-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.pv-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.pv-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-'+btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='history')renderHistory();
    if(btn.dataset.tab==='admin'&&adminLoggedIn)renderAdminRecords();
    if(btn.dataset.tab==='guard')renderZoneLegend();
  });
});

// Toast
function showToast(msg,isValid=false){
  const t=$('pv-toast');t.textContent=msg;
  t.className='pv-toast'+(isValid?' valid-toast':'')+' show';
  setTimeout(()=>t.classList.remove('show'),3200);
}
window.showToast=showToast;

// GPS Zone Detection (Check tab)
$('pv-gps-btn').addEventListener('click', function() {
  if (!navigator.geolocation) { showToast('❌ GPS not supported on this device'); return; }
  const btn = $('pv-gps-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner pv-spinner"></i> Locating...';
  btn.disabled = true;

  // Stage 1: Try high-accuracy GPS (good for outdoor use on campus)
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Re-detect Location';
      gpsZone = detectGPSZone(pos.coords.latitude, pos.coords.longitude);
      renderZoneBanner(gpsZone);
      showToast('📍 Location captured! Accuracy: ±' + Math.round(pos.coords.accuracy) + 'm', true);
    },
    function(err) {
      // Stage 2: Retry with low-accuracy (network/cell tower based) as fallback
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Re-detect Location';
          gpsZone = detectGPSZone(pos.coords.latitude, pos.coords.longitude);
          renderZoneBanner(gpsZone);
          showToast('📍 Location (network): ±' + Math.round(pos.coords.accuracy) + 'm', true);
        },
        function(err2) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Detect My Location';
          var errMsg = {
            1: '❌ Location permission denied — enable in Settings',
            2: '❌ GPS signal unavailable — go outdoors or enable Wi-Fi',
            3: '❌ Location timed out — try again'
          }[err2.code] || ('❌ GPS error: ' + err2.message);
          showToast(errMsg);
          // Show error code in zone banner for quick diagnosis
          var banner = $('pv-zone-banner'), text = $('pv-zone-text');
          banner.className = 'pv-zone-banner unknown';
          text.textContent = errMsg + ' (code ' + err2.code + ')';
        },
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
      );
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
  );
});

function renderZoneBanner(zone){
  const banner=$('pv-zone-banner'),text=$('pv-zone-text');
  if(!zone){banner.className='pv-zone-banner unknown';text.textContent='No campus zone found — check manually';return;}
  banner.className='pv-zone-banner allowed';
  banner.style.borderColor=zone.color+'66';
  banner.style.background=zone.color+'1a';
  banner.style.color=zone.color;
  text.textContent='✓ '+zone.name;
}

// Plate Input
const plateInput=$('pv-plate-input');
plateInput.addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});

// Camera Scan (Check tab)
$('pv-scan-btn').addEventListener('click',()=>$('pv-camera-input').click());
$('pv-camera-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  showToast('Processing image...');
  try{
    const dataUrl=await fileToDataUrl(file);
    if(window.cordova&&window.textocr){
      window.textocr.recText(4,dataUrl.split(',')[1],res=>{
        const text=res&&res.foundText&&res.blocks?res.blocks.blocktext.join(' '):'';
        const plate=extractPlate(text);
        if(plate){plateInput.value=plate;showToast('Plate: '+plate,true);}
        else showToast('No plate found — enter manually');
      },()=>showToast('OCR error — enter manually'));
    }else{showToast('OCR unavailable — enter manually');}
  }catch(e){showToast('Unable to process image');}
});

function fileToDataUrl(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});}
function extractPlate(text){if(!text)return'';const c=text.toUpperCase().replace(/[^A-Z0-9]/g,'');const m=c.match(INDIAN_PLATE_RE);return m?m[0]:'';}

// Check Violation
$('pv-check-btn').addEventListener('click',runCheck);
plateInput.addEventListener('keyup',e=>{if(e.key==='Enter')runCheck();});

async function runCheck(){
  const raw=plateInput.value.trim();if(!raw){showToast('Enter a vehicle number');return;}
  const btn=$('pv-check-btn');btn.disabled=true;
  btn.innerHTML='<i class="fa-solid fa-spinner pv-spinner"></i> Checking...';
  await new Promise(r=>setTimeout(r,600));
  const record=findParkingRecord(raw);
  const entryInput=$('pv-entry-time').value;
  if(record){record.entry_time=entryInput?new Date(entryInput).toISOString():record.entry_time||new Date().toISOString();}
  const result=checkParkingViolation(record,Date.now(),gpsZone);
  currentResult={plate:raw,record,result,timestamp:new Date().toISOString()};
  const session=getGuardSession();
  addParkingHistory({plate:raw,owner:record?record.owner_name:'Unknown',isViolation:result.isViolation,reasons:result.reason_labels,fine:result.fine,zone:gpsZone?gpsZone.name:(record?record.assigned_zone:'UNKNOWN'),timestamp:currentResult.timestamp,guardId:session?session.guardId:null,guardName:session?session.guardName:null});
  if(result.isViolation)triggerViolationNotification(raw,result);
  renderResultCard(raw,record,result);
  btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-shield-halved"></i> Check Violation';
}

function renderResultCard(plate,record,result){
  const wrapper=$('pv-result-wrapper'),card=$('pv-result-card');
  wrapper.style.display='block';wrapper.scrollIntoView({behavior:'smooth',block:'nearest'});
  const isV=result.isViolation;
  card.className='pv-result-card '+(isV?'violation':'valid');
  $('pv-status-icon').className=isV?'fa-solid fa-circle-xmark':'fa-solid fa-circle-check';
  $('pv-status-label').textContent=isV?'Parking Violation Detected':'Parking Valid ✓';
  $('pv-status-sub').textContent=isV?result.reasons.length+' rule(s) violated':'All rules complied';
  $('pv-res-plate').textContent=plate.toUpperCase();
  $('pv-res-owner').textContent=record?record.owner_name:'⚠ Not Found';

  // FIX: Add Register button to Check tab if not found
  const regBtnWrap = $('pv-check-reg-btn-wrap');
  if(!record) {
    if(!regBtnWrap) {
        $('pv-res-owner').insertAdjacentHTML('afterend', `<div id="pv-check-reg-btn-wrap" style="margin-top:8px;">
            <button class="pv-btn pv-btn-primary pv-btn-full" style="padding:8px; font-size:0.8rem;" onclick="openQuickRegMain()"><i class="fa-solid fa-plus-circle"></i> Register Vehicle</button>
        </div>`);
    }
  } else if(regBtnWrap) {
    regBtnWrap.remove();
  }

  $('pv-res-usertype').innerHTML=record?`<span class="user-type-badge ut-${(record.user_type||'').toLowerCase()}">${record.user_type||'—'}</span>`:'—';
  $('pv-res-vehicletype').innerHTML=record?`<span class="vehicle-type-badge vt-${(record.vehicle_type||'').toLowerCase()}">${record.vehicle_type||'—'}</span>`:'—';
  $('pv-res-zone').textContent=record?(record.assigned_zone||'—'):'—';
  $('pv-res-gpszone').textContent=gpsZone?gpsZone.name:'Not detected';
  // Violations list
  const vs=$('pv-violations-section'),vl=$('pv-violations-list');
  if(isV&&result.reason_labels.length){vs.style.display='block';vl.innerHTML=result.reason_labels.map(l=>`<div class="pv-violation-item"><i class="fa-solid fa-xmark-circle"></i>${l}</div>`).join('');}
  else vs.style.display='none';
  // Fine
  if(isV){$('pv-fine-banner').style.display='flex';$('pv-fine-amount').textContent='₹'+result.fine.toLocaleString('en-IN');}
  else $('pv-fine-banner').style.display='none';
  // Remaining time
  if(!isV&&result.remainingMinutes>0){$('pv-remaining-banner').style.display='flex';$('pv-remaining-time').textContent=fmtMin(result.remainingMinutes);}
  else $('pv-remaining-banner').style.display='none';
  // WhatsApp button
  const waBtn=$('pv-whatsapp-btn');
  if(isV&&record&&record.phone_number){waBtn.style.display='flex';waBtn.onclick=()=>sendWhatsAppAlert(plate,record,gpsZone,result);}
  else waBtn.style.display='none';
  if(navigator.vibrate)navigator.vibrate(isV?[80,40,80,40,160]:[60]);
}

function fmtMin(min){if(min<60)return min+' min';const h=Math.floor(min/60),m=min%60;return m?h+'h '+m+'min':h+'h';}

// Share
$('pv-share-btn').addEventListener('click',()=>{
  if(!currentResult)return;
  const{plate,result}=currentResult;
  const msg=result.isViolation?`⚠ Violation for ${plate}!\nReasons: ${result.reason_labels.join(', ')}\nFine: ₹${result.fine}`:`✅ ${plate} has valid parking. Left: ${fmtMin(result.remainingMinutes)}`;
  if(navigator.share)navigator.share({title:'Parking Status',text:msg}).catch(()=>{});
  else{navigator.clipboard&&navigator.clipboard.writeText(msg);showToast('Copied!',true);}
});

// Clear
$('pv-clear-btn').addEventListener('click',()=>{
  $('pv-result-wrapper').style.display='none';plateInput.value='';$('pv-entry-time').value='';
  currentResult=null;gpsZone=null;
  const b=$('pv-zone-banner');b.className='pv-zone-banner unknown';b.style.cssText='';
  $('pv-zone-text').textContent='Tap to detect your GPS zone';
});

// Violation notification
function triggerViolationNotification(plate,result){
  showToast('🚨 VIOLATION: '+plate+' — '+result.reason_labels[0]);
  if('Notification'in window&&Notification.permission==='granted'){new Notification('Parking Violation',{body:plate+': '+result.reason_labels.join(', ')+' | ₹'+result.fine,icon:'img/icon.png'});}
  else if('Notification'in window&&Notification.permission!=='denied'){Notification.requestPermission().then(p=>{if(p==='granted')new Notification('Parking Violation',{body:plate+': '+result.reason_labels.join(', ')});});}
}

// History tab
function renderHistory(){
  const list=$('pv-history-list'),history=getParkingHistory();
  if(!history.length){list.innerHTML='<div class="pv-empty"><i class="fa-solid fa-clock-rotate-left"></i><p>No checks yet</p></div>';return;}
  list.innerHTML=history.map((e,i)=>`<div class="pv-history-item" onclick="replayHistory(${i})"><div class="pv-history-dot ${e.isViolation?'violation':'valid'}"></div><div style="flex:1;min-width:0"><div class="pv-history-plate">${e.plate}</div><div class="pv-history-meta">${e.owner} • ${fmtTs(e.timestamp)}${e.isViolation?' • ₹'+e.fine:' • Valid'}${e.guardId?` • <span style="color:#8b5cf6;font-weight:600;">${e.guardId}</span>`:''}</div></div><div class="pv-history-badge ${e.isViolation?'violation':'valid'}">${e.isViolation?'VIOLATION':'VALID'}</div></div>`).join('');
}
window.replayHistory=function(i){const e=getParkingHistory()[i];if(!e)return;document.querySelector('[data-tab="check"]').click();plateInput.value=e.plate;setTimeout(()=>runCheck(),200);};
$('pv-clear-history-btn').addEventListener('click',()=>{if(confirm('Clear history?')){localStorage.removeItem('PARKING_HISTORY');renderHistory();}});
function fmtTs(ts){if(!ts)return'';const d=new Date(ts);return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true});}
window.formatTimestamp=fmtTs;

// ---- Download / Export Violations ----
function exportViolationsPDF() {
  const history = getParkingHistory();
  if (!history.length) { showToast('No violation records to export'); return; }

  const totalChecks    = history.length;
  const violations     = history.filter(e => e.isViolation);
  const validChecks    = history.filter(e => !e.isViolation);
  const totalFine      = violations.reduce((sum, e) => sum + (e.fine || 0), 0);
  const generatedAt    = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Build table rows
  const rows = history.map((e, idx) => {
    const status = e.isViolation
      ? `<span style="color:#ef4444;font-weight:700;">⚠ VIOLATION</span>`
      : `<span style="color:#10b981;font-weight:700;">✓ VALID</span>`;
    const reasons = (e.reasons && e.reasons.length) ? e.reasons.join(', ') : '—';
    const fine    = e.isViolation ? `₹${(e.fine||0).toLocaleString('en-IN')}` : '—';
    const guard   = e.guardId ? `${e.guardName||''} (${e.guardId})` : '—';
    const bg      = e.isViolation ? (idx % 2 === 0 ? '#fff5f5' : '#fff0f0') : (idx % 2 === 0 ? '#f9fafb' : '#ffffff');
    return `
      <tr style="background:${bg};">
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;letter-spacing:1px;">${e.plate || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${e.owner || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${status}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:0.8rem;color:#6b7280;">${reasons}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#ef4444;">${fine}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${e.zone || '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:0.78rem;">${guard}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:0.78rem;color:#6b7280;">${fmtTs(e.timestamp)}</td>
      </tr>`;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Parking Violation Report — Galgotias University</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; background:#fff; padding:24px; }
    .header { display:flex; align-items:center; gap:16px; border-bottom:3px solid #ef4444; padding-bottom:16px; margin-bottom:20px; }
    .header-icon { width:52px; height:52px; background:linear-gradient(135deg,#ef4444,#dc2626); border-radius:12px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.6rem; flex-shrink:0; }
    .header-text h1 { font-size:1.5rem; font-weight:800; color:#1e293b; }
    .header-text p  { font-size:0.85rem; color:#64748b; margin-top:2px; }
    .stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
    .stat-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; text-align:center; }
    .stat-box.red   { background:#fff5f5; border-color:#fca5a5; }
    .stat-box.green { background:#f0fdf4; border-color:#86efac; }
    .stat-box.blue  { background:#eff6ff; border-color:#93c5fd; }
    .stat-num  { font-size:1.8rem; font-weight:800; }
    .stat-box.red   .stat-num { color:#ef4444; }
    .stat-box.green .stat-num { color:#10b981; }
    .stat-box.blue  .stat-num { color:#3b82f6; }
    .stat-label { font-size:0.75rem; color:#64748b; margin-top:4px; text-transform:uppercase; letter-spacing:0.5px; }
    table { width:100%; border-collapse:collapse; font-size:0.82rem; box-shadow:0 1px 4px rgba(0,0,0,0.06); border-radius:10px; overflow:hidden; }
    thead tr { background:linear-gradient(135deg,#1e293b,#334155); color:#fff; }
    thead th { padding:11px 10px; text-align:left; font-weight:600; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.5px; }
    .footer { margin-top:24px; text-align:center; font-size:0.75rem; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:14px; }
    @media print {
      body { padding:10px; }
      .no-print { display:none !important; }
      table { font-size:0.75rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-icon">⚠</div>
    <div class="header-text">
      <h1>Parking Violation Report</h1>
      <p>Galgotias University, Greater Noida &nbsp;|&nbsp; Generated: ${generatedAt}</p>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-box"><div class="stat-num">${totalChecks}</div><div class="stat-label">Total Checks</div></div>
    <div class="stat-box red"><div class="stat-num">${violations.length}</div><div class="stat-label">Violations</div></div>
    <div class="stat-box green"><div class="stat-num">${validChecks.length}</div><div class="stat-label">Valid Parking</div></div>
    <div class="stat-box blue"><div class="stat-num">₹${totalFine.toLocaleString('en-IN')}</div><div class="stat-label">Total Fines</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Plate</th><th>Owner</th><th>Status</th>
        <th>Reason</th><th>Fine</th><th>Zone</th><th>Guard</th><th>Time</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <p>Galgotias University Parking Management System &nbsp;·&nbsp; Confidential Document &nbsp;·&nbsp; ${generatedAt}</p>
  </div>

  <div class="no-print" style="text-align:center;margin-top:20px;">
    <button onclick="window.print()" style="padding:12px 28px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;margin-right:10px;">
      🖨 Print / Save as PDF
    </button>
    <button onclick="window.close()" style="padding:12px 28px;background:#e2e8f0;color:#1e293b;border:none;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;">
      ✕ Close
    </button>
  </div>
</body>
</html>`;

  // Try sharing as a file (Android / modern browsers)
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const fileName = `violations_${new Date().toISOString().slice(0,10)}.html`;

  // Try Web Share API (Android share sheet — can share to WhatsApp, Drive, Files, etc.)
  if (navigator.canShare && navigator.share) {
    const file = new File([blob], fileName, { type: 'text/html' });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Parking Violation Report', text: 'Galgotias University Parking Violations' })
        .catch(err => { if (err.name !== 'AbortError') fallbackDownload(blob, fileName, htmlContent); });
      return;
    }
  }

  fallbackDownload(blob, fileName, htmlContent);
}

function fallbackDownload(blob, fileName, htmlContent) {
  // Try <a> download (works in desktop browser / some Android browsers)
  try {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📄 Report downloaded!', true);
  } catch(e) {
    // Last resort: open in new tab with print dialog
    const win = window.open('', '_blank');
    if (win) { win.document.write(htmlContent); win.document.close(); win.focus(); win.print(); }
    else { showToast('⚠ Allow pop-ups to view the report'); }
  }
}

const dlBtn = $('pv-download-pdf-btn');
if (dlBtn) dlBtn.addEventListener('click', exportViolationsPDF);

// ============================================================
//  DOWNLOAD VIOLATION HISTORY AS PDF
// ============================================================
function downloadViolationsPDF() {
  const history = getParkingHistory();
  if (!history.length) { showToast('No violation history to export'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const margin = 14;
  const colW   = pageW - margin * 2;
  let   y      = 0;

  // ---- Helpers ----
  function newPageIfNeeded(needed) {
    if (y + needed > pageH - 16) {
      doc.addPage();
      y = 14;
      drawPageHeader();
    }
  }
  function drawPageHeader() {
    doc.setFillColor(15, 23, 42);          // dark navy
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Galgotias University — Parking Violation Report', margin, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Campus Parking Violation System', margin, 16);
    const gen = 'Generated: ' + new Date().toLocaleString('en-IN');
    doc.text(gen, pageW - margin - doc.getTextWidth(gen), 16);
    y = 30;
  }

  // ---- Page 1 header ----
  drawPageHeader();

  // ---- Summary box ----
  const total      = history.length;
  const violations = history.filter(e => e.isViolation).length;
  const valid      = total - violations;
  const totalFine  = history.filter(e => e.isViolation).reduce((s, e) => s + (e.fine || 0), 0);

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, y, colW, 22, 3, 3, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  const sumItems = [
    { label: 'TOTAL CHECKS', value: String(total) },
    { label: 'VIOLATIONS',   value: String(violations) },
    { label: 'VALID',        value: String(valid) },
    { label: 'TOTAL FINES',  value: '\u20B9' + totalFine.toLocaleString('en-IN') }
  ];
  const cellW = colW / sumItems.length;
  sumItems.forEach((item, i) => {
    const cx = margin + i * cellW + cellW / 2;
    doc.setTextColor(148, 163, 184);
    doc.text(item.label, cx, y + 8, { align: 'center' });
    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(item.value, cx, y + 17, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
  });
  y += 28;

  // ---- Table ----
  const cols = [
    { header: '#',        w: 8 },
    { header: 'Plate',    w: 26 },
    { header: 'Owner',    w: 40 },
    { header: 'Status',   w: 22 },
    { header: 'Zone',     w: 28 },
    { header: 'Fine (\u20B9)', w: 18 },
    { header: 'Guard',    w: 18 },
    { header: 'Time',     w: 0  }   // fill remaining
  ];
  // Calculate last column width
  const fixedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = colW - fixedW;

  // Table header row
  doc.setFillColor(51, 65, 85);
  doc.rect(margin, y, colW, 8, 'F');
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let cx = margin;
  cols.forEach(col => {
    doc.text(col.header, cx + 2, y + 5.5);
    cx += col.w;
  });
  y += 8;

  // Table rows
  history.forEach((entry, idx) => {
    newPageIfNeeded(9);

    const rowH   = 8.5;
    const isViol = entry.isViolation;
    // Row background — alternating with violation tint
    if (isViol) {
      doc.setFillColor(127, 29, 29, 0.18);  // red-tinted
      doc.setFillColor(50, 20, 20);
    } else {
      doc.setFillColor(idx % 2 === 0 ? 22 : 28, idx % 2 === 0 ? 30 : 37, idx % 2 === 0 ? 45 : 53);
    }
    doc.rect(margin, y, colW, rowH, 'F');

    // Violation/valid left accent bar
    doc.setFillColor(isViol ? 239 : 52, isViol ? 68 : 211, isViol ? 68 : 153);
    doc.rect(margin, y, 2, rowH, 'F');

    doc.setFontSize(7.5);
    doc.setTextColor(226, 232, 240);
    const cells = [
      String(idx + 1),
      (entry.plate || '').toUpperCase(),
      (entry.owner || '—').substring(0, 22),
      isViol ? 'VIOLATION' : 'VALID',
      (entry.zone || '—').substring(0, 16),
      isViol ? String(entry.fine || 0) : '—',
      (entry.guardId || '—'),
      fmtTs(entry.timestamp)
    ];
    cx = margin + 2;
    cols.forEach((col, ci) => {
      if (ci === 3) {
        // Status cell — colored
        doc.setTextColor(isViol ? 252 : 52, isViol ? 165 : 211, isViol ? 165 : 153);
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setTextColor(ci === 0 ? 100 : 210, ci === 0 ? 116 : 220, ci === 0 ? 139 : 240);
        doc.setFont('helvetica', 'normal');
      }
      doc.text(cells[ci], cx, y + 5.5, { maxWidth: col.w - 2 });
      cx += col.w;
    });

    // Violation reasons on next micro-line if any
    if (isViol && entry.reasons && entry.reasons.length) {
      // we already included fine in the row; skip extra detail to keep compact
    }

    y += rowH;

    // Thin divider line
    doc.setDrawColor(30, 42, 60);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + colW, y);
  });

  // ---- Footer on each page ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(15, 23, 42);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Galgotias University — Campus Parking Violation System', margin, pageH - 4);
    doc.text('Page ' + p + ' of ' + totalPages, pageW - margin, pageH - 4, { align: 'right' });
  }

  // ---- Save / Download — Cordova-safe multi-path strategy ----
  const fileName = 'violation_history_' + new Date().toISOString().slice(0, 10) + '.pdf';
  const pdfBlob   = doc.output('blob');
  const pdfBase64 = doc.output('datauristring');

  if (window.cordova && window.resolveLocalFileSystemURL) {
    // Build ordered list of paths to try
    const cf = window.cordova.file || {};
    const pathsToTry = [
      // 1) App-specific external storage — writable on ALL Android versions (no scoped storage issue)
      //    Found in: Files > Internal Storage > Android > data > com.carnumberplate.lookup > files
      cf.externalDataDirectory || null,
      // 2) Android Downloads folder — accessible on Android 9 and below
      'file:///storage/emulated/0/Download/',
      // 3) External root + Download (alternate path)
      cf.externalRootDirectory ? cf.externalRootDirectory + 'Download/' : null,
      // 4) Internal app data (always works, but harder to find without file manager)
      cf.dataDirectory || null
    ].filter(Boolean);

    _tryWritePath(pathsToTry, 0, pdfBlob, fileName, pdfBase64);
  } else {
    // Non-Cordova (browser) — use share/anchor
    _fallbackShare(pdfBlob, fileName, pdfBase64);
  }
}

// Try each path in sequence; on any failure move to next
function _tryWritePath(paths, idx, blob, fileName, dataUri) {
  if (idx >= paths.length) {
    // All Cordova paths failed — try Web Share / anchor
    showToast('⚠ Storage write failed, trying share...');
    _fallbackShare(blob, fileName, dataUri);
    return;
  }

  const dirUrl = paths[idx];
  window.resolveLocalFileSystemURL(dirUrl,
    function(dirEntry) {
      // Directory resolved — create/overwrite the file
      dirEntry.getFile(fileName, { create: true, exclusive: false },
        function(fileEntry) {
          fileEntry.createWriter(function(writer) {
            writer.onwriteend = function() {
              const savedPath = fileEntry.nativeURL || fileEntry.toURL();
              showToast('📄 PDF saved successfully!', true);

              // Auto-open PDF using cordova-plugin-file-opener2
              if (window.cordova && window.cordova.plugins && window.cordova.plugins.fileOpener2) {
                window.cordova.plugins.fileOpener2.open(
                  savedPath,
                  'application/pdf',
                  {
                    error: function(e) {
                      console.warn('fileOpener2 error:', JSON.stringify(e));
                      // Informative alert as fallback
                      setTimeout(function() {
                        alert('✅ PDF Saved!\n\nFile: ' + fileName + '\n\nOpen your PDF reader/Files app or Share to view it.\nSaved at: ' + savedPath);
                      }, 200);
                    },
                    success: function() {
                      showToast('📄 PDF opened!', true);
                    }
                  }
                );
              } else {
                setTimeout(function() {
                  alert('✅ PDF Saved!\n\nFile: ' + fileName + '\nLocation: ' + savedPath + '\n\nUse your Files app to view it.');
                }, 200);
              }
            };
            writer.onerror = function(err) {
              console.warn('Write error on path[' + idx + '] ' + dirUrl + ':', JSON.stringify(err));
              _tryWritePath(paths, idx + 1, blob, fileName, dataUri);
            };
            writer.write(blob);
          },
          function(err) {
            console.warn('createWriter error on path[' + idx + ']:', JSON.stringify(err));
            _tryWritePath(paths, idx + 1, blob, fileName, dataUri);
          });
        },
        function(err) {
          console.warn('getFile error on path[' + idx + '] ' + dirUrl + ':', JSON.stringify(err));
          _tryWritePath(paths, idx + 1, blob, fileName, dataUri);
        }
      );
    },
    function(err) {
      console.warn('resolveLocalFileSystemURL failed for path[' + idx + '] ' + dirUrl + ':', JSON.stringify(err));
      _tryWritePath(paths, idx + 1, blob, fileName, dataUri);
    }
  );
}

// Fallback: Web Share API with file attachment (Android Chrome / modern WebView)
function _fallbackShare(blob, fileName, dataUri) {
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ title: 'Violation History PDF', files: [file] })
      .then(function() { showToast('📄 PDF shared!', true); })
      .catch(function(err) {
        if (err.name !== 'AbortError') {
          showToast('❌ Share failed: ' + err.message);
        }
      });
    return;
  }
  // Last resort: open data URI (may prompt save in browser, no-op in WebView)
  try {
    const w = window.open(dataUri, '_system');
    if (!w) {
      const a = document.createElement('a');
      a.href = dataUri; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    showToast('📄 PDF opened!', true);
  } catch(e) {
    showToast('❌ Could not save PDF. Try again.', false);
  }
}

$('pv-download-pdf-btn').addEventListener('click', function() {
  const btn = $('pv-download-pdf-btn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner pv-spinner"></i> Generating...';
  // Delay allows UI to repaint before heavy jsPDF work
  setTimeout(function() {
    try {
      downloadViolationsPDF();
    } catch(e) {
      alert('❌ PDF generation error:\n' + e.message + '\n\n' + e.stack);
      showToast('❌ PDF error: ' + e.message);
      console.error('PDF error:', e);
    }
    // Note: don't re-enable immediately since save is async in Cordova
    setTimeout(function() {
      btn.disabled = false;
      btn.innerHTML = orig;
    }, 3000);
  }, 100);
});






// Admin
$('pv-admin-login-btn').addEventListener('click',()=>{
  if($('pv-admin-pass').value===ADMIN_PASSWORD){adminLoggedIn=true;$('pv-admin-gate').style.display='none';$('pv-admin-content').style.display='block';renderAdminRecords();renderGuardAccounts();renderGuardLoginHistory();}
  else{showToast('Incorrect password');$('pv-admin-pass').value='';}
});
$('pv-admin-logout-btn').addEventListener('click',()=>{adminLoggedIn=false;$('pv-admin-content').style.display='none';$('pv-admin-gate').style.display='block';$('pv-admin-pass').value='';});

$('pv-admin-save-btn').addEventListener('click',()=>{
  const plate=$('adm-plate').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  const owner=$('adm-owner').value.trim();
  if(!plate||!owner){showToast('Plate and owner required');return;}
  saveParkingRecord({vehicle_number:plate,owner_name:owner,phone_number:$('adm-phone').value.trim().replace(/\D/g,''),alt_phone:($('adm-alt-phone')?$('adm-alt-phone').value.trim().replace(/\D/g,''):''),user_type:$('adm-usertype').value,vehicle_type:$('adm-vehicletype').value,assigned_zone:$('adm-zone').value,payment_status:$('adm-payment').value,allowed_time:parseInt($('adm-time').value)||60,fine_amount:parseInt($('adm-fine').value)||500,entry_time:$('adm-entry').value?new Date($('adm-entry').value).toISOString():null});
  $('pv-admin-status').textContent='✓ Saved: '+plate;setTimeout(()=>$('pv-admin-status').textContent='',2500);
  ['adm-plate','adm-owner','adm-phone','adm-alt-phone','adm-time','adm-fine','adm-entry'].forEach(id=>$(id)&&($(id).value=''));
  renderAdminRecords();
});

function renderAdminRecords(){
  const db=getParkingDB(),list=$('pv-admin-records-list');
  $('pv-records-count').textContent=db.length+' record(s)';
  if(!db.length){list.innerHTML='<div class="pv-empty" style="padding:20px"><p>No records</p></div>';return;}
  list.innerHTML=db.map(r=>`<div class="pv-admin-record-row"><div style="flex:1;min-width:0"><div class="pv-admin-record-plate">${r.vehicle_number}</div><div style="display:flex;gap:5px;margin-top:4px"><span class="user-type-badge ut-${(r.user_type||'').toLowerCase()}">${r.user_type||'?'}</span><span class="vehicle-type-badge vt-${(r.vehicle_type||'').toLowerCase()}">${r.vehicle_type||'?'}</span><span class="pv-admin-record-zone ${r.payment_status==='PAID'?'zone-allowed':'zone-no-parking'}">${r.payment_status}</span></div><div style="font-size:0.72rem;color:#64748b;margin-top:2px">${r.assigned_zone||''} • ${r.owner_name}</div></div><button class="pv-admin-del-btn" onclick="delAdminRec('${r.vehicle_number}')"><i class="fa-solid fa-trash"></i></button></div>`).join('');
}
window.delAdminRec=function(plate){if(confirm('Delete '+plate+'?')){deleteParkingRecord(plate);renderAdminRecords();showToast('Deleted: '+plate);}};

// Export/Import DB
$('pv-export-btn').addEventListener('click', () => {
    const db = getParkingDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `galgotias_parking_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('🚀 Backup file generated!', true);
});

$('pv-import-btn').addEventListener('click', () => $('pv-import-input').click());

$('pv-import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (Array.isArray(data)) {
                if (confirm(`Import ${data.length} records? This will overwrite your current local database.`)) {
                    saveParkingDB(data);
                    renderAdminRecords();
                    showToast('✅ Import successful!', true);
                    if(window.pv_sync) window.pv_sync.postMessage('update');
                }
            } else {
                showToast('❌ Invalid backup file format');
            }
        } catch (err) {
            showToast('❌ Error reading backup file');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// Init
document.addEventListener('DOMContentLoaded',()=>{
  getParkingDB();
  const now=new Date();now.setSeconds(0,0);
  $('pv-entry-time').value=now.toISOString().slice(0,16);
  initGuardLogin();
  
  // Cross-tab sync
  if(window.BroadcastChannel) {
    const sync = new BroadcastChannel('pv_data_sync');
    sync.onmessage = () => {
        if(adminLoggedIn) renderAdminRecords();
        if(typeof renderHistory === 'function') renderHistory();
    };
    window.pv_sync = sync;
  }
});

// Helper for quick registration from main check tab
window.openQuickRegMain = function() {
    const plate = $('pv-plate-input').value.trim();
    if(typeof openQuickReg === 'function') {
        openQuickReg(); // Reuse the guard mode function if available
    } else {
        // Fallback or direct logic if called from outside guard-mode
        $('reg-plate-display').textContent = plate;
        $('quick-reg-modal').classList.add('visible');
    }
};

// Update saveParkingRecord to trigger sync
const originalSave = saveParkingRecord;
window.saveParkingRecord = function(record) {
    originalSave(record);
    if(window.pv_sync) window.pv_sync.postMessage('update');
};

// ============================================================
//  GUARD ACCOUNT MANAGEMENT (Admin Panel)
// ============================================================
function renderGuardAccounts() {
  const accounts = getGuardAccounts();
  const list = $('gadm-list');
  if (!accounts.length) { list.innerHTML = '<div class="pv-empty" style="padding:16px"><p>No user accounts yet — create one above</p></div>'; return; }
  const roleColor = { GUARD:'#a78bfa', STUDENT:'#93c5fd', FACULTY:'#6ee7b7' };
  const roleIcon  = { GUARD:'fa-shield-halved', STUDENT:'fa-graduation-cap', FACULTY:'fa-chalkboard-user' };
  list.innerHTML = accounts.map(g => `
    <div class="guard-account-row ${g.active?'':'guard-inactive'}">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="guard-id-chip">${g.id}</span>
          <span style="font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,0.2);color:${roleColor[g.role]||'#94a3b8'};border:1px solid ${roleColor[g.role]||'#64748b'}44"><i class="fa-solid ${roleIcon[g.role]||'fa-user'}"></i> ${g.role||'USER'}</span>
          <span style="font-weight:700;color:#e2e8f0;font-size:0.88rem">${g.name}</span>
          ${!g.active ? '<span class="guard-status-chip inactive">INACTIVE</span>' : '<span class="guard-status-chip active">ACTIVE</span>'}
        </div>
        <div style="font-size:0.72rem;color:#64748b;margin-top:3px">${g.badge?'Badge/ID: '+g.badge+' &nbsp;|&nbsp; ':''} Pass: <code style="color:#94a3b8">${g.password}</code></div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="pv-btn pv-btn-secondary" style="padding:7px 10px;font-size:0.78rem" onclick="editGuard('${g.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="pv-btn" style="padding:7px 10px;font-size:0.78rem;background:${g.active?'rgba(245,158,11,0.15)':'rgba(16,185,129,0.15)'};color:${g.active?'#fbbf24':'#34d399'};border:1px solid ${g.active?'rgba(245,158,11,0.3)':'rgba(16,185,129,0.3)'}" onclick="toggleGuard('${g.id}')">${g.active?'<i class="fa-solid fa-ban"></i>':'<i class="fa-solid fa-check"></i>'}</button>
        <button class="pv-admin-del-btn" onclick="removeGuard('${g.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

window.editGuard = function(id) {
  const g = findGuardById(id);
  if (!g) return;
  $('gadm-editing-id').value = g.id;
  $('gadm-id').value = g.id; $('gadm-id').disabled = true;
  $('gadm-name').value = g.name;
  $('gadm-badge').value = g.badge || '';
  $('gadm-pass').value = g.password;
  $('gadm-role').value = g.role || 'GUARD';
  $('gadm-save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update User';
  $('gadm-cancel-btn').style.display = 'flex';
  $('gadm-status').textContent = 'Editing: ' + g.id;
};

window.toggleGuard = function(id) { toggleGuardActive(id); renderGuardAccounts(); };
window.removeGuard = function(id) {
  if (confirm('Delete guard account ' + id + '?')) { deleteGuardAccount(id); renderGuardAccounts(); showToast('Guard removed: ' + id); }
};

$('gadm-save-btn').addEventListener('click', () => {
  const editingId = $('gadm-editing-id').value;
  const id    = $('gadm-id').value.trim().toUpperCase();
  const name  = $('gadm-name').value.trim();
  const pass  = $('gadm-pass').value.trim();
  const badge = $('gadm-badge').value.trim();
  const role  = $('gadm-role').value || 'GUARD';
  if (!id || !name || !pass) { showToast('ID, Name and Password required'); return; }
  if (editingId) {
    updateGuardAccount({ id, name, badge, password: pass, role });
    $('gadm-status').textContent = '✓ Updated: ' + id;
  } else {
    const ok = addGuardAccount({ id, name, badge, password: pass, role, active: true });
    if (!ok) { showToast('User ID already exists!'); return; }
    $('gadm-status').textContent = '✓ Added: ' + id + ' (' + role + ')';
  }
  $('gadm-editing-id').value = ''; $('gadm-id').disabled = false;
  ['gadm-id','gadm-name','gadm-badge','gadm-pass'].forEach(f => $(f).value = '');
  $('gadm-role').value = 'GUARD';
  $('gadm-cancel-btn').style.display = 'none';
  $('gadm-save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save User';
  setTimeout(() => $('gadm-status').textContent = '', 2500);
  renderGuardAccounts();
});

$('gadm-cancel-btn').addEventListener('click', () => {
  $('gadm-editing-id').value = ''; $('gadm-id').disabled = false;
  ['gadm-id','gadm-name','gadm-badge','gadm-pass'].forEach(f => $(f).value = '');
  $('gadm-role').value = 'GUARD';
  $('gadm-cancel-btn').style.display = 'none';
  $('gadm-save-btn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save User';
  $('gadm-status').textContent = '';
});

function renderGuardLoginHistory() {
  const hist = getGuardLoginHistory();
  const el = $('gadm-login-history');
  if (!hist.length) { el.innerHTML = '<div class="pv-empty" style="padding:16px"><p>No login events yet</p></div>'; return; }
  const roleColor = { GUARD:'#a78bfa', STUDENT:'#93c5fd', FACULTY:'#6ee7b7' };
  el.innerHTML = hist.slice(0, 50).map(e => `
    <div class="guard-login-history-row">
      <div class="guard-login-action-dot ${e.action === 'LOGIN' ? 'login-dot' : 'logout-dot'}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.85rem;font-weight:700;color:#e2e8f0">${e.guardName} <span class="guard-id-chip" style="font-size:0.65rem">${e.guardId}</span>${e.guardRole?` <span style="font-size:0.62rem;color:${roleColor[e.guardRole]||'#94a3b8'};font-weight:700">${e.guardRole}</span>`:''}</div>
        <div style="font-size:0.75rem;color:#64748b;margin-top:2px">${fmtTs(e.timestamp)}</div>
      </div>
      <span class="guard-action-badge ${e.action === 'LOGIN' ? 'action-login' : 'action-logout'}">${e.action}</span>
    </div>`).join('');
}

$('clear-login-history-btn').addEventListener('click', () => {
  if (confirm('Clear all guard login history?')) {
    localStorage.removeItem('GUARD_LOGIN_HISTORY');
    renderGuardLoginHistory();
  }
});
