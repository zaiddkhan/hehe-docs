package crdt

import "testing"

func TestReplaySafe(t *testing.T) {
	A := NewDocument()
	B := NewDocument()

	site := "A"

	c1 := A.InsertBetween(PositionID{}, PositionID{}, 'H', site, 1)
	c2 := A.InsertBetween(c1.ID, PositionID{}, 'i', site, 2)

	// Apply in weird order
	B.ApplyRemoteInsert(c2)
	B.ApplyRemoteInsert(c1)

	// Replay duplicate
	B.ApplyRemoteInsert(c1)

	if A.ToString() != B.ToString() {
		t.Fatalf("diverged: %s vs %s", A.ToString(), B.ToString())
	}
}
