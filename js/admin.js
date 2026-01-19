/* ===== دوال مساعدة ===== */
function normalizePhone(raw){
  const digits = (raw || '').replace(/\D/g,'');
  if(!digits) return '';
  if(digits.startsWith('0')) return '213' + digits.slice(1);
  if(digits.startsWith('213')) return digits;
  if(digits.length === 8) return '213' + digits;
  return digits;
}

async function sha256(message){
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
}

/* ===== حماية كلمة المرور ثابتة abdou1129 ===== */
(async function checkPassword(){
  const saved = sessionStorage.getItem("admin_ok");
  if(saved === "true"){
    document.getElementById("mainContent").style.display = "block";
    loadProfessionals();
    return;
  }

  const ADMIN_HASH = "027c801e6dee2a214c57904960a5ef1856bf826e814f806c6790e096f21fe84f"; // abdou1129

  const input = prompt("أدخل كلمة مرور لوحة الإدارة:");
  const h = await sha256(input || '');
  if(h === ADMIN_HASH){
    sessionStorage.setItem("admin_ok","true");
    document.getElementById("mainContent").style.display = "block";
    loadProfessionals();
  } else{
    alert("كلمة المرور غير صحيحة");
    location.reload();
  }
})();

/* ===== زر تسجيل الخروج ===== */
function logout(){
  sessionStorage.removeItem("admin_ok");
  location.reload();
}

/* ===== زر العملاء ===== */
function goToCustomers() {
  window.location.href = 'customers.html';
}

/* ===== إدارة لوحة المهنيين ===== */
let currentFilter = 'all';

function setFilter(filter){
  currentFilter = filter;
  loadProfessionals();
}

function loadProfessionals() {
  let pros = JSON.parse(localStorage.getItem('professionals') || '[]');
  const tbody = document.getElementById('prosTable');
  tbody.innerHTML = '';

  let notifiedExpired = JSON.parse(localStorage.getItem('notifiedExpired') || '{}');
  const now = new Date();

  pros.forEach((pro) => {
    let remaining = '-';
    let statusClass = '';
    const status = pro.subscription?.status || 'pending';

    if(status === 'active'){
      const endTime = new Date(pro.subscription.end_at);
      const diff = endTime - now;
      if(diff > 0){
        const hours = Math.floor(diff / 1000 / 60 / 60);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        remaining = `${hours}س ${minutes}د ${seconds}ث`;
        statusClass = 'active-status';
      } else {
        pro.subscription.status = 'expired';
        remaining = 'انتهى';
        statusClass = 'expired-status';
        if(!notifiedExpired[pro.phone]){
          notifiedExpired[pro.phone] = true;
        }
      }
    }

    if(status === 'rejected') { statusClass = 'rejected-status'; remaining = '-'; }
    if(status === 'pending') { statusClass = 'pending-status'; remaining = '-'; }

    if(currentFilter === 'all' || currentFilter === pro.subscription?.status || (currentFilter === 'pending' && pro.subscription?.status === 'pending')){
      const phone = pro.phone;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${pro.name}</td>
        <td>${pro.phone}</td>
        <td>${pro.service}</td>
        <td>${pro.city}</td>
        <td>${pro.subscription?.plan || '-'}</td>
        <td>${pro.subscription?.transaction || '-'}</td>
        <td class="${statusClass}">${pro.subscription?.status || 'pending'}</td>
        <td>${remaining}</td>
        <td>
          <button class="activate" onclick="activateByPhone('${phone}')">تفعيل</button>
          <button class="reject" onclick="rejectByPhone('${phone}')">رفض</button>
          <button class="whatsapp" onclick="sendWhatsAppByPhone('${phone}')">واتساب</button>
          ${ (pro.subscription?.status === 'expired') ? `<button style="background:#F97316;" onclick="sendExpiryMessage('${phone}')">إرسال إشعار انتهاء</button>` : '' }
        </td>
      `;
      tbody.appendChild(tr);
    }
  });

  localStorage.setItem('professionals', JSON.stringify(pros));
  localStorage.setItem('notifiedExpired', JSON.stringify(notifiedExpired));
}

function activateByPhone(phone){
  const pros = JSON.parse(localStorage.getItem('professionals') || '[]');
  const idx = pros.findIndex(p => p.phone === phone);
  if(idx === -1){ alert('المهني غير موجود'); return; }
  const plan = pros[idx].subscription?.plan;
  const now = new Date();

  let durationMs = 0;
  if(plan === 'basic') durationMs = 30*24*60*60*1000;
  if(plan === 'pro') durationMs = 90*24*60*60*1000;
  if(plan === 'premium') durationMs = 365*24*60*60*1000;

  pros[idx].subscription = pros[idx].subscription || {};
  pros[idx].subscription.status = 'active';
  pros[idx].subscription.end_at = new Date(now.getTime() + durationMs).toISOString();

  localStorage.setItem('professionals', JSON.stringify(pros));
  loadProfessionals();
  sendWhatsAppByPhone(phone, true);
}

function rejectByPhone(phone){
  const pros = JSON.parse(localStorage.getItem('professionals') || '[]');
  const idx = pros.findIndex(p => p.phone === phone);
  if(idx === -1){ alert('المهني غير موجود'); return; }
  pros[idx].subscription = pros[idx].subscription || {};
  pros[idx].subscription.status = 'rejected';
  localStorage.setItem('professionals', JSON.stringify(pros));
  loadProfessionals();
}

function sendWhatsAppByPhone(phone, activated=false){
  const pros = JSON.parse(localStorage.getItem('professionals') || '[]');
  const pro = pros.find(p => p.phone === phone);
  if(!pro){ alert('المهني غير موجود'); return; }
  const phoneIntl = normalizePhone(pro.phone);
  let text = activated
    ? `مرحباً ${pro.name}، تم تفعيل اشتراكك في HandyDZ. يمكنك البدء باستخدام الخدمة الآن.`
    : `مرحباً ${pro.name}، هذه رسالة من إدارة HandyDZ.`;
  const waLink = `https://wa.me/${phoneIntl}?text=${encodeURIComponent(text)}`;
  window.open(waLink, "_blank");
}

function sendExpiryMessage(phone){
  const pros = JSON.parse(localStorage.getItem('professionals') || '[]');
  const pro = pros.find(p => p.phone === phone);
  if(!pro){ alert('المهني غير موجود'); return; }
  const phoneIntl = normalizePhone(pro.phone);
  const text = `مرحباً ${pro.name}، انتهى اشتراكك في HandyDZ. يرجى تجديد الاشتراك للاستمرار.`;
  const waLink = `https://wa.me/${phoneIntl}?text=${encodeURIComponent(text)}`;
  window.open(waLink, "_blank");
}

if(!localStorage.getItem('notifiedExpired')){
  localStorage.setItem('notifiedExpired', JSON.stringify({}));
}

setInterval(loadProfessionals, 60000);
