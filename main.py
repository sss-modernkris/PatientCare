from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import csv
import os
import json
from datetime import datetime

app = FastAPI(title="Daily Patient Care Log API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
DIR_PATH = os.path.dirname(os.path.abspath(__file__))
CSV_FILE_PATH = os.path.join(DIR_PATH, "daily_medical_logs.csv")
SCHEDULE_JSON_PATH = os.path.join(DIR_PATH, "schedule.json")

# Baseline Schedule Dataset
SCHEDULE_DATA = [
    # Medications
    {"category": "Medication (TAB)", "activity": "PAN -40-MG", "time": "07:00 AM"},
    {"category": "Medication (TAB)", "activity": "THYRONORM - 100MCG", "time": "07:00 AM"},
    {"category": "Medication (TAB)", "activity": "CLOMONT-AD", "time": "08:00 AM"},
    {"category": "Medication (TAB)", "activity": "CLOMONT-AD", "time": "08:00 PM"},
    {"category": "Medication (TAB)", "activity": "MYNU-CT", "time": "10:00 AM"},
    {"category": "Medication (TAB)", "activity": "IVABRADINE-5", "time": "10:00 AM"},
    {"category": "Medication (TAB)", "activity": "DYPORYLUS", "time": "10:00 AM"},
    {"category": "Medication (TAB)", "activity": "Atoz - CU", "time": "02:00 PM"},
    {"category": "Medication (TAB)", "activity": "DYTOR-5", "time": "04:00 PM"},
    {"category": "Medication (TAB)", "activity": "PREGABAN-5", "time": "02:00 PM"},
    {"category": "Medication (TAB)", "activity": "CLOLIFE", "time": "02:00 PM"},
    {"category": "Medication (TAB)", "activity": "ATORFIT-AD", "time": "08:00 PM"},
    {"category": "Medication (TAB)", "activity": "Doxyclock", "time": "08:00 AM"},
    {"category": "Medication (TAB)", "activity": "Doxyclock", "time": "08:00 PM"},
    {"category": "Medication (TAB)", "activity": "Acetnama Syrup", "time": "08:00 AM"},
    {"category": "Medication (TAB)", "activity": "Acetnama Syrup", "time": "08:00 PM"},

    # Diet & Meals
    {"category": "Diet & Meals", "activity": "Tea & Biscuits", "time": "08:00 AM"},
    {"category": "Diet & Meals", "activity": "Breakfast", "time": "09:30 AM"},
    {"category": "Diet & Meals", "activity": "Lunch + Sweet", "time": "01:30 PM"},
    {"category": "Diet & Meals", "activity": "Tea & Biscuits", "time": "05:30 PM"},
    {"category": "Diet & Meals", "activity": "Dinner", "time": "08:30 PM"},

    # Services & Vitals
    {"category": "Services & Daily Care Vitals", "activity": "Bath / Teeth Brushing / Hair Combing", "time": "09:00 AM"},
    {"category": "Services & Daily Care Vitals", "activity": "Clothes Change", "time": "10:00 AM"},
    {"category": "Services & Daily Care Vitals", "activity": "Exercises", "time": "09:00 AM"},
    {"category": "Services & Daily Care Vitals", "activity": "Exercises", "time": "08:00 PM"},
    {"category": "Services & Daily Care Vitals", "activity": "Spirometry", "time": "09:00 PM"},
    {"category": "Services & Daily Care Vitals", "activity": "Chest Physio", "time": "10:00 PM"},
    {"category": "Services & Daily Care Vitals", "activity": "Massage / Nebulizer", "time": "Flexible"},
    {"category": "Services & Daily Care Vitals", "activity": "Vitals Check: BP, Pulse, SpO2, Temp, Heart/Lung Sounds", "time": "08:00 AM"},
    {"category": "Services & Daily Care Vitals", "activity": "Vitals Check: BP, Pulse, SpO2, Temp, Heart/Lung Sounds", "time": "05:00 PM"},
]

current_schedule = []

def normalize_time(time_str: str) -> str:
    time_str = time_str.strip()
    if not time_str:
        return ""
    if "flexible" in time_str.lower():
        return "Flexible"
    for fmt in ("%I:%M:%S %p", "%I:%M %p", "%H:%M:%S", "%H:%M", "%I:%M%p"):
        try:
            dt = datetime.strptime(time_str, fmt)
            return dt.strftime("%I:%M %p")
        except ValueError:
            continue
    return time_str

def load_local_schedule():
    global current_schedule
    if os.path.exists(SCHEDULE_JSON_PATH):
        try:
            with open(SCHEDULE_JSON_PATH, "r", encoding="utf-8") as f:
                current_schedule = json.load(f)
                print(f"Loaded {len(current_schedule)} items from schedule.json")
                return
        except Exception as e:
            print(f"Error loading schedule.json: {e}")
    # Fallback
    current_schedule = list(SCHEDULE_DATA)

# Pydantic models for request bodies
class CareLogRequest(BaseModel):
    date: str
    scheduled_time: str
    actual_logged_time: str
    category: str
    activity_name: str
    logged_data_value: str
    notes_or_status: str
    caregiver_initials: str

def init_csv():
    # Write header if CSV does not exist
    if not os.path.exists(CSV_FILE_PATH):
        with open(CSV_FILE_PATH, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Date", "Scheduled_Time", "Actual_Logged_Time", "Category", 
                "Activity_Name", "Logged_Data_Value", "Notes_or_Status", "Caregiver_Initials"
            ])

