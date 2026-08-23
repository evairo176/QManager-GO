package api

import (
	"encoding/json"
	"net/http"
)

type ProfileItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ICCID    string `json:"iccid,omitempty"`
	APN      string `json:"apn"`
	LTEBands string `json:"lte_bands,omitempty"`
	NRBands  string `json:"nr_bands,omitempty"`
}

// HandleProfilesList lists stored SIM profiles
func (s *Server) HandleProfilesList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	profiles := []ProfileItem{
		{ID: "default", Name: "Default Carrier Profile", APN: "internet"},
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"profiles": profiles,
	})
}

// HandleProfilesApply applies a selected profile
func (s *Server) HandleProfilesApply(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"detail":  "Profile applied successfully",
	})
}

// HandleScenariosList lists connection scenarios
func (s *Server) HandleScenariosList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"scenarios": []interface{}{},
	})
}
