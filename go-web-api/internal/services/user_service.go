package services

import (
	"errors"
	"fmt"

	"github.com/yourusername/go-web-api/internal/models"
	"github.com/yourusername/go-web-api/internal/repository"
	"github.com/yourusername/go-web-api/internal/utils"
	"gorm.io/gorm"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrUsernameAlreadyExists = errors.New("username already exists")
)

// UserService handles business logic for users
type UserService interface {
	Create(req *models.UserCreateRequest) (*models.User, error)
	GetByID(id uint) (*models.User, error)
	List(page, pageSize int) ([]models.User, int64, error)
	Update(id uint, req *models.UserUpdateRequest) (*models.User, error)
	Delete(id uint) error
}

type userService struct {
	repo repository.UserRepository
}

// NewUserService creates a new user service
func NewUserService(repo repository.UserRepository) UserService {
	return &userService{repo: repo}
}

// Create creates a new user
func (s *userService) Create(req *models.UserCreateRequest) (*models.User, error) {
	// Check if email already exists
	if _, err := s.repo.GetByEmail(req.Email); err == nil {
		return nil, ErrEmailAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check email: %w", err)
	}

	// Check if username already exists
	if _, err := s.repo.GetByUsername(req.Username); err == nil {
		return nil, ErrUsernameAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check username: %w", err)
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create user
	user := &models.User{
		Email:     req.Email,
		Username:  req.Username,
		Password:  hashedPassword,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		IsActive:  true,
	}

	if err := s.repo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// GetByID retrieves a user by ID
func (s *userService) GetByID(id uint) (*models.User, error) {
	user, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	return user, nil
}

// List retrieves a paginated list of users
func (s *userService) List(page, pageSize int) ([]models.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize
	users, total, err := s.repo.List(pageSize, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}

	return users, total, nil
}

// Update updates a user
func (s *userService) Update(id uint, req *models.UserUpdateRequest) (*models.User, error) {
	user, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Update fields if provided
	if req.Email != "" && req.Email != user.Email {
		// Check if new email already exists
		if _, err := s.repo.GetByEmail(req.Email); err == nil {
			return nil, ErrEmailAlreadyExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check email: %w", err)
		}
		user.Email = req.Email
	}

	if req.Username != "" && req.Username != user.Username {
		// Check if new username already exists
		if _, err := s.repo.GetByUsername(req.Username); err == nil {
			return nil, ErrUsernameAlreadyExists
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check username: %w", err)
		}
		user.Username = req.Username
	}

	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}

	if req.LastName != "" {
		user.LastName = req.LastName
	}

	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := s.repo.Update(user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	return user, nil
}

// Delete deletes a user
func (s *userService) Delete(id uint) error {
	// Check if user exists
	if _, err := s.repo.GetByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}
