package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	recservice "chaladshare_backend/internal/recommend/service"
)

type RecommendHandler struct {
	svc recservice.RecommendService
}

func NewRecommendHandler(svc recservice.RecommendService) *RecommendHandler {
	return &RecommendHandler{svc: svc}
}

// GET /api/v1/recommend?limit=3
func (h *RecommendHandler) GetRecommend(c *gin.Context) {
	uid := c.GetInt("user_id")
	if uid <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	limit := 3
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > 10 {
		limit = 10
	}

	posts, err := h.svc.RecommendForUser(uid, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"data": posts,
	})
}
