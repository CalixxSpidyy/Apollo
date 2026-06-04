(() => {
    // Rely on window.ApolloStorage
    const Storage = window.ApolloStorage;
    if (!Storage) {
        console.error("Storage module not loaded!");
        return;
    }

    let currentCode = Storage.getLocalDateString();
    let recentsPage = 1;
    const RECENTS_PER_PAGE = 4;

    // DOM Elements
    const dayTitle = document.getElementById('dayTitle');
    const dayDate = document.getElementById('dayDate');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const todayBtn = document.getElementById('todayBtn');
    
    const taskInput = document.getElementById('taskInput');
    const goalTagSelect = document.getElementById('goalTagSelect');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const todoList = document.getElementById('todoList');
    
    const journalEditor = document.getElementById('journalEditor');
    const saveStatus = document.getElementById('saveStatus');
    const editorToolbar = document.getElementById('editorToolbar');
    const saveJournalBtn = document.getElementById('saveJournalBtn');
    const cancelJournalBtn = document.getElementById('cancelJournalBtn');
    
    const logSearchInput = document.getElementById('logSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    const recentsGrid = document.getElementById('recentsGrid');
    const paginationControls = document.getElementById('paginationControls');
    
    const exportBtn = document.getElementById('exportBtn');
    const resetBtn = document.getElementById('resetBtn');
    const popoverContainer = document.getElementById('popoverContainer');

    // Original content of active day journal to track unsaved edits
    let originalJournalContent = "";

    // Initializer
    function init() {
        setupEventListeners();
        loadDay(Storage.getLocalDateString());
        renderRecents();
    }

    // Load active day logs
    function loadDay(dateStr) {
        if (dateStr !== currentCode && hasUnsavedJournalChanges()) {
            if (!confirm("You have unsaved changes in your journal. Are you sure you want to switch days and discard these changes?")) {
                return;
            }
        }
        currentCode = dateStr;
        
        // Update Title & Today Badge
        const log = Storage.getLogForDate(dateStr);
        dayTitle.textContent = `Day #${log.display_id}`;
        
        const dateObj = new Date(dateStr + 'T00:00:00');
        const formattedDate = dateObj.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        dayDate.innerHTML = `${formattedDate} <span class="raw-date-code">(${dateStr})</span>`;

        if (dateStr === Storage.getLocalDateString()) {
            todayBtn.style.display = 'none';
        } else {
            todayBtn.style.display = 'inline-block';
        }

        // Render sections
        populateGoalTagDropdown();
        renderTasks();
        renderJournal();
        renderRecents(); // update active card
    }

    function populateGoalTagDropdown() {
        goalTagSelect.innerHTML = '<option value="">Tag Goal (None)</option>';
        // Allow all uncompleted goals of any type (progress-based, one-time, repeat) to be selected
        const goals = Storage.getGoals().filter(g => !g.completed);
        goals.forEach(goal => {
            const opt = document.createElement('option');
            opt.value = goal.id;
            
            // Format a clean type prefix to make it intuitive
            let typeLabel = '';
            if (goal.type === 'one-time') typeLabel = ' [One-Time]';
            else if (goal.type === 'repeat') typeLabel = ' [Repeat]';
            else if (goal.type === 'progress-based') typeLabel = ' [Progress]';
            
            opt.textContent = `${goal.name}${typeLabel}`;
            goalTagSelect.appendChild(opt);
        });
    }

    function renderTasks() {
        todoList.innerHTML = '';
        const log = Storage.getLogForDate(currentCode);
        const tasks = log.tasks || [];

        if (tasks.length === 0) {
            todoList.innerHTML = `<div class="search-result-empty" style="padding:1rem;">No tasks logged for this day.</div>`;
            return;
        }

        tasks.forEach((task) => {
            const item = document.createElement('div');
            item.className = 'task-item draggable';
            item.draggable = true;
            item.dataset.id = task.id;
            item.dataset.priority = task.priority || 'default';
            if (task.completed) item.classList.add('completed');

            const goalBadge = task.goalId ? getGoalBadgeHtml(task.goalId) : '';
            const timeBadge = task.timeSpent > 0 ? `<span class="logged-time-badge" title="Logged Time">${Storage.formatMinutes(task.timeSpent)}</span>` : '';
            
            // Only render the timer log button if the tagged goal is progress-based
            let showTimerBtn = false;
            if (task.goalId) {
                const goal = Storage.getGoals().find(g => g.id === task.goalId);
                if (goal && goal.type === 'progress-based') {
                    showTimerBtn = true;
                }
            }
            
            const timerBtn = showTimerBtn ? `
                <button class="time-log-btn" title="Log time spent on goal" data-id="${task.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </button>
            ` : '';

            item.innerHTML = `
                <div class="priority-dot-trigger" title="Change priority" data-id="${task.id}"></div>
                <input type="checkbox" id="chk-${task.id}" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                <span class="task-text-label" data-id="${task.id}">${escapeHtml(task.text)}</span>
                ${timeBadge}
                ${goalBadge}
                ${timerBtn}
                <button class="delete-task-btn" title="Delete Task" data-id="${task.id}">&times;</button>
            `;
            
            // Inline task text edit handler
            const textLabel = item.querySelector('.task-text-label');
            textLabel.ondblclick = (e) => {
                e.preventDefault();
                startInlineTextEdit(textLabel, task.id);
            };

            todoList.appendChild(item);
        });

        setupDragAndDrop();
    }

    // Double-click inline editing logic
    function startInlineTextEdit(labelEl, taskId) {
        const currentText = labelEl.textContent;
        const parent = labelEl.parentNode;
        
        // Hide checkbox and priority dot triggers temporarily
        const checkbox = parent.querySelector('input[type="checkbox"]');
        const prioTrigger = parent.querySelector('.priority-dot-trigger');
        if (checkbox) checkbox.style.display = 'none';
        if (prioTrigger) prioTrigger.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'task-edit-input';
        input.value = currentText;
        input.style.width = '100%';
        input.style.flexGrow = '1';

        parent.replaceChild(input, labelEl);
        input.focus();
        input.select();

        const saveChange = () => {
            const val = input.value.trim();
            if (val) {
                const log = Storage.getLogForDate(currentCode);
                const task = log.tasks.find(t => t.id === Number(taskId));
                if (task) {
                    task.text = val;
                    Storage.saveLogForDate(currentCode, log);
                }
            }
            renderTasks();
            renderRecents();
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                saveChange();
            } else if (e.key === 'Escape') {
                renderTasks();
            }
        };

        input.onblur = saveChange;
    }

    function getGoalBadgeHtml(goalId) {
        const goal = Storage.getGoals().find(g => g.id === goalId);
        if (!goal) return '';
        return `<span class="goal-tag-badge" title="Tagged Goal: ${escapeHtml(goal.name)}">${escapeHtml(goal.name)}</span>`;
    }

    function hasUnsavedJournalChanges() {
        return journalEditor && journalEditor.innerHTML !== originalJournalContent;
    }

    function updateJournalButtonsState() {
        const hasChanges = hasUnsavedJournalChanges();
        if (saveJournalBtn) saveJournalBtn.disabled = !hasChanges;
        if (cancelJournalBtn) cancelJournalBtn.disabled = !hasChanges;
        
        if (hasChanges) {
            saveStatus.textContent = "Unsaved changes";
            saveStatus.style.color = "var(--accent)";
            saveStatus.style.fontWeight = "600";
        } else {
            saveStatus.textContent = "All changes saved";
            saveStatus.style.color = "var(--text-muted)";
            saveStatus.style.fontWeight = "normal";
        }
    }

    function renderJournal() {
        const log = Storage.getLogForDate(currentCode);
        journalEditor.innerHTML = log.note || '';
        originalJournalContent = journalEditor.innerHTML;
        updateJournalButtonsState();
    }

    // Save Journal Note
    function saveJournal() {
        saveStatus.textContent = 'Saving...';
        saveStatus.style.color = "var(--text-muted)";
        const log = Storage.getLogForDate(currentCode);
        log.note = journalEditor.innerHTML;
        Storage.saveLogForDate(currentCode, log);
        originalJournalContent = log.note;
        setTimeout(() => {
            updateJournalButtonsState();
        }, 600);
    }

    // Cancel Journal Note Edit
    function cancelJournalEdit() {
        journalEditor.innerHTML = originalJournalContent;
        updateJournalButtonsState();
    }

    // Check for dirty state when user types
    function handleJournalInput() {
        updateJournalButtonsState();
    }

    // Priority Change popover logic
    function openPriorityPopover(e, taskId) {
        e.stopPropagation();
        closeAllPopovers();

        const trigger = e.target;
        const rect = trigger.getBoundingClientRect();

        const popover = document.createElement('div');
        popover.className = 'prio-popover';
        popover.style.top = `${window.scrollY + rect.top - 42}px`;
        
        // Dynamically bound left positioning to prevent clipping off-screen
        const popoverWidth = 110;
        const padding = 10;
        let left = window.scrollX + rect.left - 35;
        if (left < padding) {
            left = padding;
        } else if (left + popoverWidth > window.innerWidth - padding) {
            left = window.innerWidth - popoverWidth - padding;
        }
        popover.style.left = `${left}px`;

        const priorities = ['default', 'high', 'normal', 'low'];
        priorities.forEach(prio => {
            const opt = document.createElement('div');
            opt.className = 'prio-option-dot';
            opt.dataset.prio = prio;
            opt.title = prio === 'default' ? 'Default Priority' : `${prio.toUpperCase()} Priority`;
            opt.onclick = () => {
                setTaskPriority(taskId, prio);
                closeAllPopovers();
            };
            popover.appendChild(opt);
        });

        popoverContainer.appendChild(popover);
        
        // Prevent click from closing immediately
        setTimeout(() => {
            document.addEventListener('click', closeAllPopoversOnOutsideClick);
        }, 10);
    }

    function setTaskPriority(taskId, priority) {
        const log = Storage.getLogForDate(currentCode);
        const task = log.tasks.find(t => t.id === Number(taskId));
        if (task) {
            task.priority = priority;
            Storage.saveLogForDate(currentCode, log);
            renderTasks();
        }
    }

    // Progress Time Logger popover logic
    function openTimeLoggerPopover(e, taskId) {
        e.stopPropagation();
        closeAllPopovers();

        const trigger = e.currentTarget;
        const rect = trigger.getBoundingClientRect();

        const popover = document.createElement('div');
        popover.className = 'time-log-popover';
        popover.style.top = `${window.scrollY + rect.bottom + 6}px`;
        
        // Dynamically bound left positioning to prevent clipping off-screen
        const popoverWidth = 180;
        const padding = 10;
        let left = window.scrollX + rect.left - 150;
        if (left < padding) {
            left = padding;
        } else if (left + popoverWidth > window.innerWidth - padding) {
            left = window.innerWidth - popoverWidth - padding;
        }
        popover.style.left = `${left}px`;

        popover.innerHTML = `
            <div class="time-log-inputs">
                <input type="number" id="logHrs" placeholder="0" min="0" value="0" class="input-field">
                <span>hrs</span>
                <input type="number" id="logMins" placeholder="0" min="0" max="59" value="0" class="input-field">
                <span>mins</span>
            </div>
            <button id="submitTimeLogBtn" class="primary-btn">Log Progress</button>
        `;

        popoverContainer.appendChild(popover);

        const hrsInput = popover.querySelector('#logHrs');
        const minsInput = popover.querySelector('#logMins');
        const submitBtn = popover.querySelector('#submitTimeLogBtn');

        submitBtn.onclick = () => {
            const h = Number(hrsInput.value) || 0;
            const m = Number(minsInput.value) || 0;
            const totalMins = (h * 60) + m;
            if (totalMins > 0) {
                logTaskTimeSpent(taskId, totalMins);
            }
            closeAllPopovers();
        };

        setTimeout(() => {
            document.addEventListener('click', closeAllPopoversOnOutsideClick);
        }, 10);
    }

    function logTaskTimeSpent(taskId, minutes) {
        const log = Storage.getLogForDate(currentCode);
        const task = log.tasks.find(t => t.id === Number(taskId));
        if (task && task.goalId) {
            // Update local task
            task.timeSpent = (task.timeSpent || 0) + minutes;
            Storage.saveLogForDate(currentCode, log);

            // Log directly to the tagged goal!
            const goals = Storage.getGoals();
            const goal = goals.find(g => g.id === task.goalId);
            if (goal) {
                if (!goal.logs) goal.logs = [];
                goal.logs.unshift({
                    id: 'session-' + Date.now(),
                    note: `Spent on task: ${task.text}`,
                    amt: minutes,
                    date: currentCode
                });
                goal.currentTime = (goal.currentTime || 0) + minutes;
                if (goal.targetTime && goal.currentTime >= goal.targetTime) {
                    goal.completed = true;
                }
                Storage.saveGoals(goals);
            }
            renderTasks();
        }
    }

    function closeAllPopovers() {
        popoverContainer.innerHTML = '';
        document.removeEventListener('click', closeAllPopoversOnOutsideClick);
    }

    function closeAllPopoversOnOutsideClick(e) {
        if (!e.target.closest('.prio-popover') && !e.target.closest('.time-log-popover')) {
            closeAllPopovers();
        }
    }

    // Render Recent logs list (Sidebar)
    function renderRecents() {
        recentsGrid.innerHTML = '';
        const logs = Storage.getLogs();
        const sortedDates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
        
        const totalItems = sortedDates.length;
        const totalPages = Math.ceil(totalItems / RECENTS_PER_PAGE);
        if (recentsPage > totalPages && totalPages > 0) recentsPage = totalPages;

        const startIdx = (recentsPage - 1) * RECENTS_PER_PAGE;
        const pageDates = sortedDates.slice(startIdx, startIdx + RECENTS_PER_PAGE);

        if (pageDates.length === 0) {
            recentsGrid.innerHTML = '<div class="search-result-empty">No logged dates found.</div>';
            paginationControls.innerHTML = '';
            return;
        }

        pageDates.forEach(date => {
            const entry = logs[date];
            const card = document.createElement('div');
            card.className = `recent-card ${date === currentCode ? 'active' : ''}`;
            card.dataset.date = date;

            const completedTasks = (entry.tasks || []).filter(t => t.completed).slice(0, 2);
            let tasksHtml = '';
            if (completedTasks.length > 0) {
                tasksHtml = `<ul>${completedTasks.map(t => `<li>${escapeHtml(t.text)}</li>`).join('')}</ul>`;
            }

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = entry.note || '';
            const textNote = tempDiv.textContent || tempDiv.innerText || '';
            const previewNote = textNote ? `<p>${escapeHtml(textNote)}</p>` : '';

            const dateObj = new Date(date + 'T00:00:00');
            const dayLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            card.innerHTML = `
                <h4>${dayLabel} <span style="font-weight:400;color:var(--text-light);float:right;">#${entry.display_id}</span></h4>
                ${tasksHtml}
                ${previewNote}
            `;

            card.onclick = () => loadDay(date);
            recentsGrid.appendChild(card);
        });

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '←';
        prevBtn.disabled = recentsPage === 1;
        prevBtn.onclick = () => {
            recentsPage--;
            renderRecents();
        };

        const pageLabel = document.createElement('span');
        pageLabel.textContent = `${recentsPage} / ${totalPages}`;

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '→';
        nextBtn.disabled = recentsPage === totalPages;
        nextBtn.onclick = () => {
            recentsPage++;
            renderRecents();
        };

        paginationControls.appendChild(prevBtn);
        paginationControls.appendChild(pageLabel);
        paginationControls.appendChild(nextBtn);
    }

    // Logs Keyword Search functionality
    function handleSearch() {
        const query = logSearchInput.value.trim().toLowerCase();
        if (!query) {
            searchResults.style.display = 'none';
            return;
        }

        const logs = Storage.getLogs();
        const results = [];

        Object.keys(logs).forEach(date => {
            const entry = logs[date];
            let matchText = '';
            let isMatch = false;

            if (entry.tasks) {
                const matchedTask = entry.tasks.find(t => t.text.toLowerCase().includes(query));
                if (matchedTask) {
                    isMatch = true;
                    matchText = `Todo: "${matchedTask.text}"`;
                }
            }

            if (!isMatch && entry.note) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = entry.note;
                const textNote = tempDiv.textContent || tempDiv.innerText || '';
                const queryIndex = textNote.toLowerCase().indexOf(query);
                if (queryIndex !== -1) {
                    isMatch = true;
                    const start = Math.max(0, queryIndex - 25);
                    const end = Math.min(textNote.length, queryIndex + 50);
                    matchText = `Journal: "...${textNote.substring(start, end).trim()}..."`;
                }
            }

            if (isMatch) {
                results.push({
                    date,
                    display_id: entry.display_id,
                    matchText
                });
            }
        });

        renderSearchResults(results);
    }

    function renderSearchResults(results) {
        searchResults.innerHTML = '';
        if (results.length === 0) {
            searchResults.innerHTML = `<div class="search-result-empty">No matches found.</div>`;
        } else {
            results.slice(0, 8).forEach(res => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                
                const dateObj = new Date(res.date + 'T00:00:00');
                const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                item.innerHTML = `
                    <div class="search-result-date">${dateString} <span style="color:var(--text-light);font-weight:400;">#${res.display_id}</span></div>
                    <div class="search-result-match">${escapeHtml(res.matchText)}</div>
                `;
                item.onclick = () => {
                    loadDay(res.date);
                    logSearchInput.value = '';
                    searchResults.style.display = 'none';
                };
                searchResults.appendChild(item);
            });
        }
        searchResults.style.display = 'block';
    }

    // Native Drag and Drop Sorting Engine
    function setupDragAndDrop() {
        let draggedItem = null;

        todoList.addEventListener('dragstart', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                draggedItem = taskItem;
                taskItem.classList.add('dragging');
            }
        });

        todoList.addEventListener('dragend', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                taskItem.classList.remove('dragging');
            }
            draggedItem = null;
        });

        todoList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            const afterElement = getDragAfterElement(todoList, e.clientY);
            if (afterElement == null) {
                todoList.appendChild(dragging);
            } else {
                todoList.insertBefore(dragging, afterElement);
            }
        });

        todoList.addEventListener('drop', (e) => {
            e.preventDefault();
            // Re-map tasks array inside localStorage to match current DOM order
            const itemElements = [...todoList.querySelectorAll('.task-item')];
            const newOrderedIds = itemElements.map(el => Number(el.dataset.id));
            
            const log = Storage.getLogForDate(currentCode);
            if (log.tasks) {
                log.tasks.sort((a, b) => newOrderedIds.indexOf(a.id) - newOrderedIds.indexOf(b.id));
                Storage.saveLogForDate(currentCode, log);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Set up standard window/DOM event listeners
    function setupEventListeners() {
        // Date navigation
        prevDayBtn.onclick = () => {
            const curDate = new Date(currentCode + 'T00:00:00');
            curDate.setDate(curDate.getDate() - 1);
            loadDay(Storage.getLocalDateString(curDate));
        };

        nextDayBtn.onclick = () => {
            const curDate = new Date(currentCode + 'T00:00:00');
            curDate.setDate(curDate.getDate() + 1);
            loadDay(Storage.getLocalDateString(curDate));
        };

        todayBtn.onclick = () => {
            loadDay(Storage.getLocalDateString());
        };

        // Task addition state
        taskInput.oninput = () => {
            addTaskBtn.disabled = !taskInput.value.trim();
        };

        taskInput.onkeydown = (e) => {
            if (e.key === 'Enter' && !addTaskBtn.disabled) {
                addTaskBtn.click();
            }
        };

        // Pre-fill task input box with the goal's name when a goal is selected
        goalTagSelect.onchange = () => {
            const goalId = goalTagSelect.value;
            if (goalId) {
                const goals = Storage.getGoals();
                const goal = goals.find(g => g.id === goalId);
                if (goal) {
                    taskInput.value = goal.name;
                    addTaskBtn.disabled = false;
                }
            }
        };

        addTaskBtn.onclick = () => {
            const text = taskInput.value.trim();
            const goalId = goalTagSelect.value || null;
            if (!text) return;

            const log = Storage.getLogForDate(currentCode);
            if (!log.tasks) log.tasks = [];

            log.tasks.push({
                id: Date.now(),
                text: text,
                completed: false,
                priority: 'default',
                goalId: goalId,
                timeSpent: 0
            });

            Storage.saveLogForDate(currentCode, log);
            
            taskInput.value = '';
            goalTagSelect.value = '';
            addTaskBtn.disabled = true;
            
            renderTasks();
            renderRecents();
        };

        // Click actions delegation
        todoList.onclick = (e) => {
            const priorityTrigger = e.target.closest('.priority-dot-trigger');
            if (priorityTrigger) {
                openPriorityPopover(e, priorityTrigger.dataset.id);
                return;
            }

            const timeTrigger = e.target.closest('.time-log-btn');
            if (timeTrigger) {
                openTimeLoggerPopover(e, timeTrigger.dataset.id);
                return;
            }

            const delBtn = e.target.closest('.delete-task-btn');
            if (delBtn) {
                const taskId = Number(delBtn.dataset.id);
                const log = Storage.getLogForDate(currentCode);
                log.tasks = log.tasks.filter(t => t.id !== taskId);
                Storage.saveLogForDate(currentCode, log);
                renderTasks();
                renderRecents();
                return;
            }

            const chk = e.target;
            if (chk.type === 'checkbox') {
                const taskId = Number(chk.dataset.id);
                const log = Storage.getLogForDate(currentCode);
                const task = log.tasks.find(t => t.id === taskId);
                if (task) {
                    // Validation: Do not allow completing progress-based tasks if no time has been logged yet
                    if (chk.checked && task.goalId) {
                        const goals = Storage.getGoals();
                        const goal = goals.find(g => g.id === task.goalId);
                        if (goal && goal.type === 'progress-based') {
                            const timeSpent = task.timeSpent || 0;
                            if (timeSpent <= 0) {
                                alert(`Please log some time spent on "${task.text}" (using the timer button) before marking it as completed!`);
                                chk.checked = false;
                                return;
                            }
                        }
                    }

                    task.completed = chk.checked;
                    Storage.saveLogForDate(currentCode, log);
                    chk.closest('.task-item').classList.toggle('completed', chk.checked);
                    
                    // Cohesive Goals integration: Auto-update the tagged goal's state if it's one-time or repeat!
                    if (task.goalId) {
                        const goals = Storage.getGoals();
                        const goal = goals.find(g => g.id === task.goalId);
                        if (goal) {
                            if (goal.type === 'one-time') {
                                goal.completed = task.completed;
                                Storage.saveGoals(goals);
                            } else if (goal.type === 'repeat') {
                                if (!goal.logs) goal.logs = [];
                                if (task.completed) {
                                    // Log a repeat completion associated with this task
                                    const exists = goal.logs.some(l => l.id === 'repeat-task-' + task.id);
                                    if (!exists) {
                                        goal.logs.unshift({
                                            id: 'repeat-task-' + task.id,
                                            note: `Completed via task: ${task.text}`,
                                            amt: 0,
                                            date: currentCode
                                        });
                                    }
                                } else {
                                    // Remove the completion log
                                    goal.logs = goal.logs.filter(l => l.id !== 'repeat-task-' + task.id);
                                }
                                Storage.saveGoals(goals);
                            }
                        }
                    }
                    
                    renderRecents();
                }
            }
        };

        // Editor rich text command trigger
        editorToolbar.onclick = (e) => {
            const btn = e.target.closest('.toolbar-btn');
            if (!btn) return;
            const cmd = btn.dataset.command;
            document.execCommand(cmd, false, null);
            journalEditor.focus();
            handleJournalInput();
        };

        // Note editor interactions
        journalEditor.oninput = handleJournalInput;

        // Save & Cancel journal triggers
        if (saveJournalBtn) {
            saveJournalBtn.onclick = saveJournal;
        }
        if (cancelJournalBtn) {
            cancelJournalBtn.onclick = cancelJournalEdit;
        }

        // Before reload / exit prompt if dirty
        window.onbeforeunload = (e) => {
            if (hasUnsavedJournalChanges()) {
                e.preventDefault();
                e.returnValue = "You have unsaved changes in your journal. Are you sure you want to leave?";
                return e.returnValue;
            }
        };

        // Search trigger
        logSearchInput.oninput = handleSearch;
        
        // Hide search results dropdown on body clicks
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResults.style.display = 'none';
            }
        });

        // Export data logic
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

        // Reset data logic
        resetBtn.onclick = () => {
            if (confirm("Reset ALL data in Apollo? This will replace your logs and goals with fresh default samples.")) {
                Storage.resetAll();
                loadDay(Storage.getLocalDateString());
            }
        };

        // Listens for external updates (like cross-tab sync)
        window.addEventListener('apollo_data_updated', () => {
            loadDay(currentCode);
        });
    }

    // Safety helpers
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Bootstrap
    window.onload = init;
})();
