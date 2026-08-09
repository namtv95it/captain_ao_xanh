/* =========================================
   main.js – Particles + Card Effects
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
    
    // Khởi tạo vị trí tuỳ theo loại (lá rơi từ trên xuống, bong bóng/tim/orb bay từ dưới lên)
    if (this.type === 'leaf') {
      this.y = initial ? Math.random() * H : -20;
      this.vy = Math.random() * 0.8 + 0.5; // fall down
      this.icon = EMOJIS.leaf[Math.floor(Math.random() * EMOJIS.leaf.length)];
    } else {
      this.y = initial ? Math.random() * H : H + 20;
      this.vy = -(Math.random() * 0.5 + 0.2); // float up
      this.icon = EMOJIS[this.type];
    }
    
    this.vx = (Math.random() - 0.5) * 0.5;
    this.alpha = Math.random() * 0.6 + 0.2;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.r  = Math.random() * 1.8 + 0.6; // cho orb
    this.size = Math.random() * 12 + 12; // cho emoji
    
    this.angle = Math.random() * Math.PI * 2;
    this.spinSpeed = (Math.random() - 0.5) * 0.05;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.03 + 0.01;
  }

  update() {
    this.wobble += this.wobbleSpeed;
    this.angle += this.spinSpeed;
    
    // Thêm độ lắc lư (wobble)
    let currentVx = this.vx + Math.sin(this.wobble) * 0.3;
    
    this.x += currentVx;
    this.y += this.vy;

    // Reset nếu ra khỏi màn hình
    if (this.type === 'leaf' && this.y > H + 20) this.reset();
    else if (this.type !== 'leaf' && this.y < -20) this.reset();
  }

  draw() {
    ctx.save();
    
    if (this.type === 'orb') {
      // Orb truyền thống
      const a = this.alpha * (0.6 + 0.4 * Math.sin(this.wobble));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 10;
      ctx.fill();
    } else {
      // Emoji (Lá, Tim, Bong bóng)
      ctx.globalAlpha = this.alpha;
      ctx.translate(this.x, this.y);
      if (this.type === 'leaf') ctx.rotate(this.angle); // Chỉ xoay lá
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
// Only apply tilt on devices that support hover (non-touch)
if (window.matchMedia("(any-hover: hover)").matches) {
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

