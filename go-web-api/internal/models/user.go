package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	Email     string         `json:"email" gorm:"uniqueIndex;not null"`
	Username  string         `json:"username" gorm:"uniqueIndex;not null"`
	Password  string         `json:"-" gorm:"not null"` // Never expose password in JSON
	FirstName string         `json:"first_name"`
	LastName  string         `json:"last_name"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"` // Soft delete
}

// UserCreateRequest represents the request body for creating a user
type UserCreateRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Username  string `json:"username" binding:"required,min=3,max=50"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name" binding:"omitempty,max=100"`
	LastName  string `json:"last_name" binding:"omitempty,max=100"`
}

// UserUpdateRequest represents the request body for updating a user
type UserUpdateRequest struct {
	Email     string `json:"email" binding:"omitempty,email"`
	Username  string `json:"username" binding:"omitempty,min=3,max=50"`
	FirstName string `json:"first_name" binding:"omitempty,max=100"`
	LastName  string `json:"last_name" binding:"omitempty,max=100"`
	IsActive  *bool  `json:"is_active" binding:"omitempty"`
}

// UserResponse represents the response for a user (without sensitive data)
type UserResponse struct {
	ID        uint      `json:"id"`
	Email     string    `json:"email"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToResponse converts a User model to UserResponse
func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:        u.ID,
		Email:     u.Email,
		Username:  u.Username,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		IsActive:  u.IsActive,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}
