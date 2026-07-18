# CLAUDE.md — samson3d(3D 參孫打獅子・真3D競技場,士師記十四章)

> 2026-07-19 換皮自 warrior3d(德義武鬥館,徒步自由走位引擎)。原引擎可讀但絕不修改
> `C:\Users\HFP\Desktop\warrior3d`。帳號 summer09201017-cloud。
> ★尚未上架:公開 repo/Netlify prod 站名等使用者逐字點名(上架鐵則)。

## 經文(士師記十四章五至六節,cuv 已查驗)

> 參孫跟他父母下亭拿去,到了亭拿的葡萄園,見有一隻少壯獅子向他吼叫。耶和華的靈大大
> 感動參孫,他雖然手無器械,卻將獅子撕裂,如同撕裂山羊羔一樣。他行這事並沒有告訴父母。

## 引擎要點(沿用 arena-duel-kit,依 beast-boss-kit 換皮)

- 徒步自由走位:fighter={pos,heading,speed};WASD 走位、Shift 衝刺;場地 ARENA_HALF=15,
  開放無阻擋,邊界柔性擋。血量制:殺獅之戰各 100 血/與獅纏鬥各 300 血(roundCap=300)/
  練習場獅子不出手。KO=溫柔演出(參孫單膝跪地;獅子側躺被制伏),無流血。
- 武器系統只留 `fists`(WEAPON_ORDER=["fists"]),不畫武器 mesh。
  - **輕拳(J)**:`LIGHT_PUNCH`——快、傷害低、獨立冷卻(不佔重拳 cd)。
  - **重拳(K/Space/點畫面)**:`WEAPONS.fists`——慢、傷害高、命中擊退;可長按蓄力
    (CHARGE_MIN 0.6s~CHARGE_FULL 1.5s)放開=**聖靈金光**(`superAttack`→`_fireHolyWave`,
    金色光波,dmg 1.4-2.5x,士14:6,不血腥)。
  - 格擋(C 鍵,參孫限定,獅子從不格擋):正面 ±60° 近戰傷害 ×0.3;剛舉起 ≤0.35s 被打=
    完美格擋(無傷+獅子震退硬直)。
- 判定=畫面(鐵則4):近戰=距離+朝向幾何判定,傷害延到 CONTACT_AT/固定 t 值「接觸瞬間」
  結算(`_pendingStrikes` 佇列)。
- 自動面向:獅子進 8m 內,參孫沒在手動轉向/前進時自動轉身面對(W 前進完全讓位)。

## 獅子(beast-boss-kit §4,真 3D 四足)

- `makeLion()`:Box 軀幹水平放,四腿在軀幹下方四角(fl/fr/bl/br),頭在前端(+z)+鬃毛環
  (Torus+Sphere)+尾巴;配色集中 `LION_COLORS`(日後黑化用)。開場 `foe.heading=Math.PI`
  使頭部(局部 +z)朝向玩家(局部 -z 世界方向)。
- 攻擊:**輕=爪擊**(`lionClaw`,快、無預告)、**重=撲咬**(`_startLionPounce`→
  `_resolveLionPounce`,帶紅色扇形預告 0.5-0.8s,telegraph 是 `foe.person.telegraph`,
  只設 `rotation.x=-Math.PI/2` 作為 fighter.group 子物件——避免 Euler 疊加雷區,參考
  chargeRing 的既有模式)。預告範圍=實際命中範圍(`LION_POUNCE.reach+BODY_REACH`),
  預告結束那一幀(`_resolveLionPounce`)才結算。
- AI 三腦(`updateLionAi`):走位(追擊/繞圈退開)+爪擊/撲咬決策(`brain.pounceT` 冷卻)+
  喘息腦(aiSkill<0.6 每 4-8s 停 1.4s)。獅子不格擋、不換武器、不蓄力大招。

## 蜂蜜補血(§1,可整段刪除)

`spawnHoney`/`updateHoney`:12-20s 隨機出現,金黃六角柱+浮動旋轉+PointLight;距離
<1.2 吃到回血 25%、字幕「野地的蜂蜜!」;同時最多 1 個,10 秒沒吃淡出。

## 場景

亭拿葡萄園白日:`buildVineyard()`——葡萄藤架成排(棚架+藤葉+葡萄串)+遠山背景;
`dayHours()` 起點改正午(暖光為主);已移除觀眾席/彩旗/燈籠柱/圍場欄(獨自一人,
士14:5)。天氣系統(日夜/極光/飄雪)保留但預設晴日。

## 已移除(換皮清單)

CHARACTERS(傑洛/喬尼/迪亞哥替身角色包)、CHARACTER_SKILLS、THE WORLD 時停、爪彈、
黃金迴旋、OUTFIT_COLORS 戰袍選色、八般武器與武器條 UI、跳殺/飛殺突進技(E/R)——
全部移除(不是鎖住),簡化操作為 WASD/J/K/C/V。

## 驗證

`npm run build && npx vite preview --port 4189`;Playwright 驅動一場對戰(輕拳/重拳/
聖靈金光/KO/勝敗文案)確認 0 pageerror。`node scripts/gen-voice.mjs` 烤 14 句(PHRASES
12 句+SCRIPTURES 2 句),累加式重跑到 failed 0。

## 部署與同步(上架後,主線負責)

尚未上架——本輪只做換皮與驗證,不部署、不 push、不動其他 repo。
