# CoolLib Workers &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[![Live Telemetry](https://img.shields.io/badge/Live_Telemetry-Workers-f38020)](https://ryansu.uk/analytics/)
<p>
<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6"/>&nbsp;
<img src="https://img.shields.io/badge/Cloudflare-Workers-F38020"/>&nbsp;
<img src="https://img.shields.io/badge/D1-Distributed_SQL-f5a623"/>&nbsp;
<img src="https://img.shields.io/badge/Native-SVG-0f172a"/>&nbsp;
</p>

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

## Repository Structure

```text
workers/
├── github-metrics-webhook/
├── mobile-metrics-webhook/
├── business-system-svg/
├── github-metrics-svg/
├── telemetry-core/
└── metrics-collector/
