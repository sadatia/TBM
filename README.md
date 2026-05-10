# PTJV Health Declaration & Attendance System

A professional, lightweight, and Dockerized health declaration system designed for the **PTJV (Penta-Ocean / TOA)** project. This application allows personnel to submit daily health statuses and provides an administrative dashboard for real-time tracking and periodic compliance reporting.

## 🚀 Features

* **Daily Health Declaration:** Quick and easy form for personnel to report health status (Well/Not Well) and TBM attendance.
* **Admin Dashboard:** Real-time monitoring of total submissions, health trends, and live status logs.
* **Personnel Management:** Admin capability to Add, Edit (Name/Passcode), and Delete personnel.
* **Advanced Analysis:** Dedicated reporting page with date-span filtering to track compliance scores and success rates over time.
* **Print-Ready Reports:** Clean, professional layouts optimized for PDF export and site audits.
* **Dockerized Environment:** One-command deployment ensures the app runs identically on any server.

---

## 🛠️ Technology Stack

* **Backend:** Node.js, Express.js
* **Database:** LowDB (JSON-based, lightweight persistence)
* **Frontend:** EJS (Embedded JavaScript templates), Tailwind CSS, FontAwesome
* **Containerization:** Docker & Docker Compose

---

## 📦 Installation & Setup

### Prerequisites
* [Docker](https://docs.docker.com/get-docker/)
* [Docker Compose](https://docs.docker.com/compose/install/)

### Running the App
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sadatia/TBM.git
    cd TBM
    ```

2.  **Ensure your local database exists:**
    ```bash
    touch db.json
    echo '{"users":[],"records":[]}' > db.json
    ```

3.  **Build and launch with Docker:**
    ```bash
    docker compose up -d --build
    ```

4.  **Access the application:**
    * **User Interface:** `http://localhost:3000`
    * **Admin Panel:** `http://localhost:3000/admin?key=admin123`
    * **Analysis Page:** `http://localhost:3000/admin/analysis?key=admin123`

---

## 📂 Project Structure

```text
/TBM
├── views/              # EJS Templates (UI)
├── public/             # Static files (CSS, Logos)
├── server.js           # Core Application Logic
├── db.json             # Database (JSON)
├── Dockerfile          # Docker Build Configuration
├── docker-compose.yml  # Docker Orchestration
└── package.json        # Node.js Dependencies
