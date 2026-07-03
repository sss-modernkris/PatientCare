// Client-side Application Logic for Care Tracker

const API_BASE_URL = "http://localhost:8000";

// App state
let activeCaregiver = "";
let scheduleItems = [];
let completedTasks = new Set(); // Stores composite key: "ActivityName_ScheduledTime"
let historyLogs = [];
let activeFilters = {};
let currentFilterColumn = "";
let vitalsCharts = { bp: null, hr: null, spo2: null, temp: null };

// DOM Elements
const globalCaregiverInput = document.getElementById("global-caregiver");
const progressPercentage = document.getElementById("progress-percentage");
const progressFill = document.getElementById("progress-fill");
const taskCompletedCount = document.getElementById("task-completed-count");
const currentTimeDisplay = document.getElementById("current-time-display");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    // 1. Setup Tab Navigation
    setupTabs();
    
    // 2. Active Nurse initials persistence
    const savedCaregiver = localStorage.getItem("caregiver_initials") || "";
    globalCaregiverInput.value = savedCaregiver;
    activeCaregiver = savedCaregiver;
    
    globalCaregiverInput.addEventListener("input", (e) => {
        activeCaregiver = e.target.value.trim();
        localStorage.setItem("caregiver_initials", activeCaregiver);
    });

    // 3. Fetch Patient Name, Schedule & History
    await fetchPatientName();
    await fetchSchedule();
    await fetchHistory();
    
    // 4. Alarm system and Clock Setup
    updateClock();
    setInterval(updateClock, 1000); // Update time display every second
    setInterval(checkAlarms, 10000); // Check alarms every 10 seconds
    
    // 5. Setup Form Submit Buttons
    setupFormSubmissions();
    
    // 6. Setup satisfaction buttons
    setupSatisfactionPicker();

    // 7. Setup Sync Schedule button
    setupSyncScheduleButton();

    // 8. Setup Special Notes button
    setupSpecialNotesButton();

    // 9. Setup column filters
    setupFilters();

    // 10. Setup Vitals Analytics controls
    setupAnalyticsControls();

    // 11. Setup Config Files editing tab
    setupConfigTab();
}

// Bind sync schedule button handler
function setupSyncScheduleButton() {
    const btnSync = document.getElementById("btn-sync-schedule");
    if (!btnSync) return;
    
    btnSync.addEventListener("click", async () => {
        btnSync.disabled = true;
        const originalHTML = btnSync.innerHTML;
        btnSync.innerHTML = `<span class="sync-icon animate-spin">🔄</span> Syncing...`;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/update-schedule-from-files`, {
                method: "POST"
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Failed to sync schedule.");
            }
            
            const data = await res.json();
            alert(data.message);
            
            // Reload schedule and history, then re-render dashboard
            await fetchSchedule();
            await fetchHistory();
        } catch (e) {
            console.error(e);
            alert(`Error syncing schedule: ${e.message}`);
        } finally {
            btnSync.disabled = false;
            btnSync.innerHTML = originalHTML;
        }
    });
}

// Tab navigation handler
function setupTabs() {
    const tabToday = document.getElementById("tab-today");
    const tabHistory = document.getElementById("tab-history");
    const tabAnalytics = document.getElementById("tab-analytics");
    const tabConfig = document.getElementById("tab-config");
    const panelToday = document.getElementById("panel-today");
    const panelHistory = document.getElementById("panel-history");
    const panelAnalytics = document.getElementById("panel-analytics");
    const panelConfig = document.getElementById("panel-config");
    const btnGoToPlot = document.getElementById("btn-go-to-plot");

    function deactivateAll() {
        tabToday.classList.remove("active");
        tabHistory.classList.remove("active");
        tabAnalytics.classList.remove("active");
        if (tabConfig) tabConfig.classList.remove("active");
        panelToday.classList.remove("active");
        panelHistory.classList.remove("active");
        panelAnalytics.classList.remove("active");
        if (panelConfig) panelConfig.classList.remove("active");
    }

    tabToday.addEventListener("click", () => {
        deactivateAll();
        tabToday.classList.add("active");
        panelToday.classList.add("active");
    });

    tabHistory.addEventListener("click", () => {
        deactivateAll();
        tabHistory.classList.add("active");
        panelHistory.classList.add("active");
        fetchHistory(); // Refresh history list when tab selected
    });

    tabAnalytics.addEventListener("click", () => {
        deactivateAll();
        tabAnalytics.classList.add("active");
        panelAnalytics.classList.add("active");
        renderVitalsCharts(); // Render/update charts
    });

    if (tabConfig) {
        tabConfig.addEventListener("click", () => {
            deactivateAll();
            tabConfig.classList.add("active");
            panelConfig.classList.add("active");
            loadActiveConfigFile();
        });
    }

    if (btnGoToPlot) {
        btnGoToPlot.addEventListener("click", () => {
            deactivateAll();
            tabAnalytics.classList.add("active");
            panelAnalytics.classList.add("active");
            renderVitalsCharts();
        });
    }
}

// Clock updates
function updateClock() {
    const now = new Date();
    currentTimeDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Fetch default schedule from backend API
async function fetchPatientName() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/patient-name`);
        if (res.ok) {
            const data = await res.json();
            if (data.name) {
                const titleElem = document.getElementById("patient-name-title");
                if (titleElem) {
                    titleElem.textContent = data.name;
                }
                document.title = `${data.name} - Patient Care Log & Tracker`;
            }
        }
    } catch (e) {
        console.error("Failed to fetch patient name:", e);
    }
}

