"""
Custom exceptions for the application.
"""


class AppException(Exception):
    """Base application exception."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundException(AppException):
    """Resource not found exception."""

    def __init__(self, message: str = "Resource not found") -> None:
        super().__init__(message, status_code=404)


class UnauthorizedException(AppException):
    """Unauthorized access exception."""

    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=401)


class ForbiddenException(AppException):
    """Forbidden access exception."""

    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, status_code=403)


class BadRequestException(AppException):
    """Bad request exception."""

    def __init__(self, message: str = "Bad request") -> None:
        super().__init__(message, status_code=400)


class ConflictException(AppException):
    """Conflict exception (e.g., duplicate resource)."""

    def __init__(self, message: str = "Resource already exists") -> None:
        super().__init__(message, status_code=409)


class ValidationException(AppException):
    """Validation error exception."""

    def __init__(self, message: str = "Validation error") -> None:
        super().__init__(message, status_code=422)
