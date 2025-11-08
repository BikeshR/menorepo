package database

import (
	"database/sql"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
)

// MigrationConfig holds configuration for database migrations
type MigrationConfig struct {
	MigrationsPath string
	DatabaseName   string
}

// RunMigrations executes all pending database migrations
func RunMigrations(db *sql.DB, config MigrationConfig) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		DatabaseName: config.DatabaseName,
	})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://"+config.MigrationsPath,
		config.DatabaseName,
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}

	// Run all pending migrations
	if err := m.Up(); err != nil {
		if err == migrate.ErrNoChange {
			// No pending migrations, this is fine
			return nil
		}
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// GetMigrationVersion returns the current migration version
func GetMigrationVersion(db *sql.DB, config MigrationConfig) (uint, bool, error) {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		DatabaseName: config.DatabaseName,
	})
	if err != nil {
		return 0, false, fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://"+config.MigrationsPath,
		config.DatabaseName,
		driver,
	)
	if err != nil {
		return 0, false, fmt.Errorf("failed to create migration instance: %w", err)
	}

	version, dirty, err := m.Version()
	if err != nil {
		if err == migrate.ErrNilVersion {
			// No migrations have been run yet
			return 0, false, nil
		}
		return 0, false, fmt.Errorf("failed to get migration version: %w", err)
	}

	return version, dirty, nil
}

// RollbackMigration rolls back the last migration
func RollbackMigration(db *sql.DB, config MigrationConfig, steps int) error {
	driver, err := postgres.WithInstance(db, &postgres.Config{
		DatabaseName: config.DatabaseName,
	})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://"+config.MigrationsPath,
		config.DatabaseName,
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}

	// Roll back specified number of steps
	if err := m.Steps(-steps); err != nil {
		return fmt.Errorf("failed to rollback migration: %w", err)
	}

	return nil
}
