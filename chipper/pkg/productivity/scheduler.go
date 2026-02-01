package productivity

import (
	"encoding/json"
	"math/rand"
	"strings"
	"time"

	"github.com/kercre123/wire-pod/chipper/pkg/logger"
	"github.com/kercre123/wire-pod/chipper/pkg/vars"
)

const (
	ProductivityImgPath = "./productivity-images"
)

type ManualReminder struct {
	ID                  string                 `json:"id"`
	Image               string                 `json:"image"`
	Phrases             []string               `json:"phrases"`
	RequireConfirmation bool                   `json:"require_confirmation"`
	Schedule            ManualReminderSchedule `json:"schedule"`
}

type ManualReminderSchedule struct {
	Type       string   `json:"type"`
	Time       string   `json:"time"`
	Minute     int      `json:"minute"`
	MinMinutes int      `json:"min_minutes"`
	MaxMinutes int      `json:"max_minutes"`
	Days       []string `json:"days"`
}

var (
	nextRandomRun = make(map[string]time.Time)
	schedulerQuit = make(chan bool)
)

func StartScheduler() {
	logger.Println("Starting Productivity Scheduler...")
	rand.Seed(time.Now().UnixNano())
	go schedulerLoop()
	go executorLoop()
}

func StopScheduler() {
	schedulerQuit <- true
}

func schedulerLoop() {
	time.Sleep(10 * time.Second)
	logger.Println("Productivity Scheduler is active.")
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-schedulerQuit:
			return
		case <-ticker.C:
			if !vars.APIConfig.Productivity.Enable {
				continue
			}
			targetBot := vars.APIConfig.Productivity.TargetRobot
			if targetBot == "" || targetBot == "None" {
				if len(vars.BotInfo.Robots) > 0 {
					targetBot = vars.BotInfo.Robots[0].Esn
				} else {
					continue
				}
			}
			checkManualReminders(targetBot)
		}
	}
}

func checkManualReminders(esn string) {
	configStr := vars.APIConfig.Productivity.ManualConfig
	if configStr == "" || configStr == "[]" {
		return
	}
	var reminders []ManualReminder
	if err := json.Unmarshal([]byte(configStr), &reminders); err != nil {
		logger.Println("Productivity: Error parsing manual config: " + err.Error())
		return
	}
	now := time.Now()
	currentDay := now.Format("Mon")
	currentHHMM := now.Format("15:04")
	currentMinute := now.Minute()
	for _, r := range reminders {
		if len(r.Schedule.Days) > 0 {
			dayMatch := false
			for _, d := range r.Schedule.Days {
				if strings.EqualFold(d, currentDay) {
					dayMatch = true
					break
				}
			}
			if !dayMatch {
				continue
			}
		}
		shouldRun := false
		switch r.Schedule.Type {
		case "daily":
			if r.Schedule.Time == currentHHMM {
				shouldRun = true
			}
		case "hourly":
			if r.Schedule.Minute == currentMinute {
				shouldRun = true
			}
		case "random_interval":
			shouldRun = handleRandomInterval(r.ID, r.Schedule.MinMinutes, r.Schedule.MaxMinutes)
		}
		if shouldRun {
			logger.Println("Productivity: Scheduling task " + r.ID)
			select {
			case taskQueue <- Task{
				RobotESN:            esn,
				Phrases:             r.Phrases,
				Image:               r.Image,
				Source:              "manual",
				RequireConfirmation: r.RequireConfirmation,
			}:
			default:
				logger.Println("Productivity: Queue full, skipping task " + r.ID)
			}
		}
	}
}

func handleRandomInterval(id string, min int, max int) bool {
	now := time.Now()
	nextRun, exists := nextRandomRun[id]
	if !exists {
		nextRandomRun[id] = calculateNextRandomTime(min, max)
		return false
	}
	if now.After(nextRun) {
		nextRandomRun[id] = calculateNextRandomTime(min, max)
		return true
	}
	return false
}

func calculateNextRandomTime(min int, max int) time.Time {
	if min < 1 {
		min = 1
	}
	if max < min {
		max = min
	}
	interval := min
	if max > min {
		interval = min + rand.Intn(max-min)
	}
	return time.Now().Add(time.Duration(interval) * time.Minute)
}