async function fetchSchedule() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/schedule`);
        if (!res.ok) throw new Error("Could not load care schedule dataset.");
        const data = await res.json();
        scheduleItems = data.schedule || [];
    } catch (e) {
        console.error(e);
        alert("Server connection failed. Make sure the FastAPI app is running.");
    }
}

// Fetch historical log CSV rows and calculate daily progress
async function fetchHistory() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/history`);
        if (!res.ok) throw new Error("Could not fetch CSV logs.");
        const data = await res.json();
        historyLogs = data.logs || [];
        
        // Populate completion checklist set for today
        const todayStr = getTodayString();
        completedTasks.clear();
        
        historyLogs.forEach(log => {
            if (log.Date === todayStr) {
                // Done status
                completedTasks.add(`${log.Activity_Name}_${log.Scheduled_Time}`);
            }
        });
        
        // Rerender layout
        renderSchedule();
        renderHistoryTable();
        calculateProgress();
    } catch (e) {
        console.error(e);
    }
}

// Render schedule tasks grouped by categories
function renderSchedule() {
    const listMed = document.getElementById("list-medications");
    const listDiet = document.getElementById("list-diet");
    const listServ = document.getElementById("list-services");

    listMed.innerHTML = "";
    listDiet.innerHTML = "";
    listServ.innerHTML = "";

    scheduleItems.forEach((item, index) => {
        const key = `${item.activity}_${item.time}`;
        const isDone = completedTasks.has(key);
        const isOverdue = !isDone && isItemOverdue(item.time);
        
        let statusClass = "upcoming";
        let statusText = "Upcoming";
        
        if (isDone) {
            statusClass = "completed";
            statusText = "Completed";
        } else if (isOverdue) {
            statusClass = "overdue";
            statusText = "Overdue";
        }

        const card = document.createElement("div");
        card.className = `task-item ${statusClass}`;
        card.innerHTML = `
            <div class="task-left">
                <span class="task-title">${item.activity}</span>
                <span class="task-meta font-mono">${item.time}</span>
            </div>
            <span class="status-badge">${statusText}</span>
        `;

        // Interactive modal click binding (skip click if already completed)
        if (!isDone) {
            card.onclick = () => openTaskModal(item);
        }

        if (item.category.includes("Medication")) {
            listMed.appendChild(card);
        } else if (item.category.includes("Diet")) {
            listDiet.appendChild(card);
        } else {
            listServ.appendChild(card);
        }
    });
}

