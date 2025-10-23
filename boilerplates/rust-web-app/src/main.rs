mod config;
mod middleware;
mod models;
mod routes;
mod utils;

use anyhow::Result;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer},
};
use tracing::Level;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Settings;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub config: Settings,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rust_web_app=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let settings = Settings::new()?;
    tracing::info!("Configuration loaded successfully");

    // Setup database connection pool
    let db_pool = PgPoolOptions::new()
        .max_connections(settings.database.max_connections)
        .connect(&settings.database_url())
        .await?;

    tracing::info!("Database connection established");

    // Run migrations
    sqlx::migrate!("./migrations").run(&db_pool).await?;
    tracing::info!("Database migrations completed");

    // Create application state
    let state = AppState {
        db: db_pool,
        config: settings.clone(),
    };

    // Build application router
    let app = Router::new()
        .nest("/api", routes::api_routes())
        .nest("/health", routes::health_routes())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(CompressionLayer::new())
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], settings.server.port));
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
