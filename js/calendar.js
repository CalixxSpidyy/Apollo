(() => {
    const Storage = window.ApolloStorage;
    if (!Storage) {
        console.error("Storage module not loaded!");
        return;
    }

    const phTime = Storage.getPHYearAndMonth ? Storage.getPHYearAndMonth() : { year: new Date().getFullYear(), month: new Date().getMonth() };
    let currentYear = phTime.year;
    let currentMonth = phTime.month; // 0-indexed
    let selectedDate = Storage.getLocalDateString(); // YYYY-MM-DD
    let editingReminderId = null;

    // DOM Elements
    const currentMonthYear = document.getElementById('currentMonthYear');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const calendarDaysGrid = document.getElementById('calendarDaysGrid');
    
    const selectedDateTitle = document.getElementById('selectedDateTitle');
    const selectedDateSubtitle = document.getElementById('selectedDateSubtitle');
    const drawerRemindersList = document.getElementById('drawerRemindersList');
    const drawerTodosList = document.getElementById('drawerTodosList');
    
    const reminderForm = document.getElementById('reminderForm');
    const remTitleInput = document.getElementById('remTitleInput');
    const remNoteInput = document.getElementById('remNoteInput');
    const remTimeInput = document.getElementById('remTimeInput');
    
    const advTodoInput = document.getElementById('advTodoInput');
    const addAdvTodoBtn = document.getElementById('addAdvTodoBtn');
    const exportBtn = document.getElementById('exportBtn');

    // Months Labels
    const MONTH_NAMES = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];

    // Initializer
    function init() {
        cleanupPastReminders();
        setupEventListeners();
        renderMonthGrid();
        selectDate(selectedDate);
    }

    // Automatically purge reminders older than today
    function cleanupPastReminders() {
        const todayStr = Storage.getLocalDateString();
        const reminders = Storage.getReminders();
        const activeReminders = reminders.filter(r => r.date >= todayStr);
        if (activeReminders.length !== reminders.length) {
            Storage.saveReminders(activeReminders);
        }
    }

    // Render interactive month-grid calendar
    function renderMonthGrid() {
        calendarDaysGrid.innerHTML = '';
        
        // Update Title label
        currentMonthYear.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

        // Get first day of the month
        const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
        // Convert getDay() standard (0 is Sunday, 1 is Monday... 6 is Saturday) to ISO-8601 (0 is Monday, 6 is Sunday)
        const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

        // Get total days in current month
        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Get total days in previous month
        const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

        // 42 cells total (6 rows of 7 days) to maintain absolute layout rectangular constraints
        const totalGridCells = 42;

        let cellsHtml = '';

        // 1. Fill Trailing Previous Month Days
        for (let i = startOffset - 1; i >= 0; i--) {
            const dayNum = prevMonthTotalDays - i;
            const pmMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const pmYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const dateStr = formatDateCode(pmYear, pmMonth, dayNum);
            
            cellsHtml += createDayCellMarkup(dayNum, dateStr, true);
        }

        // 2. Fill Current Month Days
        for (let i = 1; i <= totalDays; i++) {
            const dateStr = formatDateCode(currentYear, currentMonth, i);
            cellsHtml += createDayCellMarkup(i, dateStr, false);
        }

        // 3. Fill Leading Next Month Days
        const remainingCells = totalGridCells - (startOffset + totalDays);
        for (let i = 1; i <= remainingCells; i++) {
            const nmMonth = currentMonth === 11 ? 0 : currentMonth + 1;
            const nmYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            const dateStr = formatDateCode(nmYear, nmMonth, i);
            
            cellsHtml += createDayCellMarkup(i, dateStr, true);
        }

        calendarDaysGrid.innerHTML = cellsHtml;
    }

    // Single Cell Markup Generator
    function createDayCellMarkup(dayNum, dateStr, isOtherMonth) {
        const isToday = dateStr === Storage.getLocalDateString();
        const isSelected = dateStr === selectedDate;
        
        const classes = [
            'calendar-day-cell',
            isOtherMonth ? 'other-month' : '',
            isToday ? 'today' : '',
            isSelected ? 'selected' : ''
        ].filter(Boolean).join(' ');

        // Check if there are indicators (Reminders or Daily logs tasks)
        const todayStr = Storage.getLocalDateString();
        const isPastDate = dateStr < todayStr;
        const hasReminders = !isPastDate && Storage.getReminders().some(r => r.date === dateStr);
        
        const dayLogs = Storage.getLogs()[dateStr];
        const hasLogs = dayLogs && dayLogs.tasks && dayLogs.tasks.length > 0;

        let markersHtml = '';
        if (hasReminders || hasLogs) {
            markersHtml = `
                <div class="cell-markers">
                    ${hasReminders ? '<span class="marker-dot reminder"></span>' : ''}
                    ${hasLogs ? '<span class="marker-dot logs"></span>' : ''}
                </div>
            `;
        }

        return `
            <div class="${classes}" data-date="${dateStr}">
                ${dayNum}
                ${markersHtml}
            </div>
        `;
    }

    // Set Active selected date and load lists
    function selectDate(dateStr) {
        // Safe reset edit state if we change dates
        resetReminderFormState();

        selectedDate = dateStr;

        // Visual highlights update
        document.querySelectorAll('.calendar-day-cell').forEach(cell => {
            cell.classList.remove('selected');
            if (cell.dataset.date === dateStr) {
                cell.classList.add('selected');
            }
        });

        // Set Header details labels
        const dateObj = new Date(dateStr + 'T00:00:00');
        const formattedTitle = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        selectedDateTitle.textContent = formattedTitle;
        selectedDateSubtitle.textContent = dateStr === Storage.getLocalDateString() ? "Schedule (Today)" : `Schedule (${dateStr})`;

        // Block modifying past dates
        const todayStr = Storage.getLocalDateString();
        const isPast = dateStr < todayStr;
        const pastBlocker = document.getElementById('pastDateBlocker');
        const remForm = document.getElementById('reminderForm');
        const advForm = document.getElementById('advTodoForm');

        if (isPast) {
            if (remForm) remForm.style.display = 'none';
            if (advForm) advForm.style.display = 'none';
            if (pastBlocker) pastBlocker.style.display = 'block';
        } else {
            if (remForm) remForm.style.display = 'flex';
            if (advForm) advForm.style.display = 'flex';
            if (pastBlocker) pastBlocker.style.display = 'none';
        }

        renderRemindersList();
        renderAdvanceTodosList();
    }

    // Render reminders lists for chosen date
    function renderRemindersList() {
        drawerRemindersList.innerHTML = '';
        const todayStr = Storage.getLocalDateString();
        if (selectedDate < todayStr) {
            drawerRemindersList.innerHTML = `<div class="search-result-empty" style="font-size:0.75rem;padding:0.5rem 0;">Reminders are not available for past dates.</div>`;
            return;
        }

        const reminders = Storage.getReminders().filter(r => r.date === selectedDate);

        if (reminders.length === 0) {
            drawerRemindersList.innerHTML = `<div class="search-result-empty" style="font-size:0.75rem;padding:0.5rem 0;">No reminders set.</div>`;
            return;
        }

        reminders.forEach(rem => {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            
            const timeBadge = rem.time ? `<span class="schedule-item-time">${rem.time}</span>` : '';
            const noteText = rem.note ? `<div class="schedule-item-note">${escapeHtml(rem.note)}</div>` : '';
            
            const editBtn = `
                <button class="schedule-item-edit-btn edit-rem-btn" data-id="${rem.id}" title="Edit Reminder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            `;
            const delBtn = `<button class="schedule-item-del-btn delete-rem-btn" data-id="${rem.id}" title="Delete Reminder">&times;</button>`;

            item.innerHTML = `
                <div class="schedule-item-content">
                    <div class="schedule-item-title">${escapeHtml(rem.title)}</div>
                    ${noteText}
                </div>
                ${timeBadge}
                <div class="schedule-item-actions">
                    ${editBtn}
                    ${delBtn}
                </div>
            `;
            drawerRemindersList.appendChild(item);
        });
    }

    function startEditingReminder(remId) {
        const reminder = Storage.getReminders().find(r => r.id === remId);
        if (!reminder) return;

        editingReminderId = remId;
        remTitleInput.value = reminder.title;
        remNoteInput.value = reminder.note || '';
        remTimeInput.value = reminder.time || '';

        // Change submit button text
        const submitBtn = reminderForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Save Changes';
        }

        // Focus the title input and scroll smoothly
        remTitleInput.focus();
        remTitleInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Add Cancel Edit button if not present
        let cancelBtn = document.getElementById('cancelEditBtn');
        if (!cancelBtn) {
            cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.id = 'cancelEditBtn';
            cancelBtn.className = 'secondary-btn';
            cancelBtn.style.width = '100%';
            cancelBtn.style.marginTop = '0.4rem';
            cancelBtn.style.height = '40px';
            cancelBtn.style.fontSize = '0.85rem';
            cancelBtn.style.borderRadius = 'var(--radius-md)';
            cancelBtn.style.justifyContent = 'center';
            cancelBtn.textContent = 'Cancel Edit';
            cancelBtn.onclick = resetReminderFormState;
            reminderForm.appendChild(cancelBtn);
        }
    }

    function resetReminderFormState() {
        editingReminderId = null;
        if (remTitleInput) remTitleInput.value = '';
        if (remNoteInput) remNoteInput.value = '';
        if (remTimeInput) remTimeInput.value = '';

        if (reminderForm) {
            const submitBtn = reminderForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Add Reminder';
            }
        }

        const cancelBtn = document.getElementById('cancelEditBtn');
        if (cancelBtn) {
            cancelBtn.remove();
        }
    }

    // Render advance todos list for chosen date
    function renderAdvanceTodosList() {
        drawerTodosList.innerHTML = '';
        const todayStr = Storage.getLocalDateString();
        if (selectedDate < todayStr) {
            drawerTodosList.innerHTML = `<div class="search-result-empty" style="font-size:0.75rem;padding:0.5rem 0;">Advance todos are not available for past dates.</div>`;
            return;
        }

        const logs = Storage.getLogs();
        const dayLog = logs[selectedDate];
        const tasks = dayLog ? dayLog.tasks || [] : [];

        if (tasks.length === 0) {
            drawerTodosList.innerHTML = `<div class="search-result-empty" style="font-size:0.75rem;padding:0.5rem 0;">No advance tasks added.</div>`;
            return;
        }

        const isPast = selectedDate < todayStr;

        tasks.forEach(task => {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            const delBtn = isPast ? '' : `<button class="schedule-item-del-btn delete-todo-btn" data-id="${task.id}">&times;</button>`;

            item.innerHTML = `
                <div class="schedule-item-content">
                    <div class="schedule-item-title" style="${task.completed ? 'text-decoration:line-through;color:var(--text-muted);opacity:0.7;' : ''}">${escapeHtml(task.text)}</div>
                </div>
                ${delBtn}
            `;
            drawerTodosList.appendChild(item);
        });
    }

    // Formatting date string wrapper (YYYY-MM-DD)
    function formatDateCode(year, month, day) {
        const y = year;
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Event handlers
    function setupEventListeners() {
        // Prev Month clicks
        prevMonthBtn.onclick = () => {
            if (currentMonth === 0) {
                currentMonth = 11;
                currentYear--;
            } else {
                currentMonth--;
            }
            renderMonthGrid();
        };

        // Next Month clicks
        nextMonthBtn.onclick = () => {
            if (currentMonth === 11) {
                currentMonth = 0;
                currentYear++;
            } else {
                currentMonth++;
            }
            renderMonthGrid();
        };

        // Grid clicks (event delegation)
        calendarDaysGrid.onclick = (e) => {
            const cell = e.target.closest('.calendar-day-cell');
            if (cell && !cell.classList.contains('empty-cell')) {
                selectDate(cell.dataset.date);
            }
        };

        // Reminder form submission
        reminderForm.onsubmit = (e) => {
            e.preventDefault();
            const title = remTitleInput.value.trim();
            const note = remNoteInput.value.trim();
            const time = remTimeInput.value;

            if (!title) return;

            if (editingReminderId) {
                // Edit Mode
                const reminders = Storage.getReminders();
                const remIdx = reminders.findIndex(r => r.id === editingReminderId);
                if (remIdx !== -1) {
                    reminders[remIdx].title = title;
                    reminders[remIdx].note = note;
                    reminders[remIdx].time = time;
                    Storage.saveReminders(reminders);
                }
                resetReminderFormState();
            } else {
                // Add Mode
                const newReminder = {
                    id: 'rem-' + Date.now(),
                    date: selectedDate,
                    title,
                    note,
                    time
                };
                Storage.addReminder(newReminder);
                
                // reset form inputs
                remTitleInput.value = '';
                remNoteInput.value = '';
                remTimeInput.value = '';
            }

            renderRemindersList();
            renderMonthGrid(); // add dot indicator on cell
        };

        // Reminder list interaction (Edit or Delete)
        drawerRemindersList.onclick = (e) => {
            const delBtn = e.target.closest('.delete-rem-btn');
            if (delBtn) {
                const idToDelete = delBtn.dataset.id;
                Storage.deleteReminder(idToDelete);
                if (editingReminderId === idToDelete) {
                    resetReminderFormState();
                }
                renderRemindersList();
                renderMonthGrid(); // updates markers
                return;
            }

            const editBtn = e.target.closest('.edit-rem-btn');
            if (editBtn) {
                startEditingReminder(editBtn.dataset.id);
                return;
            }
        };

        // Advance todo text trigger button state
        advTodoInput.oninput = () => {
            addAdvTodoBtn.disabled = !advTodoInput.value.trim();
        };

        advTodoInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !addAdvTodoBtn.disabled) {
                addAdvTodoBtn.click();
            }
        };

        // Add advance todo task
        addAdvTodoBtn.onclick = () => {
            const text = advTodoInput.value.trim();
            if (!text) return;

            const log = Storage.getLogForDate(selectedDate);
            if (!log.tasks) log.tasks = [];

            log.tasks.push({
                id: Date.now(),
                text: text,
                completed: false,
                priority: 'default',
                goalId: null,
                timeSpent: 0
            });

            Storage.saveLogForDate(selectedDate, log);
            advTodoInput.value = '';
            addAdvTodoBtn.disabled = true;

            renderAdvanceTodosList();
            renderMonthGrid(); // updates markers
        };

        // Advance Todo Deletions
        drawerTodosList.onclick = (e) => {
            const delBtn = e.target.closest('.delete-todo-btn');
            if (delBtn) {
                const taskId = Number(delBtn.dataset.id);
                const log = Storage.getLogForDate(selectedDate);
                log.tasks = (log.tasks || []).filter(t => t.id !== taskId);
                Storage.saveLogForDate(selectedDate, log);
                
                renderAdvanceTodosList();
                renderMonthGrid(); // updates markers
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

        // Listen state changes
        window.addEventListener('apollo_data_updated', () => {
            renderMonthGrid();
            selectDate(selectedDate);
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