// Render patient log CSV grid
function renderHistoryTable() {
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";
    
    // Apply active column filters
    let filteredLogs = [...historyLogs];
    Object.keys(activeFilters).forEach(col => {
        const allowedSet = activeFilters[col];
        filteredLogs = filteredLogs.filter(row => allowedSet.has(row[col] || ""));
    });
    
    // Sort logs descending to show recent logs first
    const sortedLogs = filteredLogs.reverse();
    
    if (sortedLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center italic text-muted-secondary">No caregiver logs entered yet.</td></tr>`;
        return;
    }
    
    sortedLogs.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="font-mono">${row.Date}</td>
            <td class="font-mono text-muted-secondary">${row.Scheduled_Time}</td>
            <td class="font-mono">${row.Actual_Logged_Time}</td>
            <td><strong>${row.Category}</strong></td>
            <td>${row.Activity_Name}</td>
            <td><code class="vital-value">${row.Logged_Data_Value}</code></td>
            <td class="italic text-muted-secondary">${row.Notes_or_Status || "-"}</td>
            <td><span class="nurse-initials">${row.Caregiver_Initials}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Calculate progress percentage bar
function calculateProgress() {
    const total = scheduleItems.length;
    const completed = completedTasks.size;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    progressPercentage.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;
    taskCompletedCount.textContent = `${completed} of ${total} tasks completed today`;
}

// Date parser utilities
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Checks if scheduled time is overdue compared to local system clock
function isItemOverdue(scheduledTimeStr) {
    if (scheduledTimeStr === "Flexible") return false;
    
    const now = new Date();
    const scheduledDate = parseTimeStr(scheduledTimeStr);
    
    // An item is overdue if scheduled time has passed by more than 15 minutes today
    return (now - scheduledDate) > 15 * 60 * 1000;
}

// Parses string like "08:00 AM" or "08:30 PM" into active Date object
function parseTimeStr(timeStr) {
    const now = new Date();
    const match = timeStr.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return now;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    
    const schedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
    return schedDate;
}

// Smart Alarm system checking
let triggeredNotifications = new Set(); // Avoid double alerts in the same minute

function checkAlarms() {
    const now = new Date();
    const currentMinKey = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    scheduleItems.forEach(item => {
        if (item.time === "Flexible") return;
        
        const key = `${item.activity}_${item.time}`;
        if (completedTasks.has(key)) return; // Don't alert if completed
        
        // Match scheduled clock time e.g. "08:00 AM" to current time
        const schedTimeKey = parseTimeStr(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (schedTimeKey === currentMinKey && !triggeredNotifications.has(key)) {
            triggeredNotifications.add(key);
            triggerMedicalAlert(item);
        }
    });
}

// Trigger alert sound & browser notification
function triggerMedicalAlert(item) {
    // 1. Play calming electronic medical beeping alert using Web Audio API
    playSynthesizedBeep();
    
    // 2. Request notification or prompt caregiver
    if (Notification.permission === "granted") {
        const notif = new Notification("Patient Care Reminder", {
            body: `Scheduled task: ${item.activity} (${item.time})`,
            icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230891b2' stroke-width='2'%3E%3Cpath d='M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z'/%3E%3Cpath d='M13.73 21a2 2 0 0 1-3.46 0'/%3E%3C/svg%3E"
        });
        notif.onclick = () => {
            window.focus();
            openTaskModal(item);
        };
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    // Fallback modal notification prompt
    alert(`Reminder: Time for "${item.activity}" (${item.time})`);
    openTaskModal(item);
}

// Synthesizes a gentle dual-beeping sound (Standard care warning alert)
function playSynthesizedBeep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playBeep = (time, pitch) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = "sine";
            osc.frequency.setValueAtTime(pitch, time);
            
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(time);
            osc.stop(time + 0.35);
        };
        
        const now = ctx.currentTime;
        playBeep(now, 880);      // High beep A5
        playBeep(now + 0.4, 880);  // High beep A5
    } catch (e) {
        console.error("Audio beep failed: ", e);
    }
}

// Modal handling
function openTaskModal(item) {
    // Pre-populate active nurse initials
    const caregiverInit = activeCaregiver || "";
    
    // Choose correct form based on task categories
    if (item.activity.includes("Vitals Check")) {
        document.getElementById("vitals-scheduled-time").value = item.time;
        const actNameInput = document.getElementById("vitals-activity-name");
        if (actNameInput) {
            actNameInput.value = item.activity;
        }
        document.getElementById("vital-initials").value = caregiverInit;
        document.getElementById("vital-bp").value = "";
        document.getElementById("vital-pulse").value = "";
        document.getElementById("vital-spo2").value = "";
        document.getElementById("vital-temp").value = "";
        document.getElementById("vital-notes").value = "";
        openModal("modal-vitals");
    } else if (item.category.includes("Diet")) {
        document.getElementById("meal-activity-name").value = item.activity;
        document.getElementById("meal-scheduled-time").value = item.time;
        document.getElementById("meal-initials").value = caregiverInit;
        document.getElementById("meal-notes").value = "";
        
        // Reset satisfaction rating active selectors
        document.querySelectorAll(".sat-btn").forEach(btn => btn.classList.remove("active"));
        openModal("modal-meal");
    } else {
        document.getElementById("modal-category").value = item.category;
        document.getElementById("modal-activity-name").value = item.activity;
        document.getElementById("modal-scheduled-time").value = item.time;
        document.getElementById("modal-initials").value = caregiverInit;
        document.getElementById("modal-notes").value = "";
        openModal("modal-standard");
    }
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

// Meal Satisfaction selection
function setupSatisfactionPicker() {
    const buttons = document.querySelectorAll(".sat-btn");
    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });
}

