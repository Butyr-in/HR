// app.js
// ============================================================
// ГЛАВНОЕ ПРИЛОЖЕНИЕ
// ============================================================

const AppState = {
    currentView: localStorage.getItem('pokerCurrentView') || 'days',
    chartType: localStorage.getItem('pokerChartType') || 'line',
    dateStart: null,
    dateEnd: null,
    expandedDay: null,
    widgetModes: {
        hands: 'total',
        time: 'hours',
        efficiency: 'bb100',
        result: 'eur'
    },
    theme: 'light',
    isProcessing: false,
    chart: null,
    dataManager: null
};

// Инициализация приложения
async function initApp() {
    console.log('🚀 Poker Hand Analyzer starting...');

    if (typeof Chart === 'undefined') {
        showNotification('❌ Ошибка: Chart.js не загружен', 'error');
        console.error('Chart.js не загружен!');
        return;
    }

    if (typeof JSZip === 'undefined') {
        showNotification('❌ Ошибка: JSZip не загружен', 'error');
        console.error('JSZip не загружен!');
        return;
    }

    try {
        AppState.dataManager = new DataManager();
        
        loadSettings();
        
        // 📥 Загружаем сохранённые даты в самом начале, до настройки UI и событий
        const savedDateStart = localStorage.getItem('pokerDateStart');
        const savedDateEnd = localStorage.getItem('pokerDateEnd');
        if (savedDateStart && savedDateEnd) {
            AppState.dateStart = savedDateStart;
            AppState.dateEnd = savedDateEnd;
        }
        
        const loaded = await AppState.dataManager.loadHands();
        if (!loaded) {
            console.warn('⚠️ Не удалось загрузить руки из IndexedDB, продолжаем с пустой базой');
        }
        
        updatePlayerList();

        if (AppState.dataManager.heroNick) {
            document.getElementById('playerSelect').value = AppState.dataManager.heroNick;
            AppState.dataManager.initAfterHeroSelection();
        }

        updateLimitFilter();
        setupEvents();
        updateUI();
        initChart();

        // ✅ Восстанавливаем активную кнопку из localStorage
const savedView = localStorage.getItem('pokerCurrentView') || 'days';
AppState.currentView = savedView;

// ✅ Добавляем класс loaded для контейнера и кнопок
document.querySelector('.chart-mode').classList.add('loaded');

document.querySelectorAll('.chart-btn').forEach(function(b) {
    b.classList.remove('active');
    if (b.dataset.mode === savedView) {
        b.classList.add('active');
    }
    b.classList.add('loaded');
});

// Если ни одна кнопка не совпала — активируем "По дням"
if (!document.querySelector('.chart-btn.active')) {
    const daysBtn = document.querySelector('.chart-btn[data-mode="days"]');
    if (daysBtn) {
        daysBtn.classList.add('active');
        AppState.currentView = 'days';
        localStorage.setItem('pokerCurrentView', 'days');
    }
}

        try {
            const count = await AppState.dataManager.getHandsCount();
            console.log(`📊 Всего рук в БД: ${count}`);
        } catch (e) {
            console.warn('Не удалось получить количество рук:', e);
        }

        document.getElementById('currentYear').textContent = new Date().getFullYear();
        console.log('✅ Poker Hand Analyzer initialized successfully!');
        showNotification('✅ Приложение готово к работе', 'success');
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        showNotification('❌ Ошибка инициализации приложения. Проверьте консоль.', 'error');
        
        try {
            updateUI();
        } catch (e) {
            console.error('Не удалось обновить UI:', e);
        }
    }
}

// Загрузка настроек
function loadSettings() {
    const settings = AppState.dataManager.settings;

    AppState.theme = settings.theme || 'light';
    applyTheme(AppState.theme);
    updateThemeIcon();

    // ✅ ДОБАВЛЕНО: Восстанавливаем сохраненные алиасы из базы при старте приложения
    if (settings.aliases) {
        AppState.dataManager.aliases = settings.aliases;
    }

    const dayStartHours = Math.floor(settings.dayStartHour);
    const dayStartMinutes = (settings.dayStartHour % 1) * 60;
    const dayStartEl = document.getElementById('dayStart');
    if (dayStartEl) {
        dayStartEl.value = String(dayStartHours).padStart(2, '0') + ':' + String(dayStartMinutes).padStart(2, '0');
    }

    const sessionBreakEl = document.getElementById('sessionBreak');
    if (sessionBreakEl) {
        sessionBreakEl.value = settings.sessionBreakMinutes;
    }

    if (settings.currencyRates) {
    const usdRate = document.getElementById('usdRate');
    const rubRate = document.getElementById('rubRate');
    if (usdRate) {
        const usdVal = settings.currencyRates.USD || 1.10;
        usdRate.value = usdVal.toFixed(2);  // ← без replace, просто toFixed
    }
    if (rubRate) {
        const rubVal = settings.currencyRates.RUB || 90.00;
        rubRate.value = rubVal.toFixed(2);
    }
}

    if (settings.widgetModes) {
        AppState.widgetModes = settings.widgetModes;
    }
    // ✅ Устанавливаем часовой пояс ПОСЛЕ загрузки всех настроек
    const timezoneOffset = document.getElementById('timezoneOffset');
    if (timezoneOffset) {
        const savedOffset = AppState.dataManager.settings.timezoneOffset;
        if (savedOffset !== undefined && savedOffset !== null) {
            timezoneOffset.value = savedOffset;
        } else {
            timezoneOffset.value = 0;  // ← значение по умолчанию
        }
    }
}

// Применение темы
function applyTheme(theme) {
    AppState.theme = theme;
    const body = document.body;
    body.className = theme + '-theme';
    
    const app = document.getElementById('app');
    if (app) {
        app.className = 'app';
    }

    // ✅ НАДЁЖНОЕ ОБНОВЛЕНИЕ МЯГКИХ ЦВЕТОВ ГРАФИКА ДЛЯ ВСЕХ ТЕМ
    if (AppState.chart && AppState.chart.options && AppState.chart.options.scales) {
        setTimeout(function() {
            // Считываем второстепенный цвет текста (в тёмной теме это приятный #a0aec0)
            const currentTextColor = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#718096';
            
            AppState.chart.options.scales.x.ticks.color = currentTextColor;
            AppState.chart.options.scales.y.ticks.color = currentTextColor;
            
            AppState.chart.options.scales.x.ticks.font = { weight: '600', size: 11 };
            AppState.chart.options.scales.y.ticks.font = { weight: '600', size: 11 };
            
            AppState.chart.update();
        }, 10);
    }
}



// Переключение темы
function toggleTheme() {
    const themes = ['light', 'dark', 'beige'];
    const currentIndex = themes.indexOf(AppState.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    AppState.theme = nextTheme;
    applyTheme(nextTheme);
    
    AppState.dataManager.updateSettings({ theme: nextTheme });
    
    updateThemeIcon();
    
    showNotification('🎨 Тема: ' + getThemeName(nextTheme), 'info');
}

// Получение названия темы
function getThemeName(theme) {
    const names = {
        light: 'Светлая',
        dark: 'Тёмная',
        beige: 'Бежевая'
    };
    return names[theme] || theme;
}

// Обновление иконки темы
function updateThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    
    const icons = {
        light: '☀️',
        dark: '🌙',
        beige: '💡'
    };
    
    btn.textContent = icons[AppState.theme] || icons.light;
}

// Обновление списка игроков
function updatePlayerList() {
    const nicks = AppState.dataManager.getAllNicks();
    const select = document.getElementById('playerSelect');
    const currentValue = AppState.dataManager.heroNick || select.value;

    select.innerHTML = '<option value="">Выберите игрока</option>';

    for (const nick of nicks) {
        const option = document.createElement('option');
        option.value = nick;
        option.textContent = nick;
        select.appendChild(option);
    }

    if (AppState.dataManager.heroNick) {
        select.value = AppState.dataManager.heroNick;
    } else if (currentValue && nicks.includes(currentValue)) {
        select.value = currentValue;
    }
    // Принудительный разовый запуск пересчета ширины при первой загрузке списка
    if (select.value) {
        select.style.width = 'auto';
    }
}

