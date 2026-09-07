// app.js
// ============================================================
// ГЛАВНОЕ ПРИЛОЖЕНИЕ
// ============================================================

const AppState = {
    currentView: 'hands',
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
        
        // 📥 Загружаем сохранённые даты в самом начале, до настройки UI и событий
        const savedDateStart = localStorage.getItem('pokerDateStart');
        const savedDateEnd = localStorage.getItem('pokerDateEnd');
        if (savedDateStart && savedDateEnd) {
            AppState.dateStart = savedDateStart;
            AppState.dateEnd = savedDateEnd;
        }

        loadSettings();
        
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
        setupEvents(); // Внутри setupEvents ваш код инициализации Flatpickr подхватит эти даты корректно
        updateUI();
        initChart();

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
        if (usdRate) usdRate.value = settings.currencyRates.USD || 1.10;
        if (rubRate) rubRate.value = settings.currencyRates.RUB || 90.00;
    }

    if (settings.widgetModes) {
        AppState.widgetModes = settings.widgetModes;
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
        updateUI();
        updateChart();
    });

    document.getElementById('aliasBtn').addEventListener('click', function() {
        document.getElementById('aliasInput').value = (AppState.dataManager.aliases || []).join(', ');
        openModal('aliasModal');
    });

    document.getElementById('saveAliases').addEventListener('click', function() {
        const input = document.getElementById('aliasInput').value;
        const aliases = input.split(',').map(s => s.trim()).filter(s => s);
        AppState.dataManager.aliases = aliases;
        AppState.dataManager.recalculateStats();
        updateUI();
        updateChart();
        closeModal('aliasModal');
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
        
        // Открываем стерильно чистое модальное окно
        openModal('importModal');
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
        const minutes = parseInt(this.value) || 5;
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

    // Инициализация Flatpickr для выбора диапазона дат (Полная изоляция от часовых поясов ПК)
    flatpickr("#dateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        // Передаем строго текстовые строки, запрещая Flatpickr неявно вызывать конструктор new Date() по UTC
        defaultDate: (AppState.dateStart && AppState.dateEnd) ? [AppState.dateStart, AppState.dateEnd] : null,
        onChange: function(selectedDates, dateStr, instance) {
            // Выполняем фильтрацию только когда пользователь выбрал обе границы диапазона
            if (selectedDates.length === 2) {
                // Извлекаем чистые текстовые строки формата YYYY-MM-DD напрямую из инпута плагина
                const dates = dateStr.split(" to ");
                AppState.dateStart = dates[0];
                AppState.dateEnd = dates[1];
                
                document.getElementById('dateRange').value = dateStr;
                
                // Сохраняем в localStorage чистый текст, соответствующий датам из архивов раздач
                localStorage.setItem('pokerDateStart', AppState.dateStart);
                localStorage.setItem('pokerDateEnd', AppState.dateEnd);
                
                updateChart();
                updateDayList();
                updateUI();
            } else if (selectedDates.length === 0) {
                // Корректно обрабатываем полное очищение фильтра (клик по крестику)
                AppState.dateStart = null;
                AppState.dateEnd = null;
                document.getElementById('dateRange').value = '';
                
                localStorage.removeItem('pokerDateStart');
                localStorage.removeItem('pokerDateEnd');
                
                updateChart();
                updateDayList();
                updateUI();
            }
        }
    });

    // Установка текстового значения в инпут при загрузке страницы (без создания объектов Date)
    if (AppState.dateStart && AppState.dateEnd) {
        document.getElementById('dateRange').value = AppState.dateStart + ' to ' + AppState.dateEnd;
    }

    // Обработчик кнопки ручного сброса фильтра дат
    document.getElementById('clearDateFilter').addEventListener('click', function() {
        AppState.dateStart = null;
        AppState.dateEnd = null;
        document.getElementById('dateRange').value = '';
        
        localStorage.removeItem('pokerDateStart');
        localStorage.removeItem('pokerDateEnd');
        
        // Начисто сбрасываем внутреннее визуальное состояние самого виджета календаря
        const fp = document.querySelector('#dateRange')._flatpickr;
        if (fp) {
            fp.clear();
        }
        
        updateChart();
        updateDayList(getSelectedLimits());
        updateUI();
    });

// Устанавливаем сохранённое значение в поле и календаре
if (AppState.dateStart && AppState.dateEnd) {
    document.getElementById('dateRange').value = AppState.dateStart + ' to ' + AppState.dateEnd;
    
    // Обновляем Flatpickr
    const fp = document.querySelector('#dateRange')._flatpickr;
    if (fp) {
        fp.setDate([AppState.dateStart, AppState.dateEnd], true);
    }
}

document.getElementById('clearDateFilter').addEventListener('click', function() {
        AppState.dateStart = null;
        AppState.dateEnd = null;
        
        // Явно очищаем поле и localStorage
        document.getElementById('dateRange').value = '';
        localStorage.removeItem('pokerDateStart');
        localStorage.removeItem('pokerDateEnd');
        
        // Сбрасываем сам плагин календаря
        const fp = document.querySelector('#dateRange')._flatpickr;
        if (fp) {
            fp.clear(); 
        }
        
        updateChart();
        updateDayList(getSelectedLimits());
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

    ['dragenter', 'dragover'].forEach(function(event) {
        zone.addEventListener(event, function(e) {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(function(event) {
        zone.addEventListener(event, function(e) {
            e.preventDefault();
            zone.classList.remove('drag-over');
        });
    });

    zone.addEventListener('drop', function(e) {
        e.preventDefault();
        const items = e.dataTransfer.items;
        const files = [];
        let totalItems = items.length;
        let processed = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;

            if (entry) {
                if (entry.isDirectory) {
                    traverseDirectory(entry, files, function() {
                        processed++;
                        if (processed === totalItems) {
                            handleFiles(files);
                        }
                    });
                } else if (entry.isFile) {
                    entry.file(function(file) {
                        files.push(file);
                        processed++;
                        if (processed === totalItems) {
                            handleFiles(files);
                        }
                    });
                }
            } else {
                const file = item.getAsFile();
                if (file) {
                    files.push(file);
                }
                processed++;
                if (processed === totalItems) {
                    handleFiles(files);
                }
            }
        }

        if (files.length > 0 && processed === totalItems) {
            handleFiles(files);
        }
    });
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

function openModal(id) {
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(function(m) {
        m.classList.add('hidden');
    });
    document.getElementById('overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================================
// UI ОБНОВЛЕНИЕ
// ============================================================

function updateUI() {
    const selectedLimits = getSelectedLimits();
    
    // Получаем финальный массив рук, отфильтрованный по датам, лимитам и игроку
    const filteredHands = filterHands(AppState.dataManager.hands);
    
    // Передаем руки в getStats БЕЗ ключа limits, чтобы DataManager не сбрасывал фильтр дат
    const stats = AppState.dataManager.getStats({ hands: filteredHands });
    
    updateWidgets(stats);
    updateDayList(selectedLimits);
}


// Расчёт винрейта bb/100
function calculateBB100(stats) {
    if (!stats || stats.totalHands === 0) return 0;
    
    const bb = stats.averageLimit || 1;
    const hands = stats.totalHands;
    const netResult = stats.netResult || 0;
    
    return (netResult / (bb * hands)) * 100;
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
        document.getElementById('handsPerHour').textContent = 'Всего';
    } else if (widgets.hands === 'perHour') {
        const hours = (stats.totalTime || 0) / 3600;
        const perHour = hours > 0 ? Math.round(totalHands / hours) : 0;
        document.getElementById('totalHands').textContent = perHour;
        document.getElementById('handsPerHour').textContent = 'В час';
    } else {
        const days = Object.keys(stats.days || {}).length || 1;
        const perDay = Math.round(totalHands / days);
        document.getElementById('totalHands').textContent = perDay;
        document.getElementById('handsPerHour').textContent = 'В день';
    }

    // ===== ВРЕМЯ =====
    if (widgets.time === 'hours') {
    const totalSeconds = stats.totalTime || 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    document.getElementById('totalTime').textContent = hours + ':' + String(minutes).padStart(2, '0');
    document.getElementById('totalTimeMinutes').textContent = 'ЧЧ:ММ';
} else {
        const minutes = Math.round((stats.totalTime || 0) / 60);
        document.getElementById('totalTime').textContent = minutes;
        document.getElementById('totalTimeMinutes').textContent = 'Минуты';
    }

    // ===== ЭФФЕКТИВНОСТЬ =====
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
        efficiencyDetails.textContent = 'Доход в час';
    }

    // ===== ОБЩИЙ РЕЗУЛЬТАТ =====
    const result = stats.netResult || 0;
const convertedResult = convertCurrency(result);
const formattedResult = (convertedResult < 0 ? '-' : '') + currencySymbol + Math.abs(Math.round(convertedResult));
document.getElementById('netResult').textContent = formattedResult;
document.getElementById('netResult').className = 'widget-value ' + (convertedResult > 0 ? 'positive' : convertedResult < 0 ? 'negative' : '');
// Обновляем подпись валюты
const currencyName = document.getElementById('resultCurrency');
if (currencyName) {
    const names = {
        eur: 'EUR',
        usd: 'USD',
        rub: 'RUB'
    };
    currencyName.textContent = names[AppState.widgetModes.result] || 'EUR';
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

function updateDayList(selectedLimits = []) {
    const days = AppState.dataManager.getDays({
        dayStartHour: AppState.dataManager.settings.dayStartHour,
        sessionBreakMinutes: AppState.dataManager.settings.sessionBreakMinutes,
        limits: selectedLimits
    });

    // ✅ Заменяем только этот блок на чистое строковое сравнение:
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
    html += '<span>День</span>';
    html += '<span>Лимит</span>';
    html += '<span>Раздачи</span>';
    html += '<span>Время</span>';
    html += '<span>Результат</span>';
    html += '</div>';

    for (const day of filteredDays) {
        const isExpanded = AppState.expandedDay === day.day;
        const resultClass = day.netResult > 0 ? 'positive' : day.netResult < 0 ? 'negative' : '';
        const avgLimit = calculateAverageLimitForDay(day);
        
        const convertedDayResult = convertCurrency(day.netResult);
        
        // Безопасно вытаскиваем реальное время начала первой сессии и конца последней сессии дня
        let startStr = formatDate(day.day);
        let endStr = '';
        
        if (day.sessions && day.sessions.length > 0) {
            const firstSession = day.sessions[0];
            const lastSession = day.sessions[day.sessions.length - 1];
            
            // Если объекты дат существуют, форматируем их в красивую строку с часами и минутами
            if (firstSession.startTime && lastSession.endTime) {
                const startHours = firstSession.startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const endHours = lastSession.endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                
                startStr = formatDate(day.day) + ' ' + startHours;
                endStr = ' - ' + endHours;
            }
        }

        html += '<div class="day-item" data-day="' + day.day + '">';
        html += '<span class="day-date">' + startStr + ' - ' + endStr + '</span>';
        html += '<span class="limit">NL' + avgLimit + '</span>';
        html += '<span class="hands-count">' + day.totalHands + '</span>';
        html += '<span class="time">' + formatTime(day.totalTime) + '</span>';
        html += '<span class="result ' + resultClass + '">' + (convertedDayResult < 0 ? '-' : '') + currencySymbol + Math.abs(convertedDayResult).toFixed(2) + '</span>';
        html += '</div>';

        html += '<div class="day-sessions' + (isExpanded ? '' : ' hidden') + '" id="sessions-' + day.day + '">';

        if (isExpanded) {
            for (const session of day.sessions) {
                const sessionClass = session.netResult > 0 ? 'positive' : session.netResult < 0 ? 'negative' : '';
                const sessionAvgLimit = calculateAverageLimitForSession(session);
                const convertedSessionResult = convertCurrency(session.netResult);

                html += '<div class="session-item">';
                html += '<span class="session-time">' + formatTimeSession(session.startTime, session.endTime) + '</span>';
                html += '<span class="session-limit">NL' + sessionAvgLimit + '</span>';
                html += '<span class="session-hands">' + session.handsCount + '</span>';
                html += '<span class="session-duration">' + formatTime(session.duration) + '</span>';
                html += '<span class="session-result ' + sessionClass + '">' + (convertedSessionResult < 0 ? '-' : '') + currencySymbol + Math.abs(convertedSessionResult).toFixed(2) + '</span>';
                html += '</div>';
            }
        }

        html += '</div>';
    }

    container.innerHTML = html;

    // Добавляем обработчик клика на заголовок
    const header = document.getElementById('dayListHeader');
    if (header) {
        header.addEventListener('click', function() {
    const rows = [];
    
    for (const day of filteredDays) {
        // Средний лимит с точностью до сотых
        const avgLimit = (day.totalHands > 0 ? 
            (day.hands.reduce((sum, h) => sum + h.limit, 0) / day.totalHands) : 0
        ).toFixed(2).replace('.', ',');
        
        const timeMinutes = (day.totalTime / 60).toFixed(2).replace('.', ',');
        
        rows.push([
            avgLimit,  // ← Теперь с точностью до сотых (например, 5,50)
            day.totalHands,
            timeMinutes
        ]);
    }
            
            const tsv = rows.map(row => row.join('\t')).join('\n');
            
            navigator.clipboard.writeText(tsv).then(function() {
                showNotification('✅ Данные скопированы!', 'success');
            }).catch(function() {
                const textarea = document.createElement('textarea');
                textarea.value = tsv;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showNotification('✅ Данные скопированы!', 'success');
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
}

// ============================================================
// ГРАФИК
// ============================================================

function initChart() {
    const ctx = document.getElementById('chartCanvas').getContext('2d');

    AppState.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Результат',
                data: [],
                borderColor: '#4299e1',
                backgroundColor: 'rgba(66, 153, 225, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 8,
                pointBackgroundColor: '#4299e1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            const currencySymbol = getCurrencySymbol();
                            const formatted = (value < 0 ? '-' : '') + currencySymbol + Math.abs(value).toFixed(2);
                            return formatted;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
    grid: {
        color: 'rgba(0,0,0,0.05)'
    },
    ticks: {
        precision: 2,
        callback: function(value) {
            const currencySymbol = getCurrencySymbol();
            // Простое форматирование без лишних нулей
            return (value < 0 ? '-' : '') + currencySymbol + Math.abs(value).toFixed(2);
        }
    }
}
            }
        }
    });

    updateChart();
}

function updateChart() {
    // ✅ ЖЕЛЕЗОБЕТОННЫЙ ПРЕДОХРАНИТЕЛЬ: Если график ещё не инициализирован в initChart, выходим без ошибок
    if (!AppState.chart || typeof AppState.chart.update !== 'function') return;

    const hands = AppState.dataManager.hands;
    const filteredHands = filterHands(hands);

    // Безопасный сброс анимаций и очистка холста при нулевом результате
    if (filteredHands.length === 0) {
        AppState.chart.data.labels = [];
        if (AppState.chart.data.datasets && AppState.chart.data.datasets[0]) {
            AppState.chart.data.datasets[0].data = [];
        }
        AppState.chart.stop(); // Останавливаем текущие анимации рендера, предотвращая баг мерцания
        AppState.chart.update('none'); // Обновляем холст мгновенно без анимационных переходов
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
    
    // Динамическое изменение бэкграунда зоны под графиком (зеленый/красный в зависимости от сессии)
    AppState.chart.data.datasets[0].backgroundColor = convertedTotalResult > 0 ? 'rgba(72, 187, 120, 0.1)' : convertedTotalResult < 0 ? 'rgba(252, 129, 129, 0.1)' : 'rgba(66, 153, 225, 0.1)';
    AppState.chart.data.datasets[0].pointBackgroundColor = AppState.chart.data.datasets[0].data.map(value => 
        value < 0 ? '#fc8181' : '#48bb78'
    );
    
    AppState.chart.update();
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
        cumulative += chunkResult;

        labels.push(String(i + 1));
        // Конвертируем в выбранную валюту ТОЛЬКО финальную точку перед выводом на график
        data.push(parseFloat(convertCurrency(cumulative).toFixed(2)));
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
    const labels = sortedDays.map(d => formatDate(d));
    const data = [];
    
    // Считаем нарастающий итог в базовой валюте, а конвертируем ТОЛЬКО при выводе
    let cumulative = 0;
    for (const d of sortedDays) {
        cumulative += days[d].result; // Накапливаем чистые EUR
        data.push(parseFloat(convertCurrency(cumulative).toFixed(2))); // Конвертируем финальное значение
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
    const rates = {
        USD: parseFloat(document.getElementById('usdRate').value) || 1.10,
        EUR: parseFloat(document.getElementById('eurRate').value) || 1.00,
        RUB: parseFloat(document.getElementById('rubRate').value) || 90.00
    };

    AppState.dataManager.updateSettings({ currencyRates: rates });
    updateUI();
    updateChart();
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
            
            document.getElementById('usdRate').value = usd.toFixed(4);
            document.getElementById('rubRate').value = rub.toFixed(2);
            
            saveCurrencyRates();
            showNotification('✅ Курсы валют обновлены', 'success');
        }
    } catch (error) {
        console.error('Error fetching rates:', error);
        showNotification('❌ Ошибка получения курсов', 'error');
    } finally {
        btn.textContent = 'Обновить курсы';
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
