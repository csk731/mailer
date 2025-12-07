# Mass Emailer

A simple, powerful web application to send mass personalized emails using your Gmail account. built with Next.js and Tailwind CSS.

## Features
- **Google Sign-In**: Securely authenticate with your Gmail account.
- **Dynamic Recipient Table**: Add unlimited rows and columns (placeholders) like `{{Company}}`.
- **Rich Text Composer**: Write emails with bold, italics, and proper formatting.
- **Attachments**: Attach files to your emails.
- **Client-Side Only**: Your data stays in your browser. No database is used.

## Getting Started

### 1. Prerequisites
You need a **Google Cloud Project** with the **Gmail API** enabled.

#### Steps to setup Google Cloud:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Go to **APIs & Services > Library** and search for **Gmail API**. Enable it.
4. Go to **APIs & Services > OAuth consent screen**.
   - Choose **External** (if you are the only user, or add yourself as test user).
   - Fill in required contact info.
   - **Scopes**: Add `https://www.googleapis.com/auth/gmail.send`.
   - **Test Users**: Add your email address (since the app is in "Testing" mode).
5. Go to **APIs & Services > Credentials**.
   - Create Credentials > **OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `https://your-vercel-app.vercel.app` (if you deploy it)
   - Copy the **Client ID**. You will need this to log in.

### 2. Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000`.

### 3. Usage
1. Enter your **Google Client ID** in the top right.
2. Click **Sign in with Google**.
3. **Recipients**: Add columns like "Company" or "FirstName". Add rows for each person.
4. **Compose**: Write your email. Use placeholders like `{{Company}}` that match your table headers.
5. **Attach**: Add any files.
6. **Send**: Click send and watch the progress!
