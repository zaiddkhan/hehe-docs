package crdt

type Lamport struct {
	Value uint64
}

func (l *Lamport) Tick() uint64 {
	l.Value++
	return l.Value
}

func (l *Lamport) Merge(remote uint64) uint64 {
	if remote > l.Value {
		l.Value = remote
	}
	l.Value++
	return l.Value
}