// Обновление фильтра лимитов (чекбоксы)
function updateLimitFilter() {
    const container = document.getElementById('limitFilter');

    const limits = new Set();
    for (const hand of AppState.dataManager.hands) {
        limits.add('NL' + hand.limit);
    }

    // Сортируем лимиты по возрастанию
    const sortedLimits = Array.from(limits).sort((a, b) => {
        return parseInt(a.replace('NL', '')) - parseInt(b.replace('NL', ''));
    });

    // Загружаем сохранённые лимиты из localStorage
    let selectedLimits = new Set();
    let allSelected = true;
    
    try {
        const saved = localStorage.getItem('pokerSelectedLimits');
        const savedAllSelected = localStorage.getItem('pokerAllSelected');
        
        if (savedAllSelected !== null) {
            allSelected = savedAllSelected === 'true';
        }
        
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                selectedLimits = new Set(parsed);
            }
        }
    } catch (e) {
        console.error('Error loading selected limits:', e);
    }

    container.innerHTML = '';
    
    const allLabel = document.createElement('label');
    allLabel.className = 'checkbox-label';
    allLabel.innerHTML = '<input type="checkbox" value="all"> Все';
    container.appendChild(allLabel);
    
    for (const limit of sortedLimits) {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `<input type="checkbox" value="${limit}"> ${limit}`;
        container.appendChild(label);
    }

    const allCheckbox = container.querySelector('input[value="all"]');
    
    if (allSelected) {
        allCheckbox.checked = true;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.value !== 'all') cb.checked = true;
        });
    } else {
        allCheckbox.checked = false;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (selectedLimits.has(cb.value)) {
                cb.checked = true;
            }
        });
    }
}

// ============================================================
// СОБЫТИЯ
// ============================================================

function setupEvents() {
    document.getElementById('playerSelect').addEventListener('change', function() {
        const nick = this.value;
        AppState.dataManager.setHero(nick, AppState.dataManager.aliases);
        // Сбрасываем жесткую ширину принудительно, чтобы сработало поле field-sizing
        this.style.width = 'auto'; 
        updateUI();
        updateChart();
    });

    document.getElementById('aliasBtn').addEventListener('click', function() {
        document.getElementById('aliasInput').value = (AppState.dataManager.aliases || []).join(', ');
        openModal('aliasModal');
    });

        document.getElementById('saveAliases').addEventListener('click', function() {
        const input = document.getElementById('aliasInput').value.trim();
        const aliases = input.split(',').map(s => s.trim()).filter(s => s);
        
        // 👥 Проверяем, если пользователь ничего не ввел
        if (aliases.length === 0) {
            // Если раньше алиасы были, а теперь поле стёрли — подтверждаем удаление
            if (AppState.dataManager.aliases && AppState.dataManager.aliases.length > 0) {
                if (confirm('Вы очистили поле. Удалить все привязанные алиасы?')) {
                    AppState.dataManager.aliases = [];
                    AppState.dataManager.updateSettings({ aliases: [] });
                    AppState.dataManager.recalculateStats();
                    updateUI();
                    updateChart();
                    closeModal('aliasModal');
                    showNotification('🗑️ Алиасы удалены', 'info');
                }
            } else {
                // Если поля и так были пустые, просто закрываем окно без лишних уведомлений
                closeModal('aliasModal');
            }
            return; // Прерываем выполнение, чтобы не выскакивало ложное уведомление
        }
        
        // ✅ Если ники введены — сохраняем в штатном режиме
        AppState.dataManager.aliases = aliases;
        AppState.dataManager.updateSettings({ aliases: aliases });
        AppState.dataManager.recalculateStats();
        updateUI();
        updateChart();
        closeModal('aliasModal');
        showNotification('👥 Алиасы успешно сохранены', 'success');
    });



    document.getElementById('cancelAliases').addEventListener('click', function() {
        closeModal('aliasModal');
    });

    document.getElementById('aliasModalClose').addEventListener('click', function() {
        closeModal('aliasModal');
    });

    document.getElementById('themeToggle').addEventListener('click', function() {
        toggleTheme();
    });

        document.getElementById('importBtn').addEventListener('click', function() {
        // Принудительно прячем синюю полосу загрузки
        document.getElementById('progressContainer').classList.add('hidden');
        
        // Полностью обнуляем технические индикаторы процентов и файлов
        document.getElementById('progressPercentage').textContent = '0%';
        document.getElementById('progressStage').textContent = 'Подготовка...';
        document.getElementById('processedFiles').textContent = '0';
        document.getElementById('totalFiles').textContent = '0';
        
        // Начисто очищаем и прячем блок со старым отчетом
        const progressStats = document.getElementById('progressStats');
        if (progressStats) {
            progressStats.style.display = 'none';
        }
        document.getElementById('totalHandsFound').textContent = '0';
        document.getElementById('newHandsAdded').textContent = '0';
        document.getElementById('duplicateHandsSkipped').textContent = '0';
        
        // Прячем кнопку "Готово", чтобы она не появилась раньше времени
        const progressActions = document.getElementById('progressActions');
        if (progressActions) {
            progressActions.style.display = 'none';
        }
        
        // 1. Открываем модальное окно (элемент становится видимым в DOM)
        openModal('importModal');

        // 2. ✅ ИСПРАВЛЕНО: Инициализируем Drag'n'Drop строго ПОСЛЕ того, как окно открылось
        setTimeout(function() {
            setupDropZone();
        }, 50);
    });


    document.getElementById('importModalClose').addEventListener('click', function() {
        closeModal('importModal');
    });

    setupDropZone();

    document.getElementById('selectFilesBtn').addEventListener('click', function() {
        document.getElementById('fileInput').click();
    });

    document.getElementById('selectFolderBtn').addEventListener('click', function() {
        document.getElementById('folderInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', function(e) {
        handleFiles(e.target.files);
        this.value = '';
    });

    document.getElementById('folderInput').addEventListener('change', function(e) {
        handleFiles(e.target.files);
        this.value = '';
    });

    document.getElementById('resetBtn').addEventListener('click', async function() {
        if (confirm('Вы уверены, что хотите удалить все данные?')) {
            await AppState.dataManager.clearAll();
            localStorage.removeItem('pokerSelectedLimits');
            localStorage.removeItem('pokerAllSelected');
            
            updateUI();
            updateChart();
            updatePlayerList();
            updateLimitFilter();
            
            if (AppState.dataManager.heroNick) {
                document.getElementById('playerSelect').value = AppState.dataManager.heroNick;
                AppState.dataManager.initAfterHeroSelection();
            }
            
            showNotification('✅ Раздачи удалены', 'success');
        }
    });

    document.getElementById('limitFilter').addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            handleLimitFilterChange(e);
        }
    });

    document.querySelectorAll('.widget').forEach(function(widget) {
        widget.addEventListener('click', function() {
            const type = this.dataset.widget;
            toggleWidgetMode(type);
        });
    });

    document.querySelectorAll('.chart-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.chart-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            AppState.currentView = this.dataset.mode;
            localStorage.setItem('pokerCurrentView', AppState.currentView);
            updateChart();
        });
    });

    document.getElementById('dayStart').addEventListener('change', function() {
        const parts = this.value.split(':').map(Number);
        AppState.dataManager.updateSettings({
            dayStartHour: parts[0] + parts[1] / 60
        });
        updateUI();
        updateDayList(getSelectedLimits());
    });

    document.getElementById('sessionBreak').addEventListener('change', function() {
    const value = this.value.trim();
    if (value === '') {
        // Если поле пустое, ничего не делаем
        return;
    }
    
    let minutes = parseInt(value);
    
    // ✅ Если ввели 0 или меньше — ставим 1
    if (isNaN(minutes) || minutes < 1) {
        minutes = 1;
        this.value = 1;
    }
    
    AppState.dataManager.updateSettings({
        sessionBreakMinutes: minutes
    });
    updateUI();
    updateDayList(getSelectedLimits());
});

    document.getElementById('timezoneOffset').addEventListener('change', function() {
    const offset = parseInt(this.value) || 0;
    AppState.dataManager.updateSettings({ timezoneOffset: offset });
    updateUI();
    updateChart();
    updateDayList(getSelectedLimits());  // ✅ Правильно!
});

    // Загружаем сохранённое значение
