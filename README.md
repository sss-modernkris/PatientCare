# Patient Care Log & Tracker

A modern, responsive web application for private duty nursing, patient vitals monitoring, medication logging, and daily diet/activity tracking. This system is designed for caregivers to easily track care tasks, input clinical vitals, visualize patient progress trends, and configure daily care plans.

---

## 📋 Table of Contents
1. [Functional Details](#-functional-details)
2. [Technical Architecture](#-technical-architecture)
3. [Operational Details & Setup](#%EF%B8%8F-operational-details--setup)
4. [File & Configuration Structure](#-file--configuration-structure)
5. [Automated Verification & Testing](#-automated-verification--testing)
6. [Project Layout](#-project-layout)

---

## 🌟 Functional Details

The application features a single-page dashboard with four functional tabs, allowing caregivers to manage daily patient routines efficiently.

### 1. Today's Care Plan
* **Dynamic Dashboard Panels**: Automatically displays scheduled tasks grouped into three core categories:
  * **Medications (Tablets & Syrups)**: Tracks dosage schedules (e.g., PAN -40-MG at 7:00 AM, Doxyclock at 8:00 AM/PM).
  * **Diet, Meals & Nutrition**: Logs daily meal intake (e.g., Breakfast, Lunch, Tea, Dinner).
  * **Daily Care Services & Vitals**: Tracks physical care (Bath, Clothes Change, Exercises, Spirometry, Nebulizer) and Vitals Check frequencies.
* **Interactive Logging Modals**:
  * **Standard Activity Modal**: Allows marking standard medications and daily exercises as completed, including caregiver initials and custom notes.
  * **Clinical Vitals Modal**: Specific form to record Blood Pressure (mmHg), Pulse Rate (bpm), SpO2 (%), Temperature (°F), Heart/Lung sounds (Clear, Wheezing, Crackles, Diminished), and nursing remarks.
  * **Meal & Nutrition Intake Modal**: Quick-select intake rating (🟢 Good, 🟡 OK, 🔴 Bad) alongside description notes.
  * **Special Notes Action**: A dedicated action button to input general clinical remarks, doctor's advice, or custom nursing logs not bound to a scheduled event.
* **Real-time Progress Tracker**: An interactive progress bar at the header computes and displays the percentage of scheduled tasks completed today.

### 2. Caregiver History Logs
* **CSV Logging**: Every logged event is persistently appended to a CSV file (`daily_medical_logs.csv`).
* **Advanced Column-by-Column Filtering**: Excel-like dropdown filters on the history table. Caregivers can filter logs by **Date**, **Scheduled Time**, **Logged Time**, **Category**, **Activity**, **Logged Value**, **Notes**, and **Nurse Initials** via an in-page search & checkbox filter.

### 3. Vitals Analytics
* **Trend Visualization**: Integrated with **Chart.js** to generate interactive graphs for patient health trends:
  * Blood Pressure (Systolic and Diastolic tracked independently)
  * Heart Rate / Pulse (bpm)
  * Oxygen Saturation (SpO2 %)
  * Body Temperature (°F)
* **Date Range Controls**: Allows filtering graphs to specific date ranges to observe changes over time.
* **Toggleable Charts**: Individual checkboxes to show/hide specific vital graphs.

### 4. Setup Configuration Editor
* **In-App Config Manager**: An integrated text editor permitting caregivers to edit setup tables directly inside the web browser.
* **Modifiable Setup Files**:
  * `Name of the patient.csv` (Customizes the patient name shown in the app header).
  * `Medication-List.csv` (Add/edit active tablets, syrups, and times).
  * `Diet_Meak_List.csv` (Configure meal descriptions and schedules).
  * `Services_DailyCare_Vitals_List.csv` (Configure exercises, clinical checks, and therapy schedules).
* **Live Update & Sync**: A single button to save the files, parse contents, validate formatting, and immediately rebuild the active daily schedule (`schedule.json`).

---

## 🏗️ Technical Architecture

* **Frontend**: HTML5 (semantic layout), Vanilla CSS (premium dark/soothing styling with glassmorphism effects, flexbox/grid layouts), and Vanilla JavaScript. Real-time graphs are powered by Chart.js.
* **Backend**: FastAPI (Python) serving static pages and acting as a REST API.
* **Data Layer**: Direct CSV-based data storage and configuration management:
  * No heavy external databases are required; all configurations and history are stored locally in human-readable `.csv` and `.json` formats.
  * Auto-generates template database files if missing.

---

## 🛠️ Operational Details & Setup

### Prerequisites
* Python 3.8+ installed.
* Dependencies: `fastapi`, `uvicorn`, `pydantic`, `watchfiles` (for backend auto-reload).

### 1. Installation
Install the required packages using `pip`:
```bash
pip install fastapi uvicorn pydantic watchfiles
```

### 2. Starting the Application
From the workspace root, run:
```bash
python main.py
```
This launches a FastAPI server using Uvicorn. By default, it binds to:
* **URL**: [http://localhost:8000](http://localhost:8000)

### 3. Environment Variables
You can customize application settings using environment variables:
* `PORT`: Port number for the web server (defaults to `8000`).
* `CSV_FILE_NAME`: Custom destination file name for historical medical logs (defaults to `daily_medical_logs.csv`).

Example:
```bash
$env:PORT="8080"
$env:CSV_FILE_NAME="july_patient_logs.csv"
python main.py
```

---

## 📂 File & Configuration Structure

All configuration is handled through CSV files in the application directory:

1. **`Name of the patient.csv`**
   * Structure: First row is header, second row is name.
   * Example:
     ```csv
     Patient Name
     Sakkubhai
     ```

2. **`Medication-List.csv`**
   * Structure: `Medication Name, Scheduled Time`
   * Example:
     ```csv
     PAN -40-MG,07:00 AM
     THYRONORM - 100MCG,07:00 AM
     ```

3. **`Diet_Meak_List.csv`**
   * Structure: `Meal Name, Scheduled Time`
   * Example:
     ```csv
     Tea & Biscuits,08:00 AM
     Breakfast,09:30 AM
     ```

4. **`Services_DailyCare_Vitals_List.csv`**
   * Structure: `Service/Vital Name, Scheduled Time`
   * Example:
     ```csv
     Exercises,09:00 AM
     Vitals Check: BP / Pulse / SpO2 / Temp / Sounds,08:00 AM
     ```

---

## 🧪 Automated Verification & Testing

The repository contains an automated E2E testing script using **Playwright**:

* File: [verify_care_tracker.py](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/verify_care_tracker.py)
* **What it does**:
  1. Spawns `main.py` on test port `8180` writing to a temporary test file (`test_daily_medical_logs.csv`).
  2. Launches a headless Chromium instance.
  3. Clicks "Sync Schedule".
  4. Fills caregiver initials and logs a sample medication ("PAN -40-MG"), a daily service ("PM Spirometry"), and clinical vitals.
  5. Switches to the History Logs tab and verifies entries.
  6. Captures a browser screenshot of the Vitals Plot page and saves it to [images/patient_care_tracker_completed.png](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/images/patient_care_tracker_completed.png).
  7. Tears down the test server and cleans up test databases.

Run the tests using:
```bash
python verify_care_tracker.py
```

---

## 🗂️ Project Layout

* [main.py](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/main.py) - FastAPI App & API endpoints
* [index.html](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/index.html) - Application frontend UI layout
* [app.js](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/app.js) - Application logic, modal handling, Chart.js integrations, filters
* [style.css](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/style.css) - Responsive styling & aesthetics stylesheet
* [verify_care_tracker.py](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/verify_care_tracker.py) - Playwright E2E verification test
* [daily_medical_logs.csv](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/daily_medical_logs.csv) - Persistent log history (caregiver records)
* [schedule.json](file:///C:/Users/moder/AntiGravity/20260630-DailyRecordings/schedule.json) - Saved compiled active daily schedule
* `images/` - Verification screenshots & media assets
