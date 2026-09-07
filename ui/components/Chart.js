// ui/components/Chart.js
class ChartComponent {
    constructor(container, callbacks) {
        this.container = container;
        this.callbacks = callbacks;
        this.chart = null;
        this.elements = {};
        this.currentView = 'hands';
        this.dateStart = null;
        this.dateEnd = null;
        
        this.render();
        this.bindEvents();
        this.initChart();
    }
    
    render() {
        this.container.innerHTML = `
            <section class="chart-section">
                <div class="chart-controls">
                    <div class="chart-mode">
                        <button class="chart-btn active" data-mode="hands">По раздачам</button>
                        <button class="chart-btn" data-mode="days">По дням</button>
                    </div>
                    <div class="chart-period">
                        <input type="date" id="dateStart" class="date-input" />
                        <span>—</span>
                        <input type="date" id="dateEnd" class="date-input" />
                        <button id="clearDateFilter" class="btn-sm">✕</button>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="chartCanvas"></canvas>
                </div>
            </section>
        `;
        
        this.elements = {
            chartCanvas: document.getElementById('chartCanvas'),
            chartBtns: this.container.querySelectorAll('.chart-btn'),
            dateStart: document.getElementById('dateStart'),
            dateEnd: document.getElementById('dateEnd'),
            clearDateFilter: document.getElementById('clearDateFilter')
        };
    }
    
    bindEvents() {
        this.elements.chartBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.chartBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentView = btn.dataset.mode;
                if (this.callbacks.onViewChange) {
                    this.callbacks.onViewChange(this.currentView);
                }
            });
        });
        
        this.elements.dateStart.addEventListener('change', () => {
            this.dateStart = this.elements.dateStart.value;
            if (this.callbacks.onDateChange) {
                this.callbacks.onDateChange(this.dateStart, this.dateEnd);
            }
        });
        
        this.elements.dateEnd.addEventListener('change', () => {
            this.dateEnd = this.elements.dateEnd.value;
            if (this.callbacks.onDateChange) {
                this.callbacks.onDateChange(this.dateStart, this.dateEnd);
            }
        });
        
        this.elements.clearDateFilter.addEventListener('click', () => {
            this.dateStart = null;
            this.dateEnd = null;
            this.elements.dateStart.value = '';
            this.elements.dateEnd.value = '';
            if (this.callbacks.onDateChange) {
                this.callbacks.onDateChange(null, null);
            }
        });
    }
    
    initChart() {
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded!');
            return;
        }
        
        const ctx = this.elements.chartCanvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Результат',
                    data: [],
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y.toFixed(2)} €`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });
    }
    
    update(hands, view = null, dateStart = null, dateEnd = null) {
        if (!this.chart) return;
        
        if (view !== null) this.currentView = view;
        if (dateStart !== null) this.dateStart = dateStart;
        if (dateEnd !== null) this.dateEnd = dateEnd;
        
        let filteredHands = this.filterHands(hands);
        
        if (filteredHands.length === 0) {
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            this.chart.update();
            return;
        }
        
        if (this.currentView === 'hands') {
            this.updateByHands(filteredHands);
        } else {
            this.updateByDays(filteredHands);
        }
    }
    
    filterHands(hands) {
        let filtered = [...hands];
        
        if (this.dateStart) {
            const start = new Date(this.dateStart);
            filtered = filtered.filter(h => new Date(h.startDate) >= start);
        }
        if (this.dateEnd) {
            const end = new Date(this.dateEnd);
            end.setHours(23, 59, 59);
            filtered = filtered.filter(h => new Date(h.startDate) <= end);
        }
        
        return filtered;
    }
    
    updateByHands(hands) {
        const chunkSize = Math.max(1, Math.floor(hands.length / 10));
        const labels = [];
        const data = [];
        let cumulative = 0;
        
        for (let i = 0; i < hands.length; i += chunkSize) {
            const chunk = hands.slice(i, i + chunkSize);
            const chunkResult = chunk.reduce((sum, h) => sum + h.result, 0);
            cumulative += chunkResult;
            
            labels.push(`#${i + 1}`);
            data.push(cumulative);
        }
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }
    
    updateByDays(hands) {
        const days = {};
        
        for (const hand of hands) {
            const dayKey = hand.startDate.toISOString().split('T')[0];
            if (!days[dayKey]) {
                days[dayKey] = { result: 0, count: 0 };
            }
            days[dayKey].result += hand.result;
            days[dayKey].count++;
        }
        
        const sortedDays = Object.keys(days).sort();
        const labels = sortedDays.map(d => this.formatDate(d));
        const data = sortedDays.map(d => days[d].result);
        
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    }
    
    formatDate(dateStr) {
        const date = new Date(dateStr);
        const options = { day: '2-digit', month: '2-digit' };
        return date.toLocaleDateString('ru-RU', options);
    }
    
    getView() {
        return this.currentView;
    }
    
    getDateRange() {
        return { start: this.dateStart, end: this.dateEnd };
    }
}

