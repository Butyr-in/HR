// core/data/statsCalculator.js
// ============================================================
// Калькулятор статистики
// ============================================================

class StatsCalculator {
    constructor(settings = {}) {
    this.settings = settings;
    this.reset();
}

    reset() {
        this.stats = {
            totalHands: 0,
            totalWon: 0,
            totalLost: 0,
            netResult: 0,
            limits: {},
            days: {},
            handsByCards: {}
        };
    }

    addHand(hand) {
        const stats = this.stats;

        stats.totalHands++;
        if (hand.result > 0) stats.totalWon++;
        if (hand.result < 0) stats.totalLost++;
        stats.netResult += hand.result;

        const limitKey = 'NL' + hand.limit;
        if (!stats.limits[limitKey]) {
            stats.limits[limitKey] = { hands: 0, netResult: 0 };
        }
        stats.limits[limitKey].hands++;
        stats.limits[limitKey].netResult += hand.result;

        // Динамический расчет игрового дня без использования .toISOString() ---
        const offset = this.settings?.timezoneOffset || 0;
        const dayStartHour = this.settings?.dayStartHour || 6;

        // Создаем копию, чтобы не мутировать исходный объект hand.startDate
        const correctedDate = new Date(hand.startDate.getTime());
        correctedDate.setHours(correctedDate.getHours() + offset);

        // Смещаем дату назад, если час меньше часа начала нового рабочего дня
        if (correctedDate.getHours() < dayStartHour) {
            correctedDate.setDate(correctedDate.getDate() - 1);
        }
        
        // Гарантированно собираем текстовый ключ YYYY-MM-DD по локальному времени, а не по UTC
        const year = correctedDate.getFullYear();
        const month = String(correctedDate.getMonth() + 1).padStart(2, '0');
        const day = String(correctedDate.getDate()).padStart(2, '0');
        const dayKey = `${year}-${month}-${day}`;
        // -------------------------------------------------------------------------------------

        if (!stats.days[dayKey]) {
            stats.days[dayKey] = {
                hands: [],
                netResult: 0,
                sessions: []
            };
        }
        stats.days[dayKey].hands.push(hand);
        stats.days[dayKey].netResult += hand.result;
    }



    getStats(breakMinutes) {
    breakMinutes = breakMinutes || 5;
    const stats = this.stats;

    if (!stats) {
        return {
            totalHands: 0,
            totalWon: 0,
            totalLost: 0,
            netResult: 0,
            limits: {},
            vpipHands: 0,
            pfrHands: 0,
            threeBetCount: 0,
            threeBetOpportunities: 0,
            foldToThreeBetCount: 0,
            foldToThreeBetOpportunities: 0,
            rfiCount: 0,
            rfiOpportunities: 0,
            callVsRfiCount: 0,
            callVsRfiOpportunities: 0,
            vpipPercent: 0,
            pfrPercent: 0,
            threeBetPercent: 0,
            foldToThreeBetPercent: 0,
            rfiPercent: 0,
            callVsRfiPercent: 0,
            averageLimit: 0,
            favoriteLimit: 'NL0',
            positions: {},
            totalTime: 0,
            topHands: [],
            days: {}
        };
    }

    const result = {
        totalHands: stats.totalHands,
        totalWon: stats.totalWon,
        totalLost: stats.totalLost,
        netResult: stats.netResult,
        limits: stats.limits,
        vpipHands: stats.vpipHands,
        pfrHands: stats.pfrHands,
        threeBetCount: stats.threeBetCount,
        threeBetOpportunities: stats.threeBetOpportunities,
        foldToThreeBetCount: stats.foldToThreeBetCount,
        foldToThreeBetOpportunities: stats.foldToThreeBetOpportunities,
        rfiCount: stats.rfiCount,
        rfiOpportunities: stats.rfiOpportunities,
        callVsRfiCount: stats.callVsRfiCount,
        callVsRfiOpportunities: stats.callVsRfiOpportunities,
        vpipPercent: stats.totalHands > 0 ? (stats.vpipHands / stats.totalHands * 100) : 0,
        pfrPercent: stats.totalHands > 0 ? (stats.pfrHands / stats.totalHands * 100) : 0,
        threeBetPercent: stats.threeBetOpportunities > 0 ? (stats.threeBetCount / stats.threeBetOpportunities * 100) : 0,
        foldToThreeBetPercent: stats.foldToThreeBetOpportunities > 0 ? (stats.foldToThreeBetCount / stats.foldToThreeBetOpportunities * 100) : 0,
        rfiPercent: stats.rfiOpportunities > 0 ? (stats.rfiCount / stats.rfiOpportunities * 100) : 0,
        callVsRfiPercent: stats.callVsRfiOpportunities > 0 ? (stats.callVsRfiCount / stats.callVsRfiOpportunities * 100) : 0,
        averageLimit: this.calculateAverageLimit(stats.limits),
        favoriteLimit: this.calculateFavoriteLimit(stats.limits),
        positions: this.calculatePositionStats(stats.positions),
        totalTime: this.calculateTotalTime(stats.days, breakMinutes, this.settings?.dayStartHour || 6),
        topHands: this.getTopHands(stats.handsByCards, 10),
        days: stats.days
    };

    return result;
}

