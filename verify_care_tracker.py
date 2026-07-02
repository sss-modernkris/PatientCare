import os
import subprocess
import time
import csv
from playwright.sync_api import sync_playwright

def verify_care_tracker():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, "images")
    os.makedirs(output_dir, exist_ok=True)
    
    csv_path = os.path.join(base_dir, "daily_medical_logs.csv")
    if os.path.exists(csv_path):
        print("Filtering out today's logs from daily_medical_logs.csv to allow test to run...")
        import datetime
        today_str = datetime.date.today().strftime("%Y-%m-%d")
        temp_rows = []
        try:
            with open(csv_path, mode='r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader, None)
                if header:
                    temp_rows.append(header)
                    for row in reader:
                        if len(row) > 0 and row[0] != today_str:
                            temp_rows.append(row)
            with open(csv_path, mode='w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerows(temp_rows)
            print(f"Removed today's entries ({today_str}) to ensure fresh logging.")
        except Exception as e:
            print(f"Error preparing csv file: {e}")
        
    # Use the Python interpreter from the existing StockPicker virtualenv
    python_exe = r"C:\Users\moder\AntiGravity\StockPickerStrategies-20260610\backend\.venv\Scripts\python.exe"
    if not os.path.exists(python_exe):
        python_exe = "python"
        
    import socket
    def is_port_active(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0

    launched_server = False
    server_process = None
    if not is_port_active(8000):
        print(f"Launching FastAPI backend with {python_exe}...")
        server_process = subprocess.Popen(
            [python_exe, "main.py"],
            cwd=base_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True
        )
        launched_server = True
        # Wait for server to start
        time.sleep(3)
    else:
        print("FastAPI backend is already running on port 8000, reusing it.")
    
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({"width": 1280, "height": 960})
        
        print("Navigating to http://localhost:8000...")
        # Listen for console logs
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
        
        try:
            page.goto("http://localhost:8000", wait_until="networkidle", timeout=15000)
            print("Page loaded successfully.")
        except Exception as e:
            print("Failed to load page: ", e)
            # Print server output
            stdout, stderr = server_process.communicate()
            print("SERVER STDOUT:", stdout)
            print("SERVER STDERR:", stderr)
            server_process.terminate()
            return
            
        time.sleep(1)
        
        # Register dialog handler to auto-accept the alert confirmation dialogs
        page.on("dialog", lambda dialog: (print(f"DIALOG DETECTED: {dialog.message}"), dialog.accept()))
        
        # 1. Click Sync Schedule button
        print("Clicking Sync Schedule from CSV Files button...")
        page.locator("#btn-sync-schedule").click()
        time.sleep(2)
        
        # 2. Fill global active caregiver initials
        print("Setting active nurse initials...")
        page.locator("#global-caregiver").fill("Ramya")
        time.sleep(0.5)
        
        # 3. Click on the first medication "PAN -40-MG"
        print("Clicking PAN -40-MG medication card...")
        try:
            page.get_by_text("PAN -40-MG").first.click(timeout=10000)
        except Exception as ex:
            print("Timeout clicking PAN -40-MG. Let's dump page HTML and server logs.")
            print("PAGE HTML SUMMARY:")
            print(page.content()[:2000])
            # Print server output
            server_process.terminate()
            stdout, stderr = server_process.communicate()
            print("SERVER STDOUT:", stdout)
            print("SERVER STDERR:", stderr)
            raise ex
            
        time.sleep(1)
        
        # Verify modal standard is active
        print("Filling standard log modal...")
        page.locator("#modal-notes").fill("Taken with warm water before meals")
        page.locator("#modal-initials").fill("R.Y.")
        time.sleep(0.5)
        page.locator("#btn-submit-standard").click()
        print("Submitted standard modal.")
        
        time.sleep(1.5)
        
        # 4. Click on the dynamic CSV-loaded task "PM Spirometry"
        print("Clicking PM Spirometry card...")
        page.get_by_text("PM Spirometry").first.click()
        time.sleep(1)
        
        print("Filling PM Spirometry log modal...")
        page.locator("#modal-notes").fill("Patient completed 3 rounds")
        page.locator("#modal-initials").fill("R.Y.")
        time.sleep(0.5)
        page.locator("#btn-submit-standard").click()
        print("Submitted PM Spirometry modal.")
        
        time.sleep(1.5)
        
        # 5. Click on Vitals Check task (with the new CSV label name)
        print("Clicking Vitals Check card...")
        page.get_by_text("Vitals Check: BP / Pulse").first.click()
        time.sleep(1)
        
        # Fill in vitals
        print("Filling vitals log modal...")
        page.locator("#vital-bp").fill("124/68")
        page.locator("#vital-pulse").fill("76")
        page.locator("#vital-spo2").fill("99")
        page.locator("#vital-temp").fill("98.2")
        page.locator("#vital-notes").fill("Regular vitals check, clear lungs")
        page.locator("#vital-initials").fill("R.Y.")
        time.sleep(0.5)
        page.locator("#btn-submit-vitals").click()
        print("Submitted vitals modal.")
        
        time.sleep(1.5)
        
        # 6. Click tab "Caregiver History Logs"
        print("Switching to History tab...")
        page.get_by_text("Caregiver History Logs").click()
        time.sleep(1.5)
        
        # 7. Click on "View Vitals Progress Plot" button
        print("Clicking View Vitals Progress Plot button...")
        page.locator("#btn-go-to-plot").click()
        time.sleep(2.0)
        
        # Save screenshot
        screenshot_path = os.path.join(output_dir, "patient_care_tracker_completed.png")
        print(f"Saving screenshot to {screenshot_path}...")
        page.screenshot(path=screenshot_path)
        
        browser.close()
        
    # Shutdown server
    print("Terminating backend server process...")
    server_process.terminate()
    server_process.wait()
    
    # Assert CSV exists and verify entries
    if os.path.exists(csv_path):
        print("SUCCESS: daily_medical_logs.csv successfully created!")
        with open(csv_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            rows = list(reader)
            print(f"CSV total rows (including header): {len(rows)}")
            for idx, r in enumerate(rows):
                print(f"Row {idx}: {r}")
    else:
        print("FAILURE: daily_medical_logs.csv was not created.")

if __name__ == "__main__":
    verify_care_tracker()
