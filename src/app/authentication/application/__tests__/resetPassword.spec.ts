import { createService } from './../password.service';
import { PasswordService } from '../../model/login.model';
import { verifyToken } from '../../domain/token.service';
jest.mock('./../../domain/token.service');
jest.mock('../../../core/application/configuration.service');

describe('Reset Password Use Case', () => {
    let mockUserRepository: any;

    let mockTokenRepository: any;

    let mockNotificationService: any;
    let service: PasswordService;
    let token: string;
    let password: string;
    beforeEach(() => {
        mockUserRepository = {
            findById: jest.fn(() => ({
                updatePassword: jest.fn()
            })),
            updateUser: jest.fn(() => true)
        };

        mockTokenRepository = {
            getUserTokenByJWT: jest.fn(() => true),
            deleteResetTokenForUser: jest.fn(() => true)
        };

        mockNotificationService = {
            sendNotification: jest.fn(() => true),
            createEmailNotificationMetaData: jest.fn(() => {})
        };

        (verifyToken as any).mockReset();
        token = 'test';
        password = 'test';

        service = createService(
            mockUserRepository,
            mockTokenRepository,
            mockNotificationService
        );
    });

    it('should return a promise', () => {
        const result = service.resetPassword(token, password);
        expect(result).toBeInstanceOf(Promise);
    });

    it('should call token repository to retrieve userId', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect(
                    mockTokenRepository.getUserTokenByJWT.mock.calls.length
                ).toBe(1)
            );
    });
    it('should verify the token against the retrieved userId', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect((verifyToken as any).mock.calls.length).toBe(1)
            );
    });
    it('should call user repository to retrieve user', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect(mockUserRepository.findById.mock.calls.length).toBe(1)
            );
    });
    it('should update the user password', () => {
        expect.assertions(1);
        const updatePassword = jest.fn();
        mockUserRepository.findById.mockReturnValueOnce({
            updatePassword
        });
        return service
            .resetPassword(token, password)
            .then(result => expect(updatePassword.mock.calls.length).toBe(1));
    });
    it('should call the user Repository to update the user', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect(mockUserRepository.updateUser.mock.calls.length).toBe(1)
            );
    });
    it('should call the token Repository to delete the token', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect(
                    mockTokenRepository.deleteResetTokenForUser.mock.calls
                        .length
                ).toBe(1)
            );
    });
    it('should call the notification Service with a new notification', () => {
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(result =>
                expect(
                    mockNotificationService.sendNotification.mock.calls.length
                ).toBe(1)
            );
    });
    it('should be throw an error because user is faulty', () => {
        mockUserRepository.findById = jest.fn(() => {
            throw new Error();
        });
        expect.assertions(1);
        return service
            .resetPassword(token, password)
            .then(
                result =>
                    expect(
                        mockNotificationService.sendNotification.mock.calls
                            .length
                    ).toBe(0),
                err => expect(err).toBeTruthy()
            );
    });
});