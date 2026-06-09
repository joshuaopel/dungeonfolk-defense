// All game entity classes: Monster, Hero, Trap, Projectile, Particle

class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.dead = false;
    }
    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// ─── Monster ──────────────────────────────────────────────────────────────────

class Monster extends Entity {
    constructor(col, row, cfg, gameUpgrades) {
        const x = CONFIG.GRID_X + col * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const y = CONFIG.GRID_Y + row * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        super(x, y);
        this.col = col;
        this.row = row;
        this.cfg = cfg;
        this.id = cfg.id;

        // Apply upgrade multipliers
        const dmgMult = 1 + (gameUpgrades?.monsterDamage || 0);
        const hpMult = 1 + (gameUpgrades?.monsterHealth || 0);

        this.maxHp = Math.floor(cfg.maxHp * hpMult);
        this.hp = this.maxHp;
        this.attack = cfg.attack * dmgMult;
        this.attackSpeed = cfg.attackSpeed;
        this.rangePixels = cfg.rangePixels;
        this.attackTimer = 0;
        this.target = null;

        // Mimic special state
        this.disguised = !!cfg.disguised;
        this.disguiseRevealTimer = 0;

        // Visual
        this.shakeX = 0;
        this.shakeTimer = 0;
        this.flashTimer = 0;
        this.scale = 1;
        this.spawnScale = 0.1;
        this.spawnTimer = 0.4;

        // Armor reduces incoming damage
        this.armor = cfg.armor || 0;

        // For ghosts: tracks which hero it's floating toward
        this.ghostTarget = null;
        this.ghostX = x;
        this.ghostY = y;
    }

    update(dt, heroes, game) {
        // Spawn animation
        if (this.spawnTimer > 0) {
            this.spawnTimer -= dt;
            this.spawnScale = Math.min(1, 1 - this.spawnTimer / 0.4 + 0.01);
        }

        // Screen shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * 4;
        } else {
            this.shakeX = 0;
        }

        // Flash timer
        if (this.flashTimer > 0) this.flashTimer -= dt;

        // Attack cooldown
        if (this.attackTimer > 0) this.attackTimer -= dt;

        // Mimic reveal timer
        if (this.disguised && this.disguiseRevealTimer > 0) {
            this.disguiseRevealTimer -= dt;
            if (this.disguiseRevealTimer <= 0) this.disguised = false;
        }

        // Ghost special: find and move toward priority targets
        if (this.cfg.phasing) {
            this._updateGhost(dt, heroes, game);
            return;
        }

        // Find target in same row
        this.target = this._findTarget(heroes);

        // Mimic reveal: if hero is close enough, reveal and attack
        if (this.disguised && this.target && this.distanceTo(this.target) < this.rangePixels * 0.8) {
            this.disguised = false;
            // Burst attack
            if (this.attackTimer <= 0) {
                this._doAttack(this.target, game);
            }
        }

        if (this.target && !this.target.dead && this.attackTimer <= 0) {
            this._doAttack(this.target, game);
        }
    }

    _findTarget(heroes) {
        let closest = null;
        let closestDist = this.rangePixels;
        for (const h of heroes) {
            if (h.dead) continue;
            // No lane restriction — attack any hero within range
            const dist = this.distanceTo(h);
            if (dist < closestDist) {
                closestDist = dist;
                closest = h;
            }
        }
        return closest;
    }

    _updateGhost(dt, heroes, game) {
        // Find priority target or nearest in lane
        let priorityTarget = null;
        for (const h of heroes) {
            if (h.dead) continue;
            if (this.cfg.priorityTargets && this.cfg.priorityTargets.includes(h.heroType)) {
                if (!priorityTarget || this.distanceTo(h) < this.distanceTo(priorityTarget)) {
                    priorityTarget = h;
                }
            }
        }
        if (!priorityTarget) {
            // Find any hero
            for (const h of heroes) {
                if (!h.dead && (!priorityTarget || this.distanceTo(h) < this.distanceTo(priorityTarget))) {
                    priorityTarget = h;
                }
            }
        }
        this.target = priorityTarget;

        if (this.target && this.attackTimer <= 0) {
            if (this.distanceTo(this.target) <= this.rangePixels) {
                this._doAttack(this.target, game);
            }
        }
    }

    _doAttack(target, game) {
        this.attackTimer = 1 / this.attackSpeed;
        if (this.cfg.ranged) {
            game.spawnProjectile(this.x, this.y, target, this.attack, '#E8E8E8', 'arrow');
        } else {
            const dmg = Math.max(1, this.attack - (target.armor || 0));
            target.takeDamage(dmg);
            if (this.cfg.id === 'batSwarm') target.distracted = 0.8; // stun briefly
            game.spawnParticle(target.x, target.y, this.cfg.color, dmg);
        }
    }

    takeDamage(amount) {
        const actual = Math.max(1, amount - this.armor);
        this.hp -= actual;
        this.flashTimer = 0.15;
        this.shakeTimer = 0.1;
        this.shakeX = (Math.random() - 0.5) * 6;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }

    get displayX() { return this.x + this.shakeX; }
    get displayY() { return this.y; }
    get hpPercent() { return this.hp / this.maxHp; }
}

