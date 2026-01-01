package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/you/hehe-docs/crdt"
)


type Message struct {
	Type    string          `json:"type"`
	Value   string          `json:"value,omitempty"`
	Left    *crdt.PositionID `json:"left,omitempty"`
	Right   *crdt.PositionID `json:"right,omitempty"`
	ID      *crdt.PositionID `json:"id,omitempty"`
	Site    string          `json:"site,omitempty"`
	Counter uint64          `json:"counter,omitempty"`
}


var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	globalDoc   = crdt.NewDocument()
	docLock     sync.RWMutex
	clients     = make(map[*websocket.Conn]bool)
	clientsLock sync.Mutex
)

func main() {
	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/webhook/insert", handleWebhookInsert)
	http.HandleFunc("/webhook/delete", handleWebhookDelete)
	http.HandleFunc("/webhook/snapshot", handleWebhookSnapshot)
	http.HandleFunc("/health", handleHealth)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Println("Server running on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func handleWS(w http.ResponseWriter,r *http.Request) {
	conn, err := upgrader.Upgrade(w,r,nil)
	if err != nil {
		return
	}
	registerClient(conn)
	defer unregisterClient(conn)
	
	sendSnapshot(conn)
	readLoop(conn)
}

func registerClient(c *websocket.Conn) {
	clientsLock.Lock()
	defer clientsLock.Unlock()
	clients[c] = true
	log.Println("Client connected. Total:",len(clients))
}

func unregisterClient(c *websocket.Conn) {
	clientsLock.Lock()
	defer clientsLock.Unlock()
	delete(clients,c)
	c.Close()
	log.Println("Client disconnected. Total", len(clients))
}

func sendSnapshot(c *websocket.Conn) {
	docLock.RLock()
	msg := map[string]interface{}{
		"type":    "snapshot",
		"content": globalDoc.ToString(),
		"chars":   globalDoc.Raw(),
	}
	docLock.RUnlock()

	data, _ := json.Marshal(msg)
	c.WriteMessage(websocket.TextMessage, data)
}

func readLoop(c *websocket.Conn) {
	for {
		_, msgBytes,err := c.ReadMessage()
		if err != nil {
			return
		}
		
		var msg Message
		err = json.Unmarshal(msgBytes,&msg) 
		if err != nil {
			continue
		}
		switch msg.Type {
		case "insert":
			handleInsert(msg)

		case "delete":
			handleDelete(msg)
		}

		broadcast(msgBytes, c)
	}
}

func handleInsert(m Message) {
	if m.Left == nil || len(m.Value) == 0 {
		return
	}
	ch := crdt.Char{
		ID: crdt.PositionID{
			Path:    m.Left.Path,
			SiteID:  m.Site,
			Counter: m.Counter,
		},
		Value: rune(m.Value[0]),
	}
	docLock.Lock()
	globalDoc.ApplyRemoteInsert(ch)
	docLock.Unlock()
}

func handleDelete(m Message) {
	if m.ID == nil {
		return
	}
	docLock.Lock()
	globalDoc.ApplyRemoteDelete(*m.ID)
	docLock.Unlock()
}


func broadcast(msg []byte, sender *websocket.Conn) {
	clientsLock.Lock()
	defer clientsLock.Unlock()

	for c := range clients {
		if c == sender {
			continue
		}
		c.WriteMessage(websocket.TextMessage, msg)
	}
}

func handleWebhookInsert(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if msg.Left == nil || len(msg.Value) == 0 {
		http.Error(w, "Missing required fields: left, value", http.StatusBadRequest)
		return
	}

	ch := crdt.Char{
		ID: crdt.PositionID{
			Path:    msg.Left.Path,
			SiteID:  msg.Site,
			Counter: msg.Counter,
		},
		Value: rune(msg.Value[0]),
	}

	docLock.Lock()
	globalDoc.ApplyRemoteInsert(ch)
	docLock.Unlock()

	// Broadcast to all WebSocket clients
	msgBytes, _ := json.Marshal(msg)
	broadcast(msgBytes, nil)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleWebhookDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if msg.ID == nil {
		http.Error(w, "Missing required field: id", http.StatusBadRequest)
		return
	}

	docLock.Lock()
	globalDoc.ApplyRemoteDelete(*msg.ID)
	docLock.Unlock()

	// Broadcast to all WebSocket clients
	msgBytes, _ := json.Marshal(msg)
	broadcast(msgBytes, nil)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleWebhookSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	docLock.RLock()
	response := map[string]interface{}{
		"type":    "snapshot",
		"content": globalDoc.ToString(),
		"chars":   globalDoc.Raw(),
	}
	docLock.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}