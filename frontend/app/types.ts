export interface PositionID {
  path: number[];
  site: string;
  counter: number;
}

export interface SerializableChar {
  path: number[];
  val: string;
  site: string;
  counter: number;
  t: boolean; // tombstone
}

export interface Char {
  id: PositionID;
  value: string;
  tombstone: boolean;
}

export interface InsertMessage {
  type: "insert";
  value: string;
  left: PositionID | null;
  right: PositionID | null;
  site: string;
  counter: number;
}

export interface DeleteMessage {
  type: "delete";
  id: PositionID;
  site: string;
  counter: number;
}

export interface SnapshotMessage {
  type: "snapshot";
  content: string;
  chars: SerializableChar[];
}

export type WSMessage = InsertMessage | DeleteMessage | SnapshotMessage;
