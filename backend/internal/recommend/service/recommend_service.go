package service

import (
	"database/sql"
	"errors"
	"math"
	"sort"

	recmodels "chaladshare_backend/internal/recommend/models"
	recrepo "chaladshare_backend/internal/recommend/repository"
)

type RecommendService interface {
	RecommendForUser(userID int, limit int) ([]recmodels.Candidatepost, error)
}

type recommendService struct {
	repo recrepo.RecommendRepo
}

func NewRecommendService(repo recrepo.RecommendRepo) RecommendService {
	return &recommendService{repo: repo}
}

func (s *recommendService) RecommendForUser(userID int, limit int) ([]recmodels.Candidatepost, error) {
	if userID <= 0 {
		return nil, errors.New("invalid userid")
	}
	if limit <= 0 {
		limit = 10
	}

	seed, err := s.repo.GetLatestLikedSeed(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return []recmodels.Candidatepost{}, nil
		}
		return nil, err
	}

	candidates, err := s.repo.ListCandidates(userID, seed.PostID, seed.Label, limit*10)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return s.repo.ListFallback(userID, limit)
	}

	// คำนวณ similarity + sort
	type scored struct {
		p     recmodels.Candidatepost
		score float64
	}
	scoredList := make([]scored, 0, len(candidates))

	for _, c := range candidates {
		if len(seed.Vec) == 0 || len(c.Vec) == 0 {
			continue
		}
		score := cosineSim(seed.Vec, c.Vec)
		scoredList = append(scoredList, scored{p: c, score: score})
	}

	// sort score มาก -> น้อย
	sort.Slice(scoredList, func(i, j int) bool {
		return scoredList[i].score > scoredList[j].score
	})

	// ตัดเอา top limit
	out := make([]recmodels.Candidatepost, 0, limit)
	seen := map[int]bool{}

	for _, it := range scoredList {
		if len(out) >= limit {
			break
		}
		if seen[it.p.PostID] {
			continue
		}
		seen[it.p.PostID] = true
		out = append(out, it.p)
	}

	if len(out) < limit {
		fb, err := s.repo.ListFallback(userID, limit*2)
		if err == nil {
			for _, p := range fb {
				if len(out) >= limit {
					break
				}
				if seen[p.PostID] {
					continue
				}
				seen[p.PostID] = true
				out = append(out, p)
			}
		}
	}

	return out, nil
}

// ===== cosine similarity =====
func cosineSim(a, b []float64) float64 {
	n := min(len(a), len(b))
	if n == 0 {
		return 0
	}

	var dot, na, nb float64
	for i := 0; i < n; i++ {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}

	den := math.Sqrt(na) * math.Sqrt(nb)
	if den == 0 {
		return 0
	}
	return dot / den
}

func min(x, y int) int {
	if x < y {
		return x
	}
	return y
}
