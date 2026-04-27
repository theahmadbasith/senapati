// ══════════════════════════════════════════════════════════
//  API CLIENT — Semua panggilan ke Vercel API Route
//  BASE_URL otomatis deteksi (dev vs prod)
// ══════════════════════════════════════════════════════════
var BASE_URL = (function () {
  var host = window.location.origin;
  if (host.startsWith('file://')) return 'http://localhost:3000';
  return host;
})();

async function callAPI(action, payload) {
  try {
    var res = await fetch(BASE_URL + '/api/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, payload: payload || {} })
    });

    var data = null;
    try { data = await res.json(); } catch (e) { }

    if (!res.ok) {
      if (data && data.message) throw new Error(data.message);
      throw new Error('HTTP ' + res.status);
    }
    return data;
  } catch (err) {
    var badge = document.getElementById('api-status-badge');
    if (badge) { badge.className = 'api-status error'; badge.innerHTML = '<i class="bi bi-circle-fill"></i> Offline'; }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════
var APP = { user: null, currentPage: 'dashboard' };
var currentEditData = null;

// ══════════════════════════════════════════════════════════
//  SPINNER & TOAST
// ══════════════════════════════════════════════════════════
function showSpinner(label) {
  document.getElementById('spinner-label').textContent = label || 'Memproses...';
  document.getElementById('spinner-overlay').classList.add('active');
}
function hideSpinner() {
  document.getElementById('spinner-overlay').classList.remove('active');
}
function showToast(msg, type) {
  var icons = { success: 'check-circle-fill', error: 'x-circle-fill', info: 'info-circle-fill' };
  var el = document.createElement('div');
  el.className = 'toast-msg ' + (type || 'info');
  el.innerHTML = '<i class="bi bi-' + (icons[type] || icons.info) + '"></i><span>' + esc(msg) + '</span>';
  document.getElementById('toast-container').appendChild(el);
  setTimeout(function () { el.remove(); }, 4500);
}

// ══════════════════════════════════════════════════════════
//  THEME (DARK MODE)
// ══════════════════════════════════════════════════════════
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('senapati_theme', isDark ? 'dark' : 'light');
  document.getElementById('theme-icon').className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
}

function initTheme() {
  const savedTheme = localStorage.getItem('senapati_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    const ti = document.getElementById('theme-icon');
    if (ti) ti.className = 'bi bi-sun-fill';
  }
}

// ══════════════════════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════════════════════
function startClock() {
  function tick() {
    var now = new Date();
    var el = document.getElementById('clock');
    if (el) el.textContent = now.toLocaleTimeString('id-ID');
    var dt = document.getElementById('info-date');
    if (dt) dt.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  tick();
  setInterval(tick, 1000);
}

// ══════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════
var PAGE_TITLES = {
  dashboard: 'Dashboard',
  agenda: 'Agenda Kegiatan',
  'surat-masuk': 'Surat Masuk',
  disposisi: 'Sistem Disposisi',
  arsip: 'Arsip Digital',
  peta: 'Peta Agenda Kegiatan',
  panduan: 'Panduan Teknis SENAPATI',
  pengaturan: 'Pengaturan Sistem',
  'template-surat': 'Template Surat',
  'buat-surat': 'Buat Surat'
};

var PAGE_SUBS = {
  dashboard: 'Ringkasan data agenda dan tata informasi',
  agenda: 'Jadwal kegiatan Bupati Ponorogo per tanggal',
  'surat-masuk': 'Manajemen Arsip Surat Masuk',
  disposisi: 'Aliran disposisi pimpinan',
  arsip: 'Upload & kelola dokumen arsip digital',
  peta: 'Visualisasi lokasi agenda secara interaktif',
  panduan: 'Dokumentasi lengkap fitur SENAPATI',
  pengaturan: 'Konfigurasi akun & sistem',
  'template-surat': 'Kelola koleksi template dokumen .docx',
  'buat-surat': 'Generate surat dari template secara otomatis'
};

// Role-based menu visibility
function applyRoleVisibility(role) {
  // Semua menu di-show dulu
  document.querySelectorAll('.nav-link-item').forEach(function (el) { el.style.display = ''; });

  if (role === 'PROTOKOL') {
    // PROTOKOL: Fokus pada Agenda & Undangan. Bisa lihat surat tapi tidak bisa hapus/pengaturan.
    var hidenForProtokol = ['pengaturan', 'users-mgmt']; // assume users-mgmt is a sub-selector or logic
    document.querySelector('[data-page="pengaturan"]').style.display = 'none';

    // Sembunyikan tombol hapus di tabel-tabel utama (opsional, bisa lebih granular)
    // Untuk saat ini cukup sembunyikan Pengaturan sesuai request.
  } else if (role === 'USER') {
    // USER: Hanya bisa melihat, tidak bisa tambah/edit/hapus/pengaturan
    document.querySelector('[data-page="pengaturan"]').style.display = 'none';
    document.querySelectorAll('.btn-primary-custom, .btn-warning-custom, .btn-danger-custom').forEach(function (btn) {
      // Kecuali tombol login/logout/search/refresh/preview
      if (!btn.closest('.page-header') && !btn.onclick?.toString().includes('load') && !btn.onclick?.toString().includes('Preview') && !btn.onclick?.toString().includes('print')) {
        // ini logic kasar, sebaiknya di masing-masing render function
      }
    });
  }
}

function navigateTo(page) {
  // Cek hak akses role sederhana
  var role = APP.user ? APP.user.role : 'USER';
  var adminOnly = ['pengaturan'];
  if (adminOnly.indexOf(page) !== -1 && role !== 'ADMIN') {
    showToast('Anda tidak memiliki akses ke halaman ini.', 'error'); return;
  }

  document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });

  // Semua page ID sekarang langsung 1:1
  var targetPageId = page;
  // Legacy redirect: 'surat' → dashboard
  if (page === 'surat') { targetPageId = 'dashboard'; }

  var target = document.getElementById('page-' + targetPageId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-link-item, .sub-nav-item').forEach(function (l) { l.classList.remove('active'); });
  var activeLink = document.querySelector('[data-page="' + page + '"]');
  if (activeLink) {
    activeLink.classList.add('active');
    // Jika itu sub-menu, pastikan parent tetap terbuka
    var subMenu = activeLink.closest('.sub-menu');
    if (subMenu) subMenu.classList.add('open');
  }

  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;
  document.getElementById('topbar-sub').textContent = PAGE_SUBS[page] || '';
  APP.currentPage = page;
  closeSidebar();

  if (page === 'dashboard') loadDashboard();
  if (page === 'agenda') loadAgenda();
  if (page === 'surat-masuk') loadSuratMasuk();
  if (page === 'disposisi') loadDisposisi();
  if (page === 'arsip') loadArsip();
  if (page === 'peta') {
    loadPeta();
    document.getElementById('main-content').classList.add('peta-mode');
    // Tunggu DOM render lalu paksa Leaflet ukur ulang ukuran container
    setTimeout(function () { if (typeof _lfMap !== 'undefined' && _lfMap) _lfMap.invalidateSize({ animate: false }); }, 200);
    setTimeout(function () { if (typeof _lfMap !== 'undefined' && _lfMap) _lfMap.invalidateSize({ animate: false }); }, 600);
  } else {
    document.getElementById('main-content').classList.remove('peta-mode');
  }
  if (page === 'template-surat') { loadTemplates(); }
  if (page === 'buat-surat') { loadTemplatesForGenerator(); }
  if (page === 'pengaturan') {
    loadUsers();
    loadKopSettings();
    var chgEl = document.getElementById('chg-username');
    if (chgEl) chgEl.value = APP.user ? APP.user.username : '';
  }
}

function toggleSubMenu(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// Tab helper untuk sub-navigasi Surat Keluar
function setSkTab(activeTabId) {
  document.querySelectorAll('#tab-sk-arsip, #tab-sk-tugas, #tab-sk-perintah').forEach(function (t) {
    t.classList.remove('active');
  });
  var active = document.getElementById(activeTabId);
  if (active) active.classList.add('active');
}

// Navigate sub-menu Surat Keluar ke halaman terpisah
function navigateSkSub(page) {
  navigateTo(page);
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}

function toggleCollapse(contentId, trigger) {
  var el = document.getElementById(contentId);
  if (!el) return;
  el.classList.toggle('collapsed');
  if (trigger) trigger.classList.toggle('collapsed');
}

function togglePanduanAccordion(header) {
  var body = header.nextElementSibling;
  var isOpen = body.classList.contains('open');
  // close all first
  document.querySelectorAll('.panduan-accordion-body').forEach(function (b) { b.classList.remove('open'); });
  document.querySelectorAll('.panduan-accordion-header').forEach(function (h) { h.classList.remove('open'); });
  if (!isOpen) {
    body.classList.add('open');
    header.classList.add('open');
  }
}

function togglePwd(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (inp.type === 'password') { inp.type = 'text'; btn.innerHTML = '<i class="bi bi-eye-slash"></i>'; }
  else { inp.type = 'password'; btn.innerHTML = '<i class="bi bi-eye"></i>'; }
}

// ══════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ══════════════════════════════════════════════════════════
async function doLogin() {
  var u = document.getElementById('login-username').value.trim();
  var p = document.getElementById('login-password').value;
  if (!u || !p) { showToast('Username dan password wajib diisi.', 'error'); return; }
  showSpinner('Memverifikasi...');
  try {
    var res = await callAPI('login', { username: u, password: p });
    hideSpinner();
    if (res.success) {
      APP.user = res.user;
      document.getElementById('view-login').style.display = 'none';
      document.getElementById('app-shell').style.display = 'block';
      document.getElementById('user-nama').textContent = res.user.nama;
      document.getElementById('user-role').textContent = res.user.role;
      document.getElementById('user-avatar').textContent = res.user.nama.charAt(0).toUpperCase();
      document.getElementById('info-user').textContent = res.user.nama;
      document.getElementById('chg-username').value = res.user.username;
      applyRoleVisibility(res.user.role);
      startClock();
      navigateTo('dashboard');
      showToast('Selamat datang, ' + res.user.nama + '!', 'success');
    } else {
      showToast(res.message, 'error');
    }
  } catch (err) {
    hideSpinner();
    showToast('Gagal terhubung ke server: ' + err.message, 'error');
  }
}

function doLogout() {
  if (!confirm('Yakin ingin keluar?')) return;
  APP.user = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('view-login').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  showToast('Berhasil keluar.', 'info');
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    var res = await callAPI('getDashboard', {});
    if (res.success) {
      animateCount('stat-masuk', res.suratMasuk || 0);
      animateCount('stat-agenda', res.agenda || 0);
      animateCount('stat-disposisi', res.disposisi || 0);
      animateCount('stat-arsip', res.arsip || 0);
      // Arsip detail breakdown
      animateCount('stat-kpt', res.countKpt || 0);
      animateCount('stat-ins', res.countIns || 0);
      animateCount('stat-perbup', res.countPerbup || 0);
      animateCount('stat-perda', res.countPerda || 0);
      animateCount('stat-seb', res.countSeb || 0);
      animateCount('stat-ndi', res.countNdi || 0);
      animateCount('stat-mem', res.countMem || 0);
      animateCount('stat-misc', res.countMisc || 0);
    }
  } catch (err) { /* silent */ }
}

