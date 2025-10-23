package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/yourusername/go-web-api/internal/models"
	"github.com/yourusername/go-web-api/internal/services"
	"github.com/yourusername/go-web-api/pkg/response"

	"github.com/gin-gonic/gin"
)

// UserHandler handles HTTP requests for users
type UserHandler struct {
	service services.UserService
}

// NewUserHandler creates a new user handler
func NewUserHandler(service services.UserService) *UserHandler {
	return &UserHandler{service: service}
}

// Create godoc
// @Summary Create a new user
// @Description Create a new user with the provided information
// @Tags users
// @Accept json
// @Produce json
// @Param user body models.UserCreateRequest true "User creation request"
// @Success 201 {object} response.Response{data=models.UserResponse}
// @Failure 400 {object} response.Response
// @Failure 409 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /users [post]
func (h *UserHandler) Create(c *gin.Context) {
	var req models.UserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	user, err := h.service.Create(&req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrEmailAlreadyExists):
			response.Error(c, http.StatusConflict, "Email already exists", err)
		case errors.Is(err, services.ErrUsernameAlreadyExists):
			response.Error(c, http.StatusConflict, "Username already exists", err)
		default:
			response.Error(c, http.StatusInternalServerError, "Failed to create user", err)
		}
		return
	}

	response.Success(c, http.StatusCreated, "User created successfully", user.ToResponse())
}

// GetByID godoc
// @Summary Get a user by ID
// @Description Get a single user by their ID
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} response.Response{data=models.UserResponse}
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /users/{id} [get]
func (h *UserHandler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	user, err := h.service.GetByID(uint(id))
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			response.Error(c, http.StatusNotFound, "User not found", err)
		} else {
			response.Error(c, http.StatusInternalServerError, "Failed to get user", err)
		}
		return
	}

	response.Success(c, http.StatusOK, "User retrieved successfully", user.ToResponse())
}

// List godoc
// @Summary List all users
// @Description Get a paginated list of all users
// @Tags users
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param page_size query int false "Number of items per page" default(10)
// @Success 200 {object} response.PaginatedResponse{data=[]models.UserResponse}
// @Failure 500 {object} response.Response
// @Router /users [get]
func (h *UserHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	users, total, err := h.service.List(page, pageSize)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to list users", err)
		return
	}

	// Convert to response format
	userResponses := make([]models.UserResponse, len(users))
	for i, user := range users {
		userResponses[i] = *user.ToResponse()
	}

	response.Paginated(c, http.StatusOK, "Users retrieved successfully", userResponses, page, pageSize, int(total))
}

// Update godoc
// @Summary Update a user
// @Description Update user information
// @Tags users
// @Accept json
// @Produce json
// @Param id path int true "User ID"
// @Param user body models.UserUpdateRequest true "User update request"
// @Success 200 {object} response.Response{data=models.UserResponse}
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 409 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /users/{id} [put]
func (h *UserHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	var req models.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	user, err := h.service.Update(uint(id), &req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrUserNotFound):
			response.Error(c, http.StatusNotFound, "User not found", err)
		case errors.Is(err, services.ErrEmailAlreadyExists):
			response.Error(c, http.StatusConflict, "Email already exists", err)
		case errors.Is(err, services.ErrUsernameAlreadyExists):
			response.Error(c, http.StatusConflict, "Username already exists", err)
		default:
			response.Error(c, http.StatusInternalServerError, "Failed to update user", err)
		}
		return
	}

	response.Success(c, http.StatusOK, "User updated successfully", user.ToResponse())
}

// Delete godoc
// @Summary Delete a user
// @Description Soft delete a user
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 404 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /users/{id} [delete]
func (h *UserHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	if err := h.service.Delete(uint(id)); err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			response.Error(c, http.StatusNotFound, "User not found", err)
		} else {
			response.Error(c, http.StatusInternalServerError, "Failed to delete user", err)
		}
		return
	}

	response.Success(c, http.StatusOK, "User deleted successfully", nil)
}

// GetProfile godoc
// @Summary Get current user profile
// @Description Get the profile of the currently authenticated user
// @Tags users
// @Security BearerAuth
// @Produce json
// @Success 200 {object} response.Response{data=models.UserResponse}
// @Failure 401 {object} response.Response
// @Router /protected/profile [get]
func (h *UserHandler) GetProfile(c *gin.Context) {
	// This would typically get user ID from JWT claims
	// For now, it's a placeholder
	userID := c.GetUint("user_id")

	user, err := h.service.GetByID(userID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to get profile", err)
		return
	}

	response.Success(c, http.StatusOK, "Profile retrieved successfully", user.ToResponse())
}
