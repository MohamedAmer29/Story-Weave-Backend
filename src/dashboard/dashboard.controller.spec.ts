import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getDashboard: jest.Mock };

  beforeEach(() => {
    service = { getDashboard: jest.fn() };
    controller = new DashboardController(service as unknown as DashboardService);
  });

  it('returns the dashboard wrapped in success for the current user', async () => {
    service.getDashboard.mockResolvedValue({
      storyCount: 3,
      completedImages: 10,
    });
    const result = await controller.getDashboard('user-1');
    expect(service.getDashboard).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({
      success: true,
      data: { storyCount: 3, completedImages: 10 },
    });
  });
});
