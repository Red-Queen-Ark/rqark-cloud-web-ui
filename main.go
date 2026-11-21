package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:dist
var assets embed.FS

func main() {
	settings, err := NewSettingsService()
	if err != nil {
		log.Fatal(err)
	}

	app := application.New(application.Options{
		Name:        "RqArk Cloud Desktop",
		Description: "Desktop client for RQArk Cloud: chats, agents, tasks and workspaces.",
		Services: []application.Service{
			application.NewService(settings),
		},
		Assets: application.AssetOptions{
			Handler:    application.AssetFileServerFS(assets),
			Middleware: apiProxyMiddleware(settings),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title:            "RqArk Cloud Desktop",
		Width:            1280,
		Height:           840,
		MinWidth:         900,
		MinHeight:        600,
		BackgroundColour: application.NewRGB(24, 24, 27),
		URL:              "/",
	})

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
