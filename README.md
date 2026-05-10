# PTJV Health Declaration & Attendance System

A professional, lightweight, and Dockerized health declaration system designed for the **PTJV (Penta-Ocean / TOA)** project. 

## 🚀 Recent Updates
* **Port Change:** Now running on port `4460` to avoid common local conflicts.
* **Smart IDs:** Personnel are now assigned a clean 3-digit Serial Number (e.g., `001`, `002`) instead of long timestamps.
* **Enhanced Stability:** Migrated to Named Volumes to prevent `EBUSY` file-locking errors on Windows/WSL environments.

## 🛠️ Features
* **Daily Health Declaration:** Fast submission for personnel health status and TBM attendance.
* **Admin Dashboard:** Monitor total submissions, health trends, and live logs.
* **Personnel Management:** Add, Edit, and Delete personnel with automatic 3-digit SN assignment.
* **Compliance Analysis:** Date-span filtering to track submission rates and health scores.
* **Print-Ready Reports:** Professional layouts optimized for site audits and PDF exports.

---

## 📦 Installation & Setup

### Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Git](https://git-scm.com/)

### Running the App
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/sadatia/TBM.git](https://github.com/sadatia/TBM.git)
    cd TBM
    ```

2.  **Launch with Docker:**
    ```bash
    docker compose up -d --build
    ```

3.  **Access the application:**
    * **User Interface:** [http://localhost:4460](http://localhost:4460)
    * **Admin Panel:** [http://localhost:4460/admin?key=admin123](http://localhost:4460/admin?key=admin123)
    * **Analysis Page:** [http://localhost:4460/admin/analysis?key=admin123](http://localhost:4460/admin/analysis?key=admin123)

---

## 📂 Data Persistence
The system uses a Docker **Named Volume** called `ptjv_db_data`. This ensures that your personnel list and health records are preserved even if the container is stopped, updated, or removed.

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

---

## 🔒 Security
The `ADMIN_KEY` is set to `admin123`. Access to the Admin and Analysis sections requires this key as a URL parameter to ensure data privacy.

---

## 📄 License
Internal project for **Penta-Ocean / TOA (PTJV)** Site Office.

