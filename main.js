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
// Chỉ chạy khi tồn tại #video-list trên trang
if (document.getElementById('video-list')) {
  loadFeaturedVideo();
  loadVideosFromFirestore();
}

// Load 1 video nổi bật (featured: true)
async function loadFeaturedVideo() {
  const hero = document.getElementById('featured-hero');
  if (!hero) return;

  try {
    const snap = await db.collection('videos')
      .where('featured', '==', true)
      .limit(1)
      .get();

    if (snap.empty) return; // Không có video nổi bật → ẩn section

    const v = snap.docs[0].data();

    // Desktop fields
    document.getElementById('featured-hero-img').src             = v.thumbnailUrl || 'captain.png';
    document.getElementById('featured-hero-img').alt             = v.title;
    document.getElementById('featured-hero-title').textContent   = v.title;
    document.getElementById('featured-hero-channel').textContent = v.channelName || 'Phê Sữa Review';
    document.getElementById('featured-hero-link').href           = v.url;

    // Mobile overlay fields
    document.getElementById('featured-overlay-title').textContent   = v.title;
    document.getElementById('featured-overlay-channel').textContent = v.channelName || 'Phê Sữa Review';

    hero.classList.remove('hidden');
  } catch (err) {
    console.warn('[index] Featured video error:', err.message);
    // Ẩn section nếu không load được
  }
}

async function loadVideosFromFirestore() {
  const listEl = document.getElementById('video-list');
  if (!listEl) return;

  try {
    // orderBy đơn giản — không cần composite index
    const snap = await db.collection('videos')
      .orderBy('order')
      .get();

    // Lọc visible và loại trừ video nổi bật (featured == true) để không bị trùng
    const videos = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(v => v.visible !== false && !v.featured);

    if (!videos.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted);text-align:center;font-size:.9rem;padding:12px 0">Chưa có video nào khác.</p>';
      return;
    }

    listEl.innerHTML = videos.map(v => `
      <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="video-item">
        <div class="video-thumb">
          <img src="${v.thumbnailUrl || 'captain.png'}"
               alt="${v.title}"
               onerror="this.src='captain.png'" />
          <div class="play-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
        <div class="video-details">
          <h4 class="video-title">${v.title}</h4>
          <p class="video-meta">${v.channelName || 'Phê Sữa Review'}</p>
        </div>
        <span class="video-watch-btn">Xem</span>
      </a>`).join('');

  } catch (err) {
    console.warn('[index] Firestore error, dùng fallback:', err.message);
    // Fallback: hiển thị video cứng nếu Firestore lỗi
    listEl.innerHTML = `
      <a href="https://www.youtube.com/channel/UCrWjMw_O4UHWCBWpRJvSXJw"
         target="_blank" rel="noopener noreferrer" class="video-item">
        <div class="video-thumb">
          <img src="quy-khu.png" alt="Quy Khư - Phần 1" />
          <div class="play-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="video-details">
          <h4 class="video-title">Quy Khư - Phần 1</h4>
          <p class="video-meta">Phê Sữa Review</p>
        </div>
        <span class="video-watch-btn">Xem</span>
      </a>
      <a href="https://www.youtube.com/channel/UCrWjMw_O4UHWCBWpRJvSXJw"
         target="_blank" rel="noopener noreferrer" class="video-item">
        <div class="video-thumb">
          <img src="vddn-04.png" alt="Vùng Đất Đảo Ngược Tập 4" />
          <div class="play-overlay">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div class="video-details">
          <h4 class="video-title">Vùng Đất Đảo Ngược Tập 4</h4>
          <p class="video-meta">Phê Sữa Review</p>
        </div>
        <span class="video-watch-btn">Xem</span>
      </a>`;
  }
}
