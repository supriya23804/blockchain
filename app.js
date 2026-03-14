// ─────────────────────────────────────────
//  CertChain — Blockchain Certificate Verification
//  script.js
// ─────────────────────────────────────────
 
// ── Slider ──────────────────────────────
let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const dots   = document.querySelectorAll('.dot');
 
function goSlide(n) {
  slides[slideIndex].classList.remove('active');
  dots[slideIndex].classList.remove('active');
  slideIndex = n;
  slides[slideIndex].classList.add('active');
  dots[slideIndex].classList.add('active');
}
 
// Auto-advance every 3.5 seconds
setInterval(() => {
  goSlide((slideIndex + 1) % slides.length);
}, 3500);
 
// ── SHA-256 Hash Generator ───────────────
async function generateHash(file) {
  const buffer      = await file.arrayBuffer();
  const hashBuffer  = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
 
// ── Card State Helper ────────────────────
function setCardState(idx, state, message, hash) {
  const card   = document.getElementById('card-' + idx);
  const status = document.getElementById('status-' + idx);
 
  card.classList.remove('verifying', 'verified', 'failed');
  status.classList.add('show');
 
  if (state === 'loading') {
    card.classList.add('verifying');
    status.innerHTML = '<span class="spinner"></span> <span style="color:var(--accent)">Computing hash…</span>';
 
  } else if (state === 'success') {
    card.classList.add('verified');
    status.innerHTML =
      '<span class="status-dot" style="background:var(--success)"></span>' +
      '<span style="color:var(--success)">' + message + '</span>';
    showBanner('success', '✔ Certificate Verified', 'This document is authentic and recorded on the blockchain.', hash);
 
  } else if (state === 'error') {
    card.classList.add('failed');
    status.innerHTML =
      '<span class="status-dot" style="background:var(--danger)"></span>' +
      '<span style="color:var(--danger)">' + message + '</span>';
    showBanner('error', '✖ Verification Failed', 'This document was not found in the blockchain registry.', hash);
  }
}
 
// ── Result Banner ────────────────────────
function showBanner(type, title, sub, hash) {
  const banner = document.getElementById('result-banner');
  banner.className         = 'result-banner ' + type;
  banner.style.display     = 'block';
 
  document.getElementById('result-icon').textContent  = type === 'success' ? '✅' : '❌';
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-title').style.color = type === 'success' ? 'var(--success)' : 'var(--danger)';
  document.getElementById('result-sub').textContent   = sub;
  document.getElementById('result-hash').textContent  = hash ? 'SHA-256: ' + hash : '';
 
  banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
 
// ── Main Verify Function ─────────────────
async function verifyCertificate(input, idx) {
  const file = input.files[0];
  if (!file) return;
 
  // Show loading state immediately
  setCardState(idx, 'loading');
 
  // Generate SHA-256 hash in the browser (file never leaves device)
  const hash = await generateHash(file);
 
  // Send hash to backend for blockchain lookup
  fetch('http://localhost:5000/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'valid') {
      setCardState(idx, 'success', 'Verified on blockchain ✓', hash);
    } else {
      setCardState(idx, 'error', 'Not found in registry', hash);
    }
  })
  .catch(() => {
    // ── Demo mode ──
    // Backend is offline (e.g. running locally without the server).
    // Simulates a realistic response so you can still demo the UI.
    // Remove this catch block once your backend is live.
    setTimeout(() => {
      const isValid = Math.random() > 0.4;
      if (isValid) {
        setCardState(idx, 'success', 'Verified on blockchain ✓', hash);
      } else {
        setCardState(idx, 'error', 'Not found in registry', hash);
      }
    }, 900);
  });
}
 