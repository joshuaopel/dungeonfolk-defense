// All game constants and balancing values — change here to tune the game

const CONFIG = {
    // Canvas
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 680,

    // Grid layout
    CELL_SIZE: 90,
    GRID_COLS: 12,
    GRID_ROWS: 5,
    GRID_X: 60,
    GRID_Y: 15,

    // Special columns
    ENTRANCE_COL: 0,
    HEART_COL: 11,
    MIN_PLACE_COL: 1,
    MAX_PLACE_COL: 10,

    // Game rules
    DUNGEON_HEART_MAX_HP: 100,
    STARTING_GOLD: 150,
    PASSIVE_GOLD_PER_SECOND: 2,
    PREP_TIME: 30,
    HEART_DAMAGE_PER_HERO: 10,

    MONSTERS: {
        slime: {
            id: 'slime', name: 'Slime', emoji: '🫧',
            cost: 50, maxHp: 150, attack: 10, attackSpeed: 1.5,
            rangePixels: 105, color: '#4CAF50', cellTint: 'rgba(76,175,80,0.25)',
            description: 'Splits into 2 mini slimes when defeated!',
        },
        mimic: {
            id: 'mimic', name: 'Mimic', emoji: '😈',
            cost: 100, maxHp: 80, attack: 55, attackSpeed: 0.35,
            rangePixels: 130, color: '#FF9800', cellTint: 'rgba(255,152,0,0.25)',
            description: 'Disguises as chest — massive burst when revealed!',
            disguised: true,
        },
        skeletonArcher: {
            id: 'skeletonArcher', name: 'Skel. Archer', emoji: '💀',
            cost: 100, maxHp: 65, attack: 14, attackSpeed: 0.9,
            rangePixels: 360, color: '#9E9E9E', cellTint: 'rgba(158,158,158,0.2)',
            description: 'Shoots arrows down the lane.',
            ranged: true,
        },
        batSwarm: {
            id: 'batSwarm', name: 'Bat Swarm', emoji: '🦇',
            cost: 50, maxHp: 45, attack: 10, attackSpeed: 2.8,
            rangePixels: 115, color: '#7C4DFF', cellTint: 'rgba(124,77,255,0.2)',
            description: 'Extremely fast attacks, distracts foes!',
        },
        ghost: {
            id: 'ghost', name: 'Ghost', emoji: '👻',
            cost: 100, maxHp: 55, attack: 22, attackSpeed: 1.1,
            rangePixels: 270, color: '#80DEEA', cellTint: 'rgba(128,222,234,0.2)',
            description: 'Phases through enemies to attack healers!',
            phasing: true, priorityTargets: ['cleric', 'wizard', 'paladin'],
        },
        animatedArmor: {
            id: 'animatedArmor', name: 'Armor', emoji: '🛡️',
            cost: 200, maxHp: 320, attack: 12, attackSpeed: 0.7,
            rangePixels: 100, color: '#B0BEC5', cellTint: 'rgba(176,190,197,0.2)',
            description: 'Massive HP, blocks the entire lane.',
            armor: 5,
        },
    },

    TRAPS: {
        spikeTrap: {
            id: 'spikeTrap', name: 'Spike Trap', emoji: '⚡',
            cost: 75, damage: 45, cooldown: 8,
            color: '#F44336', cellTint: 'rgba(244,67,54,0.2)',
            description: 'Damages any hero who steps on it.',
        },
        curseTotem: {
            id: 'curseTotem', name: 'Curse Totem', emoji: '🪄',
            cost: 100, slowAmount: 0.45, slowRadius: 180, slowDuration: 3,
            color: '#9C27B0', cellTint: 'rgba(156,39,176,0.2)',
            description: 'Slows nearby heroes significantly.',
        },
        fallingChandelier: {
            id: 'fallingChandelier', name: 'Chandelier', emoji: '💡',
            cost: 125, damage: 70, aoeRadius: 140, cooldown: 14,
            color: '#FFC107', cellTint: 'rgba(255,193,7,0.2)',
            description: 'Area damage on cooldown — watch the ceiling!',
        },
        treasureChest: {
            id: 'treasureChest', name: 'Lure Chest', emoji: '💰',
            cost: 50, stopDuration: 3.5,
            color: '#FFD700', cellTint: 'rgba(255,215,0,0.2)',
            description: 'Heroes stop to investigate. Combos with Mimic!',
        },
    },

    HEROES: {
        knight: {
            id: 'knight', name: 'Knight', emoji: '⚔️',
            color: '#4FC3F7', hp: 100, attack: 15, attackSpeed: 1.0,
            speed: 45, rangePixels: 85, reward: 20, type: 'tank',
        },
        archer: {
            id: 'archer', name: 'Archer', emoji: '🏹',
            color: '#81C784', hp: 60, attack: 12, attackSpeed: 1.6,
            speed: 55, rangePixels: 160, reward: 15, type: 'ranged',
        },
        cleric: {
            id: 'cleric', name: 'Cleric', emoji: '✨',
            color: '#FFF176', hp: 70, attack: 8, attackSpeed: 0.9,
            speed: 40, rangePixels: 85, reward: 25, type: 'cleric',
            healAmount: 15, healRadius: 130, healSpeed: 2.5,
        },
        rogue: {
            id: 'rogue', name: 'Rogue', emoji: '🗡️',
            color: '#CE93D8', hp: 55, attack: 28, attackSpeed: 2.2,
            speed: 85, rangePixels: 75, reward: 20, type: 'rogue',
            trapImmune: true,
        },
        wizard: {
            id: 'wizard', name: 'Wizard', emoji: '🔮',
            color: '#FF80AB', hp: 50, attack: 32, attackSpeed: 0.7,
            speed: 35, rangePixels: 200, reward: 30, type: 'wizard',
            aoeRadius: 90,
        },
        paladin: {
            id: 'paladin', name: 'Paladin', emoji: '🌟',
            color: '#FFCC02', hp: 130, attack: 20, attackSpeed: 0.9,
            speed: 40, rangePixels: 90, reward: 35, type: 'paladin',
            buffRadius: 110, buffAmount: 0.35,
        },
    },

    BOSSES: {
        dragonSlayer: {
            id: 'dragonSlayer', name: 'Dragon Slayer', emoji: '🐲',
            color: '#FF5722', hp: 500, attack: 40, attackSpeed: 1.0,
            speed: 35, rangePixels: 110, reward: 120, isBoss: true, type: 'tank',
            ability: 'fireBreath',
        },
        legendaryAdventurer: {
            id: 'legendaryAdventurer', name: 'Legendary Adventurer', emoji: '🦸',
            color: '#FFD700', hp: 420, attack: 35, attackSpeed: 1.5,
            speed: 50, rangePixels: 130, reward: 120, isBoss: true, type: 'ranged',
            ability: 'rallyCry',
        },
        heroicPartyLeader: {
            id: 'heroicPartyLeader', name: 'Party Leader', emoji: '👑',
            color: '#E91E63', hp: 380, attack: 30, attackSpeed: 1.2,
            speed: 42, rangePixels: 105, reward: 120, isBoss: true, type: 'support',
            ability: 'tacticalRetreat',
        },
    },

    // Wave scaling
    WAVE: {
        BASE_HERO_COUNT: 3,
        HEROES_PER_WAVE: 1.8,
        HP_SCALE_PER_WAVE: 0.12,
        ATTACK_SCALE_PER_WAVE: 0.08,
        SPAWN_INTERVAL_BASE: 3.5,
        SPAWN_INTERVAL_MIN: 1.2,
        WAVE_REWARD_BASE: 60,
        WAVE_REWARD_PER_WAVE: 25,
    },

    // Mini slime stats (slime split offspring)
    MINI_SLIME: {
        maxHp: 40, attack: 5, attackSpeed: 1.5, rangePixels: 100,
    },

    // Upgrade options pool
    UPGRADES: [
        { id: 'extraGold', name: 'Gold Vein', emoji: '✨', description: '+3 gold/sec passively', cost: 0, effect: 'passiveGold', value: 3 },
        { id: 'monsterSlots', name: 'Monster Barracks', emoji: '🏰', description: '+2 max monster slots', cost: 0, effect: 'slots', value: 2 },
        { id: 'monsterDamage', name: 'Sharpened Claws', emoji: '💪', description: '+15% monster damage', cost: 0, effect: 'monsterDamage', value: 0.15 },
        { id: 'monsterHealth', name: 'Dungeon Resilience', emoji: '❤️', description: '+20% monster max HP', cost: 0, effect: 'monsterHealth', value: 0.20 },
        { id: 'heartRepair', name: 'Heart Repair', emoji: '💖', description: 'Restore 20 Dungeon Heart HP', cost: 0, effect: 'heartHeal', value: 20 },
        { id: 'trapCooldown', name: 'Wicked Mechanisms', emoji: '⚙️', description: 'Traps reset 30% faster', cost: 0, effect: 'trapCooldown', value: 0.30 },
        { id: 'slowTraps', name: 'Improved Curses', emoji: '🌀', description: 'Curse Totems slow 60% more', cost: 0, effect: 'slowBoost', value: 0.60 },
        { id: 'goldOnKill', name: 'Treasure Hunter', emoji: '💎', description: '+5 bonus gold per hero defeated', cost: 0, effect: 'killBonus', value: 5 },
    ],

    // UI
    BOTTOM_PANEL_Y: 490,
    UNIT_CARD_W: 76,
    UNIT_CARD_H: 90,
    UNIT_CARD_MARGIN: 5,
    // card area ends ~x=845; memory panel x=855-1045; start-wave btn x=1055-1185

    // Colors
    COLORS: {
        gridBg: '#1e1a2e',
        cellDark: '#2a2540',
        cellLight: '#332e50',
        cellBorder: '#1a1530',
        entrance: '#1a2a1a',
        entranceBorder: '#2a4a2a',
        heart: '#3a1a2a',
        heartBorder: '#6a1a3a',
        uiBg: '#120e20',
        uiBorder: '#3a3060',
        gold: '#FFD700',
        healthFull: '#4CAF50',
        healthMid: '#FFC107',
        healthLow: '#F44336',
        text: '#e8e0ff',
        textDim: '#8870aa',
        buttonDefault: '#2e2848',
        buttonHover: '#3e3858',
        buttonSelected: '#5c3d8f',
        heartPulse: '#ff1a5e',
    },
};
