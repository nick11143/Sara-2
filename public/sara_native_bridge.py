import http.server
import socketserver
import json
import os
import subprocess
import pyautogui
import platform
import psutil
import webbrowser
import time
import sys

# Try to import optional dependencies
try:
    import pyperclip
except ImportError:
    pyperclip = None

try:
    import pygetwindow as gw
except ImportError:
    gw = None

PORT = 8000

class NativeBridgeHandler(http.server.BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/execute':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data)
                command = data.get('command')
                target = data.get('target')
                value = data.get('value')
                
                result = self.execute_command(command, target, value)
            except Exception as e:
                result = {"success": False, "message": f"JSON Parse Error: {str(e)}"}
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

    def execute_command(self, command, target, value):
        try:
            if command == 'open_app':
                if platform.system() == "Windows":
                    # Try to find the app if it's not a full path
                    if not os.path.exists(target) and not target.endswith(".exe"):
                        # Common apps mapping
                        apps = {
                            "notepad": "notepad.exe",
                            "calc": "calc.exe",
                            "chrome": "chrome.exe",
                            "edge": "msedge.exe",
                            "vlc": "vlc.exe",
                            "spotify": "spotify.exe"
                        }
                        target = apps.get(target.lower(), target)
                    os.system(f'start "" "{target}"')
                elif platform.system() == "Darwin":
                    subprocess.Popen(["open", "-a", target])
                else:
                    subprocess.Popen([target])
                return {"success": True, "message": f"Opening {target}"}
            
            elif command == 'type_text':
                pyautogui.write(target, interval=0.02)
                return {"success": True, "message": f"Typed: {target}"}
            
            elif command == 'press_key':
                keys = target.split('+')
                if len(keys) > 1:
                    pyautogui.hotkey(*[k.strip() for k in keys])
                else:
                    pyautogui.press(target.strip())
                return {"success": True, "message": f"Pressed: {target}"}

            elif command == 'mouse_move':
                # Support both relative and absolute
                if ',' in target:
                    x, y = map(int, target.split(','))
                    pyautogui.moveTo(x, y, duration=0.3)
                    return {"success": True, "message": f"Moved mouse to {x}, {y}"}
                return {"success": False, "message": "Invalid coordinates. Use 'x,y'"}

            elif command == 'mouse_click':
                pyautogui.click()
                return {"success": True, "message": "Clicked mouse"}
            
            elif command == 'screenshot':
                filename = f"sara_screenshot_{int(time.time())}.png"
                pyautogui.screenshot(filename)
                return {"success": True, "message": f"Screenshot saved as {filename}", "path": os.path.abspath(filename)}
            
            elif command == 'system_info':
                info = {
                    "cpu_usage": psutil.cpu_percent(),
                    "memory_usage": psutil.virtual_memory().percent,
                    "battery": psutil.sensors_battery().percent if psutil.sensors_battery() else "N/A",
                    "os": platform.system(),
                    "node": platform.node(),
                    "uptime": int(time.time() - psutil.boot_time())
                }
                return {"success": True, "data": info}
            
            elif command == 'volume_control':
                level = int(value) if value else 50
                if platform.system() == "Windows":
                    # Simulate volume keys
                    for _ in range(50): pyautogui.press('volumedown')
                    for _ in range(level // 2): pyautogui.press('volumeup')
                return {"success": True, "message": f"Volume adjusted to ~{level}%"}
                
            elif command == 'open_website':
                webbrowser.open(target)
                return {"success": True, "message": f"Opened website: {target}"}
                
            elif command == 'clipboard_read':
                if pyperclip:
                    text = pyperclip.paste()
                    return {"success": True, "data": text}
                return {"success": False, "message": "pyperclip not installed. Run: pip install pyperclip"}
                    
            elif command == 'clipboard_write':
                if pyperclip:
                    pyperclip.copy(target)
                    return {"success": True, "message": "Text copied to clipboard"}
                return {"success": False, "message": "pyperclip not installed. Run: pip install pyperclip"}

            elif command == 'get_active_window':
                if gw:
                    win = gw.getActiveWindow()
                    if win:
                        return {"success": True, "data": {"title": win.title, "size": [win.width, win.height]}}
                    return {"success": False, "message": "No active window found"}
                return {"success": False, "message": "pygetwindow not installed. Run: pip install pygetwindow"}

            elif command == 'list_processes':
                processes = []
                for proc in psutil.process_iter(['pid', 'name']):
                    processes.append(proc.info)
                return {"success": True, "data": processes[:20]} # Limit to top 20

            return {"success": False, "message": f"Unknown command: {command}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

def run_bridge():
    try:
        with socketserver.TCPServer(("", PORT), NativeBridgeHandler) as httpd:
            print(f"==========================================")
            print(f"SARA ADVANCED NATIVE BRIDGE")
            print(f"Status: RUNNING")
            print(f"Port: {PORT}")
            print(f"OS: {platform.system()}")
            print(f"Python: {sys.version.split()[0]}")
            print(f"==========================================")
            print(f"Press Ctrl+C to stop.")
            httpd.serve_forever()
    except OSError:
        print(f"ERROR: Port {PORT} is already in use!")
        print(f"Please close any other instance of the bridge and try again.")
    except KeyboardInterrupt:
        print("\nBridge stopped by user.")

if __name__ == "__main__":
    run_bridge()

