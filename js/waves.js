// Wave generation and hero name pools for the memory system

const HERO_NAMES = {
    // Cannon fodder
    ruffian: ['Grim', 'Lunk', 'Snark', 'Burp', 'Clod', 'Knob', 'Duff'],
    zealot: ['The Devout', 'True Believer', 'Brother Smash', 'Sister Chaos', 'Fanatic'],
    brute: ['Ox', 'Crusher', 'Big Lenny', 'Slab', 'Thud', 'Boulder'],
    // Named heroes (wave champions)
    knight: ['Sir Reginald', 'Sir Gareth', 'Dame Heloise', 'Sir Aldric', 'Sir Barnaby'],
    archer: ['Robin the Keen', 'Arrow-Eye Mira', 'Quill', 'Finn Broadbow', 'Whisper'],
    cleric: ['Brother Aldous', 'Sister Wren', 'Friar Bum', 'Deacon Edith', 'Padre Gus'],
    rogue: ['Sticky Fingers', 'Shadow-Toes', 'The Lurker', 'Nimble Ned', 'Slip'],
    wizard: ['Magister Boom', 'Arcana Jones', 'Zyx the Volatile', 'Professor Fizzle', 'Wanda'],
    paladin: ['Brightshield', 'Holy Tamara', 'Sir Lux', 'Golden Gwen', 'Paladin Paul'],
    // Legendary bosses
    dragonSlayer: ['THE Dragon Slayer'],
    legendaryAdventurer: ['Legendary Dave'],
    heroicPartyLeader: ['Commander Crunch'],
};

const HERO_QUIRKS = {
    ruffian: ['mutters threats', 'flexes constantly', 'trips on own feet', 'borrowed this sword'],
    zealot: ['chants aggressively', 'sets things on fire', 'believes in prophecy', 'follows a weird god'],
    brute: ['breathes loudly', 'confused by doors', 'is actually kind', 'loves their mom'],
    knight: ['charges headfirst', 'polishes armor constantly', 'yells battle cries', 'drinks from every fountain'],
    archer: ['hums while aiming', 'counts arrows obsessively', 'avoids dungeons on Tuesdays', 'snacks between fights'],
    cleric: ['mutters prayers', 'heals strangers unnecessarily', 'is overly cheerful', 'blesses everything twice'],
    rogue: ['checks every shadow', 'pockets loose change', 'avoids the light', 'names their daggers'],
    wizard: ['reads spell books aloud', 'calls everything "an experiment"', 'sets things on fire by accident', 'argues with furniture'],
    paladin: ['motivates others unsolicited', 'shines their halo aggressively', 'blesses the ground they walk on', 'gives rousing speeches mid-fight'],
};

class WaveManager {
    constructor() {
        this.currentWave = 0;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.waveActive = false;
        this.allSpawned = false;
    }

    generateWave(waveNum) {
        const w = CONFIG.WAVE;
        const isBossWave = waveNum % 5 === 0;

        // Regular spawns: cannon fodder only
        const fodderTypes = Object.keys(CONFIG.FODDER);
        const count = Math.floor(w.BASE_HERO_COUNT + waveNum * w.HEROES_PER_WAVE);
        const interval = Math.max(w.SPAWN_INTERVAL_MIN, w.SPAWN_INTERVAL_BASE - waveNum * 0.18);

        const entries = [];
        let t = 0;
        for (let i = 0; i < count; i++) {
            const type = fodderTypes[Math.floor(Math.random() * fodderTypes.length)];
            entries.push({ type, delay: t, isFodder: true });
            t += interval * (0.7 + Math.random() * 0.6);
        }

        // Wave champion: a named hero at the end of every wave
        const heroTypes = Object.keys(CONFIG.HEROES);
        const heroType = heroTypes[(waveNum - 1) % heroTypes.length];
        entries.push({ type: heroType, delay: t + 2.5, isChampion: true });
        t += 5;

        // Legendary boss on every 5th wave (after the champion)
        if (isBossWave) {
            const bossTypes = Object.keys(CONFIG.BOSSES);
            const bossType = bossTypes[(Math.floor(waveNum / 5) - 1) % bossTypes.length];
            entries.push({ type: bossType, delay: t + 2, isBoss: true });
        }

        return { entries, isBossWave, waveNum };
    }

    startWave(waveNum, memorySystem) {
        this.currentWave = waveNum;
        const waveData = this.generateWave(waveNum);
        this.spawnQueue = waveData.entries.map(e => ({
            ...e,
            fired: false,
            memoryData: null,
        }));
        this.spawnTimer = 0;
        this.waveActive = true;
        this.allSpawned = false;
        this.isBossWave = waveData.isBossWave;
        return waveData;
    }

    update(dt, game) {
        if (!this.waveActive) return;
        this.spawnTimer += dt;

        for (const entry of this.spawnQueue) {
            if (!entry.fired && this.spawnTimer >= entry.delay) {
                entry.fired = true;
                this._spawnHero(entry, game);
            }
        }

        if (!this.allSpawned && this.spawnQueue.every(e => e.fired)) {
            this.allSpawned = true;
        }
    }

    _spawnHero(entry, game) {
        const isBoss = entry.isBoss || false;
        const isFodder = entry.isFodder || false;
        const isChampion = entry.isChampion || false;

        let cfgBase;
        if (isBoss) {
            cfgBase = CONFIG.BOSSES[entry.type];
        } else if (isFodder) {
            cfgBase = CONFIG.FODDER[entry.type];
        } else {
            cfgBase = CONFIG.HEROES[entry.type];
        }
        if (!cfgBase) return;

        // Champions are 1.8× tougher than the base hero stats
        const scaleMult = isChampion ? 1.8 : 1;
        const hero = new Hero(cfgBase, this.currentWave, scaleMult);

        // Champions render as boss (glow + name tag always visible)
        if (isChampion) hero.isBoss = true;

        // Assign name from memory or fresh name
        const memory = game.memory.getOrCreate(cfgBase.id);
        if (memory.names.length === 0) {
            const namePool = HERO_NAMES[cfgBase.id] || [cfgBase.name];
            memory.names = [...namePool];
        }
        const nameIndex = Math.floor(Math.random() * memory.names.length);
        hero.displayName = memory.names[nameIndex];
        hero.quirk = this._getQuirk(cfgBase.id, memory);

        // Memory traits: mimic resistance and extra HP for veteran heroes/champions
        if (memory.timesDefeated >= 3 && cfgBase.id !== 'knight') {
            hero.mimicResistant = true;
        }
        if (memory.timesDefeated >= 5) {
            hero.maxHp = Math.floor(hero.maxHp * 1.1);
            hero.hp = hero.maxHp;
        }
        hero.memoryId = `${cfgBase.id}_${nameIndex}`;
        hero.deathCount = memory.timesDefeated;

        game.heroes.push(hero);
        game.spawnParticle(hero.x + 40, hero.y - 30, cfgBase.color, isChampion ? '⚠' : '!');
    }

    _getQuirk(type, memory) {
        const pool = HERO_QUIRKS[type] || ['explores dungeons'];
        return pool[memory.timesDefeated % pool.length];
    }

    isWaveComplete(heroes) {
        return this.allSpawned && heroes.every(h => h.dead);
    }
}
