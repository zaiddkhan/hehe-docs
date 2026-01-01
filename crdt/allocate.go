package crdt

import (
	"crypto/rand"
	"math/big"
)

const (
	minVal uint32 = 0
	maxVal uint32 = ^uint32(0)
)

func randBetween(low, high uint32) uint32 {
	if high-low <= 1 {
		return low
	}

	n := big.NewInt(int64(high-low-1))
	r, _ := rand.Int(rand.Reader, n)
	return low + 1 + uint32(r.Int64())
}

func biasedChoice(low, high uint32, bias string) uint32 {
	if high-low <= 1 {
		return low
	}

	space := high - low
	switch bias {
	case "left":
		zoneHigh := low + space/3
		return randBetween(low, zoneHigh)

	case "right":
		zoneLow := high - space/3
		return randBetween(zoneLow, high)

	default:
		// middle balanced
		return randBetween(low, high)
	}
}

func GeneratePositionBetween(left, right PositionID, site string, counter uint64) PositionID {
	var path []uint32
	depth := 0

	var bias string

	if len(left.Path) == 0 && len(right.Path) == 0 {
		bias = "middle"
	} else if len(left.Path) == 0 {
		bias = "left"
	} else if len(right.Path) == 0 {
		bias = "right"
	} else {
		bias = "middle"
	}

	for {
		var l uint32 = minVal
		var r uint32 = maxVal

		if depth < len(left.Path) {
			l = left.Path[depth]
		}
		if depth < len(right.Path) {
			r = right.Path[depth]
		}

		if r-l > 1 {
			chosen := biasedChoice(l, r, bias)
			path = append(path, chosen)
			break
		}

		path = append(path, l)
		depth++
	}

	return PositionID{
		Path:    path,
		SiteID:  site,
		Counter: counter,
	}
}