// Mini slime (slime split offspring)
class MiniSlime extends Monster {
    constructor(col, row, gameUpgrades) {
        const miniCfg = {
            id: 'miniSlime', name: 'Mini Slime', emoji: '🫧',
            color: '#66BB6A', cellTint: 'rgba(102,187,106,0.2)',
            armor: 0, disguised: false, phasing: false, ranged: false,
            ...CONFIG.MINI_SLIME,
            attackSpeed: CONFIG.MINI_SLIME.attackSpeed,
        };
        super(col, row, miniCfg, gameUpgrades);
        this.isMini = true;
    }
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

class Hero extends Entity {
    constructor(cfg, waveNum) {
        // Start just off-screen to the left of path entry point
        const startPos = CONFIG.DUNGEON_PATH[0];
        const x = CONFIG.GRID_X + startPos[0] * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 - CONFIG.CELL_SIZE;
        const y = CONFIG.GRID_Y + startPos[1] * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        super(x, y);
        this.heroType = cfg.id;
        this.cfg = cfg;
        this.name = cfg.name;
        this.isBoss = cfg.isBoss || false;

        const hpScale = 1 + (waveNum - 1) * CONFIG.WAVE.HP_SCALE_PER_WAVE;
        const atkScale = 1 + (waveNum - 1) * CONFIG.WAVE.ATTACK_SCALE_PER_WAVE;

        this.maxHp = Math.floor(cfg.hp * hpScale);
        this.hp = this.maxHp;
        this.attack = cfg.attack * atkScale;
        this.baseSpeed = cfg.speed;
        this.speed = cfg.speed;
        this.rangePixels = cfg.rangePixels;
        this.attackSpeed = cfg.attackSpeed;
        this.attackTimer = 0;
        this.target = null;
        this.reward = cfg.reward;
        this.armor = 0;

        // Path progress: -0.5 means just entering (one step before index 0)
        this.pathProgress = -0.5;

        // Hero state
        this.slowed = 0;        // seconds remaining
        this.slowAmount = 0;
        this.distracted = 0;    // bat swarm daze duration
        this.stopped = 0;       // treasure chest stop timer
        this.buffed = 0;        // paladin buff remaining
        this.buffAmount = 0;
        this.flashTimer = 0;
        this.shakeX = 0;
        this.shakeTimer = 0;

        // Memory tracking
        this.instanceId = `${cfg.id}_${Date.now()}_${Math.random().toFixed(4)}`;
        this.deathCount = 0;
        this.memorized = false; // set by memory system

        // Cleric heal timer
        this.healTimer = 0;
    }

    // Returns world {x, y} for a given path progress value (supports interpolation)
    getPathWorldPos(progress) {
        const PATH = CONFIG.DUNGEON_PATH;
        const S = CONFIG.CELL_SIZE;
        const GX = CONFIG.GRID_X;
        const GY = CONFIG.GRID_Y;

        if (progress <= 0) {
            // Interpolate from just before path start to path[0]
            const [c0, r0] = PATH[0];
            const tx = GX + c0 * S + S / 2;
            const ty = GY + r0 * S + S / 2;
            // Approach from the left (west)
            const ox = tx - S;
            const oy = ty;
            const t = Math.max(0, progress + 0.5) / 0.5;
            return { x: ox + (tx - ox) * t, y: oy + (ty - oy) * t };
        }

        const maxIdx = PATH.length - 1;
        if (progress >= maxIdx) {
            const [c, r] = PATH[maxIdx];
            return { x: GX + c * S + S / 2, y: GY + r * S + S / 2 };
        }

        const i = Math.floor(progress);
        const frac = progress - i;
        const [c1, r1] = PATH[i];
        const [c2, r2] = PATH[i + 1];
        return {
            x: GX + (c1 + (c2 - c1) * frac) * S + S / 2,
            y: GY + (r1 + (r2 - r1) * frac) * S + S / 2,
        };
    }

    update(dt, monsters, heroes, game) {
        if (this.dead) return;

        // Timers
        if (this.attackTimer > 0) this.attackTimer -= dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        if (this.distracted > 0) { this.distracted -= dt; return; }
        if (this.stopped > 0) { this.stopped -= dt; return; }
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * 3;
        } else { this.shakeX = 0; }

