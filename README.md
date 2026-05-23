<p align="center">
  <img src="shared/images/SOMNiA.png" alt="SOMNiA LOGO" />
  <img src="https://cit.edu/wp-content/uploads/2023/07/cit-logo.png" alt="CIT LOGO" />
</p>
## 🚀 How to Run the Project

Follow these steps to set up and run the different components of the SOMNiA ecosystem.

### 1. Backend & Web Services
Open separate terminal instances for each service and run the following commands:


<summary<b>🖥️ Server (Backend)</b></summary>

BACKEND
```bash
cd server
npm install
npm run server

WEB
''bash
cd client
npm install
npm run dev

AI
''bash
cd ai_service
python -m venv venv
# On Windows PowerShell/CMD:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload

2. Mobile App (Android)
⚠️ Prerequisite: Ensure your backend services (server and ai_service) are already up and running before starting the mobile app.

1. Open the Android Project:
Open Android Studio. Locate and open the folder named android inside your somnia project directory.

2. Launch the Emulator:
Inside Android Studio, do not click the main "Play/Run" button at the top.
Instead, open the Device Manager.
Find your virtual device and click the Run/Launch button next to it to start the emulator. Wait for the virtual phone to fully boot up.

3. Install Mobile Dependencies:
Open your terminal (VS Code or your preferred terminal application) and navigate into the mobile directory:
''bash
cd mobile
npm install

4. Build and Run the App:
With the emulator running in the background, run the specific command to compile the app using the Android Studio Java Runtime:
''bash
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" npm run android



## 📘 Project Description

*SOMNiA* is a dual-purpose project developed by a team of three students as part of both the **Software Engineering** and **Undergraduate Research** courses.

This project spans multiple academic semesters:
- 🧑‍💻 **Software Engineering**  
  - 2nd Semester, 3rd Year (2024–2025)  
  - 1st Semester, 4th Year (2025–2026)

- 🔬 **Undergraduate Research**  
  - 2nd Semester, 3rd Year (2024–2025)  
  - 1st and 2nd Semesters, 4th Year (2025–2026)

---

SOMNiA is an **AI-powered system** designed to monitor and analyze sleep-related data from smartphones and wearable devices. Its core objective is to detect early indicators of **insomnia** and other sleep disorders through continuous data collection and machine learning-based analysis.

The project aims to:
- Deliver a fully functional mobile and web-based software solution
- Support academic research through real-world data collection
- Provide actionable insights into users' sleep behaviors and patterns

---

## 👥 Team Members
| **Developers**                    | **Roles**                    |
| ----------------------------------| -----------------------------|
| Belleza, Ellydhore Gabrylle       | Front-End Developer (Mobile) |
| Escosia, Raphael Jay              | Front-End Developer (Mobile) |
| Timagos, Ryan Jay Anthony         | Full Stack Developer         |

---

## ⚠️ Disclaimer
You are free to copy, use, and modify the source code, datasets, and AI/ML models provided in this repository for your own purposes. However, the developers make no guarantees about the safety, reliability, or suitability of this software and data.

By using or modifying any part of this project, you agree that the developers are not liable for any damages, errors, or issues that may arise from your use. Use everything at your own risk.

---

<!-- @import "[TOC]" {cmd="toc" depthFrom=1 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [📘 Project Description](#-project-description)
- [👥 Team Members](#-team-members)
- [⚠️ Disclaimer](#️-disclaimer)

<!-- /code_chunk_output -->



