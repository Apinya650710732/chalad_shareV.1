package service

import (
	"fmt"

	"chaladshare_backend/internal/connect"
	"chaladshare_backend/internal/docfeatures/models"
	"chaladshare_backend/internal/docfeatures/repository"
)

type FeatureService interface {
	CreateQueued(documentID int) error
	MarkProcessing(documentID int) error
	SaveResult(input models.SaveResult) error
	MarkFailed(documentID int, msg string) error
	GetByDocumentID(documentID int) (*models.DocumentFeature, error)
	ProcessDocument(documentID int, pdfPath string)
}

type featureService struct {
	featureRepo repository.DocFeaturesRepo
	aiClient    *connect.Client
}

func NewFeatureService(featureRepo repository.DocFeaturesRepo, aiClient *connect.Client) FeatureService {
	return &featureService{
		featureRepo: featureRepo,
		aiClient:    aiClient,
	}
}

func (s *featureService) CreateQueued(documentID int) error {
	if documentID <= 0 {
		return fmt.Errorf("invalid documentID")
	}
	return s.featureRepo.CreateQueued(documentID)
}

func (s *featureService) MarkProcessing(documentID int) error {
	if documentID <= 0 {
		return fmt.Errorf("invalid documentID")
	}
	return s.featureRepo.MarkProcessing(documentID)
}

func (s *featureService) SaveResult(input models.SaveResult) error {
	if input.DocumentID <= 0 {
		return fmt.Errorf("invalid documentID")
	}
	return s.featureRepo.SaveResult(input)
}

func (s *featureService) MarkFailed(documentID int, msg string) error {
	if documentID <= 0 {
		return fmt.Errorf("invalid documentID")
	}
	if msg == "" {
		msg = "unknown error"
	}
	return s.featureRepo.MarkFailed(documentID, msg)
}

func (s *featureService) GetByDocumentID(documentID int) (*models.DocumentFeature, error) {
	if documentID <= 0 {
		return nil, fmt.Errorf("invalid documentID")
	}
	return s.featureRepo.GetByDocumentID(documentID)
}

func (s *featureService) ProcessDocument(documentID int, pdfPath string) {
	if s.aiClient == nil {
		_ = s.MarkFailed(documentID, "ai client is nil")
		return
	}

	if pdfPath == "" {
		_ = s.MarkFailed(documentID, "pdfPath is empty")
		return
	}

	if err := s.MarkProcessing(documentID); err != nil {
		_ = s.MarkFailed(documentID, err.Error())
		return
	}

	resp, err := s.aiClient.ExtractFeatures(documentID, pdfPath)
	if err != nil {
		_ = s.MarkFailed(documentID, err.Error())
		return
	}

	if resp.StyleLabel == nil || *resp.StyleLabel == "" {
		_ = s.MarkFailed(documentID, "missing style label ")
		return
	}

	if len(resp.StyleVectorV16) == 0 {
		_ = s.MarkFailed(documentID, "empty style_vector_v16 from ai")
		return
	}

	label := *resp.StyleLabel
	ct := resp.ContentText
	if err := s.SaveResult(models.SaveResult{
		DocumentID:       documentID,
		StyleLabel:       label,
		StyleVectorV16:   resp.StyleVectorV16,
		ContentText:      &ct,
		ContentEmbedding: resp.Embedding,
		ClusterID:        resp.ClusterID,
	}); err != nil {
		_ = s.MarkFailed(documentID, err.Error())
		return
	}
}
