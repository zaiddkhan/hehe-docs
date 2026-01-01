package crdt

import "errors"

var (
	ErrNotFound = errors.New("char not found")
)

func (d *Document) Insert(c Char){
	d.chars = append(d.chars,c)
	d.normalize()
}

func (d *Document) Delete(id PositionID) error {
	for i := range d.chars {
		if equalID(d.chars[i].ID,id) {
			d.chars[i].Tombstone = true
			return nil
		}
	}
	return ErrNotFound
}

func equalID(a,b PositionID) bool {
	if len(a.Path) != len(b.Path){
		return false
	}
	for i := range a.Path {
		if a.Path[i] != b.Path[i] {
			return false
		}
	}
	return a.SiteID == b.SiteID && a.Counter == b.Counter
}

func (d *Document) InsertBetween(left, right PositionID, value rune, site string,counter uint64) Char {
     id := GeneratePositionBetween(left,right,site,counter)
    
    c := Char {
       ID: id,
       Value: value,
    }	
    d.Insert(c)
    return c
}