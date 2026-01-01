package crdt

import "strconv"

func (d *Document) ApplyRemoteInsert(c Char) {
	opID := "i-" + c.ID.SiteID + "-" + strconv.FormatUint(c.ID.Counter, 10)
	if d.seen[opID] {
		return
	}
	d.seen[opID] = true

	d.clock.Merge(c.ID.Counter)
	d.Insert(c)
}

func (d *Document) ApplyRemoteDelete(id PositionID) {
	opID := "d-" + id.SiteID + "-" + strconv.FormatUint(id.Counter, 10)
	if d.seen[opID] {
		return
	}
	d.seen[opID] = true

	d.clock.Merge(id.Counter)
	d.Delete(id)
}

