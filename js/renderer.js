// All canvas rendering — grid, entities, UI, effects, overlays

class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.time = 0; // accumulates for animations
    }

    render(game) {
        this.time += 0.016;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        if (game.phase === 'menu') {
            this._drawMenu(game);
            return;
        }

        this._drawBackground(game);
        this._drawGrid(game);
        this._drawAoeEffects(game);
        this._drawMonsters(game);
        this._drawHeroes(game);
        this._drawProjectiles(game);
        this._drawParticles(game);
        this._drawUI(game);

        if (game.phase === 'upgrade') this._drawUpgradeOverlay(game);
        if (game.phase === 'gameover') this._drawGameOver(game);
        if (game.phase === 'victory') this._drawVictory(game);
    }

    // ─── Background ──────────────────────────────────────────────────────────

    _drawBackground(game) {
        const ctx = this.ctx;
        const C = CONFIG.COLORS;

        // Deep dungeon bg
        const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        grad.addColorStop(0, '#0d0820');
        grad.addColorStop(1, '#120e2a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Bottom panel bg
        ctx.fillStyle = C.uiBg;
        ctx.fillRect(0, CONFIG.BOTTOM_PANEL_Y, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT - CONFIG.BOTTOM_PANEL_Y);
        ctx.strokeStyle = C.uiBorder;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, CONFIG.BOTTOM_PANEL_Y);
        ctx.lineTo(CONFIG.CANVAS_WIDTH, CONFIG.BOTTOM_PANEL_Y);
        ctx.stroke();
    }

    // ─── Grid ────────────────────────────────────────────────────────────────

    _drawGrid(game) {
        const ctx = this.ctx;
        const C = CONFIG.COLORS;
        const S = CONFIG.CELL_SIZE;

        for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
            for (let col = 0; col < CONFIG.GRID_COLS; col++) {
                const cx = CONFIG.GRID_X + col * S;
                const cy = CONFIG.GRID_Y + row * S;

                // Cell base color — checkerboard subtle variation
                if (col === CONFIG.ENTRANCE_COL) {
                    ctx.fillStyle = C.entrance;
                } else if (col === CONFIG.HEART_COL) {
                    // Heart pulsing tint
                    const pulse = (Math.sin(this.time * 2.5) * 0.5 + 0.5) * 0.15;
                    ctx.fillStyle = `rgba(180, 30, 80, ${0.3 + pulse})`;
                } else {
                    ctx.fillStyle = (col + row) % 2 === 0 ? C.cellDark : C.cellLight;
                }
                ctx.fillRect(cx, cy, S, S);

                // Cell tint for placed entity
                const cell = game.grid[row][col];
                if (cell) {
                    const tint = cell.cfg?.cellTint;
                    if (tint) {
                        ctx.fillStyle = tint;
                        ctx.fillRect(cx, cy, S, S);
                    }
                }

                // Hover highlight
                if (game.hoveredCell && game.hoveredCell.col === col && game.hoveredCell.row === row) {
                    if (!cell && col >= CONFIG.MIN_PLACE_COL && col <= CONFIG.MAX_PLACE_COL) {
                        if (game.selectedUnit) {
                            const cfgMap = game.selectedUnit.isMonster ? CONFIG.MONSTERS : CONFIG.TRAPS;
                            const cfg = cfgMap[game.selectedUnit.id];
                            const canAfford = game.gold >= cfg.cost;
                            ctx.fillStyle = canAfford ? 'rgba(100,255,100,0.18)' : 'rgba(255,80,80,0.18)';
                        } else {
                            ctx.fillStyle = 'rgba(255,255,255,0.08)';
                        }
                        ctx.fillRect(cx, cy, S, S);
                    }
                }

                // Grid border
                ctx.strokeStyle = C.cellBorder;
                ctx.lineWidth = 1;
                ctx.strokeRect(cx, cy, S, S);
            }
        }

        // Entrance label
        ctx.save();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#4a7a4a';
        ctx.textAlign = 'center';
        ctx.fillText('ENTRANCE', CONFIG.GRID_X + CONFIG.CELL_SIZE / 2, CONFIG.GRID_Y - 4);
        // Lane arrows (heroes move left to right)
        for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
            const ay = CONFIG.GRID_Y + row * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2;
            ctx.fillStyle = 'rgba(100,180,100,0.35)';
            ctx.font = '18px sans-serif';
            ctx.fillText('→', CONFIG.GRID_X + CONFIG.CELL_SIZE / 2, ay + 6);
        }
        ctx.restore();

        // Dungeon Heart column
        this._drawDungeonHeart(game);

        // Entrance arch decoration
        this._drawEntrance();
    }

    _drawEntrance() {
        const ctx = this.ctx;
        const ex = CONFIG.GRID_X;
        const ey = CONFIG.GRID_Y;
        const h = CONFIG.GRID_ROWS * CONFIG.CELL_SIZE;
        const w = CONFIG.CELL_SIZE;

        // Arch frame
        ctx.strokeStyle = '#3a6a3a';
        ctx.lineWidth = 3;
        ctx.strokeRect(ex, ey, w, h);

        // "Dungeon Entrance" decorative text
        ctx.save();
        ctx.translate(ex + w / 2, ey + h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#4a7a4a';
        ctx.textAlign = 'center';
        ctx.fillText('DUNGEON ENTRANCE', 0, 0);
        ctx.restore();
    }

    _drawDungeonHeart(game) {
        const ctx = this.ctx;
        const S = CONFIG.CELL_SIZE;
        const heartX = CONFIG.GRID_X + CONFIG.HEART_COL * S;
        const heartY = CONFIG.GRID_Y;
        const heartH = CONFIG.GRID_ROWS * S;

        // Heart column background
        const shakeX = game.heartShake > 0 ? (Math.random() - 0.5) * 6 : 0;

        // Full column fill
        ctx.fillStyle = 'rgba(120,10,50,0.4)';
        ctx.fillRect(heartX + shakeX, heartY, S, heartH);

        // Border
        ctx.strokeStyle = '#8a1a5a';
        ctx.lineWidth = 3;
        ctx.strokeRect(heartX + shakeX, heartY, S, heartH);

        // Heart HP bar (vertical)
        const pct = game.dungeonHeartHp / CONFIG.DUNGEON_HEART_MAX_HP;
        const barH = heartH - 20;
        const barFill = barH * pct;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(heartX + 12 + shakeX, heartY + 10, S - 24, barH);
        const hpColor = pct > 0.5 ? '#E91E63' : pct > 0.25 ? '#FF5722' : '#B71C1C';
        ctx.fillStyle = hpColor;
        ctx.fillRect(heartX + 12 + shakeX, heartY + 10 + barH - barFill, S - 24, barFill);

        // Heart emoji — pulsing
        const pulse = 1 + Math.sin(this.time * 3) * 0.08;
        const flash = game.heartFlash > 0 ? 0.9 : 1;
        ctx.save();
        ctx.translate(heartX + S / 2 + shakeX, heartY + heartH / 2);
        ctx.scale(pulse * flash, pulse * flash);
        ctx.font = '36px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (game.heartFlash > 0) {
            ctx.globalAlpha = 0.6 + 0.4 * (game.heartFlash % 0.2) / 0.2;
        }
        ctx.fillText('❤️', 0, 0);
        ctx.restore();

        // HP text
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#ff6090';
        ctx.textAlign = 'center';
        ctx.fillText(`${game.dungeonHeartHp}`, heartX + S / 2 + shakeX, heartY + heartH - 6);

        // Label
        ctx.save();
        ctx.translate(heartX + S / 2, heartY - 4);
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#8a1a5a';
        ctx.textAlign = 'center';
        ctx.fillText('HEART', 0, 0);
        ctx.restore();
    }

    // ─── Entities ────────────────────────────────────────────────────────────

    _drawMonsters(game) {
        const ctx = this.ctx;
        for (const m of game.monsters) {
            if (m.dead) continue;
            const s = m.spawnScale ?? 1;
            ctx.save();
            ctx.translate(m.displayX, m.displayY);
            ctx.scale(s, s);

            // Flash white on damage
            if (m.flashTimer > 0) {
                ctx.globalAlpha = 0.5 + 0.5 * (m.flashTimer / 0.15);
            }

            // Draw emoji
            ctx.font = m.isMini ? '28px serif' : '42px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (m.cfg.disguised && m.disguised) {
                // Show as treasure chest
                ctx.fillText('📦', 0, 0);
            } else {
                ctx.fillText(m.cfg.emoji, 0, 0);
            }

            // Ghost: ethereal glow
            if (m.cfg.phasing) {
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#80DEEA';
                ctx.beginPath();
                ctx.arc(0, 0, 28, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.restore();

            // HP bar
            this._drawHealthBar(m, CONFIG.CELL_SIZE * 0.75, false);
        }
    }

    _drawHeroes(game) {
        const ctx = this.ctx;
        for (const h of game.heroes) {
            if (h.dead) continue;
            ctx.save();
            ctx.translate(h.displayX, h.displayY);

            // Flash
            if (h.flashTimer > 0) ctx.globalAlpha = 0.6;

            // Boss: larger and glowing
            if (h.isBoss) {
                ctx.save();
                const glow = (Math.sin(this.time * 4) * 0.5 + 0.5) * 0.4;
                ctx.shadowColor = h.cfg.color;
                ctx.shadowBlur = 15 + glow * 10;
                ctx.font = '40px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(h.cfg.emoji, 0, 0);
                ctx.restore();
            } else {
                ctx.font = '30px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(h.cfg.emoji, 0, 0);
            }

            // Slowed indicator
            if (h.slowed > 0) {
                ctx.globalAlpha = 0.6;
                ctx.font = '16px serif';
                ctx.fillText('🌀', 14, -14);
            }

            // Buff indicator
            if (h.buffed > 0) {
                ctx.globalAlpha = 0.8;
                ctx.font = '14px serif';
                ctx.fillText('⚡', -14, -14);
            }

            ctx.restore();

            // HP bar above hero
            this._drawHealthBar(h, 50, true);

            // Name tag for notable heroes (bosses + multi-death veterans)
            if (h.isBoss || h.deathCount >= 2) {
                ctx.save();
                ctx.font = h.isBoss ? 'bold 11px sans-serif' : '10px sans-serif';
                ctx.fillStyle = h.isBoss ? h.cfg.color : '#ccc';
                ctx.textAlign = 'center';
                ctx.fillText(h.displayName || h.name, h.x, h.y - 28);
                ctx.restore();
            }
        }
    }

    _drawHealthBar(entity, width, isHero) {
        const ctx = this.ctx;
        const barW = width;
        const barH = isHero ? 5 : 6;
        const bx = entity.displayX - barW / 2;
        const by = isHero ? entity.displayY - (entity.isBoss ? 30 : 22) : entity.displayY - 30;
        const pct = entity.hpPercent;

        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx, by, barW, barH);

        // Bar color
        let barColor;
        if (pct > 0.6) barColor = CONFIG.COLORS.healthFull;
        else if (pct > 0.3) barColor = CONFIG.COLORS.healthMid;
        else barColor = CONFIG.COLORS.healthLow;

        ctx.fillStyle = barColor;
        ctx.fillRect(bx, by, barW * pct, barH);

        // Border
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);
    }

    // ─── Projectiles & Effects ────────────────────────────────────────────────

    _drawProjectiles(game) {
        const ctx = this.ctx;
        for (const p of game.projectiles) {
            if (p.dead) continue;
            ctx.save();
            ctx.translate(p.x, p.y);
            if (p.style === 'arrow') {
                // Arrow: direction line
                if (p.target && !p.target.dead) {
                    const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                    ctx.rotate(angle);
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-8, 0);
                    ctx.lineTo(8, 0);
                    ctx.stroke();
                    // Arrowhead
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.moveTo(8, 0);
                    ctx.lineTo(2, -3);
                    ctx.lineTo(2, 3);
                    ctx.closePath();
                    ctx.fill();
                }
            } else {
                // Magic orb
                ctx.beginPath();
                ctx.arc(0, 0, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = 0.85;
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    _drawAoeEffects(game) {
        const ctx = this.ctx;
        for (const a of game.aoeEffects) {
            if (a.dead) continue;
            ctx.save();
            ctx.globalAlpha = a.alpha;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = a.color;
            ctx.fill();
            ctx.strokeStyle = a.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }
    }

    _drawParticles(game) {
        const ctx = this.ctx;
        for (const p of game.particles) {
            if (p.dead) continue;
            ctx.save();
            ctx.globalAlpha = p.alpha;

            if (/[\u{1F300}-\u{1FFFF}]/u.test(p.text) || p.text.match(/[♥💰✓⚡!]/)) {
                // Emoji/symbol particle
                ctx.font = '18px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(p.text, p.x, p.y);
            } else {
                // Damage number
                ctx.font = `bold ${12 + Math.floor(p.text.length > 3 ? 0 : 4)}px sans-serif`;
                ctx.fillStyle = p.color;
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = 3;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeText(p.text, p.x, p.y);
                ctx.fillText(p.text, p.x, p.y);
            }
            ctx.restore();
        }
    }

    // ─── UI ──────────────────────────────────────────────────────────────────

    _drawUI(game) {
        const ctx = this.ctx;
        const C = CONFIG.COLORS;
        const panelY = CONFIG.BOTTOM_PANEL_Y;

        // ── Top HUD bar ──
        this._drawHUD(game);

        // ── Unit selection cards ──
        const cardW = CONFIG.UNIT_CARD_W;    // 76px
        const cardH = CONFIG.UNIT_CARD_H;    // 90px
        const cardMargin = CONFIG.UNIT_CARD_MARGIN; // 5px
        const cardStride = cardW + cardMargin;       // 81px
        const cardY = panelY + 10;

        // Monster section
        let startX = 20;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'left';
        ctx.fillText('MONSTERS', startX, cardY - 2);

        const monsterKeys = Object.keys(CONFIG.MONSTERS);
        for (let i = 0; i < monsterKeys.length; i++) {
            const id = monsterKeys[i];
            const cfg = CONFIG.MONSTERS[id];
            const cx = startX + i * cardStride;
            const isSelected = game.selectedUnit?.id === id && game.selectedUnit?.isMonster;
            this._drawUnitCard(cfg, cx, cardY, cardW, cardH, isSelected, game.gold >= cfg.cost);
        }

        // Trap section — starts after monsters + 25px gap
        const trapStartX = startX + monsterKeys.length * cardStride + 25;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'left';
        ctx.fillText('TRAPS', trapStartX, cardY - 2);

        const trapKeys = Object.keys(CONFIG.TRAPS);
        for (let i = 0; i < trapKeys.length; i++) {
            const id = trapKeys[i];
            const cfg = CONFIG.TRAPS[id];
            const cx = trapStartX + i * cardStride;
            const isSelected = game.selectedUnit?.id === id && !game.selectedUnit?.isMonster;
            this._drawUnitCard(cfg, cx, cardY, cardW, cardH, isSelected, game.gold >= cfg.cost);
        }

        // Vertical divider before right panels
        const divX = trapStartX + trapKeys.length * cardStride + 10;
        ctx.strokeStyle = '#2a2050';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(divX, panelY + 5);
        ctx.lineTo(divX, panelY + cardH + 15);
        ctx.stroke();

        // ── Memory panel (right of cards) ──
        this._drawMemoryPanel(game, divX + 5);

        // ── Prep timer / start wave button ──
        if (game.phase === 'prep') {
            const btnX = 1055;
            const btnY = panelY + 20;
            ctx.fillStyle = '#3a2260';
            this._roundRect(btnX, btnY, 135, 50, 8);
            ctx.fill();
            ctx.strokeStyle = '#7a52b0';
            ctx.lineWidth = 2;
            this._roundRect(btnX, btnY, 135, 50, 8);
            ctx.stroke();
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = '#e0c0ff';
            ctx.textAlign = 'center';
            ctx.fillText('▶ START WAVE', btnX + 67, btnY + 20);
            ctx.font = '11px sans-serif';
            ctx.fillStyle = C.textDim;
            ctx.fillText(`Auto in ${Math.ceil(game.prepTimer)}s`, btnX + 67, btnY + 38);
        }

        // Wave status
        if (game.phase === 'wave') {
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#ff7070';
            ctx.textAlign = 'center';
            const heroCount = game.heroes.filter(h => !h.dead).length;
            ctx.fillText(`${heroCount} invaders active`, 1120, panelY + 80);
        }

        // Tooltip / description
        if (game.selectedUnit) {
            const cfgMap = game.selectedUnit.isMonster ? CONFIG.MONSTERS : CONFIG.TRAPS;
            const cfg = cfgMap[game.selectedUnit.id];
            if (cfg) {
                ctx.font = 'italic 11px sans-serif';
                ctx.fillStyle = '#aa90cc';
                ctx.textAlign = 'left';
                ctx.fillText(cfg.description, 20, panelY + cardH + 20);
            }
        }

        // Tutorial hint
        if (game.showTutorial && game.phase === 'prep' && game.wave === 0) {
            const tx = CONFIG.GRID_X + 180;
            const ty = CONFIG.GRID_Y + CONFIG.GRID_ROWS * CONFIG.CELL_SIZE / 2;
            ctx.save();
            ctx.fillStyle = 'rgba(40,20,70,0.93)';
            this._roundRect(tx, ty - 32, 340, 64, 10);
            ctx.fill();
            ctx.strokeStyle = '#7a52b0';
            ctx.lineWidth = 2;
            this._roundRect(tx, ty - 32, 340, 64, 10);
            ctx.stroke();
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#e0c0ff';
            ctx.textAlign = 'center';
            ctx.fillText('👋 Select a monster below, then click a cell!', tx + 170, ty - 10);
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#aa88cc';
            ctx.fillText('Right-click a cell to sell (50% refund) · prepare fast, defend hard!', tx + 170, ty + 14);
            ctx.restore();
        }
    }

    _drawHUD(game) {
        const ctx = this.ctx;
        const C = CONFIG.COLORS;
        const hudY = CONFIG.BOTTOM_PANEL_Y - 9;

        // Gold
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = C.gold;
        ctx.fillText(`💰 ${game.gold}`, CONFIG.GRID_X, hudY);

        // Passive gold rate
        const rate = CONFIG.PASSIVE_GOLD_PER_SECOND + game.upgrades.passiveGold;
        ctx.font = '11px sans-serif';
        ctx.fillStyle = C.textDim;
        ctx.fillText(`+${rate.toFixed(1)}/s`, CONFIG.GRID_X + 95, hudY);

        // Wave + phase info (center)
        const waveText = game.phase === 'prep'
            ? `⏳ Prepare — Wave ${game.wave + 1} incoming`
            : game.phase === 'wave'
                ? `⚔️ Wave ${game.wave} — defend!`
                : `Wave ${game.wave}`;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = game.phase === 'wave' ? '#ff7070' : '#c0a0ff';
        ctx.textAlign = 'center';
        ctx.fillText(waveText, CONFIG.CANVAS_WIDTH / 2 - 80, hudY);

        // Units placed indicator
        ctx.font = '10px sans-serif';
        ctx.fillStyle = C.textDim;
        ctx.textAlign = 'left';
        ctx.fillText(`Units: ${game.placedCount}/${game.upgrades.maxSlots}`, CONFIG.GRID_X + 95, hudY - 12);
    }

    _drawUnitCard(cfg, x, y, w, h, selected, canAfford) {
        const ctx = this.ctx;
        const C = CONFIG.COLORS;

        // Card bg
        ctx.fillStyle = selected ? C.buttonSelected : (canAfford ? C.buttonDefault : '#1a1530');
        this._roundRect(x, y, w, h, 6);
        ctx.fill();

        // Border
        ctx.strokeStyle = selected ? '#aa70ff' : (canAfford ? C.uiBorder : '#2a1a4a');
        ctx.lineWidth = selected ? 2.5 : 1.5;
        this._roundRect(x, y, w, h, 6);
        ctx.stroke();

        // Emoji
        ctx.font = '30px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!canAfford) ctx.globalAlpha = 0.45;
        ctx.fillText(cfg.emoji, x + w / 2, y + h * 0.38);
        ctx.globalAlpha = 1;

        // Name
        ctx.font = `${cfg.name.length > 9 ? 9 : 10}px sans-serif`;
        ctx.fillStyle = canAfford ? C.text : C.textDim;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(cfg.name, x + w / 2, y + h - 20);

        // Cost
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = canAfford ? C.gold : '#aa7722';
        ctx.fillText(`${cfg.cost}g`, x + w / 2, y + h - 7);
    }

    _drawMemoryPanel(game, startX) {
        const ctx = this.ctx;
        const panelX = startX ?? 860;
        const panelY = CONFIG.BOTTOM_PANEL_Y + 8;
        const panelW = 185;
        const panelH = CONFIG.CANVAS_HEIGHT - panelY - 8;

        ctx.fillStyle = 'rgba(15,10,30,0.88)';
        this._roundRect(panelX, panelY, panelW, panelH, 6);
        ctx.fill();
        ctx.strokeStyle = '#2a1e4a';
        ctx.lineWidth = 1;
        this._roundRect(panelX, panelY, panelW, panelH, 6);
        ctx.stroke();

        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = '#5a3a8a';
        ctx.textAlign = 'left';
        ctx.fillText('📖 CHRONICLES', panelX + 7, panelY + 12);

        const stories = game.memory.getTopStories();
        if (stories.length === 0) {
            ctx.font = 'italic 9px sans-serif';
            ctx.fillStyle = '#3a2a5a';
            ctx.fillText('No tales yet…', panelX + 7, panelY + 28);
            ctx.fillText('defeat adventurers!', panelX + 7, panelY + 40);
            return;
        }

        let ey = panelY + 27;
        for (const s of stories) {
            if (ey > panelY + panelH - 10) break;
            ctx.font = '9px sans-serif';
            ctx.fillStyle = s.color || '#aaa';
            ctx.textAlign = 'left';
            const msg = s.message.length > 30 ? s.message.slice(0, 28) + '…' : s.message;
            ctx.fillText(msg, panelX + 7, ey);
            ey += 15;
        }
    }

    // ─── Overlays ────────────────────────────────────────────────────────────

    _drawMenu(game) {
        const ctx = this.ctx;

        // Background gradient
        const grad = ctx.createRadialGradient(600, 340, 50, 600, 340, 500);
        grad.addColorStop(0, '#2a1050');
        grad.addColorStop(1, '#080416');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Floating dungeon tiles bg effect
        ctx.fillStyle = 'rgba(50,30,90,0.3)';
        for (let i = 0; i < 40; i++) {
            const x = (i * 137 + Math.sin(this.time * 0.3 + i) * 20) % CONFIG.CANVAS_WIDTH;
            const y = (i * 97 + Math.cos(this.time * 0.2 + i * 0.5) * 15) % CONFIG.CANVAS_HEIGHT;
            ctx.fillRect(Math.floor(x), Math.floor(y), 60, 60);
        }

        // Title
        ctx.save();
        ctx.shadowColor = '#8020e0';
        ctx.shadowBlur = 30;
        ctx.font = 'bold 64px serif';
        ctx.textAlign = 'center';
        const titlePulse = Math.sin(this.time * 1.5) * 5;
        // Shadow
        ctx.fillStyle = '#4a1060';
        ctx.fillText('⚔️ Dungeonfolk Defense ⚔️', 602, 202 + titlePulse);
        // Main
        const titleGrad = ctx.createLinearGradient(300, 130, 900, 200);
        titleGrad.addColorStop(0, '#c080ff');
        titleGrad.addColorStop(0.5, '#ff80ee');
        titleGrad.addColorStop(1, '#80b0ff');
        ctx.fillStyle = titleGrad;
        ctx.fillText('⚔️ Dungeonfolk Defense ⚔️', 600, 200 + titlePulse);
        ctx.restore();

        // Subtitle
        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#a080c8';
        ctx.textAlign = 'center';
        ctx.fillText('You are the dungeon. Defend your heart from adventurers!', 600, 255);

        // Monster showcase (decorative row)
        const monsters = Object.values(CONFIG.MONSTERS);
        const startX = 600 - (monsters.length * 70) / 2;
        for (let i = 0; i < monsters.length; i++) {
            const bob = Math.sin(this.time * 2 + i * 0.8) * 8;
            ctx.font = '42px serif';
            ctx.textAlign = 'center';
            ctx.fillText(monsters[i].emoji, startX + i * 70, 310 + bob);
        }

        // Start button
        const btnX = 480, btnY = 340;
        const btnW = 240, btnH = 58;
        const btnHover = this._isHover(game, btnX, btnY, btnW, btnH);
        ctx.fillStyle = btnHover ? '#5c3d9f' : '#3e2870';
        this._roundRect(btnX, btnY, btnW, btnH, 12);
        ctx.fill();
        ctx.strokeStyle = '#9060d0';
        ctx.lineWidth = 2.5;
        this._roundRect(btnX, btnY, btnW, btnH, 12);
        ctx.stroke();
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#e0c0ff';
        ctx.textAlign = 'center';
        ctx.fillText('🏰 DEFEND THE DUNGEON', btnX + btnW / 2, btnY + 36);

        // Memory stats
        const notable = game.memory.getNotableHeroes();
        if (notable.length > 0) {
            ctx.font = 'bold 13px sans-serif';
            ctx.fillStyle = '#7a5aaa';
            ctx.fillText('Known Adventurers:', 600, 430);
            for (let i = 0; i < Math.min(notable.length, 3); i++) {
                const r = notable[i];
                const cfgMap = { ...CONFIG.HEROES, ...CONFIG.BOSSES };
                const cfg = cfgMap[r.heroType];
                ctx.font = '12px sans-serif';
                ctx.fillStyle = cfg?.color || '#aaa';
                ctx.fillText(
                    `${cfg?.emoji || '?'} ${r.heroType} — defeated ${r.timesDefeated}×${r.knownFor ? ' · ' + r.knownFor : ''}`,
                    600, 450 + i * 20
                );
            }
        }

        // Instructions
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#5a4080';
        ctx.fillText('Click cells to place monsters & traps · Right-click to refund · Survive the waves!', 600, 530);

        // Version
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#3a2a55';
        ctx.fillText('Dungeonfolk Defense — Prototype v0.1', 600, 620);
    }

    _isHover(game, x, y, w, h) {
        if (!game.canvas._mousePos) return false;
        const m = game.canvas._mousePos;
        return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
    }

    _drawUpgradeOverlay(game) {
        const ctx = this.ctx;

        // Darken
        ctx.fillStyle = 'rgba(5,2,15,0.82)';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Title
        ctx.font = 'bold 32px serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#d0a0ff';
        ctx.fillText('✨ Wave ' + game.wave + ' Complete! Choose an Upgrade ✨', 600, 90);

        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#8a6aaa';
        ctx.fillText('Your dungeon grows stronger…', 600, 120);

        // Upgrade cards
        const cardW = 240, cardH = 130;
        const totalW = game.upgradeOptions.length * cardW + (game.upgradeOptions.length - 1) * 20;
        const startX = (CONFIG.CANVAS_WIDTH - totalW) / 2;
        const cardY = 340;

        for (let i = 0; i < game.upgradeOptions.length; i++) {
            const upg = game.upgradeOptions[i];
            const cx = startX + i * (cardW + 20);
            const isSelected = game.selectedUpgrade === i;

            ctx.fillStyle = isSelected ? '#5c3d9f' : '#2a1a5a';
            this._roundRect(cx, cardY, cardW, cardH, 12);
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#aa80ff' : '#4a3080';
            ctx.lineWidth = isSelected ? 3 : 2;
            this._roundRect(cx, cardY, cardW, cardH, 12);
            ctx.stroke();

            ctx.font = '38px serif';
            ctx.textAlign = 'center';
            ctx.fillText(upg.emoji, cx + cardW / 2, cardY + 52);

            ctx.font = 'bold 15px sans-serif';
            ctx.fillStyle = '#e0c0ff';
            ctx.fillText(upg.name, cx + cardW / 2, cardY + 78);

            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#a080c0';
            // Word wrap the description
            this._wrapText(upg.description, cx + cardW / 2, cardY + 98, cardW - 20, 14);
        }

        // Skip button
        const skipX = 540, skipY = 490;
        ctx.fillStyle = '#1a1040';
        this._roundRect(skipX, skipY, 120, 38, 8);
        ctx.fill();
        ctx.strokeStyle = '#3a2060';
        ctx.lineWidth = 1.5;
        this._roundRect(skipX, skipY, 120, 38, 8);
        ctx.stroke();
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#5a4080';
        ctx.textAlign = 'center';
        ctx.fillText('Skip upgrade', skipX + 60, skipY + 24);

        // Wave clear stats
        const reward = CONFIG.WAVE.WAVE_REWARD_BASE + game.wave * CONFIG.WAVE.WAVE_REWARD_PER_WAVE;
        ctx.font = '14px sans-serif';
        ctx.fillStyle = CONFIG.COLORS.gold;
        ctx.fillText(`💰 +${reward} gold earned from clearing Wave ${game.wave}`, 600, 560);
    }

    _drawGameOver(game) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // Title
        ctx.font = 'bold 56px serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#B71C1C';
        ctx.fillText('💀 YOUR DUNGEON FALLS 💀', 600, 180);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#8a4444';
        ctx.fillText('The adventurers have claimed your Dungeon Heart.', 600, 230);

        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#ccc';
        ctx.fillText(`You survived ${game.wave} waves and defeated ${game.memory.totalHeroesDefeated} heroes.`, 600, 280);

        // Notable heroes
        const notable = game.memory.getNotableHeroes();
        if (notable.length > 0) {
            ctx.font = 'bold 14px sans-serif';
            ctx.fillStyle = '#7a5aaa';
            ctx.fillText('The Dungeon Chronicles remember:', 600, 330);
            for (let i = 0; i < Math.min(notable.length, 4); i++) {
                const r = notable[i];
                const cfg = { ...CONFIG.HEROES, ...CONFIG.BOSSES }[r.heroType];
                ctx.font = '13px sans-serif';
                ctx.fillStyle = cfg?.color || '#aaa';
                ctx.fillText(
                    `${cfg?.emoji || '?'} "${r.knownFor || r.heroType}" — fell ${r.timesDefeated} times`,
                    600, 358 + i * 22
                );
            }
        }

        // Restart button
        const btnX = 480, btnY = 420;
        ctx.fillStyle = '#3e2820';
        this._roundRect(btnX, btnY, 240, 56, 12);
        ctx.fill();
        ctx.strokeStyle = '#8a3020';
        ctx.lineWidth = 2.5;
        this._roundRect(btnX, btnY, 240, 56, 12);
        ctx.stroke();
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#ffb090';
        ctx.fillText('🔄 Try Again', btnX + 120, btnY + 36);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#5a3a3a';
        ctx.fillText('Memory persists — heroes remember your traps!', 600, 510);
    }

    _drawVictory(game) {
        const ctx = this.ctx;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        const pulse = Math.sin(this.time * 3) * 10;
        ctx.font = `bold ${58 + pulse / 5}px serif`;
        ctx.textAlign = 'center';
        const grad = ctx.createLinearGradient(200, 0, 1000, 0);
        grad.addColorStop(0, '#FFD700');
        grad.addColorStop(0.5, '#ff80ff');
        grad.addColorStop(1, '#80ff80');
        ctx.fillStyle = grad;
        ctx.fillText('🏆 DUNGEON DEFENDED! 🏆', 600, 200);

        ctx.font = '20px sans-serif';
        ctx.fillStyle = '#aa80ff';
        ctx.fillText('All waves repelled! Your dungeon stands victorious.', 600, 260);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    _roundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    _wrapText(text, cx, y, maxW, lineH) {
        const ctx = this.ctx;
        const words = text.split(' ');
        let line = '';
        for (const word of words) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, cx, y);
                line = word;
                y += lineH;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, cx, y);
    }
}
