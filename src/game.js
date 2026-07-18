import * as THREE from "three";
import { InputManager } from "./input.js";
import { loadSettings, saveSettings, loadSavedGame, saveGameState } from "./storage.js";

// —— 3D 參孫打獅子(samson3d,真 3D 競技場)——2026-07-19 換皮自 warrior3d(德義武鬥館)。
// 士師記十四章五至六節:參孫獨自一人到亭拿的葡萄園,遇少壯獅子吼叫,耶和華的靈大大感動
// 參孫,他手無器械,卻將獅子撕裂,如同撕裂山羊羔一樣——這事沒有告訴父母。
// ★神學鐵則:得勝在乎耶和華的靈,不是參孫的臂力;勝負文案必回到神。
// ★兒童安全鐵則:不流血;獅子被制伏=側躺不流血;參孫落敗=溫柔跪地,溫柔重試。
// ★判定=畫面(鐵則4):出手當下用「距離+朝向」幾何判定,命中瞬間演出;獅子撲咬攻擊前必先
//   亮紅色預告扇形,預告範圍=實際命中範圍,預告結束那一幀才結算。

// ---------- 可調量值 ----------
export const DIFFICULTY_PRESETS = {
  kids: { maxFwd: 3.8, boost: 2.8, turnRate: 2.5, aiSkill: 0.25, aiCd: 2.3, aiDmg: 0.45, aiSpd: 0.5, assist: 0.5 },
  child: { maxFwd: 4.2, boost: 3.2, turnRate: 2.45, aiSkill: 0.4, aiCd: 1.9, aiDmg: 0.65, aiSpd: 0.58, assist: 0.3 },
  easy: { maxFwd: 4.8, boost: 3.8, turnRate: 2.4, aiSkill: 0.55, aiCd: 1.55, aiDmg: 0.8, aiSpd: 0.68, assist: 0.15 },
  normal: { maxFwd: 5.4, boost: 4.4, turnRate: 2.35, aiSkill: 0.68, aiCd: 1.2, aiDmg: 0.95, aiSpd: 0.82, assist: 0 },
  hard: { maxFwd: 6.0, boost: 4.8, turnRate: 2.3, aiSkill: 0.82, aiCd: 0.95, aiDmg: 1.1, aiSpd: 0.95, assist: 0 },
};

export const DIFFICULTY_LABELS = {
  kids: "幼兒(超簡單)",
  child: "兒童(簡單)",
  easy: "入門",
  normal: "標準",
  hard: "全力獅王",
};

export const GAME_MODES = {
  duel: {
    label: "鬥獅之戰",
    hp: 100,
    description: "赤手空拳,倚靠耶和華的靈,制伏這隻向你吼叫的少壯獅子!",
    goal: "打光獅子血量(各 100)",
  },
  epic: {
    label: "與獅纏鬥",
    hp: 300,
    roundCap: 300,
    description: "雙方血量提高到 300——考驗你能與獅子周旋多久。",
    goal: "血量 300,戰到分出勝負",
  },
  practice: {
    label: "練習場",
    hp: 100,
    passive: true,
    description: "獅子只走位不攻擊——自由練習輕拳、重拳與聖靈金光的手感。",
    goal: "純練手感,不計勝負",
  },
};

export function getModeConfig(modeId) {
  return GAME_MODES[modeId] || GAME_MODES.duel;
}

// ---------- 武器系統只留 fists(赤手空拳,不畫武器 mesh) ----------
// 重拳(K/Space,可蓄力)沿用 fists 這張表;輕拳(J)自成一組更快更輕的量值(見下 LIGHT_PUNCH)。
export const WEAPON_ORDER = ["fists"];
export const WEAPONS = {
  fists: { label: "赤手空拳", short: "拳", reach: 1.5, dmg: 15, cd: 1.05, arc: 1.2, swing: "chop", chargeBonus: 0.6, hint: "手無器械,卻倚靠耶和華的靈" },
};

// 輕拳:快、傷害低、獨立冷卻(不佔重拳的 cd)
const LIGHT_PUNCH = { dmg: 6, cd: 0.42, reach: 1.4, arc: 1.3 };

// 揮擊「接觸瞬間」(秒)——傷害/閃光/慢動作在這一刻才發生
const CONTACT_AT = { chop: 0.22 };

// 蓄力大招(聖靈金光):長按重拳鍵蓄力,放開發出金色光波(士14:6,不血腥)。
const CHARGE_MIN = 0.6;
const CHARGE_FULL = 1.5;
const HOLY_LIGHT_COLOR = 0xffd84a;

// 自動面向敵人:獅子靠近時,參孫沒在手動轉向/衝刺時自動轉身面對(讓位鐵則:W 前進完全不干預)。
const AUTO_FACE_RANGE = 8;

// 格擋(參孫限定,獅子不格擋):按住 C=舉起雙臂防禦——近戰傷害 ×0.3;剛舉起 ≤PARRY_WINDOW
// 秒內被打到=完美盾反(無傷+獅子被彈開硬直)。
const BLOCK_ARC = 1.05;
const PARRY_WINDOW = 0.35;

// ---------- 獅子攻擊量值(beast-boss-kit §4):輕=爪擊、重=撲咬(帶紅色預告) ----------
const LION_CLAW = { reach: 1.3, dmg: 6, cd: 1.3, arc: 1.0, knockback: 0.22 };
const LION_POUNCE = {
  reach: 2.1, dmg: 15, cd: 3.6, arc: 0.85, knockback: 1.0,
  telegraphMin: 0.5, telegraphMax: 0.8, commitDur: 0.22,
};

// ---------- 蜂蜜補血(§1,獨立一段,整段可刪不傷核心) ----------
const HONEY_MIN_T = 12;
const HONEY_MAX_T = 20;
const HONEY_LIFE = 10;
const HONEY_HEAL_PCT = 0.25;
const HONEY_EAT_DIST = 1.2;

// ---------- 獅子配色集中表(日後黑化/死神模式用) ----------
export const LION_COLORS = {
  body: 0xc9863a,
  bodyDark: 0xb06e2c,
  belly: 0xe4c087,
  mane: 0x6b3a1c,
  snout: 0x3a2415,
  nose: 0x241812,
  eye: 0xffffff,
  pupil: 0x1a1208,
  paw: 0xb06e2c,
  tailTuft: 0x4a2a16,
};

// ---------- 比武場常數 ----------
const ARENA_HALF = 15;
const BODY_REACH = 0.55;
const MAX_BACK = 1.9;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

// ---------- 人物關節工具(matches 3d-figure-kit 鐵則:雙節肢體+五指手) ----------
function createLimb({ upperMaterial, lowerMaterial, endMaterial, upperLen, lowerLen, upperRadius, lowerRadius, end = "hand", thumbSide = 1 }) {
  const pivot = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CapsuleGeometry(upperRadius, upperLen, 4, 8), upperMaterial);
  upper.position.y = -upperLen / 2;
  pivot.add(upper);
  const joint = new THREE.Group();
  joint.position.y = -upperLen;
  pivot.add(joint);
  const lower = new THREE.Mesh(new THREE.CapsuleGeometry(lowerRadius, lowerLen, 4, 8), lowerMaterial);
  lower.position.y = -lowerLen / 2;
  joint.add(lower);
  let endMesh;
  if (end === "foot") {
    endMesh = new THREE.Mesh(new THREE.BoxGeometry(lowerRadius * 2.1, lowerRadius, lowerRadius * 3.4), endMaterial);
    endMesh.position.set(0, -lowerLen - lowerRadius * 0.4, lowerRadius * 0.9);
  } else {
    const r = lowerRadius;
    endMesh = new THREE.Group();
    endMesh.position.y = -lowerLen - r * 0.2;
    const palm = new THREE.Mesh(new THREE.BoxGeometry(r * 2.2, r * 1.7, r * 1.0), endMaterial);
    palm.position.y = -r * 0.85;
    endMesh.add(palm);
    for (let i = 0; i < 4; i += 1) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(r * 0.44, r * 1.25, r * 0.55), endMaterial);
      finger.position.set((i - 1.5) * r * 0.54, -r * 2.1, 0);
      finger.rotation.x = 0.14;
      endMesh.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, r * 1.0, r * 0.55), endMaterial);
    thumb.position.set(thumbSide * r * 1.3, -r * 0.95, r * 0.1);
    thumb.rotation.z = thumbSide * -0.55;
    endMesh.add(thumb);
  }
  joint.add(endMesh);
  return { pivot, upper, joint, lower, end: endMesh };
}

// ---------- 參孫(赤膊+腰布+七綹長髮辮) ----------
const SAMSON_SKIN = 0xd9a066;
const SAMSON_CLOTH = 0xa9793f;
const SAMSON_HAIR = 0x2b1810;

