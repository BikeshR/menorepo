use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

#[derive(Serialize)]
struct ReadinessResponse {
    status: String,
    database: String,
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn readiness_check(State(state): State<AppState>) -> Json<ReadinessResponse> {
    let db_status = match sqlx::query("SELECT 1").fetch_one(&state.db).await {
        Ok(_) => "connected",
        Err(_) => "disconnected",
    };

    Json(ReadinessResponse {
        status: "ready".to_string(),
        database: db_status.to_string(),
    })
}

pub fn health_routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check))
        .route("/ready", get(readiness_check))
}
