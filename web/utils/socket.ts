import { Server } from 'socket.io';

export interface SocketEvent {
  event: string;
  data: any;
}

class Socket {
  private io: Server;

  bindServer(io: Server) {
    this.io = io;
  }

  public broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }
}

const socket = new Socket();
export { socket as Socket };