// Setup Form API Postings
function setupFormSubmissions() {
    // 1. Submit Standard Task Form
    document.getElementById("btn-submit-standard").onclick = async () => {
        const category = document.getElementById("modal-category").value;
        const name = document.getElementById("modal-activity-name").value;
        const scheduledTime = document.getElementById("modal-scheduled-time").value;
        const notes = document.getElementById("modal-notes").value.trim();
        const initials = document.getElementById("modal-initials").value.trim();
        
        if (!initials) {
            alert("Nurse initials are strictly required to save completion log.");
            return;
        }
        
        const payload = {
            date: getTodayString(),
            scheduled_time: scheduledTime,
            actual_logged_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: category,
            activity_name: name,
            logged_data_value: "Done",
            notes_or_status: notes || "Completed on schedule",
            caregiver_initials: initials
        };
        
        await submitLogEntry(payload, "modal-standard");
    };

    // 2. Submit Meal Intake Form
    document.getElementById("btn-submit-meal").onclick = async () => {
        const name = document.getElementById("meal-activity-name").value;
        const scheduledTime = document.getElementById("meal-scheduled-time").value;
        const notes = document.getElementById("meal-notes").value.trim();
        const initials = document.getElementById("meal-initials").value.trim();
        
        const activeSatBtn = document.querySelector(".sat-btn.active");
        const satisfactionRating = activeSatBtn ? activeSatBtn.getAttribute("data-value") : "";
        
        if (!satisfactionRating) {
            alert("Please select a meal satisfaction rating (Good / OK / Bad).");
            return;
        }
        if (!initials) {
            alert("Nurse initials are strictly required to save completion log.");
            return;
        }
        
        const payload = {
            date: getTodayString(),
            scheduled_time: scheduledTime,
            actual_logged_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: "Diet & Meals",
            activity_name: name,
            logged_data_value: satisfactionRating,
            notes_or_status: notes || `Rating: ${satisfactionRating}`,
            caregiver_initials: initials
        };
        
        await submitLogEntry(payload, "modal-meal");
    };

    // 3. Submit Clinical Vitals Form (with Numerical Bounds Validation)
    document.getElementById("btn-submit-vitals").onclick = async () => {
        const scheduledTime = document.getElementById("vitals-scheduled-time").value;
        const actNameInput = document.getElementById("vitals-activity-name");
        const activityName = actNameInput ? actNameInput.value : "Vitals Check: BP, Pulse, SpO2, Temp, Heart/Lung Sounds";
        const bp = document.getElementById("vital-bp").value.trim();
        const pulse = document.getElementById("vital-pulse").value.trim();
        const spo2 = document.getElementById("vital-spo2").value.trim();
        const temp = document.getElementById("vital-temp").value.trim();
        const sounds = document.getElementById("vital-sounds").value;
        const notes = document.getElementById("vital-notes").value.trim();
        const initials = document.getElementById("vital-initials").value.trim();
        
        // Validations
        if (!initials) {
            alert("Nurse initials are strictly required.");
            return;
        }
        
        // BP validation (regex check like 120/80)
        const bpRegex = /^\d{2,3}\/\d{2,3}$/;
        if (bp && !bpRegex.test(bp)) {
            alert("Blood Pressure must be formatted as systolic/diastolic (e.g. 120/80).");
            return;
        }
        
        // Pulse rate bounds
        if (pulse) {
            const pVal = parseInt(pulse);
            if (pVal < 30 || pVal > 200) {
                alert("Pulse rate must be a valid number between 30 and 200 bpm.");
                return;
            }
        }
        
        // SpO2 bounds
        if (spo2) {
            const sVal = parseInt(spo2);
            if (sVal < 50 || sVal > 100) {
                alert("SpO2 oxygen percentage must be a valid number between 50% and 100%.");
                return;
            }
        }
        
        // Temperature bounds
        if (temp) {
            const tVal = parseFloat(temp);
            if (isNaN(tVal) || tVal < 90.0 || tVal > 110.0) {
                alert("Body temperature must be a valid number between 90.0°F and 110.0°F.");
                return;
            }
        }
        
        // Flatten vitals into a concise CSV logged data string
        const vitalsString = `BP: ${bp || "N/A"} | HR: ${pulse || "N/A"} | SpO2: ${spo2 || "N/A"}% | T: ${temp || "N/A"}°F | Sounds: ${sounds}`;
        
        const payload = {
            date: getTodayString(),
            scheduled_time: scheduledTime,
            actual_logged_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            category: "Services & Daily Care Vitals",
            activity_name: activityName,
            logged_data_value: vitalsString,
            notes_or_status: notes || "Vitals documented successfully",
            caregiver_initials: initials
        };
        
        await submitLogEntry(payload, "modal-vitals");
    };

    // 4. Submit Special Note Form
    const btnSubmitSpecial = document.getElementById("btn-submit-special-note");
    if (btnSubmitSpecial) {
        btnSubmitSpecial.onclick = async () => {
            const noteText = document.getElementById("special-note-text").value.trim();
            const initials = document.getElementById("special-note-initials").value.trim();
            
            if (!noteText) {
                alert("Please enter a special note.");
                return;
            }
            if (!initials) {
                alert("Nurse initials are strictly required.");
                return;
            }
            
            const payload = {
                date: getTodayString(),
                scheduled_time: "N/A",
                actual_logged_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                category: "Special Note",
                activity_name: "Special Note",
                logged_data_value: "Note",
                notes_or_status: noteText,
                caregiver_initials: initials
            };
            
            await submitLogEntry(payload, "modal-special-note");
        };
    }
}

