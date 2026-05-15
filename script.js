/* ============================================
   扭蛋机抽奖网页 — 交互逻辑
   ============================================ */

// --- DOM 元素 ---
const twistBtn     = document.getElementById('twistBtn');
const retryBtn     = document.getElementById('retryBtn');
const gachaMachine = document.getElementById('gachaMachine');
const crankBtn     = document.getElementById('crankBtn');
const capsuleEl    = document.getElementById('capsuleFalling');
const resultOverlay = document.getElementById('resultOverlay');
const resultCard   = document.getElementById('resultCard');
const cardPhoto    = document.getElementById('cardPhoto');
const cardText     = document.getElementById('cardText');
const rarityStars  = document.getElementById('rarityStars');
const shareBtn     = document.getElementById('shareBtn');
const qrOverlay    = document.getElementById('qrOverlay');
const qrClose      = document.getElementById('qrClose');
const qrCode       = document.getElementById('qrCode');
const qrUrl        = document.getElementById('qrUrl');
const qrCopyBtn    = document.getElementById('qrCopyBtn');
const canvas       = document.getElementById('particleCanvas');
const ctx          = canvas.getContext('2d');

// --- 状态 ---
let isSpinning = false;
let currentPrize = null;

// --- 工具函数：加权随机 ---
function weightedRandom(items) {
  const weights = items.map(item => {
    // rarity 1 (稀有) = 权重低, rarity 3 (常见) = 权重高
    switch (item.rarity) {
      case 1: return 2;   // 稀有
      case 2: return 5;   // 不常见
      case 3: return 10;  // 常见
      default: return 5;
    }
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }

  return items[items.length - 1];
}

// --- 检查图片是否存在（失败时回退到占位图） ---
function setPhotoWithFallback(imgEl, src) {
  imgEl.onerror = function () {
    imgEl.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23FFE4EC' width='200' height='200' rx='20'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E8678A' font-size='48'%3E💗%3C/text%3E%3Ctext x='100' y='135' text-anchor='middle' fill='%23E8678A' font-size='13' font-family='sans-serif'%3E照片放这里%3C/text%3E%3C/svg%3E`;
    imgEl.onerror = null;
  };
  imgEl.src = src;
}

// --- 粒子特效 ---
let particles = [];
let animFrameId = null;

const particleColors = ['#FF85A2', '#FFB3C6', '#FFD700', '#FFE0A0', '#FF5C8A',
                        '#E8D0FF', '#C8E0FF', '#B8F0D0', '#FFFFFF'];

function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 2;
    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: Math.random() * 4 + 2,
      color: particleColors[Math.floor(Math.random() * particleColors.length)],
      life: 1,
      decay: Math.random() * 0.015 + 0.008,
      shape: Math.random() > 0.5 ? 'circle' : 'heart'
    });
  }
}

function animateParticles() {
  if (particles.length === 0) {
    animFrameId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter(p => p.life > 0);

  for (const p of particles) {
    p.x += p.vx;
    p.vy += 0.12;
    p.y += p.vy;
    p.life -= p.decay;

    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;

    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 画小心形
      const s = p.size;
      ctx.beginPath();
      const tx = p.x;
      const ty = p.y;
      ctx.moveTo(tx, ty + s * 0.3);
      ctx.bezierCurveTo(tx, ty - s * 0.3, tx - s, ty - s * 0.3, tx - s, ty + s * 0.3);
      ctx.bezierCurveTo(tx - s, ty + s * 0.8, tx, ty + s * 0.7, tx, ty + s);
      ctx.bezierCurveTo(tx, ty + s * 0.7, tx + s, ty + s * 0.8, tx + s, ty + s * 0.3);
      ctx.bezierCurveTo(tx + s, ty - s * 0.3, tx, ty - s * 0.3, tx, ty + s * 0.3);
      ctx.fill();
    }

    ctx.restore();
  }

  animFrameId = requestAnimationFrame(animateParticles);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 扭蛋主流程 ---
function startGacha() {
  if (isSpinning) return;
  isSpinning = true;

  // 禁用按钮
  twistBtn.disabled = true;
  twistBtn.querySelector('.btn-text').textContent = '🎰 扭蛋中...';

  // 重置状态
  capsuleEl.classList.remove('dropping', 'popping');
  capsuleEl.style.opacity = '0';
  capsuleEl.style.transform = 'scale(0.3)';

  // 1. 机器摇晃
  gachaMachine.classList.add('shaking');
  crankBtn.classList.add('spinning');

  // 2. 摇晃结束 → 扭蛋掉落
  setTimeout(() => {
    gachaMachine.classList.remove('shaking');
    crankBtn.classList.remove('spinning');

    // 抽奖
    currentPrize = weightedRandom(gachaData);

    // 设置扭蛋颜色（根据稀有度）
    const topHalf = capsuleEl.querySelector('.capsule-top');
    const botHalf = capsuleEl.querySelector('.capsule-bottom');
    if (currentPrize.rarity === 1) {
      topHalf.style.background = 'linear-gradient(180deg, #FFD700, #FFF0A0)';
      botHalf.style.background = 'linear-gradient(180deg, #FFF0A0, #FFD700)';
    } else {
      topHalf.style.background = 'linear-gradient(180deg, #FFB3C6, #FFD4E0)';
      botHalf.style.background = 'linear-gradient(180deg, #FFD4E0, #FFB3C6)';
    }

    // 掉落动画
    capsuleEl.classList.add('dropping');

    // 3. 扭蛋到达底部 → 爆开
    setTimeout(() => {
      capsuleEl.classList.add('popping');

      // 粒子爆炸（从屏幕中央偏下）
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.65;
      spawnParticles(cx, cy, 50);
      if (!animFrameId) animateParticles();

      // 4. 显示结果卡片
      setTimeout(() => {
        // 加载照片
        setPhotoWithFallback(cardPhoto, currentPrize.image);
        cardText.textContent = currentPrize.text;

        // 稀有度星星
        const stars = ['⭐', '🌟', '💎'];
        const starCount = currentPrize.rarity;
        let starStr = '';
        for (let i = 0; i < starCount; i++) {
          starStr += stars[starCount - 1] || '⭐';
        }
        rarityStars.textContent = starStr;

        // 显示卡片
        resultOverlay.classList.add('show');
        capsuleEl.classList.remove('dropping', 'popping');
        capsuleEl.style.opacity = '0';
        capsuleEl.style.transform = 'scale(0.3)';

        // 卡片出现时再爆一轮粒子
        spawnParticles(cx, cy, 30);
        if (!animFrameId) animateParticles();

        isSpinning = false;
        twistBtn.disabled = false;
        twistBtn.querySelector('.btn-text').textContent = '✨ 点击扭蛋 ✨';
      }, 400);

    }, 900);

  }, 1500);
}

function resetGacha() {
  resultOverlay.classList.remove('show');
  currentPrize = null;

  // 再次粒子
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.5;
  spawnParticles(cx, cy, 25);
  if (!animFrameId) animateParticles();
}

// --- 事件绑定 ---
twistBtn.addEventListener('click', startGacha);
crankBtn.addEventListener('click', startGacha);
retryBtn.addEventListener('click', resetGacha);

// --- QR 码分享 ---
function openQRModal() {
  // 清空旧二维码
  qrCode.innerHTML = '';

  const url = window.location.href;

  try {
    new QRCode(qrCode, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#E8678A',
      colorLight: '#FFF5F7',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) {
    qrCode.innerHTML = '<p style="color:#E8678A;">二维码生成失败，请直接分享链接 💗</p>';
  }

  qrUrl.textContent = url;
  qrOverlay.classList.add('show');
}

function closeQRModal() {
  qrOverlay.classList.remove('show');
}

shareBtn.addEventListener('click', openQRModal);
qrClose.addEventListener('click', closeQRModal);

qrOverlay.addEventListener('click', function (e) {
  if (e.target === qrOverlay) closeQRModal();
});

// 复制链接
qrCopyBtn.addEventListener('click', function () {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    qrCopyBtn.textContent = '✅ 已复制！';
    qrCopyBtn.classList.add('copied');
    setTimeout(() => {
      qrCopyBtn.textContent = '📋 复制链接';
      qrCopyBtn.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    qrCopyBtn.textContent = '❌ 复制失败';
    setTimeout(() => {
      qrCopyBtn.textContent = '📋 复制链接';
    }, 2000);
  });
});

// 键盘关闭弹窗
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (qrOverlay.classList.contains('show')) closeQRModal();
    if (resultOverlay.classList.contains('show')) resetGacha();
  }
});

// --- 卡片照片加载后触发微动画 ---
cardPhoto.addEventListener('load', function () {
  if (resultOverlay.classList.contains('show')) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.5;
    spawnParticles(cx, cy, 15);
    if (!animFrameId) animateParticles();
  }
});

console.log('💗 扭蛋惊喜机已就绪！');
console.log('📸 请将照片放入 images/ 文件夹，并在 config.js 中配置路径');
console.log('🔗 当前页面地址：' + window.location.href);
