use config::{Config, ConfigError, Environment, File};
use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct Settings {
    pub server: ServerSettings,
    pub database: DatabaseSettings,
    pub application: ApplicationSettings,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerSettings {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseSettings {
    pub url: String,
    pub max_connections: u32,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ApplicationSettings {
    pub jwt_secret: String,
    pub jwt_expiration: i64,
    pub environment: String,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        let run_mode = std::env::var("RUN_MODE").unwrap_or_else(|_| "development".into());

        let s = Config::builder()
            // Start with default values
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 8080)?
            .set_default("database.max_connections", 5)?
            .set_default("application.jwt_expiration", 3600)?
            .set_default("application.environment", "development")?
            // Load configuration from file (if exists)
            .add_source(File::with_name("config/default").required(false))
            .add_source(File::with_name(&format!("config/{}", run_mode)).required(false))
            // Override with environment variables
            .add_source(Environment::with_prefix("APP").separator("__"))
            .build()?;

        s.try_deserialize()
    }

    pub fn database_url(&self) -> String {
        self.database.url.clone()
    }
}
