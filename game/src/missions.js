// Solmar Bay — missions and the story.
// Three jobs from Lena Cross. Each mission is a chain of steps; a glowing
// beacon marks the current target and the HUD shows the objective.

import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';

export class MissionDirector {
  constructor(scene, onEvent) {
    this.scene = scene;
    this.onEvent = onEvent;
    this.missionIndex = -1;
    this.stepIndex = 0;
    this.state = 'idle'; // idle | active | story-complete
    this.holdProgress = 0;
    this.target = null;
    this.requiredCarId = null;

    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 44, 24, 1, true), beaconMat);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.4, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffe97a }),
    );
    this.beacon.visible = false;
    this.ring.visible = false;
    this.diamond.visible = false;
    scene.add(this.beacon, this.ring, this.diamond);
    this.animTime = 0;
  }

  currentMission() {
    return this.missionIndex >= 0 ? MISSIONS[this.missionIndex] : null;
  }

  currentStep() {
    const m = this.currentMission();
    return m ? m.steps[this.stepIndex] : null;
  }

  start() {
    this.setMission(0);
  }

  setMission(index) {
    if (index >= MISSIONS.length) {
      this.state = 'story-complete';
      this.hideMarker();
      return;
    }
    this.missionIndex = index;
    this.stepIndex = 0;
    this.state = 'active';
    this.holdProgress = 0;
    const m = MISSIONS[index];
    this.onEvent({ type: 'intro', text: m.intro, title: m.name });
    this.applyStep();
  }

  applyStep() {
    const step = this.currentStep();
    if (!step) return;
    const place = PLACES[step.at];
    this.target = new THREE.Vector3(place.x, 0, place.z);
    this.requiredCarId = null;
    if (this.missionIndex === 0 && this.stepIndex === 1) this.requiredCarId = 'veloce';
    this.beacon.position.set(this.target.x, 22, this.target.z);
    this.ring.position.set(this.target.x, 0.06, this.target.z);
    this.diamond.position.set(this.target.x, 7, this.target.z);
    this.beacon.visible = true;
    this.ring.visible = true;
    this.diamond.visible = true;
    this.onEvent({ type: 'step', text: step.text, title: this.currentMission().name });
  }

  hideMarker() {
    this.beacon.visible = false;
    this.ring.visible = false;
    this.diamond.visible = false;
    this.target = null;
  }

  objective() {
    const m = this.currentMission();
    if (!m || this.state !== 'active') return null;
    const step = this.currentStep();
    return {
      title: `${m.name} — $${m.payout.toLocaleString()}`,
      text: step.text,
      hold: step.kind === 'hold' ? this.holdProgress : null,
    };
  }

  update(dt, player) {
    this.animTime += dt;
    if (this.beacon.visible) {
      this.diamond.position.y = 7 + Math.sin(this.animTime * 2) * 0.6;
      this.diamond.rotation.y += dt * 1.5;
      this.ring.material.opacity = 0.55 + Math.sin(this.animTime * 3) * 0.3;
    }
    if (this.state !== 'active' || !this.target) return;
    const step = this.currentStep();
    const dist = Math.hypot(player.pos.x - this.target.x, player.pos.z - this.target.z);

    if (step.kind === 'hold') {
      if (dist < 9) {
        this.holdProgress += dt / step.holdSeconds;
        if (this.holdProgress >= 1) {
          this.holdProgress = 0;
          this.advance(player);
        }
      } else {
        this.holdProgress = Math.max(0, this.holdProgress - dt / 3);
      }
      return;
    }
    const radius = step.kind === 'deliver' ? 8 : 6;
    if (dist < radius) {
      if (this.requiredCarId && player.carId !== this.requiredCarId) {
        this.onEvent({ type: 'hint', text: 'You need the red Veloce for this delivery.' });
        return;
      }
      this.advance(player);
    }
  }

  advance(player) {
    const m = this.currentMission();
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      this.onEvent({ type: 'complete', title: m.name, payout: m.payout });
      this.setMission(this.missionIndex + 1);
      if (this.state === 'story-complete') {
        this.onEvent({ type: 'story', text: 'The vault money is yours. Solmar Bay is yours now, Dario.' });
      }
    } else {
      this.applyStep();
    }
  }
}
