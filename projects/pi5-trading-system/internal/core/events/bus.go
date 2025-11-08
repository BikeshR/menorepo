package events

import (
	"context"
	"fmt"
	"sync"

	"github.com/rs/zerolog"
)

// EventBus manages event distribution using Go channels
// This is the heart of the trading system - learn Go concurrency here!
type EventBus struct {
	// Map of event types to slices of subscriber channels
	subscribers map[EventType][]chan Event

	// Mutex to protect the subscribers map (thread-safe)
	mu sync.RWMutex

	// Buffer size for subscriber channels
	bufferSize int

	// Logger
	logger zerolog.Logger

	// Metrics
	publishedCount map[EventType]int64
	droppedCount   map[EventType]int64
	metricsLock    sync.RWMutex
}

// NewEventBus creates a new event bus with the specified channel buffer size
func NewEventBus(bufferSize int, logger zerolog.Logger) *EventBus {
	return &EventBus{
		subscribers:    make(map[EventType][]chan Event),
		bufferSize:     bufferSize,
		logger:         logger,
		publishedCount: make(map[EventType]int64),
		droppedCount:   make(map[EventType]int64),
	}
}

// Subscribe creates a new subscription to the specified event type
// Returns a read-only channel that will receive events
// This channel is buffered to handle backpressure
func (eb *EventBus) Subscribe(eventType EventType) <-chan Event {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	// Create a buffered channel for this subscriber
	// Buffer size helps prevent blocking when subscribers are slow
	ch := make(chan Event, eb.bufferSize)

	// Add to subscribers list
	eb.subscribers[eventType] = append(eb.subscribers[eventType], ch)

	eb.logger.Info().
		Str("event_type", string(eventType)).
		Int("buffer_size", eb.bufferSize).
		Int("total_subscribers", len(eb.subscribers[eventType])).
		Msg("New subscriber registered")

	return ch
}

// Publish sends an event to all subscribers of that event type
// This is NON-BLOCKING - if a subscriber's channel is full, we log a warning
// and drop the event for that subscriber only
func (eb *EventBus) Publish(ctx context.Context, event Event) {
	eb.mu.RLock()
	subscribers := eb.subscribers[event.Type()]
	eb.mu.RUnlock()

	if len(subscribers) == 0 {
		// No subscribers for this event type
		eb.logger.Debug().
			Str("event_type", string(event.Type())).
			Msg("No subscribers for event type")
		return
	}

	// Update metrics
	eb.updateMetrics(event.Type(), len(subscribers), 0)

	// Send to all subscribers (non-blocking)
	var droppedCount int
	for i, ch := range subscribers {
		select {
		case ch <- event:
			// Successfully sent to subscriber
			eb.logger.Debug().
				Str("event_type", string(event.Type())).
				Int("subscriber_index", i).
				Msg("Event sent to subscriber")

		case <-ctx.Done():
			// Context canceled, stop publishing
			eb.logger.Warn().
				Str("event_type", string(event.Type())).
				Msg("Publishing canceled by context")
			return

		default:
			// Channel is full - this subscriber is slow
			// Drop the event for this subscriber only
			droppedCount++
			eb.logger.Warn().
				Str("event_type", string(event.Type())).
				Int("subscriber_index", i).
				Int("buffer_size", eb.bufferSize).
				Msg("Subscriber channel full, event dropped for this subscriber")
		}
	}

	if droppedCount > 0 {
		eb.updateMetrics(event.Type(), 0, droppedCount)
	}
}

// PublishBlocking sends an event and blocks until all subscribers receive it
// Use this for critical events where you can't afford to drop
// WARNING: This can block indefinitely if a subscriber is stuck!
func (eb *EventBus) PublishBlocking(ctx context.Context, event Event) error {
	eb.mu.RLock()
	subscribers := eb.subscribers[event.Type()]
	eb.mu.RUnlock()

	if len(subscribers) == 0 {
		return nil
	}

	// Send to all subscribers (blocking)
	for i, ch := range subscribers {
		select {
		case ch <- event:
			// Successfully sent
			eb.logger.Debug().
				Str("event_type", string(event.Type())).
				Int("subscriber_index", i).
				Msg("Event sent to subscriber (blocking)")

		case <-ctx.Done():
			return fmt.Errorf("publish canceled: %w", ctx.Err())
		}
	}

	eb.updateMetrics(event.Type(), len(subscribers), 0)
	return nil
}

// Unsubscribe removes a subscriber by closing their channel
// In Go, you typically don't need this - just stop reading from the channel
func (eb *EventBus) Unsubscribe(eventType EventType, ch <-chan Event) {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	subscribers := eb.subscribers[eventType]
	for i, subscriber := range subscribers {
		if subscriber == ch {
			// Remove this subscriber
			eb.subscribers[eventType] = append(subscribers[:i], subscribers[i+1:]...)
			close(subscriber)

			eb.logger.Info().
				Str("event_type", string(eventType)).
				Int("remaining_subscribers", len(eb.subscribers[eventType])).
				Msg("Subscriber unsubscribed")
			return
		}
	}
}

// Close shuts down the event bus and closes all subscriber channels
func (eb *EventBus) Close() {
	eb.mu.Lock()
	defer eb.mu.Unlock()

	eb.logger.Info().Msg("Closing event bus and all subscriber channels")

	// Close all subscriber channels
	for eventType, subscribers := range eb.subscribers {
		for _, ch := range subscribers {
			close(ch)
		}
		eb.logger.Info().
			Str("event_type", string(eventType)).
			Int("subscribers", len(subscribers)).
			Msg("Closed subscriber channels")
	}

	// Clear subscribers map
	eb.subscribers = make(map[EventType][]chan Event)
}

// GetMetrics returns the current metrics
func (eb *EventBus) GetMetrics() map[EventType]EventMetrics {
	eb.metricsLock.RLock()
	defer eb.metricsLock.RUnlock()

	metrics := make(map[EventType]EventMetrics)
	for eventType := range eb.publishedCount {
		metrics[eventType] = EventMetrics{
			EventType:      eventType,
			PublishedCount: eb.publishedCount[eventType],
			DroppedCount:   eb.droppedCount[eventType],
		}
	}

	return metrics
}

// EventMetrics holds metrics for event publishing
type EventMetrics struct {
	EventType      EventType
	PublishedCount int64
	DroppedCount   int64
}

// updateMetrics updates internal metrics (thread-safe)
func (eb *EventBus) updateMetrics(eventType EventType, published, dropped int) {
	eb.metricsLock.Lock()
	defer eb.metricsLock.Unlock()

	eb.publishedCount[eventType] += int64(published)
	eb.droppedCount[eventType] += int64(dropped)
}

// SubscriberCount returns the number of subscribers for a given event type
func (eb *EventBus) SubscriberCount(eventType EventType) int {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	return len(eb.subscribers[eventType])
}

// EventTypes returns all event types that have subscribers
func (eb *EventBus) EventTypes() []EventType {
	eb.mu.RLock()
	defer eb.mu.RUnlock()

	types := make([]EventType, 0, len(eb.subscribers))
	for eventType := range eb.subscribers {
		types = append(types, eventType)
	}

	return types
}
