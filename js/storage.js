(() => {
    // Apollo Storage Wrapper with Supabase Hybrid Cloud Sync (Google OAuth)
    const STORAGE_KEYS = {
        LOGS: 'apollo_logs',
        GOALS: 'apollo_goals',
        REMINDERS: 'apollo_reminders',
        SUPABASE_URL: 'apollo_supabase_url',
        SUPABASE_KEY: 'apollo_supabase_key',
        LAST_UPDATED: 'apollo_last_updated'
    };

    let supabase = null;

    // Initialize Supabase Client & Register Auth State Listeners
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
                
                // Track real-time Auth state shifts (especially successful redirect callbacks)
                supabase.auth.onAuthStateChange(async (event, session) => {
                    if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
                        // Background download on successful login/callback (forced pull to prevent empty seed overrides)
                        await window.ApolloStorage.pullFromCloud(true);
                        
                        // Refresh the Sync Control Panel UI if currently open
                        const container = document.getElementById('syncModalOverlay');
                        if (container && container.style.display === 'flex') {
                            renderSyncModalContent();
                        }
                    }
                });
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

    // Seed default blank structures if storage is empty
    function seedDefaultData() {
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify({}));
        localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, "2000-01-01T00:00:00.000Z");
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
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error || !session) return null;
                return session.user;
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

        // Pull latest state from Supabase and overwrite local cache (Sovereign Cloud Source of Truth)
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

                // Always overwrite local cache with cloud data since Cloud is the sovereign source of truth
                localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs || {}));
                localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals || []));
                localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(data.reminders || []));
                localStorage.setItem(STORAGE_KEYS.LAST_UPDATED, data.updated_at || new Date().toISOString());
                
                window.dispatchEvent(new Event('apollo_data_updated'));
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

    // Auto sync check is handled by enforceMandatoryAuth() on startup.

    // --- INTERACTIVE SWISS CONFIG MODAL ENGINE ---

    // Dynamic style injection for Swiss-style Modal (Includes Google button aesthetics)
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
                line-height: 1.45;
                color: var(--text-light, #5e5e6e);
                margin-bottom: 1.25rem;
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
            
            /* stark brand google auth button styles matching swiss layout */
            .sync-google-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                background-color: var(--bg-card, #ffffff);
                color: var(--text-main, #000000);
                border: 2px solid var(--border-color, #000000);
                padding: 0.75rem;
                font-family: 'Inter', sans-serif;
                font-size: 0.875rem;
                font-weight: 700;
                cursor: pointer;
                width: 100%;
                margin: 1rem 0;
            }
            .sync-google-btn:hover {
                background-color: var(--border-color, #000000);
                color: var(--bg-card, #ffffff);
            }
            .sync-google-btn:hover svg path {
                fill: var(--bg-card, #ffffff) !important;
            }
            .google-icon {
                width: 18px; height: 18px;
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
                text-align: center;
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
            container.addEventListener('click', (e) => {
                if (e.target === container) {
                    closeSyncModal();
                }
            });
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

        try {
            const isConnected = window.ApolloStorage.isSupabaseConnected();
            const user = isConnected ? await window.ApolloStorage.getLoggedInUser() : null;

            // Unified Backup & Reset HTML section
            const backupResetHtml = `
                <div style="margin-top: 1.5rem; border-top: 2px solid var(--border-color, #000000); padding-top: 1rem;">
                    <h4 style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin: 0 0 0.75rem 0; color: var(--text-light, #5e5e6e); letter-spacing: 0.05em;">Backup & Reset</h4>
                    <div style="display: flex; gap: 0.75rem;">
                        <button id="modalExportBtn" class="sync-btn-secondary" style="flex: 1; padding: 0.6rem 0.5rem; font-size: 0.75rem; font-weight: 700;">Export Backup</button>
                        <button id="modalResetBtn" class="sync-btn-secondary" style="flex: 1; padding: 0.6rem 0.5rem; font-size: 0.75rem; font-weight: 700; color: #ef4444; border-color: rgba(239, 68, 68, 0.25);">Reset All</button>
                    </div>
                </div>
            `;

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

                            ${backupResetHtml}
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
            }
            // SCENARIO 2: Connected but not Logged In (Google OAuth Only)
            else if (!user) {
                const shortUrl = supabase.supabaseUrl.replace('https://', '');
                container.innerHTML = `
                    <div class="sync-modal-card">
                        <div class="sync-modal-header">
                            <h3>Supabase Cloud Sync</h3>
                            <button class="sync-modal-close" id="modalCloseBtn">&times;</button>
                        </div>
                        <div class="sync-modal-body">
                            <div class="sync-meta-panel" style="margin-top:-0.5rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-weight:700;">Database:</span>
                                    <span style="color:var(--text-light); text-overflow:ellipsis; overflow:hidden; max-width:230px;">${shortUrl}</span>
                                </div>
                                <button id="disconnectProjBtn" class="sync-btn-secondary" style="font-size:0.75rem; padding:0.25rem; margin-top:0.25rem;">Disconnect Project</button>
                            </div>

                            <p class="sync-info-text" style="text-align:center;">
                                Authenticate securely with your Google account to automatically back up and synchronize your logs, goals, and reminders across all your devices.
                            </p>

                            <button id="googleSignInBtn" class="sync-google-btn">
                                <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-3.3 3.28-8.19 3.28-13.69z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                <span>Continue with Google</span>
                            </button>
                            
                            <div id="authError" class="sync-error-msg" style="display:none;"></div>

                            ${backupResetHtml}
                        </div>
                    </div>
                `;

                // Listeners
                const errBox = document.getElementById('authError');
                document.getElementById('modalCloseBtn').onclick = closeSyncModal;
                
                document.getElementById('disconnectProjBtn').onclick = () => {
                    if (confirm("Disconnect and reset your Supabase project keys?")) {
                        localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
                        localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
                        initSupabase();
                        renderSyncModalContent();
                    }
                };

                document.getElementById('googleSignInBtn').onclick = async () => {
                    errBox.style.display = 'none';
                    try {
                        const { error } = await supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: window.location.origin + window.location.pathname
                            }
                        });
                        if (error) {
                            errBox.textContent = error.message;
                            errBox.style.display = 'block';
                        }
                    } catch (err) {
                        errBox.textContent = "Google Connection failed. Verify your Supabase Google Auth Provider is enabled.";
                        errBox.style.display = 'block';
                    }
                };
            }
            // SCENARIO 3: Logged In & Syncing Status Dashboard
            else {
                const localLastUpdated = localStorage.getItem(STORAGE_KEYS.LAST_UPDATED);
                let lastUpdatedText = 'Never';
                if (localLastUpdated) {
                    const dateObj = new Date(localLastUpdated);
                    if (!isNaN(dateObj.getTime())) {
                        lastUpdatedText = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    }
                }

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
                                <button id="forcePullBtn" class="sync-btn-secondary" style="width:100%; padding:0.75rem; font-weight:700;">
                                    Force Cloud Pull (Download)
                                </button>
                                <button id="forcePushBtn" class="sync-btn-secondary" style="width:100%; padding:0.75rem; font-weight:700;">
                                    Force Cloud Push (Upload)
                                </button>
                                <button id="logoutBtn" class="sync-btn-primary" style="width:100%; padding:0.75rem; background-color:#ef4444; border-color:#ef4444; font-weight:700;">
                                    Log Out
                                </button>
                            </div>

                            ${backupResetHtml}
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

            // Wire up modal Export & Reset buttons (available in all scenarios)
            const modalExport = document.getElementById('modalExportBtn');
            if (modalExport) {
                modalExport.onclick = () => {
                    const logs = window.ApolloStorage.getLogs();
                    const goals = window.ApolloStorage.getGoals();
                    const reminders = window.ApolloStorage.getReminders();

                    const fullData = { logs, goals, reminders, export_time: new Date().toISOString() };
                    const dataStr = JSON.stringify(fullData, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `apollo-dashboard-backup-${window.ApolloStorage.getLocalDateString()}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                };
            }

            const modalReset = document.getElementById('modalResetBtn');
            if (modalReset) {
                modalReset.onclick = () => {
                    if (confirm("Reset ALL data in Apollo? This will replace your logs, goals, and reminders with a fresh blank state.")) {
                        window.ApolloStorage.resetAll();
                        closeSyncModal();
                        window.location.reload();
                    }
                };
            }

        } catch (error) {
            console.error("Fatal error rendering sync modal:", error);
            // Fallback UI to prevent screen-lock on exception
            container.innerHTML = `
                <div class="sync-modal-card">
                    <div class="sync-modal-header">
                        <h3>Sync Rendering Error</h3>
                        <button class="sync-modal-close" id="modalCloseBtn">&times;</button>
                    </div>
                    <div class="sync-modal-body">
                        <p class="sync-info-text" style="color: #ef4444; font-weight: 600;">
                            A rendering error occurred inside the Settings modal. Please refresh the page or reset project data.
                        </p>
                        <button id="modalResetFallbackBtn" class="sync-btn-primary" style="background-color: #ef4444; border-color: #ef4444; font-weight: 700;">Reset Cache & Keys</button>
                    </div>
                </div>
            `;
            document.getElementById('modalCloseBtn').onclick = closeSyncModal;
            document.getElementById('modalResetFallbackBtn').onclick = () => {
                if (confirm("Perform a hard reset of local cache and Supabase project configurations?")) {
                    localStorage.clear();
                    window.location.reload();
                }
            };
        }
    }

    }

    // --- MANDATORY AUTH PROTECTION SHIELD (CLOUD-FIRST SOVEREIGN SECURITY) ---

    function injectShieldStyles() {
        if (document.getElementById('apolloShieldStyles')) return;
        const style = document.createElement('style');
        style.id = 'apolloShieldStyles';
        style.textContent = `
            .auth-shield {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: #0b0b0f;
                background-image: radial-gradient(circle at 10% 20%, rgba(249, 115, 22, 0.08) 0%, transparent 40%),
                                  radial-gradient(circle at 90% 80%, rgba(249, 115, 22, 0.04) 0%, transparent 50%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 200000;
                font-family: 'Inter', -apple-system, sans-serif;
                color: #ffffff;
                padding: 1.5rem;
            }
            .auth-shield-card {
                background-color: #121218;
                border: 2px solid #27273a;
                border-radius: 12px;
                width: 100%;
                max-width: 420px;
                padding: 2.5rem;
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .auth-shield-logo {
                width: 48px;
                height: 48px;
                fill: #f97316;
                margin-bottom: 1.5rem;
                animation: auth-logo-spin 20s linear infinite;
            }
            @keyframes auth-logo-spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .auth-shield-title {
                font-family: 'Plus Jakarta Sans', sans-serif;
                font-size: 1.75rem;
                font-weight: 800;
                margin-bottom: 0.5rem;
                letter-spacing: -0.03em;
                color: #ffffff;
            }
            .auth-shield-title span {
                color: #f97316;
            }
            .auth-shield-subtitle {
                font-size: 0.9rem;
                color: #8a8a9e;
                line-height: 1.5;
                margin-bottom: 2rem;
            }
            .auth-shield-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                background-color: #ffffff;
                color: #0b0b0f;
                border: none;
                border-radius: 8px;
                padding: 0.85rem 1.5rem;
                font-family: 'Inter', sans-serif;
                font-size: 0.95rem;
                font-weight: 700;
                cursor: pointer;
                width: 100%;
                transition: transform 0.2s, background-color 0.2s;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .auth-shield-btn:hover {
                background-color: #e5e5ea;
                transform: translateY(-1px);
            }
            .auth-shield-btn:active {
                transform: translateY(0);
            }
        `;
        document.head.appendChild(style);
    }

    function renderShieldLogin(shield) {
        shield.innerHTML = `
            <div class="auth-shield-card">
                <svg class="auth-shield-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z"/>
                </svg>
                <div class="auth-shield-title">Apollo<span>.</span></div>
                <p class="auth-shield-subtitle">
                    Welcome back. Apollo uses secure Google Cloud Authentication. Please log in to synchronize your daily logs, goals, and calendar.
                </p>
                
                <button id="shieldGoogleBtn" class="auth-shield-btn">
                    <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-3.3 3.28-8.19 3.28-13.69z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>Continue with Google</span>
                </button>
                <div id="shieldError" class="sync-error-msg" style="display:none; margin-top: 1rem;"></div>
            </div>
        `;

        document.getElementById('shieldGoogleBtn').onclick = async () => {
            const errBox = document.getElementById('shieldError');
            errBox.style.display = 'none';
            try {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + window.location.pathname
                    }
                });
                if (error) {
                    errBox.textContent = error.message;
                    errBox.style.display = 'block';
                }
            } catch (err) {
                errBox.textContent = "Google Connection failed. Verify your Supabase Google Auth Provider is enabled.";
                errBox.style.display = 'block';
            }
        };
    }

    function renderShieldSetup(shield) {
        shield.innerHTML = `
            <div class="auth-shield-card" style="max-width:480px;">
                <svg class="auth-shield-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z"/>
                </svg>
                <div class="auth-shield-title">Apollo Setup</div>
                <p class="auth-shield-subtitle" style="margin-bottom:1.5rem;">
                    Apollo requires a Supabase cloud database. Enter your project URL and public Anon key below.
                </p>
                
                <form id="shieldConfigForm" style="width:100%; text-align:left;">
                    <div class="sync-form-group">
                        <label style="color:#a1a1b5; font-size:0.75rem; font-weight:700;">Supabase Project URL</label>
                        <input type="url" id="shieldSupUrl" class="sync-input" placeholder="https://your-project.supabase.co" required style="border-radius:6px; background-color:#1c1c24; border-color:#2a2a38; color:#fff;">
                    </div>
                    <div class="sync-form-group" style="margin-bottom:1.5rem;">
                        <label style="color:#a1a1b5; font-size:0.75rem; font-weight:700;">Public Anon Key</label>
                        <input type="text" id="shieldSupKey" class="sync-input" placeholder="eyJhbGciOiJIUzI1Ni..." required style="border-radius:6px; background-color:#1c1c24; border-color:#2a2a38; color:#fff;">
                    </div>
                    <div id="shieldSetupError" class="sync-error-msg" style="display:none; margin-bottom:1rem;"></div>
                    <button type="submit" class="auth-shield-btn" style="background-color:#f97316; color:#fff;">Connect Supabase</button>
                </form>
            </div>
        `;

        document.getElementById('shieldConfigForm').onsubmit = (e) => {
            e.preventDefault();
            const url = document.getElementById('shieldSupUrl').value.trim();
            const key = document.getElementById('shieldSupKey').value.trim();
            const errBox = document.getElementById('shieldSetupError');

            if (url && key) {
                localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
                localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
                initSupabase();

                if (supabase) {
                    enforceMandatoryAuth();
                } else {
                    errBox.textContent = "Could not initialize client. Check your URL formatting.";
                    errBox.style.display = 'block';
                }
            }
        };
    }

    async function enforceMandatoryAuth() {
        let shield = document.getElementById('authShield');
        if (!shield) {
            shield = document.createElement('div');
            shield.id = 'authShield';
            shield.className = 'auth-shield';
            
            injectShieldStyles();
            
            shield.innerHTML = `
                <div class="auth-shield-card">
                    <svg class="auth-shield-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z"/>
                    </svg>
                    <div class="auth-shield-title">Apollo<span>.</span></div>
                    <div class="auth-shield-subtitle" style="margin-bottom:0;">Verifying security session...</div>
                    <div style="margin-top: 1.5rem;" class="sync-status-dot active"></div>
                </div>
            `;
            document.body.appendChild(shield);
        }

        if (!supabase) {
            initSupabase();
        }

        if (!supabase) {
            renderShieldSetup(shield);
            return;
        }

        try {
            const user = await window.ApolloStorage.getLoggedInUser();
            if (user) {
                // Pull cloud data first (Sovereign master source)
                await window.ApolloStorage.pullFromCloud();
                
                // Fade out and dismiss shield
                shield.style.opacity = '0';
                shield.style.transition = 'opacity 0.4s ease';
                setTimeout(() => {
                    shield.remove();
                }, 400);
            } else {
                renderShieldLogin(shield);
            }
        } catch (e) {
            console.error("Enforce auth failed:", e);
            renderShieldLogin(shield);
        }
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

        const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
        if (mobileSettingsBtn) {
            mobileSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openSyncModal();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            bootstrapSyncUI();
            enforceMandatoryAuth();
        });
    } else {
        bootstrapSyncUI();
        enforceMandatoryAuth();
    }
})();
