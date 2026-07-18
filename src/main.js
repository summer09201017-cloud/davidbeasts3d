import "./styles.css";
import { WarriorGame, GAME_MODES } from "./game.js";
import { AudioManager } from "./audio.js";
import { speakLine, setVoiceEnabled } from "./voice.js";
import { PHRASES, SCRIPTURES } from "./voicePhrases.js";
import { hasSavedGame, loadSettings, saveSettings } from "./storage.js";

const ui = {
  canvas: document.querySelector("#gameCanvas"),
  cameraButton: document.querySelector("#cameraButton"),
  myScoreLabel: document.querySelector("#myScoreLabel"),
  aiScoreLabel: document.querySelector("#aiScoreLabel"),
  modeCode: document.querySelector("#modeCode"),
  passLabel: document.querySelector("#passLabel"),
  gapLabel: document.querySelector("#gapLabel"),
  gapSideLabel: document.querySelector("#gapSideLabel"),
  lastPassLabel: document.querySelector("#lastPassLabel"),
  phaseLabel: document.querySelector("#phaseLabel"),
  statusMessage: document.querySelector("#statusMessage"),
  modeLabel: document.querySelector("#modeLabel"),
  difficultyLabel: document.querySelector("#difficultyLabel"),
  speedLabel: document.querySelector("#speedLabel"),
  audioStatus: document.querySelector("#audioStatus"),
  saveStatus: document.querySelector("#saveStatus"),
  installButton: document.querySelector("#installButton"),
  installHint: document.querySelector("#installHint"),
  loadButton: document.querySelector("#loadButton"),
  menuButton: document.querySelector("#menuButton"),
  audioButton: document.querySelector("#audioButton"),
  pauseButton: document.querySelector("#pauseButton"),
  touchControls: document.querySelector("#touchControls"),
  speedMeterFill: document.querySelector("#speedMeterFill"),
  speedMeterText: document.querySelector("#speedMeterText"),
  windowFill: document.querySelector("#windowFill"),
  windowValue: document.querySelector("#windowValue"),
  matchOverlay: document.querySelector("#matchOverlay"),
  overlayEyebrow: document.querySelector("#overlayEyebrow"),
  overlayTitle: document.querySelector("#overlayTitle"),
  overlayText: document.querySelector("#overlayText"),
  resumeButton: document.querySelector("#resumeButton"),
  overlayMenuButton: document.querySelector("#overlayMenuButton"),
  homeScreen: document.querySelector("#homeScreen"),
  modeCardGrid: document.querySelector("#modeCardGrid"),
  modeDescription: document.querySelector("#modeDescription"),
  menuDifficultySelect: document.querySelector("#menuDifficultySelect"),
  bigPowerLabel: document.querySelector("#bigPowerLabel"),
  audioSelect: document.querySelector("#audioSelect"),
  modeMetaTitle: document.querySelector("#modeMetaTitle"),
  modeMetaGoal: document.querySelector("#modeMetaGoal"),
  startMatchButton: document.querySelector("#startMatchButton"),
  commentaryBar: document.querySelector("#commentaryBar"),
  continueSavedButton: document.querySelector("#continueSavedButton"),
};

const settings = loadSettings();
const audio = new AudioManager();
audio.setEnabled(settings.audioEnabled !== false);

const game = new WarriorGame({
  canvas: ui.canvas,
  touchRoot: ui.touchControls,
});
window.__samson3d = game; window.__warrior3d = game; // dev hook(新名+引擎舊名雙掛)
window.__game = game; // /smoke3d 通用鉤子

let selectedModeId = game.modeId;
let selectedDifficulty = game.difficulty;
let audioEnabled = settings.audioEnabled !== false;

function persistSettings() {
  saveSettings({
    difficulty: selectedDifficulty,
    modeId: selectedModeId,
    audioEnabled,
  });
}

function setMeterFill(element, value) {
  element.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
}

