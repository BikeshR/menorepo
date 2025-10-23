use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use std::fmt;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug)]
pub enum AppError {
    DatabaseError(sqlx::Error),
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    InternalError(String),
    ValidationError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::DatabaseError(e) => write!(f, "Database error: {}", e),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::BadRequest(msg) => write!(f, "Bad request: {}", msg),
            AppError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AppError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            AppError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match self {
            AppError::DatabaseError(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                e.to_string(),
            ),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", msg),
            AppError::InternalError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                msg,
            ),
            AppError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                msg,
            ),
        };

        let body = Json(ErrorResponse {
            error: error_type.to_string(),
            message,
        });

        (status, body).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        AppError::DatabaseError(err)
    }
}
