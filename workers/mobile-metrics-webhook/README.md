```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

# Database Schema Script

Run this SQL script in your Cloudflare D1 console to initialize the unique mobile telemetry tables and their optimized time-series indexes.

```sql
-- =====================================================================
-- TABLE 1: mobile_telemetry_events
-- DESCRIPTION: Captures all user behaviors, navigation paths, and 
--              application errors from Android and iOS clients.
-- USED FOR: Top Screens, Top Events, Error Events, and Live Event Stream.
-- =====================================================================

CREATE TABLE IF NOT EXISTS mobile_telemetry_events (
    -- Unique identifier for each logged event (typically a client-side generated UUID)
    id TEXT PRIMARY KEY,
    
    -- Unix timestamp in milliseconds indicating when the event occurred
    -- Used as the primary axis for time-range filtering and real-time streaming
    timestamp INTEGER NOT NULL,
    
    -- The operating system of the source device (e.g., 'Android', 'iOS')
    platform TEXT NOT NULL,
    
    -- High-level categorization of the event (e.g., 'SCREEN_VIEW', 'CUSTOM_EVENT', 'ERROR')
    event_type TEXT NOT NULL,
    
    -- Specific name of the event or view (e.g., 'BookDetailScreen', 'Click_Borrow_Button')
    event_name TEXT NOT NULL,
    
    -- Contains the stack trace or exception message when event_type is 'ERROR'. 
    -- Remains NULL for normal interaction events.
    error_message TEXT,
    
    -- Semantic version of the client application (e.g., '1.0.0') for regression tracking
    app_version TEXT NOT NULL,
    
    -- A flexible JSON string storing unstructured metadata or event-specific properties 
    -- (e.g., {"book_id": "978-3-16-148410-0", "search_query": "Kotlin"})
    attributes TEXT
);

-- INDEXES FOR TABLE 1:
-- Optimizes real-time log tailing and time-slice filtering (e.g., Last 24 Hours)
CREATE INDEX IF NOT EXISTS idx_mobile_telemetry_events_timestamp 
ON mobile_telemetry_events(timestamp);

-- Optimizes aggregation queries for dashboards (e.g., GROUP BY event_name WHERE event_type = 'SCREEN_VIEW')
CREATE INDEX IF NOT EXISTS idx_mobile_telemetry_events_type_name 
ON mobile_telemetry_events(event_type, event_name);


-- =====================================================================
-- TABLE 2: mobile_telemetry_api_metrics
-- DESCRIPTION: Monitors the performance and reliability of network requests
--              initiated by mobile clients (via OkHttp, URLSession, etc.).
-- USED FOR: API Latency trends and HTTP success rate analytics.
-- =====================================================================

CREATE TABLE IF NOT EXISTS mobile_telemetry_api_metrics (
    -- Unique identifier for each distinct HTTP request transaction
    id TEXT PRIMARY KEY,
    
    -- Unix timestamp in milliseconds marking when the HTTP response was received
    timestamp INTEGER NOT NULL,
    
    -- The operating system of the source device (e.g., 'Android', 'iOS')
    platform TEXT NOT NULL,
    
    -- Sanitized REST API endpoint path (e.g., '/api/v1/books/:id' instead of '/api/v1/books/123')
    -- Sanitization is critical to allow effective aggregation via GROUP BY
    endpoint TEXT NOT NULL,
    
    -- HTTP method utilized for the network transaction (e.g., 'GET', 'POST', 'PUT', 'DELETE')
    method TEXT NOT NULL,
    
    -- Standard HTTP response status code received from the server (e.g., 200, 401, 500)
    status_code INTEGER NOT NULL,
    
    -- Round-trip time (RTT) of the network request measured in milliseconds (ms)
    -- Crucial for computing average latencies, P95, or P99 metrics
    latency_ms INTEGER NOT NULL
);

-- INDEXES FOR TABLE 2:
-- Optimizes historical latency trend mapping across specified time windows
CREATE INDEX IF NOT EXISTS idx_mobile_telemetry_api_timestamp 
ON mobile_telemetry_api_metrics(timestamp);

-- Speeds up performance bottleneck analysis for individual endpoints
CREATE INDEX IF NOT EXISTS idx_mobile_telemetry_api_endpoint 
ON mobile_telemetry_api_metrics(endpoint);


-- =====================================================================
-- TABLE 3: incidents
-- DESCRIPTION: Tracks the lifecycle of critical system anomalies across the 
--              entire ecosystem (Infra, Mobile Clients, and GitHub CI/CD).
-- USED FOR: Portfolio Status Page (Green/Red banners) and real-time PagerDuty
--           alerting triggers.
-- =====================================================================

CREATE TABLE IF NOT EXISTS incidents (
    -- Unique token identifying each distinct incident (typically a server-side UUID)
    id TEXT PRIMARY KEY,

    -- The high-level pipeline domain throwing the alert ('INFRA', 'MOBILE', or 'GITHUB')
    source TEXT NOT NULL,

    -- The exact subsystem/component affected: e.g., 'spring-boot', 'cloudflare-d1', 'coollib-ios', 'github-ci'
    component TEXT NOT NULL,

    -- Severity classification for filtering and escalation ('WARNING', 'CRITICAL', 'FATAL')
    level TEXT NOT NULL,

    -- A concise, human-readable summary of the issue: e.g., "Spring Boot Server Unreachable"
    title TEXT NOT NULL,

    -- Detailed context or system exception output (e.g., StackTraces, raw error payloads, or GitHub run URLs)
    message TEXT,

    -- Current lifecycle state of the incident: 'active' (unresolved) or 'resolved'
    status TEXT NOT NULL DEFAULT 'active',

    -- Unix timestamp or formatted text documenting when the incident was created
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Documenting when the incident was resolved and marked green again
    resolved_at DATETIME
);

-- INDEXES FOR TABLE 3:
-- Optimizes rapid status queries on your portfolio website to check for any active incident
CREATE INDEX IF NOT EXISTS idx_incidents_status
    ON incidents(status);

-- Ensures historical timeline rendering displays the most recent incidents first
CREATE INDEX IF NOT EXISTS idx_incidents_created
    ON incidents(created_at DESC);
```