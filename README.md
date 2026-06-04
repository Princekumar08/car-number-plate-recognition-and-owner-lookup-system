# Plate Lookup Pro & Parking System

This is the web-ready version of the Car Plate Lookup & Campus Parking Violation alert system. It is structured to be instantly hostable via static web hosts such as **GitHub Pages**, Vercel, Netlify, or Firebase Hosting.

## 🚀 How to Host on GitHub Pages

1. **Create a new GitHub Repository**:
   - Go to [github.com/new](https://github.com/new).
   - Name your repository (e.g., `car-plate-lookup`).
   - Leave it **Public** (required for free GitHub Pages hosting) and do not initialize with a README (as we already have one).

2. **Initialize Git and Push**:
   Open your terminal (PowerShell, Command Prompt, or Git Bash) in this folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of web application"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
   *(Be sure to replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name.)*

3. **Enable GitHub Pages**:
   - Go to your repository on GitHub.
   - Click on **Settings** (tab at the top).
   - Under the left sidebar, click on **Pages** (under the "Code and automation" section).
   - Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and `/ (root)` folder.
   - Click **Save**.
   - Wait 1–2 minutes, and GitHub will provide you with a live link (e.g., `https://yourusername.github.io/your-repo-name/`).

---

## 🛠️ Tech Stack & Features

- **Tesseract.js** for browser-based OCR (license plate detection).
- **SheetJS (xlsx)** for importing Excel/CSV databases directly into the browser.
- **jsPDF** for generating PDF reports of parking violations locally.
- **IndexedDB-backed Storage** via custom `app-storage.js` to ensure the website is completely serverless and can store gigabytes of user records without hitches or quota issues.
- **Glassmorphism CSS** for a futuristic look.