        // Apply slow
        this.speed = this.baseSpeed;
        if (this.slowed > 0) {
            this.slowed -= dt;
            this.speed = this.baseSpeed * (1 - this.slowAmount);
        }
        // Apply paladin buff speed bonus
        if (this.buffed > 0) this.buffed -= dt;

        // Cleric: heal nearby allies
        if (this.heroType === 'cleric') {
            this.healTimer -= dt;
            if (this.healTimer <= 0) {
                this.healTimer = 1 / this.cfg.healSpeed;
                for (const h of heroes) {
                    if (!h.dead && h !== this && this.distanceTo(h) < this.cfg.healRadius) {
                        h.hp = Math.min(h.maxHp, h.hp + this.cfg.healAmount);
                        game.spawnParticle(h.x, h.y - 20, '#FFF176', '♥');
                    }
                }
            }
        }

        // Paladin: buff nearby allies
        if (this.heroType === 'paladin') {
            for (const h of heroes) {
                if (!h.dead && h !== this && this.distanceTo(h) < this.cfg.buffRadius) {
                    h.buffed = 0.5;
                    h.buffAmount = this.cfg.buffAmount;
                }
            }
        }

        // Find monster target (any monster within range, no lane restriction)
        this.target = this._findTarget(monsters);

        if (this.target && !this.target.dead) {
            // Attack if in range and timer ready
            if (this.attackTimer <= 0 && this.distanceTo(this.target) <= this.rangePixels) {
                this._doAttack(game);
            }
            // Melee heroes stop advancing when a melee monster is in range
            // rangePixels <= 110 means melee; stop when close enough to fight
            if (this.rangePixels <= 110 && this.distanceTo(this.target) < this.rangePixels * 1.4) {
                return;
            }
        }

        // Advance along path
        this.pathProgress += this.speed / CONFIG.CELL_SIZE * dt;

        // Sync x/y from path progress
        const pos = this.getPathWorldPos(this.pathProgress);
        this.x = pos.x;
        this.y = pos.y;

        // Check if hero reached dungeon heart (end of path)
        if (this.pathProgress >= CONFIG.DUNGEON_PATH.length - 1) {
            game.heroDamagesHeart(this);
            this.dead = true;
        }
    }

    _findTarget(monsters) {
        let best = null;
        let bestDist = Infinity;
        for (const m of monsters) {
            if (m.dead) continue;
            // No lane restriction — target any monster within range
            const dist = this.distanceTo(m);
            if (dist <= this.rangePixels && dist < bestDist) {
                bestDist = dist;
                best = m;
            }
        }
        return best;
    }

    _doAttack(game) {
        this.attackTimer = 1 / this.attackSpeed;
        const target = this.target;
        if (!target || target.dead) return;

        let dmg = this.attack;
        if (this.buffed > 0) dmg *= (1 + this.buffAmount);

        // Wizard AOE
        if (this.cfg.aoeRadius) {
            for (const m of game.monsters) {
                if (!m.dead && this.distanceTo(m) < this.cfg.aoeRadius) {
                    m.takeDamage(dmg * 0.6);
                    game.spawnParticle(m.x, m.y, '#FF80AB', Math.floor(dmg * 0.6));
                }
            }
            game.spawnAoe(this.x, this.y, this.cfg.aoeRadius, '#FF80AB');
        } else if (this.rangePixels > 130) {
            // Ranged hero — shoot projectile
            game.spawnProjectile(this.x, this.y, target, dmg, this.cfg.color, 'arrow');
        } else {
            target.takeDamage(dmg);
            game.spawnParticle(target.x, target.y, this.cfg.color, Math.floor(dmg));
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.flashTimer = 0.12;
        this.shakeX = (Math.random() - 0.5) * 4;
        this.shakeTimer = 0.08;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
    }

    applySlow(amount, duration) {
        this.slowed = duration;
        this.slowAmount = Math.max(this.slowAmount, amount);
    }

    get displayX() { return this.x + this.shakeX; }
    get displayY() { return this.y; }
    get hpPercent() { return this.hp / this.maxHp; }
    get col() { return Math.floor((this.x - CONFIG.GRID_X) / CONFIG.CELL_SIZE); }
    get row() { return Math.floor((this.y - CONFIG.GRID_Y) / CONFIG.CELL_SIZE); }
}

// ─── Trap ─────────────────────────────────────────────────────────────────────

class Trap extends Entity {
    constructor(col, row, cfg) {
        const x = CONFIG.GRID_X + col * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        const y = CONFIG.GRID_Y + row * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
        super(x, y);
        this.col = col;
        this.row = row;
        this.cfg = cfg;
        this.id = cfg.id;
        this.cooldownTimer = 0;
        this.active = true;
        this.triggerFlash = 0;
        this.spawnTimer = 0.3;
    }

