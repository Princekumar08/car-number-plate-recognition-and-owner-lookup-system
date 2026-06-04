'use strict';
let guardGPS=null,guardPhotoDataUrl=null,guardOwnerRecord=null;

function renderZoneLegend(){
  const g=document.getElementById('zone-legend-grid');
  if(!g||!window.CAMPUS_ZONES)return;
  g.innerHTML=CAMPUS_ZONES.map(z=>`<div class="zone-legend-item" style="border-left:3px solid ${z.color}"><div class="zone-legend-icon" style="color:${z.color}"><i class="fa-solid ${z.icon}"></i></div><div class="zone-legend-text"><div class="zone-legend-name">${z.name}</div><div class="zone-legend-desc">${z.allowedUserTypes.join('/')}&nbsp;•&nbsp;${z.allowedVehicleTypes.join('/')}</div></div></div>`).join('');
}

function getGuardMsg(plate,zone,ts){
  const zn=zone?zone.name:'Unknown Zone';
  const coords=guardGPS?`${guardGPS.lat.toFixed(5)}, ${guardGPS.lng.toFixed(5)}`:'Not captured';
  return `🚨 Parking Violation Alert!\n\nVehicle: ${plate}\nZone: ${zn}\nCoordinates: ${coords}\nTime: ${ts}\n\nYour vehicle was detected in a wrong parking zone (${zn}). Please report to the parking authority.\n\n— Galgotias University Security`;
}

function updateGuardAlertPreview(){
  const plate=document.getElementById('guard-plate-input').value.trim()||'[plate]';
  const zone=guardGPS?detectGPSZone(guardGPS.lat,guardGPS.lng):null;
  const ts=new Date().toLocaleString('en-IN');
  const msg=getGuardMsg(plate,zone,ts);
  document.getElementById('guard-alert-preview').style.display='block';
  document.getElementById('guard-alert-msg').textContent=msg;
}

document.getElementById('guard-gps-btn').addEventListener('click', function() {
  if (!navigator.geolocation) { showToast('❌ GPS not supported on this device'); return; }
  var btn = document.getElementById('guard-gps-btn');
  btn.innerHTML = '<i class="fa-solid fa-spinner pv-spinner"></i> Locating...';
  btn.disabled = true;

  function onSuccess(pos) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Re-detect Location';
    guardGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    var zone = detectGPSZone(guardGPS.lat, guardGPS.lng);
    var banner = document.getElementById('guard-gps-banner');
    var text = document.getElementById('guard-gps-text');
    if (zone) { banner.className = 'pv-zone-banner allowed'; text.textContent = '✓ ' + zone.name; }
    else { banner.className = 'pv-zone-banner unknown'; text.textContent = 'Outside campus zones — coords captured'; }
    var strip = document.getElementById('guard-coords-strip');
    strip.style.display = 'flex';
    document.getElementById('guard-lat').textContent = guardGPS.lat.toFixed(6);
    document.getElementById('guard-lng').textContent = guardGPS.lng.toFixed(6);
    document.getElementById('guard-ts').textContent = new Date().toLocaleString('en-IN');
    showToast('📍 Location captured! Accuracy: ±' + Math.round(pos.coords.accuracy) + 'm', true);
    updateGuardAlertPreview();
  }

  function onError2(err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Get GPS Location';
    var errMsg = {
      1: '❌ Location permission denied — enable in Settings',
      2: '❌ GPS signal unavailable — go outdoors or enable Wi-Fi',
      3: '❌ Location timed out — try again'
    }[err.code] || ('❌ GPS error: ' + err.message);
    showToast(errMsg);
    document.getElementById('guard-gps-text').textContent = errMsg + ' (code ' + err.code + ')';
  }

  function onError1(err) {
    // Stage 1 (high-accuracy) failed — try network-based location
    navigator.geolocation.getCurrentPosition(onSuccess, onError2,
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 });
  }

  // Stage 1: High-accuracy GPS
  navigator.geolocation.getCurrentPosition(onSuccess, onError1,
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 });
});

document.getElementById('guard-capture-btn').addEventListener('click',()=>document.getElementById('guard-camera-input').click());
document.getElementById('guard-scan-btn').addEventListener('click',()=>document.getElementById('guard-camera-input').click());

