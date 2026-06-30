// Client-side Application Logic for Care Tracker

const API_BASE_URL = "http://localhost:8000";

// App state
let activeCaregiver = "";
let scheduleItems = [];
let completedTasks = new Set(); // Stores composite key: "ActivityName_ScheduledTime"
let historyLogs = [];

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

    // 3. Fetch Schedule & History
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
}

// Tab navigation handler
function setupTabs() {
    const tabToday = document.getElementById("tab-today");
    const tabHistory = document.getElementById("tab-history");
    const panelToday = document.getElementById("panel-today");
    const panelHistory = document.getElementById("panel-history");

    tabToday.addEventListener("click", () => {
        tabToday.classList.add("active");
        tabHistory.classList.remove("active");
        panelToday.classList.add("active");
        panelHistory.classList.remove("active");
    });

    tabHistory.addEventListener("click", () => {
        tabHistory.classList.add("active");
        tabToday.classList.remove("active");
        panelHistory.classList.add("active");
        panelToday.classList.remove("active");
        fetchHistory(); // Refresh history list when tab selected
    });
}

// Clock updates
function updateClock() {
    const now = new Date();
    currentTimeDisplay.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Fetch default schedule from backend API
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
    
    // Sort logs descending to show recent logs first
    const sortedLogs = [...historyLogs].reverse();
    
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
            activity_name: "Vitals Check: BP, Pulse, SpO2, Temp, Heart/Lung Sounds",
            logged_data_value: vitalsString,
            notes_or_status: notes || "Vitals documented successfully",
            caregiver_initials: initials
        };
        
        await submitLogEntry(payload, "modal-vitals");
    };
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
