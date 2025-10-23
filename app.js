// Simple localStorage "DB"
const DB_KEY = 'bimbel_db';

function readDB(){ return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); }
function writeDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function uid(prefix){ return prefix + Math.random().toString(36).slice(2,8).toUpperCase(); }
function today(){ return new Date().toISOString().slice(0,10); }
function genInvoice(year){
  const db = readDB(); db.seq = db.seq || 1;
  const n = db.seq.toString().padStart(4, '0');
  const inv = `INV-${year}-${n}`; db.seq += 1; writeDB(db); return inv;
}

// Seed data on first load
(function seed(){
  let db = readDB();
  if(db._seeded) return;
  db = {
    _seeded: true,
    seq: 1,
    students: [
      {id:'S001', nama:'Alya Putri', sekolah:'SMPN 1', kelas_angkatan:'9', telp:'+628123000111', email:'alya@example.com'},
      {id:'S002', nama:'Rizky Aditya', sekolah:'SMAN 3', kelas_angkatan:'12', telp:'+628123000222', email:'rizky@example.com'}
    ],
    programs: [
      {id:'P001', nama_program:'Matematika Intensif', harga:750000},
      {id:'P002', nama_program:'UTBK Camp', harga:1500000}
    ],
    classes: [
      {id:'C001', program_id:'P001', nama_kelas:'MTK-9A', hari:'Selasa', jam_mulai:'16:00', jam_selesai:'18:00', kuota:20},
      {id:'C002', program_id:'P002', nama_kelas:'UTBK-12B', hari:'Kamis', jam_mulai:'19:00', jam_selesai:'21:00', kuota:25}
    ],
    registrations: [],
    payments: []
  };
  writeDB(db);
})();

// Helpers
function byId(id){ return document.getElementById(id); }
function fmt(n){ return new Intl.NumberFormat('id-ID').format(n); }
function toast(el, html){ el.innerHTML = html; el.hidden = false; setTimeout(()=> el.hidden = true, 6000); }

function computeTerpakai(class_id){
  const db = readDB();
  return (db.registrations||[]).filter(r=>r.class_id===class_id && ['Pending','Verified'].includes(r.status)).length;
}

function classFull(c){ return computeTerpakai(c.id) >= (c.kuota||0); }

function scheduleConflict(student_id, hari, start, end){
  const db = readDB();
  const regs = db.registrations.filter(r=>r.student_id===student_id && ['Pending','Verified'].includes(r.status));
  const classes = regs.map(r=>db.classes.find(c=>c.id===r.class_id)).filter(Boolean);
  return classes.some(c=> c.hari===hari && !(end <= c.jam_mulai || start >= c.jam_selesai));
}

// Populate selects
function populateProgramSelect(){
  const db = readDB();
  const sel = byId('programSelect');
  sel.innerHTML = db.programs.map(p=>`<option value="\${p.id}">\${p.nama_program} (Rp \${fmt(p.harga)})</option>`).join('');
  populateClassSelect();
}

function populateClassSelect(){
  const db = readDB();
  const pid = byId('programSelect').value;
  const classes = db.classes.filter(c=>c.program_id===pid);
  const sel = byId('classSelect');
  sel.innerHTML = classes.map(c=>{
    const full = classFull(c);
    const label = `\${c.nama_kelas} — \${c.hari} \${c.jam_mulai}–\${c.jam_selesai} (Kuota \${computeTerpakai(c.id)}/\${c.kuota})`;
    return `<option value="\${c.id}" \${full?'disabled':''}>\${label} \${full?'[Penuh]':''}</option>`;
  }).join('');
}

document.addEventListener('change', e=>{ if(e.target.id==='programSelect') populateClassSelect(); });

// Register form
byId('formRegister').addEventListener('submit', e=>{
  e.preventDefault();
  const form = new FormData(e.target);
  const db = readDB();

  // Create or find student by email/telp
  const email = form.get('email'), telp = form.get('telp');
  let student = db.students.find(s=>s.email===email || s.telp===telp);
  if(!student){
    student = {
      id: uid('S'),
      nama: form.get('nama'),
      sekolah: form.get('sekolah')||'',
      kelas_angkatan: form.get('kelas_angkatan')||'',
      telp, email
    };
    db.students.push(student);
  }

  const class_id = form.get('class_id');
  const cls = db.classes.find(c=>c.id===class_id);
  if(!cls) return alert('Kelas tidak ditemukan.');

  if(classFull(cls)) return alert('Kelas sudah penuh.');
  if(scheduleConflict(student.id, cls.hari, cls.jam_mulai, cls.jam_selesai)) return alert('Jadwal bentrok dengan kelas lain.');

  const invoice_no = genInvoice(window.__YEAR__);
  const reg = {
    id: uid('R'),
    student_id: student.id,
    class_id,
    tanggal_daftar: today(),
    status: 'Pending',
    invoice_no
  };
  db.registrations.push(reg);
  writeDB(db);

  const program = db.programs.find(p=>p.id===cls.program_id)||{};
  const result = byId('registerResult');
  toast(result, `<b>Berhasil!</b> No. Invoice: <code>\${invoice_no}</code><br>
    Total biaya: <b>Rp \${fmt(program.harga||0)}</b><br>
    <a href="invoice.html?invoice=\${invoice_no}" target="_blank">Lihat/Cetak Invoice</a>`);
  e.target.reset();
  populateProgramSelect();
});

