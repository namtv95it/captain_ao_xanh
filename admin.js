/* =========================================
   admin.js – Admin Panel Logic
   Xác thực mật khẩu + Firestore CRUD
   ========================================= */

'use strict';

// ─── HASH MẬT KHẨU MẶC ĐỊNH ──────────────
// sha256('007011') — không salt, tính bằng:
// node -e "require('crypto').createHash('sha256').update('007011').digest('hex')"
const ADMIN_HASH = 'bc691f5556269c1f3d8b1cd8504d3de0fcbc5cb731d4c3e144411d16e3febbe7';

// ─── STATE ────────────────────────────────
let isVerifying = false;
let isSortModeActive = false;
let cachedVideos = [];

// ─── DOM REFS ─────────────────────────────
const pinScreen    = document.getElementById('pin-screen');
const pinDashboard = document.getElementById('admin-dashboard');
const pinWrapEl    = document.getElementById('pin-dots');
const pinInputEl   = document.getElementById('pin-input');
const pinMessage   = document.getElementById('pin-message');
// toastEl được khai báo trong main.js (load trước)

// ─── SHA-256 (Web Crypto API – không salt) ─
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── FIRESTORE: Seed video mặc định ──────
async function ensurePinSetup() {
  try {
    await seedDefaultVideos();
  } catch (err) {
    console.warn('[Admin] seedDefaultVideos error:', err.message);
  }
}

// ─── LOGIN ERROR ──────────────────────────
function showLoginError(msg) {
  pinInputEl.value = '';
  pinInputEl.focus();
  pinMessage.textContent = msg;
  pinMessage.className = 'pin-message error';
  pinWrapEl.classList.add('shake');
  setTimeout(() => pinWrapEl.classList.remove('shake'), 600);
  isVerifying = false;
}

// ─── VERIFY PASSWORD ──────────────────────
async function verifyPin() {
  if (isVerifying) return;
  isVerifying = true;

  const submitBtn = document.getElementById('pin-submit');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.7'; }

  const password = pinInputEl.value.trim();
  pinMessage.textContent = '';
  pinMessage.className = 'pin-message';

  if (!password) {
    showLoginError('⚠️ Vui lòng nhập mật khẩu!');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
    return;
  }

  try {
    const inputHash = await sha256(password);

    if (inputHash === ADMIN_HASH) {
      // ✅ Đúng mật khẩu
      pinWrapEl.classList.add('success');
      pinMessage.textContent = '✅ Xác thực thành công!';
      pinMessage.className = 'pin-message';
      sessionStorage.setItem('cap-admin', 'ok');

      setTimeout(() => {
        pinScreen.classList.add('hidden');
        pinDashboard.classList.remove('hidden');
        isVerifying = false;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
        loadVideos();
      }, 500);

    } else {
      showLoginError('❌ Mật khẩu không đúng. Thử lại!');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
    }

  } catch (err) {
    showLoginError('⚠️ Lỗi xác thực. Thử lại!');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = ''; }
    console.error('[Admin] verifyPin error:', err);
  }
}

// ─── FORM SUBMIT ──────────────────────────
document.getElementById('pin-form').addEventListener('submit', (e) => {
  e.preventDefault();
  verifyPin();
});

