# 🪸 Black Pearl - Operational Intelligence Engine

Welcome to Black Pearl! This is an AI-powered operational intelligence engine that connects across your entire work stack (GitHub, Slack, Google Calendar, Discord, and LinkedIn). It uses **Coral SQL** and **Google Gemini** to synthesize dynamic cross-source queries and identify operational pressure in real-time.

## 🚀 How to Run the App (Judges' Guide)

To experience the full magic of the app, you will run both the Node.js backend server and the Expo mobile frontend locally. We have pre-configured a universal OAuth flow so you can securely connect your own accounts with just 1-click!

### 1. Start the Backend Server
The backend handles the Coral SQL engine, Gemini LLM synthesis, and OAuth token exchanges.

1. Open your terminal and navigate to the server folder:
   ```bash
   cd server
   npm install
   ```
2. You will need a **free Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Start the server by passing your key:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   npm start
   ```
*(You should see `🪸 Black Pearl — Coral SQL Backend` running on Port 3001)*

### 2. Start the Mobile App
Open a **new** terminal tab in the root of the repository.

1. Install dependencies and start Expo:
   ```bash
   npm install
   npx expo start
   ```
2. Press `i` to open in the iOS Simulator, `a` for Android Emulator, or scan the QR code using the **Expo Go** app on your physical phone (must be on the same Wi-Fi network).

### 3. Experience the Magic 🪄
1. On the first screen, tap the sources you want to connect (e.g., GitHub, Google Calendar).
2. Because we set up a seamless localhost OAuth flow, a browser will pop up allowing you to securely log in with 1-click.
3. Once connected, tap **Continue to Black Pearl**.
4. The Gemini Engine will instantly analyze the schema of your connected accounts, generate dynamic Coral SQL queries, and surface insights (like stalled PRs mentioned in urgent Slack messages) right to your dashboard!

---
*Built with ❤️ for the Hackathon!*
