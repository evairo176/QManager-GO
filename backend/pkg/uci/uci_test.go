package uci

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestUCILoadAndGet(t *testing.T) {
	content := `
config quecmanager 'main'
	option enabled '1'
	option port '80'
	list dns '1.1.1.1'
	list dns '8.8.8.8'
`
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "quecmanager")
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	file, err := Load(path)
	if err != nil {
		t.Fatalf("Failed to load UCI file: %v", err)
	}

	if got := file.Get("main", "enabled"); got != "1" {
		t.Errorf("Expected enabled=1, got '%s'", got)
	}

	if got := file.Get("main", "port"); got != "80" {
		t.Errorf("Expected port=80, got '%s'", got)
	}

	expectedDNS := []string{"1.1.1.1", "8.8.8.8"}
	if got := file.GetList("main", "dns"); !reflect.DeepEqual(got, expectedDNS) {
		t.Errorf("Expected dns=%v, got %v", expectedDNS, got)
	}
}

func TestUCISetAndSave(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "quecmanager")

	file := NewFile(path)
	file.Set("quecmanager", "settings", "theme", "dark")
	file.Set("quecmanager", "settings", "language", "en")

	if err := file.Save(path); err != nil {
		t.Fatalf("Failed to save UCI file: %v", err)
	}

	reloaded, err := Load(path)
	if err != nil {
		t.Fatalf("Failed to reload saved UCI file: %v", err)
	}

	if got := reloaded.Get("settings", "theme"); got != "dark" {
		t.Errorf("Expected theme=dark, got '%s'", got)
	}

	if got := reloaded.Get("settings", "language"); got != "en" {
		t.Errorf("Expected language=en, got '%s'", got)
	}
}