const savedOffset = AppState.dataManager.settings.timezoneOffset;
if (savedOffset !== undefined) {
    document.getElementById('timezoneOffset').value = savedOffset;
}

    document.getElementById('updateRatesBtn').addEventListener('click', function() {
        fetchExchangeRates();
    });

    document.getElementById('usdRate').addEventListener('change', saveCurrencyRates);
    document.getElementById('rubRate').addEventListener('change', saveCurrencyRates);

    document.getElementById('overlay').addEventListener('click', function() {
        closeAllModals();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    document.getElementById('closeImportBtn').addEventListener('click', function() {
        closeModal('importModal');
        hideProgress();
    });

    // Инициализация Flatpickr для выбора диапазона дат (С отложенной загрузкой плейсхолдера)
    flatpickr("#dateRange", {
        locale: {
            firstDayOfWeek: 1,
            weekdays: {
                shorthand: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
                longhand: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
            },
            months: {
                shorthand: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
                longhand: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
            },
            rangeSeparator: " — "
        },
        mode: "range",
        dateFormat: "d.m.y",
        closeOnSelect: false,
        // Превращаем сохраненные ISO-строки в полноценные объекты JavaScript Date для корректного старта
        defaultDate: (AppState.dateStart && AppState.dateEnd) ? [new Date(AppState.dateStart), new Date(AppState.dateEnd)] : null,
        onOpen: function() {
            // 🛡️ ЗАЩИТА ОТ БАГА: Если старый оверлей ещё существует в DOM (например, от прошлого быстрого клика), мгновенно удаляем его
            const existingOverlay = document.getElementById('flatpickr-overlay');
            if (existingOverlay) {
                existingOverlay.remove();
            }
        // Создаем затемнение
        const overlay = document.createElement('div');
        overlay.id = 'flatpickr-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 999;
            opacity: 0; /* Стартуем с нулевой прозрачности */
            transition: opacity 1s ease; /* Стабильный переход без багов анимации */
        `;
        document.body.appendChild(overlay);
        
        // Запускаем плавное проявление на следующем кадре рендера
            setTimeout(function() {
                overlay.style.opacity = '1';
            }, 10);

        // Клик по затемнению закрывает календарь
        overlay.addEventListener('click', function() {
            const fp = document.querySelector('#dateRange')._flatpickr;
            if (fp) {
                fp.close();
            }
        });
    },
    onClose: function() {
        const overlay = document.getElementById('flatpickr-overlay');
        if (overlay) {
            // Отключаем физическую поимку кликов оверлеем. Клики мгновенно начнут проходить сквозь него на кнопки и график!
            overlay.style.pointerEvents = 'none'; 
            // Возвращаем прозрачность в 0
            overlay.style.opacity = '0';
            setTimeout(function() {
                overlay.remove();  // ← удаляем ПОСЛЕ анимации
            }, 1000);
        }
    },
        onChange: function(selectedDates, dateStr, instance) {
            // Выполняем фильтрацию только когда пользователь выбрал обе границы диапазона
            if (selectedDates.length === 2) {
                // 🎯 Объявляем функцию конвертации здесь, чтобы JavaScript её видел
                const toISODate = (date) => {
                    if (!date) return '';
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                // ✅ ПРАВИЛЬНО: Передаем объекты дат в функцию и получаем чистый ISO-формат (ГГГГ-ММ-ДД)
                AppState.dateStart = toISODate(selectedDates[0]);
                AppState.dateEnd = toISODate(selectedDates[1] || selectedDates[0]); // Защита: если выбран один день, дублируем его
                
                document.getElementById('dateRange').value = dateStr;
                
                // Сохраняем в localStorage чистый строковый ISO-текст для стабильной загрузки
                localStorage.setItem('pokerDateStart', AppState.dateStart);
                localStorage.setItem('pokerDateEnd', AppState.dateEnd);
                
                updateChart();
                updateUI();
                instance.close();
            } else if (selectedDates.length === 0) {
                // Корректно обрабатываем полное очищение фильтра (клик по крестику)
                AppState.dateStart = null;
                AppState.dateEnd = null;
                document.getElementById('dateRange').value = '';
                
                localStorage.removeItem('pokerDateStart');
                localStorage.removeItem('pokerDateEnd');
                
                updateChart();
                updateUI();
            }
        }
    });

    // Если даты в памяти отсутствуют, просто показываем аккуратный плейсхолдер
    if (!AppState.dateStart || !AppState.dateEnd) {
        document.getElementById('dateRange').placeholder = "Выберите период";
    }

    // Плавно проявляем инпут и крестик вместе, когда Flatpickr полностью готов к работе
    setTimeout(function() {
        const dateInput = document.getElementById('dateRange');
        if (dateInput) dateInput.style.opacity = "1";

        // ✅ Крестик теперь тоже проявляется плавно и одновременно с календарем
        const clearBtn = document.getElementById('clearDateFilter');
        if (clearBtn) clearBtn.style.opacity = "1";
    }, 50);

    // Обработчик клика без дубликатов
    document.getElementById('clearDateFilter').addEventListener('click', function() {
        AppState.dateStart = null;
        AppState.dateEnd = null;
        
        // Сбрасываем внутреннее состояние виджета календаря Flatpickr
        const dateInput = document.getElementById('dateRange');
        const fp = dateInput._flatpickr;
        if (fp) {
            fp.clear(); // Сначала очищаем календарь
        }

        dateInput.value = ''; 
        dateInput.placeholder = "Выберите период"; // <-- Ставим строго после fp.clear()
        
        localStorage.removeItem('pokerDateStart');
        localStorage.removeItem('pokerDateEnd');
        
        updateChart();
        updateUI();
    });
}

// Обработка изменения чекбоксов лимитов
function handleLimitFilterChange(e) {
    const container = document.getElementById('limitFilter');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const allCheckbox = container.querySelector('input[value="all"]');
    
    if (e.target.value === 'all') {
        if (allCheckbox.checked) {
            checkboxes.forEach(cb => {
                if (cb.value !== 'all') cb.checked = true;
            });
            localStorage.setItem('pokerAllSelected', 'true');
            localStorage.setItem('pokerSelectedLimits', '[]');
        } else {
            checkboxes.forEach(cb => {
                if (cb.value !== 'all') cb.checked = false;
            });
            localStorage.setItem('pokerAllSelected', 'false');
            localStorage.setItem('pokerSelectedLimits', '[]');
        }
    } else {
        const checkedSpecific = Array.from(checkboxes).filter(cb => 
            cb.value !== 'all' && cb.checked
        );
        
        if (checkedSpecific.length === 0) {
            allCheckbox.checked = false;
            localStorage.setItem('pokerAllSelected', 'false');
            localStorage.setItem('pokerSelectedLimits', '[]');
        } else if (checkedSpecific.length === checkboxes.length - 1) {
            allCheckbox.checked = true;
            localStorage.setItem('pokerAllSelected', 'true');
            localStorage.setItem('pokerSelectedLimits', '[]');
        } else {
            allCheckbox.checked = false;
            const selectedLimits = checkedSpecific.map(cb => cb.value);
            localStorage.setItem('pokerAllSelected', 'false');
            localStorage.setItem('pokerSelectedLimits', JSON.stringify(selectedLimits));
        }
    }
    
    updateUI();
    updateChart();
}

function saveSelectedLimits() {
    const container = document.getElementById('limitFilter');
    const allCheckbox = container.querySelector('input[value="all"]');
    const selectedLimits = [];
    
    if (!allCheckbox.checked) {
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            if (cb.value !== 'all') {
                selectedLimits.push(cb.value);
            }
        });
    }
    
    try {
        localStorage.setItem('pokerSelectedLimits', JSON.stringify(selectedLimits));
    } catch (e) {
        console.error('Error saving selected limits:', e);
    }
}

// ============================================================
// DROP ZONE
// ============================================================

function setupDropZone() {
    const zone = document.getElementById('dropZone');
    if (!zone) {
        console.warn('⚠️ Элемент #dropZone не найден в DOM');
        return;
    }

    // Отключаем стандартное поведение браузера для всего окна, чтобы вкладка не перезагружалась
    const preventDefault = function(e) {
        e.preventDefault();
        e.stopPropagation();
    };

    window.addEventListener('dragover', preventDefault, false);
    window.addEventListener('drop', preventDefault, false);

    // Привязываем события к зоне сброса
    zone.addEventListener('dragenter', function(e) {
        preventDefault(e);
        zone.classList.add('drag-over');
    }, false);

    zone.addEventListener('dragover', function(e) {
        preventDefault(e);
        zone.classList.add('drag-over');
    }, false);

    zone.addEventListener('dragleave', function(e) {
        preventDefault(e);
        zone.classList.remove('drag-over');
    }, false);

    zone.addEventListener('drop', function(e) {
        preventDefault(e);
        zone.classList.remove('drag-over');
        
        const dt = e.dataTransfer;
        const filesInput = dt.files;
        
        if (filesInput && filesInput.length > 0) {
            console.log('📦 Файлы успешно пойманы через Drag\'n\'Drop:', filesInput.length);
            // Превращаем FileList в обычный массив и передаем в ваш обработчик импорта
            handleFiles(Array.from(filesInput));
        } else {
            showNotification('❌ Не удалось прочитать сброшенные файлы', 'error');
        }
    }, false);
}




function traverseDirectory(entry, files, callback) {
    const reader = entry.createReader();

    reader.readEntries(function(entries) {
        const total = entries.length;
        let processed = 0;

        if (total === 0) {
            callback();
            return;
        }

        for (let i = 0; i < entries.length; i++) {
            const childEntry = entries[i];
            if (childEntry.isDirectory) {
                traverseDirectory(childEntry, files, function() {
                    processed++;
                    if (processed === total) {
                        callback();
                    }
                });
            } else if (childEntry.isFile) {
                childEntry.file(function(file) {
                    files.push(file);
                    processed++;
                    if (processed === total) {
                        callback();
                    }
                });
            }
        }
    });
}

// ============================================================
// ОБРАБОТКА ФАЙЛОВ
// ============================================================

async function handleFiles(fileList) {
    if (AppState.isProcessing) {
        showNotification('⏳ Идет обработка, подождите...', 'warning');
        return;
    }

    AppState.isProcessing = true;
    const files = Array.from(fileList);

    // Скрываем блок с кнопкой и отчётом перед началом обработки
    const progressStats = document.getElementById('progressStats');
    if (progressStats) {
        progressStats.style.display = 'none';
    }
    const progressActions = document.getElementById('progressActions');
    if (progressActions) {
        progressActions.style.display = 'none';
    }
    document.getElementById('totalHandsFound').textContent = '0';
    document.getElementById('newHandsAdded').textContent = '0';
    document.getElementById('duplicateHandsSkipped').textContent = '0';

    const xmlFiles = [];
    const archives = [];

    for (const file of files) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'xml') {
            xmlFiles.push(file);
        } else if (ext === 'zip' || ext === 'rar') {
            archives.push(file);
        }
    }

    if (xmlFiles.length === 0 && archives.length === 0) {
        showNotification('Не найдено файлов для обработки (.xml, .zip, .rar)', 'warning');
        AppState.isProcessing = false;
        return;
    }

    showProgress();
    updateProgress('extracting', 'Распаковка архивов...', 0);

    const extractedFiles = [];
    let totalFiles = xmlFiles.length;

    for (const archive of archives) {
        try {
            const extracted = await extractArchive(archive);
            extractedFiles.push(...extracted);
            totalFiles += extracted.length;
        } catch (error) {
            console.error('Error extracting archive:', error);
            showNotification('Ошибка распаковки: ' + archive.name, 'error');
        }
    }

    const allFiles = xmlFiles.concat(extractedFiles);
    updateProgress('parsing', 'Обработка файлов...', 0, allFiles.length);

    const allHands = [];
    let processed = 0;

    for (const file of allFiles) {
        try {
            const content = await file.text();
            const hands = parseAllHands(content);
            if (hands && hands.length > 0) {
                allHands.push(...hands);
            }
        } catch (error) {
            console.error('Error parsing file:', file.name, error);
        }

        processed++;
        const progress = (processed / allFiles.length) * 100;
        updateProgress('parsing', 'Обработка файлов...', progress, allFiles.length, processed);
    }

    const result = await AppState.dataManager.addHands(allHands);
    
    // Скрываем синий индикатор полосы загрузки
    document.getElementById('progressContainer').classList.add('hidden');
    AppState.isProcessing = false;

    // Включаем отображение отчета и записываем туда свежие цифры
    // Используем уже объявленные переменные progressStats и progressActions
    if (progressStats) {
        progressStats.style.display = 'flex';
    }
    document.getElementById('totalHandsFound').textContent = allHands.length;
    document.getElementById('newHandsAdded').textContent = result.added;
    document.getElementById('duplicateHandsSkipped').textContent = result.duplicates;

    // Показываем кнопку "Готово", чтобы окно закрывалось только по клику
    if (progressActions) {
        progressActions.style.display = 'flex';
    }

    // Выводим всплывающее уведомление на главном экране (под модалкой)
    if (result.added > 0) {
        showNotification('✅ Добавлено ' + result.added + ' новых раздач (' + result.duplicates + ' пропущено дублей)', 'success');
        
        updatePlayerList();
        updateLimitFilter();
        
        if (AppState.dataManager.heroNick) {
            AppState.dataManager.recalculateStats();
            updateUI();
            updateChart();
        } else {
            showNotification('👤 Выберите героя из списка', 'info');
        }
    } else {
        showNotification('ℹ️ Новых раздач не найдено (' + result.duplicates + ' уже загружены)', 'info');
    }
}



async function extractArchive(file) {
    try {
        const zip = await JSZip.loadAsync(file);
        const files = [];

        for (const path in zip.files) {
            const zipEntry = zip.files[path];
            if (zipEntry.name.endsWith('.xml') && !zipEntry.dir) {
                const content = await zipEntry.async('string');
                const extractedFile = new File([content], zipEntry.name, { type: 'text/xml' });
                files.push(extractedFile);
            }
        }

        return files;
    } catch (error) {
        console.error('Error extracting archive:', error);
        return [];
    }
}

// ============================================================
// ПРОГРЕСС-БАР
// ============================================================

function showProgress() {
    document.getElementById('progressContainer').classList.remove('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressPercentage').textContent = '0%';
    document.getElementById('processedFiles').textContent = '0';
    document.getElementById('totalFiles').textContent = '0';
    document.getElementById('totalHandsFound').textContent = '0';
    document.getElementById('newHandsAdded').textContent = '0';
    document.getElementById('duplicateHandsSkipped').textContent = '0';
    // Скрываем счётчики при старте
const progressStats = document.getElementById('progressStats');
if (progressStats) {
    progressStats.style.display = 'none';
}
}

function updateProgress(stage, message, percent, total, processed) {
    const stageMap = {
        'extracting': '📦 Распаковка архивов...',
        'parsing': '📄 Обработка файлов...',
        'saving': '💾 Сохранение данных...'
    };

    document.getElementById('progressStage').textContent = message || stageMap[stage] || stage;
    document.getElementById('progressFill').style.width = Math.min(percent, 100) + '%';
    document.getElementById('progressPercentage').textContent = Math.round(Math.min(percent, 100)) + '%';

    if (total > 0) {
        document.getElementById('processedFiles').textContent = processed;
        document.getElementById('totalFiles').textContent = total;
    }
}

function hideProgress() {
    // Просто прячем синюю полосу, не трогая текст отчета на экране
    document.getElementById('progressContainer').classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
}


function stopProgressAnimation() {
    const progressFill = document.getElementById('progressFill');
    progressFill.style.animation = 'none';
}

function startProgressAnimation() {
    const progressFill = document.getElementById('progressFill');
    progressFill.style.animation = 'shimmer 2s infinite';
}

// ============================================================
// МОДАЛКИ
// ============================================================

// ============================================================
// МОДАЛКИ (Исправлено под поддержку плавного 1s transition)
// ============================================================

// ============================================================
// МОДАЛКИ (Исправлено под плавный 1-секундный переход)
// ============================================================

// ============================================================
// МОДАЛКИ (Исправлено под плавный 1-секундный переход)
// ============================================================

// Глобальный технический указатель для отслеживания активных таймеров закрытия
let modalCloseTimeout = null;

function openModal(id) {
    // Если в памяти висит незавершенный таймер закрытия — мгновенно уничтожаем его!
    if (modalCloseTimeout) {
        clearTimeout(modalCloseTimeout);
        modalCloseTimeout = null;
    }
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById(id);
    
    // 1. Сначала делаем элементы видимыми в DOM структуре
    if (overlay) overlay.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    if (overlay) overlay.style.pointerEvents = 'auto';
    if (modal) modal.style.pointerEvents = 'auto';

    // 2. ✅ ХАК РЕНДЕРА: Даем браузеру 10мс, чтобы считать стартовые стили opacity:0,
    // а затем плавно включаем видимость, запуская transition из CSS
    setTimeout(function() {
        if (overlay) overlay.classList.add('active');
        if (modal) modal.classList.add('active');
    }, 10);
}

function closeModal(id) {
    const overlay = document.getElementById('overlay');
    const modal = document.getElementById(id);
    
    // 1. Мгновенно отключаем физическое перекрытие мыши
    if (overlay) overlay.style.pointerEvents = 'none';
    if (modal) modal.style.pointerEvents = 'none';
    
    // 2. Убираем класс активности, запуская плавное 1-секундное таяние прозрачности обратно в 0
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    
    // 3. Записываем таймер в глобальную переменную, чтобы openModal мог его перехватить
    modalCloseTimeout = setTimeout(function() {
        if (modal) modal.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
        document.body.style.overflow = '';
        modalCloseTimeout = null; // Очищаем указатель после успешного завершения
    }, 1000); // Ровно 1 секунда анимации из CSS
}

function closeAllModals() {
    // Находим все активные модалки и поочередно закрываем их плавно
    document.querySelectorAll('.modal:not(.hidden)').forEach(function(m) {
        closeModal(m.id);
    });
}




// ============================================================
// UI ОБНОВЛЕНИЕ
// ============================================================

function updateUI() {
    const selectedLimits = getSelectedLimits();
    
    // Получаем финальный массив рук, отфильтрованный по датам, лимитам и игроку
    const filteredHands = filterHands(AppState.dataManager.hands);
    
    // Считаем статистику для виджетов по отфильтрованным рукам
    const stats = AppState.dataManager.getStats({ hands: filteredHands });
    updateWidgets(stats);
    
    // Передаем отфильтрованные руки в функцию отрисовки списка дней
    updateDayList(selectedLimits, filteredHands);
}


// Расчёт винрейта bb/100
function calculateBB100(stats) {
    if (!stats || stats.totalHands === 0) return 0;
    
    const bb = (stats.averageLimit || 1) / 100;  // Делим на 100, чтобы получить размер BB
    const hands = stats.totalHands;
    const netResult = stats.netResult || 0;
    
    return (stats.totalBBs / stats.totalHands) * 100;
}

// Расчёт дохода в час
function calculateHourlyIncome(stats) {
    if (!stats || stats.totalTime === 0) return 0;
    
    const netResult = stats.netResult || 0;
    const hours = stats.totalTime / 3600;
    
    return netResult / hours;
}

// ============================================================
// ОБНОВЛЕНИЕ ВИДЖЕТОВ
// ============================================================

function updateWidgets(stats) {
    const widgets = AppState.widgetModes;
    const currencySymbol = getCurrencySymbol();

    // ===== РАЗДАЧИ =====
    const totalHands = stats.totalHands || 0;
    
    if (widgets.hands === 'total') {
        document.getElementById('totalHands').textContent = totalHands;
        document.getElementById('handsPerHour').textContent = 'всего';
    } else if (widgets.hands === 'perHour') {
        const hours = (stats.totalTime || 0) / 3600;
        const perHour = hours > 0 ? Math.round(totalHands / hours) : 0;
        document.getElementById('totalHands').textContent = perHour;
        document.getElementById('handsPerHour').textContent = 'в час';
    } else {
        const days = Object.keys(stats.days || {}).length || 1;
        const perDay = Math.round(totalHands / days);
        document.getElementById('totalHands').textContent = perDay;
        document.getElementById('handsPerHour').textContent = 'в день';
    }

    // ===== ВРЕМЯ =====
    if (widgets.time === 'hours') {
    const totalSeconds = stats.totalTime || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById('totalTime').textContent = hours + ':' + String(minutes).padStart(2, '0');
    document.getElementById('totalTimeMinutes').textContent = 'чч:мм';
} else {
        const minutes = Math.round((stats.totalTime || 0) / 60);
        document.getElementById('totalTime').textContent = minutes;
        document.getElementById('totalTimeMinutes').textContent = 'минуты';
    }

    // ===== КАЧЕСТВО =====
    if (widgets.efficiency === 'bb100') {
        const bb100 = calculateBB100(stats);
        efficiencyValue.textContent = bb100.toFixed(2);
        efficiencyValue.className = 'widget-value ' + (bb100 > 0 ? 'positive' : bb100 < 0 ? 'negative' : '');
        efficiencyDetails.textContent = 'bb/100';
    } else {
        const hourly = calculateHourlyIncome(stats);
        const convertedHourly = convertCurrency(hourly);
        const formattedHourly = (convertedHourly < 0 ? '-' : '') + currencySymbol + Math.abs(convertedHourly).toFixed(2);
        efficiencyValue.textContent = formattedHourly;
        efficiencyValue.className = 'widget-value ' + (convertedHourly > 0 ? 'positive' : convertedHourly < 0 ? 'negative' : '');
        efficiencyDetails.textContent = 'в час';
    }

    // ===== ПРОФИТ =====
const result = stats.netResult || 0;
const convertedResult = convertCurrency(result);
const formattedResult = (convertedResult < 0 ? '-' : '') + currencySymbol + Math.abs(Math.round(convertedResult));

// ✅ РАСЧЕТ ВЫИГРЫША В BB (с округлением до целых)
const totalBBs = stats.totalBBs || 0;
const bbRounded = Math.round(totalBBs);
const bbFormatted = (bbRounded < 0 ? '-' : '') + Math.abs(bbRounded) + ' bb';

document.getElementById('netResult').textContent = formattedResult;
document.getElementById('netResult').className = 'widget-value ' + (convertedResult > 0 ? 'positive' : convertedResult < 0 ? 'negative' : '');

// Обновляем подпись
const currencyName = document.getElementById('resultCurrency');
if (currencyName) {
    const names = {
        eur: 'EUR',
        usd: 'USD',
        rub: 'RUB'
    };
    const currencyLabel = names[AppState.widgetModes.result] || 'EUR';
    // ✅ Показываем только BB с округлением
    currencyName.textContent = bbFormatted;
}
}

function convertCurrency(amount) {
    const rates = AppState.dataManager.settings.currencyRates || {};
    const mode = AppState.widgetModes.result;
    
    if (mode === 'usd') {
        return amount * (rates.USD || 1.10);
    } else if (mode === 'rub') {
        return amount * (rates.RUB || 90.00);
    }
    
    // EUR (по умолчанию)
    return amount;
}

// ============================================================
// ОБНОВЛЕНИЕ СПИСКА ДНЕЙ
// ============================================================

// ============================================================
// ОБНОВЛЕНИЕ СПИСКА ДНЕЙ
// ============================================================

function updateDayList(selectedLimits = [], filteredHands = null) {
    const days = AppState.dataManager.getDays({
        dayStartHour: AppState.dataManager.settings.dayStartHour,
        sessionBreakMinutes: AppState.dataManager.settings.sessionBreakMinutes,
        limits: selectedLimits,
        hands: filteredHands
    });

    // Фильтрация по датам
    let filteredDays = days;
    if (AppState.dateStart) {
        filteredDays = filteredDays.filter(day => day.day >= AppState.dateStart);
    }
    if (AppState.dateEnd) {
        filteredDays = filteredDays.filter(day => day.day <= AppState.dateEnd);
    }

    const container = document.getElementById('dayList');
    const currencySymbol = getCurrencySymbol();

    if (filteredDays.length === 0) {
        container.innerHTML = '<div class="empty-state">Нет данных для отображения</div>';
        return;
    }

    let html = '<div class="day-list-header" id="dayListHeader" style="cursor: pointer;" title="Кликните для копирования">';
    html += '<span>Дата</span>';
    html += '<span>Лимит</span>';
    html += '<span>Раздачи</span>';
    html += '<span>Время</span>';
    html += '<span>Блайнды</span>';  
    html += '<span>Профит</span>';
    html += '</div>';

    for (const day of filteredDays) {
        const isExpanded = AppState.expandedDay === day.day;
        const resultClass = day.netResult > 0 ? 'positive' : day.netResult < 0 ? 'negative' : '';
        const avgLimit = calculateAverageLimitForDay(day);
        
        const convertedDayResult = convertCurrency(day.netResult);
        
        let startStr = formatDate(day.day);
        let endStr = '';

        if (day.sessions && day.sessions.length > 0) {
            const lastSession = day.sessions[day.sessions.length - 1];
            
            if (lastSession.endTime) {
                const endDate = formatDate(lastSession.endTime);
                if (endDate !== startStr) {
                    endStr = ' - ' + endDate;
                }
            }
        }

        const totalSeconds = day.totalTime;
        let timeDisplay;
        if (AppState.widgetModes.time === 'minutes') {
            timeDisplay = Math.round(totalSeconds / 60) + ' мин';
        } else {
            timeDisplay = formatTime(totalSeconds);
        }

        // ✅ Рассчитываем BB для дня
        const dayBB = day.totalBBs || 0;
        const bbFormatted = (dayBB < 0 ? '-' : '') + Math.abs(Math.round(dayBB));
        const bbClass = dayBB > 0 ? 'positive' : dayBB < 0 ? 'negative' : '';

        const activeClass = isExpanded ? ' active' : '';
        html += '<div class="day-item' + activeClass + '" data-day="' + day.day + '">';
        html += '<span class="day-date">' + startStr + (endStr ? ' ' + endStr : '') + '</span>';
        html += '<span class="limit">NL' + avgLimit + '</span>';
        html += '<span class="hands-count">' + day.totalHands + '</span>';
        html += '<span class="time">' + timeDisplay + '</span>';
        html += '<span class="bb ' + bbClass + '">' + bbFormatted + '</span>';
        html += '<span class="result ' + resultClass + '">' + (convertedDayResult < 0 ? '-' : '') + currencySymbol + Math.abs(convertedDayResult).toFixed(2) + '</span>';
        html += '</div>';

        html += '<div class="day-sessions' + (isExpanded ? '' : ' hidden') + '" id="sessions-' + day.day + '">';

        if (isExpanded) {
            for (const session of day.sessions) {
                const sessionClass = session.netResult > 0 ? 'positive' : session.netResult < 0 ? 'negative' : '';
                const sessionAvgLimit = calculateAverageLimitForSession(session);
                const convertedSessionResult = convertCurrency(session.netResult);

                // ✅ BB для сессии
                const sessionBB = session.totalBBs || 0;
                const sessionBBFormatted = (sessionBB < 0 ? '-' : '') + Math.abs(Math.round(sessionBB));
                const sessionBBClass = sessionBB > 0 ? 'positive' : sessionBB < 0 ? 'negative' : '';

                const sessionDuration = session.duration;
                let sessionTimeDisplay;
                if (AppState.widgetModes.time === 'minutes') {
                    sessionTimeDisplay = Math.round(sessionDuration / 60) + ' мин';
                } else {
                    sessionTimeDisplay = formatTime(sessionDuration);
                }

                html += '<div class="session-item">';
                html += '<span class="session-time">' + formatTimeSession(session.startTime, session.endTime) + '</span>';
                html += '<span class="session-limit">NL' + sessionAvgLimit + '</span>';
                html += '<span class="session-hands">' + session.handsCount + '</span>';
                html += '<span class="session-duration">' + sessionTimeDisplay + '</span>';
                html += '<span class="session-bb ' + sessionBBClass + '">' + sessionBBFormatted + '</span>';
                html += '<span class="session-result ' + sessionClass + '">' + (convertedSessionResult < 0 ? '-' : '') + currencySymbol + Math.abs(convertedSessionResult).toFixed(2) + '</span>';
                html += '</div>';
            }
        }

        html += '</div>';
    }

    container.innerHTML = html;

    // ============================================================
    // ✅ ГРУППОВОЕ ВЫДЕЛЕНИЕ ДЛЯ КОПИРОВАНИЯ
    // ============================================================
    const header = document.getElementById('dayListHeader');
    if (header) {
        const groupColumns = [1, 2, 3]; // индексы: 1-Средний лимит, 2-Раздачи, 3-Время
        const spans = header.querySelectorAll('span');

        spans.forEach((span, index) => {
            // При наведении на колонку из группы
            span.addEventListener('mouseenter', function() {
                if (groupColumns.includes(index)) {
                    spans.forEach((s, i) => {
                        if (groupColumns.includes(i)) {
                            s.style.background = 'var(--bg-card)';
                            s.style.color = 'var(--text-primary)';
                            s.style.boxShadow = 'var(--shadow-sm)';
                            s.style.borderRadius = '4px';
                        }
                    });
                }
            });

            // При уходе мыши
            span.addEventListener('mouseleave', function() {
                spans.forEach((s) => {
                    s.style.background = '';
                    s.style.color = '';
                    s.style.boxShadow = '';
                    s.style.borderRadius = '';
                });
            });
        });

        // ============================================================
        // ОБРАБОТЧИК КЛИКА НА ЗАГОЛОВОК (копирование)
        // ============================================================
        header.addEventListener('click', function(e) {
    const target = e.target;
    
    if (target.tagName !== 'SPAN') {
        return;
    }
    
    const columnIndex = Array.from(header.children).indexOf(target);
    const columnText = target?.textContent?.trim() || '';

    // ✅ Только нужные колонки
    const isBBColumn = columnIndex === 4;
    const isGroupColumn = [1, 2, 3].includes(columnIndex);

    // ❌ Выходим, если кликнули по любой другой колонке
    if (!isBBColumn && !isGroupColumn) {
        return;
    }

    const startStr = AppState.dateStart || filteredDays[0].day;
    const endStr = AppState.dateEnd || filteredDays[filteredDays.length - 1].day;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const daysMap = {};
    for (const day of filteredDays) {
        daysMap[day.day] = day;
    }

    const rows = [];
    const currentDate = new Date(startDate.getTime());

    while (currentDate <= endDate) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayObj = String(currentDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${dayObj}`;

        const dayData = daysMap[dateKey];

        if (dayData) {
            if (isBBColumn) {
                const dayBB = dayData.totalBBs || 0;
                const bbFormatted = (dayBB < 0 ? '-' : '') + Math.abs(dayBB).toString().replace('.', ',');
                rows.push([bbFormatted]);
            } else if (isGroupColumn) {
                const avgLimit = (dayData.totalHands > 0 ? 
                    (dayData.hands.reduce((sum, h) => sum + h.limit, 0) / dayData.totalHands) : 0
                ).toString().replace('.', ',');
                const timeMinutes = (dayData.totalTime / 60).toString().replace('.', ',');
                rows.push([avgLimit, dayData.totalHands, timeMinutes]);
            }
        } else {
            // Пустой день
            if (isBBColumn) {
                rows.push(['']);
            } else if (isGroupColumn) {
                rows.push(['', '', '']);
            }
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    const tsv = rows.map(row => row.join('\t')).join('\n');

    navigator.clipboard.writeText(tsv).then(function() {
        let message = '✅ Данные скопированы!';
        if (isBBColumn) message = '✅ BB в буфере обмена!';
        else if (isGroupColumn) message = '✅ Лимит, Раздачи, Время в буфере обмена!';
        showNotification(message, 'success');
    }).catch(function() {
        const textarea = document.createElement('textarea');
        textarea.value = tsv;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        let message = '✅ Данные скопированы!';
        if (isBBColumn) message = '✅ BB в буфере обмена!';
        else if (isGroupColumn) message = '✅ Лимит, Раздачи, Время в буфере обмена!';
        showNotification(message, 'success');
    });
});
    }

    container.querySelectorAll('.day-item').forEach(function(item) {
        item.addEventListener('click', function() {
            const dayKey = this.dataset.day;
            toggleDay(dayKey);
        });
    });
}

function toggleDay(dayKey) {
    if (AppState.expandedDay === dayKey) {
        AppState.expandedDay = null;
    } else {
        AppState.expandedDay = dayKey;
    }
    updateDayList(getSelectedLimits());
}

// ============================================================
// РАСЧЁТ СРЕДНЕГО ЛИМИТА
// ============================================================

function calculateAverageLimitForDay(day) {
    if (!day.hands || day.hands.length === 0) return 0;
    
    let totalHands = 0;
    let weightedSum = 0;
    
    for (const hand of day.hands) {
        totalHands++;
        weightedSum += hand.limit;
    }
    
    return Math.round(weightedSum / totalHands);
}

function calculateAverageLimitForSession(session) {
    if (!session.hands || session.hands.length === 0) return 0;
    
    let totalHands = 0;
    let weightedSum = 0;
    
    for (const hand of session.hands) {
        totalHands++;
        weightedSum += hand.limit;
    }
    
    return Math.round(weightedSum / totalHands);
}

// ============================================================
// ВИДЖЕТЫ ПЕРЕКЛЮЧЕНИЕ
// ============================================================

function toggleWidgetMode(type) {
    const modes = {
        hands: ['total', 'perDay', 'perHour'],
        time: ['hours', 'minutes'],
        efficiency: ['bb100', 'hourly'],
        result: ['eur', 'usd', 'rub']
    };

    const current = AppState.widgetModes[type];
    const modeList = modes[type];
    const currentIndex = modeList.indexOf(current);
    const nextIndex = (currentIndex + 1) % modeList.length;
    AppState.widgetModes[type] = modeList[nextIndex];

    AppState.dataManager.updateSettings({ widgetModes: AppState.widgetModes });
    updateUI();
    updateChart();
}

// ============================================================
// ГРАФИК
// ============================================================

// ============================================================
// ГРАФИК
// ============================================================

function initChart() {
    const ctx = document.getElementById('chartCanvas').getContext('2d');

    // ✅ Скрываем загрузку и показываем canvas
    const loading = document.getElementById('chartLoading');
    const canvas = document.getElementById('chartCanvas');
    if (loading) loading.style.display = 'none';
    if (canvas) canvas.style.display = 'block';

    AppState.chart = new Chart(ctx, {
        type: AppState.chartType, // ✅ Восстанавливаем тип из памяти при старте
        data: {
            labels: [],
            datasets: [{
                label: 'Результат',
                data: [],
                borderColor: '#4299e1',
                backgroundColor: 'rgba(66, 153, 225, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: AppState.chartType === 'bar' ? 0 : 2, // Адаптивный радиус при старте
                pointHoverRadius: AppState.chartType === 'bar' ? 0 : 8,
                pointBackgroundColor: '#4299e1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                clip: false,
                hoverHitRadius: 35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500,
                easing: 'easeOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
                axis: 'x'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 500,
                        easing: 'easeOutQuad'
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    displayColors: false,
                    bodyFont: {
                        family: '"Roboto Mono", monospace',
                        size: 13
                    },
                    titleFont: {
                        family: '"Roboto Mono", monospace',
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const currencySymbol = getCurrencySymbol();
                            const formatted = (value < 0 ? '-' : value > 0 ? '+' : '') + currencySymbol + Math.abs(value).toFixed(2);
                            
                            const index = context.dataIndex;
                            const data = context.dataset.data;
                            
                            if (index > 0 && data[index - 1] !== undefined) {
                                const prevValue = data[index - 1]; // ✅ ИСПРАВЛЕНО: убран несуществующий dataValues
                                const diff = value - prevValue;
                                // ✅ ИСПРАВЛЕНО: теперь и здесь ноль выводится без знака плюса или минуса
                                const diffFormatted = (diff < 0 ? '-' : diff > 0 ? '+' : '') + currencySymbol + Math.abs(diff).toFixed(2);
                                
                                return [
                                    `Результат: ${formatted}`,
                                    `Изменение: ${diffFormatted}`
                                ];
                            }
                            
                            return `Результат: ${formatted}`;
                        }
                    }
                }
            },
            scales: {
    x: { 
        grid: { display: false },
        offset: AppState.chartType === 'bar',
        bounds: AppState.chartType === 'bar' ? 'ticks' : 'data',
        ticks: {
            // ✅ Считываем аккуратный и мягкий цвет текста из CSS текущей темы
            color: function() {
                return getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#718096';
            },
            font: { weight: '600', size: 11 }
        }
    },
    y: {
        grid: {
            color: 'rgba(0,0,0,0.05)'
        },
        ticks: {
            // ✅ И для оси Y подтягиваем этот же цвет
            color: function() {
                return getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#718096';
            },
            font: { weight: '600', size: 11 },
            callback: function(value) {
                const currencySymbol = getCurrencySymbol();
                return (value < 0 ? '-' : '') + currencySymbol + Math.abs(Math.round(value));
            }
        }
    }
},


            onHover: function(event, elements) {
                if (elements && elements.length) {
                    document.getElementById('chartCanvas').style.cursor = 'pointer';
                } else {
                    document.getElementById('chartCanvas').style.cursor = 'default';
                }
            }
        }
    });

    updateChart();

    // Клик по графику для переключения типа
    document.getElementById('chartCanvas').addEventListener('click', function() {
        toggleChartType();
    });
}

function updateChart() {
    if (!AppState.chart || typeof AppState.chart.update !== 'function') return;

    const hands = AppState.dataManager.hands;
    const filteredHands = filterHands(hands);

    if (filteredHands.length === 0) {
        AppState.chart.data.labels = [];
        if (AppState.chart.data.datasets && AppState.chart.data.datasets[0]) {
            AppState.chart.data.datasets[0].data = [];
        }
        AppState.chart.stop();
        AppState.chart.update('none');
        return;
    }

    if (AppState.currentView === 'hands') {
        updateChartByHands(filteredHands);
    } else {
        updateChartByDays(filteredHands);
    }

    const totalResult = filteredHands.reduce((sum, h) => {
        const hero = document.getElementById('playerSelect').value;
        const aliases = AppState.dataManager.aliases || [];
        const player = h.players.find(p => p.name === hero || aliases.includes(p.name));
        return sum + (player ? calculateResult(h.players, hero) : 0);
    }, 0);
    
    const convertedTotalResult = convertCurrency(totalResult);
    const dataValues = AppState.chart.data.datasets[0].data;
    
    if (AppState.chartType === 'bar') {
        // Столбчатый график: красим строго по значению (выше нуля — зеленый, ниже — красный)
        const barColors = dataValues.map(value => {
            return value >= 0 ? 'rgba(72, 187, 120, 0.8)' : 'rgba(252, 129, 129, 0.8)';
        });
        AppState.chart.data.datasets[0].backgroundColor = barColors;
        AppState.chart.data.datasets[0].pointRadius = 0;
        AppState.chart.data.datasets[0].pointHoverRadius = 0;
        AppState.chart.data.datasets[0].borderColor = 'rgba(0,0,0,0)';
    } else {
        // Линейный график
        AppState.chart.data.datasets[0].backgroundColor = convertedTotalResult > 0 ? 'rgba(72, 187, 120, 0.1)' : convertedTotalResult < 0 ? 'rgba(252, 129, 129, 0.1)' : 'rgba(66, 153, 225, 0.1)';
        AppState.chart.data.datasets[0].borderColor = '#4299e1';
        
        // Цвет точек зависит от изменения
        const pointColors = dataValues.map((value, index) => {
            if (index === 0) {
                return value >= 0 ? '#48bb78' : '#fc8181';
            }
            const prevValue = dataValues[index - 1];
            const diff = value - prevValue;
            return diff >= 0 ? '#48bb78' : '#fc8181';
        });
        AppState.chart.data.datasets[0].pointBackgroundColor = pointColors;
        AppState.chart.data.datasets[0].pointRadius = 0; 
        AppState.chart.data.datasets[0].pointHoverRadius = 8;
        AppState.chart.data.datasets[0].hitRadius = 10; // Настройка точной поимки курсора
    }
    
    AppState.chart.options.scales.y.ticks.callback = function(value) {
        return (value < 0 ? '-' : '') + getCurrencySymbol() + Math.abs(Math.round(value));
    };
    AppState.chart.update();
}

// Переключение типа графика
function toggleChartType() {
    if (AppState.chartType === 'line') {
        AppState.chartType = 'bar';
        localStorage.setItem('pokerChartType', 'bar'); // Сохраняем в память
    } else {
        AppState.chartType = 'line';
        localStorage.removeItem('pokerChartType'); // Очищаем кэш для дефолтного значения
    }
    
    // Передаем новый тип в структуру библиотеки
    AppState.chart.config.type = AppState.chartType;
    
    if (AppState.chartType === 'bar') {
        AppState.chart.data.datasets[0].pointRadius = 0;
        AppState.chart.data.datasets[0].pointHoverRadius = 0;
        AppState.chart.data.datasets[0].backgroundColor = null; 
        AppState.chart.data.datasets[0].borderColor = null;

        // Включаем пустые отступы по бокам, чтобы крайние столбцы не резались
        AppState.chart.options.scales.x.offset = true;
        AppState.chart.options.scales.x.bounds = 'ticks';
    } else {
        AppState.chart.data.datasets[0].pointRadius = 0;
        AppState.chart.data.datasets[0].pointHoverRadius = 8;
        AppState.chart.data.datasets[0].borderColor = '#4299e1'; 

        // Прижимаем линию вплотную к краям холста
        AppState.chart.options.scales.x.offset = false;
        AppState.chart.options.scales.x.bounds = 'data';
    }
    
    // Выполняем один чистый перерасчет и обновление анимации
    updateChart();
}





function filterHands(hands) {
    let filtered = [...hands];
    const offset = AppState.dataManager.settings.timezoneOffset || 0;
    const dayStartHour = AppState.dataManager.settings.dayStartHour || 6;

    // 1. Фильтр по начальной дате (строковое сравнение ключей)
    if (AppState.dateStart) {
        filtered = filtered.filter(h => {
            const correctedDate = new Date(h.startDate);
            correctedDate.setHours(correctedDate.getHours() + offset);
            const dayKey = AppState.dataManager.getDayKey(correctedDate, dayStartHour);
            return dayKey >= AppState.dateStart;
        });
    }

    // 2. Фильтр по конечной дате (строковое сравнение ключей)
    if (AppState.dateEnd) {
        filtered = filtered.filter(h => {
            const correctedDate = new Date(h.startDate);
            correctedDate.setHours(correctedDate.getHours() + offset);
            const dayKey = AppState.dataManager.getDayKey(correctedDate, dayStartHour);
            return dayKey <= AppState.dateEnd;
        });
    }

    // 3. Фильтр по лимитам (чекбоксы)
    const limitContainer = document.getElementById('limitFilter');
    const allCheckbox = limitContainer ? limitContainer.querySelector('input[value="all"]') : null;
    
    // Если контейнера или чекбокса еще нет на экране, пропускаем фильтрацию лимитов
    if (allCheckbox && !allCheckbox.checked) {
        const checkedLimits = Array.from(limitContainer.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .filter(v => v !== 'all');
        
        if (checkedLimits.length > 0) {
            filtered = filtered.filter(h => checkedLimits.includes('NL' + h.limit));
        } else {
            filtered = [];
        }
    }

    // 4. Фильтр по выбранному игроку (Hero) и его алиасам
    const hero = document.getElementById('playerSelect').value;
    if (hero) {
        const aliases = AppState.dataManager.aliases || [];
        filtered = filtered.filter(h => {
            return h.players.some(p => p.name === hero || aliases.includes(p.name));
        });
    }

    return filtered;
}


function getSelectedLimits() {
    const limitContainer = document.getElementById('limitFilter');
    const allCheckbox = limitContainer.querySelector('input[value="all"]');
    
    if (allCheckbox.checked) {
        return null;  // ← Изменено!
    }
    
    return Array.from(limitContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value)
        .filter(v => v !== 'all');
}

function updateChartByHands(hands) {
    const chunkSize = Math.max(1, Math.floor(hands.length / 20));
    const labels = [];
    const data = [];
    let cumulative = 0;

    for (let i = 0; i < hands.length; i += chunkSize) {
        const chunk = hands.slice(i, i + chunkSize);
        const chunkResult = chunk.reduce((sum, h) => {
            const hero = document.getElementById('playerSelect').value;
            const aliases = AppState.dataManager.aliases || [];
            const player = h.players.find(p => p.name === hero || aliases.includes(p.name));
            return sum + (player ? calculateResult(h.players, hero) : 0);
        }, 0);
        
            // Сначала накапливаем чистый итог в системной валюте (EUR)
            if (AppState.chartType === 'bar') {
                // Столбчатый график: показываем каждую точку отдельно
                data.push(parseFloat(convertCurrency(chunkResult).toFixed(2)));
            } else {
                // Линейный график: накопленный результат
                cumulative += chunkResult;
                // Конвертируем в выбранную валюту ТОЛЬКО финальную точку перед выводом на график
                data.push(parseFloat(convertCurrency(cumulative).toFixed(2)));
            }

            labels.push(String(i + 1));
        }

    AppState.chart.data.labels = labels;
    AppState.chart.data.datasets[0].data = data;
    AppState.chart.update();
}


function updateChartByDays(hands) {
    const days = {};
    const hero = document.getElementById('playerSelect').value;
    const aliases = AppState.dataManager.aliases || [];
    
    // Синхронизируем дефолтное начало дня (6 утра) с DataManager
    const dayStartHour = AppState.dataManager.settings.dayStartHour !== undefined ? AppState.dataManager.settings.dayStartHour : 6;

    for (const hand of hands) {
        const player = hand.players.find(p => p.name === hero || aliases.includes(p.name));
        if (!player) continue;

        const correctedDate = new Date(hand.startDate);
        correctedDate.setHours(correctedDate.getHours() + (AppState.dataManager.settings.timezoneOffset || 0));
        
        const dayKey = AppState.dataManager.getDayKey(correctedDate, dayStartHour);
        
        if (!days[dayKey]) {
            days[dayKey] = { result: 0, count: 0 };
        }
        
        const result = calculateResult(hand.players, hero);
        days[dayKey].result += result;
        days[dayKey].count++;
    }

    const sortedDays = Object.keys(days).sort();
    const labels = sortedDays.map((_, index) => String(index + 1)); 
    const data = [];
    
    // Считаем нарастающий итог в базовой валюте, а конвертируем ТОЛЬКО при выводе
    let cumulative = 0;
    for (const d of sortedDays) {
        if (AppState.chartType === 'bar') {
            data.push(parseFloat(convertCurrency(days[d].result).toFixed(2)));
        } else {
            cumulative += days[d].result;
            data.push(parseFloat(convertCurrency(cumulative).toFixed(2)));
        }
    }

    AppState.chart.data.labels = labels;
    AppState.chart.data.datasets[0].data = data;
    AppState.chart.update();
}

// ============================================================
// ВАЛЮТЫ
// ============================================================

function getCurrencySymbol() {
    const mode = AppState.widgetModes.result;
    const symbols = {
        eur: '€',
        usd: '$',
        rub: '₽'
    };
    return symbols[mode] || '€';
}

function getCorrectedDate(date) {
    const offset = AppState.dataManager.settings.timezoneOffset || 0;
    const corrected = new Date(date);
    corrected.setHours(corrected.getHours() + offset);
    return corrected;
}

function saveCurrencyRates() {
    const usdEl = document.getElementById('usdRate');
    const rubEl = document.getElementById('rubRate');

    const rates = {
        USD: usdEl ? (parseFloat(usdEl.value.replace(',', '.')) || 1.10) : 1.10,
        EUR: 1.00,
        RUB: rubEl ? (parseFloat(rubEl.value.replace(',', '.')) || 90.00) : 90.00
    };

    AppState.dataManager.updateSettings({ currencyRates: rates });
    
    // ✅ Принудительно отображаем с точкой
    if (usdEl) usdEl.value = rates.USD.toFixed(2);
    if (rubEl) rubEl.value = rates.RUB.toFixed(2);
    
    updateUI();
    if (AppState.chart && typeof AppState.chart.update === 'function') {
        updateChart();
    }
}

async function fetchExchangeRates() {
    const btn = document.getElementById('updateRatesBtn');
    btn.textContent = 'Загрузка...';
    btn.disabled = true;

    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
        const data = await response.json();
        
        if (data.rates) {
            const usd = data.rates.USD || 1.10;
            const rub = data.rates.RUB || 90.00;
            
            // ✅ Принудительно с точкой
            document.getElementById('usdRate').value = usd.toFixed(2);
            document.getElementById('rubRate').value = rub.toFixed(2);
            
            saveCurrencyRates();
            showNotification('✅ Курсы валют обновлены', 'success');
        }
    } catch (error) {
        console.error('Error fetching rates:', error);
        showNotification('❌ Ошибка получения курсов', 'error');
    } finally {
        btn.textContent = 'Обновить';
        btn.disabled = false;
    }
}

// ============================================================
// УТИЛИТЫ
// ============================================================

const activeNotifications = [];

function showNotification(message, type) {
    type = type || 'info';
    const colors = {
        success: '#48bb78',
        error: '#fc8181',
        warning: '#ecc94b',
        info: '#4299e1'
    };

    const notification = document.createElement('div');
    notification.style.cssText =
        'position:fixed;right:20px;padding:12px 20px;' +
        'background:' + (colors[type] || colors.info) + ';color:white;' +
        'border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.2);' +
        'z-index:2000;font-size:14px;max-width:400px;' +
        'animation:bounceIn 0.3s ease;cursor:pointer;' +
        'transition:opacity 0.5s ease, transform 0.3s ease;';
    notification.textContent = message;

    document.body.appendChild(notification);
    
    activeNotifications.push(notification);
    
    updateNotificationPositions();
    
    setTimeout(function() {

        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        
        setTimeout(function() {
            notification.remove();
            const index = activeNotifications.indexOf(notification);
            if (index > -1) {
                activeNotifications.splice(index, 1);
            }
            updateNotificationPositions();
        }, 500);
    }, 3000);

    notification.addEventListener('click', function() {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100px)';
        
        setTimeout(function() {
            notification.remove();
            const index = activeNotifications.indexOf(notification);
            if (index > -1) {
                activeNotifications.splice(index, 1);
            }
            updateNotificationPositions();
        }, 500);
    });
}

function updateNotificationPositions() {
    const bottomOffset = 20;
    const gap = 10;
    
    for (let i = activeNotifications.length - 1; i >= 0; i--) {
        const notification = activeNotifications[i];
        const height = notification.offsetHeight;
        const positionFromBottom = bottomOffset + (activeNotifications.length - 1 - i) * (height + gap);
        
        notification.style.bottom = positionFromBottom + 'px';
    }
}

// Самостоятельная глобальная утилита для форматирования дат
function formatDate(dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}.${month}.${year}`;
}

// ============================================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================

initApp();