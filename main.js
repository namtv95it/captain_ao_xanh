/* =========================================
   main.js – Particles + Card Effects + Firestore Loader
   ========================================= */

// ─── PARTICLE SYSTEM ──────────────────────
const canvas  = document.getElementById('particles-canvas');
const ctx     = canvas.getContext('2d');
let particles = [];
let W, H;

const COLORS = ['#69c9d0', '#ee1d52', '#7c3aed', '#ffffff'];
const TYPES = ['orb', 'orb', 'orb', 'orb', 'orb', 'bubble', 'heart', 'leaf'];
const EMOJIS = {
  bubble: '🫧',
  heart: '❤️',
  leaf: ['🍁', '🍂']
};

function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

class Particle {
  constructor() { this.reset(true); }

  reset(initial = false) {
    this.type = TYPES[Math.floor(Math.random() * TYPES.length)];
    this.x  = Math.random() * W;

    // Lá rơi từ trên xuống, bong bóng/tim/orb bay từ dưới lên
    if (this.type === 'leaf') {
      this.y = initial ? Math.random() * H : -20;
      this.vy = Math.random() * 0.8 + 0.5;
      this.icon = EMOJIS.leaf[Math.floor(Math.random() * EMOJIS.leaf.length)];
    } else {
      this.y = initial ? Math.random() * H : H + 20;
      this.vy = -(Math.random() * 0.5 + 0.2);
      this.icon = EMOJIS[this.type];
    }

    this.vx = (Math.random() - 0.5) * 0.5;
    this.alpha = Math.random() * 0.6 + 0.2;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.r  = Math.random() * 1.8 + 0.6;
    this.size = Math.random() * 12 + 12;

    this.angle = Math.random() * Math.PI * 2;
    this.spinSpeed = (Math.random() - 0.5) * 0.05;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.03 + 0.01;
  }

  update() {
    this.wobble += this.wobbleSpeed;
    this.angle += this.spinSpeed;
    const currentVx = this.vx + Math.sin(this.wobble) * 0.3;
    this.x += currentVx;
    this.y += this.vy;

    if (this.type === 'leaf' && this.y > H + 20) this.reset();
    else if (this.type !== 'leaf' && this.y < -20) this.reset();
  }

  draw() {
    ctx.save();
    if (this.type === 'orb') {
      const a = this.alpha * (0.6 + 0.4 * Math.sin(this.wobble));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 10;
      ctx.fill();
    } else {
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      if (this.type === 'leaf') ctx.rotate(this.angle);
      ctx.font = `${this.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.icon, 0, 0);
    }
    ctx.restore();
  }
}

function initParticles(count = 70) {
  particles = Array.from({ length: count }, () => new Particle());
}

function animateParticles() {
  ctx.clearRect(0, 0, W, H);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animateParticles);
}

initParticles();
animateParticles();

// ─── CARD MOUSE TILT ─────────────────────
if (window.matchMedia('(any-hover: hover)').matches) {
  document.querySelectorAll('.channel-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 12;
      const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -12;
      card.style.transform = `translateY(-8px) rotateX(${y}deg) rotateY(${x}deg) scale(1.01)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.5s cubic-bezier(0.4,0,0.2,1)';
    });

    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s ease';
    });
  });
}

// ─── FIRESTORE VIDEO LOADER (index.html) ──
// Chỉ chạy khi tồn tại #featured-hero-list trên trang
if (document.getElementById('featured-hero-list')) {
  loadAllVideos();
}

// Load tất cả video visible và hiển thị ở section bên ngoài
async function loadAllVideos() {
  const hero   = document.getElementById('featured-hero');
  const listEl = document.getElementById('featured-hero-list');
  if (!hero || !listEl) return;

  // Hiển thị skeleton trong khi chờ
  listEl.innerHTML = `
    <div class="video-item" style="pointer-events:none;opacity:0.5">
      <div class="video-thumb" style="background:rgba(255,255,255,0.04);border-radius:12px"></div>
      <div class="video-details"><div class="video-skeleton" style="height:14px;width:60%;margin-bottom:6px"></div><div class="video-skeleton" style="height:10px;width:35%"></div></div>
    </div>`;
  hero.classList.remove('hidden');

  try {
    const snap = await db.collection('videos')
      .orderBy('order')
      .get();

    const videos = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(v => v.visible !== false);

    if (!videos.length) {
      hero.classList.add('hidden');
      return;
    }

    listEl.innerHTML = videos.map(v => `
      <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="featured-hero-card">
        <div class="featured-hero-thumb">
          <img src="${v.thumbnailUrl || 'captain.png'}"
               alt="${v.title}"
               onerror="this.src='captain.png'" />
          <div class="featured-hero-overlay">
            <div class="featured-play-btn">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <!-- Mobile: title overlay -->
            <div class="featured-overlay-info">
              <p class="featured-overlay-channel">${v.channelName || 'Captain Áo Xanh'}</p>
              <h2 class="featured-overlay-title">${v.title}</h2>
              <span class="featured-overlay-cta">
                Xem ngay
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>
        <div class="featured-hero-info">
          <h2 class="featured-hero-title">${v.title}</h2>
          <p class="featured-hero-channel">${v.channelName || 'Captain Áo Xanh'}</p>
          <span class="featured-hero-cta">
            Xem ngay
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </div>
        <div class="featured-hero-glow"></div>
      </a>`).join('');

    hero.classList.remove('hidden');
  } catch (err) {
    console.warn('[index] Firestore error:', err.message);
    hero.classList.add('hidden');
  }
}


// ─── IN-APP BROWSER DETECTION ───
const ua = navigator.userAgent || '';

// Detect TikTok - đầy đủ các UA string TikTok dùng
const isTikTok = /TikTok|bytedance|musical_li|aweme|Musically|trill|lark/i.test(ua);

// Detect bất kỳ in-app browser / WebView nào (Facebook, Instagram, Line, v.v.)
const isWebView = (
  /wv\b/.test(ua) ||                     // Android WebView: "wv"
  /FBAN|FBAV|Instagram|Line\/|Snapchat|Twitter|Pinterest|LinkedIn|WhatsApp/i.test(ua) ||
  (/(iPhone|iPod|iPad)/.test(ua) && !/Safari\//.test(ua) && /AppleWebKit/.test(ua))  // iOS WebView không có Safari
);

const isInApp = isTikTok || isWebView;
const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

// Hiển thị banner nếu đang trong In-App Browser
const tiktokBanner = document.getElementById('tiktok-banner');
if (isInApp && tiktokBanner) {
  tiktokBanner.classList.remove('hidden');
}

// Toast thông báo
const toastEl = document.getElementById('toast');
function showToast(msg = 'Đã sao chép đường dẫn!') {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2500);
}

// Copy link YouTube trực tiếp trên thẻ
window.copyInlineYtLink = async function() {
  const input = document.getElementById('inline-yt-input');
  const btnText = document.getElementById('inline-copy-text');
  const url = input ? input.value : 'https://www.youtube.com/channel/UCrWjMw_O4UHWCBWpRJvSXJw';

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else if (input) {
      input.select();
      input.setSelectionRange(0, 99999);
      document.execCommand('copy');
    }
    showToast('✅ Đã sao chép link kênh YouTube!');
    if (btnText) {
      btnText.textContent = 'Đã chép!';
      setTimeout(() => { btnText.textContent = 'Sao chép'; }, 2000);
    }
  } catch (err) {
    showToast('Lỗi khi chép, vui lòng giữ link để sao chép thủ công');
  }
};
