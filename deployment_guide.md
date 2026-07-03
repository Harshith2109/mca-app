# Production Deployment Guide: Online Exam System

This guide outlines how to host the Node.js Express API server in the cloud on **Render.com** and connect it to a free cloud database on **MongoDB Atlas**. Once deployed, your mobile app can connect to the server securely over the internet from any device.

---

## Part 1: Set Up MongoDB Atlas (Free Cloud Database)

Since local databases (`localhost:27017`) cannot be reached across the internet, you need a database in the cloud:

1. **Create an Account**:
   - Go to [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. **Create a Free Cluster**:
   - Click **Create Database** and select the **M0 (Free)** shared cluster option.
   - Choose your preferred cloud provider (e.g., AWS) and region, then click **Create**.
3. **Configure Database Access (Username & Password)**:
   - In the database setup wizard, create a database user (e.g., username: `dbuser`, password: `strongpassword`). Record these credentials.
4. **Configure Network Access**:
   - Go to **Network Access** in the left sidebar.
   - Click **Add IP Address**.
   - Choose **Allow Access from Anywhere** (adds `0.0.0.0/0`). This is required because Render's cloud servers use dynamic IP addresses.
5. **Get your Connection String**:
   - Go to the **Database** menu in the sidebar and click **Connect** next to your cluster.
   - Choose **Drivers** under "Connect to your application".
   - Copy the connection string. It will look like this:
     ```text
     mongodb+srv://dbuser:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Replace `<password>` with the password you set in step 3, and add `exam_system` after the slash as the database name. Example:
     ```text
     mongodb+srv://dbuser:strongpassword@cluster0.xxxx.mongodb.net/exam_system?retryWrites=true&w=majority&appName=Cluster0
     ```

---

## Part 2: Deploy Backend on Render.com

Render connects directly to your Git repository to automatically build and host your code.

1. **Initialize Git & Push to GitHub**:
   - If not already done, push your code to a private repository on GitHub or GitLab:
     ```bash
     cd c:\RV\2-SEM\MCA\app
     git init
     git add .
     git commit -m "Configure deployment scripts"
     # Connect and push to your remote GitHub repo
     ```
2. **Create a Render Account**:
   - Go to [render.com](https://render.com) and sign up (connect your GitHub account for easiest integration).
3. **Deploy using the Blueprint**:
   - In the Render Dashboard, click **New +** in the top right and select **Blueprint**.
   - Connect your GitHub repository.
   - Render will read the [render.yaml](file:///c:/RV/2-SEM/MCA/app/render.yaml) file in your root folder and display the **exam-system-api** service.
4. **Input Environment Variables**:
   Render will prompt you to input the values for the required variables:
   - **`MONGODB_URI`**: Paste the connection string you copied from MongoDB Atlas.
   - **`MOODLE_URL`**: Your Moodle site web address.
   - **`MOODLE_TOKEN`**: The Moodle API token generated on your Moodle web service panel.
   - *Note: `JWT_SECRET` will be generated for you automatically.*
5. **Approve and Deploy**:
   - Click **Apply** to start the deployment.
   - Render will download your code, run `npm install`, and start your server. Once successful, the status will show **Live**, and you will get a secure public URL (e.g. `https://exam-system-api.onrender.com`).
   - You can test if it's active by visiting `https://your-service-name.onrender.com/health` in your browser. It should return `{ "status": "ok" }`.

---

## Part 3: Configure the Mobile Application

Now that you have a permanent production backend address:

### Option A: Change at Runtime (For Testing)
Open the app on any phone, click the **Settings gear icon** in the top-right, and enter:
```text
https://your-service-name.onrender.com/api
```
Save and log in!

### Option B: Hardcode Production Domain (For final release APK)
If you want to compile a final APK that connects to your server automatically without entering any settings:

1. Open [mobile/App.js](file:///c:/RV/2-SEM/MCA/app/mobile/App.js).
2. Change the global API variable around line 20:
   ```javascript
   let GLOBAL_API_BASE = 'https://your-service-name.onrender.com/api';
   ```
3. Trigger a final build:
   ```bash
   cd c:\RV\2-SEM\MCA\app\mobile
   eas build --platform android --profile preview
   ```
4. Install the final APK. The app will immediately communicate with Moodle and the database across the internet on launch!
