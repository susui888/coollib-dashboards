# CoolLib Workers

[![Live Telemetry](https://img.shields.io/badge/Live_Telemetry-Mobile-f38020)](https://ryansu.uk/analytics/mobile/)


Distributed edge telemetry and analytics platform powering the realtime observability layers of the CoolLib ecosystem.

## Ecosystem

* CoolLib Android — Jetpack Compose Client
* CoolLib iOS — SwiftUI & SwiftData Client
* CoolLib Server — Spring Boot Backend Platform

## Workers

* business-dash — Business telemetry aggregation dashboard
* system-dash — Infrastructure observability dashboard
* business-system-svg — Dynamic SVG telemetry renderer
* github-metrics-svg — GitHub telemetry SVG generation endpoint

## Infrastructure Stack

* Cloudflare Workers
* Cloudflare D1
* TypeScript
* Native SVG Rendering
* Chart.js
* Edge Cache API

## Architecture Highlights

* Layered Worker architecture optimized for maintainability
* Edge-native rendering with aggressive CDN caching
* Low-overhead telemetry delivery through lightweight SVG pipelines
* Distributed analytics aggregation using Cloudflare D1
* Realtime infrastructure observability with minimal runtime footprint

## System Incidents Architecture 

```mermaid
flowchart LR

            subgraph Sources ["`**Sources**`"]
            Spring("Spring\nActuator")
            GitHub("GitHub\nCI/CD")
            GQL("Cloudflare\nGraphQL")
            end

            subgraph Processing ["`**Worker & Unified Pipeline**`"]
            MC("Telemetry\nRouter")
            Eval{"Metric\nEvaluation"}
            Active("Active\nBranch")
            Recover("Recover\nBranch")
            end

            subgraph Outbound ["`**Alerts & Dashboards**`"]
            D1[("D1\nMetrics")]
            PD("PagerDuty\nGateway")
            Astro("Live\nDashboard")
            end

            %% ==========================================
            %% DATA INGESTION INTO CENTRAL WORKER ROUTER
            %% ==========================================
            Spring -->|"Health Check"| MC
            GitHub -->|"Pipeline Hooks"| MC
            GQL -->|"Quota Usage"| MC

            %% ==========================================
            %% UNIFIED FLOW EVALUATION
            %% ==========================================
            MC --> Eval

            %% Consolidated Dynamic Routing Paths
            Eval -->|"Incidents"| Active
            Eval -->|"Nominal"| Recover

            %% ==========================================
            %% DOWNSTREAM SINKS & PERSISTENCE
            %% ==========================================
            %% State Transitions
            Active -->|"Active"| D1
            Active -->|"Trigger"| PD

            Recover -->|"Resolve"| D1
            Recover -->|"Resolve"| PD

            %% Presentation
            D1 -->|"Read Status"| Astro



            %% ==========================================
            %% STYLE CUSTOMIZATIONS
            %% ==========================================
            style Spring fill:#64748b,stroke:#475569,stroke-width:2px,color:#ffffff
            style GitHub fill:#64748b,stroke:#475569,stroke-width:2px,color:#ffffff
            style GQL fill:#64748b,stroke:#475569,stroke-width:2px,color:#ffffff

            style MC fill:#155e75,stroke:#164e63,stroke-width:2px,color:#ffffff
            style Eval fill:#155e75,stroke:#164e63,stroke-width:2px,color:#ffffff

            style Active fill:#ff9999,stroke:#dc2626,stroke-width:2px,color:#7f1d1d
            style Recover fill:#99ff99,stroke:#16a34a,stroke-width:2px,color:#14532d

            style D1 fill:#0e7490,stroke:#155e75,stroke-width:2px,color:#ffffff
            style PD fill:#166534,stroke:#14532d,stroke-width:2px,color:#ffffff
            style Astro fill:#166534,stroke:#14532d,stroke-width:2px,color:#ffffff

            style Sources fill:none,stroke:#94a3b8,stroke-dasharray: 5 5
            style Processing fill:none,stroke:#94a3b8,stroke-dasharray: 5 5
            style Outbound fill:none,stroke:#94a3b8,stroke-dasharray: 5 5

            linkStyle default stroke:#94a3b8,stroke-width:1.5px
