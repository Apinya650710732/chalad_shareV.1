package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	recmodels "chaladshare_backend/internal/recommend/models"
)

type RecommendRepo interface {
	GetLatestLikedSeed(userID int) (*recmodels.Seedpost, error)
	ListCandidates(userID, seedPostID int, label string, limit int) ([]recmodels.Candidatepost, error)
	ListFallback(userID int, limit int) ([]recmodels.Candidatepost, error)
}

type recommendRepo struct{ db *sql.DB }

func NewRecommendRepo(db *sql.DB) RecommendRepo { return &recommendRepo{db: db} }

func nsToStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

const qSeed = `
		SELECT
		p.post_id,
		df.style_label,
		df.style_vector_raw
		FROM likes l
		JOIN posts p
		ON p.post_id = l.like_post_id
		JOIN documents d
		ON d.document_id = p.post_document_id
		JOIN document_features df
		ON df.document_id = d.document_id
		WHERE l.like_user_id = $1
		AND df.feature_status = 'done'
		AND df.style_label IS NOT NULL
		AND df.style_vector_raw IS NOT NULL
		ORDER BY l.like_created_at DESC
		LIMIT 1;
		`

const qCandidates = `
		SELECT
		p.post_id,
		p.post_author_user_id,
		p.post_title,
		p.post_description,
		p.post_cover_url,
		p.post_visibility,
		u.username AS author_name,
		up.avatar_url AS author_img,
		COALESCE(ps.post_like_count, 0) AS like_count,
		EXISTS (
			SELECT 1 FROM likes l2
			WHERE l2.like_user_id = $1 AND l2.like_post_id = p.post_id
		) AS is_liked,
		EXISTS (
			SELECT 1 FROM saved_posts sp
			WHERE sp.save_user_id = $1 AND sp.save_post_id = p.post_id
		) AS is_saved,
		( SELECT string_agg(t.tag_name, ', ')
			FROM post_tags pt
			JOIN tags t ON t.tag_id = pt.post_tag_tag_id
			WHERE pt.post_tag_post_id = p.post_id
		) AS tags,
		df.style_vector_raw
		FROM posts p
		JOIN documents d
		ON d.document_id = p.post_document_id
		JOIN document_features df
		ON df.document_id = d.document_id
		JOIN users u
		ON u.user_id = p.post_author_user_id
		LEFT JOIN user_profiles up
		ON up.profile_user_id = u.user_id
		LEFT JOIN post_stats ps
		ON ps.post_stats_post_id = p.post_id
		WHERE df.feature_status = 'done'
		AND df.style_label = $2
		AND df.style_vector_raw IS NOT NULL
		AND p.post_id <> $3
		AND NOT EXISTS (
		SELECT 1 FROM likes l2
		WHERE l2.like_user_id = $1 AND l2.like_post_id = p.post_id
		)
		AND (
			p.post_visibility = 'public'
			OR (
			p.post_visibility = 'friends'
			AND EXISTS (
				SELECT 1 FROM friendships f
				WHERE (f.user_id = LEAST($1, p.post_author_user_id)
				AND f.friend_id = GREATEST($1, p.post_author_user_id))
			)
			)
		)
		ORDER BY p.post_created_at DESC
		LIMIT $4;
		`

const qFallback = `
		SELECT
		p.post_id,
		p.post_author_user_id,
		p.post_title,
		p.post_description,
		p.post_cover_url,
		p.post_visibility,
		u.username AS author_name,
		up.avatar_url AS author_img,
		COALESCE(ps.post_like_count, 0) AS like_count,
		EXISTS (
			SELECT 1 FROM likes l2
			WHERE l2.like_user_id = $1 AND l2.like_post_id = p.post_id
		) AS is_liked,
		EXISTS (
			SELECT 1 FROM saved_posts sp
			WHERE sp.save_user_id = $1 AND sp.save_post_id = p.post_id
		) AS is_saved,
		( SELECT string_agg(t.tag_name, ', ')
			FROM post_tags pt
			JOIN tags t ON t.tag_id = pt.post_tag_tag_id
			WHERE pt.post_tag_post_id = p.post_id
		) AS tags,
		df.style_vector_raw
		FROM posts p
		LEFT JOIN documents d
		ON d.document_id = p.post_document_id
		LEFT JOIN document_features df
		ON df.document_id = d.document_id
		JOIN users u
		ON u.user_id = p.post_author_user_id
		LEFT JOIN user_profiles up
		ON up.profile_user_id = u.user_id
		LEFT JOIN post_stats ps
		ON ps.post_stats_post_id = p.post_id
		WHERE
		-- visibility เงื่อนไขเหมือนเดิม
		(
			p.post_visibility = 'public'
			OR (
			p.post_visibility = 'friends'
			AND EXISTS (
				SELECT 1 FROM friendships f
				WHERE (f.user_id = LEAST($1, p.post_author_user_id)
				AND f.friend_id = GREATEST($1, p.post_author_user_id))
			)
			)
		)
		ORDER BY COALESCE(ps.post_like_count, 0) DESC, p.post_created_at DESC
		LIMIT $2;
		`

