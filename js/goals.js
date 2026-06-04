(() => {
    const Storage = window.ApolloStorage;
    if (!Storage) {
        console.error("Storage module not loaded!");
        return;
    }

    let activeFilter = 'active'; // 'active', 'completed', 'all'

    // DOM Elements
    const goalsGrid = document.getElementById('goalsGrid');
    const openNewGoalModalBtn = document.getElementById('openNewGoalModalBtn');
    const goalModal = document.getElementById('goalModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelGoalBtn = document.getElementById('cancelGoalBtn');
    const goalForm = document.getElementById('goalForm');
    
    const goalNameInput = document.getElementById('goalNameInput');
    const goalPeriodSelect = document.getElementById('goalPeriodSelect');
    const goalTypeSelect = document.getElementById('goalTypeSelect');
    const datePickerGroup = document.getElementById('datePickerGroup');
    const datePickerLabel = document.getElementById('datePickerLabel');
    
    const goalDateTrigger = document.getElementById('goalDateTrigger');
    const goalDateDisplay = document.getElementById('goalDateDisplay');
    const datePickerDropdown = document.getElementById('datePickerDropdown');
    const dpMonthYear = document.getElementById('dpMonthYear');
    const dpPrevMonth = document.getElementById('dpPrevMonth');
    const dpNextMonth = document.getElementById('dpNextMonth');
    const dpDaysGrid = document.getElementById('dpDaysGrid');
    
    const progressParams = document.getElementById('progressParams');
    const targetHrs = document.getElementById('targetHrs');
    const targetMins = document.getElementById('targetMins');
    
    const repeatParams = document.getElementById('repeatParams');
    const repeatIntervalInput = document.getElementById('repeatIntervalInput');
    
    const filterTabs = document.querySelector('.filter-tabs');
    const exportBtn = document.getElementById('exportBtn');

    // Dropdown Calendar State
    const phTime = Storage.getPHYearAndMonth ? Storage.getPHYearAndMonth() : { year: new Date().getFullYear(), month: new Date().getMonth() };
    let dpYear = phTime.year;
    let dpMonth = phTime.month; // 0-indexed
    let activeStartDate = null; // YYYY-MM-DD
    let activeEndDate = null;   // YYYY-MM-DD
    let customRangeStart = null;
    let customRangeEnd = null;
    let hoveredDateCode = null;

    const DP_MONTH_NAMES = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Initialize Page Controller
    function init() {
        setupEventListeners();
        setDefaultDateValues();
        renderGoals();
    }

    // Set Default Values for Form
    function setDefaultDateValues() {
        activeStartDate = Storage.getLocalDateString();
        activeEndDate = null;
        customRangeStart = null;
        customRangeEnd = null;
        hoveredDateCode = null;
        dpYear = new Date().getFullYear();
        dpMonth = new Date().getMonth();
        updateTriggerDisplay();
    }

    // Modal view handlers
    function openModal() {
        goalModal.style.display = 'flex';
        goalNameInput.focus();
        toggleParamInputs();
    }

    // Dropdown picker mechanics
    function openDpDropdown() {
        datePickerDropdown.style.display = 'block';
        renderDpMonthGrid();
        setTimeout(() => {
            document.addEventListener('click', closeDpDropdownOnOutsideClick);
        }, 10);
    }

    function closeDpDropdown() {
        datePickerDropdown.style.display = 'none';
        document.removeEventListener('click', closeDpDropdownOnOutsideClick);
    }

    function closeDpDropdownOnOutsideClick(e) {
        if (!e.target.closest('#datePickerGroup')) {
            closeDpDropdown();
        }
    }

    function closeModal() {
        goalModal.style.display = 'none';
        goalForm.reset();
        setDefaultDateValues();
        toggleParamInputs();
        closeDpDropdown();
    }

    // Date range helpers
    function getISOWeekRange(dateCode) {
        const d = new Date(dateCode + 'T00:00:00');
        const day = d.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        return {
            start: Storage.getLocalDateString(monday),
            end: Storage.getLocalDateString(sunday)
        };
    }

    function getMonthRange(dateCode) {
        const parts = dateCode.split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        return {
            start: Storage.getLocalDateString(firstDay),
            end: Storage.getLocalDateString(lastDay)
        };
    }

    function formatDateCode(year, month, day) {
        const y = year;
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function renderDpMonthGrid() {
        dpDaysGrid.innerHTML = '';
        dpMonthYear.textContent = `${DP_MONTH_NAMES[dpMonth]} ${dpYear}`;

        const firstDayIndex = new Date(dpYear, dpMonth, 1).getDay();
        const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
        const totalDays = new Date(dpYear, dpMonth + 1, 0).getDate();
        const prevMonthTotalDays = new Date(dpYear, dpMonth, 0).getDate();
        const totalGridCells = 42;

        let cellsHtml = '';

        // 1. Prev month trailing
        for (let i = startOffset - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            const pmMonth = dpMonth === 0 ? 11 : dpMonth - 1;
            const pmYear = dpMonth === 0 ? dpYear - 1 : dpYear;
            const dateStr = formatDateCode(pmYear, pmMonth, dayNum);
            cellsHtml += `<div class="dp-day-cell other-month" data-date="${dateStr}">${dayNum}</div>`;
        }

        // 2. Current month days
        for (let i = 1; i <= totalDays; i++) {
            const dateStr = formatDateCode(dpYear, dpMonth, i);
            cellsHtml += `<div class="dp-day-cell" data-date="${dateStr}">${i}</div>`;
        }

        // 3. Next month leading
        const remainingCells = totalGridCells - (startOffset + totalDays);
        for (let i = 1; i <= remainingCells; i++) {
            const nmMonth = dpMonth === 11 ? 0 : dpMonth + 1;
            const nmYear = dpMonth === 11 ? dpYear + 1 : dpYear;
            const dateStr = formatDateCode(nmYear, nmMonth, i);
            cellsHtml += `<div class="dp-day-cell other-month" data-date="${dateStr}">${i}</div>`;
        }

        dpDaysGrid.innerHTML = cellsHtml;
        updateDpSelectionHighlights();
        setupDpCellEvents();
    }

    function updateDpSelectionHighlights() {
        const cells = dpDaysGrid.querySelectorAll('.dp-day-cell');
        const period = goalPeriodSelect.value;

        cells.forEach(cell => {
            cell.classList.remove('selected-day', 'week-highlight', 'month-highlight', 'range-highlight', 'range-endpoint');
        });

        if (period === 'day') {
            cells.forEach(cell => {
                if (cell.dataset.date === activeStartDate) {
                    cell.classList.add('selected-day');
                }
            });
        } else if (period === 'week') {
            if (activeStartDate && activeEndDate) {
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date >= activeStartDate && date <= activeEndDate) {
                        cell.classList.add('week-highlight');
                        if (date === activeStartDate) cell.classList.add('range-endpoint');
                    }
                });
            }
            if (hoveredDateCode) {
                const range = getISOWeekRange(hoveredDateCode);
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date >= range.start && date <= range.end) {
                        cell.classList.add('week-highlight');
                    }
                });
            }
        } else if (period === 'month') {
            if (activeStartDate && activeEndDate) {
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date >= activeStartDate && date <= activeEndDate) {
                        cell.classList.add('month-highlight');
                        if (date === activeStartDate) cell.classList.add('range-endpoint');
                    }
                });
            }
            if (hoveredDateCode) {
                const range = getMonthRange(hoveredDateCode);
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date >= range.start && date <= range.end) {
                        cell.classList.add('month-highlight');
                    }
                });
            }
        } else if (period === 'custom') {
            if (customRangeStart && customRangeEnd) {
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date >= customRangeStart && date <= customRangeEnd) {
                        cell.classList.add('range-highlight');
                        if (date === customRangeStart || date === customRangeEnd) {
                            cell.classList.add('range-endpoint');
                        }
                    }
                });
            } else if (customRangeStart) {
                cells.forEach(cell => {
                    const date = cell.dataset.date;
                    if (date === customRangeStart) {
                        cell.classList.add('range-endpoint');
                    }
                    if (hoveredDateCode && hoveredDateCode >= customRangeStart) {
                        if (date >= customRangeStart && date <= hoveredDateCode) {
                            cell.classList.add('range-highlight');
                        }
                    }
                });
            }
        }
    }

    function setupDpCellEvents() {
        const cells = dpDaysGrid.querySelectorAll('.dp-day-cell');
        const period = goalPeriodSelect.value;

        cells.forEach(cell => {
            const dateStr = cell.dataset.date;

            cell.onmouseenter = () => {
                hoveredDateCode = dateStr;
                updateDpSelectionHighlights();
            };

            cell.onclick = (e) => {
                e.stopPropagation();
                
                if (period === 'day') {
                    activeStartDate = dateStr;
                    activeEndDate = null;
                    updateTriggerDisplay();
                    closeDpDropdown();
                } else if (period === 'week') {
                    const range = getISOWeekRange(dateStr);
                    activeStartDate = range.start;
                    activeEndDate = range.end;
                    updateTriggerDisplay();
                    closeDpDropdown();
                } else if (period === 'month') {
                    const range = getMonthRange(dateStr);
                    activeStartDate = range.start;
                    activeEndDate = range.end;
                    updateTriggerDisplay();
                    closeDpDropdown();
                } else if (period === 'custom') {
                    if (!customRangeStart || (customRangeStart && customRangeEnd)) {
                        customRangeStart = dateStr;
                        customRangeEnd = null;
                        activeStartDate = dateStr;
                        activeEndDate = null;
                    } else {
                        if (dateStr < customRangeStart) {
                            customRangeStart = dateStr;
                            activeStartDate = dateStr;
                        } else {
                            customRangeEnd = dateStr;
                            activeStartDate = customRangeStart;
                            activeEndDate = customRangeEnd;
                            updateTriggerDisplay();
                            closeDpDropdown();
                        }
                    }
                    updateDpSelectionHighlights();
                }
            };
        });

        dpDaysGrid.onmouseleave = () => {
            hoveredDateCode = null;
            updateDpSelectionHighlights();
        };
    }

    function updateTriggerDisplay() {
        const period = goalPeriodSelect.value;

        if (period === 'day') {
            goalDateDisplay.textContent = activeStartDate || 'Select Date...';
        } else if (period === 'week') {
            if (activeStartDate && activeEndDate) {
                goalDateDisplay.textContent = `Week: ${activeStartDate} to ${activeEndDate}`;
            } else {
                goalDateDisplay.textContent = 'Select Week...';
            }
        } else if (period === 'month') {
            if (activeStartDate && activeEndDate) {
                const dateObj = new Date(activeStartDate + 'T00:00:00');
                goalDateDisplay.textContent = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            } else {
                goalDateDisplay.textContent = 'Select Month...';
            }
        } else if (period === 'custom') {
            if (activeStartDate && activeEndDate) {
                goalDateDisplay.textContent = `${activeStartDate} to ${activeEndDate}`;
            } else {
                goalDateDisplay.textContent = 'Select Period...';
            }
        }
    }

    // Handle form param reveals based on dropdown types
    function toggleParamInputs() {
        const type = goalTypeSelect.value;
        const period = goalPeriodSelect.value;

        // Hide/Show contextual sections
        if (type === 'progress-based') {
            progressParams.style.display = 'block';
            repeatParams.style.display = 'none';
        } else if (type === 'repeat') {
            progressParams.style.display = 'none';
            repeatParams.style.display = 'block';
        } else {
            progressParams.style.display = 'none';
            repeatParams.style.display = 'none';
        }

        // Adjust date labels & selectors based on period selection
        if (period === 'day') {
            datePickerLabel.textContent = 'Target Date';
            activeStartDate = Storage.getLocalDateString();
            activeEndDate = null;
        } else if (period === 'week') {
            datePickerLabel.textContent = 'Target Week';
            const range = getISOWeekRange(Storage.getLocalDateString());
            activeStartDate = range.start;
            activeEndDate = range.end;
        } else if (period === 'month') {
            datePickerLabel.textContent = 'Target Month';
            const range = getMonthRange(Storage.getLocalDateString());
            activeStartDate = range.start;
            activeEndDate = range.end;
        } else if (period === 'custom') {
            datePickerLabel.textContent = 'Custom Period (Select Start & End)';
            activeStartDate = null;
            activeEndDate = null;
            customRangeStart = null;
            customRangeEnd = null;
        }

        updateTriggerDisplay();
        if (datePickerDropdown.style.display !== 'none') {
            renderDpMonthGrid();
        }
    }

    // Render Goals cards
    function renderGoals() {
        // Query which history details are currently open before resetting the HTML
        const openGoalDetailsIds = new Set();
        goalsGrid.querySelectorAll('.goal-card').forEach(card => {
            const details = card.querySelector('details');
            if (details && details.open) {
                openGoalDetailsIds.add(card.dataset.id);
            }
        });

        goalsGrid.innerHTML = '';
        const goals = Storage.getGoals();
        
        let filteredGoals = goals;
        if (activeFilter === 'active') {
            filteredGoals = goals.filter(g => !g.completed);
        } else if (activeFilter === 'completed') {
            filteredGoals = goals.filter(g => g.completed);
        }

        if (filteredGoals.length === 0) {
            goalsGrid.innerHTML = `<div class="search-result-empty" style="grid-column:1/-1;padding:3rem;background:#fff;border:1px solid var(--border-color);border-radius:var(--radius-lg);">No ${activeFilter} goals found. Let's create one!</div>`;
            return;
        }

        filteredGoals.forEach(goal => {
            const card = document.createElement('div');
            card.className = `goal-card ${goal.completed ? 'completed' : ''}`;
            card.dataset.id = goal.id;

            // Structure card body based on Goal Type
            let bodyHtml = '';
            
            if (goal.type === 'progress-based') {
                const perc = goal.targetTime ? Math.min((goal.currentTime / goal.targetTime) * 100, 100) : 0;
                const progressText = `${Storage.formatMinutes(goal.currentTime)} / ${Storage.formatMinutes(goal.targetTime)}`;
                
                bodyHtml = `
                    <div class="goal-progress-stats">
                        <span>Progress</span>
                        <span>${progressText}</span>
                    </div>
                    <div class="goal-progress-wire">
                        <div class="goal-progress-fill" style="width: ${perc}%"></div>
                    </div>
                    
                    <!-- Inline Session logger on Goal Card -->
                    <div class="goal-card-logger">
                        <div class="logger-row">
                            <input type="text" id="note-${goal.id}" placeholder="Session note..." class="input-field" style="flex-grow:1;">
                            <input type="number" id="mins-${goal.id}" placeholder="Mins" class="input-field" style="width:65px;" min="1">
                            <button class="primary-btn log-progress-btn" data-id="${goal.id}">Log</button>
                        </div>
                    </div>

                    <!-- Collapsible Logs Session History -->
                    ${goal.logs && goal.logs.length > 0 ? `
                        <div class="goal-history-details">
                            <details ${openGoalDetailsIds.has(goal.id) ? 'open' : ''}>
                                <summary>History (${goal.logs.length})</summary>
                                <div class="history-list">
                                    ${goal.logs.map(log => `
                                        <div class="history-item">
                                            <span><strong>+${Storage.formatMinutes(log.amt)}</strong> — ${escapeHtml(log.note)} <span style="color:var(--text-light)">(${log.date})</span></span>
                                            <button class="history-item-del-btn" data-goalid="${goal.id}" data-logid="${log.id}">&times;</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    ` : ''}
                `;
            } else if (goal.type === 'one-time') {
                bodyHtml = `
                    <div class="form-group" style="margin: 0.5rem 0 0; flex-direction:row; align-items:center; gap:0.5rem;">
                        <input type="checkbox" id="chk-${goal.id}" class="goal-checklist-toggle" ${goal.completed ? 'checked' : ''} data-id="${goal.id}" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;">
                        <label for="chk-${goal.id}" style="font-size:0.9rem;font-weight:500;cursor:pointer; ${goal.completed ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">Mark Completed</label>
                    </div>
                `;
            } else if (goal.type === 'repeat') {
                const logCount = goal.logs ? goal.logs.length : 0;
                bodyHtml = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <span style="font-size:0.85rem;color:var(--text-muted);">Interval: Every ${goal.interval} day${goal.interval > 1 ? 's' : ''}</span>
                        <span style="font-size:0.85rem;font-weight:600;">Completed: ${logCount} times</span>
                    </div>
                    <button class="primary-btn increment-repeat-btn" data-id="${goal.id}" style="width:100%; justify-content:center; padding:0.5rem; font-size:0.8rem; background-color: var(--border-color); color:var(--text-main);">
                        Add Log
                    </button>
                    
                    <div class="form-group" style="margin: 0.75rem 0 0; flex-direction:row; align-items:center; gap:0.5rem;">
                        <input type="checkbox" id="chk-${goal.id}" class="goal-checklist-toggle" ${goal.completed ? 'checked' : ''} data-id="${goal.id}" style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;">
                        <label for="chk-${goal.id}" style="font-size:0.9rem;font-weight:500;cursor:pointer; ${goal.completed ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">Mark Completed</label>
                    </div>

                    ${goal.logs && goal.logs.length > 0 ? `
                        <div class="goal-history-details" style="margin-top: 0.75rem;">
                            <details ${openGoalDetailsIds.has(goal.id) ? 'open' : ''}>
                                <summary>History (${goal.logs.length})</summary>
                                <div class="history-list">
                                    ${goal.logs.map(log => `
                                        <div class="history-item">
                                            <span>Logged on <strong>${log.date}</strong></span>
                                            <button class="history-item-del-btn" data-goalid="${goal.id}" data-logid="${log.id}">&times;</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </details>
                        </div>
                    ` : ''}
                `;
            }

            // Capitalize Period Label
            let periodLabel = goal.period.charAt(0).toUpperCase() + goal.period.slice(1);
            if (goal.period === 'custom') periodLabel = 'Custom';

            let dateLabel = '';
            if (goal.startDate && goal.endDate) {
                dateLabel = `Period: ${goal.startDate} to ${goal.endDate}`;
            } else if (goal.startDate) {
                dateLabel = `Target Date: ${goal.startDate}`;
            }

            card.innerHTML = `
                <div class="goal-card-header">
                    <span class="goal-period-badge">${periodLabel}</span>
                    <button class="goal-delete-btn" title="Delete Goal" data-id="${goal.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
                    </button>
                </div>
                <h3 class="goal-title">${escapeHtml(goal.name)}</h3>
                <div class="goal-meta-details">${dateLabel}</div>
                
                ${bodyHtml}
            `;

            goalsGrid.appendChild(card);
        });
    }

    // Form submission processing
    function handleGoalSubmit(e) {
        e.preventDefault();
        
        const name = goalNameInput.value.trim();
        const period = goalPeriodSelect.value;
        const type = goalTypeSelect.value;

        if (!name) return;

        const startDate = activeStartDate;
        const endDate = activeEndDate;

        if (period === 'custom' && (!startDate || !endDate)) {
            alert("Please select both start and end dates for your custom period.");
            return;
        }

        let targetMinutes = null;
        let intervalValue = null;

        if (type === 'progress-based') {
            const h = Number(targetHrs.value) || 0;
            const m = Number(targetMins.value) || 0;
            targetMinutes = (h * 60) + m;
            if (targetMinutes <= 0) {
                alert("Please enter a valid target time.");
                return;
            }
        } else if (type === 'repeat') {
            intervalValue = Number(repeatIntervalInput.value) || 1;
        }

        const newGoal = {
            id: 'goal-' + Date.now(),
            name,
            period,
            type,
            targetTime: targetMinutes,
            currentTime: 0,
            interval: intervalValue,
            startDate: startDate,
            endDate: endDate,
            completed: false,
            logs: []
        };

        Storage.addGoal(newGoal);
        closeModal();
        renderGoals();
    }

    // Inline Session additions directly in goal card
    function logSessionTime(goalId) {
        const minsInput = document.getElementById(`mins-${goalId}`);
        const noteInput = document.getElementById(`note-${goalId}`);
        
        const minutes = Number(minsInput.value) || 0;
        const note = noteInput.value.trim() || 'Logged Session';

        if (minutes <= 0) {
            alert("Please enter minutes spent.");
            return;
        }

        const goals = Storage.getGoals();
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            if (!goal.logs) goal.logs = [];
            goal.logs.unshift({
                id: 'session-' + Date.now(),
                note,
                amt: minutes,
                date: Storage.getLocalDateString()
            });

            goal.currentTime = (goal.currentTime || 0) + minutes;
            if (goal.targetTime && goal.currentTime >= goal.targetTime) {
                goal.completed = true;
            }

            Storage.saveGoals(goals);
            renderGoals();
        }
    }

    // Log repeat goal completion
    function logRepeatCompletion(goalId) {
        const goals = Storage.getGoals();
        const goal = goals.find(g => g.id === goalId);
        if (goal) {
            if (!goal.logs) goal.logs = [];
            goal.logs.unshift({
                id: 'repeat-' + Date.now(),
                note: 'Completed Interval Session',
                amt: 0,
                date: Storage.getLocalDateString()
            });
            Storage.saveGoals(goals);
            renderGoals();
        }
    }

    // Delete Log Session History Row
    function deleteGoalLogHistory(goalId, logId) {
        const goals = Storage.getGoals();
        const goal = goals.find(g => g.id === goalId);
        if (goal && goal.logs) {
            const logItem = goal.logs.find(l => l.id === logId);
            if (logItem) {
                goal.currentTime = Math.max(0, (goal.currentTime || 0) - logItem.amt);
                goal.logs = goal.logs.filter(l => l.id !== logId);
                
                // If it falls back below target, mark active again
                if (goal.targetTime && goal.currentTime < goal.targetTime) {
                    goal.completed = false;
                }
                
                Storage.saveGoals(goals);
                renderGoals();
            }
        }
    }

    // Setup events
    function setupEventListeners() {
        openNewGoalModalBtn.onclick = openModal;
        closeModalBtn.onclick = closeModal;
        cancelGoalBtn.onclick = closeModal;
        
        goalForm.onsubmit = handleGoalSubmit;

        goalPeriodSelect.onchange = toggleParamInputs;
        goalTypeSelect.onchange = toggleParamInputs;

        // Custom calendar triggering and month navigation
        goalDateTrigger.onclick = (e) => {
            e.stopPropagation();
            if (datePickerDropdown.style.display === 'none') {
                openDpDropdown();
            } else {
                closeDpDropdown();
            }
        };

        dpPrevMonth.onclick = (e) => {
            e.stopPropagation();
            if (dpMonth === 0) {
                dpMonth = 11;
                dpYear--;
            } else {
                dpMonth--;
            }
            renderDpMonthGrid();
        };

        dpNextMonth.onclick = (e) => {
            e.stopPropagation();
            if (dpMonth === 11) {
                dpMonth = 0;
                dpYear++;
            } else {
                dpMonth++;
            }
            renderDpMonthGrid();
        };

        // Overlay Modal close on backdrop clicks
        goalModal.onclick = (e) => {
            if (e.target === goalModal) closeModal();
        };

        // Tab Filtering trigger
        filterTabs.onclick = (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderGoals();
        };

        // Inline actions grid listener (event delegation)
        goalsGrid.onclick = (e) => {
            // Delete Goal Button
            const deleteBtn = e.target.closest('.goal-delete-btn');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (confirm("Are you sure you want to delete this goal and clear all progress logs?")) {
                    Storage.deleteGoal(id);
                    renderGoals();
                }
                return;
            }

            // Progress Goals Inline logger Add Session Button
            const logBtn = e.target.closest('.log-progress-btn');
            if (logBtn) {
                logSessionTime(logBtn.dataset.id);
                return;
            }

            // Repeat Goals Increment Check button
            const incBtn = e.target.closest('.increment-repeat-btn');
            if (incBtn) {
                logRepeatCompletion(incBtn.dataset.id);
                return;
            }

            // One-time checklists toggle check
            const chkToggle = e.target.closest('.goal-checklist-toggle');
            if (chkToggle) {
                const goals = Storage.getGoals();
                const goal = goals.find(g => g.id === chkToggle.dataset.id);
                if (goal) {
                    goal.completed = chkToggle.checked;
                    Storage.saveGoals(goals);
                    renderGoals();
                }
                return;
            }

            // Delete History logs session button
            const historyDelBtn = e.target.closest('.history-item-del-btn');
            if (historyDelBtn) {
                deleteGoalLogHistory(historyDelBtn.dataset.goalid, historyDelBtn.dataset.logid);
                return;
            }
        };

        // Export data
        exportBtn.onclick = () => {
            const logs = Storage.getLogs();
            const goals = Storage.getGoals();
            const reminders = Storage.getReminders();

            const fullData = { logs, goals, reminders, export_time: new Date().toISOString() };
            const dataStr = JSON.stringify(fullData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `apollo-dashboard-backup-${Storage.getLocalDateString()}.json`;
            link.click();
            URL.revokeObjectURL(url);
        };

        // Listening for storage state shifts
        window.addEventListener('apollo_data_updated', () => {
            renderGoals();
        });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    window.onload = init;
})();
