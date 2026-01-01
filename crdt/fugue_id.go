package crdt



func NewPositionID(path []uint32, site string,counter uint64) PositionID {
	return PositionID{
		Path: append([]uint32{},path...),
		SiteID: site,
		Counter: counter,
	}
}


func (p PositionID) Less(other PositionID) bool {
	
	n := len(p.Path)
	m := len(other.Path)
	
	min := n
	if m < n {
		min = m
	}
	
	for i := 0; i < min; i++{
		if p.Path[i] != other.Path[i] {
			return p.Path[i] < other.Path[i]
		}
	}
	
	if p.SiteID != other.SiteID {
		return p.SiteID < other.SiteID
	}
	return p.Counter < other.Counter
}