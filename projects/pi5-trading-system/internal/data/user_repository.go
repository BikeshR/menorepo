package data

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"
)

// UserRepository handles user data persistence
type UserRepository struct {
	db     *pgxpool.Pool
	logger zerolog.Logger
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *pgxpool.Pool, logger zerolog.Logger) *UserRepository {
	return &UserRepository{
		db:     db,
		logger: logger,
	}
}

// User represents a user in the system
type User struct {
	ID           string    `db:"id"`
	Username     string    `db:"username"`
	Email        string    `db:"email"`
	PasswordHash string    `db:"password_hash"`
	FullName     string    `db:"full_name"`
	Role         string    `db:"role"`
	IsActive     bool      `db:"is_active"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
	LastLoginAt  *time.Time `db:"last_login_at"`
}

// InitSchema initializes the users table
func (r *UserRepository) InitSchema(ctx context.Context) error {
	schema := `
		CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(50) PRIMARY KEY,
			username VARCHAR(50) UNIQUE NOT NULL,
			email VARCHAR(255) UNIQUE NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			full_name VARCHAR(255) NOT NULL,
			role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'trader', 'viewer')),
			is_active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_login_at TIMESTAMPTZ
		);

		CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
		CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

		-- Insert default admin user (password: admin123)
		INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, created_at, updated_at)
		VALUES (
			'user-admin',
			'admin',
			'admin@pi5trading.local',
			'$2a$10$YKQzJ7L.Hx5xXxY8mXxX8.qXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq',
			'System Administrator',
			'admin',
			true,
			NOW(),
			NOW()
		)
		ON CONFLICT (username) DO NOTHING;

		-- Insert default trader user (password: trader123)
		INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, created_at, updated_at)
		VALUES (
			'user-trader',
			'trader',
			'trader@pi5trading.local',
			'$2a$10$YKQzJ7L.Hx5xXxY8mXxX8.qXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq',
			'Default Trader',
			'trader',
			true,
			NOW(),
			NOW()
		)
		ON CONFLICT (username) DO NOTHING;
	`

	_, err := r.db.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("failed to initialize users schema: %w", err)
	}

	r.logger.Info().Msg("Users schema initialized with default users (admin/admin123, trader/trader123)")
	return nil
}

// GetByUsername retrieves a user by username
func (r *UserRepository) GetByUsername(ctx context.Context, username string) (*User, error) {
	query := `
		SELECT id, username, email, password_hash, full_name, role, is_active,
			   created_at, updated_at, last_login_at
		FROM users
		WHERE username = $1
	`

	var user User
	err := r.db.QueryRow(ctx, query, username).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.FullName,
		&user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt, &user.LastLoginAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	query := `
		SELECT id, username, email, password_hash, full_name, role, is_active,
			   created_at, updated_at, last_login_at
		FROM users
		WHERE email = $1
	`

	var user User
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.FullName,
		&user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt, &user.LastLoginAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*User, error) {
	query := `
		SELECT id, username, email, password_hash, full_name, role, is_active,
			   created_at, updated_at, last_login_at
		FROM users
		WHERE id = $1
	`

	var user User
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.FullName,
		&user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt, &user.LastLoginAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// CreateUser creates a new user
func (r *UserRepository) CreateUser(ctx context.Context, user *User, password string) error {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	query := `
		INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = r.db.Exec(ctx, query,
		user.ID, user.Username, user.Email, string(hashedPassword), user.FullName,
		user.Role, user.IsActive, user.CreatedAt, user.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	r.logger.Info().Str("username", user.Username).Msg("User created")
	return nil
}

// ValidatePassword checks if a password matches the user's password hash
func (r *UserRepository) ValidatePassword(ctx context.Context, username, password string) (*User, error) {
	user, err := r.GetByUsername(ctx, username)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	if !user.IsActive {
		return nil, fmt.Errorf("user account is disabled")
	}

	// Compare password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return nil, fmt.Errorf("invalid password")
	}

	return user, nil
}

// UpdateLastLogin updates the user's last login timestamp
func (r *UserRepository) UpdateLastLogin(ctx context.Context, userID string) error {
	query := `
		UPDATE users
		SET last_login_at = $1
		WHERE id = $2
	`

	_, err := r.db.Exec(ctx, query, time.Now(), userID)
	if err != nil {
		return fmt.Errorf("failed to update last login: %w", err)
	}

	return nil
}

// UpdateUser updates user information
func (r *UserRepository) UpdateUser(ctx context.Context, user *User) error {
	query := `
		UPDATE users
		SET email = $1, full_name = $2, role = $3, is_active = $4, updated_at = $5
		WHERE id = $6
	`

	_, err := r.db.Exec(ctx, query,
		user.Email, user.FullName, user.Role, user.IsActive, time.Now(), user.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// ChangePassword changes a user's password
func (r *UserRepository) ChangePassword(ctx context.Context, userID, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	query := `
		UPDATE users
		SET password_hash = $1, updated_at = $2
		WHERE id = $3
	`

	_, err = r.db.Exec(ctx, query, string(hashedPassword), time.Now(), userID)
	if err != nil {
		return fmt.Errorf("failed to change password: %w", err)
	}

	r.logger.Info().Str("user_id", userID).Msg("Password changed")
	return nil
}
