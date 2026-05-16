/* ============================================
   扭蛋机抽奖网页 — 交互逻辑
   ============================================ */

// --- DOM 元素 ---
var twistBtn     = document.getElementById('twistBtn');
var retryBtn     = document.getElementById('retryBtn');
var gachaMachine = document.getElementById('gachaMachine');
var crankBtn     = document.getElementById('crankBtn');
var capsuleEl    = document.getElementById('capsuleFalling');
var resultOverlay = document.getElementById('resultOverlay');
var resultCard   = document.getElementById('resultCard');
var cardPhoto    = document.getElementById('cardPhoto');
var cardText     = document.getElementById('cardText');
var rarityStars  = document.getElementById('rarityStars');
var shareBtn     = document.getElementById('shareBtn');
var qrOverlay    = document.getElementById('qrOverlay');
var qrClose      = document.getElementById('qrClose');
var qrCode       = document.getElementById('qrCode');
var qrUrl        = document.getElementById('qrUrl');
var qrCopyBtn    = document.getElementById('qrCopyBtn');
var musicBtn     = document.getElementById('musicBtn');
var musicIcon    = document.getElementById('musicIcon');
var canvas       = document.getElementById('particleCanvas');
var ctx2d        = canvas.getContext('2d');

// --- 状态 ---
var isSpinning = false;
var currentPrize = null;
var audioCtx = null;
var musicPlaying = false;
var musicStarted = false;
var bgmInterval = null;
var bgmGainNode = null;
var bgmIdx = 0;
var bgmNotes = [523, 659, 784, 523, 880, 784, 659, 784, 1047, 784, 659, 523, 587, 659, 784, 523];

// --- 音频引擎 ---
function hasAudio() {
  return audioCtx && audioCtx.state === 'running';
}

function initAudio() {
  if (audioCtx) return;
  try {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audioCtx = new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

function playTone(freq, startTime, dur, type, vol) {
  if (!hasAudio()) return;
  try {
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(vol || 0.08, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(startTime); o.stop(startTime + dur + 0.01);
  } catch (e) {}
}

function playShakeSfx() {
  if (!hasAudio()) return;
  var t = audioCtx.currentTime;
  for (var i = 0; i < 6; i++) {
    playTone(150 + Math.random() * 300, t + i * 0.07, 0.04, 'triangle', 0.06);
  }
}

function playDropSfx() {
  if (!hasAudio()) return;
  var t = audioCtx.currentTime;
  playTone(500, t, 0.55, 'sine', 0.08);
  try {
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.55);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.6);
  } catch (e) {}
}

function playRevealSfx() {
  if (!hasAudio()) return;
  var t = audioCtx.currentTime;
  [523, 659, 784, 1047].forEach(function(f, i) {
    playTone(f, t + i * 0.12, 0.35, 'sine', 0.07);
  });
}

function startBgm() {
  if (!hasAudio() || bgmInterval) return;
  try {
    bgmGainNode = audioCtx.createGain();
    bgmGainNode.gain.value = 0.02;
    bgmGainNode.connect(audioCtx.destination);
  } catch (e) { return; }
  bgmInterval = setInterval(function() {
    if (!hasAudio()) return;
    try {
      playTone(bgmNotes[bgmIdx % bgmNotes.length], audioCtx.currentTime, 0.38, 'sine', 0.05);
      bgmIdx++;
    } catch (e) {}
  }, 480);
}

function stopBgm() {
  if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
  if (bgmGainNode) {
    try { bgmGainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3); } catch (e) {}
    bgmGainNode = null;
  }
}

function tryStartMusic() {
  if (musicStarted) return;
  musicStarted = true;
  musicPlaying = true;
  musicBtn.classList.add('playing');
  musicBtn.classList.remove('muted');
  musicIcon.textContent = '🎵';
  initAudio();
  startBgm();
}

function toggleMusic() {
  if (!musicStarted) { tryStartMusic(); return; }
  if (musicPlaying) {
    stopBgm();
    musicPlaying = false;
    musicBtn.classList.remove('playing');
    musicBtn.classList.add('muted');
    musicIcon.textContent = '🔇';
  } else {
    initAudio();
    startBgm();
    musicPlaying = true;
    musicBtn.classList.add('playing');
    musicBtn.classList.remove('muted');
    musicIcon.textContent = '🎵';
  }
}

musicBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  toggleMusic();
});

// --- 加权随机 ---
function weightedRandom(items) {
  var weights = [];
  for (var i = 0; i < items.length; i++) {
    var r = items[i].rarity;
    weights.push(r === 1 ? 2 : r === 2 ? 5 : 10);
  }
  var total = 0;
  for (var j = 0; j < weights.length; j++) total += weights[j];
  var rand = Math.random() * total;
  for (var k = 0; k < items.length; k++) {
    rand -= weights[k];
    if (rand <= 0) return items[k];
  }
  return items[items.length - 1];
}

function setPhotoWithFallback(img, src) {
  img.onerror = function() {
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23FFE4EC' width='200' height='200' rx='20'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E8678A' font-size='48'%3E💗%3C/text%3E%3Ctext x='100' y='135' text-anchor='middle' fill='%23E8678A' font-size='13' font-family='sans-serif'%3E照片放这里%3C/text%3E%3C/svg%3E";
    img.onerror = null;
  };
  img.src = src;
}

// --- 粒子特效 ---
var particles = [];
var animFrameId = null;
var particleColors = ['#FF85A2','#FFB3C6','#FFD700','#FFE0A0','#FF5C8A','#E8D0FF','#C8E0FF','#B8F0D0','#FFFFFF'];

