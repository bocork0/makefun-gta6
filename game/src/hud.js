// HUD: DOM readouts (money, wanted stars, health, objective), the 2D canvas
// minimap, prompts, toasts, banners and the title / pause / game-over overlays.
import { CITY_HALF, STREETS } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    money: $('money'),
    stars: $('stars'),
    healthFill: $('health-fill'),
    healthNum: $('health-num'),
    wantedLabel: $('wanted-label'),
    objTitle: $('objective-title'),
    objText: $('objective-text'),
    objDist: $('objective-dist'),
    minimap: $('minimap'),
    crosshair: $('crosshair'),
    prompt: $('prompt'),
    grab: $('grab'),
    grabFill: $('grab-fill'),
    toast: $('toast'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    damage: $('damage'),
    wantedFlash: $('wanted-flash'),
    titleOverlay: $('title-overlay'),
    pauseOverlay: $('pause-overlay'),
    overOverlay: $('over-overlay'),
    overTitle: $('over-title'),
    overCopy: $('over-copy'),
    btnContinue: $('btn-continue'),
    status: $('status'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = 0;
  let bannerTimer = 0;
  let damageTimer = 0;

  function starHtml(wanted) {
    let s = '';
    for (let i = 0; i < 5; i += 1) {
      s += `<span class="${i < wanted ? '' : 'off'}">★</span>`;
    }
    return s;
  }

  function drawMinimap(state) {
    const W = 200;
    const H = 200;
    const toPx = (v) => ((v + CITY_HALF + 12) / ((CITY_HALF + 12) * 2)) * W;
    mm.fillStyle = '#1d2b33';
    mm.fillRect(0, 0, W, H);
    // Water + beach on the south edge.
    mm.fillStyle = '#3f8fb5';
    mm.fillRect(0, toPx(152), W, H - toPx(152));
    mm.fillStyle = '#efe0b0';
    mm.fillRect(0, toPx(150), W, 3);
    // Blocks.
    mm.fillStyle = '#4a5a52';
    for (let i = 0; i < STREETS.length - 1; i += 1) {
      for (let j = 0; j < STREETS.length - 1; j += 1) {
        mm.fillRect(toPx(STREETS[i] + 6), toPx(STREETS[j] + 6), toPx(STREETS[i + 1] - 6) - toPx(STREETS[i] + 6), toPx(STREETS[j + 1] - 6) - toPx(STREETS[j] + 6));
      }
    }
    // Roads.
    mm.fillStyle = '#6a7076';
    for (const s of STREETS) {
      mm.fillRect(toPx(s - 6), 0, toPx(s + 6) - toPx(s - 6), H);
      mm.fillRect(0, toPx(s - 6), W, toPx(s + 6) - toPx(s - 6));
    }
    // Mission marker: pulsing yellow diamond.
    const marker = state.missionMarker;
    if (marker) {
      const pulse = 6 + Math.sin(state.time * 5) * 2;
      mm.fillStyle = '#ffc94d';
      const mx = toPx(marker.x);
      const my = toPx(marker.z);
      mm.beginPath();
      mm.moveTo(mx, my - pulse);
      mm.lineTo(mx + pulse, my);
      mm.lineTo(mx, my + pulse);
      mm.lineTo(mx - pulse, my);
      mm.closePath();
      mm.fill();
    }
    // Police cars: red dots.
    mm.fillStyle = '#ff5a4d';
    for (const p of state.police) mm.fillRect(toPx(p.x) - 2, toPx(p.z) - 2, 4, 4);
    // Traffic: pale dots.
    mm.fillStyle = 'rgba(242,237,224,0.75)';
    for (const c of state.traffic) mm.fillRect(toPx(c.x) - 1.5, toPx(c.z) - 1.5, 3, 3);
    // Player: white arrow pointing along the heading (map: +x right, +z down).
    const px = toPx(state.player.x);
    const py = toPx(state.player.z);
    mm.save();
    mm.translate(px, py);
    mm.rotate(Math.PI - state.playerHeading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(0, 3);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
    // View cone hint.
    mm.strokeStyle = 'rgba(255,255,255,0.35)';
    const viewAngle = Math.PI / 2 - state.playerHeading;
    mm.beginPath();
    mm.arc(px, py, 14, viewAngle - 0.5, viewAngle + 0.5);
    mm.stroke();
  }

  return {
    els,
    drawMinimap,
    showTitle(saveExists) {
      els.titleOverlay.hidden = false;
      els.pauseOverlay.hidden = true;
      els.overOverlay.hidden = true;
      els.btnContinue.hidden = !saveExists;
    },
    showPause() {
      els.pauseOverlay.hidden = false;
    },
    hidePause() {
      els.pauseOverlay.hidden = true;
    },
    showGameOver(kind, detail) {
      els.overTitle.textContent = kind;
      els.overCopy.textContent = detail;
      els.overOverlay.hidden = false;
    },
    hideOverlays() {
      els.titleOverlay.hidden = true;
      els.pauseOverlay.hidden = true;
      els.overOverlay.hidden = true;
    },
    toast(text, seconds = 3) {
      els.toast.textContent = text;
      els.toast.hidden = false;
      toastTimer = seconds;
    },
    banner(title, sub, seconds = 3.5) {
      els.bannerTitle.textContent = title;
      els.bannerSub.textContent = sub;
      els.banner.hidden = false;
      bannerTimer = seconds;
    },
    flashDamage() {
      els.damage.classList.add('on');
      damageTimer = 0.35;
    },
    announce(text) {
      els.status.textContent = text;
    },
    update(state, dt) {
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) els.toast.hidden = true;
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) els.banner.hidden = true;
      }
      if (damageTimer > 0) {
        damageTimer -= dt;
        if (damageTimer <= 0) els.damage.classList.remove('on');
      }
      els.money.textContent = `$${state.money.toLocaleString('en-US')}`;
      els.stars.innerHTML = starHtml(state.wanted);
      els.wantedLabel.textContent = state.wanted > 0 ? `· WANTED ${state.wanted}★` : '';
      const hp = Math.max(0, Math.round(state.hp));
      els.healthFill.style.width = `${hp}%`;
      els.healthFill.classList.toggle('low', hp <= 30);
      els.healthNum.textContent = String(hp);
      els.objTitle.textContent = state.missionTitle;
      els.objText.textContent = state.objective;
      els.objDist.textContent = state.missionDist != null ? `${Math.round(state.missionDist)} m` : '';
      els.crosshair.hidden = state.inCar || !state.playing;
      els.wantedFlash.classList.toggle('on', state.wanted >= 3 && Math.floor(state.time * 2) % 2 === 0);
      if (state.prompt) {
        els.prompt.textContent = state.prompt;
        els.prompt.hidden = false;
      } else {
        els.prompt.hidden = true;
      }
      if (state.grabProgress > 0) {
        els.grab.hidden = false;
        els.grabFill.style.width = `${Math.round(state.grabProgress * 100)}%`;
      } else {
        els.grab.hidden = true;
      }
      drawMinimap(state);
    },
  };
}
