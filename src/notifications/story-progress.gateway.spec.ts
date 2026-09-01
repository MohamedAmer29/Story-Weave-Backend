import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { StoryAccessService } from '../modules/story/services/story-access.service';
import { StoryProgressService } from './story-progress.service';
import { StoryProgressGateway } from './story-progress.gateway';

function makeClient(overrides: Partial<any> = {}): any {
  return {
    handshake: { auth: {} },
    data: {},
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    ...overrides,
  };
}

describe('StoryProgressGateway', () => {
  let gateway: StoryProgressGateway;
  let jwtService: { verifyAsync: jest.Mock };
  let progressService: { setServer: jest.Mock };
  let accessService: { canAccessStory: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn() };
    progressService = { setServer: jest.fn() };
    accessService = { canAccessStory: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        StoryProgressGateway,
        { provide: JwtService, useValue: jwtService },
        { provide: StoryProgressService, useValue: progressService },
        { provide: StoryAccessService, useValue: accessService },
      ],
    }).compile();

    gateway = module.get(StoryProgressGateway);
  });

  describe('afterInit', () => {
    it('registers the server with the progress service', () => {
      const server = {} as Server;
      gateway.afterInit(server);
      expect(gateway.io).toBe(server);
      expect(progressService.setServer).toHaveBeenCalledWith(server);
    });
  });

  describe('handleConnection', () => {
    it('disconnects a client without a token', async () => {
      const client = makeClient();
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalledTimes(1);
    });

    it('authenticates a valid token and stores the user', async () => {
      const client = makeClient({ handshake: { auth: { token: 'tok' } } });
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'a@b.c',
      });

      await gateway.handleConnection(client);

      expect(client.data.user).toEqual({ id: 'user-1', email: 'a@b.c' });
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects a client with an invalid token', async () => {
      const client = makeClient({ handshake: { auth: { token: 'bad' } } });
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledTimes(1);
    });

    it('disconnects a client whose payload has no sub', async () => {
      const client = makeClient({ handshake: { auth: { token: 'tok' } } });
      jwtService.verifyAsync.mockResolvedValue({ email: 'a@b.c' });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleJoinStory', () => {
    it('rejects a missing storyId', async () => {
      const client = makeClient();
      const result = await gateway.handleJoinStory(client, {});
      expect(result).toEqual({ success: false, error: 'storyId is required' });
    });

    it('rejects an unauthenticated client', async () => {
      const client = makeClient();
      const result = await gateway.handleJoinStory(client, { storyId: 's1' });
      expect(result).toEqual({ success: false, error: 'unauthorized' });
    });

    it('rejects a client without access to the story', async () => {
      const client = makeClient();
      client.data.user = { id: 'user-1' };
      accessService.canAccessStory.mockResolvedValue({ canAccess: false });

      const result = await gateway.handleJoinStory(client, { storyId: 's1' });

      expect(result).toEqual({ success: false, error: 'access denied' });
      expect(client.join).not.toHaveBeenCalled();
    });

    it('joins the story room when access is granted', async () => {
      const client = makeClient();
      client.data.user = { id: 'user-1' };
      accessService.canAccessStory.mockResolvedValue({ canAccess: true });

      const result = await gateway.handleJoinStory(client, { storyId: 's1' });

      expect(result).toEqual({ success: true, storyId: 's1' });
      expect(client.join).toHaveBeenCalledWith('story:s1');
    });
  });

  describe('handleLeaveStory', () => {
    it('leaves the story room', () => {
      const client = makeClient();
      const result = gateway.handleLeaveStory(client, { storyId: 's1' });
      expect(result).toEqual({ success: true });
      expect(client.leave).toHaveBeenCalledWith('story:s1');
    });
  });
});