func (r *recommendRepo) GetLatestLikedSeed(userID int) (*recmodels.Seedpost, error) {
	var postID int
	var label string
	var raw []byte

	if err := r.db.QueryRow(qSeed, userID).Scan(&postID, &label, &raw); err != nil {
		return nil, err
	}

	var vec []float64
	if err := json.Unmarshal(raw, &vec); err != nil {
		return nil, fmt.Errorf("unmarshal seed vector: %w", err)
	}

	return &recmodels.Seedpost{PostID: postID, Label: label, Vec: vec}, nil
}

func (r *recommendRepo) ListCandidates(userID, seedPostID int, label string, limit int) ([]recmodels.Candidatepost, error) {
	type row struct {
		PostID      int
		AuthorID    int
		Title       string
		Description sql.NullString
		CoverURL    sql.NullString
		Visibility  string
		AuthorName  string
		AuthorImg   sql.NullString
		LikeCount   int
		IsLiked     bool
		IsSaved     bool
		Tags        sql.NullString
		RawVec      []byte
	}

	rows, err := r.db.Query(qCandidates, userID, label, seedPostID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]recmodels.Candidatepost, 0, 64)
	for rows.Next() {
		var rr row
		if err := rows.Scan(
			&rr.PostID, &rr.AuthorID, &rr.Title, &rr.Description, &rr.CoverURL, &rr.Visibility,
			&rr.AuthorName, &rr.AuthorImg,
			&rr.LikeCount, &rr.IsLiked, &rr.IsSaved,
			&rr.Tags,
			&rr.RawVec,
		); err != nil {
			return nil, err
		}

		var vec []float64
		if err := json.Unmarshal(rr.RawVec, &vec); err != nil {
			// ถ้า vector แปลงไม่ได้ ก็ข้าม (หรือจะ return err ก็ได้)
			continue
		}

		out = append(out, recmodels.Candidatepost{
			PostID:      rr.PostID,
			AuthorID:    rr.AuthorID,
			Title:       rr.Title,
			Description: nsToStr(rr.Description),
			CoverURL:    nsToStr(rr.CoverURL),
			Visibility:  rr.Visibility,
			AuthorName:  rr.AuthorName,
			AuthorImg:   nsToStr(rr.AuthorImg),
			Tags:        nsToStr(rr.Tags),
			LikeCount:   rr.LikeCount,
			IsLiked:     rr.IsLiked,
			IsSaved:     rr.IsSaved,
			Vec:         vec,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *recommendRepo) ListFallback(userID int, limit int) ([]recmodels.Candidatepost, error) {
	type row struct {
		PostID      int
		AuthorID    int
		Title       string
		Description sql.NullString
		CoverURL    sql.NullString
		Visibility  string
		AuthorName  string
		AuthorImg   sql.NullString
		LikeCount   int
		IsLiked     bool
		IsSaved     bool
		Tags        sql.NullString
		RawVec      []byte
	}

	rows, err := r.db.Query(qFallback, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]recmodels.Candidatepost, 0, 64)
	for rows.Next() {
		var rr row
		if err := rows.Scan(
			&rr.PostID, &rr.AuthorID, &rr.Title, &rr.Description, &rr.CoverURL, &rr.Visibility,
			&rr.AuthorName, &rr.AuthorImg,
			&rr.LikeCount, &rr.IsLiked, &rr.IsSaved,
			&rr.Tags,
			&rr.RawVec,
		); err != nil {
			return nil, err
		}

		var vec []float64
		if len(rr.RawVec) > 0 {
			_ = json.Unmarshal(rr.RawVec, &vec) // fallback: แปลงไม่ได้ก็ปล่อยเป็น nil/empty
		}

		out = append(out, recmodels.Candidatepost{
			PostID:      rr.PostID,
			AuthorID:    rr.AuthorID,
			Title:       rr.Title,
			Description: nsToStr(rr.Description),
			CoverURL:    nsToStr(rr.CoverURL),
			Visibility:  rr.Visibility,
			AuthorName:  rr.AuthorName,
			AuthorImg:   nsToStr(rr.AuthorImg),
			Tags:        nsToStr(rr.Tags),
			LikeCount:   rr.LikeCount,
			IsLiked:     rr.IsLiked,
			IsSaved:     rr.IsSaved,
			Vec:         vec,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