    calculateAverageLimit(limits) {
        let totalHands = 0;
        let weightedSum = 0;

        for (const limit in limits) {
            const limitValue = parseInt(limit.replace('NL', ''));
            totalHands += limits[limit].hands;
            weightedSum += limitValue * limits[limit].hands;
        }

        return totalHands > 0 ? Math.round(weightedSum / totalHands) : 0;
    }

    calculateFavoriteLimit(limits) {
        let favorite = null;
        let maxHands = 0;

        for (const limit in limits) {
            if (limits[limit].hands > maxHands) {
                maxHands = limits[limit].hands;
                favorite = limit;
            }
        }

        return favorite || 'NL0';
    }

    calculatePositionStats(positions) {
        const result = {};

        for (const pos in positions) {
            const data = positions[pos];
            if (data.hands === 0) {
                result[pos] = {
                    hands: 0,
                    netResult: 0,
                    vpip: 0,
                    pfr: 0,
                    threeBet: 0,
                    foldToThreeBet: 0,
                    rfi: 0,
                    callVsRfi: 0
                };
                continue;
            }

            result[pos] = {
                hands: data.hands,
                netResult: data.netResult,
                vpip: (data.vpip / data.hands) * 100,
                pfr: (data.pfr / data.hands) * 100,
                threeBet: data.threeBetOpportunities > 0 ? (data.threeBet / data.threeBetOpportunities) * 100 : 0,
                foldToThreeBet: data.foldToThreeBetOpportunities > 0 ? (data.foldToThreeBetCount / data.foldToThreeBetOpportunities) * 100 : 0,
                rfi: data.hands > 0 ? ((data.rfi || 0) / data.hands) * 100 : 0,
                callVsRfi: data.hands > 0 ? ((data.callVsRfi || 0) / data.hands) * 100 : 0
            };
        }

        return result;
    }

    calculateTotalTime(days, breakMinutes, dayStartHour) {
    let totalSeconds = 0;

    for (const dayKey in days) {
        const dayData = days[dayKey];
        const hands = dayData.hands;
        if (hands.length === 0) continue;

        const sortedHands = hands.slice().sort((a, b) => a.startDate - b.startDate);
        const sessions = this.groupIntoSessions(sortedHands, breakMinutes, dayStartHour);
        dayData.sessions = sessions;

        for (const session of sessions) {
            totalSeconds += session.duration;
        }
    }

    return totalSeconds;
}

    groupIntoSessions(hands, breakMinutes, dayStartHour) {
        if (hands.length === 0) return [];

        dayStartHour = dayStartHour || 6;
        const breakMs = breakMinutes * 60 * 1000;
        const timezoneOffset = this.settings?.timezoneOffset || 0; 
        
        // Исправлено: теперь метод корректно берёт часы у переменной corrected
        const getCorrectedDate = (date) => {
            const corrected = new Date(date.getTime());
            corrected.setHours(corrected.getHours() + timezoneOffset);
            return corrected;
        };

        // Функция для проверки: относится ли дата к тому же рабочему дню
        const isSameWorkDay = (date1, date2) => {
            const day1 = this.getDayKey(date1, dayStartHour);
            const day2 = this.getDayKey(date2, dayStartHour);
            return day1 === day2;
        };

        const sessions = [];
        let currentSession = [hands[0]];

        for (let i = 1; i < hands.length; i++) {
            const prevHand = hands[i - 1];
            const currentHand = hands[i];
            
            const diff = currentHand.startDate - prevHand.startDate;
            
            // Проверяем перерыв ИЛИ переход на новый рабочий день с учетом часового пояса
            const isBreak = diff > breakMs;
            const isNewDay = !isSameWorkDay(getCorrectedDate(prevHand.startDate), getCorrectedDate(currentHand.startDate));

            if (isBreak || isNewDay) {
                const firstHandDate = currentSession[0].startDate; // Исправлен индекс [0]
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
            const firstHandDate = currentSession[0].startDate; // Исправлен индекс [0]
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


getDayKey(date, dayStartHour) {
    const d = new Date(date.getTime());
    const hours = d.getHours();
    if (hours < dayStartHour) {
        d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

    getTopHands(handsByCards, limit) {
        limit = limit || 10;
        let entries = Object.entries(handsByCards);
        entries.sort((a, b) => b[1].hands - a[1].hands);
        entries = entries.slice(0, limit);

        return entries.map(([cards, data]) => ({
            cards: cards,
            hands: data.hands,
            netResult: data.netResult,
            vpipPercent: (data.vpip / data.hands) * 100,
            pfrPercent: (data.pfr / data.hands) * 100
        }));
    }
}