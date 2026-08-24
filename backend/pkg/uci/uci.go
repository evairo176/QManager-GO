package uci

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// Option represents a single UCI option or list entry
type Option struct {
	Name   string
	Values []string
}

// Section represents a UCI section (e.g. `config quecmanager 'main'`)
type Section struct {
	Type    string
	Name    string
	Options map[string]*Option
}

// File represents a full UCI configuration file
type File struct {
	Path     string
	Sections []*Section
	mu       sync.RWMutex
}

// NewFile creates a new empty UCI File structure
func NewFile(path string) *File {
	return &File{
		Path:     path,
		Sections: make([]*Section, 0),
	}
}

// Load parses a UCI file from disk
func Load(path string) (*File, error) {
	file := NewFile(path)
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return file, nil
		}
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var currentSec *Section

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) == 0 {
			continue
		}

		switch parts[0] {
		case "config":
			secType := ""
			secName := ""
			if len(parts) >= 2 {
				secType = unquote(parts[1])
			}
			if len(parts) >= 3 {
				secName = unquote(parts[2])
			}
			currentSec = &Section{
				Type:    secType,
				Name:    secName,
				Options: make(map[string]*Option),
			}
			file.Sections = append(file.Sections, currentSec)

		case "option":
			if currentSec == nil || len(parts) < 3 {
				continue
			}
			optName := unquote(parts[1])
			optVal := unquote(strings.Join(parts[2:], " "))
			currentSec.Options[optName] = &Option{
				Name:   optName,
				Values: []string{optVal},
			}

		case "list":
			if currentSec == nil || len(parts) < 3 {
				continue
			}
			optName := unquote(parts[1])
			optVal := unquote(strings.Join(parts[2:], " "))
			if existing, ok := currentSec.Options[optName]; ok {
				existing.Values = append(existing.Values, optVal)
			} else {
				currentSec.Options[optName] = &Option{
					Name:   optName,
					Values: []string{optVal},
				}
			}
		}
	}

	return file, scanner.Err()
}

// Get retrieves an option string value from a named section
func (f *File) Get(secName, optName string) string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, sec := range f.Sections {
		if sec.Name == secName || (sec.Name == "" && sec.Type == secName) {
			if opt, ok := sec.Options[optName]; ok && len(opt.Values) > 0 {
				return opt.Values[0]
			}
		}
	}
	return ""
}

// GetList retrieves a list option from a named section
func (f *File) GetList(secName, optName string) []string {
	f.mu.RLock()
	defer f.mu.RUnlock()

	for _, sec := range f.Sections {
		if sec.Name == secName || (sec.Name == "" && sec.Type == secName) {
			if opt, ok := sec.Options[optName]; ok {
				return opt.Values
			}
		}
	}
	return nil
}

// Set sets an option value for a section (creates section if missing)
func (f *File) Set(secType, secName, optName, value string) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var targetSec *Section
	for _, sec := range f.Sections {
		if sec.Name == secName && (secType == "" || sec.Type == secType) {
			targetSec = sec
			break
		}
	}

	if targetSec == nil {
		targetSec = &Section{
			Type:    secType,
			Name:    secName,
			Options: make(map[string]*Option),
		}
		f.Sections = append(f.Sections, targetSec)
	}

	targetSec.Options[optName] = &Option{
		Name:   optName,
		Values: []string{value},
	}
}

// Save writes the UCI configuration back to disk atomically
func (f *File) Save(path string) error {
	f.mu.RLock()
	defer f.mu.RUnlock()

	if path == "" {
		path = f.Path
	}

	var sb strings.Builder
	for i, sec := range f.Sections {
		if i > 0 {
			sb.WriteString("\n")
		}
		if sec.Name != "" {
			sb.WriteString(fmt.Sprintf("config %s '%s'\n", sec.Type, sec.Name))
		} else {
			sb.WriteString(fmt.Sprintf("config %s\n", sec.Type))
		}

		for _, opt := range sec.Options {
			if len(opt.Values) == 1 {
				sb.WriteString(fmt.Sprintf("\toption %s '%s'\n", opt.Name, opt.Values[0]))
			} else {
				for _, val := range opt.Values {
					sb.WriteString(fmt.Sprintf("\tlist %s '%s'\n", opt.Name, val))
				}
			}
		}
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tmpFile := path + ".tmp"
	if err := os.WriteFile(tmpFile, []byte(sb.String()), 0644); err != nil {
		return err
	}

	return os.Rename(tmpFile, path)
}

func unquote(s string) string {
	s = strings.TrimSpace(s)
	if (strings.HasPrefix(s, "'") && strings.HasSuffix(s, "'")) ||
		(strings.HasPrefix(s, "\"") && strings.HasSuffix(s, "\"")) {
		return s[1 : len(s)-1]
	}
	return s
}
