package productivity

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/protobuf/encoding/protojson"

	"github.com/fforchino/vector-go-sdk/pkg/vector"
	"github.com/fforchino/vector-go-sdk/pkg/vectorpb"
	"github.com/kercre123/wire-pod/chipper/pkg/logger"
	"github.com/kercre123/wire-pod/chipper/pkg/vars"
)

type Task struct {
	RobotESN            string
	Phrases             []string
	Image               string
	Source              string
	RetryCount          int
	RequireConfirmation bool
}

var (
	taskQueue = make(chan Task, 10)
)

func executorLoop() {
	for task := range taskQueue {
		processTask(task)
		time.Sleep(5 * time.Second)
	}
}

func InjectTestTask(task Task) {
	logger.Println("Productivity: Injecting test task for " + task.RobotESN)
	select {
	case taskQueue <- task:
	default:
		logger.Println("Productivity: Task queue full, dropping test task")
	}
}

func retryTask(task Task, reason string) {
	if task.RetryCount >= 3 {
		logger.Println(fmt.Sprintf("Productivity: Task for %s failed after 3 attempts (%s). Dropping.", task.RobotESN, reason))
		return
	}
	task.RetryCount++
	logger.Println(fmt.Sprintf("Productivity: Task failed (%s). Retrying in 30 seconds (Attempt %d/3)", reason, task.RetryCount))
	go func() {
		time.Sleep(30 * time.Second)
		taskQueue <- task
	}()
}

func snoozeTask(task Task) {
	logger.Println("Productivity: No confirmation received. Snoozing reminder for 10 minutes.")
	go func() {
		time.Sleep(10 * time.Minute)
		task.RetryCount = 0
		taskQueue <- task
	}()
}

func processTask(task Task) {
	robot, err := vars.GetRobot(task.RobotESN)
	if err != nil {
		retryTask(task, "Robot config lookup failed: "+err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	_, err = robot.Conn.BatteryState(ctx, &vectorpb.BatteryStateRequest{})
	if err != nil {
		retryTask(task, "Robot unreachable/offline: "+err.Error())
		return
	}

	bcClient, err := robot.Conn.AssumeBehaviorControl(ctx, &vectorpb.BehaviorControlRequest{
		RequestType: &vectorpb.BehaviorControlRequest_ControlRequest{
			ControlRequest: &vectorpb.ControlRequest{
				Priority: vectorpb.ControlRequest_OVERRIDE_BEHAVIORS,
			},
		},
	})
	if err != nil {
		retryTask(task, "AssumeBehaviorControl failed: "+err.Error())
		return
	}

	_, err = bcClient.Recv()
	if err != nil {
		retryTask(task, "Control not granted: "+err.Error())
		return
	}

	var actionErr error

	if len(task.Phrases) > 0 {
		phrase := task.Phrases[rand.Intn(len(task.Phrases))]
		if phrase != "" {
			_, err := robot.Conn.SayText(ctx, &vectorpb.SayTextRequest{
				Text:           phrase,
				UseVectorVoice: true,
				DurationScalar: 1.0,
			})
			if err != nil {
				logger.Println("Productivity: Error saying text: " + err.Error())
				actionErr = err
			}
		}
	}

	if task.Image != "" {
		fullPath := filepath.Join(ProductivityImgPath, task.Image)
		if _, err := os.Stat(fullPath); err == nil {
			logger.Println("Productivity: Processing image " + fullPath)
			imgData, err := convertImageToVectorFace(fullPath)
			if err == nil {
				_, err = robot.Conn.DisplayFaceImageRGB(ctx, &vectorpb.DisplayFaceImageRGBRequest{
					FaceData:         imgData,
					DurationMs:       5000,
					InterruptRunning: true,
				})
				if err != nil {
					logger.Println("Productivity: Error displaying image: " + err.Error())
					if actionErr == nil {
						actionErr = err
					}
				}
			} else {
				logger.Println("Productivity: Error converting image: " + err.Error())
			}
		}
	}

	if actionErr != nil {
		retryTask(task, "Action execution failed: "+actionErr.Error())
		return
	}

	if task.RequireConfirmation {
		confirmed := waitForConfirmation(ctx, robot)
		if !confirmed {
			snoozeTask(task)
		} else {
			logger.Println("Productivity: Confirmation received. Reminder complete.")
			robot.Conn.PlayAnimation(ctx, &vectorpb.PlayAnimationRequest{
				Animation: &vectorpb.Animation{Name: "anim_feedback_shutup_01"},
			})
		}
	}
}

func waitForConfirmation(ctx context.Context, robot *vector.Vector) bool {
	_, err := robot.Conn.AppIntent(ctx, &vectorpb.AppIntentRequest{
		Intent: "intent_system_listen",
	})
	if err != nil {
		logger.Println("Productivity: Failed to trigger listening mode: " + err.Error())
		return false
	}

	eventStream, err := robot.Conn.EventStream(ctx, &vectorpb.EventRequest{})
	if err != nil {
		logger.Println("Productivity: Failed to start event stream: " + err.Error())
		return false
	}

	timeoutChan := time.After(15 * time.Second)
	responseChan := make(chan bool)

	go func() {
		for {
			msg, err := eventStream.Recv()
			if err != nil {
				close(responseChan)
				return
			}
			if msg != nil && msg.Event != nil {
				intent := msg.Event.GetUserIntent()
				if intent != nil {
					b, err := protojson.Marshal(intent)
					if err != nil {
						continue
					}
					s := string(b)
					if strings.Contains(s, "intent_imperative_affirmative") ||
						strings.Contains(s, "intent_global_yes") {
						responseChan <- true
						return
					}
				}
			}
		}
	}()

	select {
	case result := <-responseChan:
		return result
	case <-timeoutChan:
		logger.Println("Productivity: Timed out waiting for confirmation.")
		return false
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
