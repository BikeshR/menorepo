package main

import (
	"log"
	"os"

	"github.com/yourusername/go-web-api/internal/config"
	"github.com/yourusername/go-web-api/internal/database"
	"github.com/yourusername/go-web-api/internal/handlers"
	"github.com/yourusername/go-web-api/internal/middleware"
	"github.com/yourusername/go-web-api/internal/repository"
	"github.com/yourusername/go-web-api/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// @title Go Web API
// @version 1.0
// @description A modern Go web API boilerplate with Gin framework
// @contact.name API Support
// @contact.email support@example.com
// @license.name MIT
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.
func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize logger
	logger := config.InitLogger(cfg)

	// Initialize database
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		logger.Fatal().Err(err).Msg("Failed to connect to database")
	}

	// Auto-migrate database models
	if err := database.AutoMigrate(db); err != nil {
		logger.Fatal().Err(err).Msg("Failed to migrate database")
	}

	// Initialize repositories
	userRepo := repository.NewUserRepository(db)

	// Initialize services
	userService := services.NewUserService(userRepo)

	// Initialize handlers
	userHandler := handlers.NewUserHandler(userService)
	healthHandler := handlers.NewHealthHandler(db)

	// Setup Gin mode
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Global middleware
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS(cfg))

	// Health check endpoint
	router.GET("/health", healthHandler.Check)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// User routes
		users := v1.Group("/users")
		{
			users.GET("", userHandler.List)
			users.GET("/:id", userHandler.GetByID)
			users.POST("", userHandler.Create)
			users.PUT("/:id", userHandler.Update)
			users.DELETE("/:id", userHandler.Delete)
		}

		// Example protected routes
		protected := v1.Group("/protected")
		protected.Use(middleware.Auth(cfg))
		{
			protected.GET("/profile", userHandler.GetProfile)
		}
	}

	// Start server
	addr := ":" + cfg.AppPort
	logger.Info().Msgf("Starting server on %s", addr)
	if err := router.Run(addr); err != nil {
		logger.Fatal().Err(err).Msg("Failed to start server")
	}
}
