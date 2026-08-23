/* =========================================
   admin.js – Admin Panel Logic
   PIN (6 số) + SHA-256 + Firestore CRUD
   ========================================= */

'use strict';

// ─── STATE ────────────────────────────────
let currentPin = '';
let isVerifying = false;

// ─── DOM REFS ─────────────────────────────
const pinScreen     = document.getElementById('pin-screen');
const pinDashboard  = document.getElementById('admin-dashboard');
const pinDotsEl     = document.getElementById('pin-dots');
const pinDots       = pinDotsEl.querySelectorAll('.pin-dot');
const pinMessage    = document.getElementById('pin-message');
const toastEl       = document.getElementById('toast');

// ─── SHA-256 HASH (Web Crypto API) ────────
async function sha256(text) {
  const encoder = new TextEncoder();
  // Thêm salt để tránh rainbow table attack
  const data = encoder.encode(text + ':captain-ao-xanh-2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── FIRESTORE: Khởi tạo PIN lần đầu ─────
async function ensurePinSetup() {
  try {
    const adminRef = db.collection('config').doc('admin');
    const snap     = await adminRef.get();

    if (!snap.exists) {
      // Hash PIN mặc định "007011" và lưu lên Firestore
      const defaultHash = await sha256('007011');
      await adminRef.set({ pinHash: defaultHash, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      console.log('[Admin] PIN mặc định đã được thiết lập.');
    }

    // Seed video mặc định nếu collection trống
    await seedDefaultVideos();
  } catch (err) {
    console.warn('[Admin] Không thể khởi tạo PIN:', err.message);
  }
}

// ─── FIRESTORE: Seed video mặc định ──────
async function seedDefaultVideos() {
  try {
    const videosSnap = await db.collection('videos').limit(1).get();
    if (!videosSnap.empty) return; // Đã có data, bỏ qua

    const defaults = [
      {
        title: 'Quy Khư - Phần 1',
        url: 'https://www.youtube.com/channel/UCrWjMw_O4UHWCBWpRJvSXJw',
        thumbnailUrl: 'quy-khu.png',
        channelName: 'Phê Sữa Review',
        order: 1,
        visible: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      },
      {
        title: 'Vùng Đất Đảo Ngược Tập 4',
        url: 'https://www.youtube.com/channel/UCrWjMw_O4UHWCBWpRJvSXJw',
        thumbnailUrl: 'vddn-04.png',
        channelName: 'Phê Sữa Review',
        order: 2,
        visible: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    ];

    const batch = db.batch();
    defaults.forEach(v => batch.set(db.collection('videos').doc(), v));
    await batch.commit();
    console.log('[Admin] Video mặc định đã được seed.');
  } catch (err) {
    console.warn('[Admin] Không thể seed videos:', err.message);
  }
}

// ─── PIN UI: cập nhật chấm ───────────────
function updateDots() {
  pinDots.forEach((dot, i) => {
    const filled = i < currentPin.length;
    dot.classList.toggle('filled', filled);
  });
}

// ─── PIN: xử lý lỗi ──────────────────────
function showPinError(msg) {
  currentPin = '';
  updateDots();
  pinMessage.textContent = msg;
  pinMessage.className = 'pin-message error';
  pinDotsEl.classList.add('shake');
  setTimeout(() => {
    pinDotsEl.classList.remove('shake');
  }, 600);
  isVerifying = false;
}

// ─── PIN: xác minh ───────────────────────
async function verifyPin() {
  if (isVerifying) return;
  isVerifying = true;
  pinMessage.textContent = '';
  pinMessage.className = 'pin-message';

  try {
    const inputHash   = await sha256(currentPin);
    const defaultHash = await sha256('007011');  // PIN mặc định

    let storedHash = defaultHash; // fallback nếu Firestore chưa có document

    try {
      const adminSnap = await db.collection('config').doc('admin').get();

      if (adminSnap.exists && adminSnap.data().pinHash) {
        // Dùng hash từ Firestore nếu đã có
        storedHash = adminSnap.data().pinHash;
      } else {
        // Chưa có document → thử tạo mới (nếu rules cho phép)
        db.collection('config').doc('admin').set({
          pinHash: defaultHash,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {/* bỏ qua nếu rules chưa cho phép ghi */});
      }
    } catch (fsErr) {
      // Firestore không đọc được → dùng PIN mặc định cục bộ
      console.warn('[Admin] Firestore read failed, using local fallback:', fsErr.message);
    }

    if (inputHash === storedHash) {
      // ✅ Đúng PIN
      pinDotsEl.classList.add('success');
      pinMessage.textContent = '✅ Xác thực thành công!';
      pinMessage.className = 'pin-message';
      sessionStorage.setItem('cap-admin', 'ok');

      setTimeout(() => {
        pinScreen.classList.add('hidden');
        pinDashboard.classList.remove('hidden');
        loadVideos();
      }, 550);
    } else {
      showPinError('❌ Mã PIN không đúng. Thử lại!');
    }

  } catch (err) {
    showPinError('⚠️ Lỗi xác thực. Thử lại!');
    console.error('[Admin] verifyPin error:', err);
  }
}

// ─── PIN PAD: chỉ dùng bàn phím vật lý ──
// (Bàn phím số trên màn hình đã bị ẩn)
// Hỗ trợ bàn phím vật lý
document.addEventListener('keydown', (e) => {
  if (pinScreen.classList.contains('hidden')) return;
  if (isVerifying) return;

  if (e.key >= '0' && e.key <= '9') {
    if (currentPin.length < 6) {
      currentPin += e.key;
      updateDots();
      const dot = pinDots[currentPin.length - 1];
      dot.classList.add('pop');
      setTimeout(() => dot.classList.remove('pop'), 200);
      if (currentPin.length === 6) setTimeout(verifyPin, 120);
    }
  } else if (e.key === 'Backspace') {
    if (currentPin.length > 0) {
      currentPin = currentPin.slice(0, -1);
      updateDots();
    }
  }
});

// ─── LOGOUT ───────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem('cap-admin');
  pinDashboard.classList.add('hidden');
  pinScreen.classList.remove('hidden');
  pinDotsEl.classList.remove('success');
  currentPin = '';
  isVerifying = false;
  updateDots();
  pinMessage.textContent = '';
  pinMessage.className = 'pin-message';
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
  const listEl = document.getElementById('video-admin-list');

  if (!videos.length) {
    listEl.innerHTML = '<p class="admin-empty">Chưa có video nào.</p>';
    return;
  }

  listEl.innerHTML = videos.map((v, i) => `
    <div class="video-admin-card ${!v.visible ? 'hidden-video' : ''}"
         style="animation-delay: ${i * 0.06}s">
      <div class="video-admin-thumb">
        <img src="${escHtml(v.thumbnailUrl || 'captain.png')}"
             alt="${escHtml(v.title)}"
             onerror="this.src='captain.png'" />
      </div>
      <div class="video-admin-info">
        <h4 class="video-admin-title">${escHtml(v.title)}</h4>
        <p class="video-admin-meta">${escHtml(v.channelName || 'Phê Sữa Review')} · Thứ tự: ${v.order ?? '—'}</p>
        <a href="${escHtml(v.url)}" target="_blank" rel="noopener noreferrer"
           class="video-admin-link">🔗 Xem video</a>
      </div>
      <div class="video-admin-status">
        <span class="status-badge ${v.visible ? 'visible' : 'hidden-badge'}">
          ${v.visible ? '👁 Hiển thị' : '🙈 Ẩn'}
        </span>
        ${v.featured ? '<span class="status-badge featured-badge">⭐ Nổi bật</span>' : ''}
      </div>
      <div class="video-admin-actions">
        <button class="action-btn featured-btn ${v.featured ? 'featured-active' : ''}"
                onclick="setFeatured('${v.id}', ${!v.featured})">
          ${v.featured ? '⭐ Bỏ nổi bật' : '☆ Nổi bật'}
        </button>
        <button class="action-btn edit-btn"
                onclick="openEditModal('${v.id}')">✏️ Sửa</button>
        <button class="action-btn delete-btn"
                onclick="confirmDelete('${v.id}', \`${escHtml(v.title).replace(/`/g, '\\`')}\`)">🗑️ Xóa</button>
      </div>
    </div>
  `).join('');
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

// ─── SET FEATURED ─────────────────────────
window.setFeatured = async function (docId, makeFeatured) {
  try {
    const batch = db.batch();

    if (makeFeatured) {
      // Bỏ featured của tất cả video trước
      const allSnap = await db.collection('videos').where('featured', '==', true).get();
      allSnap.docs.forEach(d => batch.update(d.ref, { featured: false }));
    }

    // Set featured cho video được chọn
    batch.update(db.collection('videos').doc(docId), { featured: makeFeatured });
    await batch.commit();

    showToast(makeFeatured ? '⭐ Đã đặt làm video nổi bật!' : '✅ Đã bỏ nổi bật', 'success');
    loadVideos();
  } catch (err) {
    showToast('❌ Lỗi: ' + err.message, 'error');
    console.error('[Admin] setFeatured error:', err);
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
  toastEl.textContent = message;
  toastEl.className   = `toast ${type}`;

  toastTimer = setTimeout(() => {
    toastEl.className = 'toast hidden';
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
