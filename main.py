from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import csv
import os
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
    return {"schedule": SCHEDULE_DATA}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)