function makePerson({ shirt = SAMSON_SKIN, pants = SAMSON_CLOTH, skin = SAMSON_SKIN, hair = SAMSON_HAIR, gender = "m", scale = 1 } = {}) {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.72 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.78, emissive: 0x8a7355, emissiveIntensity: 0.5 });

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.76, 0.32), shirtMat);
  chest.position.y = 1.42;
  rig.add(chest);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.2, 12), skinMat);
  neck.position.y = 1.88;
  rig.add(neck);
  const waist = new THREE.Group();
  waist.position.y = 1.16;
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.3, 0.27), shirtMat);
  belly.position.y = -0.05;
  waist.add(belly);
  const hip = new THREE.Mesh(
    gender === "f" ? new THREE.BoxGeometry(0.48, 0.22, 0.3) : new THREE.BoxGeometry(0.44, 0.24, 0.29),
    pantsMat,
  );
  hip.position.y = -0.26;
  waist.add(hip);
  const beltLine = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 0.3), new THREE.MeshStandardMaterial({ color: 0x6b4a26, roughness: 0.7 }));
  beltLine.position.y = -0.13;
  waist.add(beltLine);
  rig.add(waist);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 18), skinMat);
  head.position.y = 2.12;
  rig.add(head);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), skinMat);
  earL.scale.set(0.45, 1, 0.8);
  earL.position.set(-0.245, 2.11, 0);
  rig.add(earL);
  const earR = earL.clone();
  earR.position.x = 0.245;
  rig.add(earR);

  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 });
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), hairMat);
  hairCap.position.y = 2.13;
  hairCap.rotation.x = -0.22;
  rig.add(hairCap);
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 16, 8, Math.PI, Math.PI, Math.PI * 0.35, Math.PI * 0.2),
    hairMat,
  );
  hairBack.position.y = 2.12;
  rig.add(hairBack);

  // 七綹長髮辮(頭後,士師記十六章的招牌細節——本作亦落地)
  for (let i = 0; i < 7; i += 1) {
    const t = (i - 3) / 3; // -1..1
    const len = 0.4 - Math.abs(t) * 0.08;
    const braid = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, len, 4, 6), hairMat);
    braid.position.set(t * 0.1, 1.9 - Math.abs(t) * 0.06, -0.23);
    braid.rotation.x = 0.4 + Math.abs(t) * 0.15;
    braid.rotation.z = t * 0.12;
    rig.add(braid);
  }

  const faceDark = new THREE.MeshBasicMaterial({ color: 0x25201a });
  const faceWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), faceWhite);
  eyeL.position.set(-0.09, 2.18, 0.21);
  rig.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.09;
  rig.add(eyeR);
  const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), faceDark);
  pupilL.position.set(-0.09, 2.18, 0.25);
  rig.add(pupilL);
  const pupilR = pupilL.clone();
  pupilR.position.x = 0.09;
  rig.add(pupilR);
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), faceDark);
  browL.position.set(-0.09, 2.26, 0.22);
  browL.rotation.z = 0.16;
  rig.add(browL);
  const browR = browL.clone();
  browR.position.x = 0.09;
  browR.rotation.z = -0.16;
  rig.add(browR);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 14, Math.PI), faceDark);
  smile.position.set(0, 2.04, 0.21);
  smile.rotation.z = Math.PI;
  rig.add(smile);

  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xb08a52, roughness: 0.85 }); // 涼鞋(赤足感)
  const mkArm = (x) => {
    const arm = createLimb({
      upperMaterial: skinMat, lowerMaterial: skinMat, endMaterial: skinMat,
      upperLen: 0.27, lowerLen: 0.26, upperRadius: 0.075, lowerRadius: 0.06,
      end: "hand", thumbSide: x < 0 ? 1 : -1,
    });
    arm.pivot.position.set(x, 1.72, 0);
    arm.joint.rotation.x = -0.18;
    rig.add(arm.pivot);
    return arm;
  };
  const leftArm = mkArm(-0.4);
  const rightArm = mkArm(0.4);
  const mkLeg = (x) => {
    const leg = createLimb({
      upperMaterial: skinMat, lowerMaterial: skinMat, endMaterial: shoeMat,
      upperLen: 0.40, lowerLen: 0.38, upperRadius: 0.09, lowerRadius: 0.072,
      end: "foot",
    });
    leg.pivot.position.set(x, 1.0, 0);
    leg.pivot.rotation.x = -0.05;
    leg.joint.rotation.x = 0.1;
    rig.add(leg.pivot);
    return leg;
  };
  const leftLeg = mkLeg(-0.15);
  const rightLeg = mkLeg(0.15);

  group.scale.setScalar(scale);
  return { group, rig, head, waist, leftArm, rightArm, leftLeg, rightLeg, shirtMat, pantsMat, smile };
}

function makeSamsonFigure() {
  return makePerson({ shirt: SAMSON_SKIN, pants: SAMSON_CLOTH, skin: SAMSON_SKIN, hair: SAMSON_HAIR, gender: "m", scale: 1 });
}

// ---------- 少壯獅子(四足,beast-boss-kit §4):Box 軀幹水平,四腿在軀幹下方四角,頭前端+鬃毛環+尾巴 ----------
function makeLionLeg(x, z, legMat, pawMat) {
  const pivot = new THREE.Group();
  pivot.position.set(x, 0.62, z);
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.26, 4, 8), legMat);
  thigh.position.y = -0.15;
  pivot.add(thigh);
  const joint = new THREE.Group();
  joint.position.y = -0.3;
  pivot.add(joint);
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), legMat);
  shin.position.y = -0.13;
  joint.add(shin);
  const paw = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.22), pawMat);
  paw.position.set(0, -0.26, 0.04);
  joint.add(paw);
  return { pivot, joint };
}

function makeLion(colors = LION_COLORS) {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const bodyMat = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.85 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: colors.belly, roughness: 0.85 });
  const maneMat = new THREE.MeshStandardMaterial({ color: colors.mane, roughness: 0.95 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: colors.snout, roughness: 0.8 });
  const pawMat = new THREE.MeshStandardMaterial({ color: colors.paw, roughness: 0.85 });
  const noseMat = new THREE.MeshBasicMaterial({ color: colors.nose });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: colors.eye });
  const pupilMat = new THREE.MeshBasicMaterial({ color: colors.pupil });
  const tuftMat = new THREE.MeshStandardMaterial({ color: colors.tailTuft, roughness: 0.9 });

  // 軀幹(水平箱體,+z=前)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.15), bodyMat);
  body.position.set(0, 0.62, 0);
  rig.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 1.0), bellyMat);
  belly.position.set(0, 0.4, 0);
  rig.add(belly);

  // 頭(前端)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.4), bodyMat);
  head.position.set(0, 0.8, 0.72);
  rig.add(head);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.24), snoutMat);
  snout.position.set(0, 0.72, 0.95);
  rig.add(snout);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), noseMat);
  nose.position.set(0, 0.78, 1.07);
  rig.add(nose);

  // 眼睛(臉部鐵則:白+瞳)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeWhiteMat);
    eye.position.set(sx * 0.13, 0.86, 0.9);
    rig.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), pupilMat);
    pupil.position.set(sx * 0.13, 0.86, 0.93);
    rig.add(pupil);
  }
  // 耳朵
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 8), bodyMat);
    ear.position.set(sx * 0.16, 1.02, 0.62);
    ear.rotation.x = -0.3;
    rig.add(ear);
  }
  // 鬃毛環
  const mane = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.16, 10, 16), maneMat);
  mane.position.set(0, 0.78, 0.5);
  rig.add(mane);
  const maneTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), maneMat);
  maneTop.position.set(0, 0.92, 0.55);
  rig.add(maneTop);

  // 四腿(軀幹下方四角)
  const legs = {
    fl: makeLionLeg(-0.2, 0.42, bodyMat, pawMat),
    fr: makeLionLeg(0.2, 0.42, bodyMat, pawMat),
    bl: makeLionLeg(-0.2, -0.42, bodyMat, pawMat),
    br: makeLionLeg(0.2, -0.42, bodyMat, pawMat),
  };
  for (const leg of Object.values(legs)) rig.add(leg.pivot);

  // 尾巴(後端)+毛簇
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.7, -0.58);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.55, 4, 8), bodyMat);
  tail.rotation.x = Math.PI / 2 + 0.35;
  tail.position.set(0, 0.05, -0.28);
  tailPivot.add(tail);
  const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), tuftMat);
  tuft.position.set(0, -0.05, -0.58);
  tailPivot.add(tuft);
  rig.add(tailPivot);

  // 撲咬紅色預告扇形(telegraph;子物件於 fighter group 上,只設 rotation.x——避免 Euler 疊加雷區)
  const telegraph = new THREE.Mesh(
    new THREE.CircleGeometry(LION_POUNCE.reach + BODY_REACH, 24, -Math.PI / 2 - LION_POUNCE.arc, LION_POUNCE.arc * 2),
    new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  telegraph.rotation.x = -Math.PI / 2;
  telegraph.position.y = -0.6; // 相對於 rig(rig.y 基準在腳掌之上),貼地
  telegraph.visible = false;
  rig.add(telegraph);

  return { group, rig, head, legs, tailPivot, telegraph, bodyMat, maneMat };
}

// ---------- 主遊戲類別 ----------
export class WarriorGame {
  constructor({ canvas, touchRoot }) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;

    const settings = loadSettings();
    this.difficulty = DIFFICULTY_PRESETS[settings.difficulty] ? settings.difficulty : "normal";
    this.modeId = GAME_MODES[settings.modeId] ? settings.modeId : "duel";
    this.mode = getModeConfig(this.modeId);
    this.weaponId = "fists";
    this.characterId = "default";

    this.input = new InputManager();
    this.input.bindTouchButtons(this.touchRoot);

    this.onHudUpdate = null;
    this.onEvent = null;

    this.running = false;
    this.time = 0;
    this.phase = "menu"; // menu | gate | battle | ended
    this.message = "在首頁選擇模式與難度後開始。";
    this.cameraView = 0;
    this.autoSaveTimer = 0;

    this.roundNo = 0;
    this.lastHit = null;
    this.projectiles = []; // 聖靈金光波動
    this._pendingStrikes = [];
    this.hitCamT = 9;
    this.endT = -1;

    this.honey = null;
    this.honeyTimer = HONEY_MIN_T + Math.random() * (HONEY_MAX_T - HONEY_MIN_T);

    this.overlay = { visible: false, eyebrow: "", title: "", text: "", canResume: false };

