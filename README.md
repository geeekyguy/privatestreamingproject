# Private Video Streaming Service with Google Drive Integration

A private, self-hosted streaming service that allows you to browse and stream video files directly from Google Drive in your web browser or in a native Android app using Android Media3 ExoPlayer.

---

## Architecture Overview

```
                 +-------------------+
                 |    Google Drive   |
                 +---------+---------+
                           ^ (alt=media + Range Header)
                           |
                           v
              +------------+------------+
              |    Express Proxy Server  |
              +------------+------------+
                           ^
                           | (HTTP Range / 206 Partial Content)
            +--------------+--------------+
            |                             |
            v                             v
  +---------+---------+         +---------+---------+
  |    Web Browser    |         |   Android App     |
  |  (HTML5 <video>)  |         |   (ExoPlayer)     |
  +-------------------+         +-------------------+
```

1. **Proxy Server (Node.js/Express)**: Handles Google OAuth2, lists Drive folders/videos, and proxies streaming chunks by forwarding HTTP `Range` headers to the Google Drive API.
2. **Web Dashboard (HTML5/CSS/JS)**: Clean mobile-responsive glassmorphism folder browser and cinematic video overlay.
3. **Android Client (Jetpack Compose)**: Material 3 files list and full-screen video player using **Android Media3 ExoPlayer** for seamless buffering and seeking.

---

## Installation & Setup

### Step 1: Create Google Cloud Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to **APIs & Services > Library**, search for **Google Drive API**, and click **Enable**.
4. Go to **APIs & Services > OAuth consent screen**, select **External**, and fill in the required fields.
   - Add the scope: `.../auth/drive.readonly` (Read-only access to files).
   - Under **Test Users**, add your personal Google email.
5. Go to **APIs & Services > Credentials**:
   - Click **Create Credentials** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Private Stream Server`.
   - Authorized redirect URIs: `http://localhost:3000/oauth2callback`.
   - Click **Create** and copy your **Client ID** and **Client Secret**.

### Step 2: Configure Environment Variables
1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Copy `.env.template` to `.env`:
   ```bash
   cp .env.template .env
   ```
3. Open `.env` and fill in your details:
   ```env
   PORT=3000
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   ACCESS_CODE=your_custom_password
   ```

### Step 3: Run the Server
1. Install server dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
   The server will start listening at `http://localhost:3000`.

### Step 4: Authenticate with Google Drive (First-Time Only)
1. Open `http://localhost:3000` in your web browser.
2. Click **Connect with Google Drive**.
3. Sign in with your Google account.
4. Once redirect completes, you will see the folder list explorer.
5. Access tokens are securely saved to `server/.google-tokens.json` and persist across server restarts.

---

## Accessing the Streams

### 1. Web browser
1. Go to `http://localhost:3000`.
2. Enter the `ACCESS_CODE` you configured in your `.env` file.
3. Browse your drive folders and click on any video to stream it.

### 2. Android App
1. Make sure the backend server is running on your network.
2. Launch the Android emulator or connect a device.
3. Open the Android project in Android Studio or compile/run it using:
   ```bash
   cd android
   ./gradlew installDebug
   ```
4. Enter the Server URL:
   - If running in the Android Emulator on the same computer: `http://10.0.2.2:3000`
   - If running on a physical Android phone: `http://<your-computer-local-ip>:3000` (e.g. `http://192.168.1.105:3000`)
5. Enter the `ACCESS_CODE` you configured in `.env`.
6. Click **Connect Server**.
7. Browse your Google Drive folders and play videos natively with ExoPlayer.