document.getElementById('guard-camera-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    guardPhotoDataUrl=ev.target.result;
    const pb=document.getElementById('guard-preview-box');
    pb.style.display='block';
    document.getElementById('guard-preview-img').src=guardPhotoDataUrl;
    const zone=guardGPS?detectGPSZone(guardGPS.lat,guardGPS.lng):null;
    document.getElementById('guard-photo-info-overlay').innerHTML=`<span><i class="fa-solid fa-location-dot"></i> ${zone?zone.name:'Unknown Zone'}</span><span><i class="fa-regular fa-clock"></i> ${new Date().toLocaleString('en-IN')}</span>`;
    showToast('Photo captured!',true);
    updateGuardAlertPreview();
    if(window.cordova&&window.textocr){
      window.textocr.recText(4,guardPhotoDataUrl.split(',')[1],res=>{
        const t=res&&res.foundText&&res.blocks?res.blocks.blocktext.join(' '):'';
        const m=t.toUpperCase().replace(/[^A-Z0-9]/g,'').match(/[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}/);
        if(m){document.getElementById('guard-plate-input').value=m[0];showToast('Plate: '+m[0],true);}
      },()=>{});
    }
  };
  reader.readAsDataURL(file);
});

document.getElementById('guard-plate-input').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');});

document.getElementById('guard-lookup-btn').addEventListener('click',()=>{
  const plate=document.getElementById('guard-plate-input').value.trim();
  if(!plate){showToast('Enter a vehicle number');return;}
  guardOwnerRecord=findParkingRecord(plate);
  const strip=document.getElementById('guard-owner-strip');
  if(guardOwnerRecord){
    strip.style.display='flex';
    document.getElementById('guard-owner-name').textContent=guardOwnerRecord.owner_name;
    document.getElementById('guard-owner-phone').textContent=guardOwnerRecord.phone_number?'+'+guardOwnerRecord.phone_number:'No phone on record';
    const ut=document.getElementById('guard-owner-type-badge');
    const vt=document.getElementById('guard-vehicle-type-badge');
    ut.textContent=guardOwnerRecord.user_type||'UNKNOWN';
    ut.className='user-type-badge ut-'+(guardOwnerRecord.user_type||'UNKNOWN').toLowerCase();
    vt.textContent=guardOwnerRecord.vehicle_type||'UNKNOWN';
    vt.className='vehicle-type-badge vt-'+(guardOwnerRecord.vehicle_type||'CAR').toLowerCase();
    showToast('Owner: '+guardOwnerRecord.owner_name,true);
  }else{
    strip.style.display='none';
    guardOwnerRecord=null;
    showToast('Vehicle not registered — tap "Register" to add');
    // Show a floating register button if not found
    const regBtnHtml = `<div id="guard-quick-reg-btn-wrap" style="margin-top:10px;text-align:center;">
      <button class="pv-btn pv-btn-primary pv-btn-full" onclick="openQuickReg()"><i class="fa-solid fa-plus-circle"></i> Register This Vehicle</button>
    </div>`;
    const wrap = document.getElementById('guard-quick-reg-btn-wrap');
    if(wrap) wrap.remove();
    document.getElementById('guard-lookup-btn').insertAdjacentHTML('afterend', regBtnHtml);
  }
  updateGuardAlertPreview();
});

// Modal Logic
window.openQuickReg = function() {
    const plate = document.getElementById('guard-plate-input').value.trim();
    document.getElementById('reg-plate-display').textContent = plate;
    document.getElementById('quick-reg-modal').classList.add('visible');
};

document.getElementById('quick-reg-close').addEventListener('click', () => {
    document.getElementById('quick-reg-modal').classList.remove('visible');
});

document.getElementById('reg-save-btn').addEventListener('click', () => {
    const plate = document.getElementById('reg-plate-display').textContent;
    const name = document.getElementById('reg-owner').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const uType = document.getElementById('reg-usertype').value;
    const vType = document.getElementById('reg-vehicletype').value;

    if(!name) { showToast('Owner name is required'); return; }

    saveParkingRecord({
        vehicle_number: plate,
        owner_name: name,
        phone_number: phone,
        user_type: uType,
        vehicle_type: vType,
        assigned_zone: 'Z3', // Default to student zone
        payment_status: 'PAID',
        allowed_time: 360,
        fine_amount: 300
    });

    document.getElementById('quick-reg-modal').classList.remove('visible');
    showToast('Vehicle registered successfully!', true);
    
    // Auto lookup again
    document.getElementById('guard-lookup-btn').click();
    const wrap = document.getElementById('guard-quick-reg-btn-wrap');
    if(wrap) wrap.remove();
});