function spawnParticles(x, y, count) {
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = Math.random() * 6 + 2;
    particles.push({
      x: x, y: y,
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
  if (particles.length === 0) { animFrameId = null; ctx2d.clearRect(0, 0, canvas.width, canvas.height); return; }
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(function(p) { return p.life > 0; });
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.x += p.vx; p.vy += 0.12; p.y += p.vy; p.life -= p.decay;
    ctx2d.save();
    ctx2d.globalAlpha = p.life;
    ctx2d.fillStyle = p.color;
    if (p.shape === 'circle') {
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx2d.fill();
    } else {
      var s = p.size, tx = p.x, ty = p.y;
      ctx2d.beginPath();
      ctx2d.moveTo(tx, ty + s * 0.3);
      ctx2d.bezierCurveTo(tx, ty - s * 0.3, tx - s, ty - s * 0.3, tx - s, ty + s * 0.3);
      ctx2d.bezierCurveTo(tx - s, ty + s * 0.8, tx, ty + s * 0.7, tx, ty + s);
      ctx2d.bezierCurveTo(tx, ty + s * 0.7, tx + s, ty + s * 0.8, tx + s, ty + s * 0.3);
      ctx2d.bezierCurveTo(tx + s, ty - s * 0.3, tx, ty - s * 0.3, tx, ty + s * 0.3);
      ctx2d.fill();
    }
    ctx2d.restore();
  }
  animFrameId = requestAnimationFrame(animateParticles);
}

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 扭蛋主流程 ---
function startGacha() {
  if (isSpinning) return;
  isSpinning = true;

  twistBtn.disabled = true;
  twistBtn.querySelector('.btn-text').textContent = '🎰 扭蛋中...';

  // 初始化音频（不影响交互）
  try { initAudio(); if (!musicStarted) tryStartMusic(); } catch (e) {}

  capsuleEl.classList.remove('dropping', 'popping');
  capsuleEl.style.opacity = '0';
  capsuleEl.style.transform = 'scale(0.3)';

  gachaMachine.classList.add('shaking');
  crankBtn.classList.add('spinning');
  playShakeSfx();

  setTimeout(function() {
    gachaMachine.classList.remove('shaking');
    crankBtn.classList.remove('spinning');

    currentPrize = weightedRandom(gachaData);

    var topHalf = capsuleEl.querySelector('.capsule-top');
    var botHalf = capsuleEl.querySelector('.capsule-bottom');
    if (currentPrize.rarity === 1) {
      topHalf.style.background = 'linear-gradient(180deg, #FFD700, #FFF0A0)';
      botHalf.style.background = 'linear-gradient(180deg, #FFF0A0, #FFD700)';
    } else {
      topHalf.style.background = 'linear-gradient(180deg, #FFB3C6, #FFD4E0)';
      botHalf.style.background = 'linear-gradient(180deg, #FFD4E0, #FFB3C6)';
    }

    capsuleEl.classList.add('dropping');
    playDropSfx();

    setTimeout(function() {
      capsuleEl.classList.add('popping');

      var cx = window.innerWidth / 2;
      var cy = window.innerHeight * 0.65;
      spawnParticles(cx, cy, 50);
      if (!animFrameId) animateParticles();
      playRevealSfx();

      setTimeout(function() {
        setPhotoWithFallback(cardPhoto, currentPrize.image);
        cardText.textContent = currentPrize.text;

        var starCount = currentPrize.rarity;
        var starStr = '';
        for (var s = 0; s < starCount; s++) starStr += starCount === 1 ? '💎' : starCount === 2 ? '🌟' : '⭐';
        rarityStars.textContent = starStr;

        resultOverlay.classList.add('show');
        capsuleEl.classList.remove('dropping', 'popping');
        capsuleEl.style.opacity = '0';
        capsuleEl.style.transform = 'scale(0.3)';

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
  var cx = window.innerWidth / 2;
  var cy = window.innerHeight * 0.5;
  spawnParticles(cx, cy, 25);
  if (!animFrameId) animateParticles();
}

// --- 事件绑定 ---
twistBtn.addEventListener('click', startGacha);
crankBtn.addEventListener('click', startGacha);
retryBtn.addEventListener('click', resetGacha);

// --- QR 码分享 ---
function openQRModal() {
  qrCode.innerHTML = '';
  var url = window.location.href;
  try {
    new QRCode(qrCode, {
      text: url, width: 200, height: 200,
      colorDark: '#E8678A', colorLight: '#FFF5F7',
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) {
    qrCode.innerHTML = '<p style="color:#E8678A;">二维码生成失败，请直接分享链接 💗</p>';
  }
  qrUrl.textContent = url;
  qrOverlay.classList.add('show');
}

function closeQRModal() { qrOverlay.classList.remove('show'); }

shareBtn.addEventListener('click', openQRModal);
qrClose.addEventListener('click', closeQRModal);
qrOverlay.addEventListener('click', function(e) {
  if (e.target === qrOverlay) closeQRModal();
});

qrCopyBtn.addEventListener('click', function() {
  var url = window.location.href;
  navigator.clipboard.writeText(url).then(function() {
    qrCopyBtn.textContent = '✅ 已复制！';
    qrCopyBtn.classList.add('copied');
    setTimeout(function() { qrCopyBtn.textContent = '📋 复制链接'; qrCopyBtn.classList.remove('copied'); }, 2000);
  }).catch(function() {
    qrCopyBtn.textContent = '❌ 复制失败';
    setTimeout(function() { qrCopyBtn.textContent = '📋 复制链接'; }, 2000);
  });
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    if (qrOverlay.classList.contains('show')) closeQRModal();
    if (resultOverlay.classList.contains('show')) resetGacha();
  }
});

cardPhoto.addEventListener('load', function() {
  if (resultOverlay.classList.contains('show')) {
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight * 0.5;
    spawnParticles(cx, cy, 15);
    if (!animFrameId) animateParticles();
  }
});
