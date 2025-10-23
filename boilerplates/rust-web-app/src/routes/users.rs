use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use validator::Validate;

use crate::{
    middleware::auth::AuthUser,
    models::{AuthResponse, CreateUserRequest, LoginRequest, User, UserResponse},
    utils::{
        auth::{create_jwt, hash_password, verify_password},
        error::{AppError, AppResult},
        response::ApiResponse,
    },
    AppState,
};

async fn register(
    State(state): State<AppState>,
    Json(payload): Json<CreateUserRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Check if user already exists
    let existing_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?;

    if existing_user.is_some() {
        return Err(AppError::BadRequest("User already exists".to_string()));
    }

    // Hash password
    let password_hash = hash_password(&payload.password)?;

    // Create user
    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *",
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.name)
    .fetch_one(&state.db)
    .await?;

    // Generate JWT token
    let token = create_jwt(
        &user.id.to_string(),
        &state.config.application.jwt_secret,
        state.config.application.jwt_expiration,
    )?;

    let response = AuthResponse {
        token,
        user: user.into(),
    };

    Ok(Json(ApiResponse::success(response)))
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<ApiResponse<AuthResponse>>> {
    // Validate input
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

    // Find user by email
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&payload.email)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid credentials".to_string()))?;

    // Verify password
    let valid = verify_password(&payload.password, &user.password_hash)?;
    if !valid {
        return Err(AppError::Unauthorized("Invalid credentials".to_string()));
    }

    // Generate JWT token
    let token = create_jwt(
        &user.id.to_string(),
        &state.config.application.jwt_secret,
        state.config.application.jwt_expiration,
    )?;

    let response = AuthResponse {
        token,
        user: user.into(),
    };

    Ok(Json(ApiResponse::success(response)))
}

async fn get_profile(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> AppResult<Json<ApiResponse<UserResponse>>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(&auth_user.user_id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(ApiResponse::success(user.into())))
}

pub fn api_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/users/me", get(get_profile))
}
