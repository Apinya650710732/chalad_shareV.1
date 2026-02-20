// internal/users/service/service.go
package service

import (
	"context"
	"errors"
	"unicode/utf8"

	"chaladshare_backend/internal/users/models"
	"chaladshare_backend/internal/users/repository"
)

type UserService interface {
	GetOwnProfile(ctx context.Context, userID int) (*models.OwnProfileResponse, error)
	GetViewedUserProfile(ctx context.Context, userID int) (*models.ViewedUserProfileResponse, error)
	UpdateOwnProfile(ctx context.Context, userID int, req *models.UpdateOwnProfileRequest) error
}

type userService struct {
	repo repository.UserRepository
}

func NewUserService(r repository.UserRepository) UserService {
	return &userService{repo: r}
}

func (s *userService) GetOwnProfile(ctx context.Context, userID int) (*models.OwnProfileResponse, error) {
	return s.repo.GetOwnProfile(ctx, userID)
}

func (s *userService) GetViewedUserProfile(ctx context.Context, userID int) (*models.ViewedUserProfileResponse, error) {
	return s.repo.GetViewedUserProfile(ctx, userID)
}

func (s *userService) UpdateOwnProfile(ctx context.Context, userID int, req *models.UpdateOwnProfileRequest) error {
	if req == nil || (req.Username == nil && req.AvatarURL == nil && req.AvatarStore == nil && req.Bio == nil) {
		return errors.New("no fields to update")
	}

	if req.Username != nil {
		l := utf8.RuneCountInString(*req.Username)
		if l < 3 || l > 50 {
			return errors.New("username must be 3–50 characters")
		}
	}
	if req.Bio != nil {
		if utf8.RuneCountInString(*req.Bio) > 150 {
			return errors.New("bio must be at most 150 characters")
		}
	}
	return s.repo.UpdateOwnProfile(ctx, userID, req)
}
