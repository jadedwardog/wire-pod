package productivity

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fforchino/vector-go-sdk/pkg/vector"
	"github.com/fforchino/vector-go-sdk/pkg/vectorpb"
	"github.com/kercre123/wire-pod/chipper/pkg/logger"
	"github.com/kercre123/wire-pod/chipper/pkg/vars"
)

type Task struct {
	ID                  string
	RobotESN            string
	Phrases             []string
	Image               string
	Source              string
	RetryCount          int
	RequireConfirmation bool
	SnoozeMinutes       int
}

var (
	taskQueue = make(chan Task, 10)
)

func executorLoop() {
	logger.Println("Productivity: executorLoop started")
	for task := range taskQueue {
		logger.Println("Productivity: Processing task for " + task.RobotESN)
		processTask(task)
		time.Sleep(5 * time.Second)
	}
}

func InjectTestTask(task Task) {
	select {
	case taskQueue <- task:
		logger.Println("Productivity: Test task pushed")
	default:
		logger.Println("Productivity: Queue full")
	}
}

func retryTask(task Task, reason string) {
	if task.RetryCount >= 4 {
		logger.Println("Productivity: Task failed permanently: " + reason)
		return
	}
	task.RetryCount++
	backoff := math.Pow(2, float64(task.RetryCount))
	go func() {
		time.Sleep(time.Duration(backoff) * time.Second)
		taskQueue <- task
	}()
}

func snoozeTask(task Task) {
	duration := 10 * time.Minute
	if task.SnoozeMinutes > 0 {
		duration = time.Duration(task.SnoozeMinutes) * time.Minute
	}
	logger.Println("Productivity: Snoozing task " + task.ID + " for " + duration.String())
	go func() {
		time.Sleep(duration)
		task.RetryCount = 0
		taskQueue <- task
	}()
}

func processTask(task Task) {
	if task.ID != "" {
		exists, enabled := getReminderState(task.ID)
		if task.Source == "manual" {
			if !exists || !enabled {
				logger.Println("Productivity: Reminder " + task.ID + " is no longer enabled or exists. Stopping loop.")
				return
			}
		} else if task.Source == "test" {
			if exists && !enabled {
				logger.Println("Productivity: Test Reminder " + task.ID + " was explicitly disabled in config. Stopping loop.")
				return
			}
		}
	}

	robot, err := vars.GetRobot(task.RobotESN)
	if err != nil {
		retryTask(task, "Robot lookup failed")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Second)
	defer cancel()

	bcClient, err := robot.Conn.BehaviorControl(ctx)
	if err != nil {
		retryTask(task, "BC stream failed")
		return
	}

	req := &vectorpb.BehaviorControlRequest{
		RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
			ControlRequest: &vectorpb.ControlRequest{
				Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
			},
		},
	}

	if err := bcClient.Send(req); err != nil {
		retryTask(task, "Send BC request failed")
		return
	}

	granted := false
	for {
		resp, err := bcClient.Recv()
		if err != nil {
			retryTask(task, "BC recv failed")
			return
		}
		if resp.GetControlGrantedResponse() != nil {
			granted = true
			break
		}
	}

	if !granted {
		return
	}

	defer func() {
		releaseReq := &vectorpb.BehaviorControlRequest{
			RequestType: &vectorpb.BehaviorControlRequest_ControlRelease{
				ControlRelease: &vectorpb.ControlRelease{},
			},
		}
		bcClient.Send(releaseReq)
	}()

	battResp, err := robot.Conn.BatteryState(ctx, &vectorpb.BatteryStateRequest{})
	if err == nil && battResp.IsOnChargerPlatform {
		_, err := robot.Conn.DriveOffCharger(ctx, &vectorpb.DriveOffChargerRequest{})
		if err != nil {
			retryTask(task, "Drive off failed")
			return
		}
		time.Sleep(5 * time.Second)
	}

	if task.Image != "" {
		fullPath := filepath.Join(ProductivityImgPath, task.Image)
		if _, err := os.Stat(fullPath); err == nil {
			imgData, err := convertImageToVectorFace(fullPath)
			if err == nil {
				go func() {
					robot.Conn.DisplayFaceImageRGB(ctx, &vectorpb.DisplayFaceImageRGBRequest{
						FaceData:         imgData,
						DurationMs:       30000,
						InterruptRunning: true,
					})
				}()
			}
		}
	}

	if len(task.Phrases) > 0 {
		phrase := task.Phrases[rand.Intn(len(task.Phrases))]
		if phrase != "" {
			robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
				Text:           phrase,
				UseVectorVoice: true,
				DurationScalar: 1.0,
			})
		}
	}

	if task.RequireConfirmation {
		if !waitForConfirmation(ctx, robot, bcClient, task.RobotESN) {
			snoozeTask(task)
		}
	}
}

