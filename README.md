# 🚀 EmPay — Smart Human Resource Management System

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/omkarsp03/EmPay-Smart-Human-Resource-Management-System)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()

EmPay is a high-performance, premium HRMS platform designed with a **Glassmorphism / iOS-inspired** aesthetic. It streamlines complex HR operations including payroll processing, attendance tracking, and employee management through a sleek, intuitive interface.

![EmPay Mockup](file:///Users/omkar/.gemini/antigravity/brain/9afab967-2afc-427f-a3fd-6144816544a4/empay_hrms_mockup_1777724557321.png)

---

## 🏛️ Architecture Overview

EmPay follows a decoupled **Client-Server Architecture** optimized for scalability and rapid prototyping.

```mermaid
graph TD
    subgraph "Frontend (Client)"
        UI[React 19 / Vite]
        Router[React Router 7]
        State[Local/Context State]
        Assets[Tailwind / Vanilla CSS]
    end

    subgraph "Backend (Server)"
        API[Express.js REST API]
        Auth[JWT / Bcrypt]
        Logic[Business Controllers]
        Middleware[Auth/Error Middleware]
    end

    subgraph "Data Layer"
        DB[(In-Memory Store)]
        Seed[Seed Utility]
    end

    UI -->|HTTP/REST| API
    API --> Logic
    Logic --> DB
    API -.-> Middleware
    Seed --> DB
```

---

## ✨ Key Features

-   **💎 Premium UI/UX:** Advanced glassmorphism design with aurora gradients and iOS-style micro-animations.
-   **📊 Real-time Analytics:** Interactive dashboards using Recharts for attendance trends and department distribution.
-   **💰 Automated Payroll:** Complex tax calculation engine (TDS, PT, PF) with payslip generation (PDF support).
-   **📅 Smart Attendance:** Daily check-in/out tracking with automatic work hour calculations.
-   **🌴 Leave Management:** Comprehensive workflow for leave applications and multi-level approvals.
-   **🔐 Secure Auth:** Role-based access control (Admin, HR, Employee) secured with JWT.

---

## 📈 Unique System Graphs

### 1. User Authentication & Authorization Flow
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Middleware
    participant Server
    participant DB

    User->>Frontend: Enter Credentials
    Frontend->>Server: POST /api/auth/login
    Server->>DB: Verify User & Password
    DB-->>Server: User Object (Hashed PW)
    Server->>Server: Sign JWT Token
    Server-->>Frontend: 200 OK + Token
    Frontend->>Frontend: Store Token (LocalStorage)
    
    Note over User, DB: Subsequent Requests
    
    User->>Frontend: Access Protected Route
    Frontend->>Server: GET /api/users (Header: Bearer Token)
    Server->>Middleware: Verify JWT
    Middleware->>Server: Decoded Payload
    Server->>DB: Fetch Data
    DB-->>Server: Data
    Server-->>Frontend: Response
```

### 2. Payroll Processing Pipeline
```mermaid
graph LR
    A[Base Salary] --> B{Calculations}
    B --> C[Earnings]
    B --> D[Deductions]
    
    C --> C1[HRA]
    C --> C2[DA]
    C --> C3[Special Allowance]
    
    D --> D1[PF - 12%]
    D --> D2[TDS - Slab Based]
    D --> D3[Professional Tax]
    
    C1 & C2 & C3 & D1 & D2 & D3 --> E[Net Salary]
    E --> F[Generate Payslip PDF]
```

---

## 🛠️ Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite | Core Framework |
| **Routing** | React Router 7 | Navigation |
| **Icons** | Lucide React | Visual Language |
| **Charts** | Recharts | Data Visualization |
| **Backend** | Node.js, Express | Server Engine |
| **Auth** | JWT, Bcrypt.js | Security |
| **PDF** | JSPDF, html2canvas | Document Generation |
| **Styling** | Vanilla CSS (Glassmorphism) | Visual Aesthetic |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm / yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/omkarsp03/EmPay-Smart-Human-Resource-Management-System.git
   cd EmPay-Smart-Human-Resource-Management-System
   ```

2. **Setup Server**
   ```bash
   cd server
   npm install
   npm start
   ```

3. **Setup Client**
   ```bash
   cd ../client
   npm install
   npm run dev
   ```

---

## 👨‍💼 Demo Accounts

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@empay.com` | `admin123` |
| **HR** | `hr@empay.com` | `hr123` |
| **Employee** | `john@empay.com` | `emp123` |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Created with ❤️ by the EmPay Team.