// POST transaction call to server to append log to local CSV file
async function submitLogEntry(payload, modalId) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("Failed to save log entry.");
        
        // Sync active initials to top config input
        if (payload.caregiver_initials) {
            activeCaregiver = payload.caregiver_initials;
            globalCaregiverInput.value = activeCaregiver;
            localStorage.setItem("caregiver_initials", activeCaregiver);
        }
        
        // Close modal, refresh data
        closeModal(modalId);
        await fetchHistory();
    } catch (e) {
        console.error(e);
        alert(`Error saving log entry: ${e.message}`);
    }
}

// Special Notes Button setup
function setupSpecialNotesButton() {
    const btnSpecialNotes = document.getElementById("btn-add-special-notes");
    if (btnSpecialNotes) {
        btnSpecialNotes.addEventListener("click", () => {
            document.getElementById("special-note-text").value = "";
            document.getElementById("special-note-initials").value = activeCaregiver || "";
            openModal("modal-special-note");
        });
    }
}

// Column Filter Setup & Handlers
function setupFilters() {
    const headers = document.querySelectorAll("#history-table-headers th");
    headers.forEach(th => {
        const trigger = th.querySelector(".filter-trigger");
        if (trigger) {
            trigger.addEventListener("click", (e) => {
                e.stopPropagation(); // Avoid triggering document click
                openFilterPopover(th);
            });
        }
    });
    
    // Popover close handlers
    const closeBtn = document.querySelector(".filter-close-btn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeFilterPopover);
    }
    const cancelBtn = document.getElementById("btn-filter-cancel");
    if (cancelBtn) {
        cancelBtn.addEventListener("click", closeFilterPopover);
    }
    
    // Popover Clear & Apply
    const clearBtn = document.getElementById("btn-filter-clear");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearFilterForCurrentCol);
    }
    const applyBtn = document.getElementById("btn-filter-apply");
    if (applyBtn) {
        applyBtn.addEventListener("click", applyFilterForCurrentCol);
    }
    
    // Search handler
    const searchInput = document.getElementById("filter-search");
    if (searchInput) {
        searchInput.addEventListener("input", filterOptionsList);
    }
    
    // Close popover when clicking outside
    document.addEventListener("click", (e) => {
        const popover = document.getElementById("filter-popover");
        if (popover && popover.classList.contains("active")) {
            if (!popover.contains(e.target)) {
                closeFilterPopover();
            }
        }
    });
}

function openFilterPopover(th) {
    const col = th.getAttribute("data-col");
    currentFilterColumn = col;
    
    const colDisplayName = th.querySelector("span").textContent.trim();
    document.getElementById("filter-col-name").textContent = `Filter ${colDisplayName}`;
    document.getElementById("filter-search").value = "";
    
    // Get unique values for this column from historyLogs
    const uniqueValues = [...new Set(historyLogs.map(log => log[col] || ""))].sort();
    
    // Populate list
    const listContainer = document.getElementById("filter-options-list");
    listContainer.innerHTML = "";
    
    // Determine checked items
    const activeSet = activeFilters[col];
    
    uniqueValues.forEach((val, index) => {
        const isChecked = !activeSet || activeSet.has(val);
        
        const itemDiv = document.createElement("div");
        itemDiv.className = "filter-option-item";
        itemDiv.innerHTML = `
            <input type="checkbox" id="chk-opt-${index}" value="${val.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''}>
            <label class="filter-option-label" for="chk-opt-${index}">${val || "(Blank)"}</label>
        `;
        listContainer.appendChild(itemDiv);
    });
    
    // Position popover relative to th
    const popover = document.getElementById("filter-popover");
    popover.classList.add("active");
    
    const rect = th.getBoundingClientRect();
    popover.style.top = `${rect.bottom + window.scrollY}px`;
    
    // Adjust left to prevent clipping
    let left = rect.left + window.scrollX;
    if (left + 240 > window.innerWidth) {
        left = window.innerWidth - 250;
    }
    popover.style.left = `${left}px`;
}

