package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// AuthHandler handles authentication requests
type AuthHandler struct {
	logger zerolog.Logger
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(logger zerolog.Logger) *AuthHandler {
	return &AuthHandler{
		logger: logger,
	}
}

// LoginRequest represents the login request body
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	User         UserInfo  `json:"user"`
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

	// TODO: Implement actual authentication
	// For now, accept any credentials for development
	if req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Username and password required")
		return
	}

	// Mock authentication - replace with actual auth logic
	response := LoginResponse{
		AccessToken:  "mock_access_token_" + time.Now().Format("20060102150405"),
		RefreshToken: "mock_refresh_token_" + time.Now().Format("20060102150405"),
		TokenType:    "Bearer",
		User: UserInfo{
			ID:       "1",
			Username: req.Username,
			Email:    req.Username + "@example.com",
			FullName: "Trading User",
			Role:     "trader",
		},
	}

	writeJSON(w, http.StatusOK, response)
}

// Logout handles user logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement token invalidation
	writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

// GetCurrentUser returns the current user info
func (h *AuthHandler) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	// TODO: Extract user from token
	// For now, return mock user
	user := UserInfo{
		ID:       "1",
		Username: "trader",
		Email:    "trader@example.com",
		FullName: "Trading User",
		Role:     "trader",
	}

	writeJSON(w, http.StatusOK, user)
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// TODO: Implement actual token refresh
	response := map[string]string{
		"access_token":  "new_mock_access_token_" + time.Now().Format("20060102150405"),
		"refresh_token": "new_mock_refresh_token_" + time.Now().Format("20060102150405"),
		"token_type":    "Bearer",
	}

	writeJSON(w, http.StatusOK, response)
}
