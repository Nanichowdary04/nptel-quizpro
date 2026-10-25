# NPTEL QuizPro — Java Exam Prep

## Live Access & Deployment
- **Global Public HTTPS URL (Works on ANY Wi-Fi / Mobile Data Worldwide, No Password Needed)**:  
  👉 **[https://orchestra-halo-larry-enables.trycloudflare.com](https://orchestra-halo-larry-enables.trycloudflare.com)**
- **Local Network / Same Wi-Fi URL**: `http://10.30.19.47:8080/`
- **Localhost**: `http://localhost:8080/`

## Features
- **120 Assignment MCQs**: Real extracted questions across 12 weeks of Programming in Java.
- **Practice Mode**: Clean study environment without spoilers. Click to select options (`.selected`), and review full correct answers upon submitting.
- **Mock Test Mode**: Instant visual feedback on every click — turns green (`.correct`) or red (`.wrong`) immediately with detailed explanation block.
- **Multi-Laptop Shared Leaderboard**:
  - Live synced across all laptops and devices on **different Wi-Fi networks / mobile data** via the built-in `/api/leaderboard` server database (`leaderboard.json`).
  - When anyone on another Wi-Fi or phone submits their quiz, it immediately appears on everyone else's leaderboard (auto-refreshes every 15 seconds).
- **Reset & Clear Data**:
  - Click **"🗑 Clear All Data"** on the Leaderboard or Login screen to erase all usernames, scores, and history across all laptops.
- **Score-Band Rewards & Dialogues**:
  - `< 50%`: *"Pashi randa!"* + `reaction-below-50.mp4`
  - `50%–70%`: *"School ke po erripuva!"* + `reaction-60-70.mp4`
  - `71%–99%`: *"Dehradun bey dehradun!"* + `reaction-80-90.mp4`
  - `100%`: *"My name is Patrick Jane!"* + `reaction-perfect.mp4` & Mentalist Poster (`mentalist-perfect.png`)

## Running the Server
```bash
node server.js
```
The server serves all static assets, supports HTTP Range requests for MP4 video streaming, and manages the shared leaderboard at `/api/leaderboard`.