func waitForConfirmation(ctx context.Context, robot *vector.Vector, bcClient vectorpb.ExternalInterface_BehaviorControlClient, esn string) bool {
	// 1. Release Behavior Control so robot can listen
	releaseReq := &vectorpb.BehaviorControlRequest{
		RequestType: &vectorpb.BehaviorControlRequest_ControlRelease{
			ControlRelease: &vectorpb.ControlRelease{},
		},
	}
	if err := bcClient.Send(releaseReq); err != nil {
		logger.Println("Productivity: Failed to release BC for confirmation: " + err.Error())
	}
	// Small delay to ensure BC is released before we trigger wake word
	time.Sleep(500 * time.Millisecond)

	// 2. Trigger Listening via Console Variable (most reliable method)
	var ip string
	for _, bot := range vars.BotInfo.Robots {
		if bot.Esn == esn {
			ip = bot.IPAddress
			break
		}
	}

	if ip != "" {
		go func() {
			url := fmt.Sprintf("http://%s:8889/consolevarset?key=FakeButtonPressType&value=singlePressDetected", ip)
			client := &http.Client{Timeout: 2 * time.Second}
			client.Get(url)
		}()
	} else {
		logger.Println("Productivity: Could not find IP for ESN " + esn + " to force wake word.")
	}

	// 3. Watch Logs for Intent
	logger.Println("Productivity: Waiting for confirmation response in logs...")
	timeout := time.After(30 * time.Second)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	// Capture the current length of the log to ignore old history
	startLogLen := len(logger.LogList)

	for {
		select {
		case <-ticker.C:
			currentLog := logger.LogList
			// Handle log rotation or clearing
			if len(currentLog) < startLogLen {
				startLogLen = 0
			}

			// Check new log entries
			if len(currentLog) > startLogLen {
				newLogs := currentLog[startLogLen:]

				// Broad checks for intent strings to catch them regardless of formatting
				if strings.Contains(newLogs, "intent_imperative_affirmative") || strings.Contains(newLogs, "intent_global_yes") {
					logger.Println("Productivity: Affirmative received from logs. Speaking response.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
						Text:           "Great!",
						UseVectorVoice: true,
						DurationScalar: 1.0,
					})
					return true
				}
				if strings.Contains(newLogs, "intent_imperative_negative") {
					logger.Println("Productivity: Negative received from logs. Speaking response.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
						Text:           "Ok, I'll remind you again soon.",
						UseVectorVoice: true,
						DurationScalar: 1.0,
					})
					return false
				}
				if strings.Contains(newLogs, "intent_system_noaudio") {
					logger.Println("Productivity: No audio received from logs. Speaking response.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
						Text:           "I didn't hear anything. I'll remind you later.",
						UseVectorVoice: true,
						DurationScalar: 1.0,
					})
					return false
				}
			}
		case <-timeout:
			logger.Println("Productivity: Confirmation timed out")
			bcClient.Send(&vectorpb.BehaviorControlRequest{
				RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
					ControlRequest: &vectorpb.ControlRequest{
						Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
					},
				},
			})
			robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
				Text:           "I didn't hear anything. I'll remind you later.",
				UseVectorVoice: true,
				DurationScalar: 1.0,
			})
			return false
		}
	}
}

func convertImageToVectorFace(path string) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	img, _, err := image.Decode(file)
	if err != nil {
		return nil, err
	}
	const width = 184
	const height = 96
	buf := make([]byte, width*height*2)
	bounds := img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			srcX := x * srcW / width
			srcY := y * srcH / height
			c := img.At(bounds.Min.X+srcX, bounds.Min.Y+srcY)
			r, g, b, _ := c.RGBA()
			r5 := uint16((r >> 11) & 0x1F)
			g6 := uint16((g >> 10) & 0x3F)
			b5 := uint16((b >> 11) & 0x1F)
			rgb565 := (r5 << 11) | (g6 << 5) | b5
			idx := (y*width + x) * 2
			buf[idx] = byte(rgb565 >> 8)
			buf[idx+1] = byte(rgb565 & 0xFF)
		}
	}
	return buf, nil
}