document.getElementById('guard-whatsapp-btn').addEventListener('click',()=>{
  const plate=document.getElementById('guard-plate-input').value.trim();
  if(!plate){showToast('Enter vehicle number first');return;}
  if(!guardOwnerRecord||!guardOwnerRecord.phone_number){showToast('No phone on record — lookup owner first');return;}
  const zone=guardGPS?detectGPSZone(guardGPS.lat,guardGPS.lng):null;
  const msg=getGuardMsg(plate,zone,new Date().toLocaleString('en-IN'));
  const url='https://wa.me/'+guardOwnerRecord.phone_number+'?text='+encodeURIComponent(msg);
  if(window.cordova)window.open(url,'_system');else window.open(url,'_blank');
  showToast('Opening WhatsApp...',true);
});

document.getElementById('guard-save-btn').addEventListener('click',()=>{
  const plate=document.getElementById('guard-plate-input').value.trim();
  if(!plate){showToast('Enter vehicle number to save');return;}
  const zone=guardGPS?detectGPSZone(guardGPS.lat,guardGPS.lng):null;
  saveGuardCapture({id:Date.now().toString(),plate,owner:guardOwnerRecord?guardOwnerRecord.owner_name:'Unknown',phone:guardOwnerRecord?guardOwnerRecord.phone_number:'',lat:guardGPS?guardGPS.lat:null,lng:guardGPS?guardGPS.lng:null,zone:zone?zone.name:'Unknown',timestamp:new Date().toISOString(),photoDataUrl:guardPhotoDataUrl||null});
  showToast('Capture saved!',true);
});

window.sendWhatsAppAlert=function(plate,record,zone,result){
  const zn=zone?zone.name:(record.assigned_zone||'Unknown Zone');
  const msg=`🚨 Parking Violation!\n\nVehicle: ${plate}\nOwner: ${record.owner_name}\nZone: ${zn}\nViolation: ${result.reason_labels.join(', ')}\nFine: ₹${result.fine}\n\nPlease move your vehicle immediately.\n\n— Galgotias University`;
  if(!record.phone_number){showToast('No phone on record');return;}
  const url='https://wa.me/'+record.phone_number+'?text='+encodeURIComponent(msg);
  if(window.cordova)window.open(url,'_system');else window.open(url,'_blank');
  showToast('Opening WhatsApp...',true);
};

function renderCaptures(){
  const list=document.getElementById('captures-list');if(!list)return;
  const caps=getGuardCaptures();
  if(!caps.length){list.innerHTML='<div class="pv-empty"><i class="fa-solid fa-camera"></i><p>No captures saved yet</p></div>';return;}
  list.innerHTML=caps.map(c=>`<div class="capture-item">${c.photoDataUrl?`<img class="capture-thumb" src="${c.photoDataUrl}" alt="cap"/>`:'<div class="capture-thumb-placeholder"><i class="fa-solid fa-image"></i></div>'}<div class="capture-info"><div class="capture-plate">${c.plate}</div><div class="capture-meta">${c.owner} • ${c.zone}</div><div class="capture-meta">${new Date(c.timestamp).toLocaleString('en-IN')}</div>${c.phone?`<button class="pv-btn pv-btn-whatsapp capture-wa-btn" onclick="replayCap('${c.id}')"><i class="fa-brands fa-whatsapp"></i> Alert</button>`:''}</div><button class="pv-admin-del-btn" onclick="delCap('${c.id}')"><i class="fa-solid fa-trash"></i></button></div>`).join('');
}
window.renderCaptures=renderCaptures;
window.delCap=function(id){if(confirm('Delete capture?')){deleteGuardCapture(id);renderCaptures();}};
window.replayCap=function(id){
  const c=getGuardCaptures().find(x=>x.id===id);if(!c||!c.phone)return;
  const msg=`🚨 Parking Violation!\n\nVehicle: ${c.plate}\nZone: ${c.zone}\nTime: ${new Date(c.timestamp).toLocaleString('en-IN')}\n\nYour vehicle was in a wrong zone.\n— Galgotias University`;
  window.open('https://wa.me/'+c.phone+'?text='+encodeURIComponent(msg),'_blank');
};

document.querySelectorAll('.history-subtab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.history-subtab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.htab-panel').forEach(p=>p.classList.remove('active-htab'));
    btn.classList.add('active');
    document.getElementById('htab-'+btn.dataset.htab).classList.add('active-htab');
    if(btn.dataset.htab==='captures')renderCaptures();
  });
});

document.getElementById('clear-captures-btn').addEventListener('click',()=>{if(confirm('Clear all captures?')){localStorage.removeItem('GUARD_CAPTURES');renderCaptures();}});

document.addEventListener('DOMContentLoaded',()=>{renderZoneLegend();});
