// Hero memory system — tracks recurring adventurers and their stories

class MemorySystem {
    constructor() {
        this.records = {}; // heroType -> MemoryRecord
        this.recentEncounters = []; // last 5 notable events
        this.totalHeroesDefeated = 0;
    }

    getOrCreate(heroType) {
        if (!this.records[heroType]) {
            this.records[heroType] = {
                heroType,
                timesDefeated: 0,
                timesEscaped: 0,
                names: [],
                traits: [],
                knownFor: '',
            };
        }
        return this.records[heroType];
    }

    heroDefeated(hero) {
        const record = this.getOrCreate(hero.heroType);
        record.timesDefeated++;
        this.totalHeroesDefeated++;

        // Generate "known for" after 2nd defeat
        if (record.timesDefeated === 2) {
            record.knownFor = hero.quirk || 'adventuring recklessly';
        }

        // Generate trait after 3 defeats
        if (record.timesDefeated === 3) {
            record.traits.push('Experienced — takes 10% less damage from first hit');
        }
        if (record.timesDefeated === 5 && !record.traits.includes('Veteran')) {
            record.traits.push('Veteran — +10% max HP');
        }

        // Log encounter
        if (record.timesDefeated <= 3 || hero.isBoss) {
            this.recentEncounters.unshift({
                name: hero.displayName || hero.name,
                type: hero.heroType,
                emoji: hero.cfg.emoji,
                color: hero.cfg.color,
                deathCount: record.timesDefeated,
                message: this._generateMessage(hero, record),
            });
            if (this.recentEncounters.length > 6) this.recentEncounters.pop();
        }
    }

    heroEscaped(hero) {
        const record = this.getOrCreate(hero.heroType);
        record.timesEscaped++;
        this.recentEncounters.unshift({
            name: hero.displayName || hero.name,
            type: hero.heroType,
            emoji: hero.cfg.emoji,
            color: '#FF5252',
            deathCount: record.timesDefeated,
            message: `⚡ ${hero.displayName || hero.name} reached the Heart!`,
        });
        if (this.recentEncounters.length > 6) this.recentEncounters.pop();
    }

    _generateMessage(hero, record) {
        const n = hero.displayName || hero.name;
        const count = record.timesDefeated;
        if (hero.isBoss) return `👑 ${n} the boss has been defeated!`;
        if (count === 1) return `${hero.cfg.emoji} ${n} met their end.`;
        if (count === 2) return `${hero.cfg.emoji} ${n} returned… and fell again.`;
        if (count === 3) return `${hero.cfg.emoji} ${n} known for: ${record.knownFor}`;
        if (count === 5) return `${hero.cfg.emoji} ${n} — defeated ${count} times. Legend.`;
        return `${hero.cfg.emoji} ${n} (×${count}) vanquished again!`;
    }

    serialize() {
        return JSON.stringify({ records: this.records, totalHeroesDefeated: this.totalHeroesDefeated });
    }

    deserialize(data) {
        try {
            const parsed = JSON.parse(data);
            this.records = parsed.records || {};
            this.totalHeroesDefeated = parsed.totalHeroesDefeated || 0;
        } catch {}
    }

    getTopStories() {
        return this.recentEncounters.slice(0, 5);
    }

    getNotableHeroes() {
        return Object.values(this.records)
            .filter(r => r.timesDefeated >= 2)
            .sort((a, b) => b.timesDefeated - a.timesDefeated)
            .slice(0, 4);
    }
}
