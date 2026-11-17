// The story: three chained missions in Solmar Bay, all original.
// The mission object owns the current stage and marker; the world asks it
// every step whether the stage is complete and advances it.
import { MISSIONS, PLACES } from './config.js';

export function createMissions() {
  return {
    index: 0, // 0..2, or 3 when the story is complete
    stage: 0,
    grabProgress: 0, // 0..1 while holding E on a 'grab' stage
    packageHeld: false,
    done: false,
    current() {
      return MISSIONS[this.index] ?? null;
    },
    stageDef() {
      const m = this.current();
      return m ? m.stages[this.stage] : null;
    },
    markerPlace() {
      const s = this.stageDef();
      return s ? PLACES[s.place] : null;
    },
    objectiveText() {
      if (this.done) return 'Free roam — Solmar Bay is yours. Cause trouble or take it easy.';
      const m = this.current();
      const s = this.stageDef();
      return `${m.title} — ${s.text}`;
    },
    // Distance from a position to the current marker, in metres.
    markerDistance(pos) {
      const p = this.markerPlace();
      return p ? Math.hypot(pos.x - p.x, pos.z - p.z) : 0;
    },
    reset() {
      this.index = 0;
      this.stage = 0;
      this.grabProgress = 0;
      this.packageHeld = false;
      this.done = false;
    },
  };
}

// Advance the mission machine one step. `ctx` is the world (player, car,
// position, wanted helpers). Returns an event string for the HUD when the
// stage or mission completes: 'stage' | 'mission' | 'story' | null.
export function updateMissions(missions, ctx) {
  if (missions.done) return null;
  const m = missions.current();
  const s = missions.stageDef();
  if (!m || !s) return null;
  const place = PLACES[s.place];
  const pos = ctx.playerPos();
  const dist = Math.hypot(pos.x - place.x, pos.z - place.z);
  const inCar = ctx.playerCar() !== null;

  if (s.kind === 'go') {
    if (dist < 6) {
      missions.stage += 1;
      return 'stage';
    }
    return null;
  }
  if (s.kind === 'deliverCar') {
    if (inCar && dist < 7) {
      missions.index += 1;
      missions.stage = 0;
      return 'mission';
    }
    return null;
  }
  if (s.kind === 'grab') {
    if (dist < 5 && !inCar) {
      if (m.id === 'the-vault-run') {
        // Hold E to grab the cash; the world reports ctx.interactHeld.
        if (ctx.interactHeld()) {
          missions.grabProgress += ctx.dt / 3;
          if (missions.grabProgress >= 1) {
            missions.grabProgress = 0;
            missions.stage += 1;
            ctx.onVaultGrabbed();
            return 'stage';
          }
        } else {
          missions.grabProgress = Math.max(0, missions.grabProgress - ctx.dt / 2);
        }
      } else {
        // The package: walking into the marker picks it up.
        missions.packageHeld = true;
        missions.stage += 1;
        ctx.onPackagePicked();
        return 'stage';
      }
    } else {
      missions.grabProgress = Math.max(0, missions.grabProgress - ctx.dt / 2);
    }
    return null;
  }
  if (s.kind === 'deliver') {
    if (dist < 7) {
      missions.index += 1;
      missions.stage = 0;
      missions.packageHeld = false;
      if (missions.index >= MISSIONS.length) {
        missions.done = true;
        return 'story';
      }
      return 'mission';
    }
    return null;
  }
  return null;
}