function closeFilterPopover() {
    const popover = document.getElementById("filter-popover");
    if (popover) {
        popover.classList.remove("active");
    }
}

function filterOptionsList() {
    const search = document.getElementById("filter-search").value.toLowerCase();
    const items = document.querySelectorAll(".filter-option-item");
    items.forEach(item => {
        const label = item.querySelector(".filter-option-label").textContent.toLowerCase();
        if (label.includes(search)) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
        }
    });
}

function clearFilterForCurrentCol() {
    delete activeFilters[currentFilterColumn];
    updateFilterTriggerIcon(currentFilterColumn, false);
    closeFilterPopover();
    renderHistoryTable();
}

function applyFilterForCurrentCol() {
    const checkboxes = document.querySelectorAll("#filter-options-list input[type='checkbox']");
    const checkedValues = [];
    const allValues = [];
    
    checkboxes.forEach(cb => {
        allValues.push(cb.value);
        if (cb.checked) {
            checkedValues.push(cb.value);
        }
    });
    
    if (checkedValues.length === allValues.length) {
        delete activeFilters[currentFilterColumn];
        updateFilterTriggerIcon(currentFilterColumn, false);
    } else {
        activeFilters[currentFilterColumn] = new Set(checkedValues);
        updateFilterTriggerIcon(currentFilterColumn, true);
    }
    
    closeFilterPopover();
    renderHistoryTable();
}

function updateFilterTriggerIcon(col, isFiltered) {
    const th = document.querySelector(`#history-table-headers th[data-col='${col}']`);
    if (th) {
        const trigger = th.querySelector(".filter-trigger");
        if (trigger) {
            if (isFiltered) {
                trigger.classList.add("active");
                trigger.textContent = "▼ (Filtered)";
            } else {
                trigger.classList.remove("active");
                trigger.textContent = "▼";
            }
        }
    }
}