@app.on_event("startup")
def startup_event():
    init_csv()
    load_local_schedule()

@app.get("/")
def get_index():
    return FileResponse(os.path.join(DIR_PATH, "index.html"))

@app.get("/style.css")
def get_style():
    return FileResponse(os.path.join(DIR_PATH, "style.css"))

@app.get("/app.js")
def get_app():
    return FileResponse(os.path.join(DIR_PATH, "app.js"))

@app.get("/api/schedule")
def get_schedule():
    return {"schedule": current_schedule}

@app.post("/api/update-schedule-from-files")
def update_schedule_from_files():
    try:
        new_schedule = []
        
        # 1. Parse Medication-List.csv
        med_path = os.path.join(DIR_PATH, "Medication-List.csv")
        if os.path.exists(med_path):
            with open(med_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for row in reader:
                    if len(row) >= 2 and row[0].strip() and row[1].strip():
                        new_schedule.append({
                            "category": "Medication (TAB)",
                            "activity": row[0].strip(),
                            "time": normalize_time(row[1])
                        })
                        
        # 2. Parse Diet_Meak_List.csv
        diet_path = os.path.join(DIR_PATH, "Diet_Meak_List.csv")
        if os.path.exists(diet_path):
            with open(diet_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for row in reader:
                    if len(row) >= 2 and row[0].strip() and row[1].strip():
                        new_schedule.append({
                            "category": "Diet & Meals",
                            "activity": row[0].strip(),
                            "time": normalize_time(row[1])
                        })
                        
        # 3. Parse Services_DailyCare_Vitals_List.csv
        services_path = os.path.join(DIR_PATH, "Services_DailyCare_Vitals_List.csv")
        if os.path.exists(services_path):
            with open(services_path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                for row in reader:
                    if len(row) >= 2 and row[0].strip() and row[1].strip():
                        new_schedule.append({
                            "category": "Services & Daily Care Vitals",
                            "activity": row[0].strip(),
                            "time": normalize_time(row[1])
                        })
        
        if not new_schedule:
            raise HTTPException(status_code=400, detail="No schedule items could be parsed from the files.")
            
        global current_schedule
        current_schedule = new_schedule
        
        # Persist to schedule.json
        with open(SCHEDULE_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(current_schedule, f, indent=2)
            
        return {"status": "success", "message": f"Successfully updated schedule with {len(current_schedule)} items from files."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/log")
def add_log(entry: CareLogRequest):
    try:
        init_csv()
        with open(CSV_FILE_PATH, mode='a', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                entry.date,
                entry.scheduled_time,
                entry.actual_logged_time,
                entry.category,
                entry.activity_name,
                entry.logged_data_value,
                entry.notes_or_status,
                entry.caregiver_initials
            ])
        return {"status": "success", "message": "Log entry successfully appended to CSV."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
def get_history():
    try:
        init_csv()
        logs = []
        with open(CSV_FILE_PATH, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
        return {"logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patient-name")
def get_patient_name():
    try:
        path = os.path.join(DIR_PATH, "Name of the patient.csv")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if header and len(header) > 0:
                    col_name = header[0].strip()
                    # If column name is generic like 'Name', use the value below it
                    if col_name.lower() in ("name", "patient name", "patient_name"):
                        row = next(reader, None)
                        if row and len(row) > 0 and row[0].strip():
                            return {"name": row[0].strip()}
                    return {"name": col_name}
        return {"name": "Sakkubhai"}
    except Exception as e:
        return {"name": "Sakkubhai"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)

