use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use uuid::Uuid;

use crate::utils::{auth::verify_jwt, error::AppError};

pub struct AuthUser {
    pub user_id: Uuid,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract the authorization header
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".to_string()))?;

        // Extract the token from "Bearer <token>"
        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid authorization format".to_string()))?;

        // Get JWT secret from environment
        let jwt_secret =
            std::env::var("APP__APPLICATION__JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

        // Verify the token
        let claims = verify_jwt(token, &jwt_secret)?;

        // Parse user ID from claims
        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| AppError::Unauthorized("Invalid user ID in token".to_string()))?;

        Ok(AuthUser { user_id })
    }
}