function animateCount(id, target) {
  var el = document.getElementById(id);
  if (!el) return;
  var start = 0;
  var step = Math.max(1, Math.ceil(target / 30));
  var timer = setInterval(function () {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 20);
}

// ══════════════════════════════════════════════════════════
//  FILE HANDLING
// ══════════════════════════════════════════════════════════
function handleFileSelect(inputId, infoId) {
  var file = document.getElementById(inputId).files[0];
  if (!file) return;
  document.getElementById(infoId).textContent = '📎 ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
}

function readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var base64 = e.target.result.split(',')[1];
      resolve({
        content: base64,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: (file.size / 1024).toFixed(1) + ' KB'
      });
      document.getElementById('spinner-label').textContent = 'Memproses unggahan (File siap)...';
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════
//  ARSIP
// ══════════════════════════════════════════════════════════
async function submitArsip() {
  var nama = document.getElementById('arsip-nama').value.trim();
  var kategori = document.getElementById('arsip-kategori').value;
  var deskripsi = document.getElementById('arsip-deskripsi').value.trim();
  var tglArsip = document.getElementById('arsip-tgl').value;
  var fileEl = document.getElementById('arsip-file');
  if (!nama) { showToast('Nama file wajib diisi.', 'error'); return; }
  if (!kategori) { showToast('Kategori wajib dipilih.', 'error'); return; }
  if (!tglArsip) { showToast('Tanggal arsip wajib diisi.', 'error'); return; }
  if (!fileEl.files[0]) { showToast('File wajib diunggah.', 'error'); return; }
  showSpinner('Mengunggah arsip ke Google Drive...');
  try {
    var fd = await readFileAsBase64(fileEl.files[0]);
    var res = await callAPI('saveArsip', { data: { namaFile: nama, kategori: kategori, deskripsi: deskripsi, tglArsip: tglArsip }, fileData: fd });
    hideSpinner();
    if (res.success) {
      showToast(res.message, 'success');
      resetFields(['arsip-nama', 'arsip-deskripsi']);
      document.getElementById('arsip-kategori').value = '';
      fileEl.value = '';
      document.getElementById('arsip-file-info').textContent = '';
      togglePanel('arsip-form-panel');
      loadArsip();
    } else showToast(res.message, 'error');
  } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
}

async function loadArsip() {
  try {
    var res = await callAPI('getArsip', {});
    var tbody = document.getElementById('arsip-tbody');
    if (!res.success || !res.data.length) {
      tbody.innerHTML = '<tr class="no-data"><td colspan="9"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>Belum ada data arsip</td></tr>'; return;
    }
    tbody.innerHTML = res.data.map(function (d, i) {
      var safeData = encodeURIComponent(JSON.stringify(d));
      var tglArs = d['Tanggal Arsip'] ? fmtDate(d['Tanggal Arsip']) : '-';
      var url = d['URL'] || d['File URL'];
      var actBtn = url ? '<button class="btn-link-custom" onclick="openPreview(\'' + url + '\')"><i class="bi bi-eye"></i> Lihat</button>' : '';
      return '<tr><td>' + (i + 1) + '</td><td><strong>' + esc(d['Nama File']) + '</strong></td><td><span class="badge-cat arsip">' + esc(d['Kategori']) + '</span></td><td>' + esc(d['Folder']) + '</td><td>' + esc(d['Deskripsi']) + '</td><td>' + esc(d['Ukuran']) + '</td><td>' + tglArs + '</td><td>' + fmtDate(d['DibuatPada'] || d['CreatedAt']) + '</td><td class="action-col" style="display:flex;gap:6px">' + actBtn + '<button class="btn-warning-custom" onclick="openEditModal(\'Arsip\', \'' + safeData + '\')"><i class="bi bi-pencil"></i></button><button class="btn-danger-custom" onclick="deleteItem(\'deleteArsip\',\'' + d['ID'] + '\',loadArsip)"><i class="bi bi-trash"></i></button></td></tr>';
    }).join('');
  } catch (err) { showToast('Gagal memuat arsip: ' + err.message, 'error'); }
}

// ══════════════════════════════════════════════════════════
//  SURAT MASUK
// ══════════════════════════════════════════════════════════
async function submitSuratMasuk() {
  var data = { nomorSurat: v('sm-nomor'), tanggal: v('sm-tanggal'), pengirim: v('sm-pengirim'), perihal: v('sm-perihal'), kategori: v('sm-kategori'), catatan: v('sm-catatan') };
  if (!data.nomorSurat || !data.tanggal || !data.pengirim || !data.perihal) { showToast('Lengkapi field yang wajib diisi.', 'error'); return; }
  showSpinner('Menyimpan surat masuk...');
  try {
    var fileEl = document.getElementById('sm-file');
    var fd = fileEl.files[0] ? await readFileAsBase64(fileEl.files[0]) : null;
    var res = await callAPI('saveSuratMasuk', { data: data, fileData: fd });
    hideSpinner();
    if (res.success) {
      showToast(res.message, 'success');
      resetFields(['sm-nomor', 'sm-tanggal', 'sm-pengirim', 'sm-perihal', 'sm-catatan']);
      fileEl.value = ''; document.getElementById('sm-file-info').textContent = '';
      togglePanel('form-masuk'); loadSuratMasuk();
    } else showToast(res.message, 'error');
  } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
}

async function loadSuratMasuk() {
  try {
    var res = await callAPI('getSuratMasuk', {});
    renderSuratTable('tbody-sm', res, ['Nomor Surat', 'Tanggal', 'Pengirim', 'Perihal', 'Kategori'], 'masuk', 'deleteSuratMasuk', loadSuratMasuk);
  } catch (err) { /* silent */ }
}


// Agenda
function toggleDisposisiField() {
  var status = document.getElementById('ag-status');
  var card = document.getElementById('ag-disposisi-card');
  if (!status || !card) return;
  card.style.display = (status.value === 'Disposisi') ? 'block' : 'none';
}

async function submitAgenda() {
  var namaKegiatan = v('ag-nama');
  var tanggal = v('ag-tanggal');
  if (!namaKegiatan || !tanggal) { showToast('Nama Kegiatan dan Tanggal wajib diisi.', 'error'); return; }
  var status = v('ag-status') || 'Hadir';
  if (status === 'Disposisi' && !v('ag-disposisikepada')) { showToast('Field Didisposisikan Kepada wajib diisi!', 'error'); return; }
  var data = {
    nomorSuratRef: v('ag-nomor'), namaKegiatan: namaKegiatan, tanggal: tanggal,
    lokasi: v('ag-lokasi'), waktu: v('ag-waktu'), pakaian: v('ag-pakaian'),
    transit: v('ag-transit'), keterangan: v('ag-keterangan'),
    statusKehadiran: status, disposisiKepada: v('ag-disposisikepada'),
    instruksi: v('ag-instruksi'), disposisiDari: 'Bupati',
    sambutan: v('ag-sambutan'), sapaan: v('ag-sapaan'),
    latitude: v('ag-lat') || '', longitude: v('ag-lng') || ''
  };
  showSpinner('Menyimpan Agenda...');
  try {
    var res = await callAPI('saveAgenda', { data: data });
    hideSpinner();
    if (res.success) {
      showToast(res.message, 'success');
      resetFields(['ag-nomor', 'ag-tanggal', 'ag-nama', 'ag-lokasi', 'ag-waktu', 'ag-pakaian', 'ag-transit', 'ag-keterangan', 'ag-disposisikepada', 'ag-instruksi', 'ag-sambutan', 'ag-sapaan', 'ag-lat', 'ag-lng']);
      var prevEl = document.getElementById('ag-coord-preview'); if (prevEl) prevEl.style.display = 'none';
      if (document.getElementById('ag-status')) document.getElementById('ag-status').value = 'Hadir';
      if (document.getElementById('ag-disposisi-card')) document.getElementById('ag-disposisi-card').style.display = 'none';
      togglePanel('form-agenda'); loadAgenda();
    } else showToast(res.message, 'error');
  } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
}

async function loadAgenda() {
  try {
    var res = await callAPI('getAgenda', {});
    var timeline = document.getElementById('agenda-timeline');
    var emptyPanel = document.getElementById('agenda-empty-panel');
    if (!timeline) return;
    if (!res.success || !res.data.length) {
      timeline.innerHTML = '';
      if (emptyPanel) emptyPanel.style.display = 'block';
      return;
    }
    if (emptyPanel) emptyPanel.style.display = 'none';

    // Group by tanggal
    var groups = {};
    res.data.forEach(function (d) {
      var tgl = d['Tanggal'] || 'Tanpa Tanggal';
      if (!groups[tgl]) groups[tgl] = [];
      groups[tgl].push(d);
    });

    // Sort tanggal descending
    var sortedDates = Object.keys(groups).sort(function (a, b) {
      return new Date(b) - new Date(a);
    });

    timeline.innerHTML = sortedDates.map(function (tgl) {
      var items = groups[tgl];
      var tglLabel = tgl === 'Tanpa Tanggal' ? tgl : new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      var cards = items.map(function (d) {
        var safeData = encodeURIComponent(JSON.stringify(d));
        var status = d['Status Kehadiran'] || '-';
        var statusColor = status === 'Hadir' ? '#16a34a' : (status === 'Disposisi' ? '#b45309' : '#e11d48');
        var statusIcon = status === 'Hadir' ? 'check-circle-fill' : (status === 'Disposisi' ? 'arrow-right-circle-fill' : 'x-circle-fill');
        return '<div style="background:var(--panel-bg);border:1px solid var(--border);border-left:4px solid ' + statusColor + ';border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
          '<div style="font-weight:700;font-size:.95rem;color:var(--text-main)">' + esc(d['Nama Kegiatan'] || '-') + '</div>' +
          '<span style="font-size:.75rem;color:' + statusColor + ';background:' + statusColor + '22;padding:3px 9px;border-radius:20px;white-space:nowrap;display:flex;align-items:center;gap:4px"><i class="bi bi-' + statusIcon + '"></i> ' + esc(status) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;color:var(--text-muted)">' +
          (d['Waktu'] ? '<span><i class="bi bi-clock"></i> ' + esc(d['Waktu']) + '</span>' : '') +
          (d['Lokasi'] ? '<span><i class="bi bi-geo-alt"></i> ' + esc(d['Lokasi']) + '</span>' : '') +
          (d['Pakaian'] ? '<span><i class="bi bi-person-bounding-box"></i> ' + esc(d['Pakaian']) + '</span>' : '') +
          '</div>' +
          (d['Keterangan'] && d['Keterangan'] !== '-' ? '<div style="font-size:.8rem;color:var(--text-muted);font-style:italic">' + esc(d['Keterangan']) + '</div>' : '') +
          '<div style="display:flex;gap:6px;margin-top:4px;justify-content:space-between;align-items:center">' +
          (d['Latitude'] && d['Longitude'] ? '<span style="font-size:.7rem;color:#1e6fd9;display:flex;align-items:center;gap:4px"><i class="bi bi-geo-alt-fill"></i>' + parseFloat(d['Latitude']).toFixed(5) + ', ' + parseFloat(d['Longitude']).toFixed(5) + '</span>' : '<span></span>') +
          '<div style="display:flex;gap:6px">' +
          '<button class="btn-warning-custom" style="padding:4px 10px;font-size:.75rem" onclick="openEditModal(\'Agenda\',\'' + safeData + '\')"><i class="bi bi-pencil"></i></button>' +
          '<button class="btn-danger-custom" style="padding:4px 10px;font-size:.75rem" onclick="deleteItem(\'deleteAgenda\',\'' + d['ID'] + '\',loadAgenda)"><i class="bi bi-trash"></i></button>' +
          '</div></div>' +
          '</div>';
      }).join('');

      return '<div style="margin-bottom:24px">' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
        '<div style="background:var(--primary);color:#fff;border-radius:8px;padding:8px 14px;font-weight:700;font-size:.85rem;white-space:nowrap">' +
        '<i class="bi bi-calendar3"></i> ' + tglLabel +
        '</div>' +
        '<div style="flex:1;height:2px;background:var(--border)"></div>' +
        '<div style="font-size:.78rem;color:var(--text-muted)">' + items.length + ' agenda</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' + cards + '</div>' +
        '</div>';
    }).join('');
  } catch (err) { console.error('loadAgenda error:', err); }
}


// ══════════════════════════════════════════════════════
//  PICK MAP (Crosshair Map Picker)
// ══════════════════════════════════════════════════════
var _pickMap = null;
var _pickMapContext = 'add'; // 'add' or 'edit'

function openPickMapModal(context) {
  _pickMapContext = context || 'add';
  var modal = document.getElementById('pick-map-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Pre-fill search from lokasi field
  var lokasiVal = context === 'edit' ? (document.getElementById('ed-ag-lokasi') ? document.getElementById('ed-ag-lokasi').value : '') : (document.getElementById('ag-lokasi') ? document.getElementById('ag-lokasi').value : '');
  var searchEl = document.getElementById('pick-map-search');
  if (searchEl && lokasiVal) searchEl.value = lokasiVal;

  // Init map
  setTimeout(function () {
    if (_pickMap) {
      _pickMap.invalidateSize();
    } else {
      // Default center: Ponorogo
      var initLat = -7.8648, initLng = 111.4637, initZoom = 13;

      // Jika sudah ada koordinat, pakai itu
      var latId = context === 'edit' ? 'ed-ag-lat' : 'ag-lat';
      var lngId = context === 'edit' ? 'ed-ag-lng' : 'ag-lng';
      var existLat = parseFloat(document.getElementById(latId) ? document.getElementById(latId).value : '');
      var existLng = parseFloat(document.getElementById(lngId) ? document.getElementById(lngId).value : '');
      if (!isNaN(existLat) && !isNaN(existLng) && existLat !== 0) {
        initLat = existLat; initLng = existLng; initZoom = 16;
      }

      _pickMap = L.map('pick-map-div', { center: [initLat, initLng], zoom: initZoom, zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_pickMap);

      // Klik langsung set koordinat
      _pickMap.on('click', function (e) {
        _pickMap.setView(e.latlng, _pickMap.getZoom());
      });
    }

    // Update koordinat saat peta bergerak
    _pickMap.on('moveend', _updatePickMapCoords);
    _updatePickMapCoords();
  }, 100);
}

function _updatePickMapCoords() {
  if (!_pickMap) return;
  var c = _pickMap.getCenter();
  var coordEl = document.getElementById('pick-map-coords');
  if (coordEl) coordEl.textContent = c.lat.toFixed(6) + ', ' + c.lng.toFixed(6);
}

function closePickMapModal() {
  var modal = document.getElementById('pick-map-modal');
  if (modal) modal.style.display = 'none';
}

function confirmPickMapCoords() {
  if (!_pickMap) return;
  var c = _pickMap.getCenter();
  var lat = c.lat.toFixed(7), lng = c.lng.toFixed(7);

  if (_pickMapContext === 'edit') {
    var latEl = document.getElementById('ed-ag-lat');
    var lngEl = document.getElementById('ed-ag-lng');
    if (latEl) latEl.value = lat;
    if (lngEl) lngEl.value = lng;
    syncPickMapPreview('edit');
  } else {
    var latEl2 = document.getElementById('ag-lat');
    var lngEl2 = document.getElementById('ag-lng');
    if (latEl2) latEl2.value = lat;
    if (lngEl2) lngEl2.value = lng;
    syncPickMapPreview('add');
  }
  closePickMapModal();
  showToast('Koordinat berhasil dipilih: ' + lat + ', ' + lng, 'success');
}

function clearPickMapCoords() {
  if (_pickMapContext === 'edit') {
    var el1 = document.getElementById('ed-ag-lat'); if (el1) el1.value = '';
    var el2 = document.getElementById('ed-ag-lng'); if (el2) el2.value = '';
    var prev = document.getElementById('ed-ag-coord-preview'); if (prev) prev.style.display = 'none';
  } else {
    var el3 = document.getElementById('ag-lat'); if (el3) el3.value = '';
    var el4 = document.getElementById('ag-lng'); if (el4) el4.value = '';
    var prev2 = document.getElementById('ag-coord-preview'); if (prev2) prev2.style.display = 'none';
  }
  closePickMapModal();
}

function syncPickMapPreview(context) {
  if (context === 'edit') {
    var latEl = document.getElementById('ed-ag-lat');
    var lngEl = document.getElementById('ed-ag-lng');
    var prevEl = document.getElementById('ed-ag-coord-preview');
    var txtEl = document.getElementById('ed-ag-coord-preview-txt');
    if (!latEl || !lngEl || !prevEl) return;
    var lat = parseFloat(latEl.value), lng = parseFloat(lngEl.value);
    if (!isNaN(lat) && !isNaN(lng) && latEl.value && lngEl.value) {
      if (txtEl) txtEl.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
      prevEl.style.display = 'flex';
    } else {
      prevEl.style.display = 'none';
    }
  } else {
    var latEl2 = document.getElementById('ag-lat');
    var lngEl2 = document.getElementById('ag-lng');
    var prevEl2 = document.getElementById('ag-coord-preview');
    var txtEl2 = document.getElementById('ag-coord-preview-txt');
    if (!latEl2 || !lngEl2 || !prevEl2) return;
    var lat2 = parseFloat(latEl2.value), lng2 = parseFloat(lngEl2.value);
    if (!isNaN(lat2) && !isNaN(lng2) && latEl2.value && lngEl2.value) {
      if (txtEl2) txtEl2.textContent = lat2.toFixed(6) + ', ' + lng2.toFixed(6);
      prevEl2.style.display = 'flex';
    } else {
      prevEl2.style.display = 'none';
    }
  }
}

function searchPickMapAddr() {
  var q = document.getElementById('pick-map-search');
  if (!q || !q.value.trim()) return;
  var query = encodeURIComponent(q.value.trim() + ', Ponorogo');
  showSpinner('Mencari lokasi...');
  fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + query + '&limit=1', {
    headers: { 'Accept-Language': 'id' }
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      hideSpinner();
      if (data && data[0]) {
        var lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
        if (_pickMap) {
          _pickMap.setView([lat, lng], 17, { animate: true });
        }
        showToast('Ditemukan: ' + data[0].display_name.substring(0, 60), 'success');
      } else {
        showToast('Lokasi tidak ditemukan. Coba kata kunci lain.', 'error');
      }
    })
    .catch(function () { hideSpinner(); showToast('Gagal mencari lokasi.', 'error'); });
}

// Disposisi
async function submitDisposisi() {
  var kepada = v('disp-kepada'), instruksi = v('disp-instruksi');
  if (!kepada || !instruksi) { showToast('Field Kepada dan Instruksi wajib diisi.', 'error'); return; }
  var data = { agendaId: v('disp-ref') || '-', dari: v('disp-dari') || 'Bupati', kepada: kepada, instruksi: instruksi };
  showSpinner('Menyimpan Disposisi...');
  try {
    var res = await callAPI('saveDisposisi', { data: data });
    hideSpinner();
    if (res.success) {
      showToast(res.message, 'success');
      resetFields(['disp-ref', 'disp-kepada', 'disp-instruksi']);
      var dari = document.getElementById('disp-dari'); if (dari) dari.value = 'Bupati';
      togglePanel('form-disposisi'); loadDisposisi();
    } else showToast(res.message, 'error');
  } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
}

async function loadDisposisi() {
  try {
    var res = await callAPI('getDisposisi', {});
    var tbody = document.getElementById('tbody-disp');
    if (!tbody) return;
    if (!res.success || !res.data.length) {
      tbody.innerHTML = '<tr class="no-data"><td colspan="8"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>Belum ada disposisi</td></tr>';
      animateCount('disp-stat-total', 0); animateCount('disp-stat-proses', 0); animateCount('disp-stat-selesai', 0);
      return;
    }
    tbody.innerHTML = res.data.map(function (d, i) {
      var safeData = encodeURIComponent(JSON.stringify(d));
      var status = d['Status'] || 'Diproses';
      var statusClass = status === 'Selesai' ? 'badge-cat masuk' : 'badge-cat sk';
      return '<tr><td>' + (i + 1) + '</td><td style="font-size:.8rem">' + fmtDate(d['Tanggal']) + '</td><td>' + esc(d['Dari'] || 'Bupati') + '</td><td><strong>' + esc(d['Kepada'] || '-') + '</strong></td><td style="font-size:.82rem;max-width:200px;word-break:break-word">' + esc(d['Isi Disposisi'] || d['Instruksi'] || '-') + '</td><td style="font-size:.78rem;color:var(--text-muted)">' + esc(d['Referensi Agenda ID'] || d['Referensi'] || '-') + '</td><td><span class="' + statusClass + '">' + esc(status) + '</span></td><td class="action-col" style="display:flex;gap:5px"><button class="btn-warning-custom" onclick="openEditModal(\'Disposisi\',\'' + safeData + '\')"><i class="bi bi-pencil"></i></button><button class="btn-danger-custom" onclick="deleteItem(\'deleteDisposisi\',\'' + d['ID'] + '\',loadDisposisi)"><i class="bi bi-trash"></i></button></td></tr>';
    }).join('');
    var total = res.data.length;
    var selesai = res.data.filter(function (d) { return d['Status'] === 'Selesai'; }).length;
    animateCount('disp-stat-total', total);
    animateCount('disp-stat-proses', total - selesai);
    animateCount('disp-stat-selesai', selesai);
  } catch (err) { /* silent */ }
}


// ══════════════════════════════════════════════════════════
//  RENDER SURAT TABLE
// ══════════════════════════════════════════════════════════
function renderSuratTable(tbodyId, res, cols, badgeClass, deleteAction, reloadFn) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  var colCount = cols.length + 3;
  if (!res.success || !res.data.length) {
    tbody.innerHTML = '<tr class="no-data"><td colspan="' + colCount + '"><i class="bi bi-inbox" style="font-size:2rem;display:block;margin-bottom:8px"></i>Belum ada data</td></tr>'; return;
  }
  tbody.innerHTML = res.data.map(function (d, i) {
    var cells = cols.map(function (col) {
      var val = d[col] || '-';
      if (col === 'Kategori') return '<td><span class="badge-cat ' + badgeClass + '">' + esc(val) + '</span></td>';
      if (col === 'Tanggal') return '<td>' + fmtDate(val) + '</td>';
      return '<td>' + esc(val) + '</td>';
    }).join('');

    // Mapping Sheet Name for Edit Modal depending on deleteAction
    var shName = 'Surat Masuk';

    var safeData = encodeURIComponent(JSON.stringify(d));
    var url = d['URL'] || d['File URL'];
    var lampiran = url ? '<button class="btn-link-custom" style="padding:4px 8px;font-size:0.75rem" onclick="openPreview(\'' + url + '\')"><i class="bi bi-eye"></i></button>' : '<span style="color:var(--text-muted);font-size:.78rem">-</span>';
    return '<tr><td>' + (i + 1) + '</td>' + cells + '<td>' + lampiran + '</td><td class="action-col" style="display:flex;gap:5px"><button class="btn-warning-custom" onclick="openEditModal(\'' + shName + '\', \'' + safeData + '\')"><i class="bi bi-pencil"></i></button><button class="btn-danger-custom" onclick="deleteItem(\'' + deleteAction + '\',\'' + d['ID'] + '\',' + reloadFn.name + ')"><i class="bi bi-trash"></i></button></td></tr>';
  }).join('');
}



function printPage() {
  var currentPage = APP.currentPage;
  var title = 'Laporan Dokumen';
  var tableIdStr = '';

  if (currentPage === 'arsip') {
    title = 'LAPORAN REKAPITULASI ARSIP DOKUMEN'; tableIdStr = 'arsip-table';
  } else if (currentPage === 'surat-masuk') {
    title = 'LAPORAN REKAPITULASI SURAT MASUK'; tableIdStr = 'table-sm';
  } else if (currentPage === 'agenda') {
    // Agenda uses timeline — generate simple print from timeline
    window.print(); return;
  } else if (currentPage === 'disposisi') {
    title = 'LAPORAN REKAPITULASI DISPOSISI'; tableIdStr = 'table-disp';
  } else {
    showToast('Tidak ada data yang dapat dicetak pada halaman ini.', 'error'); return;
  }

  var tableEl = document.getElementById(tableIdStr);
  if (!tableEl) { showToast('Tabel tidak ditemukan.', 'error'); return; }

  var clone = tableEl.cloneNode(true);
  // Remove Aksi column (last column)
  var thr = clone.querySelector('thead tr');
  if (thr && thr.lastElementChild) thr.removeChild(thr.lastElementChild);
  clone.querySelectorAll('tbody tr').forEach(function (tr) {
    if (!tr.classList.contains('no-data') && tr.lastElementChild) tr.removeChild(tr.lastElementChild);
  });

  var k1 = localStorage.getItem('senapati_kop1') || 'PEMERINTAH KABUPATEN PONOROGO';
  var k2 = localStorage.getItem('senapati_kop2') || 'BUPATI PONOROGO';
  var k3 = localStorage.getItem('senapati_kop3') || 'Jl. Alun-Alun Utara No. 1, Ponorogo';
  var kTelp = localStorage.getItem('senapati_kop_telp') || '';
  var logoKiri = localStorage.getItem('senapati_logo_kiri_data') || '';
  var logoKanan = localStorage.getItem('senapati_logo_kanan_data') || '';
  var logoKiriSize = localStorage.getItem('senapati_logo_kiri_size') || '70';
  var logoKananSize = localStorage.getItem('senapati_logo_kanan_size') || '70';
  var defaultLogo = BASE_URL + '/assets/icon-512.png';

  var leftImg = logoKiri ? ('<img src="' + logoKiri + '" style="width:' + logoKiriSize + 'px;margin-right:16px;">')
    : ('<img src="' + defaultLogo + '" style="width:70px;margin-right:16px;">');
  var rightImg = logoKanan ? ('<img src="' + logoKanan + '" style="width:' + logoKananSize + 'px;margin-left:16px;">') : '';

  var now = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  var w = window.open('', '_blank');
  w.document.write(`
    <html><head><title>Cetak Laporan - SENAPATI</title>
    <style>
      @page { size: A4 landscape; margin: 15mm 15mm 15mm 15mm; }
      body { font-family: 'Times New Roman', Times, serif; padding: 0; color: #000; font-size: 10pt; }
      .kop { display: flex; align-items: center; justify-content: center; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 2px; }
      .kop-border { border-top: 1px solid #000; margin-bottom: 16px; }
      .kop-text { text-align: center; line-height: 1.2; flex: 1; }
      .kop-text h2 { margin: 0; font-size: 12pt; font-weight: normal; }
      .kop-text h1 { margin: 3px 0; font-size: 16pt; font-weight: bold; }
      .kop-text p { margin: 0; font-size: 9pt; }
      .title { text-align: center; margin-bottom: 14px; }
      .title h3 { margin: 0; font-size: 12pt; text-transform: uppercase; letter-spacing: 1px; }
      .title p { font-size: 9pt; margin: 4px 0 0; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      th { border: 1px solid #000; padding: 6px 8px; text-align: center; background: #e8e8e8; font-weight: bold; white-space: nowrap; }
      td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; word-break: break-word; }
      tr:nth-child(even) td { background: #fafafa; }
      @media print { 
        body { margin: 0; padding: 0; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
      }
    </style></head><body>
      <div class="kop">
        ${leftImg}
        <div class="kop-text">
          <h2>${k1}</h2>
          <h1>${k2}</h1>
          <p>${k3}${kTelp ? ' &mdash; Telp: ' + kTelp : ''}</p>
        </div>
        ${rightImg}
      </div>
      <div class="kop-border"></div>
      <div class="title">
        <h3>${title}</h3>
        <p>Dicetak pada: ${now}</p>
      </div>
      ${clone.outerHTML}
    </body></html>
  `);
  w.document.close();
  setTimeout(() => { w.print(); }, 800);
}

// ══════════════════════════════════════════════════════════
//  UNIVERSAL EDIT
// ══════════════════════════════════════════════════════════
function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  currentEditData = null;
  document.getElementById('edit-file').value = '';
  document.getElementById('edit-file-info').textContent = '';
}

