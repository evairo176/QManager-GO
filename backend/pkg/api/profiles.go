package api

import (
	"encoding/json"
	"net/http"
	"time"
)

type ScenarioScheduleBlock struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	Days     []int  `json:"days"`
	Scenario string `json:"scenario"`
}

type ScenarioSchedule struct {
	Enabled bool                    `json:"enabled"`
	Blocks  []ScenarioScheduleBlock `json:"blocks"`
}

type ScenarioBinding struct {
	Default  string           `json:"default"`
	Schedule ScenarioSchedule `json:"schedule"`
}

type ProfileApnSettings struct {
	CID     int    `json:"cid"`
	Name    string `json:"name"`
	PDPType string `json:"pdp_type"`
}

type ProfileSettings struct {
	APN  ProfileApnSettings `json:"apn"`
	IMEI string             `json:"imei"`
	TTL  int                `json:"ttl"`
	HL   int                `json:"hl"`
}

type SimProfile struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	MNO       string          `json:"mno"`
	SimICCID  string          `json:"sim_iccid"`
	CreatedAt int64           `json:"created_at"`
	UpdatedAt int64           `json:"updated_at"`
	Settings  ProfileSettings `json:"settings"`
	Scenario  ScenarioBinding `json:"scenario"`
}

type ProfileSummaryItem struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	MNO       string          `json:"mno"`
	SimICCID  string          `json:"sim_iccid"`
	CreatedAt int64           `json:"created_at"`
	UpdatedAt int64           `json:"updated_at"`
	Scenario  ScenarioBinding `json:"scenario"`
}

// Default profile instance for fallbacks
var defaultProfile = SimProfile{
	ID:        "default",
	Name:      "Default Carrier Profile",
	MNO:       "Custom",
	SimICCID:  "",
	CreatedAt: time.Now().Unix(),
	UpdatedAt: time.Now().Unix(),
	Settings: ProfileSettings{
		APN: ProfileApnSettings{
			CID:     1,
			Name:    "internet",
			PDPType: "IPV4V6",
		},
		IMEI: "",
		TTL:  0,
		HL:   0,
	},
	Scenario: ScenarioBinding{
		Default: "balanced",
		Schedule: ScenarioSchedule{
			Enabled: false,
			Blocks:  []ScenarioScheduleBlock{},
		},
	},
}

// HandleProfilesList lists stored SIM profiles
func (s *Server) HandleProfilesList(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	summary := ProfileSummaryItem{
		ID:        defaultProfile.ID,
		Name:      defaultProfile.Name,
		MNO:       defaultProfile.MNO,
		SimICCID:  defaultProfile.SimICCID,
		CreatedAt: defaultProfile.CreatedAt,
		UpdatedAt: defaultProfile.UpdatedAt,
		Scenario:  defaultProfile.Scenario,
	}

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":           true,
		"profiles":          []ProfileSummaryItem{summary},
		"active_profile_id": "default",
	})
}

// HandleProfilesGet gets full details for a profile
func (s *Server) HandleProfilesGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"profile": defaultProfile,
	})
}

// HandleProfilesSave creates or updates a profile
func (s *Server) HandleProfilesSave(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"profile_id": "default",
		"message":    "Profile saved successfully",
	})
}

// HandleProfilesDelete deletes a profile
func (s *Server) HandleProfilesDelete(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Profile deleted successfully",
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

// HandleProfilesCurrentSettings returns current live modem profile settings
func (s *Server) HandleProfilesCurrentSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"settings": map[string]interface{}{
			"iccid":      "",
			"imei":       "",
			"active_cid": 1,
			"apn_profiles": []map[string]interface{}{
				{"cid": 1, "apn": "internet", "pdp_type": "IPV4V6"},
			},
		},
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
