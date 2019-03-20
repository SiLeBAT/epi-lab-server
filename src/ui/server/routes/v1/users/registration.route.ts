import * as express from 'express';
import { ControllerFactory } from '../../../core/factories/controllerFactory';

function getRouter(controllerFactory: ControllerFactory) {
    const router = express.Router();
    const controller = controllerFactory.getController('REGISTRATION');

    router.route('/').post(controller.register.bind(controller));
    return router;
}

export { getRouter };