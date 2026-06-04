(() => {
    // Apollo Storage Wrapper with Supabase Hybrid Cloud Sync
    const STORAGE_KEYS = {
        LOGS: 'apollo_logs',
        GOALS: 'apollo_goals',
        REMINDERS: 'apollo_reminders',
        SUPABASE_URL: 'apollo_supabase_url',
        SUPABASE_KEY: 'apollo_supabase_key',
        LAST_UPDATED: 'apollo_last_updated'
    };

    let supabase = null;

    // Initialize Supabase Client
    function initSupabase() {
        let url = window.ApolloConfig?.supabaseUrl;
        let key = window.ApolloConfig?.supabaseKey;

        // Fallback to localStorage configuration if config is empty
        if (!url || !key) {
            url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL);
            key = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY);
        }

        if (url && key && window.supabase) {
            try {
                supabase = window.supabase.createClient(url, key);
            } catch (e) {
                console.error("Failed to initialize Supabase client:", e);
                supabase = null;
            }
        } else {
            supabase = null;
        }
    }

    // Helper to generate a short random alphanumeric code
    function generateRandomCode() {
        return Math.random().toString(36).substring(2, 9).toUpperCase();
    }

    // Get current date string in Asia/Manila (Philippines) timezone (YYYY-MM-DD)
    function getLocalDateString(date = new Date()) {
        const phOffset = 8 * 60 * 60 * 1000; // 8 hours in ms
        const phDate = new Date(date.getTime() + phOffset);
        
        const year = phDate.getUTCFullYear();
        const month = String(phDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(phDate.getUTCDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    // Get current year and month in Asia/Manila (Philippines) timezone
    function getPHYearAndMonth() {
        const phOffset = 8 * 60 * 60 * 1000; // 8 hours in ms
        const phDate = new Date(Date.now() + phOffset);
        
        const year = phDate.getUTCFullYear();
        const month = phDate.getUTCMonth(); // 0-indexed
        
        return { year, month };
    }

    // Helper to format minutes to a sleek "Xh Ym" or "Ym" or "Xh" string
    function formatMinutes(totalMinutes) {
        if (!totalMinutes || totalMinutes <= 0) return '0m';
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    // Seed beautiful default data if storage is empty
    function seedDefaultData() {
        const todayStr = getLocalDateString();
        const yesterdayStr = getLocalDateString(new Date(Date.now() - 86400000));
        const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));

        // Sample Goals
        const defaultGoals = [
            {
                id: 'goal-1',
                name: 'UI Redesign of Apollo',
                period: 'week',
                type: 'progress-based',
                targetTime: 600, // 10 hours
                currentTime: 180, // 3 hours
                startDate: todayStr,
                completed: false,
                logs: [
                    { id: 'log-1', note: 'Drafted architecture and state layer', amt: 120, date: yesterdayStr },
                    { id: 'log-2', note: 'Created style tokens and global components', amt: 60, date: todayStr }
                ]
            },
            {
                id: 'goal-2',
                name: 'Morning Mindfulness',
                period: 'day',
                type: 'repeat',
                interval: 1, // repeat every day
                startDate: yesterdayStr,
                completed: false,
                logs: []
            },
            {
                id: 'goal-3',
                name: 'Read Designing Systems',
                period: 'month',
                type: 'one-time',
                startDate: todayStr,
                completed: false,
                logs: []
            }
        ];

        // Sample Daily Logs
        const defaultLogs = {
            [yesterdayStr]: {
                date: yesterdayStr,
                display_id: generateRandomCode(),
                tasks: [
                    { id: 100001, text: 'Review feedback on Khalix app', completed: true, priority: 'normal', goalId: null, timeSpent: 0 },
                    { id: 100002, text: 'Plan database schema migration', completed: true, priority: 'prio', goalId: 'goal-1', timeSpent: 120 },
                    { id: 100003, text: 'Clean coffee machine', completed: false, priority: 'low', goalId: null, timeSpent: 0 }
                ],
                note: '<div>Started planning the redesign for <strong>Apollo</strong> dashboard today. The transition away from Supabase should simplify local usage tremendously.</div><ul><li>Discussed core goals with the team</li><li>Concluded that minimalist design language will work best</li></ul>'
            },
            [todayStr]: {
                date: todayStr,
                display_id: generateRandomCode(),
                tasks: [
                    { id: 100004, text: 'Refactor UI with flat color system', completed: false, priority: 'prio', goalId: 'goal-1', timeSpent: 60 },
                    { id: 100005, text: 'Meditate for 15 minutes', completed: true, priority: 'normal', goalId: 'goal-2', timeSpent: 15 },
                    { id: 100006, text: 'Set up local storage layer', completed: true, priority: 'prio', goalId: null, timeSpent: 0 }
                ],
                note: '<div>Woke up feeling motivated today. Seeding Apollo database structure in local storage was incredibly straightforward.</div><div><br></div><div>Looking forward to adding the calendar reminders next. <em>Everything is super fast.</em></div>'
            }
        };

        // Sample Reminders
        const defaultReminders = [
            {
                id: 'rem-1',
                date: todayStr,
                title: 'Review redesigned dashboard layout',
                note: 'Double check visual alignment and color palette',
                time: '14:30'
            },
            {
                id: 'rem-2',
                date: tomorrowStr,
                title: 'Design review with client',
                note: 'Demonstrate local storage and goals syncing features',
                time: '10:00'
            }
        ];

        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(defaultGoals));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(defaultLogs));
        localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(defaultReminders));
        localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
    }

    // Clean up empty logs from storage
    function cleanupEmptyLogs() {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || {};
        let changed = false;
        Object.keys(logs).forEach(date => {
            const entry = logs[date];
            const hasTasks = entry.tasks && entry.tasks.length > 0;
            const cleanNoteText = (entry.note || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            const hasNote = cleanNoteText !== '';
            
            if (!hasTasks && !hasNote) {
                delete logs[date];
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
            localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
        }
    }

    // Run Seeding check
    if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
        seedDefaultData();
    } else {
        cleanupEmptyLogs();
    }

    // Initialize Supabase Client immediately on script load
    initSupabase();

    // State Management API
    window.ApolloStorage = {
        getLocalDateString,
        getPHYearAndMonth,
        generateRandomCode,
        formatMinutes,

        // Daily Logs
        getLogs() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || {};
        },

        getLogForDate(dateStr) {
            const logs = this.getLogs();
            if (!logs[dateStr]) {
                return {
                    date: dateStr,
                    display_id: generateRandomCode(),
                    tasks: [],
                    note: ''
                };
            }
            return logs[dateStr];
        },

        saveLogs(logs) {
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
            localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
            this.triggerCloudSync();
            window.dispatchEvent(new Event('apollo_data_updated'));
        },

        saveLogForDate(dateStr, logData) {
            const logs = this.getLogs();
            const hasTasks = logData.tasks && logData.tasks.length > 0;
            const cleanNoteText = (logData.note || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
            const hasNote = cleanNoteText !== '';

            if (!hasTasks && !hasNote) {
                if (logs[dateStr]) {
                    delete logs[dateStr];
                    this.saveLogs(logs);
                }
            } else {
                logs[dateStr] = logData;
                this.saveLogs(logs);
            }
        },

        // Goals
        getGoals() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS)) || [];
        },

        saveGoals(goals) {
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
            localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
            this.triggerCloudSync();
            window.dispatchEvent(new Event('apollo_data_updated'));
        },

        addGoal(goal) {
            const goals = this.getGoals();
            goals.push(goal);
            this.saveGoals(goals);
        },

        updateGoal(updatedGoal) {
            const goals = this.getGoals();
            const idx = goals.findIndex(g => g.id === updatedGoal.id);
            if (idx !== -1) {
                goals[idx] = updatedGoal;
                this.saveGoals(goals);
            }
        },

        deleteGoal(goalId) {
            const goals = this.getGoals();
            const filtered = goals.filter(g => g.id !== goalId);
            this.saveGoals(filtered);

            // Clean references
            const logs = this.getLogs();
            let changed = false;
            Object.keys(logs).forEach(date => {
                logs[date].tasks.forEach(task => {
                    if (task.goalId === goalId) {
                        task.goalId = null;
                        changed = true;
                    }
                });
            });
            if (changed) this.saveLogs(logs);
        },

        // Reminders
        getReminders() {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.REMINDERS)) || [];
        },

        saveReminders(reminders) {
            localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
            localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
            this.triggerCloudSync();
            window.dispatchEvent(new Event('apollo_data_updated'));
        },

        addReminder(reminder) {
            const reminders = this.getReminders();
            reminders.push(reminder);
            this.saveReminders(reminders);
        },

        deleteReminder(reminderId) {
            const reminders = this.getReminders();
            const filtered = reminders.filter(r => r.id !== reminderId);
            this.saveReminders(filtered);
        },

        // Reset Data Entirely
        resetAll() {
            localStorage.clear();
            seedDefaultData();
            initSupabase();
            window.dispatchEvent(new Event('apollo_data_updated'));
        },

        // --- CLOUD SYNC LOGIC ---

        isSupabaseConnected() {
            return supabase !== null;
        },

        getSupabaseInstance() {
            return supabase;
        },

        async getLoggedInUser() {
            if (!supabase) return null;
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                if (error || !user) return null;
                return user;
            } catch (e) {
                return null;
            }
        },

        // Push current local state directly to Supabase
        async pushToCloud() {
            if (!supabase) return false;
            try {
                const user = await this.getLoggedInUser();
                if (!user) return false;

                const logs = this.getLogs();
                const goals = this.getGoals();
                const reminders = this.getReminders();
                const lastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED) || new Date().toISOString();

                const { error } = await supabase
                    .from('apollo_user_data')
                    .upsert({
                        user_id: user.id,
                        logs: logs,
                        goals: goals,
                        reminders: reminders,
                        updated_at: lastUpdated
                    });

                if (error) {
                    console.error("Cloud push failed:", error);
                    return false;
                }
                return true;
            } catch (e) {
                console.error("Cloud push error:", e);
                return false;
            }
        },

        // Pull latest state from Supabase, merge using LWW timestamps
        async pullFromCloud() {
            if (!supabase) return false;
            try {
                const user = await this.getLoggedInUser();
                if (!user) return false;

                const { data, error } = await supabase
                    .from('apollo_user_data')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error) {
                    console.error("Cloud pull failed:", error);
                    return false;
                }

                // If user doesn't have a remote record yet, seed the database with current local storage data
                if (!data) {
                    await this.pushToCloud();
                    return true;
                }

                const remoteUpdated = data.updated_at ? new Date(data.updated_at).getTime() : 0;
                const localUpdatedStr = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
                const localUpdated = localUpdatedStr ? new Date(localUpdatedStr).getTime() : 0;

                if (remoteUpdated > localUpdated) {
                    // Overwrite local with newer remote data
                    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs || {}));
                    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals || []));
                    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(data.reminders || []));
                    localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, data.updated_at);
                    
                    window.dispatchEvent(new Event('apollo_data_updated'));
                    return true;
                } else if (localUpdated > remoteUpdated) {
                    // Local is newer (e.g. offline edits made), push up
                    await this.pushToCloud();
                }
                return true;
            } catch (e) {
                console.error("Cloud pull error:", e);
                return false;
            }
        },

        // Safe background trigger
        triggerCloudSync() {
            this.pushToCloud().catch(err => console.warn("Background upload failed:", err));
        }
    };

    // Auto sync check on startup
    setTimeout(() => {
        window.ApolloStorage.pullFromCloud().catch(() => {});
    }, 1000);

    // --- INTERACTIVE SWISS CONFIG MODAL ENGINE ---

    // Dynamic style injection for Swiss-style Modal
    function injectModalStyles() {
        if (document.getElementById('apolloSyncModalStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'apolloSyncModalStyles';
        style.textContent = `
            .sync-modal-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(2px);
                font-family: 'Inter', -apple-system, sans-serif;
            }
            .sync-modal-card {
                background-color: var(--bg-card, #ffffff);
                border: 2px solid var(--border-color, #000000);
                width: 90%;
                max-width: 480px;
                box-shadow: 0px 0px 0px rgba(0,0,0,0);
                display: flex;
                flex-direction: column;
                color: var(--text-main, #000000);
            }
            .sync-modal-header {
                padding: 1.25rem 1.5rem;
                border-bottom: 2px solid var(--border-color, #000000);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .sync-modal-header h3 {
                font-family: 'Inter', sans-serif;
                font-size: 1.25rem;
                font-weight: 800;
                letter-spacing: -0.04em;
                margin: 0;
                text-transform: uppercase;
            }
            .sync-modal-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-light, #5e5e6e);
                cursor: pointer;
                padding: 0; line-height: 1;
            }
            .sync-modal-close:hover {
                color: var(--accent, #FF3E00);
            }
            .sync-modal-body {
                padding: 1.5rem;
                max-height: 80vh;
                overflow-y: auto;
            }
            .sync-section-title {
                font-size: 0.85rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--text-light, #5e5e6e);
                margin: 0 0 1rem;
            }
            .sync-info-text {
                font-size: 0.875rem;
                line-height: 1.4;
                color: var(--text-light, #5e5e6e);
                margin-bottom: 1.25rem;
            }
            .sync-tabs {
                display: flex;
                border-bottom: 2px solid var(--border-color, #000000);
                margin-bottom: 1.25rem;
            }
            .sync-tab-btn {
                flex: 1;
                background: none;
                border: none;
                padding: 0.75rem;
                font-size: 0.85rem;
                font-weight: 700;
                cursor: pointer;
                text-transform: uppercase;
                color: var(--text-light, #5e5e6e);
                text-align: center;
            }
            .sync-tab-btn.active {
                background-color: var(--border-color, #000000);
                color: var(--bg-card, #ffffff);
            }
            .sync-form-group {
                margin-bottom: 1rem;
                display: flex;
                flex-direction: column;
                gap: 0.35rem;
            }
            .sync-form-group label {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                color: var(--text-main, #000000);
            }
            .sync-input {
                font-family: 'Inter', sans-serif;
                font-size: 0.875rem;
                padding: 0.6rem 0.75rem;
                background-color: var(--bg-card, #ffffff);
                border: 1px solid var(--border-color, #e5e5ea);
                color: var(--text-main, #000000);
                outline: none;
            }
            .sync-input:focus {
                border-color: var(--accent, #FF3E00);
                border-width: 2px;
            }
            .sync-btn-primary {
                background-color: var(--accent, #FF3E00);
                color: #ffffff;
                border: 2px solid var(--border-color, #000000);
                padding: 0.75rem;
                font-family: 'Inter', sans-serif;
                font-size: 0.875rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.02em;
                cursor: pointer;
                transition: none;
                width: 100%;
                text-align: center;
            }
            .sync-btn-primary:hover {
                background-color: var(--text-main, #000000);
                color: var(--bg-card, #ffffff);
            }
            .sync-btn-secondary {
                background: none;
                color: var(--text-main, #000000);
                border: 1px solid var(--border-color, #000000);
                padding: 0.6rem 0.75rem;
                font-family: 'Inter', sans-serif;
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                cursor: pointer;
                text-align: center;
            }
            .sync-btn-secondary:hover {
                background-color: var(--border-color, #000000);
                color: var(--bg-card, #ffffff);
            }
            .sync-status-badge {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                padding: 0.35rem 0.6rem;
                border: 1px solid var(--border-color, #000000);
                background-color: rgba(0,0,0,0.03);
            }
            .sync-status-dot {
                width: 8px; height: 8px;
                border-radius: 50%;
                background-color: #8e8e93;
            }
            .sync-status-dot.active {
                background-color: #10b981;
                box-shadow: 0 0 8px #10b981;
                animation: sync-pulse 2s infinite;
            }
            @keyframes sync-pulse {
                0% { opacity: 0.4; }
                50% { opacity: 1; }
                100% { opacity: 0.4; }
            }
            .sync-error-msg {
                font-size: 0.8rem;
                color: #ef4444;
                margin-top: 0.5rem;
                font-weight: 600;
            }
            .sync-collapsible {
                margin-top: 1rem;
                border: 1px dashed var(--border-color, #e5e5ea);
                padding: 0.75rem;
            }
            .sync-collapsible summary {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                cursor: pointer;
                user-select: none;
                color: var(--text-light, #5e5e6e);
            }
            .sync-collapsible pre {
                background-color: rgba(0,0,0,0.03);
                font-size: 0.7rem;
                padding: 0.5rem;
                overflow-x: auto;
                margin: 0.5rem 0 0;
                color: var(--text-main, #000000);
                border: 1px solid var(--border-color, #e5e5ea);
            }
            .sync-meta-panel {
                background-color: rgba(0,0,0,0.02);
                border: 1px solid var(--border-color, #e5e5ea);
                padding: 0.75rem;
                margin-bottom: 1.25rem;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                font-size: 0.8rem;
            }
        `;
        document.head.appendChild(style);
    }

    // Opens or creates the Cloud Sync modal dialog
    async function openSyncModal() {
        injectModalStyles();
        
        let container = document.getElementById('syncModalOverlay');
        if (!container) {
            container = document.createElement('div');
            container.id = 'syncModalOverlay';
            container.className = 'sync-modal-overlay';
            document.body.appendChild(container);
        }

        container.style.display = 'flex';
        await renderSyncModalContent();
    }

    function closeSyncModal() {
        const container = document.getElementById('syncModalOverlay');
        if (container) container.style.display = 'none';
    }

    // Dynamic internal state renderer of the modal
    async function renderSyncModalContent() {
        const container = document.getElementById('syncModalOverlay');
        if (!container) return;

        const isConnected = window.ApolloStorage.isSupabaseConnected();
        const user = isConnected ? await window.ApolloStorage.getLoggedInUser() : null;

        // SQL Schema for Collapsible Help Box
        const sqlSchema = `CREATE TABLE apollo_user_data (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  logs JSONB DEFAULT '{}'::jsonb,
  goals JSONB DEFAULT '[]'::jsonb,
  reminders JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE apollo_user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner select" ON apollo_user_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owner insert" ON apollo_user_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner update" ON apollo_user_data
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);`;

        // SCENARIO 1: Unconfigured / Dynamic Credentials Inputs
        if (!isConnected) {
            container.innerHTML = `
                <div class="sync-modal-card">
                    <div class="sync-modal-header">
                        <h3>Supabase Storage Setup</h3>
                        <button class="sync-modal-close" id="modalCloseBtn">&times;</button>
                    </div>
                    <div class="sync-modal-body">
                        <p class="sync-info-text">
                            Apollo uses Supabase to sync and persist your data across multiple devices. Enter your project's URL and public API key below.
                        </p>
                        
                        <form id="setupConfigForm">
                            <div class="sync-form-group">
                                <label for="supUrl">Supabase Project URL</label>
                                <input type="url" id="supUrl" class="sync-input" placeholder="https://your-project.supabase.co" required>
                            </div>
                            <div class="sync-form-group">
                                <label for="supKey">Public Anon Key</label>
                                <input type="text" id="supKey" class="sync-input" placeholder="eyJhbGciOiJIUzI1Ni..." required>
                            </div>
                            <div id="setupError" class="sync-error-msg" style="display:none;"></div>
                            <button type="submit" class="sync-btn-primary" style="margin-top:0.5rem;">Connect Supabase</button>
                        </form>

                        <details class="sync-collapsible">
                            <summary>Required SQL Database Schema</summary>
                            <p style="font-size:0.75rem;margin:0.5rem 0 0.25rem;color:var(--text-light);">
                                Execute this statement inside your Supabase project's SQL Editor to set up the data table and security rules:
                            </p>
                            <pre>${sqlSchema}</pre>
                        </details>
                    </div>
                </div>
            `;

            // Setup listeners
            document.getElementById('modalCloseBtn').onclick = closeSyncModal;
            document.getElementById('setupConfigForm').onsubmit = (e) => {
                e.preventDefault();
                const url = document.getElementById('supUrl').value.trim();
                const key = document.getElementById('supKey').value.trim();
                const errBox = document.getElementById('setupError');

                if (url && key) {
                    try {
                        localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
                        localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
                        initSupabase();

                        if (window.ApolloStorage.isSupabaseConnected()) {
                            renderSyncModalContent();
                        } else {
                            errBox.textContent = "Could not initialize client. Check your URL formatting.";
                            errBox.style.display = 'block';
                        }
                    } catch (err) {
                        errBox.textContent = "Error setting configuration. Please retry.";
                        errBox.style.display = 'block';
                    }
                }
            };
            return;
        }

        // SCENARIO 2: Connected to Supabase Project but not Logged In
        if (!user) {
            container.innerHTML = `
                <div class="sync-modal-card">
                    <div class="sync-modal-header">
                        <h3>Supabase Cloud Sync</h3>
                        <button class="sync-modal-close" id="modalCloseBtn">&times;</button>
                    </div>
                    <div class="sync-tabs">
                        <button class="sync-tab-btn active" id="tabLoginBtn">Sign In</button>
                        <button class="sync-tab-btn" id="tabRegisterBtn">Sign Up</button>
                    </div>
                    <div class="sync-modal-body">
                        <div class="sync-meta-panel" style="margin-top:-0.5rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:700;">Database:</span>
                                <span style="color:var(--text-light); text-overflow:ellipsis; overflow:hidden; max-width:250px;">${supabase.supabaseUrl}</span>
                            </div>
                            <button id="disconnectProjBtn" class="sync-btn-secondary" style="font-size:0.75rem; padding:0.25rem; margin-top:0.25rem;">Disconnect Project</button>
                        </div>

                        <form id="authSyncForm">
                            <div class="sync-form-group">
                                <label for="authEmail">Email Address</label>
                                <input type="email" id="authEmail" class="sync-input" placeholder="name@domain.com" required>
                            </div>
                            <div class="sync-form-group">
                                <label for="authPassword">Password</label>
                                <input type="password" id="authPassword" class="sync-input" placeholder="••••••••" required>
                            </div>
                            <div id="authError" class="sync-error-msg" style="display:none;"></div>
                            <button type="submit" class="sync-btn-primary" id="authSubmitBtn" style="margin-top:0.5rem;">Sign In</button>
                        </form>
                    </div>
                </div>
            `;

            // Listeners
            let activeTab = 'login';
            const emailInput = document.getElementById('authEmail');
            const passInput = document.getElementById('authPassword');
            const errBox = document.getElementById('authError');
            const submitBtn = document.getElementById('authSubmitBtn');
            const tabLoginBtn = document.getElementById('tabLoginBtn');
            const tabRegisterBtn = document.getElementById('tabRegisterBtn');

            document.getElementById('modalCloseBtn').onclick = closeSyncModal;
            
            document.getElementById('disconnectProjBtn').onclick = () => {
                if (confirm("Disconnect and reset your Supabase project keys?")) {
                    localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
                    localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
                    initSupabase();
                    renderSyncModalContent();
                }
            };

            tabLoginBtn.onclick = () => {
                activeTab = 'login';
                tabLoginBtn.classList.add('active');
                tabRegisterBtn.classList.remove('active');
                submitBtn.textContent = 'Sign In';
                errBox.style.display = 'none';
            };

            tabRegisterBtn.onclick = () => {
                activeTab = 'register';
                tabRegisterBtn.classList.add('active');
                tabLoginBtn.classList.remove('active');
                submitBtn.textContent = 'Create Account';
                errBox.style.display = 'none';
            };

            document.getElementById('authSyncForm').onsubmit = async (e) => {
                e.preventDefault();
                submitBtn.disabled = true;
                submitBtn.textContent = activeTab === 'login' ? 'Signing In...' : 'Signing Up...';
                errBox.style.display = 'none';

                const email = emailInput.value.trim();
                const password = passInput.value;

                try {
                    if (activeTab === 'login') {
                        const { error } = await supabase.auth.signInWithPassword({ email, password });
                        if (error) {
                            errBox.textContent = error.message;
                            errBox.style.display = 'block';
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Sign In';
                        } else {
                            // Successful login, pull and refresh view
                            await window.ApolloStorage.pullFromCloud();
                            renderSyncModalContent();
                        }
                    } else {
                        const { error } = await supabase.auth.signUp({ email, password });
                        if (error) {
                            errBox.textContent = error.message;
                            errBox.style.display = 'block';
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Create Account';
                        } else {
                            alert("Account successfully registered! If you configured email confirmation, please check your inbox.");
                            activeTab = 'login';
                            tabLoginBtn.click();
                        }
                    }
                } catch (err) {
                    errBox.textContent = "A system authentication error occurred.";
                    errBox.style.display = 'block';
                    submitBtn.disabled = false;
                    submitBtn.textContent = activeTab === 'login' ? 'Sign In' : 'Create Account';
                }
            };
            return;
        }

        // SCENARIO 3: Logged In & Syncing Status Dashboard
        const localLastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
        const lastUpdatedText = localLastUpdated ? new Date(localLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never';

        container.innerHTML = `
            <div class="sync-modal-card">
                <div class="sync-modal-header">
                    <h3>Apollo Storage Sync</h3>
                    <button class="sync-modal-close" id="modalCloseBtn">&times;</button>
                </div>
                <div class="sync-modal-body">
                    <div class="sync-meta-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700;">Account:</span>
                            <span>${user.email}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700;">Status:</span>
                            <div class="sync-status-badge">
                                <span class="sync-status-dot active"></span>
                                <span>Synced</span>
                            </div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:700;">Last Update Check:</span>
                            <span>${lastUpdatedText}</span>
                        </div>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:0.75rem;">
                        <button id="forcePullBtn" class="sync-btn-secondary" style="width:100%; padding:0.75rem;">
                            Force Cloud Pull (Download)
                        </button>
                        <button id="forcePushBtn" class="sync-btn-secondary" style="width:100%; padding:0.75rem;">
                            Force Cloud Push (Upload)
                        </button>
                        <button id="logoutBtn" class="sync-btn-primary" style="width:100%; padding:0.75rem; background-color:#ef4444; border-color:#ef4444;">
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Listeners
        document.getElementById('modalCloseBtn').onclick = closeSyncModal;
        
        document.getElementById('forcePullBtn').onclick = async () => {
            const btn = document.getElementById('forcePullBtn');
            btn.disabled = true;
            btn.textContent = 'Pulling...';
            
            try {
                // Clear timestamps to force local override
                localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, "2000-01-01T00:00:00.000Z");
                const ok = await window.ApolloStorage.pullFromCloud();
                if (ok) {
                    alert("Data successfully downloaded from Supabase!");
                } else {
                    alert("Download failed. Make sure your database table contains valid rows.");
                }
            } catch (err) {
                alert("Error during sync pull.");
            }
            renderSyncModalContent();
        };

        document.getElementById('forcePushBtn').onclick = async () => {
            const btn = document.getElementById('forcePushBtn');
            btn.disabled = true;
            btn.textContent = 'Pushing...';
            
            try {
                localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, new Date().toISOString());
                const ok = await window.ApolloStorage.pushToCloud();
                if (ok) {
                    alert("Local data successfully uploaded and synchronized on Supabase!");
                } else {
                    alert("Upload failed. Verify database connectivity.");
                }
            } catch (err) {
                alert("Error during sync push.");
            }
            renderSyncModalContent();
        };

        document.getElementById('logoutBtn').onclick = async () => {
            if (confirm("Log out of Apollo Sync? This will clear your current local session cache and reset local values to samples.")) {
                try {
                    await supabase.auth.signOut();
                    window.ApolloStorage.resetAll();
                    closeSyncModal();
                } catch (err) {
                    alert("Error signing out.");
                }
            }
        };
    }

    // Connect trigger button listener when Document is fully loaded
    function bootstrapSyncUI() {
        const syncBtn = document.getElementById('syncBtn');
        if (syncBtn) {
            syncBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openSyncModal();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapSyncUI);
    } else {
        bootstrapSyncUI();
    }
})();
