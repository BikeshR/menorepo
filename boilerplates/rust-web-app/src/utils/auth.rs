use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use super::error::{AppError, AppResult};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,    // Subject (user id)
    pub exp: i64,       // Expiration time
    pub iat: i64,       // Issued at
}

pub fn create_jwt(user_id: &str, secret: &str, expiration: i64) -> AppResult<String> {
    let now = chrono::Utc::now().timestamp();
    let claims = Claims {
        sub: user_id.to_string(),
        exp: now + expiration,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::InternalError(format!("Failed to create JWT: {}", e)))
}

pub fn verify_jwt(token: &str, secret: &str) -> AppResult<Claims> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))
}

pub fn hash_password(password: &str) -> AppResult<String> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST)
        .map_err(|e| AppError::InternalError(format!("Failed to hash password: {}", e)))
}

pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    bcrypt::verify(password, hash)
        .map_err(|e| AppError::InternalError(format!("Failed to verify password: {}", e)))
}