    // ---- three ----
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fc4e8);
    this.scene.fog = new THREE.Fog(0xbfd8ec, 55, 150);

    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 220);
    this.camPos = new THREE.Vector3(3, 3.5, -16);
    this.camLook = new THREE.Vector3(0, 1.2, 0);
    this.camera.position.copy(this.camPos);

    this.clock = new THREE.Clock();

    this.setupScene();
    this.setupInput();

    window.addEventListener("resize", () => this.resize());
    this.resize();
    this.pushHud();
  }

  emitEvent(type, payload = {}) {
    if (this.onEvent) this.onEvent({ type, ...payload });
  }

  // ---------- 場景:亭拿葡萄園白日(葡萄藤架成排+遠山+暖天光),獨自一人、無觀眾席 ----------
  setupScene() {
    const sun = new THREE.HemisphereLight(0xfff6de, 0x6a7a3a, 1.35);
    this.scene.add(sun);
    const key = new THREE.DirectionalLight(0xfff0cf, 2.1);
    key.position.set(30, 50, -18);
    this.scene.add(key);
    this.keyLight = key;
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.45);
    rim.position.set(-25, 30, 25);
    this.scene.add(rim);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x8a9a4a, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    this.scene.add(grass);
    // 開放式草地(葡萄園中的空地——參孫遇獅之處,不設任何阻擋)
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_HALF * 2 + 6, ARENA_HALF * 2 + 6), new THREE.MeshStandardMaterial({ color: 0xc9a66b, roughness: 1 }));
    soil.rotation.x = -Math.PI / 2;
    this.scene.add(soil);

    this.buildVineyard();
    this._buildFighters();

    // 擊中閃光
    this.hitFlash = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    this.scene.add(this.hitFlash);
    this.hitFlashT = 9;

    // 天氣系統可留(晴日為主,日夜仍緩慢流動;此作預設晴日暖光)
    this.buildWeather();

    this.resetFighters();
  }

  // 亭拿葡萄園:葡萄藤架成排(棚架+藤葉+葡萄串)+遠山背景
  buildVineyard() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6d4a26, roughness: 0.85 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 0.6, metalness: 0.3 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x5a8a34, roughness: 0.9 });
    const grapeMat = new THREE.MeshStandardMaterial({ color: 0x5a3a78, roughness: 0.5, emissive: 0x2a1640, emissiveIntensity: 0.2 });
    const F = ARENA_HALF + 2;
    const rowZ = [-F - 4, -F - 8, F + 4, F + 8];
    for (const z of rowZ) {
      for (let x = -F - 2; x <= F + 2; x += 4) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.7, 8), postMat);
        post.position.set(x, 0.85, z);
        this.scene.add(post);
      }
      const wire = new THREE.Mesh(new THREE.BoxGeometry((F + 2) * 2, 0.03, 0.03), wireMat);
      wire.position.set(0, 1.55, z);
      this.scene.add(wire);
      for (let x = -F - 2; x <= F + 2; x += 2.2) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.18, 8, 6), leafMat);
        leaf.position.set(x + (Math.random() - 0.5), 1.3 + Math.random() * 0.25, z + (Math.random() - 0.5) * 0.6);
        leaf.scale.y = 0.6;
        this.scene.add(leaf);
        if (Math.random() < 0.6) {
          const grape = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), grapeMat);
          grape.position.set(leaf.position.x, leaf.position.y - 0.34, leaf.position.z);
          this.scene.add(grape);
        }
      }
    }
    // 遠山
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x9a9068, roughness: 1 });
    const mtnMat2 = new THREE.MeshStandardMaterial({ color: 0x7f8a5e, roughness: 1 });
    const mtnSpecs = [
      [-70, -95, 26, 40, mtnMat], [40, -115, 34, 52, mtnMat2], [95, -60, 22, 34, mtnMat],
      [-95, 70, 30, 44, mtnMat2], [60, 105, 24, 36, mtnMat], [0, -130, 40, 58, mtnMat2],
    ];
    for (const [x, z, r, h, mat] of mtnSpecs) {
      const mtn = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mat);
      mtn.position.set(x, h / 2 - 2, z);
      this.scene.add(mtn);
    }
  }

  // 建(或重建)參孫與獅子
  _buildFighters() {
    const brain = this.foe ? this.foe.brain : { retreatT: 0, orbitDir: 1 };
    if (this.my) this.scene.remove(this.my.person.group);
    if (this.foe) this.scene.remove(this.foe.person.group);
    this.my = this.makeSamsonFighter();
    this.foe = this.makeLionFighter();
    this.foe.brain = brain;
  }

  makeSamsonFighter() {
    const person = makeSamsonFigure();
    this.scene.add(person.group);
    const chargeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.82, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    chargeRing.rotation.x = -Math.PI / 2;
    chargeRing.position.y = 0.05;
    person.group.add(chargeRing);
    return {
      person, chargeRing,
      pos: new THREE.Vector3(), heading: 0, speed: 0,
      hp: 100, cd: 0, lightCd: 0, chargeT: -1, strikeKind: null,
      blocking: false, blockT: 9,
      strikeT: 9, hitT: 9, stunT: 9, koT: -1, walkT: 0,
    };
  }

  makeLionFighter() {
    const lion = makeLion(LION_COLORS);
    this.scene.add(lion.group);
    return {
      person: lion,
      pos: new THREE.Vector3(), heading: 0, speed: 0,
      hp: 100, cd: 0, lightCd: 0, pounce: null,
      strikeT: 9, hitT: 9, stunT: 9, koT: -1, walkT: 0,
      chargeT: -1, blocking: false, blockT: 9,
    };
  }

  resetFighters() {
    const hp = this.mode.hp || 100;
    for (const [f, z, heading] of [[this.my, -7, 0], [this.foe, 7, Math.PI]]) {
      f.pos.set(0, 0, z);
      f.heading = heading;
      f.speed = 0;
      f.hp = hp;
      f.cd = 0;
      f.lightCd = 0;
      f.strikeT = 9;
      f.hitT = 9;
      f.stunT = 9;
      f.koT = -1;
      f.chargeT = -1;
      f.blocking = false;
      f.blockT = 9;
      f.pounce = null;
      f.person.group.rotation.z = 0;
      f.person.group.position.y = 0;
      f.person.rig.rotation.set(0, 0, 0);
    }
    if (this.foe.person.telegraph) {
      this.foe.person.telegraph.visible = false;
      this.foe.person.telegraph.material.opacity = 0;
    }
    this.roundNo = 0;
    this.lastHit = null;
    this.endT = -1;
    this.hitCamT = 9;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    this._pendingStrikes = [];
    if (this.honey) { this.scene.remove(this.honey.group); this.honey = null; }
    this.honeyTimer = HONEY_MIN_T + Math.random() * (HONEY_MAX_T - HONEY_MIN_T);
    if (this.foe.brain) {
      this.foe.brain.retreatT = 0;
      this.foe.brain.orbitDir = Math.random() < 0.5 ? -1 : 1;
      this.foe.brain.breatherT = 4 + Math.random() * 4;
      this.foe.brain.restT = 0;
      this.foe.brain.pounceT = 3 + Math.random() * 3;
    }
    this.syncFighterTransforms();
    const fwd = new THREE.Vector3(Math.sin(this.my.heading), 0, Math.cos(this.my.heading));
    this.camPos.copy(this.my.pos).addScaledVector(fwd, -5.5).setY(3.0);
    this.camLook.copy(this.my.pos).addScaledVector(fwd, 8).setY(1.3);
  }

  syncFighterTransforms() {
    for (const f of [this.my, this.foe]) {
      f.person.group.position.x = f.pos.x;
      f.person.group.position.z = f.pos.z;
      f.person.group.rotation.y = f.heading;
    }
  }

  // ---------- 局面控制 ----------
  applyPresentation({ difficulty, modeId }) {
    if (difficulty && DIFFICULTY_PRESETS[difficulty]) this.difficulty = difficulty;
    if (modeId && GAME_MODES[modeId]) {
      this.modeId = modeId;
      this.mode = getModeConfig(modeId);
    }
    saveSettings({ difficulty: this.difficulty, modeId: this.modeId });
    this.message = `${this.mode.label} · ${DIFFICULTY_LABELS[this.difficulty]} 已設定。`;
    this.pushHud();
  }

  openHomeMenu() {
    this.phase = "menu";
    this.overlay.visible = false;
    this.message = "在首頁選擇模式與難度後開始。";
    this.pushHud();
  }

  startSelectedMatch() {
    this.resetFighters();
    this.phase = "gate";
    this.message = "點畫面(或空白鍵/K)開戰!WASD 走位、J 輕拳、K 重拳(可蓄力放聖靈金光)。";
    this.emitEvent("match-start", { mode: this.mode.label });
    this.pushHud();
  }

  strike() {
    if (this.overlay.visible) return;
    if (this.phase === "gate") {
      this.phase = "battle";
      this.emitEvent("battle-start", {});
      this.message = "開戰!倚靠耶和華的靈,迎向獅子!";
      this.pushHud();
    }
  }

  // ---------- 輸入 ----------
  setupInput() {
    this.canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this._heavyPress();
    });
    window.addEventListener("pointerup", () => this._heavyRelease());
    window.addEventListener("pointercancel", () => this._heavyRelease());
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  // 按下重拳鍵:開戰/開始蓄力(短按放開=普通重拳,長按=聖靈金光)
  _heavyPress() {
    if (this.overlay.visible) return;
    if (this.phase === "gate") {
      this.strike();
      return;
    }
    if (this.phase !== "battle" || this.my.koT >= 0 || this.endT >= 0) return;
    if (this.my.blocking) return;
    if (this.my.cd > 0 || this.my.stunT < this._stunDur()) return;
    if (this.my.chargeT < 0) this.my.chargeT = 0;
  }

  // 放開重拳鍵:蓄滿=聖靈金光,沒蓄滿=普通重拳
  _heavyRelease() {
    if (this.my.chargeT < 0) return;
    const c = this.my.chargeT;
    this.my.chargeT = -1;
    if (this.phase !== "battle" || this.my.koT >= 0) return;
    if (c >= CHARGE_MIN) {
      this.superAttack(this.my, this.foe, clamp((c - CHARGE_MIN) / (CHARGE_FULL - CHARGE_MIN), 0, 1));
    } else {
      this.attack(this.my, this.foe);
    }
  }

  // ---------- 輕拳(J):快、傷害低、獨立冷卻,不蓄力 ----------
  lightPunch() {
    if (this.overlay.visible || this.phase !== "battle" || this.endT >= 0) return;
    const f = this.my;
    if (f.koT >= 0 || f.blocking || f.chargeT >= 0) return;
    if (f.lightCd > 0 || f.stunT < this._stunDur()) return;
    const target = this.foe;
    if (target.koT >= 0) return;
    f.lightCd = LIGHT_PUNCH.cd;
    f.strikeT = 0;
    f.strikeKind = "light";
    this.roundNo += 1;
    const dist = f.pos.distanceTo(target.pos);
    if (dist <= LIGHT_PUNCH.reach + BODY_REACH + 1.0) {
      f.heading = Math.atan2(target.pos.x - f.pos.x, target.pos.z - f.pos.z);
    }
    const toTarget = Math.atan2(target.pos.x - f.pos.x, target.pos.z - f.pos.z);
    const facing = Math.abs(wrapAngle(toTarget - f.heading)) <= LIGHT_PUNCH.arc;
    const lands = dist <= LIGHT_PUNCH.reach + BODY_REACH && facing;
    if (lands) {
      this._pendingStrikes.push({
        target,
        dmg: LIGHT_PUNCH.dmg,
        opts: { who: "me", weapon: { label: "輕拳", short: "輕拳" }, stun: 0, attacker: f, kind: "melee", knockback: 0.1 },
        t: 0.12,
      });
    } else {
      this.emitEvent("miss", { who: "me" });
      this.message = dist > LIGHT_PUNCH.reach + BODY_REACH ? "太遠了——再靠近一步出拳!" : "沒對準——轉身面向獅子!";
      this.pushHud();
    }
  }

  // ---------- 重拳(K,普通釋放):慢、傷害高、命中擊退 ----------
  attack(fighter, target) {
    if (this.phase !== "battle" || this.endT >= 0) return;
    if (fighter.cd > 0 || fighter.stunT < this._stunDur() || fighter.koT >= 0) return;
    const w = WEAPONS.fists;
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const isPlayer = fighter === this.my;
    fighter.cd = w.cd * (isPlayer ? 1 : preset.aiCd);
    fighter.strikeT = 0;
    if (isPlayer) fighter.strikeKind = "heavy";
    this.roundNo += 1;

    if (isPlayer) {
      const snapDist = fighter.pos.distanceTo(target.pos);
      if (snapDist <= w.reach + BODY_REACH + 1.0) {
        fighter.heading = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
      }
    }

    const dist = fighter.pos.distanceTo(target.pos);
    const assist = isPlayer ? preset.assist : 0;
    const reach = w.reach + BODY_REACH + assist * 0.6;
    const toTarget = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
    const facing = Math.abs(wrapAngle(toTarget - fighter.heading)) <= w.arc + assist * 0.5;
    let lands = dist <= reach && facing;
    if (lands && !isPlayer && Math.random() > clamp(preset.aiSkill + 0.18, 0, 0.95)) lands = false;
    if (lands) {
      let dmg = w.dmg;
      if (w.chargeBonus) dmg *= 1 + w.chargeBonus * clamp(Math.abs(fighter.speed) / preset.maxFwd, 0, 1);
      dmg *= isPlayer ? 1 + assist * 0.6 : preset.aiDmg;
      this._pendingStrikes.push({
        target,
        dmg: Math.round(dmg),
        opts: { who: isPlayer ? "me" : "ai", weapon: { label: "重拳", short: "重拳" }, stun: 0, attacker: fighter, kind: "melee", knockback: 0.65 },
        t: CONTACT_AT[w.swing] || 0.2,
      });
    } else {
      this.emitEvent("miss", { who: isPlayer ? "me" : "ai" });
      if (isPlayer) {
        this.message = dist > reach ? "太遠了——再靠近一步出手!" : "沒對準——轉身面向獅子再出手!";
        this.pushHud();
      }
    }
  }

  _stunDur() {
    return 1.1;
  }

  // ---------- 蓄力大招:聖靈金光(士14:6,大傷害、不血腥) ----------
  superAttack(fighter, target, charge01) {
    if (this.phase !== "battle" || this.endT >= 0 || fighter.koT >= 0) return;
    const w = WEAPONS.fists;
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const isPlayer = fighter === this.my;
    fighter.cd = w.cd * 2.2 * (isPlayer ? 1 : preset.aiCd);
    fighter.strikeT = 0;
    if (isPlayer) fighter.strikeKind = "holy";
    this.roundNo += 1;
    if (isPlayer && fighter.pos.distanceTo(target.pos) <= 22) {
      fighter.heading = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
    }
    let dmg = w.dmg * (1.4 + 1.1 * charge01);
    dmg *= isPlayer ? 1 + preset.assist * 0.6 : preset.aiDmg;
    this._fireHolyWave(fighter, target, Math.round(dmg));
    this.emitEvent("super", { who: isPlayer ? "me" : "ai" });
    this.message = isPlayer
      ? "聖靈的能力臨到——金光大作!"
      : "獅子撲勢驚人——快閃開!";
    this.pushHud();
  }

  _fireHolyWave(fighter, target, dmg) {
    const wave = new THREE.Group();
    const arcMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.15, 10, 26, Math.PI * 0.95),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 }),
    );
    arcMesh.rotation.z = Math.PI * 0.03;
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.36, 10, 26, Math.PI * 0.95),
      new THREE.MeshBasicMaterial({ color: HOLY_LIGHT_COLOR, transparent: true, opacity: 0.6 }),
    );
    glow.rotation.z = Math.PI * 0.03;
    wave.add(arcMesh);
    wave.add(glow);
    const light = new THREE.PointLight(HOLY_LIGHT_COLOR, 1.5, 5);
    wave.add(light);
    const fwd = new THREE.Vector3(Math.sin(fighter.heading), 0, Math.cos(fighter.heading));
    wave.position.copy(fighter.pos).setY(1.4).addScaledVector(fwd, 1.0);
    wave.rotation.y = fighter.heading;
    this.scene.add(wave);
    this.projectiles.push({
      mesh: wave, vel: fwd.multiplyScalar(13), t: 0,
      dmg, stun: 0,
      target,
      who: fighter === this.my ? "me" : "ai",
      weapon: { label: "聖靈金光", short: "金光" },
      isWave: true, hitR: 1.6, life: 1.3,
    });
  }

  // ---------- 格擋判定(參孫限定;獅子從不格擋) ----------
  _blockCheck(target, src, kind) {
    if (!target.blocking || !src) return null;
    const ang = Math.abs(wrapAngle(Math.atan2(src.x - target.pos.x, src.z - target.pos.z) - target.heading));
    if (ang > BLOCK_ARC) return null;
    if (kind === "melee" && target.blockT <= PARRY_WINDOW) return "parry";
    return "block";
  }

  applyHit(target, dmg, { who, weapon, stun, attacker, from, kind, knockback }) {
    if (this.phase !== "battle" || target.koT >= 0 || this.endT >= 0) return;
    const src = from || (attacker ? attacker.pos : null);
    const block = this._blockCheck(target, src, kind);
    if (block) {
      this.hitFlash.position.copy(target.pos).setY(1.5);
      this.hitFlash.material.color.setHex(0xffffff);
      this.hitFlashT = 0;
      if (block === "parry") {
        this.hitCamT = 0;
        if (attacker) {
          attacker.stunT = 0;
          attacker.cd = Math.max(attacker.cd, 1.2);
          attacker.speed *= -0.25;
          attacker.chargeT = -1;
        }
        this.emitEvent("parry", { who: target === this.my ? "me" : "ai" });
        this.message = "完美格擋!獅子被震退!";
        this.pushHud();
        return;
      }
      const reduced = Math.round(dmg * 0.3);
      this.emitEvent("block", { who: target === this.my ? "me" : "ai" });
      if (reduced <= 0) {
        this.message = "舉臂格擋——擋下來了!";
        this.pushHud();
        return;
      }
      target.hp = Math.max(0, target.hp - reduced);
      this.lastHit = { who, dmg: reduced, weapon: weapon.short };
      this.emitEvent("hit", { who, dmg: reduced, weapon: weapon.label, stun: false, myHp: this.my.hp, aiHp: this.foe.hp, round: this.roundNo });
      this.message = `舉臂擋下大半——只受 -${reduced}`;
      if (target.hp <= 0) {
        target.koT = 0;
        this.endT = 0;
        this.emitEvent("ko", { winner: who === "me" ? "me" : "ai" });
      }
      this.pushHud();
      return;
    }
    target.hp = Math.max(0, target.hp - dmg);
    target.hitT = 0;
    if (stun) target.stunT = 0;
    target.chargeT = -1;
    target.speed *= 0.4;
    if (knockback && attacker) {
      const dir = target.pos.clone().sub(attacker.pos).setY(0);
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        target.pos.addScaledVector(dir, knockback);
        target.pos.x = clamp(target.pos.x, -ARENA_HALF, ARENA_HALF);
        target.pos.z = clamp(target.pos.z, -ARENA_HALF, ARENA_HALF);
      }
    }
    this.hitFlash.position.copy(target.pos).setY(1.5);
    this.hitFlash.material.color.setHex(stun ? 0x6dff7a : 0xffe14d);
    this.hitFlashT = 0;
    this.hitCamT = 0;
    const isMe = who === "me";
    this.lastHit = { who, dmg, weapon: weapon.short };
    this.emitEvent("hit", {
      who, dmg, weapon: weapon.label, stun: !!stun,
      myHp: this.my.hp, aiHp: this.foe.hp, round: this.roundNo,
    });
    this.message = isMe
      ? `${weapon.label}命中!獅子 -${dmg}`
      : `被獅子的${weapon.label}擊中 -${dmg}——拉開距離再反擊!`;
    if (target.hp <= 0) {
      target.koT = 0;
      this.endT = 0;
      this.emitEvent("ko", { winner: isMe ? "me" : "ai" });
    }
    this.pushHud();
  }

  finishMatch() {
    this.phase = "ended";
    const win = this.foe.hp <= 0 && this.my.hp > 0;
    const draw = this.my.hp === this.foe.hp;
    const byRounds = this.mode.roundCap && this.roundNo >= this.mode.roundCap && this.my.hp > 0 && this.foe.hp > 0;
    const rWin = byRounds ? this.my.hp > this.foe.hp : win;
    this.overlay = {
      visible: true,
      eyebrow: rWin ? "得勝!" : draw ? "勢均力敵" : "溫柔的提醒",
      title: byRounds ? `戰滿三百回合 ${this.my.hp}:${this.foe.hp}` : rWin ? "耶和華的靈大大感動參孫!" : "再試一次",
      text: rWin
        ? "手無器械,卻勝過吼叫的獅子!🦁\n士師記十四章六節:「耶和華的靈大大感動參孫,他雖然手無器械,卻將獅子撕裂,如同撕裂山羊羔一樣。」"
        : draw
          ? "勢均力敵!再與獅子周旋一次!"
          : "再試一次——能力不在乎自己,在乎耶和華的靈。",
      canResume: false,
    };
    this.emitEvent("match-end", { win: rWin, draw, myHp: this.my.hp, aiHp: this.foe.hp, rounds: this.roundNo });
    this.message = `比武結束——大戰 ${this.roundNo} 回合。`;
    this.saveGame(true);
    this.pushHud();
  }

  togglePause() {
    if (this.phase === "menu" || this.phase === "ended") return;
    if (this.overlay.visible) {
      this.resume();
    } else {
      this.overlay = { visible: true, eyebrow: "暫停中", title: "喘口氣", text: "調整呼吸,準備好再上場。", canResume: true };
      this.pushHud();
    }
  }

  resume() {
    if (!this.overlay.canResume) return;
    this.overlay.visible = false;
    this.pushHud();
  }

  cycleCameraView() {
    this.cameraView = (this.cameraView + 1) % 4;
    const names = ["跟隨視角", "側面轉播", "高空俯瞰", "第一人稱"];
    this.message = `視角:${names[this.cameraView]}。`;
    this.pushHud();
  }

  // ---------- 主迴圈 ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const tick = () => {
      if (!this.running) return;
      const delta = Math.min(this.clock.getDelta(), 0.05);
      this.update(delta);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height || 1.6;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  buildWeather() {
    const AUR = [
      { r: 70, y: 36, h: 22, a0: -Math.PI, a1: Math.PI, phase: 0, speed: 0.5 },
      { r: 88, y: 48, h: 28, a0: -Math.PI * 0.9, a1: Math.PI * 0.35, phase: 2.1, speed: 0.38 },
      { r: 58, y: 28, h: 17, a0: -Math.PI * 0.1, a1: Math.PI * 0.95, phase: 4.2, speed: 0.66 },
    ];
    const SEGS = 64;
    this.aurora = { group: new THREE.Group(), curtains: [] };
    for (const cfg of AUR) {
      const pos = new Float32Array((SEGS + 1) * 2 * 3);
      const col = new Float32Array((SEGS + 1) * 2 * 3);
      const idx = [];
      for (let i = 0; i <= SEGS; i += 1) {
        const a = cfg.a0 + (cfg.a1 - cfg.a0) * (i / SEGS);
        const x = Math.cos(a) * cfg.r;
        const z = Math.sin(a) * cfg.r;
        pos[(i * 2) * 3] = x; pos[(i * 2) * 3 + 1] = cfg.y; pos[(i * 2) * 3 + 2] = z;
        col[(i * 2) * 3] = 0.15; col[(i * 2) * 3 + 1] = 0.85; col[(i * 2) * 3 + 2] = 0.45;
        pos[(i * 2 + 1) * 3] = x; pos[(i * 2 + 1) * 3 + 1] = cfg.y + cfg.h; pos[(i * 2 + 1) * 3 + 2] = z;
        col[(i * 2 + 1) * 3] = 0.09; col[(i * 2 + 1) * 3 + 1] = 0.02; col[(i * 2 + 1) * 3 + 2] = 0.16;
        if (i < SEGS) { const b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      this.aurora.group.add(mesh);
      this.aurora.curtains.push({ mesh, base: pos.slice(), phase: cfg.phase, speed: cfg.speed });
    }
    this.aurora.group.visible = false;
    this.scene.add(this.aurora.group);
    const N = 420;
    const spos = new Float32Array(N * 3);
    for (let i = 0; i < N; i += 1) {
      spos[i * 3] = (Math.random() - 0.5) * 60;
      spos[i * 3 + 1] = Math.random() * 20;
      spos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute("position", new THREE.BufferAttribute(spos, 3));
    this.snowFx = {
      pts: new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.7, depthWrite: false, fog: false })),
      speeds: Float32Array.from({ length: N }, () => 3 + Math.random() * 3),
    };
    this.scene.add(this.snowFx.pts);
    this.blizzardWarned = false;
  }

  // 天氣系統保留但預設晴日:一天=50 秒,以正午(12 時暖光)為起點慢慢流動
  dayHours() {
    return (12 + this.time * (24 / 50)) % 24;
  }

  updateWeather(delta) {
    const KEYS = [
      [0, 0x0a2050, 0.35], [5, 0x0a2050, 0.35], [6.5, 0xf0955f, 1.1],
      [9, 0x8fc4e8, 2.1], [16, 0x8fc4e8, 2.1], [18.5, 0xf0854f, 1.0],
      [20, 0x0a2050, 0.35], [24, 0x0a2050, 0.35],
    ];
    const h = this.dayHours();
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i += 1) {
      if (h >= KEYS[i][0] && h <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const t = (h - a[0]) / (b[0] - a[0] || 1);
    const ca = new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t);
    this.scene.background = ca;
    if (this.keyLight) this.keyLight.intensity = a[2] + (b[2] - a[2]) * t;
    const gust = Math.max(0, Math.min(1, (Math.sin(this.time * 0.12) - 0.55) / 0.45));
    if (this.scene.fog) {
      this.scene.fog.color.copy(ca);
      this.scene.fog.near = 55 - 30 * gust;
      this.scene.fog.far = 150 - 76 * gust;
    }
    if (this.snowFx) {
      const attr = this.snowFx.pts.geometry.getAttribute("position");
      const windX = (1.2 + 7 * gust) * delta;
      for (let i = 0; i < attr.count; i += 1) {
        attr.array[i * 3 + 1] -= this.snowFx.speeds[i] * (1 + gust * 1.6) * delta;
        attr.array[i * 3] += windX * (0.6 + (i % 5) * 0.2);
        if (attr.array[i * 3 + 1] < 0) attr.array[i * 3 + 1] = 20;
        if (attr.array[i * 3] > 30) attr.array[i * 3] = -30;
        if (attr.array[i * 3 + 2] > 30) attr.array[i * 3 + 2] = -30;
        if (attr.array[i * 3 + 2] < -30) attr.array[i * 3 + 2] = 30;
      }
      attr.needsUpdate = true;
      this.snowFx.pts.material.opacity = 0.15 * gust;
    }
    if (this.aurora) {
      let nf = 0;
      if (h >= 20.5 || h <= 4.5) nf = 1;
      else if (h > 19.5 && h < 20.5) nf = h - 19.5;
      else if (h > 4.5 && h < 5.5) nf = 5.5 - h;
      this.aurora.group.visible = nf > 0.02;
      if (this.aurora.group.visible) {
        for (const c of this.aurora.curtains) {
          c.mesh.material.opacity = nf * 0.65;
          const attr = c.mesh.geometry.getAttribute("position");
          for (let i = 0; i < attr.count / 2; i += 1) {
            const sway = Math.sin(i * 0.32 + this.time * c.speed + c.phase) * 4;
            const swayTop = Math.sin(i * 0.32 + this.time * c.speed * 1.35 + c.phase + 0.9) * 7;
            attr.array[(i * 2) * 3] = c.base[(i * 2) * 3] + sway;
            attr.array[(i * 2 + 1) * 3] = c.base[(i * 2 + 1) * 3] + swayTop;
          }
          attr.needsUpdate = true;
        }
      }
    }
  }

  // ---------- 蜂蜜補血(§1,可整段刪除,不傷核心) ----------
  spawnHoney() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf0a820, emissive: 0x8a5a10, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.15 });
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.38, 6), mat);
    group.add(hex);
    const light = new THREE.PointLight(0xffcf5e, 1.1, 4);
    light.position.y = 0.3;
    group.add(light);
    const x = (Math.random() * 2 - 1) * (ARENA_HALF - 3);
    const z = (Math.random() * 2 - 1) * (ARENA_HALF - 3);
    group.position.set(x, 0.55, z);
    this.scene.add(group);
    this.honey = { group, t: 0, baseY: 0.55, mat, light };
  }

  updateHoney(delta) {
    if (!this.honey) {
      this.honeyTimer -= delta;
      if (this.honeyTimer <= 0) {
        this.spawnHoney();
        this.honeyTimer = HONEY_MIN_T + Math.random() * (HONEY_MAX_T - HONEY_MIN_T);
      }
      return;
    }
    const h = this.honey;
    h.t += delta;
    h.group.rotation.y += delta * 1.8;
    h.group.position.y = h.baseY + Math.sin(h.t * 2.2) * 0.08;
    if (h.t > HONEY_LIFE - 1) {
      const fade = clamp(HONEY_LIFE - h.t, 0, 1);
      h.mat.transparent = true;
      h.mat.opacity = fade;
      h.light.intensity = 1.1 * fade;
    }
    if (h.t >= HONEY_LIFE) {
      this.scene.remove(h.group);
      this.honey = null;
      return;
    }
    const d = Math.hypot(this.my.pos.x - h.group.position.x, this.my.pos.z - h.group.position.z);
    if (d < HONEY_EAT_DIST) {
      this.my.hp = Math.min(this.mode.hp || 100, this.my.hp + (this.mode.hp || 100) * HONEY_HEAL_PCT);
      this.scene.remove(h.group);
      this.honey = null;
      this.message = "野地的蜂蜜!";
      this.emitEvent("honey", {});
      this.pushHud();
    }
  }

  // ---------- 獅子攻擊:爪擊(輕)/撲咬(重,帶紅色預告) ----------
  lionClaw(fighter, target) {
    if (this.phase !== "battle" || this.endT >= 0 || fighter.koT >= 0) return;
    if (fighter.lightCd > 0 || fighter.stunT < this._stunDur()) return;
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    fighter.lightCd = LION_CLAW.cd * preset.aiCd;
    fighter.strikeT = 0;
    this.roundNo += 1;
    const dist = fighter.pos.distanceTo(target.pos);
    const toTarget = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
    const facing = Math.abs(wrapAngle(toTarget - fighter.heading)) <= LION_CLAW.arc;
    let lands = dist <= LION_CLAW.reach + BODY_REACH && facing;
    if (lands && Math.random() > clamp(preset.aiSkill + 0.18, 0, 0.95)) lands = false;
    if (lands) {
      this._pendingStrikes.push({
        target, dmg: Math.round(LION_CLAW.dmg * preset.aiDmg),
        opts: { who: "ai", weapon: { label: "獅爪", short: "爪擊" }, stun: 0, attacker: fighter, kind: "melee", knockback: LION_CLAW.knockback },
        t: 0.16,
      });
    } else {
      this.emitEvent("miss", { who: "ai" });
    }
  }

  _startLionPounce(fighter, target) {
    fighter.pounce = {
      phase: "telegraph",
      t: 0,
      dur: LION_POUNCE.telegraphMin + Math.random() * (LION_POUNCE.telegraphMax - LION_POUNCE.telegraphMin),
    };
    fighter.heading = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
    fighter.speed = 0;
    if (fighter.person.telegraph) fighter.person.telegraph.visible = true;
    this.message = "獅子要撲了——快閃開!";
    this.emitEvent("lion-telegraph", {});
    this.pushHud();
  }

  _resolveLionPounce(fighter, target) {
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const dist = fighter.pos.distanceTo(target.pos);
    const toTarget = Math.atan2(target.pos.x - fighter.pos.x, target.pos.z - fighter.pos.z);
    const facing = Math.abs(wrapAngle(toTarget - fighter.heading)) <= LION_POUNCE.arc;
    const lands = dist <= LION_POUNCE.reach + BODY_REACH && facing && target.koT < 0;
    fighter.pounce = { phase: "commit", t: 0, dur: LION_POUNCE.commitDur };
    if (fighter.person.telegraph) fighter.person.telegraph.visible = false;
    fighter.cd = LION_POUNCE.cd * preset.aiCd;
    if (lands) {
      this._pendingStrikes.push({
        target, dmg: Math.round(LION_POUNCE.dmg * preset.aiDmg),
        opts: { who: "ai", weapon: { label: "獅子撲咬", short: "撲咬" }, stun: 0, attacker: fighter, kind: "melee", knockback: LION_POUNCE.knockback },
        t: 0.08,
      });
    } else {
      this.emitEvent("miss", { who: "ai" });
      this.message = "獅子撲空了——趁機反擊!";
      this.pushHud();
    }
  }

  update(delta) {
    this.time += delta;
    const paused = this.overlay.visible;
    this.updateWeather(delta);

    this._slowMo = !paused && this.hitCamT < 0.4 ? 0.42 : 1;
    const sdt = delta * this._slowMo;

    if (!paused && this.phase === "battle") {
      this.updatePlayerMovement(sdt);
      this.updateLionAi(sdt);
      this.updateProjectiles(sdt);
      this.updateHoney(sdt);
      this.resolveBodyPush();
      this.syncFighterTransforms();

      if (this.mode.roundCap && this.roundNo >= this.mode.roundCap && this.endT < 0 && this.my.hp > 0 && this.foe.hp > 0) {
        this.endT = 0.01;
      }
      if (this.endT >= 0) {
        this.endT += delta;
        if (this.endT >= 1.6) this.finishMatch();
      }
    }

    this.hitFlashT += sdt;
    if (this.hitFlashT < 0.5) {
      this.hitFlash.material.opacity = 0.9 * (1 - this.hitFlashT / 0.5);
      this.hitFlash.scale.setScalar(1 + this.hitFlashT * 2.2);
      this.hitFlash.lookAt(this.camera.position);
    } else {
      this.hitFlash.material.opacity = 0;
    }
    this.hitCamT += delta;
    for (const f of [this.my, this.foe]) {
      f.hitT += sdt;
      f.stunT += sdt;
      f.strikeT += sdt;
      f.cd = Math.max(0, f.cd - sdt);
      f.lightCd = Math.max(0, (f.lightCd || 0) - sdt);
      if (f.koT >= 0) f.koT += delta;
      if (f.chargeT >= 0 && this.phase === "battle" && !paused) {
        f.chargeT = Math.min(CHARGE_FULL, f.chargeT + sdt);
      }
    }

    this.handleKeys();
    this.updatePoses();
    this.updateCamera(delta);

    this.autoSaveTimer += delta;
    if (this.autoSaveTimer > 5) {
      this.autoSaveTimer = 0;
      this.saveGame(true);
    }

    this.input.endFrame();
    this.pushHud();
  }

  updatePlayerMovement(dt) {
    const f = this.my;
    if (f.koT >= 0) {
      f.speed += (0 - f.speed) * Math.min(1, dt * 3);
      this.movePos(f, dt);
      return;
    }
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const stunned = f.stunT < this._stunDur();
    const wantBlock = this.input.isDown("action") && !stunned && f.chargeT < 0;
    if (wantBlock && !f.blocking) f.blockT = 0;
    else if (f.blocking && wantBlock) f.blockT += dt;
    f.blocking = wantBlock;
    if (!f.blocking) f.blockT = 9;
    let target = 0;
    if (!stunned) {
      if (this.input.isDown("up")) target = preset.maxFwd + (this.input.isDown("sprint") ? preset.boost : 0);
      else if (this.input.isDown("down")) target = f.speed > 0.4 ? 0 : -MAX_BACK;
      if (f.chargeT >= 0) target *= 0.5;
      if (f.blocking) target *= 0.35;
      const turn = (this.input.isDown("left") ? 1 : 0) - (this.input.isDown("right") ? 1 : 0);
      f.heading += turn * preset.turnRate * dt;
      if (turn === 0 && !this.input.isDown("sprint") && !this.input.isDown("up") && this.foe.koT < 0) {
        const dxF = this.foe.pos.x - f.pos.x;
        const dzF = this.foe.pos.z - f.pos.z;
        const distF = Math.hypot(dxF, dzF);
        if (distF <= AUTO_FACE_RANGE) {
          const diff = wrapAngle(Math.atan2(dxF, dzF) - f.heading);
          const maxTurn = preset.turnRate * 1.15 * dt;
          f.heading += clamp(diff, -maxTurn, maxTurn);
        }
      }
    }
    const rate = target < f.speed ? 6.0 : 4.0;
    f.speed += (target - f.speed) * Math.min(1, dt * rate);
    this.movePos(f, dt);
    f.walkT += dt * (Math.abs(f.speed) / 2.4);
  }

  movePos(f, dt) {
    f.pos.x += Math.sin(f.heading) * f.speed * dt;
    f.pos.z += Math.cos(f.heading) * f.speed * dt;
    const nx = clamp(f.pos.x, -ARENA_HALF, ARENA_HALF);
    const nz = clamp(f.pos.z, -ARENA_HALF, ARENA_HALF);
    if (nx !== f.pos.x || nz !== f.pos.z) f.speed *= 0.5;
    f.pos.x = nx;
    f.pos.z = nz;
  }

  resolveBodyPush() {
    const dx = this.foe.pos.x - this.my.pos.x;
    const dz = this.foe.pos.z - this.my.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.01 && d < 0.9) {
      const push = (0.9 - d) / 2;
      const ux = dx / d;
      const uz = dz / d;
      this.my.pos.x -= ux * push;
      this.my.pos.z -= uz * push;
      this.foe.pos.x += ux * push;
      this.foe.pos.z += uz * push;
    }
  }

  // ---------- 獅子 AI(三腦:走位+爪擊/撲咬決策+喘息) ----------
  updateLionAi(dt) {
    const f = this.foe;
    if (f.koT >= 0) {
      f.speed += (0 - f.speed) * Math.min(1, dt * 3);
      this.movePos(f, dt);
      return;
    }
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const brain = f.brain;
    const stunned = f.stunT < this._stunDur();
    const dx = this.my.pos.x - f.pos.x;
    const dz = this.my.pos.z - f.pos.z;
    const dist = Math.hypot(dx, dz);
    const toPlayer = Math.atan2(dx, dz);

    if (f.pounce) {
      f.pounce.t += dt;
      if (f.pounce.phase === "telegraph" && f.pounce.t >= f.pounce.dur) {
        this._resolveLionPounce(f, this.my);
      } else if (f.pounce.phase === "commit" && f.pounce.t >= f.pounce.dur) {
        f.pounce = null;
      }
      f.speed += (0 - f.speed) * Math.min(1, dt * 4);
      this.movePos(f, dt);
      return;
    }

    let desiredHeading = toPlayer;
    let desiredSpeed = preset.maxFwd * preset.aiSpd * (dist > 5 ? 1 : dist > 2.2 ? 0.6 : 0.3);
    if (brain.retreatT > 0) {
      brain.retreatT -= dt;
      desiredHeading = toPlayer + Math.PI + brain.orbitDir * 0.5;
      desiredSpeed = preset.maxFwd * preset.aiSpd * 0.8;
    }
    if (Math.abs(f.pos.x) > ARENA_HALF - 2 || Math.abs(f.pos.z) > ARENA_HALF - 2) {
      desiredHeading = Math.atan2(-f.pos.x, -f.pos.z);
    }
    if (stunned) desiredSpeed = 0;

    if (preset.aiSkill < 0.6) {
      brain.breatherT = (brain.breatherT ?? 4) - dt;
      if (brain.breatherT <= 0) {
        brain.restT = 1.4;
        brain.breatherT = 4 + Math.random() * 4;
      }
      if (brain.restT > 0) {
        brain.restT -= dt;
        desiredSpeed *= 0.15;
      }
    }

    const angDiff = wrapAngle(desiredHeading - f.heading);
    const maxTurn = preset.turnRate * preset.aiSpd * dt;
    f.heading += clamp(angDiff, -maxTurn, maxTurn);
    f.speed += (desiredSpeed * clamp(1 - Math.abs(angDiff) / Math.PI, 0.25, 1) - f.speed) * Math.min(1, dt * 3.0);
    this.movePos(f, dt);
    f.walkT += dt * (Math.abs(f.speed) / 2.2);

    if (this.mode.passive || stunned) return;
    const facingOk = Math.abs(wrapAngle(toPlayer - f.heading)) <= LION_CLAW.arc + 0.25;
    brain.pounceT = Math.max(0, (brain.pounceT ?? 3) - dt);
    if (f.cd <= 0 && brain.pounceT <= 0 && dist >= 1.4 && dist <= LION_POUNCE.reach + BODY_REACH + 2.5) {
      brain.pounceT = 6.5 + Math.random() * 5;
      this._startLionPounce(f, this.my);
      return;
    }
    if (f.lightCd <= 0 && dist <= LION_CLAW.reach + BODY_REACH && facingOk) {
      this.lionClaw(f, this.my);
      if (Math.random() < 0.35) {
        brain.retreatT = 0.8 + Math.random();
        brain.orbitDir = Math.random() < 0.5 ? -1 : 1;
      }
    }
  }

  updateProjectiles(dt) {
    if (this._pendingStrikes && this._pendingStrikes.length) {
      for (const s of this._pendingStrikes) s.t -= dt;
      const landed = this._pendingStrikes.filter((s) => s.t <= 0);
      this._pendingStrikes = this._pendingStrikes.filter((s) => s.t > 0);
      for (const s of landed) this.applyHit(s.target, s.dmg, s.opts);
    }
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.isWave) {
        p.mesh.position.addScaledVector(p.vel, dt);
        const s = 1.15 + p.t * 0.8 + Math.sin(p.t * 18) * 0.06;
        p.mesh.scale.setScalar(s);
        for (const c of p.mesh.children) if (c.rotation) c.rotation.z += dt * 5.5;
        p.mesh.children[1].material.opacity = 0.6 * (1 - (p.t / p.life) * 0.7);
      }
      if (!p.done && p.target.koT < 0) {
        const chest = p.target.pos.clone().setY(p.isWave ? 1.4 : 1.35);
        if (p.mesh.position.distanceTo(chest) < (p.hitR || 1.0)) {
          p.done = true;
          p.remove = true;
          this.applyHit(p.target, p.dmg, {
            who: p.who, weapon: p.weapon, stun: p.stun,
            from: p.mesh.position, kind: p.isWave ? "wave" : "proj",
          });
        }
      }
      if (p.isWave ? p.t > p.life : p.t > 3.5) p.remove = true;
    }
    for (const p of this.projectiles.filter((x) => x.remove)) this.scene.remove(p.mesh);
    this.projectiles = this.projectiles.filter((x) => !x.remove);
  }

  handleKeys() {
    if (this.input.consumePress("camera")) this.cycleCameraView();
    if (this.input.consumePress("pause")) this.togglePause();
    if (this.input.consumeRelease("heavyAttack")) this._heavyRelease();
    if (this.overlay.visible) return;
    if (this.input.consumePress("heavyAttack")) this._heavyPress();
    if (this.input.consumePress("lightAttack")) this.lightPunch();
  }

  // ---------- 姿勢動畫:參孫(人形)+獅子(四足)分開更新 ----------
  updatePoses() {
    this.updateSamsonPose(this.my, this.foe);
    this.updateLionPose(this.foe, this.my);
  }

  updateSamsonPose(f, other) {
    const person = f.person;
    const dist = f.pos.distanceTo(other.pos);
    const engaged = this.phase === "battle" && dist < 9;

    const amp = clamp(Math.abs(f.speed) / 6, 0, 0.62);
    const t = f.walkT * Math.PI * 2;
    if (f.koT < 0) {
      person.leftLeg.pivot.rotation.x = -0.05 + Math.sin(t) * amp;
      person.rightLeg.pivot.rotation.x = -0.05 + Math.sin(t + Math.PI) * amp;
      person.leftLeg.joint.rotation.x = 0.1 + Math.max(0, Math.sin(t + 0.8)) * amp * 1.1;
      person.rightLeg.joint.rotation.x = 0.1 + Math.max(0, Math.sin(t + Math.PI + 0.8)) * amp * 1.1;
      person.group.position.y = Math.abs(Math.sin(t)) * amp * 0.08;
      if (engaged && Math.abs(f.speed) < 1.2) {
        person.leftLeg.pivot.rotation.x = -0.3;
        person.rightLeg.pivot.rotation.x = -0.22;
        person.leftLeg.joint.rotation.x = 0.45;
        person.rightLeg.joint.rotation.x = 0.4;
        person.group.position.y = -0.06;
      }
    }

    const st = f.strikeT;
    let armX = engaged ? -1.2 : -0.9;
    let armJ = engaged ? -0.3 : -0.5;
    let strikeLean = 0;
    const kind = f.strikeKind;
    if (kind === "light" && st < 0.28) {
      // 輕拳:快、短促的直拳
      if (st < 0.1) {
        const k = st / 0.1;
        armX = -1.2 - k * 0.9;
      } else if (st < 0.2) {
        const k = (st - 0.1) / 0.1;
        armX = -2.1 + k * 1.3;
        strikeLean = k * 0.2;
      } else {
        const k = (st - 0.2) / 0.08;
        armX = -0.8 - (1 - k) * 0.2;
        strikeLean = 0.2 * (1 - k);
      }
    } else if ((kind === "heavy" || kind === "holy") && st < 0.6) {
      // 重拳/聖靈金光:180°舉過頭直劈式重拳,動作大、看得見打到身上
      if (st < 0.14) {
        const k = st / 0.14;
        armX = -1.2 - k * 1.85;
      } else if (st < 0.34) {
        const k = (st - 0.14) / 0.2;
        armX = -3.05 + k * 2.7;
        armJ = -0.1 - k * 0.2;
        strikeLean = k * (kind === "holy" ? 0.5 : 0.35);
      } else {
        const k = (st - 0.34) / 0.26;
        armX = -0.35 - k * 0.85;
        armJ = -0.3 + k * 0.15;
        strikeLean = (kind === "holy" ? 0.5 : 0.35) * (1 - k);
      }
    }
    // 蓄力(聖靈金光蓄勢):雙臂高舉發抖+腳下金圈亮起
    if (f.chargeT >= 0) {
      const c01 = clamp(f.chargeT / CHARGE_FULL, 0, 1);
      armX = -2.3 + Math.sin(this.time * 26) * 0.07 * (0.5 + c01);
      armJ = -0.1;
      f.chargeRing.material.opacity = 0.25 + c01 * 0.6;
      f.chargeRing.scale.setScalar(0.8 + c01 * 1.0);
    } else {
      f.chargeRing.material.opacity = 0;
    }
    person.rightArm.pivot.rotation.order = "YXZ";
    person.rightArm.pivot.rotation.x = armX;
    person.rightArm.pivot.rotation.y = 0;
    person.rightArm.joint.rotation.x = armJ;
    person.rig.rotation.y = 0;

    // 左臂:平時護胸;格擋=雙臂舉至身前(赤手防禦,無盾牌)
    if (f.blocking) {
      person.leftArm.pivot.rotation.x = -1.55;
      person.leftArm.pivot.rotation.z = -0.25;
      person.leftArm.joint.rotation.x = -0.35;
      person.rightArm.pivot.rotation.x = -1.4;
      person.rightArm.pivot.rotation.z = 0.25;
      person.rightArm.joint.rotation.x = -0.3;
    } else {
      person.leftArm.pivot.rotation.x = engaged ? -1.0 : -0.8;
      person.leftArm.pivot.rotation.z = 0.35;
      person.leftArm.joint.rotation.x = -0.18;
    }

    const stunned = f.stunT < this._stunDur();
    if (f.koT >= 0) {
      const k = clamp(f.koT / 1.2, 0, 1);
      person.group.position.y = -k * 0.5;
      person.rig.rotation.x = k * 0.5;
      person.leftLeg.pivot.rotation.x = -k * 1.3;
      person.leftLeg.joint.rotation.x = k * 1.5;
      person.rightLeg.pivot.rotation.x = k * 0.2;
      person.rightLeg.joint.rotation.x = k * 1.2;
    } else if (stunned) {
      person.rig.rotation.z = Math.sin(this.time * 10) * 0.12;
      person.rig.rotation.x = 0.1;
    } else {
      person.rig.rotation.z = 0;
      person.rig.rotation.x = f.hitT < 0.8
        ? -0.8 * (1 - f.hitT / 0.8)
        : Math.max(strikeLean, engaged ? 0.08 : 0);
    }
  }

  updateLionPose(f) {
    const person = f.person;
    const amp = clamp(Math.abs(f.speed) / 5, 0, 0.5);
    const t = f.walkT * Math.PI * 2;
    if (f.koT < 0 && !(f.pounce && f.pounce.phase === "commit")) {
      person.legs.fl.pivot.rotation.x = Math.sin(t) * amp;
      person.legs.br.pivot.rotation.x = Math.sin(t) * amp;
      person.legs.fr.pivot.rotation.x = Math.sin(t + Math.PI) * amp;
      person.legs.bl.pivot.rotation.x = Math.sin(t + Math.PI) * amp;
      person.legs.fl.joint.rotation.x = Math.max(0, Math.sin(t + 0.6)) * amp * 1.3;
      person.legs.br.joint.rotation.x = Math.max(0, Math.sin(t + 0.6)) * amp * 1.3;
      person.legs.fr.joint.rotation.x = Math.max(0, Math.sin(t + Math.PI + 0.6)) * amp * 1.3;
      person.legs.bl.joint.rotation.x = Math.max(0, Math.sin(t + Math.PI + 0.6)) * amp * 1.3;
      person.group.position.y = Math.abs(Math.sin(t)) * amp * 0.05;
    }
    // 尾巴搖擺
    person.tailPivot.rotation.y = Math.sin(this.time * 3) * 0.25;

    // 爪擊(輕攻擊):前腿快速一揮,不預告
    if (f.strikeT < 0.22 && !f.pounce) {
      const k = Math.sin(clamp(f.strikeT / 0.22, 0, 1) * Math.PI);
      person.legs.fl.pivot.rotation.x = -0.7 * k;
    }

    // 撲咬紅色預告扇形(判定=畫面:範圍=實際命中範圍)
    if (person.telegraph) {
      if (f.pounce && f.pounce.phase === "telegraph") {
        person.telegraph.visible = true;
        const k = clamp(f.pounce.t / f.pounce.dur, 0, 1);
        person.telegraph.material.opacity = 0.5 * (0.55 + 0.45 * Math.sin(this.time * 14)) * (0.35 + 0.65 * k);
      } else {
        person.telegraph.visible = false;
      }
    }

    // 撲咬瞬間:前身抬起撲落
    let rigX = 0;
    if (f.pounce && f.pounce.phase === "commit") {
      const k = clamp(f.pounce.t / f.pounce.dur, 0, 1);
      const rise = Math.sin(k * Math.PI);
      rigX = -rise * 0.4;
      person.legs.fl.pivot.rotation.x = -rise * 0.95;
      person.legs.fr.pivot.rotation.x = -rise * 0.95;
    }

    const stunned = f.stunT < this._stunDur();
    if (f.koT >= 0) {
      // 敗=側躺被制伏(不流血)
      const k = clamp(f.koT / 1.2, 0, 1);
      person.rig.rotation.z = k * (Math.PI / 2 - 0.05);
      person.group.position.y = -k * 0.35;
      person.rig.rotation.x = k * 0.1;
    } else if (stunned) {
      person.rig.rotation.z = Math.sin(this.time * 10) * 0.1;
      person.rig.rotation.x = rigX;
    } else {
      person.rig.rotation.z = 0;
      // 被打=後仰退開(街霸式,誰都黏不住誰:hitT 剛被打時身體後傾)
      person.rig.rotation.x = f.hitT < 0.5 ? -0.3 * (1 - f.hitT / 0.5) + rigX : rigX;
    }
  }

  updateCamera(delta) {
    let desiredPos;
    let desiredLook;
    const mid = this.my.pos.clone().add(this.foe.pos).multiplyScalar(0.5);
    if (this.phase === "menu") {
      const a = this.time * 0.08;
      desiredPos = new THREE.Vector3(Math.cos(a) * 22, 8, Math.sin(a) * 22);
      desiredLook = new THREE.Vector3(0, 1.1, 0);
    } else if (this.hitCamT < 0.55 && this.phase === "battle") {
      const dir = this.foe.pos.clone().sub(this.my.pos).setY(0).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x);
      desiredPos = mid.clone().addScaledVector(perp, 5).setY(1.9);
      desiredLook = mid.clone().setY(1.35);
    } else if (this.cameraView === 0) {
      const fwd = new THREE.Vector3(Math.sin(this.my.heading), 0, Math.cos(this.my.heading));
      desiredPos = this.my.pos.clone().addScaledVector(fwd, -5.2).setY(3.0);
      desiredLook = this.my.pos.clone().addScaledVector(fwd, 6).setY(1.3);
    } else if (this.cameraView === 1) {
      desiredPos = new THREE.Vector3(ARENA_HALF + 5, 3.2, clamp(mid.z, -10, 10));
      desiredLook = mid.clone().setY(1.2);
    } else if (this.cameraView === 2) {
      desiredPos = new THREE.Vector3(mid.x, 22, mid.z + 2);
      desiredLook = mid.clone().setY(0.5);
    } else {
      const fwd = new THREE.Vector3(Math.sin(this.my.heading), 0, Math.cos(this.my.heading));
      desiredPos = this.my.pos.clone().addScaledVector(fwd, 0.3).setY(2.0);
      desiredLook = this.my.pos.clone().addScaledVector(fwd, 10).setY(1.3);
    }
    const k = 1 - Math.exp(-delta * (this.hitCamT < 0.55 && this.phase !== "menu" ? 6.5 : 3.4));
    this.camPos.lerp(desiredPos, k);
    this.camLook.lerp(desiredLook, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  // ---------- HUD ----------
  pushHud() {
    if (!this.onHudUpdate) return;
    const preset = DIFFICULTY_PRESETS[this.difficulty];
    const w = WEAPONS.fists;
    const dist = this.my.pos.distanceTo(this.foe.pos);
    const heavyReady01 = w.cd > 0 ? clamp(1 - this.my.cd / w.cd, 0, 1) : 1;
    const inReach = dist <= w.reach + BODY_REACH + preset.assist * 0.6;
    const phaseLabels = { menu: "主選單", gate: "出戰準備", battle: "激戰中", ended: "終場" };
    this.onHudUpdate({
      myHp: this.my.hp,
      aiHp: this.foe.hp,
      maxHp: this.mode.hp || 100,
      roundNo: this.roundNo,
      roundCap: this.mode.roundCap || null,
      modeLabel: this.mode.label,
      difficultyLabel: DIFFICULTY_LABELS[this.difficulty],
      phaseLabel: phaseLabels[this.phase] || "",
      message: this.message,
      speed01: clamp(Math.abs(this.my.speed) / (preset.maxFwd + preset.boost), 0, 1),
      speedText: `${(this.my.speed * 3.6).toFixed(0)} km/h`,
      heavyReady01,
      heavyReady: this.my.cd <= 0,
      lightReady: this.my.lightCd <= 0,
      charging: this.my.chargeT >= 0,
      charge01: this.my.chargeT >= 0 ? clamp(this.my.chargeT / CHARGE_FULL, 0, 1) : 0,
      chargeReady: this.my.chargeT >= CHARGE_MIN,
      inReach,
      gapText: this.phase === "battle" ? `${dist.toFixed(1)} m` : "—",
      lastHit: this.lastHit,
      overlay: { ...this.overlay },
    });
  }

  // ---------- 存讀檔(勝場紀錄) ----------
  saveGame(silent = false) {
    const prev = loadSavedGame() || {};
    const snapshot = {
      difficulty: this.difficulty, modeId: this.modeId,
      wins: prev.wins || 0, matches: prev.matches || 0,
    };
    if (this.phase === "ended" && !this.mode.passive) {
      snapshot.matches = (prev.matches || 0) + 1;
      if (this.foe.hp <= 0 && this.my.hp > 0) snapshot.wins = (prev.wins || 0) + 1;
    }
    saveGameState(snapshot);
    if (!silent) {
      this.message = "已存檔。";
      this.pushHud();
    }
  }

  loadGame() {
    const snap = loadSavedGame();
    if (!snap) return false;
    if (DIFFICULTY_PRESETS[snap.difficulty]) this.difficulty = snap.difficulty;
    if (GAME_MODES[snap.modeId]) {
      this.modeId = snap.modeId;
      this.mode = getModeConfig(snap.modeId);
    }
    this.openHomeMenu();
    this.message = snap.matches
      ? `戰績:${snap.wins} 勝 / ${snap.matches} 場——繼續練!`
      : "尚無戰績,先來一場吧!";
    this.pushHud();
    return true;
  }
}