// Vitals Analytics Controllers
function setupAnalyticsControls() {
    const startDateInput = document.getElementById("plot-start-date");
    const endDateInput = document.getElementById("plot-end-date");
    
    // Default range: 7 days ago to today
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    
    if (startDateInput && endDateInput) {
        startDateInput.value = formatDate(start);
        endDateInput.value = formatDate(end);
        
        startDateInput.addEventListener("change", renderVitalsCharts);
        endDateInput.addEventListener("change", renderVitalsCharts);
    }
    
    const vBP = document.getElementById("plot-vital-bp");
    const vHR = document.getElementById("plot-vital-hr");
    const vSpO2 = document.getElementById("plot-vital-spo2");
    const vTemp = document.getElementById("plot-vital-temp");
    
    if (vBP) vBP.addEventListener("change", renderVitalsCharts);
    if (vHR) vHR.addEventListener("change", renderVitalsCharts);
    if (vSpO2) vSpO2.addEventListener("change", renderVitalsCharts);
    if (vTemp) vTemp.addEventListener("change", renderVitalsCharts);
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function convert12hTo24h(timeStr) {
    if (!timeStr || timeStr === "N/A" || timeStr === "Flexible") return "00:00";
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return timeStr;
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function parseVitalValue(str) {
    if (!str) return null;
    const bpMatch = str.match(/BP:\s*(\d{2,3})\/(\d{2,3})/);
    const hrMatch = str.match(/HR:\s*(\d{2,3})/);
    const spo2Match = str.match(/SpO2:\s*(\d{2,3})%/);
    const tempMatch = str.match(/T:\s*(\d{2,3}(?:\.\d+)?)°F/);
    
    if (!bpMatch && !hrMatch && !spo2Match && !tempMatch) return null;
    
    return {
        systolic: bpMatch ? parseInt(bpMatch[1]) : null,
        diastolic: bpMatch ? parseInt(bpMatch[2]) : null,
        hr: hrMatch ? parseInt(hrMatch[1]) : null,
        spo2: spo2Match ? parseInt(spo2Match[1]) : null,
        temp: tempMatch ? parseFloat(tempMatch[1]) : null
    };
}

function getFilteredSortedVitals() {
    const startDateVal = document.getElementById("plot-start-date")?.value;
    const endDateVal = document.getElementById("plot-end-date")?.value;
    
    const startLimit = startDateVal ? new Date(startDateVal) : null;
    const endLimit = endDateVal ? new Date(endDateVal) : null;
    if (startLimit) startLimit.setHours(0, 0, 0, 0);
    if (endLimit) endLimit.setHours(23, 59, 59, 999);

    const parsedEntries = [];
    
    historyLogs.forEach(row => {
        if (!row.Date) return;
        const rowDate = new Date(row.Date);
        rowDate.setHours(12, 0, 0, 0);
        
        if (startLimit && rowDate < startLimit) return;
        if (endLimit && rowDate > endLimit) return;
        
        const parsed = parseVitalValue(row.Logged_Data_Value);
        if (!parsed) return;
        
        const time24 = convert12hTo24h(row.Actual_Logged_Time || row.Scheduled_Time || "12:00 AM");
        const timestamp = new Date(`${row.Date} ${time24}`);
        
        parsedEntries.push({
            timestamp: timestamp,
            dateStr: row.Date,
            timeStr: row.Actual_Logged_Time || row.Scheduled_Time || "N/A",
            ...parsed
        });
    });
    
    parsedEntries.sort((a, b) => a.timestamp - b.timestamp);
    return parsedEntries;
}

function renderVitalsCharts() {
    const data = getFilteredSortedVitals();
    const labels = data.map(item => `${item.dateStr} ${item.timeStr}`);
    
    const showBP = document.getElementById("plot-vital-bp")?.checked ?? true;
    const showHR = document.getElementById("plot-vital-hr")?.checked ?? true;
    const showSpO2 = document.getElementById("plot-vital-spo2")?.checked ?? true;
    const showTemp = document.getElementById("plot-vital-temp")?.checked ?? true;
    
    const bpCard = document.getElementById("chart-card-bp");
    const hrCard = document.getElementById("chart-card-hr");
    const spo2Card = document.getElementById("chart-card-spo2");
    const tempCard = document.getElementById("chart-card-temp");
    
    if (bpCard) bpCard.style.display = showBP ? "flex" : "none";
    if (hrCard) hrCard.style.display = showHR ? "flex" : "none";
    if (spo2Card) spo2Card.style.display = showSpO2 ? "flex" : "none";
    if (tempCard) tempCard.style.display = showTemp ? "flex" : "none";
    
    if (vitalsCharts.bp) { vitalsCharts.bp.destroy(); vitalsCharts.bp = null; }
    if (vitalsCharts.hr) { vitalsCharts.hr.destroy(); vitalsCharts.hr = null; }
    if (vitalsCharts.spo2) { vitalsCharts.spo2.destroy(); vitalsCharts.spo2 = null; }
    if (vitalsCharts.temp) { vitalsCharts.temp.destroy(); vitalsCharts.temp = null; }
    
    if (data.length === 0) return;
    
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { font: { family: 'Outfit', size: 11, weight: '600' } }
            },
            tooltip: {
                backgroundColor: 'rgba(31, 46, 39, 0.95)',
                titleFont: { family: 'Outfit', weight: 'bold' },
                bodyFont: { family: 'Inter' }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { family: 'Inter', size: 9 },
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                grid: { color: '#E4ECE8' },
                ticks: { font: { family: 'Inter', size: 9 } }
            }
        }
    };

    if (showBP) {
        const canvas = document.getElementById("chart-bp");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            const systolics = data.map(item => item.systolic);
            const diastolics = data.map(item => item.diastolic);
            
            vitalsCharts.bp = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Systolic (mmHg)',
                            data: systolics,
                            borderColor: '#EF4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            borderWidth: 2.5,
                            tension: 0.3,
                            fill: false,
                            spanGaps: true
                        },
                        {
                            label: 'Diastolic (mmHg)',
                            data: diastolics,
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.05)',
                            borderWidth: 2.5,
                            tension: 0.3,
                            fill: false,
                            spanGaps: true
                        }
                    ]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 50,
                            max: 180,
                            title: { display: true, text: 'mmHg', font: { family: 'Outfit', size: 10, weight: '700' } }
                        }
                    }
                }
            });
        }
    }

    if (showHR) {
        const canvas = document.getElementById("chart-hr");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            const hrs = data.map(item => item.hr);
            
            vitalsCharts.hr = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Heart Rate (bpm)',
                        data: hrs,
                        borderColor: '#EC4899',
                        backgroundColor: 'rgba(236, 72, 153, 0.05)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        spanGaps: true
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 40,
                            max: 150,
                            title: { display: true, text: 'bpm', font: { family: 'Outfit', size: 10, weight: '700' } }
                        }
                    }
                }
            });
        }
    }

    if (showSpO2) {
        const canvas = document.getElementById("chart-spo2");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            const spo2s = data.map(item => item.spo2);
            
            vitalsCharts.spo2 = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'SpO2 Oxygen (%)',
                        data: spo2s,
                        borderColor: '#06B6D4',
                        backgroundColor: 'rgba(6, 182, 212, 0.05)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        spanGaps: true
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 80,
                            max: 100,
                            title: { display: true, text: '%', font: { family: 'Outfit', size: 10, weight: '700' } }
                        }
                    }
                }
            });
        }
    }

    if (showTemp) {
        const canvas = document.getElementById("chart-temp");
        if (canvas) {
            const ctx = canvas.getContext("2d");
            const temps = data.map(item => item.temp);
            
            vitalsCharts.temp = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Temperature (°F)',
                        data: temps,
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderWidth: 2.5,
                        tension: 0.3,
                        fill: true,
                        spanGaps: true
                    }]
                },
                options: {
                    ...commonOptions,
                    scales: {
                        ...commonOptions.scales,
                        y: {
                            ...commonOptions.scales.y,
                            min: 95,
                            max: 105,
                            title: { display: true, text: '°F', font: { family: 'Outfit', size: 10, weight: '700' } }
                        }
                    }
                }
            });
        }
    }
}

