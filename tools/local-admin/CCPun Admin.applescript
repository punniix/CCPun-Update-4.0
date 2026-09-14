use scripting additions

property controllerPath : "/Users/punnii/Desktop/CCPun x AI/CCPun-Financial Advisor Project/Dev/Homepage-v4-1-admin-lab/Dev/Homepage/tools/local-admin/ccpun_admin.py"
property adminURL : "http://localhost:3000/dashboard/"

on runController(actionName)
  with timeout of 120 seconds
    set commandText to "/usr/bin/python3 " & quoted form of controllerPath & " " & actionName
    return do shell script commandText
  end timeout
end runController

on run
  repeat
    activate
    try
      set statusText to my runController("status")
    on error errorText
      display alert "ตรวจสอบ CCPun Admin ไม่สำเร็จ" message errorText as critical buttons {"ปิด"} default button "ปิด"
      return
    end try

    try
      set chosenButton to button returned of (display dialog statusText & return & return & "เลือกสิ่งที่ต้องการทำ" with title "CCPun Admin" buttons {"ปิดระบบ", "เปิดระบบ", "ออกและปิดระบบ"} default button "เปิดระบบ" with icon note)
    on error number -128
      try
        my runController("stop")
      end try
      return
    end try

    if chosenButton is "เปิดระบบ" then
      try
        set resultText to my runController("start")
        tell application "Safari" to open location adminURL
        display dialog resultText with title "CCPun Admin" buttons {"กลับหน้าควบคุม"} default button "กลับหน้าควบคุม" with icon note
      on error errorText
        display alert "เปิด CCPun Admin ไม่สำเร็จ" message errorText as critical buttons {"กลับหน้าควบคุม"} default button "กลับหน้าควบคุม"
      end try
    else if chosenButton is "ปิดระบบ" then
      try
        set resultText to my runController("stop")
        display dialog resultText with title "CCPun Admin" buttons {"กลับหน้าควบคุม"} default button "กลับหน้าควบคุม" with icon note
      on error errorText
        display alert "ปิด CCPun Admin ไม่สำเร็จ" message errorText as critical buttons {"กลับหน้าควบคุม"} default button "กลับหน้าควบคุม"
      end try
    else if chosenButton is "ออกและปิดระบบ" then
      set didStop to true
      try
        my runController("stop")
      on error errorText
        set didStop to false
        display alert "ปิด CCPun Admin ไม่สำเร็จ" message errorText as critical buttons {"กลับหน้าควบคุม"} default button "กลับหน้าควบคุม"
      end try
      if didStop then return
    end if
  end repeat
end run