function setAudioState(enabled) {
  audioEnabled = enabled;
  audio.setEnabled(enabled);
  setVoiceEnabled(enabled);
  ui.audioStatus.textContent = enabled ? "開啟" : "靜音";
  ui.audioButton.textContent = enabled ? "音效開啟" : "音效靜音";
  ui.audioSelect.value = enabled ? "on" : "off";
  persistSettings();
}

function syncMenuCards() {
  for (const button of ui.modeCardGrid.querySelectorAll(".mode-card")) {
    button.classList.toggle("selected", button.dataset.mode === selectedModeId);
  }
  const mode = GAME_MODES[selectedModeId];
  ui.modeDescription.textContent = mode.description;
  ui.modeMetaTitle.textContent = mode.label;
  ui.modeMetaGoal.textContent = mode.goal;
}

function syncMenuControls() {
  ui.menuDifficultySelect.value = selectedDifficulty;
  syncMenuCards();
}

function syncGameConfigurationToMenu() {
  selectedModeId = game.modeId;
  selectedDifficulty = game.difficulty;
  syncMenuControls();
}

function syncOverlay(overlay) {
  ui.matchOverlay.classList.toggle("visible", overlay.visible);
  ui.overlayEyebrow.textContent = overlay.eyebrow;
  ui.overlayTitle.textContent = overlay.title;
  ui.overlayText.textContent = overlay.text;
  ui.resumeButton.hidden = !overlay.canResume;
}

function openHomeScreen() {
  game.openHomeMenu();
  audio.stopCrowd();
  syncGameConfigurationToMenu();
  ui.homeScreen.classList.add("visible");
}

function closeHomeScreen() {
  ui.homeScreen.classList.remove("visible");
}

function unlockAudio() {
  audio.unlock();
}

function pushCommentary(text, tone = "info", spoken = text) {
  const bar = ui.commentaryBar;
  if (!bar || !text) return;
  bar.hidden = false;
  bar.dataset.tone = tone;
  bar.textContent = text;
  bar.style.animation = "none";
  void bar.offsetWidth;
  bar.style.animation = "";
  speakLine(spoken);
}

