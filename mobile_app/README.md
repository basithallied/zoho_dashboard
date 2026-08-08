# 📱 Zoho MIS Executive Mobile App (React Native + Expo)

A dedicated native mobile app built with **React Native** and **Expo** for viewing the **Zoho MIS Dashboard** on iOS and Android devices.

---

## 🌟 Mobile App Features

- **Strictly Read-Only Executive Viewing**: Optimized purely for fast, uncluttered viewing of KPIs, CRM pipeline, delivery status, and financial metrics. No creation forms, user permissions, or settings menus.
- **Saudi Riyal (SAR) Formatting**: All currency metrics automatically render in `SAR`.
- **4-Tab Navigation Bar**:
  - 🏠 **Overview**: Total Pipeline, Net Profit, KPI Carousel, and Kimi AI Q4 Forecasts.
  - 🎯 **CRM**: Executive Sales Rep Leaderboard with Quota Attainments and Win Rates.
  - 📁 **Projects**: On-Time Delivery Velocity (88.5%) and Team Resource Utilization Matrix.
  - 💰 **Finance**: Days Sales Outstanding (DSO - 28.4 Days) & 30-Day Cash Flow Timeline.
- **Real-Time Threshold Alert Banners**: Automatically alerts executives on mobile whenever KPI limits are breached.
- **FastAPI Integration**: Connects directly to the Python FastAPI backend REST APIs on `http://localhost:8000`.

---

## 🚀 How to Run the React Native Mobile App

### Prerequisites
1. Node.js installed.
2. Expo CLI (`npx expo start`).
3. For mobile testing:
   - **iOS**: Xcode Simulator or Expo Go app on iPhone.
   - **Android**: Android Studio Emulator or Expo Go app on Android device.

### Step 1: Install Dependencies
```bash
cd mobile_app
npm install
```

### Step 2: Start the Expo Development Server
```bash
npx expo start
```

### Step 3: Launch on iOS or Android
- Press `i` to open in **iOS Simulator**.
- Press `a` to open in **Android Emulator**.
- Or scan the QR code using the **Expo Go** app on your physical iPhone or Android phone!

---

## ⚙️ Connecting to Backend Server

In `src/services/api.js`:
- For **iOS Simulator / Web**: `http://localhost:8000`
- For **Android Emulator**: `http://10.0.2.2:8000`
- For **Physical Mobile Phone (Expo Go)**: Replace `localhost` with your computer's local Wi-Fi IP address (e.g., `http://192.168.1.50:8000`).
