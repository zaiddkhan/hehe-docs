package crdt

func (d *Document) IsBeginning(left PositionID) bool {
	return len(left.Path) == 0
}

func (d *Document) IsEnd(right PositionID) bool {
	return len(right.Path) == 0
}