function handleGameEvent(event) {
  switch (event.type) {
    case "match-start": {
      audio.whistle();
      audio.vibrate(18);
      pushCommentary("歡迎來到亭拿的葡萄園!", "info", PHRASES[0]);
      break;
    }
    case "battle-start": {
      audio.horn();
      audio.vibrate(16);
      pushCommentary("開戰!倚靠耶和華的靈,迎向獅子!", "hot", SCRIPTURES[1]);
      break;
    }
    case "miss": {
      if (event.who === "me") {
        audio.rebound();
        pushCommentary("這一下落空了——靠近、對準再出手!", "cool", PHRASES[8]);
      }
      break;
    }
    case "super": {
      audio.scoreSting();
      audio.swish();
      audio.vibrate([40, 20, 60]);
      if (event.who === "me") {
        pushCommentary("聖靈的能力臨到——金光大作!", "hot", PHRASES[3]);
      } else {
        pushCommentary("獅子撲勢驚人——快閃開!", "cool");
      }
      break;
    }
    case "lion-telegraph": {
      audio.rebound();
      audio.vibrate([20, 40]);
      pushCommentary("獅子要撲了——快閃開!", "cool", PHRASES[5]);
      break;
    }
    case "block": {
      audio.rebound();
      audio.thud(0.4);
      audio.vibrate(18);
      if (event.who === "me") {
        pushCommentary("舉臂格擋——擋下來了!", "info");
      }
      break;
    }
    case "parry": {
      audio.scoreSting();
      audio.rebound();
      audio.vibrate([30, 20, 50]);
      if (event.who === "me") {
        pushCommentary("完美格擋!獅子被震退!", "hot");
      }
      break;
    }
    case "honey": {
      audio.uiTap();
      audio.vibrate(14);
      pushCommentary("野地的蜂蜜!", "hot", PHRASES[4]);
      break;
    }
    case "hit": {
      if (event.who === "me") {
        audio.scoreSting();
        audio.crowdCheer(event.dmg >= 14 ? 0.9 : 0.5);
        audio.vibrate([30, 20, 45]);
        const spoken = event.weapon === "輕拳" ? PHRASES[1] : event.weapon === "重拳" ? PHRASES[2] : PHRASES[3];
        pushCommentary(
          `${event.weapon}命中!獅子 -${event.dmg}(第 ${event.round} 回合)`,
          "hot",
          spoken,
        );
      } else {
        audio.thud(0.8);
        audio.vibrate(24);
        if (game.difficulty === "death") fangFlash(); // 死神模式限定:獠牙閃現(單次 0.3s)
        const spoken = event.weapon === "獅爪" ? PHRASES[6] : PHRASES[7];
        pushCommentary(
          `被${event.weapon}擊中 -${event.dmg}——拉開距離再反擊!`,
          "cool",
          spoken,
        );
      }
      break;
    }
    case "ko": {
      audio.horn();
      audio.crowdCheer(event.winner === "me" ? 1 : 0.6);
      audio.vibrate([110, 50, 120]);
      if (event.winner === "me") pushCommentary("獅子被制伏了!", "hot", PHRASES[9]);
      break;
    }
    case "match-end": {
      if (!event.win && game.difficulty === "death") playDarkHand(); // 死神模式限定:黑手抓心壞結局(嚇一下就收)
      const winText = "耶和華的靈大大感動參孫!手無器械,卻勝過吼叫的獅子!🦁";
      const loseText = "再試一次——能力不在乎自己,在乎耶和華的靈。";
      pushCommentary(
        event.win ? winText : loseText,
        event.win ? "hot" : "info",
        SCRIPTURES[0],
      );
      ui.saveStatus.textContent = hasSavedGame() ? "已記錄" : "尚無";
      window.psPing?.("samson3d-done", window.__psT0 ? Math.round((Date.now() - window.__psT0) / 1000) : 0);
      break;
    }
    default:
      break;
  }
}

game.onEvent = handleGameEvent;

game.onHudUpdate = (state) => {
  ui.myScoreLabel.textContent = String(state.myHp);
  ui.aiScoreLabel.textContent = String(state.aiHp);
  ui.modeCode.textContent = state.modeLabel;
  ui.passLabel.textContent = state.roundCap ? `${state.roundNo}/${state.roundCap}` : String(state.roundNo);
  ui.gapLabel.textContent = state.gapText;
  ui.gapSideLabel.textContent = state.gapText;
  ui.lastPassLabel.textContent = state.lastHit
    ? (state.lastHit.who === "me" ? `${state.lastHit.weapon} -${state.lastHit.dmg}` : `挨${state.lastHit.weapon} -${state.lastHit.dmg}`)
    : "—";
  ui.phaseLabel.textContent = state.phaseLabel;
  ui.statusMessage.textContent = state.message;
  ui.modeLabel.textContent = state.modeLabel;
  ui.difficultyLabel.textContent = state.difficultyLabel;
  ui.speedLabel.textContent = state.speedText;
  ui.speedMeterText.textContent = state.speedText;
  setMeterFill(ui.speedMeterFill, state.speed01);
  ui.windowValue.textContent = state.charging
    ? (state.chargeReady ? "放開出聖靈金光!" : "蓄力中…")
    : state.heavyReady ? (state.inReach ? "可出拳!" : "冷卻好了,靠近!") : "冷卻中…";
  setMeterFill(ui.windowFill, state.charging ? state.charge01 : state.heavyReady01);
  { // 中下方大出手條:戰鬥中顯示;蓄力時變蓄力條;滿=發光
    const bp = document.getElementById("bigPower"), bf = document.getElementById("bigPowerFill");
    if (bp) {
      bp.hidden = state.phaseLabel !== "激戰中";
      if (ui.bigPowerLabel) ui.bigPowerLabel.textContent = state.charging ? "聖靈金光蓄力" : "重拳出手";
      bf.style.transform = `scaleX(${Math.min(1, state.charging ? state.charge01 : state.heavyReady01)})`;
      bf.classList.toggle("full", state.charging ? state.chargeReady : (state.heavyReady && state.inReach));
    }
  }
  syncOverlay(state.overlay);
};

