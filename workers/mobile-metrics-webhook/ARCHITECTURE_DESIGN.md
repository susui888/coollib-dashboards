# Mobile Telemetry & Analytics System Architecture Design

This document specifies the decoupled, event-driven architecture designed to capture mobile application behaviors (`events`) and network performance diagnostics (`metrics`). The architecture bridges native client eco-systems (**iOS SwiftUI/SwiftData** and **Android Jetpack Compose/Room**) with a scalable, cloud-native storage pipeline on **Cloudflare Infrastructure**.

---

## 1. System Topology (CQRS Pattern)

The system leverages a strict separation of concerns between high-frequency ingestion (Command) and low-latency aggregate querying (Query).

```
[ Mobile Clients ]
  │  (iOS / Android)
  ├─► POST /api/mobile-telemetry/events   (Single JSON payload)
  └─► POST /api/mobile-telemetry/metrics  (Single JSON payload)
        │
        ▼
 [ Cloudflare Worker: Producer Mode ] 
  │  (Authenticates, standardizes payloads)
  │  (Instantly responds with HTTP 202 Accepted)
  │
  ▼  [.send()]
 [ Cloudflare Queues: telemetry-queue ] 
  │  (Acts as a write-smoothing buffer/absorber)
  │  (Micro-batches logs based on size: 10 OR timeout: 5s)
  │
  ▼  [Invokes exported queue()]
 [ Cloudflare Worker: Consumer Mode ]
  │  (Unwraps batch, maps payload tags to target SQL contexts)
  │
  ▼  [env.DB.batch(statements)]
 [ Cloudflare D1 Database (SQLite) ] ◄─── (Direct Read SQL) ─── [ Dashboard Analytics API ]

```

---

## 2. Storage Schema (Cloudflare D1)

Execute the following migrations to initialize the target relational tables in your D1 SQLite database.

```sql
-- Table 1: Lifecycle, UI interactions, and captured operational exceptions
CREATE TABLE IF NOT EXISTS mobile_telemetry_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    platform TEXT NOT NULL,
    event_type TEXT NOT NULL, -- SCREEN_VIEW, CUSTOM_EVENT, ERROR
    event_name TEXT NOT NULL,
    app_version TEXT NOT NULL,
    error_message TEXT,       -- Populated only if event_type = 'ERROR'
    attributes TEXT           -- Stringified JSON map for context metadata
);

-- Table 2: Network latency telemetry and endpoint reliability telemetry
CREATE TABLE IF NOT EXISTS mobile_telemetry_api_metrics (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    platform TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL
);

-- Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON mobile_telemetry_events(event_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_endpoint_timestamp ON mobile_telemetry_api_metrics(endpoint, timestamp);

```

---

## 3. Data Transfer Objects & Contracts (Wire Protocol)

Every payload directed to the ingestion endpoints travels as a single JSON object marked by an explicit metadata wrapper to optimize routing inside the shared queue channel.

### 3.1 Single Event Ingestion Contract

* **Endpoint:** `POST /api/mobile-telemetry/events`
* **Network Status Code:** `202 Accepted`

```json
{
  "id": "E621E1F8-C36C-495A-93FC-0C247A3E6E5F",
  "timestamp": 1780947030000,
  "platform": "iOS",
  "eventType": "SCREEN_VIEW",
  "eventName": "BookDetailView",
  "appVersion": "1.0.0",
  "errorMessage": null,
  "attributes": {
    "book_id": "978-0-19-852663-6",
    "referrer_source": "HomeFeed"
  }
}

```

### 3.2 Single API Metric Ingestion Contract

* **Endpoint:** `POST /api/mobile-telemetry/metrics`
* **Network Status Code:** `202 Accepted`

```json
{
  "id": "A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D",
  "timestamp": 1780947031500,
  "platform": "iOS",
  "endpoint": "/api/v1/books/search",
  "method": "GET",
  "statusCode": 200,
  "latencyMs": 142
}

```

---

## 4. Cross-Platform Client Mapping Matrix

To maintain decoupled layers compliant with **Clean Architecture**, use the following platform-specific primitives when building your tracking repositories.

### 4.1 Telemetry Classification Matrix

| Event Type (`eventType`) | Target Domain Scenario | Recommended Structural Attributes (`attributes`) |
| --- | --- | --- |
| **`SCREEN_VIEW`** | UI View initialization | `referrer_source` (Previous Screen), `target_id` (Domain entity primary key) |
| **`CUSTOM_EVENT`** | Specific interactive user milestones | `ui_position` (Top/Bottom/Context-Menu), `user_role` (Guest/Premium) |
| **`ERROR`** | Caught structural exceptions / core flow failures | `connection_type` (WiFi/5G/Offline), `disk_space_available_mb` |

### 4.2 UI Trigger Declarations

#### Apple SwiftUI Implementation

```swift
// Applied as a clean View Modifier via extension
struct TrackScreenModifier: ViewModifier {
    let name: String
    let attributes: [String: String]?
    
    func body(content: Content) -> some View {
        content.onAppear {
            TelemetryRepository.shared.enqueueEvent(.screenView, name: name, attributes: attributes)
        }
    }
}

```

#### Android Jetpack Compose Implementation

```kotlin
// Embedded cleanly into Composable runtime lifecycles
@Composable
fun TrackScreen(screenName: String, attributes: Map<String, String>? = null) {
    DisposableEffect(screenName) {
        telemetryRepository.enqueueEvent(eventType = "SCREEN_VIEW", name = screenName, attributes = attributes)
        onDispose { }
    }
}

```

---

## 5. Cloud-Native Routing Infrastructure Configuration

The system is declared via standard Cloudflare infrastructure configuration using the unified `wrangler.jsonc` manifest blueprint.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "mobile-metrics-webhook",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-08",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "coollib"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "TELEMETRY_QUEUE",
        "queue": "telemetry-queue"
      }
    ],
    "consumers": [
      {
        "queue": "telemetry-queue",
        "max_batch_size": 10,       // Triggers batch flush when 10 messages accumulate
        "max_batch_timeout": 5      // Guarantees maximum ingestion latency bounds of 5 seconds
      }
    ]
  }
}

```

---

## 6. Codebase File Hierarchy Mapping

```text
src/
├── index.ts                   # Gateway controller: Routes HTTP to Hono; maps queue signals to background consumer
├── types.ts                   # Strongly typed application binding contexts
├── routes/
│   ├── telemetry.ts           # Producer API tier: Validates and streams tags to c.env.TELEMETRY_QUEUE
│   └── dashboard.ts           # Read Analytics tier: Aggregates direct analytical insight arrays straight from D1
└── queue/
    └── telemetryConsumer.ts   # Consumer Transaction tier: Iterates micro-batches and maps statements to atomic D1 batches

```