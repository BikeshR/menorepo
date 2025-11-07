package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/rs/zerolog"

	"github.com/bikeshrana/pi5-trading-system-go/internal/auth"
	"github.com/bikeshrana/pi5-trading-system-go/internal/data"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	userRepo   *data.UserRepository
	jwtService *auth.JWTService
	logger     zerolog.Logger
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(userRepo *data.UserRepository, jwtService *auth.JWTService, logger zerolog.Logger) *AuthHandler {
	return &AuthHandler{
		userRepo:   userRepo,
		jwtService: jwtService,
		logger:     logger,
	}
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	TokenType    string   `json:"token_type"`
	ExpiresIn    int64    `json:"expires_in"`
	User         UserInfo `json:"user"`
}

// UserInfo represents basic user information
type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

// Login handles user login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Username and password required")
		return
	}

	// Validate credentials
	user, err := h.userRepo.ValidatePassword(r.Context(), req.Username, req.Password)
	if err != nil {
		h.logger.Warn().Str("username", req.Username).Msg("Failed login attempt")
		writeError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Generate JWT tokens
	tokenPair, err := h.jwtService.GenerateTokenPair(r.Context(), user.ID, user.Username, user.Email, user.Role)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to generate tokens")
		writeError(w, http.StatusInternalServerError, "Failed to generate authentication tokens")
		return
	}

	// Update last login
	if err := h.userRepo.UpdateLastLogin(r.Context(), user.ID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to update last login")
	}

	h.logger.Info().Str("username", user.Username).Str("role", user.Role).Msg("User logged in")

	// Return response
	response := LoginResponse{
		AccessToken:  tokenPair.AccessToken,
		RefreshToken: tokenPair.RefreshToken,
		TokenType:    tokenPair.TokenType,
		ExpiresIn:    tokenPair.ExpiresIn,
		User: UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			FullName: user.FullName,
			Role:     user.Role,
		},
	}

	writeJSON(w, http.StatusOK, response)
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// In a more sophisticated system, you would:
	// 1. Invalidate the refresh token in a blacklist/database
	// 2. Clear any server-side sessions

	// Get user from context (if authenticated)
	claims := auth.GetUserFromContext(r.Context())
	if claims != nil {
		h.logger.Info().Str("username", claims.Username).Msg("User logged out")
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

// GetCurrentUser returns the current user info
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUserFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	// Get full user data from database
	user, err := h.userRepo.GetByID(r.Context(), claims.UserID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", claims.UserID).Msg("Failed to get user")
		writeError(w, http.StatusInternalServerError, "Failed to retrieve user information")
		return
	}

	userInfo := UserInfo{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		FullName: user.FullName,
		Role:     user.Role,
	}

	writeJSON(w, http.StatusOK, userInfo)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	refreshToken, ok := req["refresh_token"]
	if !ok || refreshToken == "" {
		writeError(w, http.StatusBadRequest, "Refresh token required")
		return
	}

	// Generate new token pair
	tokenPair, err := h.jwtService.RefreshAccessToken(r.Context(), refreshToken)
	if err != nil {
		h.logger.Warn().Err(err).Msg("Failed to refresh token")
		writeError(w, http.StatusUnauthorized, "Invalid or expired refresh token")
		return
	}

	writeJSON(w, http.StatusOK, tokenPair)
}