    get ready() { return this.cooldownTimer <= 0; }

    update(dt, heroes, game) {
        if (this.spawnTimer > 0) { this.spawnTimer -= dt; return; }
        if (this.triggerFlash > 0) this.triggerFlash -= dt;
        if (this.cooldownTimer > 0) { this.cooldownTimer -= dt; return; }

        // Cursor totem: passive slow aura
        if (this.id === 'curseTotem') {
            const slowAmt = this.cfg.slowAmount * (1 + (game.upgrades?.slowBoost || 0));
            for (const h of heroes) {
                if (!h.dead && this.distanceTo(h) < this.cfg.slowRadius) {
                    h.applySlow(slowAmt, 0.5);
                }
            }
            return;
        }

        for (const h of heroes) {
            if (h.dead) continue;

            if (this.id === 'treasureChest') {
                // Trigger when hero passes within half-cell distance
                if (this.distanceTo(h) < CONFIG.CELL_SIZE * 0.65) {
                    h.stopped = this.cfg.stopDuration;
                    this.cooldownTimer = 15;
                    this.triggerFlash = 0.5;
                    game.spawnParticle(this.x, this.y - 30, '#FFD700', '💰');
                }
                continue;
            }

            if (this.id === 'spikeTrap') {
                // Trigger when hero steps onto trap cell
                if (this.distanceTo(h) < CONFIG.CELL_SIZE * 0.65) {
                    if (!h.cfg?.trapImmune) {
                        h.takeDamage(this.cfg.damage);
                        game.spawnParticle(h.x, h.y, '#F44336', this.cfg.damage);
                        this.cooldownTimer = this.cfg.cooldown * (1 - (game.upgrades.trapCooldown || 0));
                        this.triggerFlash = 0.4;
                    }
                }
                continue;
            }

            if (this.id === 'fallingChandelier') {
                if (this.distanceTo(h) < this.cfg.aoeRadius) {
                    let hit = false;
                    for (const target of heroes) {
                        if (!target.dead && this.distanceTo(target) < this.cfg.aoeRadius) {
                            target.takeDamage(this.cfg.damage);
                            game.spawnParticle(target.x, target.y, '#FFC107', this.cfg.damage);
                            hit = true;
                        }
                    }
                    if (hit) {
                        game.spawnAoe(this.x, this.y, this.cfg.aoeRadius, '#FFC107');
                        this.cooldownTimer = this.cfg.cooldown * (1 - (game.upgrades.trapCooldown || 0));
                        this.triggerFlash = 0.5;
                    }
                    break; // only trigger once per cooldown cycle
                }
            }
        }
    }

    get hpPercent() { return 1; } // traps don't take damage
}

// ─── Projectile ───────────────────────────────────────────────────────────────

class Projectile extends Entity {
    constructor(x, y, target, damage, color, style) {
        super(x, y);
        this.target = target;
        this.damage = damage;
        this.color = color;
        this.style = style; // 'arrow' or 'magic'
        this.speed = style === 'arrow' ? 420 : 320;
        this.r = style === 'arrow' ? 4 : 6;
        this.hit = false;
    }

    update(dt) {
        if (this.hit || !this.target || this.target.dead) { this.dead = true; return; }
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 12) {
            this.target.takeDamage(this.damage);
            this.dead = true;
            this.hit = true;
            return;
        }
        const speed = this.speed * dt;
        this.x += (dx / dist) * speed;
        this.y += (dy / dist) * speed;
    }
}

// ─── Particle ─────────────────────────────────────────────────────────────────

class Particle extends Entity {
    constructor(x, y, color, text, vx, vy, life) {
        super(x, y);
        this.color = color;
        this.text = String(text);
        this.vx = vx ?? (Math.random() - 0.5) * 60;
        this.vy = vy ?? -60 - Math.random() * 40;
        this.life = life ?? 1.0;
        this.maxLife = this.life;
        this.alpha = 1;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) { this.dead = true; return; }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 20 * dt; // gravity
        this.alpha = this.life / this.maxLife;
    }
}

// ─── AOE effect ───────────────────────────────────────────────────────────────

class AoeEffect extends Entity {
    constructor(x, y, radius, color) {
        super(x, y);
        this.radius = radius;
        this.color = color;
        this.life = 0.45;
        this.maxLife = 0.45;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }

    get alpha() { return (this.life / this.maxLife) * 0.5; }
    get currentRadius() { return this.radius * (1 - this.life / this.maxLife) + this.radius * 0.3; }
}
