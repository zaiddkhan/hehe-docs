package crdt

import (
	"bytes"
	"sort"
)


type PositionID struct {
	Path    []uint32 `json:"path"`
	SiteID  string   `json:"site"`
	Counter uint64   `json:"counter"`
}

type Char struct {
	ID PositionID
	Value rune
	Tombstone bool
}

type SerializableChar struct {
	Path      []uint32 `json:"path"`
	Value     string   `json:"val"`
	SiteID    string   `json:"site"`
	Counter   uint64   `json:"counter"`
	Tombstone bool     `json:"t"`
}

type Document struct {
	chars []Char
	clock Lamport
	seen map[string]bool
}

func NewDocument() *Document {
	return &Document{
		chars: make([]Char,0),
		clock: Lamport{},
		seen: make(map[string]bool),
	}
}

func (d *Document) ToString() string {
	var buf bytes.Buffer
	for _, c := range d.chars {
		if !c.Tombstone {
			buf.WriteRune(c.Value)
		}
	}
	return buf.String()
}

func (d *Document) Raw() []SerializableChar {
	out := make([]SerializableChar, 0, len(d.chars))

	for _, c := range d.chars {
		out = append(out, SerializableChar{
			Path:      append([]uint32{}, c.ID.Path...),
			Value:     string(c.Value),
			SiteID:    c.ID.SiteID,
			Counter:   c.ID.Counter,
			Tombstone: c.Tombstone,
		})
	}

	return out
}

func (d *Document) normalize() {
	sort.Slice(d.chars,func (i,j int) bool {
		return d.chars[i].ID.Less(d.chars[j].ID)
	})
}