package productivity

import (
	"context"
	"encoding/json"
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
	"google.golang.org/protobuf/encoding/protojson"
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

func getReminderState(id string) (bool, bool) {
	configStr := vars.APIConfig.Productivity.ManualConfig
	if configStr == "" || configStr == "[]" {
		return false, false
	}
	var reminders []ManualReminder
	if err := json.Unmarshal([]byte(configStr), &reminders); err != nil {
		return false, false
	}
	for _, r := range reminders {
		if r.ID == id {
			return true, r.Enabled
		}
	}
	return false, false
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
				robot.Conn.DisplayFaceImageRGB(ctx, &vectorpb.DisplayFaceImageRGBRequest{
					FaceData:         imgData,
					DurationMs:       30000,
					InterruptRunning: true,
				})
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
		logger.Println("Productivity: Waiting for confirmation response...")
		if waitForConfirmation(ctx, robot, bcClient, task.RobotESN) {
		} else {
			snoozeTask(task)
		}
	}
}

func waitForConfirmation(ctx context.Context, robot *vector.Vector, bcClient vectorpb.ExternalInterface_BehaviorControlClient, esn string) bool {
	releaseReq := &vectorpb.BehaviorControlRequest{
		RequestType: &vectorpb.BehaviorControlRequest_ControlRelease{
			ControlRelease: &vectorpb.ControlRelease{},
		},
	}
	if err := bcClient.Send(releaseReq); err != nil {
		logger.Println("Productivity: Failed to release BC for confirmation: " + err.Error())
	}
	time.Sleep(500 * time.Millisecond)

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
	}

	eventStream, _ := robot.Conn.EventStream(ctx, &vectorpb.EventRequest{})
	timeout := time.After(30 * time.Second)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	startLogLen := len(logger.LogList)

	for {
		select {
		case <-ticker.C:
			if eventStream != nil {
				msg, err := eventStream.Recv()
				if err == nil && msg != nil && msg.Event != nil {
					intent := msg.Event.GetUserIntent()
					if intent != nil {
						b, _ := protojson.Marshal(intent)
						s := string(b)
						if strings.Contains(s, "intent_imperative_affirmative") || strings.Contains(s, "intent_global_yes") {
							logger.Println("Productivity: Affirmative matched via EventStream.")
							bcClient.Send(&vectorpb.BehaviorControlRequest{
								RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
									ControlRequest: &vectorpb.ControlRequest{
										Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
									},
								},
							})
							robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "Great!", UseVectorVoice: true})
							return true
						}
						if strings.Contains(s, "intent_imperative_negative") {
							logger.Println("Productivity: Negative matched via EventStream.")
							bcClient.Send(&vectorpb.BehaviorControlRequest{
								RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
									ControlRequest: &vectorpb.ControlRequest{
										Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
									},
								},
							})
							robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "Ok, I'll remind you again soon.", UseVectorVoice: true})
							return false
						}
					}
				}
			}

			currentLog := logger.LogList
			if len(currentLog) > startLogLen {
				newLogs := currentLog[startLogLen:]
				if strings.Contains(newLogs, "intent_imperative_affirmative") || strings.Contains(newLogs, "intent_global_yes") {
					logger.Println("Productivity: Affirmative matched via Log Fallback.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "Great!", UseVectorVoice: true})
					return true
				}
				if strings.Contains(newLogs, "intent_imperative_negative") {
					logger.Println("Productivity: Negative matched via Log Fallback.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "Ok, I'll remind you again soon.", UseVectorVoice: true})
					return false
				}
				if strings.Contains(newLogs, "intent_system_noaudio") {
					logger.Println("Productivity: No audio matched via Log Fallback.")
					bcClient.Send(&vectorpb.BehaviorControlRequest{
						RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
							ControlRequest: &vectorpb.ControlRequest{
								Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
							},
						},
					})
					robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "I didn't hear anything. I'll remind you later.", UseVectorVoice: true})
					return false
				}
			}
		case <-timeout:
			logger.Println("Productivity: Confirmation timed out.")
			bcClient.Send(&vectorpb.BehaviorControlRequest{
				RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
					ControlRequest: &vectorpb.ControlRequest{
						Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
					},
				},
			})
			robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{Text: "I didn't hear anything. I'll remind you later.", UseVectorVoice: true})
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