syncGameConfigurationToMenu();
setAudioState(audioEnabled);
ui.saveStatus.textContent = hasSavedGame() ? "已記錄" : "尚無";

ui.modeCardGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".mode-card");
  if (!button) return;
  unlockAudio();
  audio.uiTap();
  selectedModeId = button.dataset.mode;
  syncMenuCards();
  persistSettings();
});

ui.menuDifficultySelect.addEventListener("change", (event) => {
  selectedDifficulty = event.target.value;
  persistSettings();
});

ui.audioSelect.addEventListener("change", (event) => {
  unlockAudio();
  audio.uiTap();
  setAudioState(event.target.value === "on");
});

ui.startMatchButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  window.psPing?.("samson3d-start");
  window.__psT0 = Date.now();
  game.applyPresentation({
    difficulty: selectedDifficulty,
    modeId: selectedModeId,
  });
  game.startSelectedMatch();
  closeHomeScreen();
});

function loadIntoUi() {
  const loaded = game.loadGame();
  syncGameConfigurationToMenu();
  ui.saveStatus.textContent = loaded && hasSavedGame() ? "已記錄" : "尚無";
}

ui.continueSavedButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  loadIntoUi();
});

ui.loadButton.addEventListener("click", loadIntoUi);

ui.menuButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  openHomeScreen();
});

ui.overlayMenuButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  openHomeScreen();
});

ui.cameraButton.addEventListener("click", () => {
  game.cycleCameraView();
});

ui.audioButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  setAudioState(!audioEnabled);
});

ui.pauseButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  game.togglePause();
});

ui.resumeButton.addEventListener("click", () => {
  unlockAudio();
  audio.uiTap();
  game.resume();
});

window.addEventListener("pointerdown", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio, { passive: true });

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  ui.installButton.hidden = false;
  ui.installHint.textContent = "已偵測到可安裝版本，點一下就能加入主畫面。";
});

ui.installButton.addEventListener("click", async () => {
  unlockAudio();
  audio.uiTap();
  if (!deferredInstallPrompt) {
    ui.installHint.textContent = "如果是 iPhone，請用分享選單的「加入主畫面」。";
    return;
  }
  deferredInstallPrompt.prompt();
  const outcome = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  ui.installButton.hidden = true;
  ui.installHint.textContent =
    outcome.outcome === "accepted" ? "安裝要求已送出。" : "你可以之後再安裝。";
});

window.addEventListener("appinstalled", () => {
  ui.installButton.hidden = true;
  ui.installHint.textContent = "已安裝到裝置。";
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    game.saveGame(true);
  }
});

// dev(localhost)不註冊 SW(07-11 踩雷)
if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      ui.installHint.textContent = "Service Worker 註冊失敗，但仍可直接遊玩。";
    });
  });
}

game.start();

// ── 死神模式恐怖演出(beast-boss-kit §3;只在 death 難度被呼叫,分級鐵則)──
function fangFlash() {
  const el = document.getElementById("fangFlash");
  if (!el) return;
  el.hidden = false;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show"); // CSS 單次 0.3s 淡入淡出,無連續爆閃(癲癇安全)
  setTimeout(() => { el.hidden = true; el.classList.remove("show"); }, 340);
}
function playDarkHand() {
  const el = document.getElementById("darkHand");
  if (!el) return;
  el.hidden = false;
  el.classList.remove("play");
  void el.offsetWidth;
  el.classList.add("play"); // 黑手升起抓走心臟 ~2s,收掉後回到一般溫柔重試文案
  setTimeout(() => { el.hidden = true; el.classList.remove("play"); }, 2100);
}
