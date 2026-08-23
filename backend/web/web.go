package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed out/*
var webFS embed.FS

// GetFileSystem returns embedded static web files
func GetFileSystem() http.FileSystem {
	sub, err := fs.Sub(webFS, "out")
	if err != nil {
		return nil
	}
	return http.FS(sub)
}
