package usage

import "testing"

func TestNormalizeRawMarksCanceledOutcome(t *testing.T) {
	event, err := NormalizeRaw([]byte(`{
		"timestamp":"2026-05-28T01:50:54Z",
		"provider":"codex",
		"model":"gpt-5.5",
		"endpoint":"POST /v1/responses",
		"source":"sk-test",
		"failed":false,
		"outcome":"canceled",
		"fail":{"body":"context canceled"}
	}`))
	if err != nil {
		t.Fatalf("NormalizeRaw returned error: %v", err)
	}
	if event.Failed {
		t.Fatalf("event.Failed = true, want false")
	}
	if event.Outcome != OutcomeCanceled {
		t.Fatalf("event.Outcome = %q, want %q", event.Outcome, OutcomeCanceled)
	}

	payload := BuildPayload([]Event{event})
	if payload.SuccessCount != 0 || payload.FailureCount != 0 || payload.CanceledCount != 1 {
		t.Fatalf("counts = success:%d failure:%d canceled:%d, want 0/0/1", payload.SuccessCount, payload.FailureCount, payload.CanceledCount)
	}

	detail := payload.APIs["POST /v1/responses"].Models["gpt-5.5"].Details[0]
	if detail.Outcome != OutcomeCanceled || detail.Failed {
		t.Fatalf("detail = outcome:%q failed:%v, want canceled/false", detail.Outcome, detail.Failed)
	}
}
