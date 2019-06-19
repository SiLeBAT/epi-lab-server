import { createController, LoginController } from './../login.controller';
import * as mockReq from 'mock-express-request';
import * as mockRes from 'mock-express-response';
import { LoginResult, LoginPort } from '../../../../app/ports';
// tslint:disable
jest.genMockFromModule('./../../../../aspects');
jest.mock('./../../../../aspects');
jest.mock('./../../../../app/ports');

describe('Login controller', () => {
    let controller: LoginController;
    let mockLoginService: LoginPort = {
        loginUser: jest.fn()
    };
    beforeEach(() => {
        controller = createController(mockLoginService);
    });
    it('should be return a promise', () => {
        (mockLoginService.loginUser as any).mockReturnValueOnce({
            result: LoginResult.SUCCESS
        });
        const req = new mockReq({
            body: {
                email: 'test'
            }
        });
        const res = new mockRes();
        const result = controller.login(req, res);
        expect(result).toBeInstanceOf(Promise);
    });
    it('should be return a 401 response', () => {
        (mockLoginService.loginUser as any).mockReturnValueOnce({
            result: LoginResult.FAIL
        });
        const req = new mockReq({
            body: {
                email: 'test'
            }
        });
        const res = new mockRes();
        const result = controller.login(req, res);
        expect.assertions(1);
        return result.then(data => {
            return expect(res.statusCode).toBe(401);
        });
    });
    it('should be return a 200 response', () => {
        (mockLoginService.loginUser as any).mockReturnValueOnce({
            user: {
                institution: {
                    uniqueId: 1
                }
            }
        });
        const req = new mockReq({
            body: {
                email: 'test'
            }
        });
        const res = new mockRes();
        const result = controller.login(req, res);
        expect.assertions(1);
        return result.then(data => {
            return expect(res.statusCode).toBe(200);
        });
    });
});