// Upload payment
byId('formUpload').addEventListener('submit', async e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const invoice = fd.get('invoice_no').trim();
  const contact = fd.get('contact').trim();
  const nominal = Number(fd.get('nominal'));
  const file = fd.get('bukti');

  const db = readDB();
  const reg = db.registrations.find(r=>r.invoice_no===invoice);
  if(!reg) return alert('Invoice tidak ditemukan.');
  const stu = db.students.find(s=>s.id===reg.student_id)||{};
  if(![stu.email, stu.telp].includes(contact)) return alert('Kontak tidak cocok.');

  const reader = new FileReader();
  reader.onload = ()=>{
    const bukti_url = reader.result;
    const pay = {
      id: uid('PM'),
      registration_id: reg.id,
      tanggal_bayar: today(),
      metode: 'Transfer',
      nominal,
      bukti_url,
      status: 'Pending'
    };
    db.payments.push(pay);
    reg.status = 'Pending'; // tetap pending sampai admin verify
    writeDB(db);
    toast(byId('uploadResult'), '<b>Upload sukses.</b> Menunggu verifikasi admin.');
    e.target.reset();
  };
  reader.readAsDataURL(file);
});

// Status check
byId('formStatus').addEventListener('submit', e=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const invoice = fd.get('invoice_no').trim();
  const contact = fd.get('contact').trim();
  const db = readDB();
  const reg = db.registrations.find(r=>r.invoice_no===invoice);
  if(!reg) return alert('Invoice tidak ditemukan.');
  const stu = db.students.find(s=>s.id===reg.student_id)||{};
  if(![stu.email, stu.telp].includes(contact)) return alert('Kontak tidak cocok.');
  const cls = db.classes.find(c=>c.id===reg.class_id)||{};
  const program = db.programs.find(p=>p.id===cls.program_id)||{};
  const html = `
    <p>Status: <span class="badge">\${reg.status}</span></p>
    <p>Nama: <b>\${stu.nama}</b> — Program: <b>\${program.nama_program||'-'}</b><br>
    Kelas: \${cls.nama_kelas||'-'} (\${cls.hari||'-'} \${cls.jam_mulai||'-'}–\${cls.jam_selesai||'-'})</p>
    <p>Total: <b>Rp \${fmt(program.harga||0)}</b></p>
    <p><a target="_blank" href="invoice.html?invoice=\${reg.invoice_no}">Lihat/Cetak Invoice</a></p>
  `;
  const el = byId('statusResult'); toast(el, html);
});

// Admin
const ADMIN_PASS = 'admin';
byId('btnAdminLogin').addEventListener('click', ()=>{
  const ok = byId('adminPwd').value === ADMIN_PASS;
  if(!ok) return alert('Password salah');
  byId('adminLogin').hidden = true;
  byId('adminPanel').hidden = false;
  renderAdmin();
});

byId('btnLogout').addEventListener('click', ()=>{
  byId('adminPanel').hidden = true;
  byId('adminLogin').hidden = false;
});

function renderAdmin(){
  const db = readDB();
  // Pending payments
  const tbody = document.querySelector('#tblPending tbody');
  const rows = db.payments.filter(p=>p.status==='Pending').map(p=>{
    const reg = db.registrations.find(r=>r.id===p.registration_id)||{};
    const stu = db.students.find(s=>s.id===reg.student_id)||{};
    const cls = db.classes.find(c=>c.id===reg.class_id)||{};
    const program = db.programs.find(pr=>pr.id===cls.program_id)||{};
    return `<tr>
      <td>\${reg.invoice_no}</td>
      <td>\${stu.nama}</td>
      <td>\${program.nama_program||'-'} / \${cls.nama_kelas||'-'}</td>
      <td>Rp \${fmt(p.nominal||0)}</td>
      <td>
        <button data-act="verify" data-id="\${p.id}">Verify</button>
        <button data-act="reject" data-id="\${p.id}">Reject</button>
        <a target="_blank" href="\${p.bukti_url}">Bukti</a>
      </td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="5">Tidak ada pending.</td></tr>';

  // Peserta per kelas
  const tb2 = document.querySelector('#tblPeserta tbody');
  const rows2 = db.classes.map(c=>{
    const terpakai = computeTerpakai(c.id);
    return `<tr>
      <td>\${c.nama_kelas}</td>
      <td>\${c.hari}</td>
      <td>\${c.jam_mulai}–\${c.jam_selesai}</td>
      <td>\${c.kuota}</td>
      <td>\${terpakai}</td>
    </tr>`;
  }).join('');
  tb2.innerHTML = rows2;
}

document.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-act]');
  if(!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  const db = readDB();
  const p = db.payments.find(x=>x.id===id);
  if(!p) return;
  const reg = db.registrations.find(r=>r.id===p.registration_id);
  if(act==='verify'){ p.status='Verified'; if(reg) reg.status='Verified'; }
  if(act==='reject'){ p.status='Rejected'; if(reg) reg.status='Rejected'; }
  writeDB(db);
  renderAdmin();
});

// Export CSV
function toCSV(rows, headers){
  const esc = v => '"' + (String(v||'').replace(/"/g,'""')) + '"';
  return [headers.join(','), ...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n');
}
byId('btnExportRegs').addEventListener('click', ()=>{
  const db = readDB();
  const headers = ['id','invoice_no','student_id','class_id','tanggal_daftar','status'];
  const csv = toCSV(db.registrations, headers);
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'registrations.csv'; a.click();
});
byId('btnExportPayments').addEventListener('click', ()=>{
  const db = readDB();
  const headers = ['id','registration_id','tanggal_bayar','metode','nominal','status'];
  const csv = toCSV(db.payments, headers);
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'payments.csv'; a.click();
});

// Init
populateProgramSelect();
populateClassSelect();
