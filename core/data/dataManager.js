// ============================================================
// DATA MANAGER (с IndexedDB)
// ============================================================

// ============================================================
// INDEXEDDB ХРАНИЛИЩЕ
// ============================================================

const DB_NAME = 'PokerStatsDB';
const DB_VERSION = 1;
const STORE_NAME = 'hands';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = function(event) {
            console.error('❌ Ошибка открытия IndexedDB:', event.target.error);
            reject(event.target.error);
        };
        
        request.onsuccess = function(event) {
            resolve(event.target.result);
        };
        
        request.onupgradeneeded = function(event) {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'gamecode' });
                store.createIndex('startDate', 'startDate', { unique: false });
                store.createIndex('heroName', 'heroName', { unique: false });
                console.log('✅ Создано хранилище IndexedDB');
            }
        };
    });
}

function saveHandsToDB(hands) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            for (const hand of hands) {
                const getRequest = store.get(hand.gamecode);
                getRequest.onsuccess = function() {
                    if (!getRequest.result) {
                        store.put(hand);
                    }
                };
                getRequest.onerror = function() {
                    console.warn('⚠️ Ошибка проверки дубля:', hand.gamecode);
                };
            }
            
            transaction.oncomplete = function() {
                console.log('✅ Данные сохранены в IndexedDB');
                resolve();
            };
            
            transaction.onerror = function(event) {
                console.error('❌ Ошибка сохранения в IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

function loadHandsFromDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = function() {
                const hands = request.result || [];
                const parsedHands = hands.map(h => ({
                    ...h,
                    startDate: new Date(h.startDate)
                }));
                console.log(`✅ Загружено ${parsedHands.length} рук из IndexedDB`);
                resolve(parsedHands);
            };
            
            request.onerror = function(event) {
                console.error('❌ Ошибка загрузки из IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

function clearHandsFromDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = function() {
                console.log('✅ IndexedDB очищена');
                resolve();
            };
            
            request.onerror = function(event) {
                console.error('❌ Ошибка очистки IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}

function countHandsInDB() {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();
            
            request.onsuccess = function() {
                resolve(request.result);
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        } catch (error) {
            reject(error);
        }
    });
}
// ============================================================
// DATA MANAGER
// ============================================================

class DataManager {
    constructor() {
        this.hands = [];
        this.stats = null;
        this.settings = this.loadSettings();
        this.heroNick = '';
        this.aliases = [];
        this.calculator = new StatsCalculator();
        this.isLoaded = false;
        this.isSaving = false;
        
        this.loadHero();
    }

    loadHero() {
        try {
            const savedHero = localStorage.getItem('pokerHeroNick');
            const savedAliases = localStorage.getItem('pokerHeroAliases');
            
            if (savedHero) {
                this.heroNick = savedHero;
                this.aliases = savedAliases ? JSON.parse(savedAliases) : [];
            }
        } catch (e) {
            console.error('Error loading hero from localStorage:', e);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('pokerSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                return Object.assign({}, DEFAULT_SETTINGS, settings);
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
        return Object.assign({}, DEFAULT_SETTINGS);
    }

    saveSettings() {
        try {
            localStorage.setItem('pokerSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.error('Error saving settings:', e);
        }
    }

    async loadHands() {
        try {
            const hands = await loadHandsFromDB();
            this.hands = hands;
            this.isLoaded = true;
            
            if (this.heroNick) {
                this.recalculateStats();
            }
            return true;
        } catch (e) {
            console.error('Error loading hands from IndexedDB:', e);
            return false;
        }
    }

    async saveHands() {
        if (this.isSaving) return;
        this.isSaving = true;
        try {
            await saveHandsToDB(this.hands);
            this.isSaving = false;
            return true;
        } catch (e) {
            console.error('Error saving hands to IndexedDB:', e);
            this.isSaving = false;
            return false;
        }
    }

    initAfterHeroSelection() {
        if (this.heroNick && this.hands.length > 0) {
            this.recalculateStats();
        }
    }

    async addHands(newHands) {
        const existingCodes = new Set(this.hands.map(h => h.gamecode));
        const uniqueNewHands = newHands.filter(h => !existingCodes.has(h.gamecode));

        if (uniqueNewHands.length === 0) {
            return { added: 0, duplicates: newHands.length };
        }

        this.hands = this.hands.concat(uniqueNewHands);
        await this.saveHands();

        if (this.heroNick) {
            this.recalculateStats();
        }

        return {
            added: uniqueNewHands.length,
            duplicates: newHands.length - uniqueNewHands.length
        };
    }

    recalculateStats() {
        this.calculator.reset();

        const heroHands = this.hands.filter(hand => {
            return hand.players && hand.players.some(p => p.name === this.heroNick || this.aliases.includes(p.name));
        });

        heroHands.sort((a, b) => a.startDate - b.startDate);

        for (const hand of heroHands) {
            const player = hand.players.find(p => p.name === this.heroNick || this.aliases.includes(p.name));
            if (player) {
                const result = calculateResult(hand.players, this.heroNick);
                this.calculator.addHand({
                    ...hand,
                    result: result
                });
            }
        }

        this.stats = this.calculator.getStats(this.settings?.sessionBreakMinutes || 5);
    }
    getStats(filters = {}) {
    if (!this.stats) {
        this.recalculateStats();
    }

    const breakMinutes = this.settings?.sessionBreakMinutes || 5;
    let stats = Object.assign({}, this.stats);

    // Если переданы конкретные руки
    if (filters.hands) {
        const tempCalculator = new StatsCalculator();
        for (const hand of filters.hands) {
            const player = hand.players.find(p => p.name === this.heroNick || this.aliases.includes(p.name));
            if (player) {
                const result = calculateResult(hand.players, this.heroNick);
                tempCalculator.addHand({
                    ...hand,
                    result: result
                });
            }
        }
        stats = tempCalculator.getStats(breakMinutes);
    }

    // ВСЕГДА фильтруем по лимитам
    if (filters.limits) {
    let filteredHands = this.hands;
    
    if (filters.limits === null) {
        // "Все" выбрано - показываем все с героем
        filteredHands = this.hands.filter(hand => {
            return hand.players && hand.players.some(p => p.name === this.heroNick || this.aliases.includes(p.name));
        });
    } else if (filters.limits.length === 0) {
        // Ничего не выбрано - пусто
        filteredHands = [];
    } else {
        // Фильтруем по лимитам И по герою
        filteredHands = this.hands.filter(hand => {
            const hasHero = hand.players && hand.players.some(p => p.name === this.heroNick || this.aliases.includes(p.name));
            if (!hasHero) return false;
            
            const limit = 'NL' + hand.limit;
            return filters.limits.includes(limit);
        });
    }

    const tempCalculator = new StatsCalculator();
    for (const hand of filteredHands) {
        const player = hand.players.find(p => p.name === this.heroNick || this.aliases.includes(p.name));
        if (player) {
            const result = calculateResult(hand.players, this.heroNick);
            tempCalculator.addHand({
                ...hand,
                result: result
            });
        }
    }
    stats = tempCalculator.getStats(breakMinutes);
}

    return stats;
}

    getDays(settings = {}) {
    const dayStartHour = settings.dayStartHour || this.settings.dayStartHour;
    const sessionBreak = settings.sessionBreakMinutes || this.settings.sessionBreakMinutes;
    const selectedLimits = settings.limits;

    const heroHands = this.hands.filter(hand => {
        // Фильтруем по лимитам
        if (selectedLimits === null) {
            // "Все" выбрано - показываем все
        } else if (selectedLimits.length === 0) {
            // Ничего не выбрано - пусто
            return false;
        } else {
            if (!selectedLimits.includes('NL' + hand.limit)) {
                return false;
            }
        }
        
        return hand.players && hand.players.some(p => p.name === this.heroNick || this.aliases.includes(p.name));
    });

    const daysMap = {};

    for (const hand of heroHands) {
        const player = hand.players.find(p => p.name === this.heroNick || this.aliases.includes(p.name));
        if (!player) continue;

        const correctedDate = new Date(hand.startDate);
        correctedDate.setHours(correctedDate.getHours() + (this.settings.timezoneOffset || 0));
        const dayKey = this.getDayKey(correctedDate, dayStartHour);

        if (!daysMap[dayKey]) {
            daysMap[dayKey] = {
                date: dayKey,
                hands: [],
                netResult: 0
            };
        }

        const result = calculateResult(hand.players, this.heroNick);
        daysMap[dayKey].hands.push({
            ...hand,
            result: result
        });
        daysMap[dayKey].netResult += result;
    }

    const result = [];
    for (const dayKey in daysMap) {
        const dayData = daysMap[dayKey];
        const sortedHands = dayData.hands.slice().sort((a, b) => a.startDate - b.startDate);
        const sessions = this.groupIntoSessions(sortedHands, sessionBreak);
        
        const dayStartTime = sortedHands[0].startDate;
        const dayEndTime = sortedHands[sortedHands.length - 1].startDate;

        result.push({
            day: dayKey,
            hands: sortedHands,
            sessions: sessions,
            netResult: dayData.netResult,
            totalHands: sortedHands.length,
            totalTime: sessions.reduce((sum, s) => sum + s.duration, 0),
            dayStartTime: dayStartTime,
            dayEndTime: dayEndTime
        });
    }

    result.sort((a, b) => a.day.localeCompare(b.day));

    return result;
}

    getDayKey(date, dayStartHour) {
        const d = new Date(date);
        const hours = d.getHours();
        if (hours < dayStartHour) {
            d.setDate(d.getDate() - 1);
        }
        d.setHours(0, 0, 0, 0);
        return d.toISOString().split('T')[0];
    }

    groupIntoSessions(hands, breakMinutes) {
        if (hands.length === 0) return [];

        const sessions = [];
        let currentSession = [hands[0]];
        const breakMs = breakMinutes * 60 * 1000;
        const timezoneOffset = this.settings.timezoneOffset || 0;
        
        const getCorrectedDate = (date) => {
            const corrected = new Date(date);
            corrected.setHours(corrected.getHours() + timezoneOffset);
            return corrected;
        };

        for (let i = 1; i < hands.length; i++) {
            const prevHand = hands[i - 1];
            const currentHand = hands[i];
            
            const diff = currentHand.startDate - prevHand.startDate;

            if (diff > breakMs) {
                const firstHandDate = currentSession[0].startDate;
                const lastHandDate = currentSession[currentSession.length - 1].startDate;

                sessions.push({
                    hands: currentSession,
                    startTime: getCorrectedDate(firstHandDate),
                    endTime: getCorrectedDate(lastHandDate),
                    duration: (lastHandDate - firstHandDate) / 1000,
                    netResult: currentSession.reduce((sum, h) => sum + h.result, 0),
                    handsCount: currentSession.length
                });
                currentSession = [currentHand];
            } else {
                currentSession.push(currentHand);
            }
        }

        if (currentSession.length > 0) {
            const firstHandDate = currentSession[0].startDate;
            const lastHandDate = currentSession[currentSession.length - 1].startDate;

            sessions.push({
                hands: currentSession,
                startTime: getCorrectedDate(firstHandDate),
                endTime: getCorrectedDate(lastHandDate),
                duration: (lastHandDate - firstHandDate) / 1000,
                netResult: currentSession.reduce((sum, h) => sum + h.result, 0),
                handsCount: currentSession.length
            });
        }

        return sessions;
    }

    async clearAll() {
        this.hands = [];
        this.stats = null;
        this.calculator.reset();
        await clearHandsFromDB();
    }

    getAllNicks() {
        const nicks = new Set();
        for (const hand of this.hands) {
            for (const player of hand.players) {
                nicks.add(player.name);
            }
        }
        return Array.from(nicks).sort();
    }

    setHero(nick, aliases = []) {
        this.heroNick = nick;
        this.aliases = aliases;
        
        try {
            localStorage.setItem('pokerHeroNick', nick);
            localStorage.setItem('pokerHeroAliases', JSON.stringify(aliases));
        } catch (e) {
            console.error('Error saving hero to localStorage:', e);
        }
        
        if (this.hands.length > 0) {
            this.recalculateStats();
        }
    }

    clearHero() {
        this.heroNick = '';
        this.aliases = [];
        
        try {
            localStorage.removeItem('pokerHeroNick');
            localStorage.removeItem('pokerHeroAliases');
        } catch (e) {
            console.error('Error clearing hero from localStorage:', e);
        }
        
        if (this.hands.length > 0) {
            this.recalculateStats();
        }
    }

    updateSettings(settings) {
        this.settings = Object.assign({}, this.settings, settings);
        this.saveSettings();
        this.recalculateStats();
    }

    async getHandsCount() {
        try {
            return await countHandsInDB();
        } catch (e) {
            console.error('Error counting hands:', e);
            return 0;
        }
    }
}
