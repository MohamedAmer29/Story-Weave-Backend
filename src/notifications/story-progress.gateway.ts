import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { StoryAccessService } from '../modules/story/services/story-access.service';
import { StoryProgressService } from './story-progress.service';

const DEFAULT_CORS_ORIGIN = ['http://localhost:5173', 'http://localhost:3000'];

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : DEFAULT_CORS_ORIGIN,
    credentials: true,
  },
})
export class StoryProgressGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(StoryProgressGateway.name);

  @WebSocketServer()
  io: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly storyProgressService: StoryProgressService,
    private readonly storyAccessService: StoryAccessService,
  ) {}

  afterInit(server: Server): void {
    this.io = server;
    this.storyProgressService.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: string } | undefined)
      ?.token;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email?: string;
      }>(token);

      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      client.data.user = { id: payload.sub, email: payload.email };
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    // Socket.IO automatically leaves all rooms when a client disconnects.
  }

  @SubscribeMessage('joinStory')
  async handleJoinStory(
    client: Socket,
    payload: { storyId?: string },
  ): Promise<{ success: boolean; storyId?: string; error?: string }> {
    const storyId = (payload as { storyId?: string } | undefined)?.storyId;
    if (!storyId) {
      return { success: false, error: 'storyId is required' };
    }

    const user = client.data.user as { id: string } | undefined;
    if (!user?.id) {
      return { success: false, error: 'unauthorized' };
    }

    try {
      const { canAccess } = await this.storyAccessService.canAccessStory(
        storyId,
        user.id,
      );
      if (!canAccess) {
        return { success: false, error: 'access denied' };
      }
    } catch {
      return { success: false, error: 'access denied' };
    }

    void client.join(StoryProgressService.storyRoom(storyId));
    return { success: true, storyId };
  }

  @SubscribeMessage('leaveStory')
  handleLeaveStory(
    client: Socket,
    payload: { storyId?: string },
  ): { success: boolean } {
    const storyId = (payload as { storyId?: string } | undefined)?.storyId;
    if (storyId) {
      void client.leave(StoryProgressService.storyRoom(storyId));
    }
    return { success: true };
  }
}