// Config Files Editor Implementation
let activeConfigFile = "Name of the patient.csv";

function setupConfigTab() {
    // File selector buttons
    const fileBtns = document.querySelectorAll(".cfg-file-btn");
    fileBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            fileBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeConfigFile = btn.getAttribute("data-file");
            document.getElementById("active-file-label").textContent = activeConfigFile;
            loadActiveConfigFile();
        });
    });

    // Save button
    const btnSave = document.getElementById("btn-save-config");
    if (btnSave) {
        btnSave.addEventListener("click", saveActiveConfigFile);
    }

    // Sync shortcut button
    const btnSyncShortcut = document.getElementById("btn-sync-schedule-shortcut");
    if (btnSyncShortcut) {
        btnSyncShortcut.addEventListener("click", async () => {
            btnSyncShortcut.disabled = true;
            const originalHTML = btnSyncShortcut.innerHTML;
            btnSyncShortcut.innerHTML = `🔄 Syncing...`;
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/update-schedule-from-files`, {
                    method: "POST"
                });
                if (!res.ok) {
                    const errData = await res.json();
                    throw new Error(errData.detail || "Failed to sync schedule.");
                }
                const data = await res.json();
                showConfigStatus(data.message, "success");
                
                // Reload schedule & history to update dashboard
                await fetchSchedule();
                await fetchHistory();
            } catch (e) {
                console.error(e);
                showConfigStatus(`Error syncing: ${e.message}`, "error");
            } finally {
                btnSyncShortcut.disabled = false;
                btnSyncShortcut.innerHTML = originalHTML;
            }
        });
    }
}

async function loadActiveConfigFile() {
    const editor = document.getElementById("csv-editor");
    editor.value = "Loading CSV content...";
    editor.disabled = true;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/config-file/${encodeURIComponent(activeConfigFile)}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        editor.value = data.content || "";
        editor.disabled = false;
    } catch (e) {
        console.error(e);
        editor.value = `Failed to load file: ${e.message}`;
        showConfigStatus(`Error loading ${activeConfigFile}: ${e.message}`, "error");
    }
}

async function saveActiveConfigFile() {
    const btnSave = document.getElementById("btn-save-config");
    const editor = document.getElementById("csv-editor");
    const originalText = btnSave.innerHTML;
    
    btnSave.disabled = true;
    btnSave.innerHTML = `💾 Saving...`;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/config-file/${encodeURIComponent(activeConfigFile)}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ content: editor.value })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Save failed");
        }
        
        showConfigStatus(`Successfully saved ${activeConfigFile}!`, "success");
        
        // Post-save actions based on what was edited:
        if (activeConfigFile === "Name of the patient.csv") {
            await fetchPatientName(); // Refresh UI patient name title
        }
    } catch (e) {
        console.error(e);
        showConfigStatus(`Error saving: ${e.message}`, "error");
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
    }
}

function showConfigStatus(msg, type) {
    const statusLabel = document.getElementById("config-status-msg");
    statusLabel.textContent = msg;
    statusLabel.className = `status-msg ${type}`;
    
    // Clear message after 4 seconds
    setTimeout(() => {
        if (statusLabel.textContent === msg) {
            statusLabel.textContent = "";
            statusLabel.className = "status-msg";
        }
    }, 4000);
}
