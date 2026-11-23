# DFD Level 0: Context Diagram

Below is the Data Flow Diagram (DFD) Level 0 (often referred to as the Context Diagram) for the **Variation Request Approval System**. This diagram shows the flow of incoming and outgoing data between the main system and external entities (Submitter, PM, and Client).

```mermaid
graph TD
    %% Entities
    subgraph Entities [External Entities]
        S["👷 Submitter (Site Supervisor / LC)"]
        PM["💼 Project Manager (PM / PRM)"]
        C["👑 Client (Customer)"]
    end

    %% Central Process
    SYS(("⚙️ Variation Request<br/>Approval System"))

    %% Data flows Submitter
    S -- "1. Send Variation Details (Address, Scope, Reason, Impact)" --> SYS
    SYS -- "6. Status Notification (Approved / Revision Required + PM Notes)" --> S

    %% Data flows PM
    SYS -- "2. Access Link & On-Site Submission Data" --> PM
    PM -- "3. Input Costing & Schedule Assessment (Financial/Schedule Impact, Rep Name)" --> SYS
    SYS -- "7. Notification (Client Approved / Client Rejected + Notes)" --> PM

    %% Data flows Client
    SYS -- "4. Access Link, Scope Details, & PM Cost Estimates" --> C
    C -- "5. Send Agreement (Agreement Check, Name, Canvas Signature)" --> SYS

    %% Styling
    style SYS fill:#1e293b,stroke:#D4AF37,stroke-width:2px,color:#fff
    style S fill:#0f172a,stroke:#3b82f6,stroke-width:1px,color:#94a3b8
    style PM fill:#0f172a,stroke:#f59e0b,stroke-width:1px,color:#94a3b8
    style C fill:#0f172a,stroke:#10b981,stroke-width:1px,color:#94a3b8
```

---

## Data Flow Descriptions

### 1. Submitter Interactions with the System
* **Data Flowing into the System**: The submitter fills out the request form from the field (Project Address, Date, Name, Scope Description, Reason for Change, Project Impact, and Client Email).
* **Data Flowing out of the System**: The system sends the final status notification. If approved, the submitter receives an *Approved* confirmation. If rejected by the PM, the submitter receives a revision link along with feedback/notes from the PM.

### 2. Project Manager (PM) Interactions with the System
* **Data Flowing out of the System**: The system sends an automated notification email containing a unique access link `/pm/[id]` and read-only details of the on-site submission data (Step 1).
* **Data Flowing into the System**: The PM inputs financial assessment data (cost impact type/amount), schedule assessment data (time impact type/days), company representative name (signature name), and internal remarks/rejection details.

### 3. Client Interactions with the System
* **Data Flowing out of the System**: The system sends an automated notification email containing a unique access link `/client/[id]` with read-only details of the scope change (Step 1) and PM costing/schedule details (Step 2).
* **Data Flowing into the System**: The client checks the agreement box, enters their sign-off name, date, and signs on the digital signature canvas board.