function openEditModal(sheetType, dataEnc) {
  var d = JSON.parse(decodeURIComponent(dataEnc));
  currentEditData = { sheet: sheetType, id: d['ID'], oriData: d };
  document.getElementById('edit-modal-title').textContent = 'Edit Data ' + sheetType;

  var c = document.getElementById('edit-form-container');
  var html = '';

  if (sheetType === 'Arsip') {
    html = `<div class="grid-2">
        <div class="form-group"><label>Nama File</label><input type="text" id="ed-arsip-nama" class="form-control-custom" value="${esc(d['Nama File'])}"></div>
        <div class="form-group"><label>Kategori</label><input type="text" id="ed-arsip-kat" class="form-control-custom" value="${esc(d['Kategori'])}"></div>
      </div>
      <div class="form-group"><label>Deskripsi</label><input type="text" id="ed-arsip-desk" class="form-control-custom" value="${esc(d['Deskripsi'])}"></div>
      <div class="form-group"><label>Tanggal Arsip Asli</label><input type="date" id="ed-arsip-tgl" class="form-control-custom" value="${d['Tanggal Arsip'] ? d['Tanggal Arsip'].substring(0, 10) : ''}"></div>`;
  } else if (sheetType === 'Surat Masuk') {
    html = `<div class="grid-2">
        <div class="form-group"><label>Nomor Surat</label><input type="text" id="ed-sm-nomor" class="form-control-custom" value="${esc(d['Nomor Surat'])}"></div>
        <div class="form-group"><label>Tanggal</label><input type="date" id="ed-sm-tgl" class="form-control-custom" value="${d['Tanggal']}"></div>
      </div>
      <div class="grid-2">
        <div class="form-group"><label>Pengirim</label><input type="text" id="ed-sm-pengirim" class="form-control-custom" value="${esc(d['Pengirim'])}"></div>
        <div class="form-group"><label>Kategori</label><input type="text" id="ed-sm-kat" class="form-control-custom" value="${esc(d['Kategori'])}"></div>
      </div>
      <div class="form-group"><label>Perihal</label><input type="text" id="ed-sm-perihal" class="form-control-custom" value="${esc(d['Perihal'])}"></div>
      <div class="form-group"><label>Catatan</label><input type="text" id="ed-sm-catatan" class="form-control-custom" value="${esc(d['Catatan'])}"></div>`;
  } else if (sheetType === 'Surat Keluar') {
    html = `<div class="grid-2">
        <div class="form-group"><label>Nomor Surat</label><input type="text" id="ed-sk-nomor" class="form-control-custom" value="${esc(d['Nomor Surat'])}"></div>
        <div class="form-group"><label>Tanggal</label><input type="date" id="ed-sk-tgl" class="form-control-custom" value="${d['Tanggal']}"></div>
      </div>
      <div class="grid-2">
        <div class="form-group"><label>Tujuan</label><input type="text" id="ed-sk-tujuan" class="form-control-custom" value="${esc(d['Tujuan'])}"></div>
        <div class="form-group"><label>Kategori</label><input type="text" id="ed-sk-kat" class="form-control-custom" value="${esc(d['Kategori'])}"></div>
      </div>
      <div class="form-group"><label>Perihal</label><input type="text" id="ed-sk-perihal" class="form-control-custom" value="${esc(d['Perihal'])}"></div>
      <div class="form-group"><label>Catatan</label><input type="text" id="ed-sk-catatan" class="form-control-custom" value="${esc(d['Catatan'])}"></div>`;
  } else if (sheetType === 'Agenda') {
    html = `<div class="grid-2">
        <div class="form-group"><label>Nomor Surat Ref</label><input type="text" id="ed-ag-nomor" class="form-control-custom" value="${esc(d['Nomor Surat Ref'])}"></div>
        <div class="form-group"><label>Nama Kegiatan</label><input type="text" id="ed-ag-nama" class="form-control-custom" value="${esc(d['Nama Kegiatan'])}"></div>
      </div>
      <div class="grid-2">
        <div class="form-group"><label>Lokasi</label><input type="text" id="ed-ag-lokasi" class="form-control-custom" value="${esc(d['Lokasi'])}"></div>
        <div class="form-group"><label>Waktu</label><input type="text" id="ed-ag-waktu" class="form-control-custom" value="${esc(d['Waktu'])}"></div>
      </div>
      <div class="grid-2">
        <div class="form-group"><label>Pakaian</label><input type="text" id="ed-ag-pakaian" class="form-control-custom" value="${esc(d['Pakaian'])}"></div>
        <div class="form-group"><label>Transit</label><input type="text" id="ed-ag-transit" class="form-control-custom" value="${esc(d['Transit'])}"></div>
      </div>
      <div class="form-group"><label>Keterangan</label><textarea id="ed-ag-ket" class="form-control-custom" rows="2">${esc(d['Keterangan'])}</textarea></div>
      <div class="form-group"><label>Status Kehadiran</label>
        <select id="ed-ag-status" class="form-control-custom">
          <option value="Hadir" ${d['Status Kehadiran'] === 'Hadir' ? 'selected' : ''}>Hadir</option>
          <option value="Tidak Hadir" ${d['Status Kehadiran'] === 'Tidak Hadir' ? 'selected' : ''}>Tidak Hadir</option>
          <option value="Disposisi" ${d['Status Kehadiran'] === 'Disposisi' ? 'selected' : ''}>Disposisi</option>
        </select>
      </div>
      <div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--body-bg);margin-top:4px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:.82rem;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:7px">
            <i class="bi bi-geo-alt-fill" style="color:#1e6fd9"></i> Koordinat Lokasi <span style="font-size:.72rem;font-weight:400;color:var(--text-muted)">(opsional)</span>
          </div>
          <button type="button" onclick="openPickMapModal('edit')" style="display:flex;align-items:center;gap:6px;background:#1e6fd9;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:.75rem;font-weight:700;cursor:pointer">
            <i class="bi bi-map"></i> Pilih di Peta
          </button>
        </div>
        <div class="grid-2" style="margin-bottom:0">
          <div class="form-group" style="margin-bottom:0"><label style="font-size:.75rem">Latitude</label><input type="number" step="any" id="ed-ag-lat" class="form-control-custom" value="${d['Latitude'] || ''}" placeholder="-7.8648" oninput="syncPickMapPreview('edit')"></div>
          <div class="form-group" style="margin-bottom:0"><label style="font-size:.75rem">Longitude</label><input type="number" step="any" id="ed-ag-lng" class="form-control-custom" value="${d['Longitude'] || ''}" placeholder="111.4637" oninput="syncPickMapPreview('edit')"></div>
        </div>
        <div id="ed-ag-coord-preview" style="margin-top:8px;font-size:.72rem;color:#16a34a;font-weight:600;display:${(d['Latitude'] && d['Longitude']) ? 'flex' : 'none'};align-items:center;gap:5px">
          <i class="bi bi-check-circle-fill"></i> <span id="ed-ag-coord-preview-txt">${d['Latitude'] && d['Longitude'] ? d['Latitude'] + ', ' + d['Longitude'] : ''}</span>
        </div>
      </div>`;
  } else if (sheetType === 'Disposisi') {
    html = `<div class="form-group"><label>Referensi Agenda ID</label><input type="text" id="ed-disp-ref" class="form-control-custom" value="${esc(d['Referensi Agenda ID'])}" readonly></div>
      <div class="grid-2">
        <div class="form-group"><label>Dari</label><input type="text" id="ed-disp-dari" class="form-control-custom" value="${esc(d['Dari'])}"></div>
        <div class="form-group"><label>Kepada</label><input type="text" id="ed-disp-kepada" class="form-control-custom" value="${esc(d['Kepada'])}"></div>
      </div>
      <div class="form-group"><label>Isi Disposisi</label><textarea id="ed-disp-inst" class="form-control-custom" rows="3">${esc(d['Isi Disposisi'])}</textarea></div>
      <div class="form-group"><label>Status</label>
        <select id="ed-disp-status" class="form-control-custom">
          <option value="Menunggu" ${d['Status'] === 'Menunggu' ? 'selected' : ''}>Menunggu</option>
          <option value="Proses" ${d['Status'] === 'Proses' ? 'selected' : ''}>Proses</option>
          <option value="Selesai" ${d['Status'] === 'Selesai' ? 'selected' : ''}>Selesai</option>
        </select>
      </div>`;
  }

  c.innerHTML = html;
  document.getElementById('edit-modal').style.display = 'flex';
}

  async function submitEditData() {
    if (!currentEditData) return;
    var payload = { id: currentEditData.id, sheetName: currentEditData.sheet, data: {} };
    var t = currentEditData.sheet;

    if (t === 'Arsip') {
      payload.data = { namaFile: v('ed-arsip-nama'), kategori: v('ed-arsip-kat'), deskripsi: v('ed-arsip-desk'), tglArsip: v('ed-arsip-tgl') };
    } else if (t === 'Surat Masuk') {
      payload.data = { nomorSurat: v('ed-sm-nomor'), tanggal: v('ed-sm-tgl'), pengirim: v('ed-sm-pengirim'), perihal: v('ed-sm-perihal'), catatan: v('ed-sm-catatan'), kategori: v('ed-sm-kat') };
    } else if (t === 'Agenda') {
      payload.data = { nomorSuratRef: v('ed-ag-nomor'), namaKegiatan: v('ed-ag-nama'), lokasi: v('ed-ag-lokasi'), waktu: v('ed-ag-waktu'), pakaian: v('ed-ag-pakaian'), transit: v('ed-ag-transit'), keterangan: v('ed-ag-ket'), statusKehadiran: v('ed-ag-status'), latitude: v('ed-ag-lat') || '', longitude: v('ed-ag-lng') || '' };
    } else if (t === 'Disposisi') {
      payload.data = { agendaId: v('ed-disp-ref'), dari: v('ed-disp-dari'), kepada: v('ed-disp-kepada'), isiDisposisi: v('ed-disp-inst'), status: v('ed-disp-status') };
    }

    var fileEl = document.getElementById('edit-file');
    var fd = null;
    if (fileEl && fileEl.files[0]) fd = await readFileAsBase64(fileEl.files[0]);

    showSpinner('Menyimpan perubahan data...');
    try {
      var realSheetName = t;
      // Map to canonical sheet names if needed
      var res = await callAPI('updateRow', { sheetName: realSheetName, id: payload.id, data: payload.data, fileData: fd });
      hideSpinner();
      if (res.success) {
        showToast('Data berhasil diperbarui!', 'success');
        closeEditModal();
        if (t === 'Arsip') loadArsip();
        else if (t === 'Surat Masuk') loadSuratMasuk();
        else if (t === 'Agenda') loadAgenda();
        else if (t === 'Disposisi') loadDisposisi();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      hideSpinner(); showToast('Error: ' + e.message, 'error');
    }
  }

  // ══════════════════════════════════════════════════════════
  //  PENGATURAN (Setup DB, Users & Cetak)
  // ══════════════════════════════════════════════════════════
  function setPgTab(tabId) {
    document.querySelectorAll('#page-pengaturan .custom-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('#page-pengaturan .tab-content').forEach(function (c) { c.style.display = 'none'; });

    var activeBtn = document.getElementById('tab-' + tabId);
    var contentBlock = document.getElementById('content-' + tabId);
    if (activeBtn) activeBtn.classList.add('active');
    if (contentBlock) contentBlock.style.display = 'block';

    if (tabId === 'pg-cetak') loadKopSettings();
  }

  function loadKopSettings() {
    var fields = {
      'set-kop1': ['senapati_kop1', 'PEMERINTAH KABUPATEN PONOROGO'],
      'set-kop2': ['senapati_kop2', 'BUPATI PONOROGO'],
      'set-kop3': ['senapati_kop3', 'Jl. Alun-Alun Utara No. 1, Ponorogo'],
      'set-kop-telp': ['senapati_kop_telp', ''],
      'set-ttd-kota': ['senapati_ttd_kota', 'Ponorogo'],
      'set-ttd-jabatan': ['senapati_ttd_jabatan', 'Bupati Ponorogo,'],
      'set-ttd-nama': ['senapati_ttd_nama', '________________________'],
      'set-ttd-nip': ['senapati_ttd_nip', '........................................'],
      'set-logo-kiri-size': ['senapati_logo_kiri_size', '90'],
      'set-logo-kanan-size': ['senapati_logo_kanan_size', '90'],
      'set-logo-size': ['senapati_logo_size', '90'],
      'set-font-size': ['senapati_font_size', '12'],
      'set-penutup': ['senapati_penutup', 'Demikian Surat ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.']
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = localStorage.getItem(fields[id][0]) || fields[id][1];
    });
    // Select fields
    var logoPos = document.getElementById('set-logo-pos');
    if (logoPos) logoPos.value = localStorage.getItem('senapati_logo_pos') || 'left';
    // Restore logo previews
    var kiriData = localStorage.getItem('senapati_logo_kiri_data');
    if (kiriData) {
      var kiriPrev = document.getElementById('set-logo-kiri-preview');
      var kiriImg = document.getElementById('logo-kiri-img');
      if (kiriImg) kiriImg.src = kiriData;
      if (kiriPrev) kiriPrev.style.display = 'block';
    }
    var kananData = localStorage.getItem('senapati_logo_kanan_data');
    if (kananData) {
      var kananPrev = document.getElementById('set-logo-kanan-preview');
      var kananImg = document.getElementById('logo-kanan-img');
      if (kananImg) kananImg.src = kananData;
      if (kananPrev) kananPrev.style.display = 'block';
    }
    updateSptPreview();
  }

  function handleLogoUpload(side, inputEl) {
    var file = inputEl.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Ukuran logo maksimal 2MB.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result;
      localStorage.setItem('senapati_logo_' + side + '_data', dataUrl);
      var sizeEl = document.getElementById('set-logo-' + side + '-size');
      if (sizeEl) localStorage.setItem('senapati_logo_' + side + '_size', sizeEl.value || '90');
      var prevContainer = document.getElementById('set-logo-' + side + '-preview');
      var prevImg = document.getElementById('logo-' + side + '-img');
      if (prevImg) prevImg.src = dataUrl;
      if (prevContainer) prevContainer.style.display = 'block';
      showToast('Logo ' + side + ' berhasil dimuat!', 'success');
      updateSptPreview();
    };
    reader.readAsDataURL(file);
  }

  function clearLogo(side) {
    localStorage.removeItem('senapati_logo_' + side + '_data');
    localStorage.removeItem('senapati_logo_' + side + '_size');
    var fileInput = document.getElementById('set-logo-' + side + '-file');
    if (fileInput) fileInput.value = '';
    var prevContainer = document.getElementById('set-logo-' + side + '-preview');
    var prevImg = document.getElementById('logo-' + side + '-img');
    if (prevImg) prevImg.src = '';
    if (prevContainer) prevContainer.style.display = 'none';
    showToast('Logo ' + side + ' berhasil dihapus.', 'info');
    updateSptPreview();
  }


  function saveKopSettings() {
    localStorage.setItem('senapati_kop1', v('set-kop1'));
    localStorage.setItem('senapati_kop2', v('set-kop2'));
    localStorage.setItem('senapati_kop3', v('set-kop3'));
    localStorage.setItem('senapati_kop_telp', v('set-kop-telp'));
    localStorage.setItem('senapati_ttd_kota', v('set-ttd-kota'));
    localStorage.setItem('senapati_ttd_jabatan', v('set-ttd-jabatan'));
    localStorage.setItem('senapati_ttd_nama', v('set-ttd-nama'));
    localStorage.setItem('senapati_ttd_nip', v('set-ttd-nip'));
    localStorage.setItem('senapati_logo_pos', v('set-logo-pos'));
    localStorage.setItem('senapati_logo_size', v('set-logo-size'));
    localStorage.setItem('senapati_font_size', v('set-font-size'));
    localStorage.setItem('senapati_penutup', v('set-penutup'));
    showToast('Pengaturan format Kop Surat & TTD berhasil disimpan.', 'success');
    updateSptPreview();
  }

  function resetKopSettings() {
    if (!confirm('Reset semua pengaturan ke default?')) return;
    ['senapati_kop1', 'senapati_kop2', 'senapati_kop3', 'senapati_kop_telp', 'senapati_ttd_kota', 'senapati_ttd_jabatan', 'senapati_ttd_nama', 'senapati_ttd_nip', 'senapati_logo_pos', 'senapati_logo_size', 'senapati_font_size', 'senapati_penutup'].forEach(function (k) { localStorage.removeItem(k); });
    loadKopSettings();
    updateSptPreview();
    showToast('Pengaturan dikembalikan ke default.', 'info');
  }

  function updateSptPreview() {
    var k1 = v('set-kop1') || 'PEMERINTAH KABUPATEN MADIUN';
    var k2 = v('set-kop2') || 'INSPEKTORAT';
    var k3 = v('set-kop3') || 'Pusat Pemerintahan Mejayan, Jl. Alun-Alun Utara No. 4, Caruban';
    var kTelp = v('set-kop-telp') || '';
    var tKota = v('set-ttd-kota') || 'Madiun';
    var tJab = v('set-ttd-jabatan') || 'Inspektur Kabupaten Madiun,';
    var tNama = v('set-ttd-nama') || '________________________';
    var tNip = v('set-ttd-nip') || '........................................';
    var logoPos = (document.getElementById('set-logo-pos') ? document.getElementById('set-logo-pos').value : 'left');
    var logoSize = v('set-logo-size') || '90';
    var fontSize = v('set-font-size') || '12';
    var penutup = v('set-penutup') || 'Demikian Surat Perintah Tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.';

    var kopHtml;
    var logoKiri = localStorage.getItem('senapati_logo_kiri_data');
    var logoKanan = localStorage.getItem('senapati_logo_kanan_data');
    var logoKiriSize = v('set-logo-kiri-size') || localStorage.getItem('senapati_logo_kiri_size') || logoSize;
    var logoKananSize = v('set-logo-kanan-size') || localStorage.getItem('senapati_logo_kanan_size') || logoSize;
    var defaultLogo = BASE_URL + '/assets/icon-512.png';

    var leftImgSrc = logoKiri || (logoPos === 'left' ? defaultLogo : '');
    var rightImgSrc = logoKanan || (logoPos === 'right' ? defaultLogo : '');

    var leftImgHtml = leftImgSrc ? '<img src="' + leftImgSrc + '" style="width:' + (logoKiri ? logoKiriSize : logoSize) + 'px;margin-right:16px;" />' : '';
    var rightImgHtml = rightImgSrc ? '<img src="' + rightImgSrc + '" style="width:' + (logoKanan ? logoKananSize : logoSize) + 'px;margin-left:16px;" />' : '';

    kopHtml = leftImgHtml + '<div class="kop-text"><h2>' + k1 + '</h2><h1>' + k2 + '</h1><p>' + k3 + (kTelp ? '<br>Telp: ' + kTelp : '') + '</p></div>' + rightImgHtml;

    var html = '<html><head><style>' +
      'body{font-family:"Times New Roman",Times,serif;padding:30px;line-height:1.5;color:#000;font-size:' + fontSize + 'pt;}' +
      '.kop{display:flex;align-items:center;justify-content:center;border-bottom:4px solid #000;padding-bottom:10px;margin-bottom:2px;}' +
      '.kop-border{border-top:1px solid #000;margin-bottom:28px;}' +
      '.kop-text{text-align:center;line-height:1.2;}' +
      '.kop-text h2{margin:0;font-size:14pt;font-weight:normal;}' +
      '.kop-text h1{margin:4px 0;font-size:18pt;font-weight:bold;}' +
      '.kop-text p{margin:0;font-size:10pt;}' +
      '.title{text-align:center;margin-bottom:24px;}' +
      '.title h3{text-decoration:underline;font-size:13pt;margin:0;}' +
      '.title p{margin:4px 0 0;font-size:12pt;}' +
      '.content{margin:0 20px;}' +
      '.row{display:flex;margin-bottom:7px;}' +
      '.label{width:150px;}.colon{width:20px;}.val{flex:1;}' +
      '.sig{margin-top:50px;display:flex;justify-content:flex-end;}' +
      '.sig-box{width:300px;}' +
      '</style></head><body>' +
      '<div class="kop">' + kopHtml + '</div>' +
      '<div class="kop-border"></div>' +
      '<div class="title"><h3>SURAT PERINTAH TUGAS</h3><p>Nomor: 094/001/SPT/2026</p></div>' +
      '<div class="content">' +
      '<p style="margin-bottom:14px">Yang bertanda tangan di bawah ini, menginstruksikan kepada:</p>' +
      '<div class="row"><div class="label">Nama</div><div class="colon">:</div><div class="val"><strong>NAMA PETUGAS</strong></div></div>' +
      '<div class="row"><div class="label">NIP</div><div class="colon">:</div><div class="val">19800101 200501 1 001</div></div>' +
      '<div class="row"><div class="label">Jabatan</div><div class="colon">:</div><div class="val">Auditor Ahli Madya</div></div>' +
      '<p style="margin-top:18px;margin-bottom:10px">Untuk melaksanakan tugas:</p>' +
      '<div class="row"><div class="label">Tujuan</div><div class="colon">:</div><div class="val">Kantor Camat Madiun</div></div>' +
      '<div class="row"><div class="label">Keperluan</div><div class="colon">:</div><div class="val">Melakukan evaluasi berkas laporan keuangan</div></div>' +
      '<div class="row"><div class="label">Waktu Tugas</div><div class="colon">:</div><div class="val">1 Januari 2026 s/d 3 Januari 2026</div></div>' +
      '<p style="margin-top:20px">' + penutup + '</p>' +
      '</div>' +
      '<div class="sig"><div class="sig-box">' +
      '<p>' + tKota + ', ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + '<br><strong>' + tJab + '</strong></p>' +
      '<br><br><br><br>' +
      '<p style="text-decoration:underline;font-weight:bold;margin:0">' + tNama + '</p>' +
      '<p style="margin:0">NIP. ' + tNip + '</p>' +
      '</div></div>' +
      '</body></html>';

    var frame = document.getElementById('spt-preview-frame');
    if (frame) {
      frame.srcdoc = html;
    }
  }

  function printSptPreview() {
    var frame = document.getElementById('spt-preview-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.print();
    }
  }

  async function setupDatabase() {
    return doSetupDb();
  }
  async function submitAddUser() {
    var data = { nama: v('new-nama'), username: v('new-username'), password: document.getElementById('new-password').value, role: v('new-role'), noWa: v('new-nowa').replace(/\D/g, '') };
    if (!data.nama || !data.username || !data.password) { showToast('Semua field wajib diisi.', 'error'); return; }
    showSpinner('Menambahkan pengguna...');
    try {
      var res = await callAPI('addUser', { data: data });
      hideSpinner();
      if (res.success) { showToast(res.message, 'success'); resetFields(['new-nama', 'new-username', 'new-password', 'new-nowa']); loadUsers(); }
      else showToast(res.message, 'error');
    } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
  }

  async function submitChangePassword() {
    var u = v('chg-username');
    var ow = document.getElementById('chg-old').value;
    var nw = document.getElementById('chg-new').value;
    var cf = document.getElementById('chg-confirm').value;
    if (!ow || !nw || !cf) { showToast('Semua field wajib diisi.', 'error'); return; }
    if (nw !== cf) { showToast('Password baru tidak cocok.', 'error'); return; }
    if (nw.length < 6) { showToast('Password baru minimal 6 karakter.', 'error'); return; }
    showSpinner('Mengubah password...');
    try {
      var res = await callAPI('changePassword', { username: u, oldPassword: ow, newPassword: nw });
      hideSpinner();
      if (res.success) { showToast(res.message, 'success'); resetFields(['chg-old', 'chg-new', 'chg-confirm']); }
      else showToast(res.message, 'error');
    } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
  }

  async function loadUsers() {
    try {
      var res = await callAPI('getUsers', {});
      var tbody = document.getElementById('tbody-users');
      if (!res.success || !res.data.length) { tbody.innerHTML = '<tr class="no-data"><td colspan="7">Tidak ada pengguna.</td></tr>'; return; }
      tbody.innerHTML = res.data.map(function (d, i) {
        var isCurrent = APP.user && d.username === APP.user.username;
        var displayWa = d.noWa ? d.noWa.replace(/^'/, '') : '';
        var waCell = displayWa
          ? '<span style="font-family:var(--mono);font-size:.75rem;color:var(--success)"><i class="bi bi-whatsapp"></i> ' + esc(displayWa) + '</span>'
          : '<button class="btn-secondary-custom" style="padding:3px 8px;font-size:.72rem" onclick="openSetWAModal(\'' + d.id + '\',\'' + esc(d.nama) + '\',\'\')"><i class="bi bi-pencil"></i> Set</button>';
        var editWaBtn = displayWa ? '<button class="btn-secondary-custom" style="padding:3px 8px;font-size:.72rem;margin-left:4px" onclick="openSetWAModal(\'' + d.id + '\',\'' + esc(d.nama) + '\',\'' + esc(displayWa) + '\')"><i class="bi bi-pencil"></i></button>' : '';
        return '<tr><td>' + (i + 1) + '</td><td><div style="display:flex;align-items:center;gap:10px"><div class="user-table-avatar">' + d.nama.charAt(0).toUpperCase() + '</div>' + esc(d.nama) + '</div></td><td><span style="font-family:var(--mono);font-size:.82rem">' + esc(d.username) + '</span></td><td><span class="badge-cat masuk">' + esc(d.role) + '</span></td><td>' + waCell + editWaBtn + '</td><td>' + fmtDate(d.created || d.CreatedAt) + '</td><td class="action-col">' + (isCurrent ? '<span style="font-size:.78rem;color:var(--text-muted)">Akun aktif</span>' : '<button class="btn-danger-custom" onclick="deleteItem(\'deleteUser\',\'' + d.id + '\',loadUsers)"><i class="bi bi-person-x"></i> Hapus</button>') + '</td></tr>';
      }).join('');
    } catch (err) { /* silent */ }
  }

  async function doSetupDb() {
    if (!confirm('Tindakan ini akan menginisialisasi ulang sistem dan Sheet pada spreadsheet Anda. Lanjutkan?')) return;
    showSpinner('Inisialisasi Database...');
    try {
      var res = await callAPI('setupDb', {});
      hideSpinner();
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      hideSpinner(); showToast('Network Error: ' + err.message, 'error');
    }
  }

  // ══════════════════════════════════════════════════════════
  //  DELETE GENERIC
  // ══════════════════════════════════════════════════════════
  async function deleteItem(action, id, reloadFn) {
    if (!confirm('Yakin ingin menghapus data ini?')) return;
    showSpinner('Menghapus data...');
    try {
      var res = await callAPI(action, { id: id });
      hideSpinner();
      if (res.success) { showToast(res.message, 'success'); if (reloadFn) reloadFn(); }
      else showToast(res.message, 'error');
    } catch (err) { hideSpinner(); showToast('Error: ' + err.message, 'error'); }
  }

  // ══════════════════════════════════════════════════════════
  //  TABS
  // ══════════════════════════════════════════════════════════
  function setTab(tabId) {
    document.querySelectorAll('.custom-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.style.display = 'none'; });
    var tabMap = { 'tab-masuk': 'content-masuk', 'tab-keluar': 'content-keluar' };
    var activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.add('active');
    var content = tabMap[tabId];
    if (content) { var el = document.getElementById(content); if (el) el.style.display = 'block'; }
  }

  // ══════════════════════════════════════════════════════════
  //  TOGGLE PANEL & COLLAPSE
  // ══════════════════════════════════════════════════════════
  function togglePanel(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }

  function toggleCollapse(contentId, triggerEl) {
    var content = document.getElementById(contentId);
    if (!content) return;
    if (content.classList.contains('collapsed')) {
      content.classList.remove('collapsed');
      triggerEl.classList.remove('collapsed');
    } else {
      content.classList.add('collapsed');
      triggerEl.classList.add('collapsed');
    }
  }

  // ══════════════════════════════════════════════════════════
  //  CETAK REPORT
  // ══════════════════════════════════════════════════════════
  function printPage() {
    window.print();
  }

  // ══════════════════════════════════════════════════════════
  //  PREVIEW MODAL (IFRAME)
  // ══════════════════════════════════════════════════════════
  function openPreview(url) {
    var overlay = document.getElementById('preview-overlay');
    var frame = document.getElementById('preview-frame');
    var previewUrl = url;
    if (url.includes('/view')) {
      previewUrl = url.replace(/\/view.*$/, '/preview');
    } else if (!url.includes('/preview')) {
      // If it's a raw google drive link, try to append preview
      previewUrl = url + '/preview';
    }
    frame.src = previewUrl;
    overlay.classList.add('active');
  }
  function closePreview() {
    document.getElementById('preview-overlay').classList.remove('active');
    document.getElementById('preview-frame').src = '';
  }

  // ══════════════════════════════════════════════════════════
  //  TABLE FILTER
  // ══════════════════════════════════════════════════════════
  function filterTable(tableId, query) {
    var q = query.toLowerCase();
    document.querySelectorAll('#' + tableId + ' tbody tr:not(.no-data)').forEach(function (row) {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  // ══════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════
  function esc(str) {
    if (!str) return '-';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(val) {
    if (!val || val === '-') return '-';
    try { var d = new Date(val); if (isNaN(d)) return String(val); return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); } catch (e) { return String(val); }
  }
  function v(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }
  function resetFields(ids) {
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  }

  // ══════════════════════════════════════════════════════════
  //  DRAG & DROP EVENTS & INITS
  // ══════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════
  //  TEMPLATE SURAT — STATE
  // ══════════════════════════════════════════════════════════
  var TEMPLATE_STATE = {
    allTemplates: [],           // cache daftar template
    selected: null,             // template yang dipilih di generator
    detectedVars: [],           // variabel terdeteksi dari file .docx
    currentFileB64: null,       // base64 raw file .docx yang di-upload
    bufferCache: {}             // cache raw template arrayBuffer untuk mempercepat preview
  };

  // ── Helper: ekstrak variabel {{...}} dari teks biasa
  function extractVariables(text) {
    var regex = /\{\{([a-zA-Z0-9_ \-]+)\}\}/g;
    var vars = [];
    var match;
    while ((match = regex.exec(text)) !== null) {
      if (vars.indexOf(match[1]) === -1) vars.push(match[1]);
    }
    return vars;
  }

  // ── Parse variabel dari konten .docx menggunakan PizZip + Docxtemplater
  function parseDocxVariables(base64Content) {
    try {
      var binary = atob(base64Content);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var zip = new PizZip(bytes.buffer);
      // Baca dokumen XML utama
      var docXml = '';
      var files = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
      files.forEach(function (f) {
        try { docXml += zip.file(f) ? zip.file(f).asText() : ''; } catch (e) { }
      });
      // Hapus XML tags dulu sebelum parse variabel
      var plainText = docXml.replace(/<[^>]+>/g, '');
      // Re-join variabel yang terputus di XML (misal {{ lalu teks lalu }})
      // Cari pola {{...}} setelah cleanup
      return extractVariables(plainText);
    } catch (e) {
      console.warn('parseDocxVariables error:', e);
      return [];
    }
  }

  // ── Handler saat user pilih file .docx di form upload
  async function handleTemplateFileSelect() {
    var fileEl = document.getElementById('tpl-file');
    var file = fileEl.files[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      showToast('Hanya file .docx yang didukung!', 'error');
      fileEl.value = '';
      return;
    }
    document.getElementById('tpl-file-info').textContent = '📎 ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';

    // Auto-isi nama template dari nama file
    var nameEl = document.getElementById('tpl-nama');
    if (nameEl && !nameEl.value) {
      nameEl.value = file.name.replace('.docx', '').replace(/_/g, ' ');
    }

    // Baca file sebagai base64 dan parse variabel
    showSpinner('Membaca dan menganalisis template...');
    try {
      var reader = new FileReader();
      reader.onload = function (e) {
        hideSpinner();
        var b64 = e.target.result.split(',')[1];
        TEMPLATE_STATE.currentFileB64 = b64;
        var vars = parseDocxVariables(b64);
        TEMPLATE_STATE.detectedVars = vars;
        // Tampilkan preview variabel
        var previewEl = document.getElementById('tpl-vars-preview');
        var listEl = document.getElementById('tpl-vars-list');
        if (vars.length > 0) {
          listEl.innerHTML = vars.map(function (v) {
            return '<span class="var-badge"><i class="bi bi-braces"></i>' + v + '</span>';
          }).join('');
          previewEl.style.display = 'block';
          showToast(vars.length + ' variabel terdeteksi!', 'success');
        } else {
          listEl.innerHTML = '<span style="color:var(--text-muted);font-size:.82rem"><i class="bi bi-info-circle"></i> Tidak ada variabel {{...}} ditemukan. Pastikan file .docx berisi variabel dalam format <code>{{nama_variabel}}</code></span>';
          previewEl.style.display = 'block';
          showToast('Tidak ada variabel terdeteksi. Template tetap bisa disimpan.', 'info');
        }
      };
      reader.onerror = function () { hideSpinner(); showToast('Gagal membaca file.', 'error'); };
      reader.readAsDataURL(file);
    } catch (e) { hideSpinner(); showToast('Error: ' + e.message, 'error'); }
  }

  // ── Submit upload template
  async function submitTemplate() {
    var namaTemplate = v('tpl-nama');
    var deskripsi = v('tpl-deskripsi');
    var fileEl = document.getElementById('tpl-file');
    if (!namaTemplate) { showToast('Nama template wajib diisi.', 'error'); return; }
    if (!fileEl.files[0]) { showToast('File .docx wajib diunggah.', 'error'); return; }
    if (!TEMPLATE_STATE.currentFileB64) { showToast('Pilih file terlebih dahulu.', 'error'); return; }

    showSpinner('Mengunggah template ke Google Drive...');
    try {
      var file = fileEl.files[0];
      var fileData = {
        content: TEMPLATE_STATE.currentFileB64,
        name: file.name,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: (file.size / 1024).toFixed(1) + ' KB'
      };
      var res = await callAPI('saveTemplate', {
        data: { namaTemplate: namaTemplate, deskripsi: deskripsi, variables: TEMPLATE_STATE.detectedVars },
        fileData: fileData
      });
      hideSpinner();
      if (res.success) {
        showToast(res.message, 'success');
        if (res.fileId && res.fileId !== '-') {
          window.open('https://docs.google.com/document/d/' + res.fileId + '/edit', '_blank');
        }
        // Reset form
        resetFields(['tpl-nama', 'tpl-deskripsi']);
        fileEl.value = '';
        document.getElementById('tpl-file-info').textContent = '';
        document.getElementById('tpl-vars-preview').style.display = 'none';
        document.getElementById('tpl-vars-list').innerHTML = '';
        TEMPLATE_STATE.currentFileB64 = null;
        TEMPLATE_STATE.detectedVars = [];
        togglePanel('form-template');
        loadTemplates();
      } else {
        showToast(res.message || 'Gagal menyimpan template.', 'error');
      }
    } catch (e) { hideSpinner(); showToast('Error: ' + e.message, 'error'); }
  }

  // ── Load dan render daftar template (halaman Template Surat)
  async function loadTemplates() {
    try {
      var res = await callAPI('getTemplates', {});
      var grid = document.getElementById('template-grid');
      if (!grid) return;
      if (!res.success || !res.data.length) {
        TEMPLATE_STATE.allTemplates = [];
        grid.innerHTML = '<div class="tpl-empty-state"><i class="bi bi-file-earmark-word"></i><p>Belum ada template. Klik "Upload Template Baru" untuk menambahkan.</p></div>';
        return;
      }
      TEMPLATE_STATE.allTemplates = res.data;
      renderTemplateGrid(grid, res.data, false);
    } catch (e) { showToast('Gagal memuat template: ' + e.message, 'error'); }
  }

  // ── Render template cards ke elemen grid tertentu
  function renderTemplateGrid(gridEl, data, selectable) {
    if (!data || !data.length) {
      gridEl.innerHTML = '<div class="tpl-empty-state"><i class="bi bi-file-earmark-word"></i><p>Belum ada template tersedia.</p></div>';
      return;
    }
    gridEl.innerHTML = data.map(function (d) {
      var vars = [];
      try { vars = JSON.parse(d['Variables'] || '[]'); } catch (e) { vars = []; }
      var varBadges = vars.length > 0
        ? vars.slice(0, 5).map(function (v2) { return '<span class="var-badge"><i class="bi bi-braces"></i>' + esc(v2) + '</span>'; }).join('') +
        (vars.length > 5 ? '<span class="var-badge">+' + (vars.length - 5) + ' lainnya</span>' : '')
        : '<span style="font-size:.75rem;color:var(--text-muted)">Tidak ada variabel</span>';
      var tglDibuat = d['DibuatPada'] ? fmtDate(d['DibuatPada']) : '-';
      var safeId = esc(d['ID']);
      var safeName = esc(d['Nama Template']);
      var safeEnc = encodeURIComponent(JSON.stringify(d));

      if (selectable) {
        // Mode seleksi (untuk generator)
        return '<div class="tpl-card selectable" data-id="' + safeId + '" onclick="selectTemplateForGenerator(\'' + safeId + '\')">' +
          '<div class="tpl-card-header">' +
          '<div class="tpl-card-icon"><i class="bi bi-file-earmark-word-fill"></i></div>' +
          '<div class="tpl-card-title"><h4>' + safeName + '</h4><p>' + esc(d['Deskripsi'] || 'Template surat .docx') + '</p></div>' +
          '</div>' +
          '<div class="tpl-card-vars">' + varBadges + '</div>' +
          '<div class="tpl-card-date"><i class="bi bi-calendar3"></i> ' + tglDibuat + ' &bull; ' + vars.length + ' variabel</div>' +
          '</div>';
      } else {
        // Mode manajemen (halaman Template Surat)
        return '<div class="tpl-card" data-id="' + safeId + '">' +
          '<div class="tpl-card-header">' +
          '<div class="tpl-card-icon"><i class="bi bi-file-earmark-word-fill"></i></div>' +
          '<div class="tpl-card-title"><h4>' + safeName + '</h4><p>' + esc(d['Deskripsi'] || 'Template surat .docx') + '</p></div>' +
          '</div>' +
          '<div class="tpl-card-vars">' + varBadges + '</div>' +
          '<div class="tpl-card-date"><i class="bi bi-calendar3"></i> ' + tglDibuat + ' &bull; ' + vars.length + ' variabel' +
          (d['URL'] ? ' &bull; <a href="' + d['URL'] + '" target="_blank" style="color:var(--primary)"><i class="bi bi-download"></i> Unduh</a>' : '') +
          '</div>' +
          '<div class="tpl-card-actions">' +
          '<button class="btn-use" onclick="navigateTo(\'buat-surat\');setTimeout(function(){selectTemplateForGenerator(\'' + safeId + '\')},300)"><i class="bi bi-pencil-square"></i> Buat Surat</button>' +
          (d['File ID'] && d['File ID'] !== '-' ? '<button class="btn-secondary" onclick="openDocsEditor(\'' + d['File ID'] + '\')" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="bi bi-google"></i> Edit di Docs</button>' : '') +
          '<button class="btn-del" onclick="deleteTemplateById(\'' + safeId + '\')"><i class="bi bi-trash"></i> Hapus</button>' +
          '</div>' +
          '</div>';
      }
    }).join('');
  }

  // ── Open Google Docs in Modal Iframe (responsive + adaptive dark/light mode)
  function openDocsEditor(fileId) {
    var url = 'https://docs.google.com/document/d/' + fileId + '/edit?rm=minimal';
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-mode');
    var boxBg = isDark ? '#1e2433' : '#ffffff';
    if (document.getElementById('de-modal')) document.getElementById('de-modal').remove();
    if (!document.getElementById('de-modal-style')) {
      var s = document.createElement('style'); s.id = 'de-modal-style';
      s.textContent = '#de-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;animation:deFadeIn .22s ease}' +
        '@keyframes deFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}' +
        '#de-modal .de-box{width:94vw;height:92vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.5);position:relative}' +
        '#de-modal .de-hdr{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;background:linear-gradient(135deg,#1a73e8,#0f4c81);color:#fff;gap:10px;flex-shrink:0}' +
        '#de-modal .de-ttl{display:flex;align-items:center;gap:9px;font-size:.97rem;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '#de-modal .de-acts{display:flex;align-items:center;gap:7px;flex-shrink:0}' +
        '#de-modal .de-btn{border:none;color:#fff;font-size:.82rem;display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:9px;background:rgba(255,255,255,.18);cursor:pointer;transition:.2s;text-decoration:none;white-space:nowrap}' +
        '#de-modal .de-btn:hover{background:rgba(255,255,255,.32)}' +
        '#de-modal .de-btn.red:hover{background:rgba(220,53,69,.8)}' +
        '#de-modal iframe{flex:1;border:none;width:100%;display:block}' +
        '#de-modal .de-loader{position:absolute;inset:0;top:54px;display:flex;align-items:center;justify-content:center;background:' + boxBg + ';z-index:-1}' +
        '@media(max-width:640px){#de-modal .de-box{width:100vw;height:100dvh;border-radius:0}#de-modal .de-btn span{display:none}}';
      document.head.appendChild(s);
    }
    var modal = document.createElement('div'); modal.id = 'de-modal';
    modal.innerHTML = '<div class="de-box" style="background:' + boxBg + '">' +
      '<div class="de-hdr">' +
      '<div class="de-ttl"><i class="bi bi-google"></i><span>Edit Template — Google Docs</span></div>' +
      '<div class="de-acts">' +
      '<a href="' + url.replace('?rm=minimal', '') + '" target="_blank" class="de-btn"><i class="bi bi-box-arrow-up-right"></i><span> Tab Baru</span></a>' +
      '<button class="de-btn red" onclick="document.getElementById(\'de-modal\').remove()"><i class="bi bi-x-lg"></i><span> Tutup</span></button>' +
      '</div>' +
      '</div>' +
      '<div class="de-loader" id="de-loader"><div class="spin" style="width:30px;height:30px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite"></div></div>' +
      '<iframe src="' + url + '" allowfullscreen onload="document.getElementById(\'de-loader\').style.display=\'none\'"></iframe>' +
      '</div>';
    modal.addEventListener('click', function (ev) { if (ev.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── Filter template cards (search)
  function filterTemplateCards(query) {
    var q = query.toLowerCase();
    document.querySelectorAll('.tpl-card').forEach(function (card) {
      var text = card.textContent.toLowerCase();
      card.style.display = text.includes(q) ? '' : 'none';
    });
  }

  // ── Hapus template
  async function deleteTemplateById(id) {
    if (!confirm('Yakin ingin menghapus template ini? File di Google Drive juga akan dihapus.')) return;
    showSpinner('Menghapus template...');
    try {
      var res = await callAPI('deleteTemplate', { id: id });
      hideSpinner();
      if (res.success) { showToast(res.message, 'success'); loadTemplates(); }
      else showToast(res.message, 'error');
    } catch (e) { hideSpinner(); showToast('Error: ' + e.message, 'error'); }
  }

  // ══════════════════════════════════════════════════════════
  //  BUAT SURAT — WIZARD
  // ══════════════════════════════════════════════════════════

  // ── Load template untuk halaman generator
  async function loadTemplatesForGenerator() {
    try {
      var res = await callAPI('getTemplates', {});
      var grid = document.getElementById('generator-template-grid');
      if (!grid) return;
      if (!res.success || !res.data.length) {
        TEMPLATE_STATE.allTemplates = [];
        grid.innerHTML = '<div class="tpl-empty-state"><i class="bi bi-file-earmark-word"></i><p>Belum ada template tersedia. <a onclick="navigateTo(\'template-surat\')" style="color:var(--primary);cursor:pointer">Upload template terlebih dahulu.</a></p></div>';
        return;
      }
      TEMPLATE_STATE.allTemplates = res.data;
      renderTemplateGrid(grid, res.data, true);
    } catch (e) { /* silent */ }
  }

  // ── Pilih template untuk generator (wizard step 1 → 2)
  async function selectTemplateForGenerator(templateId) {
    var tpl = TEMPLATE_STATE.allTemplates.find(function (t) { return String(t['ID']) === String(templateId); });
    if (!tpl) { showToast('Template tidak ditemukan.', 'error'); return; }

    // Highlight card yang dipilih
    document.querySelectorAll('#generator-template-grid .tpl-card').forEach(function (c) { c.classList.remove('selected'); });
    var card = document.querySelector('#generator-template-grid [data-id="' + templateId + '"]');
    if (card) card.classList.add('selected');

    TEMPLATE_STATE.selected = tpl;

    // Ambil variabel
    var vars = [];
    try { vars = JSON.parse(tpl['Variables'] || '[]'); } catch (e) { vars = []; }

    // Update nama template di header step 2
    var nameEl = document.getElementById('gen-template-name');
    if (nameEl) nameEl.textContent = '📄 ' + tpl['Nama Template'];

    // Render form dinamis
    var formArea = document.getElementById('dynamic-form-area');
    if (!formArea) return;

    if (!vars.length) {
      formArea.innerHTML = '<div style="grid-column:1/-1;padding:20px;text-align:center;color:var(--text-muted)"><i class="bi bi-info-circle" style="font-size:2rem;display:block;margin-bottom:10px"></i><p>Template ini tidak memiliki variabel. Langsung klik "Lanjut ke Generate".</p></div>';
    } else {
      formArea.innerHTML = vars.map(function (varName) {
        var inputHtml = '';
        var label = varName;

        if (varName.startsWith('select_')) {
          var parts = varName.split('_');
          label = parts[1] || 'Pilihan';
          var options = parts.slice(2);
          inputHtml = '<select class="form-control-custom" id="gen-var-' + varName + '">';
          inputHtml += '<option value="">-- Pilih ' + label + ' --</option>';
          options.forEach(function (opt) { inputHtml += '<option value="' + opt + '">' + opt + '</option>'; });
          inputHtml += '</select>';
        } else if (varName.startsWith('date_')) {
          var parts = varName.split('_');
          label = parts.slice(1).join(' ');
          inputHtml = '<input type="date" class="form-control-custom" id="gen-var-' + varName + '" />';
        } else if (varName.startsWith('datetime_')) {
          var parts = varName.split('_');
          label = parts.slice(1).join(' ');
          inputHtml = '<input type="datetime-local" class="form-control-custom" id="gen-var-' + varName + '" />';
        } else {
          label = varName.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
          var isNum = /nomor|no_|nip|nik/i.test(varName);
          var inputType = isNum ? 'text' : 'text';
          inputHtml = '<input type="' + inputType + '" class="form-control-custom" id="gen-var-' + varName + '" placeholder="Isi ' + label + '..." autocomplete="off" />';
        }

        return '<div class="form-group"><label>' + label + '</label>' + inputHtml + '</div>';
      }).join('');
    }

    wizardGoTo(2);
  }

  // ── Pindah step wizard
  function wizardGoTo(step) {
    // Sembunyikan semua step content
    [1, 2, 3].forEach(function (n) {
      var el = document.getElementById('buat-step' + n);
      var ws = document.getElementById('ws-step' + n);
      if (el) el.style.display = 'none';
      if (ws) { ws.classList.remove('active', 'done'); }
    });
    // Tampilkan step yang dipilih
    var target = document.getElementById('buat-step' + step);
    if (target) target.style.display = 'block';

    // Update wizard header
    for (var n = 1; n <= 3; n++) {
      var ws2 = document.getElementById('ws-step' + n);
      if (!ws2) continue;
      if (n < step) ws2.classList.add('done');
      else if (n === step) ws2.classList.add('active');
    }

    // Jika step 3, render summary
    if (step === 3) {
      renderGenerateSummary();
    }
  }

  // ── Render summary data di step 3
  function renderGenerateSummary() {
    var summaryEl = document.getElementById('gen-data-summary');
    if (!summaryEl || !TEMPLATE_STATE.selected) return;
    var tpl = TEMPLATE_STATE.selected;
    var formData = collectFormData();

    var items = [
      { key: 'template', val: tpl['Nama Template'] }
    ];

    Object.keys(formData).forEach(function (key) {
      items.push({ key: key, val: formData[key] || '(kosong)' });
    });

    summaryEl.innerHTML = items.map(function (item) {
      return '<div class="gen-summary-item">' +
        '<div class="gen-summary-key">{{' + item.key + '}}</div>' +
        '<div class="gen-summary-val">' + esc(item.val) + '</div>' +
        '</div>';
    }).join('');
  }

  // ── Kumpulkan data form variabel
  function collectFormData() {
    var tpl = TEMPLATE_STATE.selected;
    if (!tpl) return {};
    var vars = [];
    try { vars = JSON.parse(tpl['Variables'] || '[]'); } catch (e) { vars = []; }
    var data = {};
    vars.forEach(function (varName) {
      var el = document.getElementById('gen-var-' + varName);
      var val = el ? el.value : '';

      // Format if it's date or datetime
      if (val && varName.startsWith('date_')) {
        var d = new Date(val);
        if (!isNaN(d)) val = d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } else if (val && varName.startsWith('datetime_')) {
        var d2 = new Date(val);
        if (!isNaN(d2)) val = d2.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' Pukul ' + d2.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      }

      data[varName] = val;
    });
    return data;
  }

  // ── Fungsi inti: ambil template dan render ke blob
  async function buildDocxBlob(tpl, data) {
    var templateId = tpl['ID'];
    var arrayBuffer;

    // Gunakan cache jika file raw .docx sudah pernah diunduh di sesi ini
    if (TEMPLATE_STATE.bufferCache[templateId]) {
      // Clone buffer karena PizZip / docxtemplater memodifikasi isi buffer
      arrayBuffer = TEMPLATE_STATE.bufferCache[templateId].slice(0);
    } else {
      var url = tpl['URL'] || tpl['File URL'] || '';
      if (url.includes('drive.google.com') && !url.includes('uc?export=download')) {
        var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (m) url = 'https://drive.google.com/uc?export=download&id=' + m[1];
      }
      var response = await fetch(BASE_URL + '/api/downloadDriveProxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'downloadDriveProxy', payload: { url: url } })
      });
      if (!response.ok) throw new Error('Gagal mengambil template dari server (HTTP ' + response.status + ')');
      var rawBuffer = await response.arrayBuffer();
      // Simpan ke cache
      TEMPLATE_STATE.bufferCache[templateId] = rawBuffer;
      // Clone buffer untuk dipakai sekarang
      arrayBuffer = rawBuffer.slice(0);
    }

    var zip = new PizZip(arrayBuffer);
    // Coba window.docxtemplater (CDN modern) atau Docxtemplater (CDN lama)
    var DocxClass = window.docxtemplater || window.Docxtemplater;
    if (!DocxClass) throw new Error('Library Docxtemplater belum termuat. Coba refresh halaman.');
    var doc = new DocxClass(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: function () { return ''; }
    });
    try {
      doc.render(data);
    } catch (renderErr) {
      // Ambil detail error yang lebih informatif
      var msg = renderErr.message || '';
      if (renderErr.properties && renderErr.properties.errors) {
        msg = renderErr.properties.errors.map(function (e) { return e.message; }).join(', ');
      }
      throw new Error('Render gagal: ' + msg);
    }
    return doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ── Preview dokumen (tampilkan di modal, tanpa download)
  async function previewDocument() {
    var tpl = TEMPLATE_STATE.selected;
    if (!tpl) { showToast('Pilih template terlebih dahulu.', 'error'); return; }
    var statusEl = document.getElementById('gen-status');
    var statusText = document.getElementById('gen-status-text');
    if (statusEl) statusEl.style.display = 'block';
    if (statusText) statusText.textContent = 'Merender visual dokumen...';
    try {
      var blob = await buildDocxBlob(tpl, collectFormData());

      if (statusEl) statusEl.style.display = 'none';
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-mode');
      var bg = isDark ? '#1a2035' : '#e2e8f0';

      // Buka dalam de-modal (reuse style)
      if (document.getElementById('de-modal')) document.getElementById('de-modal').remove();
      if (!document.getElementById('de-modal-style')) {
        var s2 = document.createElement('style'); s2.id = 'de-modal-style';
        s2.textContent = '#de-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;animation:deFadeIn .22s ease}' +
          '@keyframes deFadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}' +
          '#de-modal .de-box{width:96vw;height:95vh;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.5)}' +
          '#de-modal .de-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#1e293b;color:#f8fafc;gap:10px;flex-shrink:0}' +
          '#de-modal .de-ttl{display:flex;align-items:center;gap:9px;font-size:.95rem;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
          '#de-modal .de-acts{display:flex;align-items:center;gap:8px;flex-shrink:0}' +
          '#de-modal .de-btn{border:none;color:#fff;font-size:.85rem;display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:6px;background:rgba(255,255,255,.1);cursor:pointer;transition:.2s;text-decoration:none;white-space:nowrap}' +
          '#de-modal .de-btn:hover{background:rgba(255,255,255,.2)}' +
          '#de-modal .de-btn.blue{background:#2563eb} #de-modal .de-btn.blue:hover{background:#1d4ed8}' +
          '@media(max-width:640px){#de-modal .de-box{width:100vw;height:100dvh;border-radius:0}#de-modal .de-btn span{display:none}}' +
          /* Print Styles */
          '@media print { ' +
          '  body * { visibility: hidden; } ' +
          '  #de-modal, #de-modal * { visibility: visible; } ' +
          '  #de-modal { position: absolute; left: 0; top: 0; width: 100%; height: auto; background: transparent !important; } ' +
          '  #de-modal .de-box { box-shadow: none; border-radius: 0; width: 100%; height: auto; display: block; } ' +
          '  #de-modal .de-hdr { display: none !important; } ' +
          '  #docx-container { overflow: visible !important; height: auto !important; background: transparent !important; padding: 0 !important; } ' +
          '  .docx-wrapper { background: transparent !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; } ' +
          '  .docx-wrapper>section.docx { margin-bottom: 0 !important; box-shadow: none !important; } ' +
          '}';
        document.head.appendChild(s2);
      }
      var fileName = (tpl['Nama Template'] || 'surat').replace(/[^a-zA-Z0-9_-]/g, '_');
      var modal = document.createElement('div'); modal.id = 'de-modal';
      modal.innerHTML = '<div class="de-box" style="background:' + bg + '">' +
        '<div class="de-hdr">' +
        '<div class="de-ttl"><i class="bi bi-file-text"></i><span>Visual Preview — ' + esc(tpl['Nama Template']) + '</span></div>' +
        '<div class="de-acts">' +
        '<button class="de-btn blue" id="prev-pdf"><i class="bi bi-printer"></i><span> Cetak PDF</span></button>' +
        '<button class="de-btn" id="prev-dl"><i class="bi bi-download"></i><span> Unduh .docx</span></button>' +
        '<button class="de-btn" onclick="document.getElementById(\'de-modal\').remove()"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '</div>' +
        '<div id="docx-container" style="flex:1; overflow-y:auto; background:' + bg + ';">' +
        '<div style="display:flex;justify-content:center;align-items:center;height:100%;"><div class="spin" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite;"></div></div>' +
        '</div>' +
        '</div>';

      // Jangan close otomatis saat klik background untuk mencegah salah tutup
      // modal.addEventListener('click', function(ev){ if(ev.target===modal) modal.remove(); });
      document.body.appendChild(modal);

      // Render DOCX menggunakan docx-preview
      var container = document.getElementById('docx-container');
      try {
        container.innerHTML = ''; // bersihkan spinner
        await docx.renderAsync(blob, container, null, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          debug: false
        });
        // Sedikit perbaikan style docx-wrapper agar dark mode terlihat lebih rapi
        var wrapper = container.querySelector('.docx-wrapper');
        if (wrapper) {
          wrapper.style.backgroundColor = bg;
          wrapper.style.padding = '20px';
        }
      } catch (errRender) {
        console.error(errRender);
        container.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Gagal merender dokumen secara visual. Namun file bisa diunduh.</div>';
      }

      document.getElementById('prev-dl').addEventListener('click', function () {
        saveAs(blob, fileName + '_generated.docx');
        showToast('File .docx berhasil diunduh!', 'success');
      });

      document.getElementById('prev-pdf').addEventListener('click', function () {
        // Kita manfaatkan @media print di atas
        window.print();
      });

      showToast('Visual dokumen siap!', 'success');
    } catch (e) {
      if (statusEl) statusEl.style.display = 'none';
      showToast('Gagal membuat visual preview: ' + e.message, 'error');
    }
  }

  // ── Generate dan download dokumen
  async function generateAndDownload(format) {
    var tpl = TEMPLATE_STATE.selected;
    if (!tpl) { showToast('Pilih template terlebih dahulu.', 'error'); return; }
    if (format === 'preview') { previewDocument(); return; }

    var statusEl = document.getElementById('gen-status');
    var statusText = document.getElementById('gen-status-text');
    if (statusEl) statusEl.style.display = 'block';
    if (statusText) statusText.textContent = 'Mengunduh template dari server...';

    try {
      var blob = await buildDocxBlob(tpl, collectFormData());
      if (statusEl) statusEl.style.display = 'none';
      var fileName = (tpl['Nama Template'] || 'surat').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (format === 'docx') {
        saveAs(blob, fileName + '_generated.docx');
        showToast('File .docx berhasil diunduh!', 'success');
      } else if (format === 'pdf') {
        previewDocument();
      }
    } catch (e) {
      if (statusEl) statusEl.style.display = 'none';
      console.error('generateAndDownload error:', e);
      showToast('Gagal generate dokumen: ' + e.message, 'error');
    }
  }

  // ── Reset generator ke step 1
  function resetGenerator() {
    TEMPLATE_STATE.selected = null;
    var formArea = document.getElementById('dynamic-form-area');
    if (formArea) formArea.innerHTML = '';
    var summary = document.getElementById('gen-data-summary');
    if (summary) summary.innerHTML = '';
    var statusEl = document.getElementById('gen-status');
    if (statusEl) statusEl.style.display = 'none';
    document.querySelectorAll('#generator-template-grid .tpl-card').forEach(function (c) { c.classList.remove('selected'); });
    wizardGoTo(1);
  }

  // ══════════════════════════════════════════════════════════
  //  KIRIM AGENDA KE WHATSAPP
  // ══════════════════════════════════════════════════════════
  var WA_STATE = { users: [], message: '', tanggal: '' };

  function openWAModal() {
    var modal = document.getElementById('wa-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    var today = new Date().toISOString().split('T')[0];
    var dateEl = document.getElementById('wa-tanggal');
    if (dateEl) dateEl.value = today;
    loadWARecipients();
    loadWAPreview(today);
  }

  function closeWAModal() {
    var modal = document.getElementById('wa-modal');
    if (modal) modal.style.display = 'none';
  }

  async function loadWARecipients() {
    try {
      var res = await callAPI('getUsers', {});
      WA_STATE.users = res.success ? res.data : [];
      renderWARecipients();
    } catch (e) { /* silent */ }
  }

  function renderWARecipients() {
    var listEl = document.getElementById('wa-recipients-list');
    if (!listEl) return;
    var withWA = WA_STATE.users.filter(function (u) { return u.noWa; });
    var withoutWA = WA_STATE.users.filter(function (u) { return !u.noWa; });

    var html = withWA.map(function (u) {
      var displayWa = u.noWa.replace(/^'/, '');
      return '<div class="wa-rec-item">' +
        '<div class="wa-rec-info">' +
        '<div class="wa-rec-av">' + u.nama.charAt(0).toUpperCase() + '</div>' +
        '<div><div style="font-weight:600;font-size:.85rem">' + esc(u.nama) + '</div>' +
        '<div style="font-size:.72rem;color:var(--text-muted)">' + esc(u.role) + ' · ' + esc(displayWa) + '</div></div>' +
        '</div>' +
        '<button class="btn-wa-sm" onclick="sendToWA(\'' + esc(displayWa) + '\')"><i class="bi bi-whatsapp"></i> Kirim</button>' +
        '</div>';
    }).join('');

    if (withoutWA.length) {
      html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
        '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:6px"><i class="bi bi-exclamation-circle"></i> Belum punya No WA:</div>' +
        withoutWA.map(function (u) {
          return '<div class="wa-rec-item" style="opacity:.7">' +
            '<div class="wa-rec-info">' +
            '<div class="wa-rec-av" style="background:var(--body-bg);color:var(--text-muted);border:1.5px solid var(--border)">' + u.nama.charAt(0).toUpperCase() + '</div>' +
            '<div><div style="font-size:.85rem;color:var(--text-muted)">' + esc(u.nama) + '</div>' +
            '<div style="font-size:.72rem;color:var(--text-muted)">' + esc(u.role) + '</div></div>' +
            '</div>' +
            '<button class="btn-secondary-custom" style="padding:5px 10px;font-size:.72rem" onclick="openSetWAModal(\'' + u.id + '\',\'' + esc(u.nama) + '\',\'' + esc(u.noWa || '') + '\')"><i class="bi bi-pencil"></i> Set WA</button>' +
            '</div>';
        }).join('') + '</div>';
    }

    listEl.innerHTML = html || '<p style="color:var(--text-muted);font-size:.82rem;text-align:center;padding:10px">Tidak ada pengguna.</p>';
    var btnAll = document.getElementById('btn-send-all-wa');
    if (btnAll) {
      btnAll.style.opacity = withWA.length ? '1' : '.5';
      btnAll.style.pointerEvents = withWA.length ? 'auto' : 'none';
    }
  }

  async function loadWAPreview(tanggal) {
    if (!tanggal) return;
    WA_STATE.tanggal = tanggal;
    var previewEl = document.getElementById('wa-preview-box');
    if (!previewEl) return;
    previewEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">' +
      '<div style="width:28px;height:28px;border:2.5px solid var(--border);border-top-color:#25D366;border-radius:50%;animation:spin .75s linear infinite;margin:0 auto 8px"></div>' +
      'Memuat agenda...</div>';
    try {
      var agRes = await callAPI('getAgenda', {});
      var agendaList = (agRes.success ? agRes.data : []).filter(function (d) { return (d['Tanggal'] || '').substring(0, 10) === tanggal; });
      var message = formatAgendaWAMessage(agendaList, tanggal);
      WA_STATE.message = message;
      previewEl.innerHTML = '<pre class="wa-preview-pre">' + esc(message) + '</pre>';
    } catch (e) {
      previewEl.innerHTML = '<p style="color:var(--danger);font-size:.82rem;padding:12px">Gagal memuat: ' + e.message + '</p>';
    }
  }

  function formatAgendaWAMessage(agendaList, tanggal) {
    var kop2 = localStorage.getItem('senapati_kop2') || 'Bupati Ponorogo';
    var date = new Date(tanggal + 'T00:00:00');
    var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var hdr = HARI[date.getDay()] + ' ' + String(date.getDate()).padStart(2, '0') + ' ' + BULAN[date.getMonth()] + ' ' + date.getFullYear();
    var msg = '*Giat ' + kop2 + ', ' + hdr + '*\n\n';

    if (!agendaList.length) {
      return msg + '_Tidak ada agenda pada tanggal ini._';
    }

    agendaList.forEach(function (d, i) {
      msg += (i + 1) + '. ' + (d['Nama Kegiatan'] || '-') + '\n';
      msg += 'Waktu: ' + (d['Waktu'] || 'ALL DAY') + '\n';
      if (d['Lokasi'] && d['Lokasi'] !== '-') msg += 'Tempat: ' + d['Lokasi'] + '\n';
      if (d['Pakaian'] && d['Pakaian'] !== '-') msg += 'Pakaian: ' + d['Pakaian'] + '\n';
      if (d['Transit'] && d['Transit'] !== '-') msg += 'Transit: ' + d['Transit'] + '\n';
      if (d['Keterangan'] && d['Keterangan'] !== '-') msg += 'Keterangan: ' + d['Keterangan'] + '\n';
      msg += 'Status: *' + (d['Status Kehadiran'] || 'Hadir') + '*\n\n';
    });

    return msg.trimEnd();
  }

  function sendToWA(noWa, customMsg) {
    var message = customMsg || WA_STATE.message;
    if (!message) { showToast('Pilih tanggal dan muat preview terlebih dahulu.', 'error'); return; }
    if (!noWa) { showToast('No WA tidak tersedia.', 'error'); return; }
    var cleanWa = String(noWa).replace(/^'/, '');
    var num = cleanWa.replace(/\D/g, '');
    if (num.startsWith('0')) { num = '62' + num.substring(1); }
    var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank');
  }

  function sendAllWA() {
    if (!WA_STATE.message) { showToast('Pilih tanggal dan muat preview terlebih dahulu.', 'error'); return; }
    var withWA = WA_STATE.users.filter(function (u) { return u.noWa; });
    if (!withWA.length) { showToast('Tidak ada pengguna dengan No WA.', 'error'); return; }
    // Buka satu per satu dengan delay kecil agar browser tidak blokir popup
    withWA.forEach(function (u, i) {
      setTimeout(function () { sendToWA(u.noWa); }, i * 800);
    });
    showToast('Membuka ' + withWA.length + ' tab WA... pastikan popup tidak diblokir.', 'info');
  }

  // Modal Set No WA per user
  function openSetWAModal(id, nama, currentWa) {
    document.getElementById('wa-set-user-id').value = id;
    document.getElementById('wa-set-user-label').textContent = 'Set No WA untuk: ' + nama;
    document.getElementById('wa-set-nowa').value = currentWa || '';
    document.getElementById('wa-set-modal').style.display = 'flex';
  }

  function closeSetWAModal() {
    document.getElementById('wa-set-modal').style.display = 'none';
  }

  async function submitSetWA() {
    var id = document.getElementById('wa-set-user-id').value;
    var noWa = document.getElementById('wa-set-nowa').value.replace(/\D/g, '');
    if (!id) { showToast('ID user tidak valid.', 'error'); return; }
    if (!noWa) { showToast('Nomor WA tidak boleh kosong.', 'error'); return; }
    showSpinner('Menyimpan No WA...');
    try {
      var res = await callAPI('updateUserWA', { id: id, noWa: noWa });
      hideSpinner();
      if (res.success) {
        showToast(res.message, 'success');
        closeSetWAModal();
        loadUsers();
        loadWARecipients();
      } else showToast(res.message, 'error');
    } catch (e) { hideSpinner(); showToast('Error: ' + e.message, 'error'); }
  }




  document.addEventListener('DOMContentLoaded', function () {
    initTheme();

    ['login-username', 'login-password'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    });

    document.querySelectorAll('.file-drop').forEach(function (zone) {
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('dragover'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('dragover'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        var fileInput = zone.querySelector('input[type="file"]');
        var infoEl = zone.querySelector('.drop-name');
        if (fileInput && e.dataTransfer.files[0]) {
          var dt = new DataTransfer();
          dt.items.add(e.dataTransfer.files[0]);
          fileInput.files = dt.files;
          var f = e.dataTransfer.files[0];
          if (infoEl) infoEl.textContent = '📎 ' + f.name + ' (' + (f.size / 1024).toFixed(1) + ' KB)';
        }
      });
    });
  });
