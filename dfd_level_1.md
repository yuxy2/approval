# DFD Level 1: Process Decomposition

Below is the Data Flow Diagram (DFD) Level 1 for the **Variation Request Approval System**. This diagram breaks down the main system into 4 key sub-processes and shows their interactions with the data stores (**Data Stores**).

```mermaid
graph TD
    %% Entities
    subgraph Entities [External Entities]
        S["👷 Submitter"]
        PM["💼 Project Manager (PM)"]
        C["👑 Client"]
    end

    %% Data Stores
    subgraph Storage [Data Stores]
        DB[("💾 D1: Requests DB <br/>(db.json)")]
        EMAIL_LOG[("✉️ D2: Email Logs")]
    end

    %% Processes
    subgraph Processes [Sub-Processes]
        P1(("1.0<br/>Submit Request"))
        P2(("2.0<br/>Process PM Assessment"))
        P3(("3.0<br/>Process Client Sign-off"))
        P4(("4.0<br/>View Dashboard & Logs"))
    end

    %% Flows for P1
    S -- "Submit Field Form" --> P1
    P1 -- "Save Request (PENDING_PM)" --> DB
    P1 -- "Record Notification Email to PM" --> EMAIL_LOG

    %% Flows for P2
    DB -- "Read Request Data" --> P2
    P2 -- "Display On-Site Data" --> PM
    PM -- "Submit Assessment / Rejection" --> P2
    P2 -- "Update Request (PENDING_CLIENT / REJECTED_TO_SUBMITTER)" --> DB
    P2 -- "Record Client / Submitter Notification" --> EMAIL_LOG

    %% Flows for P3
    DB -- "Read Data & Costing" --> P3
    P3 -- "Display Details for Client" --> C
    C -- "Sign & Approve / Reject" --> P3
    P3 -- "Update Status (APPROVED / REJECTED_TO_PM)" --> DB
    P3 -- "Record Success / PM Bounce Notification" --> EMAIL_LOG

    %% Flows for P4
    DB -- "Fetch Request List" --> P4
    EMAIL_LOG -- "Fetch Email Logs" --> P4
    P4 -- "Display Progress Table & Simulator Panel" --> S
    P4 -- "Display Progress Table & Simulator Panel" --> PM

    %% Styling
    style P1 fill:#1e293b,stroke:#D4AF37,stroke-width:1.5px,color:#fff
    style P2 fill:#1e293b,stroke:#D4AF37,stroke-width:1.5px,color:#fff
    style P3 fill:#1e293b,stroke:#D4AF37,stroke-width:1.5px,color:#fff
    style P4 fill:#1e293b,stroke:#D4AF37,stroke-width:1.5px,color:#fff
    
    style DB fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    style EMAIL_LOG fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#fff
    
    style S fill:#0f172a,stroke:#475569,stroke-width:1px,color:#94a3b8
    style PM fill:#0f172a,stroke:#475569,stroke-width:1px,color:#94a3b8
    style C fill:#0f172a,stroke:#475569,stroke-width:1px,color:#94a3b8
```

---

## Process & Data Flow Descriptions (Level 1)

### **1.0 Submit Request (Initiation Process)**
* **Data Flow**: The Submitter sends field form data (Project Address, Scope, Reason, Impact).
* **Storage**: The system writes a new request record to data store **D1 (Requests DB)** with an initial status of `PENDING_PM`.
* **Notification**: The system records a new notification log in data store **D2 (Email Logs)** for the PM.

### **2.0 Process PM Assessment (Assessment Process)**
* **Data Flow**: The PM opens the form. The system reads request data from **D1** and displays it as read-only.
* **Updates**: The PM inputs their assessment (financial and schedule impact) or submits a rejection. This updates **D1** (changing status to `PENDING_CLIENT` if assessed, or `REJECTED_TO_SUBMITTER` if sent back for revision).
* **Notification**: The system records notification emails in **D2** (sent to the Client for sign-off or back to the Submitter for revision).

### **3.0 Process Client Sign-off (Client Review Process)**
* **Data Flow**: The Client opens the sign-off link. The system reads the request history (Step 1 and Step 2 details) from **D1** and displays it to the Client.
* **Updates**: The Client agrees (checking the agreement box, entering their name, and signing on the digital canvas) or rejects. The status in **D1** is updated to `APPROVED` (finalized) or `REJECTED_TO_PM` (bounced back to the PM for price adjustment).
* **Notification**: The system records notifications in **D2** to be sent to all relevant stakeholders.

### **4.0 View Dashboard & Logs (Monitoring Process)**
* **Data Flow**: The system continuously reads the request data from **D1** to render the dashboard table for the Submitter and PM.
* **Simulator Logs**: The system reads email logs from **D2** to render them inside the prototype simulator panel at the top of the application.
