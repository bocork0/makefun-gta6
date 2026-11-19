// Solmar Bay — HUD, minimap and menus.
// All DOM work lives here; the world only calls setters and reads button
// actions, so the game logic never touches document directly.

import { ROAD_LINES, BLOCK_CENTERS, BOUNDS } from './city.js';

export class HUD {
  constructor(actions) {
    this.actions = actions;
    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'),
      money: $('money'),
      stars: $('stars'),
      healthFill: $('health-fill'),
      healthText: $('health-text'),
      objTitle: $('objective-title'),
      objText: $('objective-text'),
      objHold: $('objective-hold'),
      objHoldFill: $('objective-hold-fill'),
      speed: $('speed'),
      speedValue: $('speed-value'),
      minimap: $('minimap'),
      messages: $('messages'),
      menu: $('menu'),
      menuTitle: $('menu-title'),
      menuBody: $('menu-body'),
      menuButtons: $('menu-buttons'),
      hint: $('hint'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.messageTimer = null;
    this.bindMenuButtons();
  }

  bindMenuButtons() {
    this.el.menuButtons.addEventListener('click', (e) => {
      const action = e.target?.dataset?.action;
      if (!action) return;
      if (this.actions[action]) this.actions[action]();
    });
  }

  setMoney(amount) {
    this.el.money.textContent = `$${amount.toLocaleString()}`;
  }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.classList.toggle('hot', stars > 0);
  }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el.healthFill.style.width = `${pct}%`;
    this.el.healthText.textContent = `${Math.ceil(pct)}`;
    this.el.healthFill.classList.toggle('low', pct <= 25);
  }

  setObjective(obj, distance) {
    if (!obj) {
      this.el.objTitle.textContent = 'Free roam';
      this.el.objText.textContent = 'Explore Solmar Bay. Talk to Lena for work — missions pay.';
      this.el.objHold.style.display = 'none';
      return;
    }
    this.el.objTitle.textContent = obj.title;
    const dist = distance != null ? ` — ${Math.round(distance)}m` : '';
    this.el.objText.textContent = obj.text + dist;
    if (obj.hold != null) {
      this.el.objHold.style.display = 'block';
      this.el.objHoldFill.style.width = `${Math.round(obj.hold * 100)}%`;
    } else {
      this.el.objHold.style.display = 'none';
    }
  }

  setSpeed(kmh, inCar) {
    this.el.speed.style.display = inCar ? 'block' : 'none';
    this.el.speedValue.textContent = `${Math.round(kmh)}`;
  }

  setHint(text) {
    this.el.hint.textContent = text || '';
    this.el.hint.style.opacity = text ? '1' : '0';
  }

  message(text, ms = 4200) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.textContent = text;
    this.el.messages.appendChild(div);
    while (this.el.messages.children.length > 3) {
      this.el.messages.removeChild(this.el.messages.firstChild);
    }
    setTimeout(() => div.classList.add('fade'), ms - 600);
    setTimeout(() => div.remove(), ms);
  }

  drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = 180;
    const H = 180;
    const span = BOUNDS.maxX - BOUNDS.minX;
    const toMap = (x, z) => [
      ((x - BOUNDS.minX) / span) * W,
      ((z - BOUNDS.minZ) / (BOUNDS.maxZ - BOUNDS.minZ)) * H,
    ];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 18, 26, 0.85)';
    ctx.fillRect(0, 0, W, H);
    // Sea + beach at the bottom.
    const [, seaY] = toMap(0, 210);
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, seaY, W, H - seaY);
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(0, seaY - 4, W, 4);
    // Roads.
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = 3;
    for (const line of ROAD_LINES) {
      const [x] = toMap(line, 0);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      const [, z] = toMap(0, line);
      ctx.beginPath();
      ctx.moveTo(0, z);
      ctx.lineTo(W, z);
      ctx.stroke();
    }
    // Blocks.
    ctx.fillStyle = '#3a4552';
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const [x, z] = toMap(bx - 22, bz - 22);
        ctx.fillRect(x, z, (44 / span) * W, (44 / (BOUNDS.maxZ - BOUNDS.minZ)) * H);
      }
    }
    // Mission target.
    if (state.missionTarget) {
      const [x, z] = toMap(state.missionTarget.x, state.missionTarget.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(x, z - 7);
      ctx.lineTo(x + 6, z);
      ctx.lineTo(x, z + 7);
      ctx.lineTo(x - 6, z);
      ctx.closePath();
      ctx.fill();
    }
    // Police.
    for (const p of state.police) {
      const [x, z] = toMap(p.x, p.z);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(x, z, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, pz] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(state.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  showMenu(kind, data = {}) {
    const m = this.el.menu;
    m.style.display = 'flex';
    this.el.hud.style.display = kind === 'title' ? 'none' : 'flex';
    const buttons = {
      title: [
        ['new', 'New Game'],
        ...(data.hasSave ? [['continue', 'Continue']] : []),
        ['howto', 'How to play'],
      ],
      pause: [
        ['resume', 'Resume'],
        ['save', 'Save game'],
        ['restart', 'Restart story'],
        ['quit', 'Quit to title'],
      ],
      wasted: [['respawn', 'Wake up at the hospital (-$100)']],
      busted: [['respawn', 'Pay the fine and walk free (-$200)']],
      story: [['freeroam', 'Keep exploring Solmar Bay']],
      howto: [['back', 'Back']],
    }[kind];
    const titles = {
      title: 'SOLMAR BAY',
      pause: 'Paused',
      wasted: 'WASTED',
      busted: 'BUSTED',
      story: 'SOLMAR BAY — Story complete',
      howto: 'How to play',
    };
    const bodies = {
      title:
        'A sun-soaked coastal city. You are Dario Venn, fresh out of the joint, ' +
        'and Lena Cross has work for you — three jobs, one vault, and a way out. ' +
        'Steal cars, dodge the Solmar Bay PD, and get paid.',
      pause: 'Take a breath. The city waits.',
      wasted: 'You got yourself killed out there. The hospital patched you up — the bill is on you.',
      busted: 'The Solmar Bay PD caught you. The fine is on you.',
      story:
        `You cracked the vault and walked away with the money. Final take: $${(data.money ?? 0).toLocaleString()}. ` +
        'Lena is proud of you. Solmar Bay is yours now.',
      howto:
        'WASD — walk / drive • Shift — sprint • E — enter / exit a car • Mouse click — punch or shoot • ' +
        'Drag mouse — look around • P or Esc — pause • M — mute • Stealing a car, shooting or hitting ' +
        'people raises your wanted level. Lay low for 25 seconds and the heat fades.',
    };
    this.el.menuTitle.textContent = titles[kind] || kind;
    this.el.menuBody.textContent = bodies[kind] || '';
    this.el.menuButtons.innerHTML = buttons.map(([a, label]) => `<button data-action="${a}">${label}</button>`).join('');
    this.el.menu.dataset.kind = kind;
  }

  hideMenu() {
    this.el.menu.style.display = 'none';
    this.el.hud.style.display = 'flex';
  }
}
