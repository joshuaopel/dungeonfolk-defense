// Core game state, loop, input handling, and all gameplay logic

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Resize canvas to config
        canvas.width = CONFIG.CANVAS_WIDTH;
        canvas.height = CONFIG.CANVAS_HEIGHT;

        // Game state
        this.phase = 'menu'; // menu | prep | wave | upgrade | gameover | victory
        this.wave = 0;
        this.gold = CONFIG.STARTING_GOLD;
        this.dungeonHeartHp = CONFIG.DUNGEON_HEART_MAX_HP;
        this.passiveGoldAccum = 0;
        this.prepTimer = CONFIG.PREP_TIME;

        // Entity arrays
        this.grid = Array.from({ length: CONFIG.GRID_ROWS }, () =>
            Array(CONFIG.GRID_COLS).fill(null)
        );
        this.monsters = [];
        this.heroes = [];
        this.projectiles = [];
        this.particles = [];
        this.aoeEffects = [];

        // Systems
        this.waveManager = new WaveManager();
        this.memory = new MemorySystem();
        this.renderer = new Renderer(this.ctx);

        // UI state
        this.selectedUnit = null; // { id, isMonster } or null
        this.hoveredCell = null;  // { col, row }
        this.upgradeOptions = [];
        this.selectedUpgrade = null;

        // Upgrades accumulated
        this.upgrades = {
            passiveGold: 0,
            monsterDamage: 0,
            monsterHealth: 0,
            trapCooldown: 0,
            slowBoost: 0,
            killBonus: 0,
            maxSlots: CONFIG.GRID_COLS * CONFIG.GRID_ROWS - CONFIG.DUNGEON_PATH.length,
        };
        this.placedCount = 0;

        // Heart damage visuals
        this.heartShake = 0;
        this.heartFlash = 0;

        // Tutorial
        this.showTutorial = true;
        this.tutorialStep = 0;

        // Time tracking
        this.lastTime = null;
        this.running = false;

        // Input
        this._bindInput();

        // Load saved memory
        try {
            const saved = localStorage.getItem('dungeonfolk_memory');
            if (saved) this.memory.deserialize(saved);
        } catch {}

        // Start the render loop
        this.running = true;
        requestAnimationFrame(t => this._loop(t));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Main loop
    // ──────────────────────────────────────────────────────────────────────────

    _loop(timestamp) {
        if (!this.running) return;
        if (this.lastTime === null) this.lastTime = timestamp;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;
        this._update(dt);
        this.renderer.render(this);
        requestAnimationFrame(t => this._loop(t));
    }

    _update(dt) {
        if (this.heartFlash > 0) this.heartFlash -= dt;
        if (this.heartShake > 0) this.heartShake -= dt;

        if (this.phase === 'menu') return;
        if (this.phase === 'gameover' || this.phase === 'victory') return;
        if (this.phase === 'upgrade') return;

        if (this.phase === 'prep') {
            this.prepTimer -= dt;
            this.passiveGoldAccum += (CONFIG.PASSIVE_GOLD_PER_SECOND + this.upgrades.passiveGold) * dt;
            while (this.passiveGoldAccum >= 1) {
                this.gold++;
                this.passiveGoldAccum -= 1;
            }
            if (this.prepTimer <= 0) {
                this._startWave();
            }
            return;
        }

        if (this.phase === 'wave') {
            // Passive gold during wave
            this.passiveGoldAccum += (CONFIG.PASSIVE_GOLD_PER_SECOND + this.upgrades.passiveGold) * dt;
            while (this.passiveGoldAccum >= 1) {
                this.gold++;
                this.passiveGoldAccum -= 1;
            }

            // Update wave spawn
            this.waveManager.update(dt, this);

            // Update monsters
            for (const m of this.monsters) {
                if (!m.dead) m.update(dt, this.heroes, this);
            }

            // Update heroes
            for (const h of this.heroes) {
                if (!h.dead) h.update(dt, this.monsters, this.heroes, this);
            }

            // Update traps
            for (const row of this.grid) {
                for (const cell of row) {
                    if (cell && cell instanceof Trap) {
                        cell.update(dt, this.heroes, this);
                    }
                }
            }

            // Update projectiles
            for (const p of this.projectiles) {
                if (!p.dead) p.update(dt);
            }

            // Update particles
            for (const p of this.particles) {
                if (!p.dead) p.update(dt);
            }

            // Update AOE effects
            for (const a of this.aoeEffects) {
                if (!a.dead) a.update(dt);
            }

            // Handle dead heroes
            for (const h of this.heroes) {
                if (h.dead && !h._counted) {
                    h._counted = true;
                    if (!h._reachedHeart) {
                        // Hero was defeated
                        const reward = h.reward + (this.upgrades.killBonus || 0);
                        this.gold += reward;
                        this.spawnParticle(h.x, h.y - 20, CONFIG.COLORS.gold, `+${reward}g`);
                        this.memory.heroDefeated(h);
                        this._saveMemory();
                    }
                }
            }

            // Handle dead monsters
            for (const m of this.monsters) {
                if (m.dead && !m._handled) {
                    m._handled = true;
                    // Only clear grid cell if this monster still occupies it
                    if (this.grid[m.row]?.[m.col] === m) {
                        this.grid[m.row][m.col] = null;
                    }

                    // Slime splits
                    if (m.id === 'slime' && !m.isMini) {
                        this._splitSlime(m);
                    }
                }
            }

            // Clean up dead entities
            this.monsters = this.monsters.filter(m => !m.dead);
            this.heroes = this.heroes.filter(h => !h.dead);
            this.projectiles = this.projectiles.filter(p => !p.dead);
            this.particles = this.particles.filter(p => !p.dead);
            this.aoeEffects = this.aoeEffects.filter(a => !a.dead);

            // Check wave complete
            if (this.waveManager.isWaveComplete(this.heroes)) {
                this._endWave();
            }

            // Game over check
            if (this.dungeonHeartHp <= 0) {
                this.dungeonHeartHp = 0;
                this.phase = 'gameover';
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Phase transitions
    // ──────────────────────────────────────────────────────────────────────────

    startGame() {
        this.phase = 'prep';
        this.wave = 0;
        this.prepTimer = CONFIG.PREP_TIME;
        this.showTutorial = true;
    }

    _startWave() {
        this.wave++;
        this.phase = 'wave';
        this.showTutorial = false;
        this.waveManager.startWave(this.wave, this.memory);
    }

    _endWave() {
        const reward = CONFIG.WAVE.WAVE_REWARD_BASE + this.wave * CONFIG.WAVE.WAVE_REWARD_PER_WAVE;
        this.gold += reward;
        this.spawnParticle(
            CONFIG.GRID_X + CONFIG.GRID_COLS * CONFIG.CELL_SIZE / 2,
            CONFIG.GRID_Y + CONFIG.GRID_ROWS * CONFIG.CELL_SIZE / 2,
            CONFIG.COLORS.gold,
            `Wave Clear! +${reward}g`
        );

        // Victory after wave 10
        if (this.wave >= 10) {
            this.phase = 'victory';
            return;
        }

        // Generate upgrade choices
        this._generateUpgrades();
        this.phase = 'upgrade';
    }

    _generateUpgrades() {
        const shuffled = [...CONFIG.UPGRADES].sort(() => Math.random() - 0.5);
        this.upgradeOptions = shuffled.slice(0, 3);
        this.selectedUpgrade = null;
    }

    selectUpgrade(index) {
        if (index < 0 || index >= this.upgradeOptions.length) return;
        const upg = this.upgradeOptions[index];
        this._applyUpgrade(upg);
        this.selectedUpgrade = index;
        // Brief pause then resume
        setTimeout(() => {
            this.phase = 'prep';
            this.prepTimer = CONFIG.PREP_TIME;
        }, 600);
    }

    _applyUpgrade(upg) {
        switch (upg.effect) {
            case 'passiveGold': this.upgrades.passiveGold += upg.value; break;
            case 'slots': this.upgrades.maxSlots += upg.value; break;
            case 'monsterDamage': this.upgrades.monsterDamage += upg.value; break;
            case 'monsterHealth': this.upgrades.monsterHealth += upg.value; break;
            case 'heartHeal':
                this.dungeonHeartHp = Math.min(CONFIG.DUNGEON_HEART_MAX_HP, this.dungeonHeartHp + upg.value);
                this.heartFlash = 0.5;
                break;
            case 'trapCooldown': this.upgrades.trapCooldown = Math.min(0.7, (this.upgrades.trapCooldown || 0) + upg.value); break;
            case 'slowBoost': this.upgrades.slowBoost += upg.value; break;
            case 'killBonus': this.upgrades.killBonus = (this.upgrades.killBonus || 0) + upg.value; break;
        }
    }

    skipUpgrade() {
        this.phase = 'prep';
        this.prepTimer = CONFIG.PREP_TIME;
        this.upgradeOptions = [];
    }

    startWaveEarly() {
        if (this.phase === 'prep') {
            this.prepTimer = 0;
        }
    }

    restartGame() {
        this.phase = 'menu';
        this.wave = 0;
        this.gold = CONFIG.STARTING_GOLD;
        this.dungeonHeartHp = CONFIG.DUNGEON_HEART_MAX_HP;
        this.prepTimer = CONFIG.PREP_TIME;
        this.passiveGoldAccum = 0;
        this.grid = Array.from({ length: CONFIG.GRID_ROWS }, () => Array(CONFIG.GRID_COLS).fill(null));
        this.monsters = [];
        this.heroes = [];
        this.projectiles = [];
        this.particles = [];
        this.aoeEffects = [];
        this.upgrades = { passiveGold: 0, monsterDamage: 0, monsterHealth: 0, trapCooldown: 0, slowBoost: 0, killBonus: 0, maxSlots: CONFIG.GRID_COLS * CONFIG.GRID_ROWS - CONFIG.DUNGEON_PATH.length };
        this.placedCount = 0;
        this.selectedUnit = null;
        this.waveManager = new WaveManager();
        this.heartFlash = 0;
        this.heartShake = 0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Spawning helpers
    // ──────────────────────────────────────────────────────────────────────────

    spawnProjectile(x, y, target, damage, color, style) {
        this.projectiles.push(new Projectile(x, y, target, damage, color, style));
    }

    spawnParticle(x, y, color, text, vx, vy, life) {
        this.particles.push(new Particle(x, y, color, text, vx, vy, life));
    }

    spawnAoe(x, y, radius, color) {
        this.aoeEffects.push(new AoeEffect(x, y, radius, color));
    }

    _splitSlime(m) {
        // Try to place 2 mini slimes in adjacent non-path cells
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let placed = 0;
        for (const [dc, dr] of offsets) {
            if (placed >= 2) break;
            const nc = m.col + dc;
            const nr = m.row + dr;
            if (nr < 0 || nr >= CONFIG.GRID_ROWS) continue;
            if (nc < 0 || nc >= CONFIG.GRID_COLS) continue;
            // Don't place on path or heart tiles
            if (CONFIG.PATH_SET.has(`${nc},${nr}`)) continue;
            if (nc === CONFIG.HEART_POS[0] && nr === CONFIG.HEART_POS[1]) continue;
            if (this.grid[nr][nc] !== null) continue;
            const mini = new MiniSlime(nc, nr, this.upgrades);
            this.grid[nr][nc] = mini;
            this.monsters.push(mini);
            this.spawnParticle(mini.x, mini.y - 30, '#66BB6A', '✨');
            placed++;
        }
    }

    heroDamagesHeart(hero) {
        hero._reachedHeart = true;
        const dmg = CONFIG.HEART_DAMAGE_PER_HERO * (hero.isBoss ? 3 : 1);
        this.dungeonHeartHp = Math.max(0, this.dungeonHeartHp - dmg);
        this.heartFlash = 0.6;
        this.heartShake = 0.4;
        this.memory.heroEscaped(hero);
        this._saveMemory();
        // Screen shake particles around heart position
        const heartCX = CONFIG.GRID_X + CONFIG.HEART_POS[0] * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const heartCY = CONFIG.GRID_Y + CONFIG.HEART_POS[1] * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        for (let i = 0; i < 8; i++) {
            this.spawnParticle(
                heartCX + (Math.random() - 0.5) * CONFIG.CELL_SIZE,
                heartCY + (Math.random() - 0.5) * CONFIG.CELL_SIZE,
                '#FF1744',
                '💔',
                (Math.random() - 0.5) * 120,
                -80 - Math.random() * 60,
                1.2
            );
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Placement
    // ──────────────────────────────────────────────────────────────────────────

    placeUnit(col, row) {
        if (!this.selectedUnit) return;
        if (col < 0 || col >= CONFIG.GRID_COLS || row < 0 || row >= CONFIG.GRID_ROWS) return;
        // Reject placement on path tiles
        if (CONFIG.PATH_SET.has(`${col},${row}`)) return;
        // Reject placement on heart tile
        if (col === CONFIG.HEART_POS[0] && row === CONFIG.HEART_POS[1]) return;
        if (this.grid[row][col] !== null) return;
        if (this.placedCount >= this.upgrades.maxSlots) return;

        const { id, isMonster } = this.selectedUnit;
        const cfgMap = isMonster ? CONFIG.MONSTERS : CONFIG.TRAPS;
        const cfg = cfgMap[id];
        if (!cfg) return;
        if (this.gold < cfg.cost) return;

        this.gold -= cfg.cost;
        this.placedCount++;

        let entity;
        if (isMonster) {
            entity = new Monster(col, row, cfg, this.upgrades);
            this.monsters.push(entity);
        } else {
            entity = new Trap(col, row, cfg);
        }
        this.grid[row][col] = entity;
        this.spawnParticle(entity.x, entity.y - 35, cfg.color, '✓');
    }

    removeUnit(col, row) {
        if (col < 0 || col >= CONFIG.GRID_COLS || row < 0 || row >= CONFIG.GRID_ROWS) return;
        const entity = this.grid[row][col];
        if (!entity) return;
        // Refund 50%
        const cfgMap = entity instanceof Monster ? CONFIG.MONSTERS : CONFIG.TRAPS;
        const cfg = cfgMap[entity.id];
        if (cfg) {
            const refund = Math.floor(cfg.cost * 0.5);
            this.gold += refund;
            this.spawnParticle(entity.x, entity.y - 30, CONFIG.COLORS.gold, `+${refund}g`);
        }
        this.grid[row][col] = null;
        if (entity instanceof Monster) {
            entity.dead = true;
        }
        this.placedCount = Math.max(0, this.placedCount - 1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Input
    // ──────────────────────────────────────────────────────────────────────────

    _bindInput() {
        this.canvas.addEventListener('click', e => this._onClick(e));
        this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
        this.canvas.addEventListener('contextmenu', e => {
            e.preventDefault();
            const { col, row } = this._getCell(e);
            if (col !== null) this.removeUnit(col, row);
        });
    }

    _getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CONFIG.CANVAS_WIDTH / rect.width;
        const scaleY = CONFIG.CANVAS_HEIGHT / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    _getCell(e) {
        const { x, y } = this._getCanvasPos(e);
        const col = Math.floor((x - CONFIG.GRID_X) / CONFIG.CELL_SIZE);
        const row = Math.floor((y - CONFIG.GRID_Y) / CONFIG.CELL_SIZE);
        if (col < 0 || col >= CONFIG.GRID_COLS || row < 0 || row >= CONFIG.GRID_ROWS) {
            return { col: null, row: null, x, y };
        }
        return { col, row, x, y };
    }

    _onClick(e) {
        const { x, y } = this._getCanvasPos(e);
        e.preventDefault();

        // Menu
        if (this.phase === 'menu') {
            // Start button area
            if (x > 480 && x < 720 && y > 340 && y < 400) {
                this.startGame();
            }
            return;
        }

        // Game over
        if (this.phase === 'gameover' || this.phase === 'victory') {
            if (x > 480 && x < 720 && y > 420 && y < 480) {
                this.restartGame();
            }
            return;
        }

        // Upgrade selection
        if (this.phase === 'upgrade') {
            const btnY = 340;
            const btnH = 130;
            const totalW = 3 * 240 + 2 * 20;
            const startX = (CONFIG.CANVAS_WIDTH - totalW) / 2;
            for (let i = 0; i < this.upgradeOptions.length; i++) {
                const bx = startX + i * (240 + 20);
                if (x >= bx && x <= bx + 240 && y >= btnY && y <= btnY + btnH) {
                    this.selectUpgrade(i);
                    return;
                }
            }
            // Skip button
            if (x > 540 && x < 660 && y > 490 && y < 530) {
                this.skipUpgrade();
            }
            return;
        }

        // Bottom UI panel: unit cards
        if (y >= CONFIG.BOTTOM_PANEL_Y) {
            this._handleUIPanelClick(x, y);
            return;
        }

        // Grid click: place/select
        const { col, row } = this._getCell(e);
        if (col === null) return;

        if (this.phase === 'prep' || this.phase === 'wave') {
            this.placeUnit(col, row);
        }
    }

    _handleUIPanelClick(x, y) {
        const cardY = CONFIG.BOTTOM_PANEL_Y + 10;
        const cardW = CONFIG.UNIT_CARD_W;
        const cardH = CONFIG.UNIT_CARD_H;
        const cardStride = cardW + CONFIG.UNIT_CARD_MARGIN;

        // Monster cards (startX=20)
        const monsterKeys = Object.keys(CONFIG.MONSTERS);
        for (let i = 0; i < monsterKeys.length; i++) {
            const cx = 20 + i * cardStride;
            if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
                const id = monsterKeys[i];
                this.selectedUnit = (this.selectedUnit?.id === id && this.selectedUnit?.isMonster)
                    ? null : { id, isMonster: true };
                return;
            }
        }

        // Trap cards (startX = 20 + monsters + 25px gap)
        const trapStartX = 20 + monsterKeys.length * cardStride + 25;
        const trapKeys = Object.keys(CONFIG.TRAPS);
        for (let i = 0; i < trapKeys.length; i++) {
            const cx = trapStartX + i * cardStride;
            if (x >= cx && x <= cx + cardW && y >= cardY && y <= cardY + cardH) {
                const id = trapKeys[i];
                this.selectedUnit = (this.selectedUnit?.id === id && !this.selectedUnit?.isMonster)
                    ? null : { id, isMonster: false };
                return;
            }
        }

        // Start wave early button (x=1055, y=panelY+20)
        if (this.phase === 'prep') {
            const btnX = 1055;
            const btnY = CONFIG.BOTTOM_PANEL_Y + 20;
            if (x >= btnX && x <= btnX + 135 && y >= btnY && y <= btnY + 50) {
                this.startWaveEarly();
            }
        }
    }

    _onMouseMove(e) {
        const { col, row } = this._getCell(e);
        this.hoveredCell = (col !== null) ? { col, row } : null;
    }

    _saveMemory() {
        try {
            localStorage.setItem('dungeonfolk_memory', this.memory.serialize());
        } catch {}
    }
}
