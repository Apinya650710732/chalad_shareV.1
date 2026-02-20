package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"chaladshare_backend/internal/docfeatures/models"

	"github.com/pgvector/pgvector-go"
)

type DocFeaturesRepo interface {
	CreateQueued(documentID int) error
	MarkProcessing(documentID int) error
	SaveResult(input models.SaveResult) error
	MarkFailed(documentID int, msg string) error
	GetByDocumentID(documentID int) (*models.DocumentFeature, error)
}

type FeatureRepo struct {
	db *sql.DB
}

func NewFeatureRepo(db *sql.DB) DocFeaturesRepo {
	return &FeatureRepo{db: db}
}

func (r *FeatureRepo) CreateQueued(documentID int) error {
	q := `
		INSERT INTO document_features (document_id, feature_status)
		VALUES ($1, $2)
		ON CONFLICT (document_id) DO NOTHING;
	`
	_, err := r.db.Exec(q, documentID, models.FeatureQueued)
	return err
}

func (r *FeatureRepo) MarkProcessing(documentID int) error {
	q := `
		UPDATE document_features
		SET feature_status = $2, error_message = NULL
		WHERE document_id = $1;
	`
	_, err := r.db.Exec(q, documentID, models.FeatureProcessing)
	return err
}

func f64ToF32(a []float64) []float32 {
	out := make([]float32, len(a))
	for i, v := range a {
		out[i] = float32(v)
	}
	return out
}

func (r *FeatureRepo) SaveResult(input models.SaveResult) error {
	if len(input.StyleVectorV16) == 0 {
		return fmt.Errorf("empty style vector (len=0)")
	}

	vecJSON, err := json.Marshal(input.StyleVectorV16)
	if err != nil {
		return fmt.Errorf("marshal style vector: %w", err)
	}

	sv16 := pgvector.NewVector(f64ToF32(input.StyleVectorV16))

	var emb any = nil
	if len(input.ContentEmbedding) > 0 {
		emb = pgvector.NewVector(f64ToF32(input.ContentEmbedding))
	}

	q := `
		UPDATE document_features
		SET feature_status    = $2,
		    style_label       = $3,
		    style_vector_v16  = $4,
		    style_vector_raw  = $5::jsonb,
		    content_text      = $6,
		    content_embedding = $7,
		    cluster_id        = COALESCE($8, cluster_id),
		    error_message     = NULL
		WHERE document_id = $1;
	`
	_, err = r.db.Exec(q,
		input.DocumentID,
		models.FeatureDone,
		input.StyleLabel,
		sv16,
		vecJSON,
		input.ContentText,
		emb,
		input.ClusterID,
	)
	return err
}

func (r *FeatureRepo) MarkFailed(documentID int, msg string) error {
	q := `
		UPDATE document_features
		SET feature_status = $2, error_message = $3
		WHERE document_id = $1;
	`
	_, err := r.db.Exec(q, documentID, models.FeatureFailed, msg)
	return err
}

func (r *FeatureRepo) GetByDocumentID(documentID int) (*models.DocumentFeature, error) {
	q := `
		SELECT document_id, feature_status, style_label, style_vector_raw, cluster_id,
		       error_message, created_at, updated_at
		FROM document_features
		WHERE document_id = $1;
	`

	var out models.DocumentFeature
	err := r.db.QueryRow(q, documentID).Scan(
		&out.DocumentID,
		&out.FeatureStatus,
		&out.StyleLabel,
		&out.StyleVector,
		&out.ClusterID,
		&out.ErrorMessage,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}