// ─── TOGGLE SHOW/HIDE PASSWORD ────────────
document.getElementById('pin-toggle-btn').addEventListener('click', () => {
  const isPwd = pinInputEl.type === 'password';
  pinInputEl.type = isPwd ? 'text' : 'password';
  const icon = document.getElementById('pin-eye-icon');
  icon.innerHTML = isPwd
    ? `<line x1="1" y1="1" x2="23" y2="23"/><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// ─── AVATAR DROPDOWN ──────────────────────
const avatarTrigger = document.getElementById('avatar-trigger-btn');
const avatarMenu = document.getElementById('avatar-dropdown-menu');

if (avatarTrigger && avatarMenu) {
  avatarTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = avatarMenu.classList.contains('hidden');
    avatarMenu.classList.toggle('hidden', !isHidden);
    avatarTrigger.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  });

  // Đóng menu khi bấm ra ngoài
  document.addEventListener('click', (e) => {
    if (!avatarMenu.contains(e.target) && !avatarTrigger.contains(e.target)) {
      avatarMenu.classList.add('hidden');
      avatarTrigger.setAttribute('aria-expanded', 'false');
    }
  });
}

// ─── LOGOUT ───────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  if (avatarMenu) avatarMenu.classList.add('hidden');
  sessionStorage.removeItem('cap-admin');
  pinDashboard.classList.add('hidden');
  pinScreen.classList.remove('hidden');
  pinWrapEl.classList.remove('success');
  pinInputEl.value = '';
  pinInputEl.type = 'password';
  isVerifying = false;
  pinMessage.textContent = '';
  pinMessage.className = 'pin-message';
  setTimeout(() => pinInputEl.focus(), 100);
});



// ─── LOAD VIDEOS ──────────────────────────
async function loadVideos() {
  const listEl = document.getElementById('video-admin-list');
  listEl.innerHTML = '<div class="admin-loading"><div class="spinner"></div><p>Đang tải danh sách video...</p></div>';

  try {
    const snap = await db.collection('videos').orderBy('order').get();

    if (snap.empty) {
      listEl.innerHTML = '<p class="admin-empty">Chưa có video nào. Nhấn <strong>Thêm video</strong> để bắt đầu!</p>';
      return;
    }

    const videos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVideos(videos);
  } catch (err) {
    listEl.innerHTML = `<p class="admin-empty error">⚠️ Lỗi tải dữ liệu: ${err.message}</p>`;
    console.error('[Admin] loadVideos error:', err);
  }
}

function renderVideos(videos) {
  cachedVideos = videos;
  const listEl = document.getElementById('video-admin-list');

  if (!videos.length) {
    listEl.innerHTML = '<p class="admin-empty">Chưa có video nào.</p>';
    return;
  }

  // ── Sắp xếp: featured lên đầu, sau đó theo order ──
  const sorted = [...videos].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (a.order ?? 99) - (b.order ?? 99);
  });

  const featuredVideos = sorted.filter(v => v.featured);
  const normalVideos   = sorted.filter(v => !v.featured);

  let html = '';

  // ── Nhóm nổi bật (hàng ngang full-width) — Ẩn khi ở chế độ Sắp xếp ──
  if (!isSortModeActive && featuredVideos.length) {
    html += '<div class="video-group-label"><span class="group-label-featured">⭐ Nổi bật</span></div>';
    html += '<div class="video-featured-list">';
    html += featuredVideos.map((v, i) => renderVideoCard(v, i, true)).join('');
    html += '</div>';
  }

  // Divider nếu có cả 2 nhóm và không ở chế độ Sắp xếp
  if (!isSortModeActive && featuredVideos.length && normalVideos.length) {
    html += '<div class="video-group-divider"></div>';
  }

  // ── Nhóm còn lại (grid nhiều cột dạng box) ──
  if (normalVideos.length) {
    const labelText = isSortModeActive 
      ? `📋 Đang sắp xếp (${normalVideos.length})` 
      : `📋 Danh sách (${normalVideos.length})`;
    html += `<div class="video-group-label"><span class="group-label-normal">${labelText}</span></div>`;
    html += `<div class="video-grid ${isSortModeActive ? 'sort-mode-active' : ''}" id="sortable-video-grid">`;
    html += normalVideos.map((v, i) => renderVideoCard(v, featuredVideos.length + i, false)).join('');
    html += '</div>';
  }

  listEl.innerHTML = html;

  if (isSortModeActive) {
    setupDragAndDropHandlers();
  }
}

function renderVideoCard(v, i, isFeatured) {
  if (isFeatured) {
    return `
      <div class="video-admin-card featured-card featured-hero-style" style="animation-delay: ${i * 0.06}s">
        <!-- Thumbnail bên trái với nút play tròn màu cam hổ phách -->
        <div class="featured-thumb-container">
          <img src="${escHtml(v.thumbnailUrl || 'captain.png')}"
               alt="${escHtml(v.title)}"
               onerror="this.src='captain.png'" />
          <div class="featured-play-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <!-- Thông tin bên phải -->
        <div class="featured-details">
          <div class="featured-text-group">
            <h3 class="featured-main-title">${escHtml(v.title)}</h3>
            <p class="featured-channel-sub">${escHtml(v.channelName || 'Phê Sữa Review')}</p>
          </div>

          <div class="featured-bottom-bar">
            <a href="${escHtml(v.url)}" target="_blank" rel="noopener noreferrer" class="featured-cta-btn">
              <span>Xem ngay</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </a>

            <div class="featured-admin-tools">
              <button class="action-btn edit-btn"
                      onclick="openEditModal('${v.id}')">✏️ Sửa</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Video thường trong Grid Box
  const isSorting = isSortModeActive;
  return `
    <div class="video-admin-card ${!v.visible ? 'hidden-video' : ''}"
         data-id="${v.id}"
         ${isSorting ? 'draggable="true"' : ''}
         style="animation-delay: ${i * 0.06}s">
      
      ${isSorting ? `
        <div class="drag-handle-badge">
          <span>⋮⋮ Kéo thả</span>
        </div>
      ` : `
        <!-- Top-right Quick Visibility Toggle -->
        <div class="card-top-toggle" title="${v.visible ? 'Đang hiển thị (Bấm để ẩn)' : 'Đang ẩn (Bấm để hiển thị)'}">
          <label class="toggle-switch card-switch">
            <input type="checkbox" ${v.visible !== false ? 'checked' : ''}
                   onchange="toggleVisible('${v.id}', this.checked, this)" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      `}

      <div class="video-admin-thumb">
        <img src="${escHtml(v.thumbnailUrl || 'captain.png')}"
             alt="${escHtml(v.title)}"
             onerror="this.src='captain.png'" />
      </div>
      <div class="video-admin-info">
        <h4 class="video-admin-title">${escHtml(v.title)}</h4>
        <p class="video-admin-meta">${escHtml(v.channelName || 'Phê Sữa Review')} · Thứ tự: ${v.order ?? '—'}</p>
        ${!isSorting ? `
        <a href="${escHtml(v.url)}" target="_blank" rel="noopener noreferrer"
           class="video-admin-link">🔗 Xem video</a>
        ` : ''}
      </div>
      ${!isSorting ? `
      <div class="video-admin-actions">
        <button class="action-btn featured-btn"
                onclick="setFeatured('${v.id}', true)">
          ☆ Nổi bật
        </button>
        <button class="action-btn edit-btn"
                onclick="openEditModal('${v.id}')">✏️ Sửa</button>
        <button class="action-btn delete-btn"
                onclick="confirmDelete('${v.id}', \`${escHtml(v.title).replace(/`/g, '\\`')}\`)">🗑️ Xóa</button>
      </div>
      ` : ''}
    </div>
  `;
}


// Escape HTML để tránh XSS
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── MODAL: mở / đóng ─────────────────────
function openModal() {
  document.getElementById('video-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('video-title-input').focus(), 100);
}

function closeModal() {
  document.getElementById('video-modal').classList.add('hidden');
  document.body.style.overflow = '';
  document.getElementById('video-form').reset();
  document.getElementById('video-doc-id').value = '';
  // Reset upload area
  resetUploadArea();
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('video-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// ESC để đóng modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.getElementById('video-modal').classList.contains('hidden')) {
    closeModal();
  }
});

// ─── ADD VIDEO ────────────────────────────
document.getElementById('btn-add-video').addEventListener('click', () => {
  document.getElementById('modal-title').textContent = 'Thêm video mới';
  document.getElementById('video-channel-input').value = 'Phê Sữa Review';
  document.getElementById('video-visible-input').checked = true;
  openModal();
});

// ─── IMAGE COMPRESS → BASE64 ─────────────
async function compressToBase64(file, maxW = 480, maxH = 270, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        // Scale down giữ tỉ lệ
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  return bytes < 1024
    ? bytes + ' B'
    : bytes < 1024 * 1024
      ? (bytes / 1024).toFixed(1) + ' KB'
      : (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ─── UPLOAD AREA LOGIC ────────────────────
const uploadArea       = document.getElementById('upload-area');
const uploadFileInput  = document.getElementById('video-thumb-file');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const uploadPreviewWrap = document.getElementById('upload-preview-wrap');
const uploadPreviewImg  = document.getElementById('upload-preview-img');
const uploadSizeInfo    = document.getElementById('upload-size-info');
const base64Input       = document.getElementById('video-thumb-base64');

function resetUploadArea() {
  uploadPlaceholder.classList.remove('hidden');
  uploadPreviewWrap.classList.add('hidden');
  uploadPreviewImg.src = '';
  uploadSizeInfo.textContent = '';
  base64Input.value = '';
  uploadFileInput.value = '';
  uploadArea.classList.remove('uploading', 'drag-over');
}

function setUploadPreview(base64, origSize, compSize) {
  uploadPreviewImg.src = base64;
  uploadPlaceholder.classList.add('hidden');
  uploadPreviewWrap.classList.remove('hidden');
  uploadSizeInfo.textContent =
    `${formatBytes(origSize)} → ${formatBytes(compSize)} (JPEG nén)`;
  base64Input.value = base64;
}

async function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('⚠️ Chỉ chấp nhận file ảnh!', 'error');
    return;
  }
  const origSize = file.size;
  uploadArea.classList.add('uploading');
  try {
    const base64 = await compressToBase64(file);
    const compSize = Math.round((base64.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
    setUploadPreview(base64, origSize, compSize);
  } catch (err) {
    showToast('❌ Lỗi xử lý ảnh!', 'error');
    console.error(err);
  } finally {
    uploadArea.classList.remove('uploading');
  }
}

// Click vào upload area → mở file picker
uploadArea.addEventListener('click', (e) => {
  if (e.target.id === 'upload-remove-btn') return;
  uploadFileInput.click();
});

// File được chọn
uploadFileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleImageFile(e.target.files[0]);
});

// Nút đổi ảnh
document.getElementById('upload-remove-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  resetUploadArea();
});

// Drag & Drop
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleImageFile(file);
});

// ─── EDIT VIDEO ───────────────────────────
window.openEditModal = async function (docId) {
  try {
    const snap = await db.collection('videos').doc(docId).get();
    if (!snap.exists) { showToast('Không tìm thấy video!', 'error'); return; }

    const v = snap.data();
    document.getElementById('modal-title').textContent     = 'Sửa video';
    document.getElementById('video-doc-id').value          = docId;
    document.getElementById('video-title-input').value     = v.title       || '';
    document.getElementById('video-url-input').value       = v.url         || '';
    document.getElementById('video-channel-input').value   = v.channelName || 'Phê Sữa Review';
    document.getElementById('video-order-input').value     = v.order       ?? '';
    document.getElementById('video-visible-input').checked = v.visible !== false;

    // Hiển thị thumbnail đã lưu (base64 hoặc URL)
    resetUploadArea();
    if (v.thumbnailUrl) {
      // Ước tính size từ base64 length
      const isBase64 = v.thumbnailUrl.startsWith('data:');
      const compSize = isBase64
        ? Math.round((v.thumbnailUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4)
        : 0;
      uploadPreviewImg.src = v.thumbnailUrl;
      uploadPlaceholder.classList.add('hidden');
      uploadPreviewWrap.classList.remove('hidden');
      uploadSizeInfo.textContent = isBase64 ? `${formatBytes(compSize)} (đã lưu)` : 'URL ảnh';
      base64Input.value = v.thumbnailUrl;
    }

    openModal();
  } catch (err) {
    showToast('❌ Lỗi tải thông tin video!', 'error');
    console.error('[Admin] openEditModal error:', err);
  }
};

// ─── SAVE VIDEO (Thêm / Sửa) ─────────────
document.getElementById('video-form').addEventListener('submit', async e => {
  e.preventDefault();

  const saveBtn = document.getElementById('btn-save-video');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Đang lưu...';

  const docId = document.getElementById('video-doc-id').value.trim();
  const thumbValue = base64Input.value.trim();
  const data  = {
    title:        document.getElementById('video-title-input').value.trim(),
    url:          document.getElementById('video-url-input').value.trim(),
    thumbnailUrl: thumbValue,   // base64 hoặc URL
    channelName:  document.getElementById('video-channel-input').value.trim() || 'Phê Sữa Review',
    order:        parseInt(document.getElementById('video-order-input').value) || 99,
    visible:      document.getElementById('video-visible-input').checked,
    updatedAt:    firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (docId) {
      await db.collection('videos').doc(docId).update(data);
      showToast('✅ Đã cập nhật video!', 'success');
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('videos').add(data);
      showToast('✅ Đã thêm video mới!', 'success');
    }
    closeModal();
    loadVideos();
  } catch (err) {
    showToast('❌ Lỗi khi lưu: ' + err.message, 'error');
    console.error('[Admin] save video error:', err);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Lưu video`;
  }
});

// ─── KÉO THẢ SẮP XẾP (DRAG & DROP) ───────
const btnToggleSort = document.getElementById('btn-toggle-sort');
const btnCancelSort = document.getElementById('btn-cancel-sort');
const sortBtnText   = document.getElementById('sort-btn-text');

if (btnToggleSort) {
  btnToggleSort.addEventListener('click', async () => {
    const btnAddVideo = document.getElementById('btn-add-video');

    if (!isSortModeActive) {
      // ── BẬT CHẾ ĐỘ SẮP XẾP ──
      isSortModeActive = true;
      btnToggleSort.classList.add('is-sorting');
      sortBtnText.textContent = 'Lưu thứ tự';
      if (btnCancelSort) btnCancelSort.classList.remove('hidden');
      if (btnAddVideo) btnAddVideo.classList.add('hidden');
      showToast('💡 Kéo thả các ô video để sắp xếp lại thứ tự!', 'info');
      renderVideos(cachedVideos);
    } else {
      // ── LƯU THỨ TỰ MỚI VÀO FIRESTORE ──
      btnToggleSort.disabled = true;
      if (btnCancelSort) btnCancelSort.disabled = true;
      sortBtnText.textContent = 'Đang lưu...';
      
      try {
        await saveNewOrderToFirestore();
        showToast('✅ Đã lưu thứ tự mới thành công!', 'success');
      } catch (err) {
        showToast('❌ Lỗi khi lưu thứ tự: ' + err.message, 'error');
      } finally {
        isSortModeActive = false;
        btnToggleSort.disabled = false;
        if (btnCancelSort) {
          btnCancelSort.disabled = false;
          btnCancelSort.classList.add('hidden');
        }
        if (btnAddVideo) btnAddVideo.classList.remove('hidden');
        btnToggleSort.classList.remove('is-sorting');
        sortBtnText.textContent = 'Sắp xếp';
        loadVideos();
      }
    }
  });
}

// ── NÚT HỦY SẮP XẾP ──
if (btnCancelSort) {
  btnCancelSort.addEventListener('click', () => {
    const btnAddVideo = document.getElementById('btn-add-video');
    isSortModeActive = false;
    btnCancelSort.classList.add('hidden');
    if (btnAddVideo) btnAddVideo.classList.remove('hidden');
    btnToggleSort.classList.remove('is-sorting');
    sortBtnText.textContent = 'Sắp xếp';
    showToast('↩️ Đã hủy thao tác sắp xếp', 'info');
    renderVideos(cachedVideos);
  });
}

function setupDragAndDropHandlers() {
  const gridEl = document.getElementById('sortable-video-grid');
  if (!gridEl) return;

  const cards = gridEl.querySelectorAll('.video-admin-card');
  let draggedCard = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      cards.forEach(c => c.classList.remove('drag-over'));
      draggedCard = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (card !== draggedCard) {
        card.classList.add('drag-over');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');

      if (draggedCard && card !== draggedCard) {
        const allCards = Array.from(gridEl.querySelectorAll('.video-admin-card'));
        const draggedIndex = allCards.indexOf(draggedCard);
        const targetIndex = allCards.indexOf(card);

        if (draggedIndex < targetIndex) {
          card.after(draggedCard);
        } else {
          card.before(draggedCard);
        }
      }
    });
  });
}

async function saveNewOrderToFirestore() {
  const gridEl = document.getElementById('sortable-video-grid');
  if (!gridEl) return;

  const cards = Array.from(gridEl.querySelectorAll('.video-admin-card'));
  if (!cards.length) return;

  const batch = db.batch();
  cards.forEach((card, index) => {
    const docId = card.getAttribute('data-id');
    if (docId) {
      const ref = db.collection('videos').doc(docId);
      batch.update(ref, { order: index + 1 });
    }
  });

  await batch.commit();
}

// ─── SET FEATURED ─────────────────────────
window.setFeatured = async function (docId, makeFeatured) {
  try {
    const batch = db.batch();

    if (makeFeatured) {
      // 1. Lấy thông tin video mới chuẩn bị được chọn làm Nổi bật
      const newFeaturedDoc = await db.collection('videos').doc(docId).get();
      const newFeaturedOrder = newFeaturedDoc.exists ? (newFeaturedDoc.data().order ?? 99) : 99;

      // 2. Tìm video đang là Nổi bật cũ
      const oldFeaturedSnap = await db.collection('videos').where('featured', '==', true).get();
      
      // 3. Gán thứ tự (order) của video mới cho video nổi bật cũ & bỏ featured của nó
      oldFeaturedSnap.docs.forEach(d => {
        if (d.id !== docId) {
          batch.update(d.ref, { 
            featured: false,
            order: newFeaturedOrder
          });
        }
      });
    }

    // 4. Set featured cho video được chọn
    batch.update(db.collection('videos').doc(docId), { featured: makeFeatured });
    await batch.commit();

    showToast(makeFeatured ? '⭐ Đã chuyển thành video nổi bật!' : '✅ Đã bỏ nổi bật', 'success');
    loadVideos();
  } catch (err) {
    showToast('❌ Lỗi: ' + err.message, 'error');
    console.error('[Admin] setFeatured error:', err);
  }
};

// ─── TOGGLE VISIBLE ───────────────────────
window.toggleVisible = async function (docId, makeVisible, btnEl) {
  if (btnEl) { btnEl.disabled = true; btnEl.style.opacity = '0.6'; }
  try {
    await db.collection('videos').doc(docId).update({ visible: makeVisible });
    showToast(makeVisible ? '👁 Đã bật hiển thị!' : '🙈 Đã ẩn video!', 'success');
    loadVideos();
  } catch (err) {
    showToast('❌ Lỗi: ' + err.message, 'error');
    console.error('[Admin] toggleVisible error:', err);
    if (btnEl) { btnEl.disabled = false; btnEl.style.opacity = ''; }
  }
};

// ─── DELETE VIDEO ─────────────────────────
window.confirmDelete = async function (docId, title) {
  if (!confirm(`Bạn chắc chắn muốn xóa video:\n"${title}"?`)) return;

  try {
    await db.collection('videos').doc(docId).delete();
    showToast('🗑️ Đã xóa video!', 'success');
    loadVideos();
  } catch (err) {
    showToast('❌ Lỗi khi xóa: ' + err.message, 'error');
    console.error('[Admin] delete error:', err);
  }
};

// ─── TOAST ────────────────────────────────
let toastTimer = null;

function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  const _toast = document.getElementById('toast');
  if (!_toast) return;
  _toast.textContent = message;
  _toast.className   = `toast ${type}`;

  toastTimer = setTimeout(() => {
    _toast.className = 'toast hidden';
  }, 3200);
}

// ─── INIT ─────────────────────────────────
(async () => {
  await ensurePinSetup();

  // Nếu đã đăng nhập trong session này, bỏ qua màn hình PIN
  if (sessionStorage.getItem('cap-admin') === 'ok') {
    pinScreen.classList.add('hidden');
    pinDashboard.classList.remove('hidden');
    loadVideos();
  }
})();
